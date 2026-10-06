import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function dayRange(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const start = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || start.toISOString().slice(0, 10) !== value) return null;
  return { start, end: new Date(`${value}T23:59:59.999Z`) };
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'TEACHER') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const date = request.nextUrl.searchParams.get('date') ?? '';
  const range = dayRange(date);
  if (!range) return NextResponse.json({ error: 'Choose a valid date.' }, { status: 400 });
  const lessons = await prisma.lesson.findMany({
    where: { teacherId: session.user.id, date: { gte: range.start, lte: range.end } },
    orderBy: [{ date: 'asc' }, { createdAt: 'asc' }],
    include: { class: { select: { id: true, name: true } }, subject: { select: { id: true, name: true } } },
  });
  return NextResponse.json(lessons);
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'TEACHER') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const { subjectId, date, unit, pages, lesson, objective } = body;
    const classIds: string[] = Array.from(new Set<string>((Array.isArray(body.classIds) ? body.classIds : [body.classId]).map((value: unknown) => String(value ?? '')).filter(Boolean)));
    const range = dayRange(String(date ?? ''));
    if (!classIds.length || !subjectId || !range || !String(unit ?? '').trim() || !String(pages ?? '').trim() || !String(lesson ?? '').trim() || !String(objective ?? '').trim()) {
      return NextResponse.json({ error: 'Complete the class, subject, date, unit, pages, lesson, and objective.' }, { status: 400 });
    }
    const [classAssignments, subjectAssignment] = await Promise.all([
      prisma.class.findMany({ where: { id: { in: classIds }, OR: [{ teachers: { some: { id: session.user.id } } }, { classTeacherAssignments: { some: { teacherId: session.user.id } } }] }, select: { id: true } }),
      prisma.subject.findFirst({ where: { id: subjectId, OR: [{ teachers: { some: { id: session.user.id } } }, { teacherSubjectAssignments: { some: { teacherId: session.user.id } } }] }, select: { id: true } }),
    ]);
    if (classAssignments.length !== classIds.length || !subjectAssignment) return NextResponse.json({ error: 'Choose classes and a subject assigned to your account.' }, { status: 403 });
    const exists = await prisma.lesson.findFirst({ where: { teacherId: session.user.id, classId: { in: classIds }, subjectId, date: { gte: range.start, lte: range.end } }, select: { classId: true } });
    if (exists) return NextResponse.json({ error: 'A lesson is already recorded for this class and subject on this date.' }, { status: 409 });
    const created = await prisma.$transaction(classIds.map((classId: string) => prisma.lesson.create({ data: {
      teacherId: session.user.id, classId, subjectId, date: range.start,
      unit: String(unit).trim(), pages: String(pages).trim(), lesson: String(lesson).trim(), objective: String(objective).trim(),
      homework: String(body.homework ?? '').trim() || null, comments: String(body.comments ?? '').trim() || null,
    }, include: { class: { select: { id: true, name: true } }, subject: { select: { id: true, name: true } } } })));
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    console.error('Daily lesson create failed', error);
    return NextResponse.json({ error: 'The lesson could not be saved.' }, { status: 500 });
  }
}
