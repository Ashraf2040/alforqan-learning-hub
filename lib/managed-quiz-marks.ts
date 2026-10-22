import { prisma } from '@/lib/prisma';
import { defaultMarkColumns, maximaForSubject, type MarkColumn } from '@/lib/student-marks';

export type QuizLimits = { firstMax: number; secondMax: number };

export async function getQuizLimits(subjectId: string): Promise<QuizLimits> {
  const scheme = await prisma.managedQuizScheme.findUnique({ where: { subjectId }, select: { firstMax: true, secondMax: true } });
  return { firstMax: scheme?.firstMax ?? 10, secondMax: scheme?.secondMax ?? 10 };
}

/** Pick the single marks-table header that receives the normalized quiz average. */
export function withQuizAverageColumn(markColumns: MarkColumn[], subjectName: string): MarkColumn[] {
  const columns = markColumns.filter((column) => !isQuizField(column.field));
  let quizIndex = columns.findIndex((column) => column.field === 'workingQuiz');
  if (quizIndex < 0) quizIndex = columns.findIndex((column) => /\bquiz\b/i.test(column.label) || /اختبار/i.test(column.labelAr));
  if (quizIndex < 0) {
    const defaultQuiz = defaultMarkColumns(subjectName).find((column) => column.field === 'workingQuiz');
    const maximum = defaultQuiz?.max ?? maximaForSubject(subjectName).workingQuiz ?? 15;
    columns.push({ field: 'workingQuiz', label: 'Quiz', labelAr: 'الاختبار القصير', min: 1, max: maximum, readOnly: true, quizAverage: true });
    return columns;
  }
  columns[quizIndex] = { ...columns[quizIndex], readOnly: true, quizAverage: true };
  return columns;
}

/** Average entered quiz percentages and scale the result to the marks header maximum. */
export function calculateQuizAverage(first: number, second: number, limits: QuizLimits, headerMax: number) {
  const attempts = [
    { score: first, max: limits.firstMax },
    { score: second, max: limits.secondMax },
  ].filter((attempt) => attempt.score > 0 && attempt.max > 0);
  if (!attempts.length || headerMax <= 0) return 0;
  const percent = attempts.reduce((sum, attempt) => sum + attempt.score / attempt.max, 0) / attempts.length;
  return Math.max(1, Math.min(headerMax, Math.round(percent * headerMax)));
}

export function injectQuizAverage<T extends Record<string, unknown>>(values: T, columns: MarkColumn[], limits: QuizLimits, first: number, second: number) {
  const column = columns.find((item) => item.quizAverage);
  if (!column) return values;
  return { ...values, [column.field]: calculateQuizAverage(first, second, limits, column.max) };
}

export function isQuizField(field: string) { return field === 'quiz1' || field === 'quiz2'; }
