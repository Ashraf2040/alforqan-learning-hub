import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { SEMESTERS } from '@/lib/academic-periods';
import { hasAdminFeature } from '@/lib/custom-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !(await hasAdminFeature(session.user, 'dataBackup'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });

  const [grades, classes, studentMarks, quizMarks] = await Promise.all([
    prisma.grade.findMany({ select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.class.findMany({ select: { id: true, name: true, gradeId: true }, orderBy: { name: 'asc' } }),
    prisma.managedStudentMark.findMany({ distinct: ['academicYear'], select: { academicYear: true }, orderBy: { academicYear: 'desc' } }),
    prisma.managedQuizMark.findMany({ distinct: ['academicYear'], select: { academicYear: true }, orderBy: { academicYear: 'desc' } }),
  ]);
  const years = [...new Set([...studentMarks.map((item) => item.academicYear), ...quizMarks.map((item) => item.academicYear)])].sort((a, b) => b.localeCompare(a));
  return NextResponse.json({ grades, classes, years, terms: SEMESTERS });
}
