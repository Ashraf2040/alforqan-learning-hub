import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type Context = { params: Promise<{ id: string }> };
async function allowed() {
  const session = await getServerSession(authOptions);
  return session?.user?.role === 'ADMIN';
}

export async function PATCH(request: NextRequest, { params }: Context) {
  if (!(await allowed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const body = await request.json();
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const scope = body.scope === 'SPECIFIC' ? 'SPECIFIC' : body.scope === 'GLOBAL' ? 'GLOBAL' : '';
  const week = typeof body.week === 'string' ? body.week.trim() : '';
  const gradeIds = Array.isArray(body.gradeIds) ? [...new Set<string>((body.gradeIds as unknown[]).filter((value): value is string => typeof value === 'string'))] : [];
  if (!content || !scope || !week || (scope === 'SPECIFIC' && !gradeIds.length)) return NextResponse.json({ error: 'Enter a note, choose its week and scope, and select grades when needed.' }, { status: 400 });
  if (scope === 'SPECIFIC') {
    const count = await prisma.grade.count({ where: { id: { in: gradeIds } } });
    if (count !== gradeIds.length) return NextResponse.json({ error: 'One or more selected grades do not exist.' }, { status: 400 });
  }
  try {
    const note = await prisma.adminPlannerNote.update({
      where: { id },
      data: { content, scope, week, grades: { set: gradeIds.map((gradeId) => ({ id: gradeId })) } },
      include: { grades: { select: { id: true, name: true } } },
    });
    return NextResponse.json(note);
  } catch {
    return NextResponse.json({ error: 'The note could not be updated.' }, { status: 404 });
  }
}

export async function DELETE(_request: NextRequest, { params }: Context) {
  if (!(await allowed())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  try {
    await prisma.adminPlannerNote.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'The note could not be deleted.' }, { status: 404 });
  }
}
