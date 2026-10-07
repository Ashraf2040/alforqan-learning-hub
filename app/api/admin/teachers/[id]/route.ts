import bcrypt from 'bcryptjs';
import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PATCH(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await context.params;
    const body = await request.json();
    const username = String(body.username ?? '').trim().toLowerCase();
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const arabicName = String(body.arabicName ?? '').trim();
    const academicYear = String(body.academicYear ?? '').trim();
    const school = String(body.school ?? '').trim();
    const password = String(body.password ?? '');
    const classIds: string[] | null = Array.isArray(body.classIds) ? [...new Set<string>(body.classIds.filter((value: unknown): value is string => typeof value === 'string'))] : null;
    const subjectIds: string[] | null = Array.isArray(body.subjectIds) ? [...new Set<string>(body.subjectIds.filter((value: unknown): value is string => typeof value === 'string'))] : null;
    if (!username || !name || username.length > 100 || name.length > 160 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
      return NextResponse.json({ error: 'Enter a valid teacher name, username, and email address.' }, { status: 400 });
    }
    if (password && password.length < 8) return NextResponse.json({ error: 'A new password must be at least 8 characters.' }, { status: 400 });
    if (!classIds || !subjectIds) return NextResponse.json({ error: 'Choose the teacher’s classes and subjects.' }, { status: 400 });

    const [teacher, classes, subjects] = await Promise.all([
      prisma.user.findUnique({ where: { id }, select: { id: true, role: true } }),
      classIds.length ? prisma.class.findMany({ where: { id: { in: classIds } }, select: { id: true } }) : Promise.resolve([] as { id: string }[]),
      subjectIds.length ? prisma.subject.findMany({ where: { id: { in: subjectIds } }, select: { id: true } }) : Promise.resolve([] as { id: string }[]),
    ]);
    if (!teacher || teacher.role !== 'TEACHER') return NextResponse.json({ error: 'Teacher not found.' }, { status: 404 });
    if (classes.length !== classIds.length || subjects.length !== subjectIds.length) return NextResponse.json({ error: 'One or more selected classes or subjects are invalid.' }, { status: 400 });

    const updated = await prisma.user.update({
      where: { id },
      data: {
        username, name, email: email || null, arabicName: arabicName || null,
        academicYear: academicYear || null, school: school || null,
        ...(password ? { password: await bcrypt.hash(password, 12) } : {}),
        classes: { set: classIds.map((classId) => ({ id: classId })) },
        subjects: { set: subjectIds.map((subjectId) => ({ id: subjectId })) },
        classTeacherAssignments: { deleteMany: {}, create: classIds.map((classId) => ({ classId })) },
        subjectTeacherAssignments: { deleteMany: {}, create: subjectIds.map((subjectId) => ({ subjectId })) },
      },
      select: { id: true, username: true, name: true },
    });
    return NextResponse.json({ teacher: updated });
  } catch (error) {
    console.error('Teacher update failed', error);
    return NextResponse.json({ error: 'Could not update this teacher. Check that the username and email are unique.' }, { status: 400 });
  }
}
