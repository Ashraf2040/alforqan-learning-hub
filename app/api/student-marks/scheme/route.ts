import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { getMarkSchemeAtScope, markSchemeScopeKey } from '@/lib/managed-mark-schemes';
import { fieldsForSubject, type MarkColumn } from '@/lib/student-marks';

const canManage = (role: string) => role === 'ADMIN' || role === 'COORDINATOR';

async function validateScope(subjectId: string, gradeId: string, classId: string) {
  const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { id: true, name: true } });
  if (!subject) return { error: NextResponse.json({ error: 'Subject not found.' }, { status: 404 }) };
  let resolvedGradeId = gradeId || '';
  if (classId) {
    const schoolClass = await prisma.class.findUnique({ where: { id: classId }, select: { id: true, gradeId: true } });
    if (!schoolClass) return { error: NextResponse.json({ error: 'Class not found.' }, { status: 404 }) };
    if (resolvedGradeId && schoolClass.gradeId && resolvedGradeId !== schoolClass.gradeId) return { error: NextResponse.json({ error: 'The class does not belong to the selected grade.' }, { status: 400 }) };
    resolvedGradeId = schoolClass.gradeId ?? resolvedGradeId;
  }
  if (resolvedGradeId && !(await prisma.grade.findUnique({ where: { id: resolvedGradeId }, select: { id: true } }))) return { error: NextResponse.json({ error: 'Grade not found.' }, { status: 404 }) };
  return { subject, gradeId: resolvedGradeId || null };
}

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['ADMIN', 'COORDINATOR', 'TEACHER'].includes(session.user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const query = request.nextUrl.searchParams;
  const subjectId = query.get('subjectId') ?? '';
  const gradeId = query.get('gradeId') ?? '';
  const classId = query.get('classId') ?? '';
  if (!subjectId) return NextResponse.json({ error: 'Choose a subject.' }, { status: 400 });
  if (session.user.role === 'TEACHER') {
    const [subjectAssignment, classAssignment] = await Promise.all([
      prisma.subject.findFirst({ where: { id: subjectId, OR: [{ teachers: { some: { id: session.user.id } } }, { teacherSubjectAssignments: { some: { teacherId: session.user.id } } }] }, select: { id: true } }),
      classId ? prisma.class.findFirst({ where: { id: classId, OR: [{ teachers: { some: { id: session.user.id } } }, { classTeacherAssignments: { some: { teacherId: session.user.id } } }] }, select: { id: true } }) : Promise.resolve(true),
    ]);
    if (!subjectAssignment || !classAssignment) return NextResponse.json({ error: 'Subject or class is not assigned to this account.' }, { status: 403 });
  }
  const scope = await validateScope(subjectId, gradeId, classId);
  if ('error' in scope) return scope.error;
  return NextResponse.json(await getMarkSchemeAtScope({ subjectId, gradeId: scope.gradeId, classId: classId || null }, scope.subject.name));
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canManage(session.user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const subjectId = String(body.subjectId ?? '');
    const gradeId = String(body.gradeId ?? '');
    const classId = String(body.classId ?? '');
    if (!subjectId || !Array.isArray(body.columns) || body.columns.length === 0) return NextResponse.json({ error: 'Choose a subject and at least one table column.' }, { status: 400 });
    const scope = await validateScope(subjectId, gradeId, classId);
    if ('error' in scope) return scope.error;
    const allowedDefaults = new Set(fieldsForSubject(scope.subject.name));
    const seen = new Set<string>();
    const columns = body.columns as unknown[];
    for (const raw of columns) {
      if (!raw || typeof raw !== 'object') return NextResponse.json({ error: 'Invalid table column.' }, { status: 400 });
      const column = raw as Partial<MarkColumn>;
      const field = String(column.field ?? '');
      const isCustom = /^custom_[a-zA-Z0-9_-]{6,80}$/.test(field);
      if ((!allowedDefaults.has(field as never) && !isCustom) || seen.has(field) || typeof column.label !== 'string' || !column.label.trim() || typeof column.labelAr !== 'string' || !column.labelAr.trim() || !Number.isInteger(column.min) || !Number.isInteger(column.max) || (column.min as number) < 0 || (column.max as number) <= 0 || (column.min as number) > (column.max as number) || (column.max as number) > 10000) return NextResponse.json({ error: 'Columns need unique keys, English and Arabic headers, and valid minimum and maximum scores.' }, { status: 400 });
      seen.add(field);
    }
    const scopeKey = markSchemeScopeKey({ subjectId, gradeId: scope.gradeId, classId: classId || null });
    const saved = await prisma.managedMarkScheme.upsert({ where: { scopeKey }, create: { scopeKey, subjectId, gradeId: scope.gradeId, classId: classId || null, columns: JSON.stringify(columns) }, update: { columns: JSON.stringify(columns) } });
    return NextResponse.json({ scopeKey: saved.scopeKey, columns, overridden: true });
  } catch (error) {
    console.error('Managed mark scheme could not be saved', error);
    return NextResponse.json({ error: 'Could not save subject and grade mark settings.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !canManage(session.user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const subjectId = String(body.subjectId ?? '');
    const gradeId = String(body.gradeId ?? '');
    const classId = String(body.classId ?? '');
    const scope = await validateScope(subjectId, gradeId, classId);
    if ('error' in scope) return scope.error;
    const scopeKey = markSchemeScopeKey({ subjectId, gradeId: scope.gradeId, classId: classId || null });
    await prisma.managedMarkScheme.deleteMany({ where: { scopeKey } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Managed mark scheme could not be reset', error);
    return NextResponse.json({ error: 'Could not remove this scope override.' }, { status: 500 });
  }
}
