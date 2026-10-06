import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const classId = request.nextUrl.searchParams.get('classId');
  const week = request.nextUrl.searchParams.get('week');
  const date = request.nextUrl.searchParams.get('date');
  if (request.nextUrl.searchParams.get('mode') === 'assignments') {
    if (!week?.trim()) return NextResponse.json({ error: 'Choose a week.' }, { status: 400 });
    // Older teacher entries may use labels such as "Week 4" or "04" while
    // the admin filter is entered as "4". Compare normalized labels so those
    // saved submissions still appear in the assignment grid.
    const normalizeWeek = (value: string) => {
      const trimmed = value.trim();
      const number = trimmed.match(/(?:^|\b)week\s*(\d+)\s*$/i)?.[1] ?? trimmed.match(/^\d+$/)?.[0];
      return number ? number.replace(/^0+(?=\d)/, '') : trimmed.toLocaleLowerCase();
    };
    const selectedWeek = normalizeWeek(week);
    const numericWeek = /^\d+$/.test(selectedWeek) ? selectedWeek : null;
    const weekAliases = [...new Set([week.trim(), selectedWeek, ...(numericWeek ? [`Week ${numericWeek}`, `week ${numericWeek}`, numericWeek.padStart(2, '0')] : [])])];
    const weekWhere = { OR: [{ week: { in: weekAliases } }, ...(numericWeek ? [{ week: { contains: numericWeek } }] : [])] };
    const [adminAssignments, teacherSubmissions, grades] = await Promise.all([
      prisma.adminWeeklyPlan.findMany({ where: weekWhere, include: { grade: { select: { id: true, name: true } }, items: { include: { subject: { select: { id: true, name: true } } } } } }),
      prisma.weeklyPlannerSubmission.findMany({ where: weekWhere, include: { classes: { select: { id: true, name: true, gradeId: true } }, items: { include: { subject: { select: { id: true, name: true } } } } }, orderBy: [{ fromDate: 'asc' }, { createdAt: 'asc' }] }),
      prisma.grade.findMany({ select: { id: true, name: true } }),
    ]);
    const matchingAdminAssignments = adminAssignments.filter((plan) => normalizeWeek(plan.week) === selectedWeek);
    const matchingTeacherSubmissions = teacherSubmissions.filter((submission) => normalizeWeek(submission.week) === selectedWeek);
    const gradeForClass = (schoolClass: { id: string; name: string; gradeId: string | null }) => {
      if (schoolClass.gradeId) return schoolClass.gradeId;
      const number = schoolClass.name.match(/(\d+)/)?.[1];
      return number ? grades.find((grade) => grade.name.match(/\d+/)?.[0] === number)?.id : undefined;
    };
    type Draft = { gradeId: string; week: string; semester: string | null; fromDate: Date; toDate: Date; dictation: string | null; notes: string | null; items: Map<string, { subjectId: string; subject: { id: string; name: string }; classwork: string[]; homework: string[] }> };
    const teacherDrafts = new Map<string, Draft>();
    for (const submission of matchingTeacherSubmissions) {
      const targetGradeIds = [...new Set(submission.classes.map(gradeForClass).filter((id): id is string => Boolean(id)))];
      for (const targetGradeId of targetGradeIds) {
        let draft = teacherDrafts.get(targetGradeId);
        if (!draft) {
          draft = { gradeId: targetGradeId, week: submission.week, semester: submission.semester, fromDate: submission.fromDate, toDate: submission.toDate, dictation: null, notes: null, items: new Map() };
          teacherDrafts.set(targetGradeId, draft);
        }
        draft.fromDate = submission.fromDate < draft.fromDate ? submission.fromDate : draft.fromDate;
        draft.toDate = submission.toDate > draft.toDate ? submission.toDate : draft.toDate;
        if (submission.dictation?.trim()) draft.dictation = [...new Set([...(draft.dictation ? [draft.dictation] : []), submission.dictation.trim()])].join('\n');
        if (submission.notes?.trim()) draft.notes = [...new Set([...(draft.notes ? [draft.notes] : []), submission.notes.trim()])].join('\n');
        for (const item of submission.items) {
          let target = draft.items.get(item.subjectId);
          if (!target) { target = { subjectId: item.subjectId, subject: item.subject, classwork: [], homework: [] }; draft.items.set(item.subjectId, target); }
          if (item.classwork.trim() && !target.classwork.includes(item.classwork.trim())) target.classwork.push(item.classwork.trim());
          if (item.homework.trim() && !target.homework.includes(item.homework.trim())) target.homework.push(item.homework.trim());
        }
      }
    }
    const adminGradeIds = new Set(matchingAdminAssignments.map((plan) => plan.gradeId));
    const adminResults = matchingAdminAssignments.map((plan) => ({ ...plan, source: 'ADMIN' as const }));
    const teacherResults = [...teacherDrafts.values()].filter((draft) => !adminGradeIds.has(draft.gradeId)).map((draft) => ({
      id: `teacher-draft-${draft.gradeId}`, gradeId: draft.gradeId, week: draft.week, semester: draft.semester, fromDate: draft.fromDate, toDate: draft.toDate,
      dictation: draft.dictation, notes: draft.notes, dictationStyle: null, notesStyle: null,
      grade: grades.find((grade) => grade.id === draft.gradeId) ?? { id: draft.gradeId, name: '' }, source: 'TEACHER' as const,
      items: [...draft.items.values()].map((item) => ({ id: `${draft.gradeId}-${item.subjectId}`, subjectId: item.subjectId, subject: item.subject, classwork: item.classwork.join('\n'), homework: item.homework.join('\n'), classworkStyle: null, homeworkStyle: null })),
    }));
    return NextResponse.json([...adminResults, ...teacherResults]);
  }
  if (!classId || (!week && !date) || (week && date)) return NextResponse.json({ error: 'Choose one class and either a week number or a date.' }, { status: 400 });
  const selectedDate = date ? new Date(`${date}T12:00:00.000Z`) : null;
  if (selectedDate && Number.isNaN(selectedDate.getTime())) return NextResponse.json({ error: 'Choose a valid date.' }, { status: 400 });
  const selectedClass = await prisma.class.findUnique({ where: { id: classId }, include: { grade: { select: { id: true } } } });
  let gradeId = selectedClass?.gradeId ?? null;
  if (!gradeId && selectedClass) {
    const leadingNumber = selectedClass.name.match(/^\s*(\d+)/)?.[1];
    if (leadingNumber) {
      const grades = await prisma.grade.findMany({ select: { id: true, name: true } });
      gradeId = grades.find((grade) => grade.name.match(/\d+/)?.[0] === leadingNumber)?.id ?? null;
    }
  }
  const adminPlan = gradeId ? await prisma.adminWeeklyPlan.findFirst({
    where: { gradeId, ...(week ? { week: week.trim() } : {}), ...(selectedDate ? { fromDate: { lte: selectedDate }, toDate: { gte: selectedDate } } : {}) },
    include: { items: { include: { subject: { select: { id: true, name: true } } } } },
    orderBy: { updatedAt: 'desc' },
  }) : null;
  if (adminPlan) return NextResponse.json([{
    id: adminPlan.id, week: adminPlan.week, semester: adminPlan.semester, fromDate: adminPlan.fromDate, toDate: adminPlan.toDate,
    dictation: adminPlan.dictation, dictationStyle: adminPlan.dictationStyle, notes: adminPlan.notes, notesStyle: adminPlan.notesStyle, teacher: { name: 'Admin' }, items: adminPlan.items,
  }]);
  const plans = await prisma.weeklyPlannerSubmission.findMany({
    where: {
      classes: { some: { id: classId } },
      ...(week ? { week: week.trim() } : {}),
      ...(selectedDate ? { fromDate: { lte: selectedDate }, toDate: { gte: selectedDate } } : {}),
    },
    include: { teacher: { select: { name: true } }, items: { include: { subject: { select: { id: true, name: true } } } } },
    orderBy: [{ fromDate: 'desc' }, { createdAt: 'desc' }],
  });
  return NextResponse.json(plans);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const week = typeof body.week === 'string' ? body.week.trim() : '';
  const semester = typeof body.semester === 'string' ? body.semester.trim() : '';
  const fromDate = typeof body.fromDate === 'string' ? new Date(`${body.fromDate}T00:00:00.000Z`) : null;
  const toDate = typeof body.toDate === 'string' ? new Date(`${body.toDate}T23:59:59.999Z`) : null;
  type NormalizedPlan = { gradeId: string; dictation: string; notes: string; dictationStyle: string | null; notesStyle: string | null; items: { subjectId: string; classwork: string; homework: string; classworkStyle: string | null; homeworkStyle: string | null }[] };
  const normalizeStyle = (value: unknown): string | null => {
    if (!value || typeof value !== 'object') return null;
    const raw = value as Record<string, unknown>;
    const fontSizes = new Set(['12px', '14px', '16px', '18px', '22px', '26px']);
    const fontSize = typeof raw.fontSize === 'string' && fontSizes.has(raw.fontSize) ? raw.fontSize : '14px';
    const color = typeof raw.color === 'string' && /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : '#0f172a';
    const fontWeight = raw.fontWeight === '700' ? '700' : '400';
    const fontStyle = raw.fontStyle === 'italic' ? 'italic' : 'normal';
    const textDecoration = raw.textDecoration === 'underline' ? 'underline' : 'none';
    return JSON.stringify({ fontSize, color, fontWeight, fontStyle, textDecoration });
  };
  const gradePlans: unknown[] = Array.isArray(body.gradePlans) ? body.gradePlans : [];
  const removeGradeIds: string[] = Array.isArray(body.removeGradeIds) ? [...new Set((body.removeGradeIds as unknown[]).filter((id): id is string => typeof id === 'string'))] : [];
  if (!week || !fromDate || !toDate || Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) return NextResponse.json({ error: 'Enter a week and a valid date range.' }, { status: 400 });
  const normalized: NormalizedPlan[] = gradePlans.map((raw) => {
    const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const rawItems: unknown[] = Array.isArray(row.items) ? row.items : [];
    return {
      gradeId: typeof row.gradeId === 'string' ? row.gradeId : '',
      dictation: typeof row.dictation === 'string' ? row.dictation.trim() : '',
      notes: typeof row.notes === 'string' ? row.notes.trim() : '',
      dictationStyle: normalizeStyle(row.dictationStyle),
      notesStyle: normalizeStyle(row.notesStyle),
      items: rawItems.flatMap((rawItem) => {
        const item = (rawItem && typeof rawItem === 'object' ? rawItem : {}) as Record<string, unknown>;
        const subjectId = typeof item.subjectId === 'string' ? item.subjectId : '';
        const classwork = typeof item.classwork === 'string' ? item.classwork.trim() : '';
        const homework = typeof item.homework === 'string' ? item.homework.trim() : '';
        return subjectId && (classwork || homework) ? [{ subjectId, classwork, homework, classworkStyle: normalizeStyle(item.classworkStyle), homeworkStyle: normalizeStyle(item.homeworkStyle) }] : [];
      }),
    };
  });
  if (normalized.some((row) => !row.gradeId) || new Set(normalized.map((row) => row.gradeId)).size !== normalized.length) return NextResponse.json({ error: 'Each grade can only be assigned once.' }, { status: 400 });
  const gradeIds = normalized.map((row) => row.gradeId);
  const grades = await prisma.grade.findMany({ where: { id: { in: gradeIds } }, include: { subjects: { select: { subjectId: true } } } });
  if (grades.length !== gradeIds.length) return NextResponse.json({ error: 'A selected grade no longer exists.' }, { status: 400 });
  const validByGrade = new Map(grades.map((grade) => [grade.id, new Set(grade.subjects.map(({ subjectId }) => subjectId))]));
  if (normalized.some((row) => row.items.some((item) => !validByGrade.get(row.gradeId)?.has(item.subjectId)))) return NextResponse.json({ error: 'A subject is not assigned to its selected grade.' }, { status: 400 });
  try {
    await prisma.$transaction(async (tx) => {
      if (removeGradeIds.length) await tx.adminWeeklyPlan.deleteMany({ where: { week, gradeId: { in: removeGradeIds } } });
      for (const row of normalized) await tx.adminWeeklyPlan.upsert({
        where: { gradeId_week: { gradeId: row.gradeId, week } },
        create: { gradeId: row.gradeId, week, semester: semester || null, fromDate, toDate, dictation: row.dictation || null, dictationStyle: row.dictationStyle, notes: row.notes || null, notesStyle: row.notesStyle, items: { create: row.items } },
        update: { semester: semester || null, fromDate, toDate, dictation: row.dictation || null, dictationStyle: row.dictationStyle, notes: row.notes || null, notesStyle: row.notesStyle, items: { deleteMany: {}, create: row.items } },
      });
    }, { maxWait: 10_000, timeout: 30_000 });
    return NextResponse.json({ ok: true, saved: normalized.length, removed: removeGradeIds.length });
  } catch (error) {
    console.error('Bulk admin weekly plans could not be saved', error);
    return NextResponse.json({ error: 'Could not save these weekly plans.' }, { status: 400 });
  }
}
