import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Context) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'TEACHER') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const existing = await prisma.lesson.findFirst({ where: { id, teacherId: session.user.id }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: 'Lesson not found.' }, { status: 404 });
  const fullLesson = await prisma.lesson.findUnique({ where: { id: existing.id }, select: { date: true } });
  if (!fullLesson || fullLesson.date.toISOString().slice(0, 10) !== new Date().toISOString().slice(0, 10)) return NextResponse.json({ error: 'Only lessons recorded today can be edited.' }, { status: 403 });
  try {
    const body = await request.json();
    const required = ['unit', 'pages', 'lesson', 'objective'] as const;
    if (required.some((key) => !String(body[key] ?? '').trim())) return NextResponse.json({ error: 'Complete the unit, pages, lesson, and objective.' }, { status: 400 });
    const updated = await prisma.lesson.update({ where: { id: existing.id }, data: {
      unit: String(body.unit).trim(), pages: String(body.pages).trim(), lesson: String(body.lesson).trim(), objective: String(body.objective).trim(),
      homework: String(body.homework ?? '').trim() || null, comments: String(body.comments ?? '').trim() || null,
    }, include: { class: { select: { id: true, name: true } }, subject: { select: { id: true, name: true } } } });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Daily lesson update failed', error);
    return NextResponse.json({ error: 'The lesson could not be updated.' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const { id } = await params;
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'TEACHER') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const existing = await prisma.lesson.findFirst({ where: { id, teacherId: session.user.id }, select: { date: true } });
  if (!existing) return NextResponse.json({ error: 'Lesson not found.' }, { status: 404 });
  if (existing.date.toISOString().slice(0, 10) !== new Date().toISOString().slice(0, 10)) return NextResponse.json({ error: 'Only lessons recorded today can be deleted.' }, { status: 403 });
  const result = await prisma.lesson.deleteMany({ where: { id, teacherId: session.user.id } });
  if (!result.count) return NextResponse.json({ error: 'Lesson not found.' }, { status: 404 });
  return NextResponse.json({ success: true });
}
