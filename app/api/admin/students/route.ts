import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type StudentImportInput = { name?: unknown; classId?: unknown; grade?: unknown; className?: unknown };
type StudentImportRow = { name: string; classId: string; grade: string; className: string };
const gradeNumber = (value: string) => value.trim().match(/^\D*(\d+)/)?.[1] ?? '';
class StudentImportValidationError extends Error {}

async function adminOnly() { const session = await getServerSession(authOptions); return session?.user?.role === 'ADMIN'; }
export async function GET() {
  if (!await adminOnly()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [students, classes] = await Promise.all([
    prisma.student.findMany({ orderBy: [{ class: { name: 'asc' } }, { name: 'asc' }], select: { id: true, name: true, classId: true, class: { select: { id: true, name: true, grade: { select: { id: true, name: true } } } } } }),
    prisma.class.findMany({ orderBy: { name: 'asc' }, include: { grade: { select: { id: true, name: true } } } }),
  ]);
  return NextResponse.json({ students, classes });
}
export async function POST(request: NextRequest) {
  if (!await adminOnly()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    if (!Array.isArray(body.students) || body.students.length < 1 || body.students.length > 500) return NextResponse.json({ error: 'Provide between 1 and 500 validated students.' }, { status: 400 });
    const rows: StudentImportRow[] = (body.students as StudentImportInput[]).map((row) => ({ name: String(row.name ?? '').trim(), classId: String(row.classId ?? ''), grade: String(row.grade ?? '').trim(), className: String(row.className ?? '').trim() }));
    if (rows.some((row) => !row.name || (!row.classId && (!row.grade || !row.className || gradeNumber(row.grade) !== gradeNumber(row.className))))) return NextResponse.json({ error: 'Every student row needs a name and a valid class/grade assignment.' }, { status: 400 });
    const result = await prisma.$transaction(async (tx) => {
      const resolvedRows: { name: string; classId: string }[] = [];
      const grades = await tx.grade.findMany({ select: { id: true, name: true } });
      const requestedClassIds = [...new Set(rows.map((row) => row.classId).filter(Boolean))];
      const existingClasses = requestedClassIds.length
        ? await tx.class.findMany({ where: { id: { in: requestedClassIds } }, select: { id: true } })
        : [];
      const validClassIds = new Set(existingClasses.map((item) => item.id));
      if (requestedClassIds.some((id) => !validClassIds.has(id))) throw new StudentImportValidationError('One or more imported class assignments are invalid.');
      const classIdByCsvKey = new Map<string, string>();
      for (const row of rows) {
        if (row.classId) continue;
        const wantedNumber = gradeNumber(row.grade);
        const grade = grades.find((item) => item.name.trim().toLocaleLowerCase() === row.grade.toLocaleLowerCase()) ?? grades.find((item) => gradeNumber(item.name) === wantedNumber);
        if (!grade) throw new StudentImportValidationError(`Grade “${row.grade}” does not exist. Create the grade before importing this class.`);
        const key = `${grade.id}:${row.className.toLocaleLowerCase()}`;
        if (classIdByCsvKey.has(key)) continue;
        let schoolClass = await tx.class.findFirst({ where: { name: { equals: row.className, mode: 'insensitive' }, gradeId: grade.id }, select: { id: true } });
        if (!schoolClass) schoolClass = await tx.class.create({ data: { name: row.className, gradeId: grade.id }, select: { id: true } });
        classIdByCsvKey.set(key, schoolClass.id);
      }
      for (const row of rows) {
        const wantedNumber = gradeNumber(row.grade);
        const grade = grades.find((item) => item.name.trim().toLocaleLowerCase() === row.grade.toLocaleLowerCase()) ?? grades.find((item) => gradeNumber(item.name) === wantedNumber);
        const classId = row.classId || (grade ? classIdByCsvKey.get(`${grade.id}:${row.className.toLocaleLowerCase()}`) : undefined);
        if (!classId) throw new StudentImportValidationError('One or more imported class assignments are invalid.');
        resolvedRows.push({ name: row.name, classId });
      }
      const studentKeys = resolvedRows.map((row) => `${row.classId}:${row.name.toLocaleLowerCase()}`);
      if (new Set(studentKeys).size !== studentKeys.length) throw new StudentImportValidationError('The import contains duplicate student names in the same class.');
      const classIds = [...new Set(resolvedRows.map((row) => row.classId))];
      const existing = await tx.student.findMany({ where: { classId: { in: classIds }, name: { in: [...new Set(resolvedRows.map((row) => row.name))], mode: 'insensitive' } }, select: { name: true, classId: true } });
      if (existing.length) throw new StudentImportValidationError(`Student “${existing[0].name}” already exists in the selected class.`);
      return tx.student.createMany({ data: resolvedRows });
    }, { maxWait: 10000, timeout: 30000 });
    return NextResponse.json({ count: result.count }, { status: 201 });
  } catch (error) { console.error('Student CSV import failed', error); return NextResponse.json({ error: error instanceof StudentImportValidationError ? error.message : 'Could not import students.' }, { status: error instanceof StudentImportValidationError ? 400 : 500 }); }
}
export async function PATCH(request: NextRequest) {
  if (!await adminOnly()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json(); const id = String(body.id ?? ''); const classId = String(body.classId ?? ''); const name = String(body.name ?? '').trim();
  if (!id || !classId || !name || !(await prisma.class.findUnique({ where: { id: classId } }))) return NextResponse.json({ error: 'Enter a student name and choose a class.' }, { status: 400 });
  try {
  const student = await prisma.student.update({ where: { id }, data: { name, classId } });
    return NextResponse.json({ student });
  } catch { return NextResponse.json({ error: 'Could not update this student.' }, { status: 400 }); }
}
export async function DELETE(request: NextRequest) {
  if (!await adminOnly()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const id = request.nextUrl.searchParams.get('id'); if (!id) return NextResponse.json({ error: 'Choose a student.' }, { status: 400 });
  try { await prisma.student.delete({ where: { id } }); return NextResponse.json({ ok: true }); }
  catch { return NextResponse.json({ error: 'Could not remove this student.' }, { status: 400 }); }
}
