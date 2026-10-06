import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [classes, subjects, teachers, schedules] = await Promise.all([
    prisma.class.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.subject.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.user.findMany({ where: { role: 'TEACHER' }, orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.schedule.findMany({ where: { isActive: true }, include: { items: { select: { dayIndex: true, subjectId: true, teacherId: true, session: true, start: true, end: true } } } }),
  ]);
  return NextResponse.json({ classes, subjects, teachers, schedules });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const classId = String(body.classId ?? '');
    const entries = Array.isArray(body.entries) ? body.entries as { dayIndex: number; subjectId: string; teacherId?: string; session?: number; start?: string; end?: string }[] : [];
    if (!classId || entries.some((item) => !Number.isInteger(item.dayIndex) || item.dayIndex < 0 || item.dayIndex > 6 || !item.subjectId)) return NextResponse.json({ error: 'Choose a class and valid schedule entries.' }, { status: 400 });
    const [schoolClass, subjects, teachers] = await Promise.all([
      prisma.class.findUnique({ where: { id: classId }, select: { id: true } }),
      prisma.subject.findMany({ where: { id: { in: [...new Set(entries.map((item) => item.subjectId))] } }, select: { id: true } }),
      prisma.user.findMany({ where: { id: { in: [...new Set(entries.map((item) => item.teacherId).filter((id): id is string => Boolean(id)))] }, role: 'TEACHER' }, select: { id: true } }),
    ]);
    if (!schoolClass || subjects.length !== new Set(entries.map((item) => item.subjectId)).size || teachers.length !== new Set(entries.map((item) => item.teacherId).filter(Boolean)).size) return NextResponse.json({ error: 'One or more selected schedule options are invalid.' }, { status: 400 });
    const schedule = await prisma.$transaction(async (tx) => {
      await tx.schedule.updateMany({ where: { classId, isActive: true }, data: { isActive: false } });
      return tx.schedule.create({ data: {
        classId, createdBy: session.user.id, isActive: true,
        items: { create: entries.map((item) => ({ dayIndex: item.dayIndex, subjectId: item.subjectId, teacherId: item.teacherId || null, session: Number.isInteger(item.session) ? item.session! : 0, start: String(item.start ?? ''), end: String(item.end ?? '') })) },
      }, include: { items: true } });
    });
    return NextResponse.json({ schedule }, { status: 201 });
  } catch (error) {
    console.error('Schedule save failed', error);
    return NextResponse.json({ error: 'The schedule could not be saved.' }, { status: 500 });
  }
}
