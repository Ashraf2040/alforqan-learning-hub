import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

function normalize(user: { id: string; name: string; arabicName: string | null; classes: { id: string; name: string }[]; classTeacherAssignments: { class: { id: string; name: string } }[]; subjects: { id: string; name: string }[]; subjectTeacherAssignments: { subject: { id: string; name: string } }[] }) {
  return {
    id: user.id, name: user.name, arabicName: user.arabicName,
    classes: [...new Map([...user.classes, ...user.classTeacherAssignments.map(({ class: item }) => item)].map((item) => [item.id, item])).values()].sort((a, b) => a.name.localeCompare(b.name)),
    subjects: [...new Map([...user.subjects, ...user.subjectTeacherAssignments.map(({ subject }) => subject)].map((item) => [item.id, item])).values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['ADMIN', 'TEACHER'].includes(session.user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const include = { classes: { select: { id: true, name: true } }, classTeacherAssignments: { include: { class: { select: { id: true, name: true } } } }, subjects: { select: { id: true, name: true } }, subjectTeacherAssignments: { include: { subject: { select: { id: true, name: true } } } } } as const;
  if (session.user.role === 'ADMIN') {
    const users = await prisma.user.findMany({ where: { role: 'TEACHER' }, orderBy: { name: 'asc' }, include });
    return NextResponse.json({ teachers: users.map(normalize) });
  }
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include });
  if (!user) return NextResponse.json({ error: 'Teacher not found.' }, { status: 404 });
  return NextResponse.json({ teacher: normalize(user) });
}
