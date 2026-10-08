import { prisma } from '@/lib/prisma';
import type { MarkColumn } from '@/lib/student-marks';

export async function getQuizColumns(subjectId: string): Promise<MarkColumn[]> {
  const scheme = await prisma.managedQuizScheme.findUnique({ where: { subjectId }, select: { firstMax: true, secondMax: true } });
  const firstMax = scheme?.firstMax ?? 10;
  const secondMax = scheme?.secondMax ?? 10;
  return [
    { field: 'quiz1', label: 'First quiz', labelAr: 'الاختبار الأول', min: 0, max: firstMax },
    { field: 'quiz2', label: 'Second quiz', labelAr: 'الاختبار الثاني', min: 0, max: secondMax },
  ];
}

export function isQuizField(field: string) { return field === 'quiz1' || field === 'quiz2'; }
