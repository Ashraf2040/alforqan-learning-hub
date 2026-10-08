import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['ADMIN', 'COORDINATOR'].includes(session.user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [subjects, grades, classes] = await Promise.all([
    prisma.subject.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.grade.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.class.findMany({ orderBy: [{ grade: { name: 'asc' } }, { name: 'asc' }], select: { id: true, name: true, gradeId: true } }),
  ]);
  const effectiveClasses = classes.map((schoolClass) => {
    const number = schoolClass.name.match(/^\s*(\d+)/)?.[1];
    const inferredGrade = number ? grades.find((grade) => grade.name.match(/\d+/)?.[0] === number) : undefined;
    return { ...schoolClass, gradeId: schoolClass.gradeId ?? inferredGrade?.id ?? null };
  });
  return NextResponse.json({ subjects, grades, classes: effectiveClasses });
}
