import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { emptyMarkValues, type MarkColumn } from '@/lib/student-marks';
import { getEffectiveMarkScheme, resolveClassGradeId } from '@/lib/managed-mark-schemes';
import { getQuizColumns } from '@/lib/managed-quiz-marks';

const VALID_SEMESTERS = ['1st Semester', '2nd Semester'];

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['ADMIN', 'TEACHER'].includes(session.user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const query = request.nextUrl.searchParams;
  const teacherId = session.user.role === 'ADMIN' ? (query.get('teacherId') ?? '') : session.user.id;
  const classId = query.get('classId') ?? '';
  const academicYear = query.get('academicYear')?.trim() ?? '';
  const semester = query.get('semester') ?? '';
  const studentId = query.get('studentId');
  if (!teacherId || !classId || !academicYear || !VALID_SEMESTERS.includes(semester)) return NextResponse.json({ error: 'Choose the teacher, class, academic year, and semester.' }, { status: 400 });
  const teacher = await prisma.user.findFirst({ where: { id: teacherId, role: 'TEACHER' }, include: { classes: { select: { id: true } }, classTeacherAssignments: { select: { classId: true } }, subjects: { select: { id: true } }, subjectTeacherAssignments: { select: { subjectId: true } } } });
  const assignedClasses = new Set([...(teacher?.classes ?? []).map(({ id }) => id), ...(teacher?.classTeacherAssignments ?? []).map(({ classId: id }) => id)]);
  if (!teacher || (session.user.role !== 'ADMIN' && teacher.id !== session.user.id) || !assignedClasses.has(classId)) return NextResponse.json({ error: 'Class is not assigned to this teacher.' }, { status: 403 });
  const subjectSelect = { id: true, name: true } as const;
  const schoolClass = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      students: { where: studentId ? { id: studentId } : {}, orderBy: { name: 'asc' }, select: { id: true, name: true } },
      classSubjects: { include: { subject: { select: subjectSelect } } },
      grade: { include: { subjects: { include: { subject: { select: subjectSelect } } } } },
    },
  });
  if (!schoolClass) return NextResponse.json({ error: 'Class not found.' }, { status: 404 });
  const effectiveGradeId = await resolveClassGradeId(schoolClass.name, schoolClass.gradeId);
  const subjectMap = new Map<string, { id: string; name: string; columns: MarkColumn[] }>();
  const candidates = [...schoolClass.classSubjects.map(({ subject }) => subject), ...(schoolClass.grade?.subjects.map(({ subject }) => subject) ?? [])];
  const teacherSubjectIds = new Set([...teacher.subjects.map(({ id }) => id), ...teacher.subjectTeacherAssignments.map(({ subjectId: id }) => id)]);
  for (const subject of candidates) {
    if (session.user.role !== 'ADMIN' && !teacherSubjectIds.has(subject.id)) continue;
    const [scheme, quizColumns] = await Promise.all([getEffectiveMarkScheme(subject.id, subject.name, effectiveGradeId, classId), getQuizColumns(subject.id)]);
    subjectMap.set(subject.id, { id: subject.id, name: subject.name, columns: [...scheme.columns, ...quizColumns] });
  }
  if (!subjectMap.size) {
    const assigned = await prisma.subject.findMany({ where: { id: { in: [...teacherSubjectIds] } }, select: { id: true, name: true }, orderBy: { name: 'asc' } });
    for (const subject of assigned) {
      const [scheme, quizColumns] = await Promise.all([getEffectiveMarkScheme(subject.id, subject.name, effectiveGradeId, classId), getQuizColumns(subject.id)]);
      subjectMap.set(subject.id, { id: subject.id, name: subject.name, columns: [...scheme.columns, ...quizColumns] });
    }
  }
  const subjectIds = [...subjectMap.keys()];
  const [records, quizRecords] = await Promise.all(subjectIds.length ? [
    prisma.managedStudentMark.findMany({ where: { classId, subjectId: { in: subjectIds }, academicYear, term: semester, ...(studentId ? { studentId } : {}) } }),
    prisma.managedQuizMark.findMany({ where: { classId, subjectId: { in: subjectIds }, academicYear, term: semester, ...(studentId ? { studentId } : {}) } }),
  ] : [Promise.resolve([]), Promise.resolve([])]);
  const byKey = new Map(records.map((record) => [`${record.studentId}:${record.subjectId}`, record]));
  const quizByKey = new Map(quizRecords.map((record) => [`${record.studentId}:${record.subjectId}`, record]));
  const students = schoolClass.students.map((student) => ({ ...student, marks: Object.fromEntries(subjectMap.keys().map((id) => {
    const record = byKey.get(`${student.id}:${id}`);
    const quiz = quizByKey.get(`${student.id}:${id}`);
    let extra: Record<string, number> = {};
    try { extra = record ? JSON.parse(record.extraMarks) as Record<string, number> : {}; } catch { extra = {}; }
    return [id, { ...emptyMarkValues(), ...(record ?? {}), ...extra, quiz1: quiz?.firstQuiz ?? 0, quiz2: quiz?.secondQuiz ?? 0, totalMarks: record?.totalMarks ?? 0 }];
  })) }));
  return NextResponse.json({ className: schoolClass.name, academicYear, semester, subjects: [...subjectMap.values()], students });
}
