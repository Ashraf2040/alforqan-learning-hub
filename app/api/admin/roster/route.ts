import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

type TeacherImportInput = { name?: unknown; username?: unknown; password?: unknown; email?: unknown; academicYear?: unknown; school?: unknown; classIds?: unknown; subjectIds?: unknown };
type TeacherImportRow = { name: string; username: string; password: string; email: string; academicYear: string; school: string; classIds: string[]; subjectIds: string[] };

async function isAdmin() { const session = await getServerSession(authOptions); return session?.user?.role === 'ADMIN' ? session : null; }

export async function GET() {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [teachers, classes, subjects] = await Promise.all([
    prisma.user.findMany({ where: { role: 'TEACHER' }, orderBy: { name: 'asc' }, select: { id: true, name: true, username: true, classes: { select: { id: true, name: true } }, subjects: { select: { id: true, name: true } } } }),
    prisma.class.findMany({ orderBy: { name: 'asc' }, include: { grade: { select: { id: true, name: true } } } }),
    prisma.subject.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  return NextResponse.json({ teachers, classes, subjects });
}

export async function POST(request: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    if (Array.isArray(body.teachers)) {
      if (body.teachers.length < 1 || body.teachers.length > 500) return NextResponse.json({ error: 'Provide between 1 and 500 validated teachers.' }, { status: 400 });
      const rows: TeacherImportRow[] = (body.teachers as TeacherImportInput[]).map((row) => ({
        name: String(row.name ?? '').trim(), username: String(row.username ?? '').trim().toLowerCase(), password: String(row.password ?? ''), email: String(row.email ?? '').trim().toLowerCase(), academicYear: String(row.academicYear ?? '').trim(), school: String(row.school ?? '').trim(),
        classIds: Array.isArray(row.classIds) ? [...new Set((row.classIds as unknown[]).filter((id): id is string => typeof id === 'string'))] : [], subjectIds: Array.isArray(row.subjectIds) ? [...new Set((row.subjectIds as unknown[]).filter((id): id is string => typeof id === 'string'))] : [],
      }));
      if (rows.some((row) => !row.name || !row.username || row.password.length < 8 || !row.academicYear || !row.classIds.length || !row.subjectIds.length)) return NextResponse.json({ error: 'Every teacher needs a name, username, password of at least 8 characters, academic year, class, and subject.' }, { status: 400 });
      if (rows.some((row) => row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))) return NextResponse.json({ error: 'One or more teacher email addresses are invalid.' }, { status: 400 });
      const usernames = rows.map((row) => row.username), emails = rows.map((row) => row.email).filter(Boolean);
      if (new Set(usernames).size !== usernames.length || new Set(emails).size !== emails.length) return NextResponse.json({ error: 'The CSV contains duplicate usernames or email addresses.' }, { status: 400 });
      const [existing, classes, subjects] = await Promise.all([
        prisma.user.findMany({ where: { OR: [{ username: { in: usernames } }, ...(emails.length ? [{ email: { in: emails } }] : [])] }, select: { username: true, email: true } }),
        prisma.class.findMany({ where: { id: { in: [...new Set(rows.flatMap((row) => row.classIds))] } }, select: { id: true } }),
        prisma.subject.findMany({ where: { id: { in: [...new Set(rows.flatMap((row) => row.subjectIds))] } }, select: { id: true } }),
      ]);
      if (existing.length) return NextResponse.json({ error: `Username or email already exists: ${existing[0].username}.` }, { status: 409 });
      if (classes.length !== new Set(rows.flatMap((row) => row.classIds)).size || subjects.length !== new Set(rows.flatMap((row) => row.subjectIds)).size) return NextResponse.json({ error: 'One or more imported class or subject assignments are invalid.' }, { status: 400 });
      const prepared = await Promise.all(rows.map(async (row) => ({ ...row, password: await bcrypt.hash(row.password, 12) })));
      await prisma.$transaction(prepared.map(({ classIds, subjectIds, ...row }) => prisma.user.create({ data: { ...row, email: row.email || null, role: 'TEACHER', classes: { connect: classIds.map((id) => ({ id })) }, subjects: { connect: subjectIds.map((id) => ({ id })) }, classTeacherAssignments: { create: classIds.map((classId) => ({ classId })) }, subjectTeacherAssignments: { create: subjectIds.map((subjectId) => ({ subjectId })) } } })));
      return NextResponse.json({ count: rows.length }, { status: 201 });
    }
    const name = String(body.name ?? '').trim();
    const username = String(body.username ?? '').trim();
    const password = String(body.password ?? '');
    const email = String(body.email ?? '').trim().toLowerCase();
    const academicYear = String(body.academicYear ?? '').trim();
    const arabicName = String(body.arabicName ?? '').trim();
    const school = String(body.school ?? '').trim();
    const classIds: string[] = Array.isArray(body.classIds) ? [...new Set((body.classIds as unknown[]).filter((x): x is string => typeof x === 'string'))] : [];
    const subjectIds: string[] = Array.isArray(body.subjectIds) ? [...new Set((body.subjectIds as unknown[]).filter((x): x is string => typeof x === 'string'))] : [];
    if (!name || !username || password.length < 8) return NextResponse.json({ error: 'Enter a name, username, and password of at least 8 characters.' }, { status: 400 });
    const user = await prisma.user.create({ data: { name, username, email: email || null, arabicName: arabicName || null, academicYear: academicYear || null, school: school || null, password: await bcrypt.hash(password, 12), role: 'TEACHER', classes: { connect: classIds.map((id: string) => ({ id })) }, subjects: { connect: subjectIds.map((id: string) => ({ id })) }, classTeacherAssignments: { create: classIds.map((classId) => ({ classId })) }, subjectTeacherAssignments: { create: subjectIds.map((subjectId) => ({ subjectId })) } } });
    return NextResponse.json({ id: user.id }, { status: 201 });
  } catch (error) { console.error('Teacher creation failed', error); return NextResponse.json({ error: 'Could not create teacher. Check that the username is unique.' }, { status: 400 }); }
}

export async function PUT(request: NextRequest) {
  if (!await isAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const name = String(body.name ?? '').trim(); const classId = String(body.classId ?? '');
    if (!name || !classId || !(await prisma.class.findUnique({ where: { id: classId } }))) return NextResponse.json({ error: 'Enter the student name and choose a class.' }, { status: 400 });
    const student = await prisma.student.create({ data: { name, classId } });
    return NextResponse.json({ id: student.id }, { status: 201 });
  } catch (error) { console.error('Student creation failed', error); return NextResponse.json({ error: 'Could not create the student.' }, { status: 400 }); }
}
