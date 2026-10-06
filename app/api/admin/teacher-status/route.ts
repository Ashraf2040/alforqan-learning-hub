import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const gradeId = request.nextUrl.searchParams.get('gradeId');
  const week = request.nextUrl.searchParams.get('week');
  const date = request.nextUrl.searchParams.get('date');
  if (!gradeId || (!week && !date) || (week && date)) {
    return NextResponse.json({ error: 'Choose a grade and either a week number or a date.' }, { status: 400 });
  }
  if (!(await prisma.grade.findUnique({ where: { id: gradeId }, select: { id: true } }))) {
    return NextResponse.json({ error: 'Choose an existing grade.' }, { status: 404 });
  }

  const selectedDate = date ? new Date(`${date}T12:00:00.000Z`) : null;
  if (selectedDate && Number.isNaN(selectedDate.getTime())) {
    return NextResponse.json({ error: 'Choose a valid date.' }, { status: 400 });
  }
  const candidates = await prisma.user.findMany({
    where: {
      role: 'TEACHER',
      classes: { some: { gradeId } },
      subjects: { some: { grades: { some: { gradeId } } } },
    },
    select: {
      id: true, username: true, name: true,
      classes: { where: { gradeId }, orderBy: { name: 'asc' }, select: { id: true, name: true } },
      subjects: { where: { grades: { some: { gradeId } } }, orderBy: { name: 'asc' }, select: { id: true, name: true } },
      weeklyPlannerSubmissions: {
        where: {
          ...(week ? { week: week.trim() } : {}),
          ...(selectedDate ? { fromDate: { lte: selectedDate }, toDate: { gte: selectedDate } } : {}),
          classes: { some: { gradeId } },
        },
        orderBy: { createdAt: 'desc' }, take: 1, select: { createdAt: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  // One representative teacher per grade subject. Prefer a teacher who has
  // already submitted for this period; otherwise keep the first alphabetically.
  const representativeBySubject = new Map<string, (typeof candidates)[number]>();
  for (const teacher of candidates) {
    for (const subject of teacher.subjects) {
      const current = representativeBySubject.get(subject.id);
      if (!current || (!current.weeklyPlannerSubmissions.length && teacher.weeklyPlannerSubmissions.length)) {
        representativeBySubject.set(subject.id, teacher);
      }
    }
  }

  const selectedTeachers = new Map<string, { teacher: (typeof candidates)[number]; subjects: Map<string, string> }>();
  for (const [subjectId, teacher] of representativeBySubject) {
    const selected = selectedTeachers.get(teacher.id) ?? { teacher, subjects: new Map<string, string>() };
    const subject = teacher.subjects.find((item) => item.id === subjectId);
    if (subject) selected.subjects.set(subject.id, subject.name);
    selectedTeachers.set(teacher.id, selected);
  }

  const rows = [...selectedTeachers.values()].map(({ teacher, subjects }) => ({
    id: teacher.id,
    username: teacher.username,
    name: teacher.name,
    classes: teacher.classes,
    subjects: [...subjects].map(([id, name]) => ({ id, name })),
    submitted: teacher.weeklyPlannerSubmissions.length > 0,
    submittedAt: teacher.weeklyPlannerSubmissions[0]?.createdAt ?? null,
  })).sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json(rows);
}
