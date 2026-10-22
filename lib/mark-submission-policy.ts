import { prisma } from '@/lib/prisma';

const SETTING_KEY = 'teacherMarkSubmissionPolicy';
export type MarkSubmissionPolicy = { deadlineAt: string | null; reopenAll: boolean; reopenedTeacherIds: string[] };
const DEFAULT_POLICY: MarkSubmissionPolicy = { deadlineAt: null, reopenAll: false, reopenedTeacherIds: [] };

export async function getMarkSubmissionPolicy(): Promise<MarkSubmissionPolicy> {
  const setting = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY }, select: { value: true } });
  if (!setting) return DEFAULT_POLICY;
  try {
    const value = JSON.parse(setting.value) as Partial<MarkSubmissionPolicy>;
    return {
      deadlineAt: typeof value.deadlineAt === 'string' && Number.isFinite(Date.parse(value.deadlineAt)) ? value.deadlineAt : null,
      reopenAll: value.reopenAll === true,
      reopenedTeacherIds: Array.isArray(value.reopenedTeacherIds) ? value.reopenedTeacherIds.filter((id): id is string => typeof id === 'string') : [],
    };
  } catch { return DEFAULT_POLICY; }
}

export async function canTeacherEditMarks(teacherId: string) {
  const policy = await getMarkSubmissionPolicy();
  const deadlinePassed = Boolean(policy.deadlineAt && Date.now() > Date.parse(policy.deadlineAt));
  return { canEdit: !deadlinePassed || policy.reopenAll || policy.reopenedTeacherIds.includes(teacherId), policy };
}
