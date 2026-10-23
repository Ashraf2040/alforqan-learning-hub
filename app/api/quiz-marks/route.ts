import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculateQuizAverage, getQuizLimits, withQuizAverageColumn } from '@/lib/managed-quiz-marks';
import { resolveQuizAccess, teacherQuizSectionEnabled } from '@/lib/quiz-access';
import { isSemester } from '@/lib/academic-periods';
import { canTeacherEditMarks } from '@/lib/mark-submission-policy';
import { hasAdminFeature } from '@/lib/custom-admin';
import { emptyMarkValues, MARK_FIELDS } from '@/lib/student-marks';
import { getEffectiveMarkScheme, resolveClassGradeId } from '@/lib/managed-mark-schemes';


export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['ADMIN', 'TEACHER', 'CUSTOM_ADMIN'].includes(session.user.role) || (session.user.role === 'CUSTOM_ADMIN' && !(await hasAdminFeature(session.user, 'quizMarks')))) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  if (session.user.role === 'TEACHER' && !(await teacherQuizSectionEnabled())) return NextResponse.json({ error: 'Quiz marks are currently disabled for teachers.' }, { status: 403 });
  const query = request.nextUrl.searchParams;
  const teacherId = session.user.role === 'ADMIN' || session.user.role === 'CUSTOM_ADMIN' ? (query.get('teacherId') ?? '') : session.user.id;
  const classId = query.get('classId') ?? '';
  const subjectId = query.get('subjectId') ?? '';
  const academicYear = query.get('academicYear')?.trim() ?? '';
  const semester = query.get('semester') ?? '';
  if (!teacherId || !classId || !subjectId || !academicYear || !isSemester(semester)) return NextResponse.json({ error: 'Choose the class, subject, year, and semester.' }, { status: 400 });
  const access = await resolveQuizAccess(session.user.role, session.user.id, teacherId, classId, subjectId);
  if (!access) return NextResponse.json({ error: 'Choose a class and subject assigned to this teacher.' }, { status: 403 });
  const [rows, columns, scheme] = await Promise.all([
    prisma.managedQuizMark.findMany({ where: { classId, subjectId, academicYear, term: semester } }),
    Promise.resolve(access.schoolClass.students),
    prisma.managedQuizScheme.findUnique({ where: { subjectId }, select: { firstMax: true, secondMax: true } }),
  ]);
  const byStudent = new Map(rows.map((row) => [row.studentId, row]));
  return NextResponse.json({ className: access.schoolClass.name, scheme: scheme ?? { firstMax: 10, secondMax: 10 }, students: columns.map((student) => { const row = byStudent.get(student.id); return { ...student, firstQuiz: row?.firstQuiz ?? 0, secondQuiz: row?.secondQuiz ?? 0 }; }) });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['ADMIN', 'TEACHER', 'CUSTOM_ADMIN'].includes(session.user.role) || (session.user.role === 'CUSTOM_ADMIN' && !(await hasAdminFeature(session.user, 'quizMarks')))) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  if (session.user.role === 'TEACHER' && !(await teacherQuizSectionEnabled())) return NextResponse.json({ error: 'Quiz marks are currently disabled for teachers.' }, { status: 403 });
  try {
    const body = await request.json();
    const teacherId = session.user.role === 'ADMIN' || session.user.role === 'CUSTOM_ADMIN' ? String(body.teacherId ?? '') : session.user.id;
    const classId = String(body.classId ?? ''), subjectId = String(body.subjectId ?? ''), academicYear = String(body.academicYear ?? '').trim(), semester = String(body.semester ?? '');
    if (!teacherId || !classId || !subjectId || !academicYear || !isSemester(semester) || !Array.isArray(body.students)) return NextResponse.json({ error: 'Choose the class, subject, year, and semester.' }, { status: 400 });
    const access = await resolveQuizAccess(session.user.role, session.user.id, teacherId, classId, subjectId);
    if (!access) return NextResponse.json({ error: 'Choose a class and subject assigned to this teacher.' }, { status: 403 });
    if (session.user.role === 'TEACHER' && !(await canTeacherEditMarks(session.user.id)).canEdit) return NextResponse.json({ error: 'The mark entry deadline has passed. You can view marks but cannot edit them.' }, { status: 403 });
    const scheme = await prisma.managedQuizScheme.findUnique({ where: { subjectId }, select: { firstMax: true, secondMax: true } });
    const firstMax = scheme?.firstMax ?? 10, secondMax = scheme?.secondMax ?? 10;
    const expected = new Set(access.schoolClass.students.map(({ id }) => id));
    const entries = body.students as { studentId?: unknown; id?: unknown; firstQuiz?: unknown; secondQuiz?: unknown }[];
    const ids = entries.map((item) => String(item.studentId ?? item.id ?? ''));
    if (ids.length !== expected.size || new Set(ids).size !== expected.size || ids.some((id) => !expected.has(id))) return NextResponse.json({ error: 'Student list changed. Reload the class before saving.' }, { status: 409 });
    const asScore = (value: unknown, max: number, label: string) => { if (value === null || value === undefined || value === '') return 0; const score = value; if (typeof score !== 'number' || !Number.isInteger(score) || score < 1 || score > max) throw new Error(`${label} must be between 1 and ${max}, or left blank.`); return score; };
    await prisma.$transaction(entries.map((item) => {
      const studentId = String(item.studentId ?? item.id ?? '');
      const firstQuiz = asScore(item.firstQuiz, firstMax, 'First quiz');
      const secondQuiz = asScore(item.secondQuiz, secondMax, 'Second quiz');
      return prisma.managedQuizMark.upsert({
        where: { studentId_classId_subjectId_academicYear_term: { studentId, classId, subjectId, academicYear, term: semester } },
        create: { studentId, classId, subjectId, updatedById: session.user.id, academicYear, term: semester, firstQuiz, secondQuiz },
        update: { updatedById: session.user.id, firstQuiz, secondQuiz },
      });
    }));
    const gradeId = await resolveClassGradeId(access.schoolClass.name, null);
    const [markScheme, quizLimits, marks, quizMarks] = await Promise.all([
      getEffectiveMarkScheme(subjectId, access.subject.name, gradeId, classId),
      getQuizLimits(subjectId),
      prisma.managedStudentMark.findMany({ where: { classId, subjectId, academicYear, term: semester } }),
      prisma.managedQuizMark.findMany({ where: { classId, subjectId, academicYear, term: semester } }),
    ]);
    const markColumns = withQuizAverageColumn(markScheme.columns, access.subject.name);
    const markByStudent = new Map(marks.map((mark) => [mark.studentId, mark]));
    const quizByStudent = new Map(quizMarks.map((mark) => [mark.studentId, mark]));
    await prisma.$transaction([...expected].map((studentId) => {
      const mark = markByStudent.get(studentId);
      const quiz = quizByStudent.get(studentId);
      let extra: Record<string, unknown> = {};
      try { extra = mark ? JSON.parse(mark.extraMarks) as Record<string, unknown> : {}; } catch { extra = {}; }
      const totalMarks = markColumns.reduce((sum, column) => sum + (column.quizAverage
        ? calculateQuizAverage(quiz?.firstQuiz ?? 0, quiz?.secondQuiz ?? 0, quizLimits, column.max)
        : ((MARK_FIELDS as readonly string[]).includes(column.field) ? Number((mark as unknown as Record<string, unknown> | undefined)?.[column.field] ?? 0) : Number(extra[column.field] ?? 0))), 0);
      const key = { studentId, classId, subjectId, academicYear, term: semester };
      return prisma.managedStudentMark.upsert({
        where: { studentId_classId_subjectId_academicYear_term: key },
        create: { ...key, ...emptyMarkValues(), totalMarks, extraMarks: '{}', updatedById: session.user.id },
        update: { totalMarks },
      });
    }));
    return NextResponse.json({ ok: true, saved: entries.length });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not save quiz marks.' }, { status: 400 }); }
}
