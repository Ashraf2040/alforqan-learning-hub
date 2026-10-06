import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'TEACHER') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: {
    classes: { orderBy: { name: 'asc' } }, classTeacherAssignments: { include: { class: true } },
    subjects: { orderBy: { name: 'asc' } }, subjectTeacherAssignments: { include: { subject: true } },
  } });
  const classes = [...new Map([...(user?.classes ?? []), ...(user?.classTeacherAssignments ?? []).map((item) => item.class)].map((item) => [item.id, item])).values()].sort((a, b) => a.name.localeCompare(b.name));
  const subjects = [...new Map([...(user?.subjects ?? []), ...(user?.subjectTeacherAssignments ?? []).map((item) => item.subject)].map((item) => [item.id, item])).values()].sort((a, b) => a.name.localeCompare(b.name));
  return NextResponse.json({ classes, subjects });
}
