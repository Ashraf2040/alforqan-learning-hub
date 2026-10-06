import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const classId = request.nextUrl.searchParams.get('classId');
  const date = request.nextUrl.searchParams.get('date');
  const mode = request.nextUrl.searchParams.get('mode');
  if (!classId || !date) {
    if (mode === 'all' && date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      const start = new Date(`${date}T00:00:00.000Z`);
      if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== date) return NextResponse.json({ error: 'Choose a valid date.' }, { status: 400 });
      const end = new Date(`${date}T23:59:59.999Z`);
      const dayIndex = start.getUTCDay();
      const schedules = await prisma.schedule.findMany({
        where: { isActive: true },
        include: {
          class: { select: { id: true, name: true, teachers: { where: { role: 'TEACHER' }, select: { id: true, name: true, username: true } }, classTeacherAssignments: { include: { teacher: { select: { id: true, name: true, username: true } } } } } },
          items: {
            where: { dayIndex },
            include: {
              subject: {
                include: {
                  teachers: { select: { id: true, name: true, username: true } },
                  teacherSubjectAssignments: { include: { teacher: { select: { id: true, name: true, username: true } } } },
                },
              },
              teacher: { select: { id: true, name: true, username: true } },
            },
          },
        },
      });
      const lessons = await prisma.lesson.findMany({ where: { date: { gte: start, lte: end } }, include: { class: { select: { id: true, name: true } }, subject: { select: { id: true, name: true } }, teacher: { select: { id: true, name: true, username: true } } } });
      const grouped = new Map<string, { id: string; name: string; username: string; classes: Map<string, { classId: string; className: string; subjects: Map<string, { name: string; submitted: boolean }> }> }>();
      for (const schedule of schedules) for (const item of schedule.items) {
        const classTeachers = [...new Map([...schedule.class.teachers, ...schedule.class.classTeacherAssignments.map((assignment) => assignment.teacher)].map((teacher) => [teacher.id, teacher])).values()];
        const candidates = item.teacher ? [item.teacher] : [...new Map([...item.subject.teachers, ...item.subject.teacherSubjectAssignments.map((a) => a.teacher)]
          .filter((teacher) => classTeachers.length === 0 || classTeachers.some((assigned) => assigned.id === teacher.id))
          .map((teacher) => [teacher.id, teacher])).values()];
        for (const teacher of candidates) {
          const key = `${teacher.id}:${schedule.class.id}`;
          const group = grouped.get(key) ?? { id: teacher.id, name: teacher.name, username: teacher.username, classes: new Map() };
          const schoolClass = group.classes.get(schedule.class.id) ?? { classId: schedule.class.id, className: schedule.class.name, subjects: new Map() };
          const submitted = lessons.some((lesson) => lesson.classId === schedule.class.id && lesson.teacherId === teacher.id && lesson.subjectId === item.subjectId);
          schoolClass.subjects.set(item.subjectId, { name: item.subject.name, submitted: schoolClass.subjects.get(item.subjectId)?.submitted || submitted });
          group.classes.set(schedule.class.id, schoolClass); grouped.set(key, group);
        }
      }
      const allTeachers = [...grouped.values()].map((teacher) => ({ ...teacher, classes: [...teacher.classes.values()].map((item) => ({ ...item, subjects: [...item.subjects.values()], expected: item.subjects.size, submitted: [...item.subjects.values()].filter((subject) => subject.submitted).length })) })).sort((a, b) => a.name.localeCompare(b.name));
      return NextResponse.json({ allTeachers, lessons });
    }
    const classes = await prisma.class.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } });
    return NextResponse.json({ classes });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Choose a valid date.' }, { status: 400 });
  const start = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== date) return NextResponse.json({ error: 'Choose a valid date.' }, { status: 400 });
  const end = new Date(`${date}T23:59:59.999Z`);
  const daySchedule = await prisma.schedule.findFirst({ where: { classId, isActive: true }, include: { items: { where: { dayIndex: start.getUTCDay() }, select: { subjectId: true } } }, orderBy: { createdAt: 'desc' } });
  const schoolClass = await prisma.class.findUnique({
    where: { id: classId },
    include: {
      teachers: { where: { role: 'TEACHER' }, orderBy: { name: 'asc' }, select: { id: true, name: true, username: true, subjects: { orderBy: { name: 'asc' }, select: { id: true, name: true } } } },
      classTeacherAssignments: { include: { teacher: { select: { id: true, name: true, username: true, subjects: { orderBy: { name: 'asc' }, select: { id: true, name: true } } } } } },
      classSubjects: { include: { subject: { select: { id: true, name: true } } } },
      grade: { include: { subjects: { include: { subject: { select: { id: true, name: true } } } } } },
    },
  });
  if (!schoolClass) return NextResponse.json({ error: 'Class not found.' }, { status: 404 });
  const assignments = new Map<string, { id: string; name: string; username: string; subjects: { id: string; name: string }[] }>();
  for (const teacher of schoolClass.teachers) assignments.set(teacher.id, teacher);
  for (const assignment of schoolClass.classTeacherAssignments) assignments.set(assignment.teacher.id, assignment.teacher);
  const lessons = await prisma.lesson.findMany({
    where: { classId, date: { gte: start, lte: end } },
    orderBy: [{ teacher: { name: 'asc' } }, { subject: { name: 'asc' } }],
    include: { teacher: { select: { id: true, name: true, username: true } }, subject: { select: { id: true, name: true } } },
  });
  const classSubjectIds = new Set(schoolClass.classSubjects.map((item) => item.subject.id));
  const gradeSubjects = schoolClass.grade?.subjects.map((item) => item.subject) ?? [];
  const scheduledIds = new Set(daySchedule?.items.map((item) => item.subjectId) ?? []);
  const assignedClassSubjects = classSubjectIds.size ? schoolClass.classSubjects.map((item) => item.subject) : gradeSubjects;
  const expectedSubjects = scheduledIds.size ? assignedClassSubjects.filter((subject) => scheduledIds.has(subject.id)) : assignedClassSubjects;
  const teachers = [...assignments.values()].map((teacher) => {
    const baseSubjects = expectedSubjects.length ? expectedSubjects : teacher.subjects;
    const assignedIds = new Set(teacher.subjects.map((subject) => subject.id));
    const subjects = baseSubjects.filter((subject) => assignedIds.has(subject.id));
    const submittedSubjectIds = new Set(lessons.filter((item) => item.teacherId === teacher.id).map((item) => item.subjectId));
    return { ...teacher, expected: subjects.length, submitted: subjects.filter((subject) => submittedSubjectIds.has(subject.id)).length,
      missingSubjects: subjects.filter((subject) => !submittedSubjectIds.has(subject.id)).map((subject) => subject.name) };
  });
  return NextResponse.json({ classes: [{ id: schoolClass.id, name: schoolClass.name }], teachers, lessons });
}
