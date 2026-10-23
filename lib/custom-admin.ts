import { prisma } from '@/lib/prisma';
import { ADMIN_FEATURES, type AdminFeature } from '@/lib/admin-features';
export { ADMIN_FEATURES, ADMIN_FEATURE_LABELS } from '@/lib/admin-features';
export type { AdminFeature } from '@/lib/admin-features';

type AdminIdentity = { id: string; role: string };
const SETTING_KEY = 'customAdminFeatureAccess';

async function readAccessMap(): Promise<Record<string, AdminFeature[]>> {
  const setting = await prisma.appSetting.findUnique({ where: { key: SETTING_KEY }, select: { value: true } });
  if (!setting) return {};
  try {
    const parsed = JSON.parse(setting.value) as Record<string, unknown>;
    return Object.fromEntries(Object.entries(parsed).map(([id, features]) => [id, Array.isArray(features) ? features.filter((feature): feature is AdminFeature => ADMIN_FEATURES.includes(feature as AdminFeature)) : []]));
  } catch { return {}; }
}

export async function getCustomAdminAccess(user: AdminIdentity): Promise<AdminFeature[]> {
  if (user.role === 'ADMIN') return [...ADMIN_FEATURES];
  if (user.role !== 'CUSTOM_ADMIN') return [];
  const access = await readAccessMap();
  return access[user.id] ?? [];
}

export async function hasAdminFeature(user: AdminIdentity, feature: AdminFeature): Promise<boolean> {
  if (user.role === 'ADMIN') return true;
  return user.role === 'CUSTOM_ADMIN' && (await getCustomAdminAccess(user)).includes(feature);
}

export async function hasAnyAdminFeature(user: AdminIdentity, features: AdminFeature[]): Promise<boolean> {
  if (user.role === 'ADMIN') return true;
  if (user.role !== 'CUSTOM_ADMIN') return false;
  const allowed = new Set(await getCustomAdminAccess(user));
  return features.some((feature) => allowed.has(feature));
}

export async function setCustomAdminAccess(userId: string, features: AdminFeature[] | null) {
  const current = await readAccessMap();
  if (features === null) delete current[userId];
  else current[userId] = [...new Set(features.filter((feature) => ADMIN_FEATURES.includes(feature)))];
  await prisma.appSetting.upsert({ where: { key: SETTING_KEY }, create: { key: SETTING_KEY, value: JSON.stringify(current) }, update: { value: JSON.stringify(current) } });
}

