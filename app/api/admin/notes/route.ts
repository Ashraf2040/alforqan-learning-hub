import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function isAdmin() {
  const session = await getServerSession(authOptions);
  return session?.user?.role === 'ADMIN';
}

export async function GET(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const gradeId = request.nextUrl.searchParams.get('gradeId');
  const week = request.nextUrl.searchParams.get('week');
  const where = {
    ...(week !== null ? { week: week.trim() } : {}),
    ...(gradeId ? { OR: [{ scope: 'GLOBAL' }, { scope: 'SPECIFIC', grades: { some: { id: gradeId } } }] } : {}),
  };
  const notes = await prisma.adminPlannerNote.findMany({
    where,
    include: { grades: { select: { id: true, name: true } } },
    orderBy: [{ updatedAt: 'desc' }],
  });
  return NextResponse.json({ notes });
}

async function parseNote(request: NextRequest) {
  const body = await request.json();
  const content = typeof body.content === 'string' ? body.content.trim() : '';
  const scope = body.scope === 'SPECIFIC' ? 'SPECIFIC' : body.scope === 'GLOBAL' ? 'GLOBAL' : '';
  const week = typeof body.week === 'string' ? body.week.trim() : '';
  const gradeIds = Array.isArray(body.gradeIds) ? [...new Set<string>((body.gradeIds as unknown[]).filter((id): id is string => typeof id === 'string'))] : [];
  if (!content || !scope || !week) return { error: 'Enter a note, choose its week and scope.' };
  if (scope === 'SPECIFIC' && !gradeIds.length) return { error: 'Choose at least one grade for a specific note.' };
  if (scope === 'SPECIFIC') {
    const found = await prisma.grade.count({ where: { id: { in: gradeIds } } });
    if (found !== gradeIds.length) return { error: 'One or more selected grades do not exist.' };
  }
  return { content, scope, week, gradeIds: scope === 'SPECIFIC' ? gradeIds : [] };
}

export async function POST(request: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const input = await parseNote(request);
  if ('error' in input) return NextResponse.json({ error: input.error }, { status: 400 });
  const note = await prisma.adminPlannerNote.create({
    data: { content: input.content, scope: input.scope, week: input.week, grades: { connect: input.gradeIds.map((id) => ({ id })) } },
    include: { grades: { select: { id: true, name: true } } },
  });
  return NextResponse.json(note, { status: 201 });
}
