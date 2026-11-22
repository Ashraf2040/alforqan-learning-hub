import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasAnyAdminFeature } from '@/lib/custom-admin';
import { isSemester } from '@/lib/academic-periods';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['ADMIN', 'CUSTOM_ADMIN'].includes(session.user.role) || !(await hasAnyAdminFeature(session.user, ['studentMarks', 'quizMarks', 'studentReports', 'planner', 'teacherProgress']))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  const academicYear = request.nextUrl.searchParams.get('academicYear')?.trim() ?? '';
  const semester = request.nextUrl.searchParams.get('semester') ?? '';
  const date = request.nextUrl.searchParams.get('date') ?? '';
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: 'Choose a valid date.' }, { status: 400 });
    const start = new Date(`${date}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== date) return NextResponse.json({ error: 'Choose a valid date.' }, { status: 400 });
    const end = new Date(`${date}T23:59:59.999Z`);
    const schedules = await prisma.schedule.findMany({ where: { isActive: true }, include: { class: { select: { id: true, name: true, teachers: { select: { id: true, name: true, username: true } }, classTeacherAssignments: { include: { teacher: { select: { id: true, name: true, username: true } } } } } }, items: { where: { dayIndex: start.getUTCDay() }, include: { subject: { include: { teachers: { select: { id: true, name: true, username: true } }, teacherSubjectAssignments: { include: { teacher: { select: { id: true, name: true, username: true } } } } } }, teacher: { select: { id: true, name: true, username: true } } } } } });
    const lessons = await prisma.lesson.findMany({ where: { date: { gte: start, lte: end } }, select: {
      teacherId: true, classId: true, subjectId: true, createdAt: true,
      teacher: { select: { name: true, username: true } },
      class: { select: { name: true } }, subject: { select: { name: true } },
    } });
    const dailyMap = new Map<string, { id: string; teacherId: string; teacherName: string; username: string; classId: string; className: string; subjectId: string; subjectName: string; expectedStudents: number; dailyProgress: { submitted: boolean; lastEditedAt: Date | null } }>();
    for (const schedule of schedules) for (const item of schedule.items) {
      const classTeachers = [...new Map([...schedule.class.teachers, ...schedule.class.classTeacherAssignments.map(({ teacher }) => teacher)].map((teacher) => [teacher.id, teacher])).values()];
      const subjectTeachers = [...new Map([...item.subject.teachers, ...item.subject.teacherSubjectAssignments.map(({ teacher }) => teacher)].map((teacher) => [teacher.id, teacher])).values()];
      const candidates = item.teacher ? [item.teacher] : subjectTeachers.filter((teacher) => classTeachers.length === 0 || classTeachers.some((assigned) => assigned.id === teacher.id));
      for (const teacher of candidates) {
        const key = `${teacher.id}:${schedule.class.id}:${item.subjectId}`;
        const lesson = lessons.filter((entry) => entry.teacherId === teacher.id && entry.classId === schedule.class.id && entry.subjectId === item.subjectId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
        dailyMap.set(key, { id: key, teacherId: teacher.id, teacherName: teacher.name, username: teacher.username, classId: schedule.class.id, className: schedule.class.name, subjectId: item.subjectId, subjectName: item.subject.name, expectedStudents: 0, dailyProgress: { submitted: Boolean(lesson), lastEditedAt: lesson?.createdAt ?? null } });
      }
    }
    // A saved daily plan is still meaningful even when the class has no active
    // schedule for that weekday, or the schedule's teacher assignment changed.
    // Include every actual database lesson for the selected date in the report.
    for (const lesson of lessons) {
      const key = `${lesson.teacherId}:${lesson.classId}:${lesson.subjectId}`;
      if (!dailyMap.has(key)) dailyMap.set(key, {
        id: key,
        teacherId: lesson.teacherId,
        teacherName: lesson.teacher.name,
        username: lesson.teacher.username,
        classId: lesson.classId,
        className: lesson.class.name,
        subjectId: lesson.subjectId,
        subjectName: lesson.subject.name,
        expectedStudents: 0,
        dailyProgress: { submitted: true, lastEditedAt: lesson.createdAt },
      });
    }
    return NextResponse.json({ rows: [...dailyMap.values()], date });
  }
  if (!academicYear || !isSemester(semester)) return NextResponse.json({ error: 'Choose an academic year and semester.' }, { status: 400 });

  const teachers = await prisma.user.findMany({
    where: { role: 'TEACHER' }, orderBy: { name: 'asc' },
    include: {
      classes: { select: { id: true, name: true, students: { select: { id: true } }, classSubjects: { select: { subjectId: true, subject: { select: { id: true, name: true } } } } } },
      classTeacherAssignments: { include: { class: { select: { id: true, name: true, students: { select: { id: true } }, classSubjects: { select: { subjectId: true, subject: { select: { id: true, name: true } } } } } } } },
      subjects: { select: { id: true, name: true } },
      subjectTeacherAssignments: { include: { subject: { select: { id: true, name: true } } } },
    },
  });
  const [marks, quizzes, reports] = await Promise.all([
    prisma.managedStudentMark.findMany({ where: { academicYear, term: semester }, select: { classId: true, subjectId: true, studentId: true, updatedAt: true, updatedBy: { select: { name: true } } } }),
    prisma.managedQuizMark.findMany({ where: { academicYear, term: semester }, select: { classId: true, subjectId: true, studentId: true, updatedAt: true, updatedBy: { select: { name: true } } } }),
    prisma.studentReport.findMany({ where: { academicYear, semester }, select: { teacherId: true, subjectId: true, student: { select: { classId: true } }, reportType: true, status: true, updatedAt: true } }),
  ]);

  const pairKey = (classId: string, subjectId: string) => `${classId}:${subjectId}`;
  const rows = teachers.flatMap((teacher) => {
    const assignedClasses = [...new Map([...teacher.classes, ...teacher.classTeacherAssignments.map(({ class: item }) => item)].map((item) => [item.id, item])).values()];
    const assignedSubjects = new Map([...teacher.subjects, ...teacher.subjectTeacherAssignments.map(({ subject }) => subject)].map((item) => [item.id, item]));
    return assignedClasses.flatMap((schoolClass) => {
      const classSubjects = schoolClass.classSubjects.length ? schoolClass.classSubjects.map(({ subjectId, subject }) => ({ subjectId, subject })) : [...assignedSubjects.values()].map((subject) => ({ subjectId: subject.id, subject }));
      return classSubjects.filter(({ subjectId }) => assignedSubjects.has(subjectId)).map(({ subjectId, subject }) => {
        const key = pairKey(schoolClass.id, subjectId);
        const markRows = marks.filter((item) => item.classId === schoolClass.id && item.subjectId === subjectId);
        const quizRows = quizzes.filter((item) => item.classId === schoolClass.id && item.subjectId === subjectId);
        const reportRows = reports.filter((item) => item.teacherId === teacher.id && item.student.classId === schoolClass.id && item.subjectId === subjectId && item.status !== 'Not Started');
        const uniqueStudents = (items: { studentId: string }[]) => new Set(items.map((item) => item.studentId)).size;
        const latest = (items: { updatedAt: Date; updatedBy?: { name: string } | null }[]) => items.reduce<{ at: Date; by: string | null } | null>((best, item) => !best || item.updatedAt > best.at ? { at: item.updatedAt, by: item.updatedBy?.name ?? null } : best, null);
        const latestMarks = latest(markRows);
        const latestQuizzes = latest(quizRows);
        const latestReports = latest(reportRows);
        return {
          id: `${teacher.id}:${key}`, teacherId: teacher.id, teacherName: teacher.name, username: teacher.username,
          classId: schoolClass.id, className: schoolClass.name, subjectId, subjectName: subject.name,
          expectedStudents: schoolClass.students.length,
          marks: { submitted: uniqueStudents(markRows), complete: schoolClass.students.length > 0 && uniqueStudents(markRows) >= schoolClass.students.length, lastEditedAt: latestMarks?.at ?? null, lastEditedBy: latestMarks?.by ?? null },
          quizzes: { submitted: uniqueStudents(quizRows), complete: schoolClass.students.length > 0 && uniqueStudents(quizRows) >= schoolClass.students.length, lastEditedAt: latestQuizzes?.at ?? null, lastEditedBy: latestQuizzes?.by ?? null },
          reports: { submitted: reportRows.length, expected: schoolClass.students.length * 2, complete: schoolClass.students.length > 0 && reportRows.length >= schoolClass.students.length * 2, lastEditedAt: latestReports?.at ?? null },
        };
      });
    });
  });
  return NextResponse.json({ rows, academicYear, semester });
}
