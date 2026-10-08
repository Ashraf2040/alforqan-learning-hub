import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { emptyMarkValues, MARK_FIELDS, type MarkColumn, type MarkField } from '@/lib/student-marks';
import { getEffectiveMarkScheme, resolveClassGradeId } from '@/lib/managed-mark-schemes';
import { getQuizColumns, isQuizField } from '@/lib/managed-quiz-marks';

const VALID_SEMESTERS = ['1st Semester', '2nd Semester'];

async function resolveAccess(role: string, sessionUserId: string, teacherId: string, classId: string, subjectId: string) {
  const teacher = await prisma.user.findFirst({
    where: { id: teacherId, role: 'TEACHER' },
    include: { classes: { select: { id: true } }, classTeacherAssignments: { select: { classId: true } }, subjects: { select: { id: true } }, subjectTeacherAssignments: { select: { subjectId: true } } },
  });
  if (!teacher || (role !== 'ADMIN' && teacher.id !== sessionUserId)) return null;
  const classIds = new Set([...teacher.classes.map(({ id }) => id), ...teacher.classTeacherAssignments.map(({ classId: id }) => id)]);
  const subjectIds = new Set([...teacher.subjects.map(({ id }) => id), ...teacher.subjectTeacherAssignments.map(({ subjectId: id }) => id)]);
  if (!classIds.has(classId) || !subjectIds.has(subjectId)) return null;
  const [schoolClass, subject] = await Promise.all([
    prisma.class.findUnique({ where: { id: classId }, select: { id: true, name: true, gradeId: true, students: { orderBy: { name: 'asc' }, select: { id: true, name: true } } } }),
    prisma.subject.findUnique({ where: { id: subjectId }, select: { id: true, name: true } }),
  ]);
  if (!schoolClass || !subject) return null;
  const gradeId = await resolveClassGradeId(schoolClass.name, schoolClass.gradeId);
  return { teacher, schoolClass: { ...schoolClass, gradeId }, subject };
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['ADMIN', 'TEACHER'].includes(session.user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const query = request.nextUrl.searchParams;
  const teacherId = session.user.role === 'ADMIN' ? (query.get('teacherId') ?? '') : session.user.id;
  const classId = query.get('classId') ?? '';
  const subjectId = query.get('subjectId') ?? '';
  const academicYear = query.get('academicYear')?.trim() ?? '';
  const semester = query.get('semester') ?? '';
  if (!teacherId || !classId || !subjectId || !academicYear || !VALID_SEMESTERS.includes(semester)) return NextResponse.json({ error: 'Choose the teacher, class, subject, academic year, and semester.' }, { status: 400 });
  const access = await resolveAccess(session.user.role, session.user.id, teacherId, classId, subjectId);
  if (!access) return NextResponse.json({ error: 'Choose a class and subject assigned to this teacher.' }, { status: 403 });
  const [records, quizRecords, students, scheme, quizColumns] = await Promise.all([
    prisma.managedStudentMark.findMany({ where: { classId, subjectId, academicYear, term: semester } }),
    prisma.managedQuizMark.findMany({ where: { classId, subjectId, academicYear, term: semester } }),
    Promise.resolve(access.schoolClass.students),
    getEffectiveMarkScheme(subjectId, access.subject.name, access.schoolClass.gradeId, classId),
    getQuizColumns(subjectId),
  ]);
  const columns = [...scheme.columns, ...quizColumns];
  const byStudent = new Map(records.map((record) => [record.studentId, record]));
  const quizByStudent = new Map(quizRecords.map((record) => [record.studentId, record]));
  return NextResponse.json({
    className: access.schoolClass.name,
    subjectName: access.subject.name,
    columns,
    resolvedScope: scheme.resolvedScope,
    students: students.map((student) => {
      const record = byStudent.get(student.id);
      const quiz = quizByStudent.get(student.id);
      let extra: Record<string, number> = {};
      try { extra = record ? JSON.parse(record.extraMarks) as Record<string, number> : {}; } catch { extra = {}; }
      return { id: student.id, name: student.name, mark: { ...emptyMarkValues(), ...(record ?? {}), ...extra, quiz1: quiz?.firstQuiz ?? 0, quiz2: quiz?.secondQuiz ?? 0, totalMarks: record?.totalMarks ?? 0 } };
    }),
  });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['ADMIN', 'TEACHER'].includes(session.user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const teacherId = session.user.role === 'ADMIN' ? String(body.teacherId ?? '') : session.user.id;
    const classId = String(body.classId ?? '');
    const subjectId = String(body.subjectId ?? '');
    const academicYear = String(body.academicYear ?? '').trim();
    const semester = String(body.semester ?? '');
    if (!teacherId || !classId || !subjectId || !academicYear || !VALID_SEMESTERS.includes(semester) || !Array.isArray(body.students)) return NextResponse.json({ error: 'Choose all filters and include student marks.' }, { status: 400 });
    const access = await resolveAccess(session.user.role, session.user.id, teacherId, classId, subjectId);
    if (!access) return NextResponse.json({ error: 'Choose a class and subject assigned to this teacher.' }, { status: 403 });
    const scheme = await getEffectiveMarkScheme(subjectId, access.subject.name, access.schoolClass.gradeId, classId);
    const columns = [...scheme.columns, ...await getQuizColumns(subjectId)];
    const studentIds = new Set(access.schoolClass.students.map(({ id }) => id));
    const columnByField = new Map(columns.map((column) => [column.field, column]));
    const items = body.students as unknown[];
    const submittedStudentIds = items.map((item) => item && typeof item === 'object' ? String((item as { studentId?: unknown }).studentId ?? '') : '');
    if (items.length !== studentIds.size || new Set(submittedStudentIds).size !== studentIds.size || submittedStudentIds.some((id) => !studentIds.has(id))) return NextResponse.json({ error: 'Student list changed. Reload the class before saving.' }, { status: 409 });
    const writes = items.map((item) => {
      const raw = item as { studentId: string; values?: Record<string, unknown> };
      const values = emptyMarkValues();
      const extraValues: Record<string, number> = {};
      for (const field of MARK_FIELDS) {
        const column = columnByField.get(field);
        if (!column) { values[field] = 0; continue; }
        values[field] = validateValue(raw.values?.[field], column);
      }
      for (const column of columns) {
        if ((MARK_FIELDS as readonly string[]).includes(column.field)) continue;
        if (isQuizField(column.field)) continue;
        extraValues[column.field] = validateValue(raw.values?.[column.field], column);
      }
      return { studentId: raw.studentId, values, extraValues, totalMarks: 0 };
    });
    const quizRecords = await prisma.managedQuizMark.findMany({ where: { studentId: { in: submittedStudentIds }, classId, subjectId, academicYear, term: semester } });
    const quizByStudent = new Map(quizRecords.map((record) => [record.studentId, record]));
    for (const write of writes) {
      write.totalMarks = columns.reduce((total, column) => total + (isQuizField(column.field)
        ? (column.field === 'quiz1' ? quizByStudent.get(write.studentId)?.firstQuiz : quizByStudent.get(write.studentId)?.secondQuiz) ?? 0
        : ((MARK_FIELDS as readonly string[]).includes(column.field) ? write.values[column.field as MarkField] : write.extraValues[column.field] ?? 0)), 0);
    }
    await prisma.$transaction(writes.map(({ studentId, values, extraValues, totalMarks }) => prisma.managedStudentMark.upsert({
      where: { studentId_classId_subjectId_academicYear_term: { studentId, classId, subjectId, academicYear, term: semester } },
      create: { studentId, classId, subjectId, updatedById: session.user.id, academicYear, term: semester, ...values, extraMarks: JSON.stringify(extraValues), totalMarks },
      update: { updatedById: session.user.id, ...values, extraMarks: JSON.stringify(extraValues), totalMarks },
    })));
    return NextResponse.json({ ok: true, saved: writes.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not save student marks.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

function validateValue(value: unknown, column: MarkColumn) {
  const score = value ?? 0;
  if (typeof score !== 'number' || !Number.isInteger(score) || score < 0 || score > column.max) throw new Error(`Invalid ${column.label} mark. Maximum is ${column.max}.`);
  return score;
}
