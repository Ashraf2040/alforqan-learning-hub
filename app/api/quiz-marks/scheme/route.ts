import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const subjectId = request.nextUrl.searchParams.get('subjectId');
  if (subjectId) {
    const scheme = await prisma.managedQuizScheme.findUnique({ where: { subjectId }, select: { firstMax: true, secondMax: true } });
    return NextResponse.json({ scheme });
  }
  const [subjects, schemes, teachers] = await Promise.all([
    prisma.subject.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.managedQuizScheme.findMany({ select: { subjectId: true, firstMax: true, secondMax: true } }),
    prisma.user.findMany({ where: { role: 'TEACHER' }, orderBy: { name: 'asc' }, include: { classes: { select: { id: true, name: true } }, classTeacherAssignments: { include: { class: { select: { id: true, name: true } } } }, subjects: { select: { id: true, name: true } }, subjectTeacherAssignments: { include: { subject: { select: { id: true, name: true } } } } } }),
  ]);
  return NextResponse.json({ subjects, schemes, teachers: teachers.map((teacher) => ({ id: teacher.id, name: teacher.name, classes: [...new Map([...teacher.classes, ...teacher.classTeacherAssignments.map(({ class: item }) => item)].map((item) => [item.id, item])).values()], subjects: [...new Map([...teacher.subjects, ...teacher.subjectTeacherAssignments.map(({ subject }) => subject)].map((item) => [item.id, item])).values()] })) });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const subjectId = String(body.subjectId ?? ''), firstMax = body.firstMax, secondMax = body.secondMax;
    if (!subjectId || !Number.isInteger(firstMax) || !Number.isInteger(secondMax) || firstMax < 1 || secondMax < 1 || firstMax > 10000 || secondMax > 10000) return NextResponse.json({ error: 'Enter a subject and valid maximum marks for both quizzes.' }, { status: 400 });
    const saved = await prisma.managedQuizScheme.upsert({ where: { subjectId }, create: { subjectId, firstMax, secondMax }, update: { firstMax, secondMax } });
    return NextResponse.json({ scheme: saved });
  } catch { return NextResponse.json({ error: 'Could not save quiz limits.' }, { status: 500 }); }
}
