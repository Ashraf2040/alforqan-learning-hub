import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['ADMIN', 'TEACHER'].includes(session.user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [user, classRows, teachers, subjects, grades] = await Promise.all([
    session.user.role === 'TEACHER' ? prisma.user.findUnique({ where: { id: session.user.id }, include: { classes: true, subjects: { orderBy: [{ reportOrder: 'asc' }, { name: 'asc' }] }, classTeacherAssignments: true, subjectTeacherAssignments: { include: { subject: true } } } }) : null,
    prisma.class.findMany({ where: session.user.role === 'TEACHER' ? { OR: [{ teachers: { some: { id: session.user.id } } }, { classTeacherAssignments: { some: { teacherId: session.user.id } } }] } : {}, orderBy: { name: 'asc' }, include: { grade: { select: { id: true, name: true, subjects: { orderBy: [{ position: 'asc' }, { subject: { name: 'asc' } }], select: { subjectId: true, position: true } } } }, students: { orderBy: { name: 'asc' }, select: { id: true, name: true } } } }),
    session.user.role === 'ADMIN' ? prisma.user.findMany({ where: { role: 'TEACHER' }, orderBy: { name: 'asc' }, include: { classes: { select: { id: true } }, subjects: { select: { id: true, name: true, reportOrder: true } }, classTeacherAssignments: { select: { classId: true } }, subjectTeacherAssignments: { include: { subject: { select: { id: true, name: true, reportOrder: true } } } } } }) : [],
    session.user.role === 'TEACHER' ? prisma.subject.findMany({ where: { OR: [{ teachers: { some: { id: session.user.id } } }, { teacherSubjectAssignments: { some: { teacherId: session.user.id } } }] }, orderBy: [{ reportOrder: 'asc' }, { name: 'asc' }], select: { id: true, name: true, reportOrder: true } }) : prisma.subject.findMany({ orderBy: [{ reportOrder: 'asc' }, { name: 'asc' }], select: { id: true, name: true, reportOrder: true } }),
    prisma.grade.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, subjects: { orderBy: [{ position: 'asc' }, { subject: { name: 'asc' } }], select: { subjectId: true, position: true } } } }),
  ]);
  // Match the grade manager's legacy-class inference so older classes such as
  // "5A" still receive their grade-specific subject order in reports.
  const classes = classRows.map((schoolClass) => {
    const leadingGradeNumber = schoolClass.name.match(/^\s*(\d+)/)?.[1];
    const effectiveGrade = grades.find((grade) => grade.id === schoolClass.grade?.id)
      ?? (leadingGradeNumber ? grades.find((grade) => grade.name.match(/\d+/)?.[0] === leadingGradeNumber) : undefined);
    return { ...schoolClass, grade: effectiveGrade ? { id: effectiveGrade.id, name: effectiveGrade.name, subjects: effectiveGrade.subjects } : null };
  });
  const allowedClasses = user ? new Set([...user.classes.map((item) => item.id), ...user.classTeacherAssignments.map((item) => item.classId)]) : undefined;
  const normalizedTeachers = teachers.map((teacher) => ({ ...teacher, classes: [...new Map([...teacher.classes, ...teacher.classTeacherAssignments.map((assignment) => ({ id: assignment.classId }))].map((item) => [item.id, item])).values()], subjects: [...new Map([...teacher.subjects, ...teacher.subjectTeacherAssignments.map((assignment) => assignment.subject)].map((item) => [item.id, item])).values()] }));
  return NextResponse.json({ classes: classes.filter((item) => !allowedClasses || allowedClasses.has(item.id)), teachers: normalizedTeachers, subjects });
}
