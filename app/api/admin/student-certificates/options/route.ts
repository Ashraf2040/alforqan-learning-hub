import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { hasAdminFeature } from '@/lib/custom-admin';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !(await hasAdminFeature(session.user, 'certificates'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  const [classes, marksYears, quizYears] = await Promise.all([
    prisma.class.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.managedStudentMark.findMany({ distinct: ['academicYear'], select: { academicYear: true }, orderBy: { academicYear: 'desc' } }),
    prisma.managedQuizMark.findMany({ distinct: ['academicYear'], select: { academicYear: true }, orderBy: { academicYear: 'desc' } }),
  ]);
  const academicYears = [...new Set([...marksYears, ...quizYears].map(({ academicYear }) => academicYear))].sort((a, b) => b.localeCompare(a));
  return NextResponse.json({ classes, academicYears });
}
