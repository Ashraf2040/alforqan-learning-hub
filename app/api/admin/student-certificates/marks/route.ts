import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { hasAdminFeature } from '@/lib/custom-admin';
import { prisma } from '@/lib/prisma';
import { emptyMarkValues, MARK_FIELDS, type MarkField } from '@/lib/student-marks';
import { getEffectiveMarkScheme, resolveClassGradeId } from '@/lib/managed-mark-schemes';
import { calculateQuizAverage, getQuizLimits, withQuizAverageColumn } from '@/lib/managed-quiz-marks';
import { isSemester } from '@/lib/academic-periods';


export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !(await hasAdminFeature(session.user, 'certificates'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  try {
    const body = await request.json();
    const { studentId, classId, subjectId, field } = body as { studentId?: string; classId?: string; subjectId?: string; field?: string };
    const academicYear = String(body.academicYear ?? '').trim();
    const semester = String(body.semester ?? '');
    const rawScore = body.score;
    if (!studentId || !classId || !subjectId || !academicYear || !isSemester(semester) || !field || (rawScore !== null && (typeof rawScore !== 'number' || !Number.isInteger(rawScore)))) return NextResponse.json({ error: 'Choose the class, subject, year, term, mark, and score.' }, { status: 400 });
    if (rawScore === 0) return NextResponse.json({ error: 'A mark must be at least 1. Leave the field blank when no mark was entered.' }, { status: 400 });
    const score = rawScore === null ? 0 : rawScore as number;
    const [schoolClass, subject, student] = await Promise.all([
      prisma.class.findUnique({ where: { id: classId }, select: { id: true, name: true, gradeId: true } }),
      prisma.subject.findUnique({ where: { id: subjectId }, select: { id: true, name: true } }),
      prisma.student.findFirst({ where: { id: studentId, classId }, select: { id: true } }),
    ]);
    if (!schoolClass || !subject || !student) return NextResponse.json({ error: 'The selected class, subject, or student could not be found.' }, { status: 404 });
    const gradeId = await resolveClassGradeId(schoolClass.name, schoolClass.gradeId);
    const [scheme, quizLimits] = await Promise.all([getEffectiveMarkScheme(subject.id, subject.name, gradeId, classId), getQuizLimits(subject.id)]);
    const columns = withQuizAverageColumn(scheme.columns, subject.name);
    const column = columns.find((item) => item.field === field);
    if (!column || column.readOnly || score > column.max) return NextResponse.json({ error: `Enter a mark from 1 to ${column?.max ?? 0}; quiz average is calculated automatically.` }, { status: 400 });
    const key = { studentId, classId, subjectId, academicYear, term: semester };
    const current = await prisma.managedStudentMark.findUnique({ where: { studentId_classId_subjectId_academicYear_term: key } });
    let extra: Record<string, number | boolean> = {};
    try { extra = current ? JSON.parse(current.extraMarks) as Record<string, number | boolean> : {}; } catch { extra = {}; }
    const values = { ...emptyMarkValues(), ...(current ?? {}) };
    const quiz = await prisma.managedQuizMark.findUnique({ where: { studentId_classId_subjectId_academicYear_term: key } });
    if ((MARK_FIELDS as readonly string[]).includes(field)) {
      values[field as MarkField] = score;
    } else {
      extra[field] = score;
    }
    const totalMarks = columns.reduce((sum, item) => sum + (item.quizAverage
      ? calculateQuizAverage(quiz?.firstQuiz ?? 0, quiz?.secondQuiz ?? 0, quizLimits, item.max)
      : ((MARK_FIELDS as readonly string[]).includes(item.field) ? values[item.field as MarkField] : Number(extra[item.field] ?? 0))), 0);
    const markUpdate: Record<string, unknown> = { totalMarks };
    const markCreate: Record<string, unknown> = { ...key, ...emptyMarkValues(), extraMarks: '{}', totalMarks };
    markUpdate.updatedById = session.user.id;
    markCreate.updatedById = session.user.id;
    if ((MARK_FIELDS as readonly string[]).includes(field)) {
      markUpdate[field] = score;
      markCreate[field] = score;
    } else {
      markUpdate.extraMarks = JSON.stringify(extra);
      markCreate.extraMarks = JSON.stringify(extra);
    }
    await prisma.managedStudentMark.upsert({ where: { studentId_classId_subjectId_academicYear_term: key }, create: markCreate as never, update: markUpdate as never });
    return NextResponse.json({ ok: true, totalMarks, editorName: session.user.name ?? null, editedAt: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not update this mark.' }, { status: 400 });
  }
}
