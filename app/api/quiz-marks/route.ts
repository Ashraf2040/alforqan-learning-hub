import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getQuizColumns } from '@/lib/managed-quiz-marks';
import { resolveQuizAccess, teacherQuizSectionEnabled } from '@/lib/quiz-access';

const terms = ['1st Semester', '2nd Semester'];

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['ADMIN', 'TEACHER'].includes(session.user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role === 'TEACHER' && !(await teacherQuizSectionEnabled())) return NextResponse.json({ error: 'Quiz marks are currently disabled for teachers.' }, { status: 403 });
  const query = request.nextUrl.searchParams;
  const teacherId = session.user.role === 'ADMIN' ? (query.get('teacherId') ?? '') : session.user.id;
  const classId = query.get('classId') ?? '';
  const subjectId = query.get('subjectId') ?? '';
  const academicYear = query.get('academicYear')?.trim() ?? '';
  const semester = query.get('semester') ?? '';
  if (!teacherId || !classId || !subjectId || !academicYear || !terms.includes(semester)) return NextResponse.json({ error: 'Choose the class, subject, year, and semester.' }, { status: 400 });
  const access = await resolveQuizAccess(session.user.role, session.user.id, teacherId, classId, subjectId);
  if (!access) return NextResponse.json({ error: 'Choose a class and subject assigned to this teacher.' }, { status: 403 });
  const [rows, columns, scheme] = await Promise.all([
    prisma.managedQuizMark.findMany({ where: { classId, subjectId, academicYear, term: semester } }),
    Promise.resolve(access.schoolClass.students),
    prisma.managedQuizScheme.findUnique({ where: { subjectId }, select: { firstMax: true, secondMax: true } }),
  ]);
  const byStudent = new Map(rows.map((row) => [row.studentId, row]));
  return NextResponse.json({ className: access.schoolClass.name, scheme: scheme ?? { firstMax: 10, secondMax: 10 }, columns: await getQuizColumns(subjectId), students: columns.map((student) => { const row = byStudent.get(student.id); return { ...student, firstQuiz: row?.firstQuiz ?? 0, secondQuiz: row?.secondQuiz ?? 0 }; }) });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['ADMIN', 'TEACHER'].includes(session.user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (session.user.role === 'TEACHER' && !(await teacherQuizSectionEnabled())) return NextResponse.json({ error: 'Quiz marks are currently disabled for teachers.' }, { status: 403 });
  try {
    const body = await request.json();
    const teacherId = session.user.role === 'ADMIN' ? String(body.teacherId ?? '') : session.user.id;
    const classId = String(body.classId ?? ''), subjectId = String(body.subjectId ?? ''), academicYear = String(body.academicYear ?? '').trim(), semester = String(body.semester ?? '');
    if (!teacherId || !classId || !subjectId || !academicYear || !terms.includes(semester) || !Array.isArray(body.students)) return NextResponse.json({ error: 'Choose the class, subject, year, and semester.' }, { status: 400 });
    const access = await resolveQuizAccess(session.user.role, session.user.id, teacherId, classId, subjectId);
    if (!access) return NextResponse.json({ error: 'Choose a class and subject assigned to this teacher.' }, { status: 403 });
    const scheme = await prisma.managedQuizScheme.findUnique({ where: { subjectId }, select: { firstMax: true, secondMax: true } });
    const firstMax = scheme?.firstMax ?? 10, secondMax = scheme?.secondMax ?? 10;
    const expected = new Set(access.schoolClass.students.map(({ id }) => id));
    const entries = body.students as { studentId?: unknown; id?: unknown; firstQuiz?: unknown; secondQuiz?: unknown }[];
    const ids = entries.map((item) => String(item.studentId ?? item.id ?? ''));
    if (ids.length !== expected.size || new Set(ids).size !== expected.size || ids.some((id) => !expected.has(id))) return NextResponse.json({ error: 'Student list changed. Reload the class before saving.' }, { status: 409 });
    const asScore = (value: unknown, max: number, label: string) => { const score = value ?? 0; if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > max) throw new Error(`${label} must be between 0 and ${max}.`); return score; };
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
    return NextResponse.json({ ok: true, saved: entries.length });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not save quiz marks.' }, { status: 400 }); }
}
