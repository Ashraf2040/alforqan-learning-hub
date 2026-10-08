import { prisma } from '@/lib/prisma';

export async function resolveQuizAccess(role: string, sessionUserId: string, teacherId: string, classId: string, subjectId: string) {
  const teacher = await prisma.user.findFirst({
    where: { id: teacherId, role: 'TEACHER' },
    include: { classes: { select: { id: true } }, classTeacherAssignments: { select: { classId: true } }, subjects: { select: { id: true } }, subjectTeacherAssignments: { select: { subjectId: true } } },
  });
  if (!teacher || (role !== 'ADMIN' && teacher.id !== sessionUserId)) return null;
  const hasClass = teacher.classes.some(({ id }) => id === classId) || teacher.classTeacherAssignments.some(({ classId: assignedClass }) => assignedClass === classId);
  const hasSubject = teacher.subjects.some(({ id }) => id === subjectId) || teacher.subjectTeacherAssignments.some(({ subjectId: assignedSubject }) => assignedSubject === subjectId);
  if (!hasClass || !hasSubject) return null;
  const [schoolClass, subject] = await Promise.all([
    prisma.class.findUnique({ where: { id: classId }, select: { id: true, name: true, students: { orderBy: { name: 'asc' }, select: { id: true, name: true } } } }),
    prisma.subject.findUnique({ where: { id: subjectId }, select: { id: true, name: true } }),
  ]);
  return schoolClass && subject ? { teacher, schoolClass, subject } : null;
}

export async function teacherQuizSectionEnabled() {
  const setting = await prisma.appSetting.findUnique({ where: { key: 'teacherSections' }, select: { value: true } });
  if (!setting) return true;
  try { return (JSON.parse(setting.value) as Record<string, unknown>).quizMarks !== false; } catch { return true; }
}
