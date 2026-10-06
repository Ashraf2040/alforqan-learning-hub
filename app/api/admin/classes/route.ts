import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [grades, classes, subjects] = await Promise.all([
    prisma.grade.findMany({ orderBy: { name: 'asc' }, include: { classes: { select: { id: true, name: true }, orderBy: { name: 'asc' } }, subjects: { orderBy: { position: 'asc' }, include: { subject: { select: { id: true, name: true } } } } } }),
    prisma.class.findMany({ orderBy: { name: 'asc' }, include: { grade: { select: { id: true, name: true } } } }),
    prisma.subject.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  // Older class records may not have a persisted gradeId yet. Infer a grade
  // from a leading grade number (for example, 6A -> grade 6) until the admin
  // explicitly assigns the class in Manage Grades.
  const effectiveClasses = classes.map((schoolClass) => {
    const explicitGrade = grades.find((grade) => grade.id === schoolClass.gradeId);
    const leadingNumber = schoolClass.name.match(/^\s*(\d+)/)?.[1];
    const inferredGrade = leadingNumber
      ? grades.find((grade) => grade.name.match(/\d+/)?.[0] === leadingNumber)
      : undefined;
    const grade = explicitGrade ?? inferredGrade;
    return {
      ...schoolClass,
      gradeId: schoolClass.gradeId ?? grade?.id ?? null,
      grade: schoolClass.grade ?? (grade ? { id: grade.id, name: grade.name } : null),
    };
  });
  const effectiveGrades = grades.map((grade) => ({
    ...grade,
    classes: effectiveClasses
      .filter((schoolClass) => schoolClass.gradeId === grade.id)
      .map(({ id, name }) => ({ id, name })),
  }));
  return NextResponse.json({ grades: effectiveGrades, classes: effectiveClasses, subjects });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const name = String(body.name ?? '').trim();
  if (!name) return NextResponse.json({ error: 'Enter a grade name.' }, { status: 400 });
  try {
    const grade = await prisma.grade.create({ data: { name } });
    await persistAssignments(grade.id, body.classIds, body.subjectIds);
    return NextResponse.json({ id: grade.id }, { status: 201 });
  } catch (error) {
    console.error('Grade creation failed', error);
    return NextResponse.json({ error: 'Could not create the grade. It may already exist.' }, { status: 400 });
  }
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const gradeId = typeof body.gradeId === 'string' ? body.gradeId : '';
  if (!gradeId || !(await prisma.grade.findUnique({ where: { id: gradeId } }))) return NextResponse.json({ error: 'Choose an existing grade.' }, { status: 400 });
  try {
    await persistAssignments(gradeId, body.classIds, body.subjectIds);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Grade assignments could not be saved', error);
    return NextResponse.json({ error: 'Could not save these grade assignments.' }, { status: 400 });
  }
}

async function persistAssignments(gradeId: string, rawClassIds: unknown, rawSubjectIds: unknown) {
  const classIds = Array.isArray(rawClassIds) ? [...new Set(rawClassIds.filter((id): id is string => typeof id === 'string'))] : [];
  const subjectIds = Array.isArray(rawSubjectIds) ? [...new Set(rawSubjectIds.filter((id): id is string => typeof id === 'string'))] : [];
  await prisma.$transaction(async (tx) => {
    await tx.class.updateMany({ where: { gradeId }, data: { gradeId: null } });
    if (classIds.length) await tx.class.updateMany({ where: { id: { in: classIds } }, data: { gradeId } });
    await tx.gradeSubject.deleteMany({ where: { gradeId } });
    if (subjectIds.length) await tx.gradeSubject.createMany({ data: subjectIds.map((subjectId, position) => ({ gradeId, subjectId, position })), skipDuplicates: true });
  });
}
