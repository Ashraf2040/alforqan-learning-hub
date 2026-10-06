import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function adminOnly() {
  const session = await getServerSession(authOptions);
  return session?.user?.role === 'ADMIN';
}

export async function GET() {
  if (!await adminOnly()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const grades = await prisma.grade.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, subjects: { orderBy: [{ position: 'asc' }, { subject: { name: 'asc' } }], select: { position: true, subject: { select: { id: true, name: true } } } } },
  });
  return NextResponse.json({ grades: grades.map((grade) => ({ ...grade, subjects: grade.subjects.map(({ position, subject }) => ({ ...subject, position })) })) });
}

export async function PUT(request: NextRequest) {
  if (!await adminOnly()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    if (typeof body.gradeId !== 'string' || !Array.isArray(body.subjectIds) || body.subjectIds.some((id: unknown) => typeof id !== 'string')) return NextResponse.json({ error: 'Choose a grade and provide its ordered subject list.' }, { status: 400 });
    const subjectIds = body.subjectIds as string[];
    if (new Set(subjectIds).size !== subjectIds.length) return NextResponse.json({ error: 'A subject can appear only once in the order.' }, { status: 400 });
    const existing = await prisma.gradeSubject.findMany({ where: { gradeId: body.gradeId }, select: { subjectId: true } });
    if (!existing.length || existing.length !== subjectIds.length || existing.some(({ subjectId }) => !subjectIds.includes(subjectId))) return NextResponse.json({ error: 'The subjects for this grade changed. Refresh and try again.' }, { status: 409 });
    await prisma.$transaction(subjectIds.map((subjectId, position) => prisma.gradeSubject.update({ where: { gradeId_subjectId: { gradeId: body.gradeId, subjectId } }, data: { position } })));
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Grade report subject order could not be saved', error);
    return NextResponse.json({ error: 'Could not save the subject order for this grade.' }, { status: 500 });
  }
}
