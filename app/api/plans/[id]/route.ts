import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Context = { params: Promise<{ id: string }> };

async function authorizedPlan(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'TEACHER') return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  const plan = await prisma.weeklyPlannerSubmission.findFirst({ where: { id, teacherId: session.user.id } });
  if (!plan) return { response: NextResponse.json({ error: 'Plan not found.' }, { status: 404 }) };
  return { session, plan };
}

export async function PATCH(request: NextRequest, { params }: Context) {
  const { id } = await params;
  const access = await authorizedPlan(id);
  if ('response' in access) return access.response;
  try {
    const body = await request.json();
    const classIds = Array.isArray(body.classIds) ? [...new Set((body.classIds as unknown[]).filter((value): value is string => typeof value === 'string'))] : [];
    const rows = Array.isArray(body.items) ? body.items : [];
    if (!classIds.length || !String(body.week ?? '').trim() || !body.fromDate || !body.toDate || !rows.length) return NextResponse.json({ error: 'Complete the week, dates, classes and at least one subject row.' }, { status: 400 });
    const fromDate = new Date(String(body.fromDate) + 'T00:00:00.000Z');
    const toDate = new Date(String(body.toDate) + 'T23:59:59.999Z');
    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime()) || fromDate > toDate) return NextResponse.json({ error: 'Choose a valid date range.' }, { status: 400 });
    const user = await prisma.user.findUnique({ where: { id: access.session.user.id }, include: { classes: true, subjects: true } });
    if (!user || classIds.some((classId) => !user.classes.some((item) => item.id === classId))) return NextResponse.json({ error: 'Choose only classes assigned to your account.' }, { status: 403 });
    const items = rows.filter((item: { subjectId?: string }) => user.subjects.some((subject) => subject.id === item.subjectId)).map((item: { subjectId: string; classwork?: string; homework?: string }) => ({ subjectId: item.subjectId, classwork: String(item.classwork ?? '').trim(), homework: String(item.homework ?? '').trim() }));
    if (!items.length) return NextResponse.json({ error: 'Add a subject assigned to your account.' }, { status: 400 });
    await prisma.weeklyPlannerSubmission.update({ where: { id }, data: {
      week: String(body.week).trim(), semester: String(body.semester ?? '').trim() || null, fromDate, toDate,
      dictation: String(body.dictation ?? '').trim() || null, notes: String(body.notes ?? '').trim() || null,
      classes: { set: classIds.map((classId) => ({ id: classId })) },
      items: { deleteMany: {}, create: items },
    } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Weekly plan update failed', error);
    return NextResponse.json({ error: 'The plan could not be updated. Please try again.' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  const { id } = await params;
  const access = await authorizedPlan(id);
  if ('response' in access) return access.response;
  await prisma.weeklyPlannerSubmission.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
