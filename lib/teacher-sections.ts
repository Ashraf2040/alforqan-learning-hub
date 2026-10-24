import { prisma } from '@/lib/prisma';

export const DEFAULT_TEACHER_SECTIONS = { weeklyPlans: true, todaysProgress: true, studentReports: true, studentMarks: true, quizMarks: true } as const;
export type TeacherSectionKey = keyof typeof DEFAULT_TEACHER_SECTIONS;
const SETTINGS_KEY = 'teacherSections';

export async function getTeacherSections() {
  const setting = await prisma.appSetting.findUnique({ where: { key: SETTINGS_KEY } });
  if (!setting) return DEFAULT_TEACHER_SECTIONS;
  try {
    const value = JSON.parse(setting.value) as Record<string, unknown>;
    return Object.fromEntries(Object.keys(DEFAULT_TEACHER_SECTIONS).map((key) => [key, typeof value[key] === 'boolean' ? value[key] : true])) as Record<TeacherSectionKey, boolean>;
  } catch {
    return DEFAULT_TEACHER_SECTIONS;
  }
}

export async function isTeacherSectionEnabled(section: TeacherSectionKey) {
  const sections = await getTeacherSections();
  return sections[section] !== false;
}
