import { prisma } from '@/lib/prisma';
import { defaultMarkColumns, type MarkColumn } from '@/lib/student-marks';

export type SchemeScope = { subjectId: string; gradeId?: string | null; classId?: string | null };
export function markSchemeScopeKey({ subjectId, gradeId, classId }: SchemeScope) {
  return classId ? `${subjectId}:class:${classId}` : gradeId ? `${subjectId}:grade:${gradeId}` : `${subjectId}:global`;
}

function parseColumns(value: string | undefined, subjectName: string): MarkColumn[] {
  if (value) {
    try {
      const parsed = JSON.parse(value) as MarkColumn[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    } catch { /* Fall back to subject defaults for invalid stored JSON. */ }
  }
  return defaultMarkColumns(subjectName);
}

export async function getEffectiveMarkScheme(subjectId: string, subjectName: string, gradeId?: string | null, classId?: string | null) {
  const scopes: { scope: 'class' | 'grade' | 'global'; key: string }[] = [];
  if (classId) scopes.push({ scope: 'class', key: markSchemeScopeKey({ subjectId, classId }) });
  if (gradeId) scopes.push({ scope: 'grade', key: markSchemeScopeKey({ subjectId, gradeId }) });
  scopes.push({ scope: 'global', key: markSchemeScopeKey({ subjectId }) });
  for (const item of scopes) {
    const saved = await prisma.managedMarkScheme.findUnique({ where: { scopeKey: item.key }, select: { columns: true } });
    if (saved) return { columns: parseColumns(saved.columns, subjectName), resolvedScope: item.scope };
  }
  return { columns: defaultMarkColumns(subjectName), resolvedScope: 'defaults' as const };
}

export async function getMarkSchemeAtScope(scope: SchemeScope, subjectName: string) {
  const scopeKey = markSchemeScopeKey(scope);
  const exact = await prisma.managedMarkScheme.findUnique({ where: { scopeKey }, select: { columns: true } });
  const effective = await getEffectiveMarkScheme(scope.subjectId, subjectName, scope.gradeId, scope.classId);
  return { scopeKey, columns: parseColumns(exact?.columns ?? JSON.stringify(effective.columns), subjectName), overridden: Boolean(exact), resolvedScope: exact ? (scope.classId ? 'class' : scope.gradeId ? 'grade' : 'global') : effective.resolvedScope };
}
