import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'TEACHER') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const searchParams = request.nextUrl.searchParams;
  const week = searchParams.get('week')?.trim();
  const date = searchParams.get('date');
  if ((!week && !date) || (week && date)) return NextResponse.json({ error: 'Choose either a week or a date to view previous plans.' }, { status: 400 });
  const selectedDate = date ? new Date(date + 'T12:00:00.000Z') : null;
  if (selectedDate && Number.isNaN(selectedDate.getTime())) return NextResponse.json({ error: 'Choose a valid date.' }, { status: 400 });
  const plans = await prisma.weeklyPlannerSubmission.findMany({
    where: { teacherId: session.user.id, ...(week ? { week } : {}), ...(selectedDate ? { fromDate: { lte: selectedDate }, toDate: { gte: selectedDate } } : {}) },
    orderBy: [{ fromDate: 'desc' }, { updatedAt: 'desc' }],
    include: { classes: { select: { id: true, name: true } }, items: { include: { subject: { select: { id: true, name: true } } } } },
  });
  return NextResponse.json({ plans });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'TEACHER') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const classIds = Array.isArray(body.classIds) ? [...new Set((body.classIds as unknown[]).filter((id): id is string => typeof id === 'string'))] : [];
    const items = Array.isArray(body.items) ? body.items : [];
    if (!classIds.length || !body.week?.trim() || !body.fromDate || !body.toDate || !items.length) return NextResponse.json({ error: 'Complete the week, dates, classes and at least one subject row.' }, { status: 400 });
    const fromDate = new Date(`${body.fromDate}T00:00:00.000Z`);
    const toDate = new Date(`${body.toDate}T23:59:59.999Z`);
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) return NextResponse.json({ error: 'Choose a valid date range.' }, { status: 400 });
    const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { classes: true, subjects: true } });
    if (!user || classIds.some((id: string) => !user.classes.some((c) => c.id === id))) return NextResponse.json({ error: 'Choose only classes assigned to your account.' }, { status: 403 });
    const safeItems = items.filter((item: { subjectId?: string }) => user.subjects.some((s) => s.id === item.subjectId)).map((item: { subjectId: string; classwork?: string; homework?: string }) => ({ subjectId: item.subjectId, classwork: String(item.classwork ?? '').trim(), homework: String(item.homework ?? '').trim() }));
    if (!safeItems.length) return NextResponse.json({ error: 'Add a subject assigned to your account.' }, { status: 400 });
    const plan = await prisma.weeklyPlannerSubmission.create({ data: {
      teacherId: user.id, week: String(body.week).trim(), semester: String(body.semester ?? '').trim() || null, fromDate, toDate,
      dictation: String(body.dictation ?? '').trim() || null, notes: String(body.notes ?? '').trim() || null,
      classes: { connect: classIds.map((id: string) => ({ id })) },
      items: { create: safeItems },
    } });
    return NextResponse.json({ id: plan.id }, { status: 201 });
  } catch (error) {
    console.error('Weekly plan create failed', error);
    return NextResponse.json({ error: 'The plan could not be saved. Please try again.' }, { status: 500 });
  }
}
