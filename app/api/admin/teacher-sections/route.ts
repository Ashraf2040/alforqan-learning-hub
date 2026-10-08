import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export const DEFAULT_SECTIONS = { weeklyPlans: true, todaysProgress: true, studentReports: true };
const SETTINGS_KEY = 'teacherSections';

async function readSections() {
  const setting = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
  if (!setting) return DEFAULT_SECTIONS;
  try {
    const value = JSON.parse(setting.value) as Record<string, unknown>;
    return Object.fromEntries(Object.keys(DEFAULT_SECTIONS).map((key) => [key, typeof value[key] === 'boolean' ? value[key] : true])) as typeof DEFAULT_SECTIONS;
  } catch { return DEFAULT_SECTIONS; }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['ADMIN', 'TEACHER'].includes(session.user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ sections: await readSections() });
}

export async function PUT(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    if (!body.sections || Object.keys(DEFAULT_SECTIONS).some((key) => typeof body.sections[key] !== 'boolean')) return NextResponse.json({ error: 'Choose whether each teacher section is enabled.' }, { status: 400 });
    const sections = Object.fromEntries(Object.keys(DEFAULT_SECTIONS).map((key) => [key, body.sections[key]]));
    await prisma.appSetting.upsert({ where: { key: SETTINGS_KEY }, create: { key: SETTINGS_KEY, value: JSON.stringify(sections) }, update: { value: JSON.stringify(sections) } });
    return NextResponse.json({ sections });
  } catch (error) {
    console.error('Teacher section settings could not be saved', error);
    return NextResponse.json({ error: 'Could not save teacher section settings.' }, { status: 500 });
  }
}
