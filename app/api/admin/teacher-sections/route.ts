import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasAdminFeature } from '@/lib/custom-admin';
import { DEFAULT_TEACHER_SECTIONS, getTeacherSections } from '@/lib/teacher-sections';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['ADMIN', 'TEACHER'].includes(session.user.role) && !(session.user.role === 'CUSTOM_ADMIN' && await hasAdminFeature(session.user, 'teacherSections'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  return NextResponse.json({ sections: await getTeacherSections() });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !(await hasAdminFeature(session.user, 'teacherSections'))) return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  try {
    const body = await request.json();
    if (!body.sections || Object.keys(DEFAULT_TEACHER_SECTIONS).some((key) => typeof body.sections[key] !== 'boolean')) return NextResponse.json({ error: 'Choose whether each teacher section is enabled.' }, { status: 400 });
    const sections = Object.fromEntries(Object.keys(DEFAULT_TEACHER_SECTIONS).map((key) => [key, body.sections[key]]));
    await prisma.appSetting.upsert({ where: { key: 'teacherSections' }, create: { key: 'teacherSections', value: JSON.stringify(sections) }, update: { value: JSON.stringify(sections) } });
    return NextResponse.json({ sections });
  } catch (error) {
    console.error('Teacher section settings could not be saved', error);
    return NextResponse.json({ error: 'Could not save teacher section settings.' }, { status: 500 });
  }
}
