import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { emptyMarkValues, type MarkColumn } from '@/lib/student-marks';
import { getEffectiveMarkScheme, resolveClassGradeId } from '@/lib/managed-mark-schemes';
import { getQuizLimits, injectQuizAverage, withQuizAverageColumn } from '@/lib/managed-quiz-marks';
import { isSemester } from '@/lib/academic-periods';
import { hasAnyAdminFeature } from '@/lib/custom-admin';


export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['ADMIN', 'TEACHER', 'CUSTOM_ADMIN'].includes(session.user.role) || (session.user.role === 'CUSTOM_ADMIN' && !(await hasAnyAdminFeature(session.user, ['studentMarks', 'certificates'])))) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const adminAccess = session.user.role === 'ADMIN' || session.user.role === 'CUSTOM_ADMIN';
  const query = request.nextUrl.searchParams;
  const teacherId = adminAccess ? (query.get('teacherId') ?? '') : session.user.id;
  const classId = query.get('classId') ?? '';
  const academicYear = query.get('academicYear')?.trim() ?? '';
  const semester = query.get('semester') ?? '';
  const studentId = query.get('studentId');
  if ((session.user.role === 'TEACHER' && !teacherId) || !classId || !academicYear || !isSemester(semester)) return NextResponse.json({ error: 'Choose the class, academic year, and semester.' }, { status: 400 });
  const teacher = teacherId ? await prisma.user.findFirst({ where: { id: teacherId, role: 'TEACHER' }, include: { classes: { select: { id: true } }, classTeacherAssignments: { select: { classId: true } }, subjects: { select: { id: true } }, subjectTeacherAssignments: { select: { subjectId: true } } } }) : null;
  const assignedClasses = new Set([...(teacher?.classes ?? []).map(({ id }) => id), ...(teacher?.classTeacherAssignments ?? []).map(({ classId: id }) => id)]);
  if (session.user.role === 'TEACHER' && (!teacher || teacher.id !== session.user.id || !assignedClasses.has(classId))) return NextResponse.json({ error: 'Class is not assigned to this teacher.' }, { status: 403 });
  if (adminAccess && teacherId && (!teacher || !assignedClasses.has(classId))) return NextResponse.json({ error: 'Class is not assigned to this teacher.' }, { status: 403 });
  const subjectSelect = { id: true, name: true } as const;
  const schoolClass = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      students: { where: studentId ? { id: studentId } : {}, orderBy: { name: 'asc' }, select: { id: true, name: true } },
      classSubjects: { include: { subject: { select: subjectSelect } } },
      // Some older classes have no direct curriculum links. Their teachers'
      // subject assignments are still a reliable source for the class report.
      teachers: { include: { subjects: { select: subjectSelect }, subjectTeacherAssignments: { include: { subject: { select: subjectSelect } } } } },
      grade: { include: { subjects: { include: { subject: { select: subjectSelect } } } } },
    },
  });
  if (!schoolClass) return NextResponse.json({ error: 'Class not found.' }, { status: 404 });
  const effectiveGradeId = await resolveClassGradeId(schoolClass.name, schoolClass.gradeId);
  const subjectMap = new Map<string, { id: string; name: string; columns: MarkColumn[] }>();
  // Legacy classes (for example "5A") may not have gradeId persisted even
  // though resolveClassGradeId can infer their grade. Load that grade's
  // curriculum explicitly so the class report gets its subjects as well.
  const inferredGradeSubjects = effectiveGradeId && !schoolClass.grade
    ? await prisma.gradeSubject.findMany({ where: { gradeId: effectiveGradeId }, orderBy: [{ position: 'asc' }, { subject: { name: 'asc' } }], include: { subject: { select: subjectSelect } } })
    : [];
  const uniqueSubjects = (items: { id: string; name: string }[]) => [...new Map(items.map((item) => [item.id, item])).values()];
  let candidates = uniqueSubjects([
    ...schoolClass.classSubjects.map(({ subject }) => subject),
    ...(schoolClass.grade?.subjects.map(({ subject }) => subject) ?? []),
    ...inferredGradeSubjects.map(({ subject }) => subject),
  ]);
  const curriculumFallback = adminAccess && !teacherId && candidates.length === 0;
  if (adminAccess && !teacherId && candidates.length === 0) {
    const classTeacherSubjects = schoolClass.teachers.flatMap((item) => [
      ...item.subjects,
      ...item.subjectTeacherAssignments.map(({ subject }) => subject),
    ]);
    candidates = uniqueSubjects(classTeacherSubjects);
    // A legacy class can be missing both curriculum and teacher-subject links.
    // In that case, still show the school's subject catalog so the report
    // never silently renders a student list with a meaningless /0 total.
    if (candidates.length === 0) {
      candidates = await prisma.subject.findMany({ orderBy: [{ reportOrder: 'asc' }, { name: 'asc' }], select: subjectSelect });
    }
  }
  if (adminAccess && !teacherId) {
    // Preserve subjects that already have marks even when the curriculum links
    // were removed or never backfilled for this legacy class.
    const markedSubjectIds = await Promise.all([
      prisma.managedStudentMark.findMany({ where: { classId, academicYear, term: semester }, select: { subjectId: true }, distinct: ['subjectId'] }),
      prisma.managedQuizMark.findMany({ where: { classId, academicYear, term: semester }, select: { subjectId: true }, distinct: ['subjectId'] }),
    ]);
    const ids = [...new Set(markedSubjectIds.flat().map(({ subjectId }) => subjectId))];
    if (ids.length) {
      const recordedSubjects = await prisma.subject.findMany({ where: { id: { in: ids } }, select: subjectSelect });
      candidates = uniqueSubjects([...candidates, ...recordedSubjects]);
    }
  }
  const teacherSubjectIds = new Set([...(teacher?.subjects ?? []).map(({ id }) => id), ...(teacher?.subjectTeacherAssignments ?? []).map(({ subjectId: id }) => id)]);
  for (const subject of candidates) {
    if (!adminAccess && !teacherSubjectIds.has(subject.id)) continue;
    const [scheme] = await Promise.all([getEffectiveMarkScheme(subject.id, subject.name, effectiveGradeId, classId)]);
    subjectMap.set(subject.id, { id: subject.id, name: subject.name, columns: withQuizAverageColumn(scheme.columns, subject.name) });
  }
  if (!subjectMap.size) {
    const storedMarks = adminAccess && !teacherId ? await Promise.all([
      prisma.managedStudentMark.findMany({ where: { classId, academicYear, term: semester }, select: { subjectId: true }, distinct: ['subjectId'] }),
      prisma.managedQuizMark.findMany({ where: { classId, academicYear, term: semester }, select: { subjectId: true }, distinct: ['subjectId'] }),
    ]) : null;
    const knownSubjectIds = storedMarks ? [...new Set(storedMarks.flat().map(({ subjectId }) => subjectId))] : [...teacherSubjectIds];
    const assigned = await prisma.subject.findMany({ where: { id: { in: knownSubjectIds } }, select: subjectSelect, orderBy: { name: 'asc' } });
    for (const subject of assigned) {
      const scheme = await getEffectiveMarkScheme(subject.id, subject.name, effectiveGradeId, classId);
      subjectMap.set(subject.id, { id: subject.id, name: subject.name, columns: withQuizAverageColumn(scheme.columns, subject.name) });
    }
  }
  const subjectIds = [...subjectMap.keys()];
  const [records, quizRecords] = await Promise.all(subjectIds.length ? [
    prisma.managedStudentMark.findMany({ where: { classId, subjectId: { in: subjectIds }, academicYear, term: semester, ...(studentId ? { studentId } : {}) }, include: { updatedBy: { select: { name: true } } } }),
    prisma.managedQuizMark.findMany({ where: { classId, subjectId: { in: subjectIds }, academicYear, term: semester, ...(studentId ? { studentId } : {}) }, include: { updatedBy: { select: { name: true } } } }),
  ] : [Promise.resolve([]), Promise.resolve([])]);
  const byKey = new Map(records.map((record) => [`${record.studentId}:${record.subjectId}`, record]));
  const quizByKey = new Map(quizRecords.map((record) => [`${record.studentId}:${record.subjectId}`, record]));
  const quizLimitsBySubject = new Map(await Promise.all([...subjectMap.keys()].map(async (id) => [id, await getQuizLimits(id)] as const)));
  const students = await Promise.all(schoolClass.students.map(async (student) => ({ ...student, gradedSubjectIds: [...subjectMap.keys()].filter((id) => byKey.has(`${student.id}:${id}`) || quizByKey.has(`${student.id}:${id}`)), marks: Object.fromEntries(await Promise.all([...subjectMap.keys()].map(async (id) => {
    const record = byKey.get(`${student.id}:${id}`);
    const quiz = quizByKey.get(`${student.id}:${id}`);
    let extra: Record<string, unknown> = {};
    try { extra = record ? JSON.parse(record.extraMarks) as Record<string, unknown> : {}; } catch { extra = {}; }
    const subject = subjectMap.get(id)!;
    const limits = quizLimitsBySubject.get(id)!;
    const mark = injectQuizAverage({ ...emptyMarkValues(), ...(record ?? {}), ...extra, totalMarks: record?.totalMarks ?? 0 }, subject.columns, limits, quiz?.firstQuiz ?? 0, quiz?.secondQuiz ?? 0);
    return [id, mark];
  }))), absentFinalExams: Object.fromEntries(subjectMap.keys().map((id) => {
    const record = byKey.get(`${student.id}:${id}`);
    let extra: Record<string, unknown> = {};
    try { extra = record ? JSON.parse(record.extraMarks) as Record<string, unknown> : {}; } catch { extra = {}; }
    return [id, extra.__finalExamAbsent === true];
  })), lastEdited: Object.fromEntries(subjectMap.keys().map((id) => {
    const record = byKey.get(`${student.id}:${id}`);
    const quiz = quizByKey.get(`${student.id}:${id}`);
    return [id, { marks: record ? { name: record.updatedBy?.name ?? null, at: record.updatedAt } : null, quizzes: quiz ? { name: quiz.updatedBy?.name ?? null, at: quiz.updatedAt } : null }];
  })) })));
  const subjects = [...subjectMap.values()];
  return NextResponse.json({
    className: schoolClass.name,
    academicYear,
    semester,
    subjects,
    students,
    curriculumFallback,
    curriculumWarning: subjects.length === 0
      ? 'No subjects are configured for this class. Assign subjects to its grade or class to build the marks report.'
      : null,
  });
}
