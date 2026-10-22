import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMarkSubmissionPolicy } from '@/lib/mark-submission-policy';

const KEY = 'teacherMarkSubmissionPolicy';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['ADMIN', 'TEACHER'].includes(session.user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const policy = await getMarkSubmissionPolicy();
  const deadlinePassed = Boolean(policy.deadlineAt && Date.now() > Date.parse(policy.deadlineAt));
  if (session.user.role === 'TEACHER') {
    const canEdit = !deadlinePassed || policy.reopenAll || policy.reopenedTeacherIds.includes(session.user.id);
    return NextResponse.json({ policy: { deadlineAt: policy.deadlineAt }, canEdit });
  }
  const teachers = await prisma.user.findMany({ where: { role: 'TEACHER' }, orderBy: { name: 'asc' }, select: { id: true, name: true } });
  return NextResponse.json({ policy, teachers });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json() as { deadlineAt?: unknown; reopenAll?: unknown; reopenedTeacherIds?: unknown };
    const deadlineAt = body.deadlineAt === null || body.deadlineAt === '' ? null : typeof body.deadlineAt === 'string' && Number.isFinite(Date.parse(body.deadlineAt)) ? new Date(body.deadlineAt).toISOString() : undefined;
    if (deadlineAt === undefined || typeof body.reopenAll !== 'boolean' || !Array.isArray(body.reopenedTeacherIds) || body.reopenedTeacherIds.some((id) => typeof id !== 'string')) {
      return NextResponse.json({ error: 'Provide a valid deadline, reopen setting, and teacher list.' }, { status: 400 });
    }
    const reopenedTeacherIds = [...new Set(body.reopenedTeacherIds as string[])];
    const validTeachers = await prisma.user.count({ where: { id: { in: reopenedTeacherIds }, role: 'TEACHER' } });
    if (validTeachers !== reopenedTeacherIds.length) return NextResponse.json({ error: 'One or more selected teachers are invalid.' }, { status: 400 });
    const policy = { deadlineAt, reopenAll: body.reopenAll, reopenedTeacherIds };
    await prisma.appSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: JSON.stringify(policy) }, update: { value: JSON.stringify(policy) } });
    return NextResponse.json({ ok: true, policy });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Could not save mark submission settings.' }, { status: 400 });
  }
}
