export const MARK_FIELDS = ['participation', 'behavior', 'workingQuiz', 'project', 'finalExam', 'classActivities', 'homework', 'memorizing', 'oralTest', 'reading'] as const;
export type MarkField = typeof MARK_FIELDS[number];
export type MarkValues = Record<MarkField, number>;
export type MarkColumn = { field: string; label: string; labelAr: string; min: number; max: number };

export function maximaForSubject(subjectName: string): Partial<Record<MarkField, number>> {
  const subject = subjectName.trim().toLocaleLowerCase();
  if (subject === 'arabic' || subject === 'arabic language') return { participation: 10, behavior: 5, project: 10, classActivities: 15, workingQuiz: 20, finalExam: 40 };
  if (subject === 'social arabic' || subject === 'social studies in arabic') return { participation: 10, behavior: 10, project: 10, classActivities: 10, workingQuiz: 20, finalExam: 40 };
  if (subject === 'islamic' || subject === 'islamic studies') return { participation: 10, behavior: 10, reading: 10, memorizing: 10, oralTest: 5, workingQuiz: 15, finalExam: 40 };
  return { participation: 15, behavior: 15, workingQuiz: 15, project: 20, finalExam: 35 };
}

export function fieldsForSubject(subjectName: string): MarkField[] {
  const maxima = maximaForSubject(subjectName);
  return MARK_FIELDS.filter((field) => maxima[field] !== undefined);
}

export function emptyMarkValues(): MarkValues {
  return Object.fromEntries(MARK_FIELDS.map((field) => [field, 0])) as MarkValues;
}

export function defaultMarkColumns(subjectName: string): MarkColumn[] {
  const labels: Record<MarkField, [string, string]> = {
    participation: ['Participation', 'المشاركة'], behavior: ['Homework', 'الواجب'], workingQuiz: ['Quiz', 'الاختبار القصير'], project: ['Project', 'المشروع'], finalExam: ['Exam', 'الاختبار النهائي'], classActivities: ['Class activities', 'أنشطة الصف'], homework: ['Homework mark', 'درجة الواجب'], memorizing: ['Memorizing', 'الحفظ'], oralTest: ['Oral test', 'الاختبار الشفهي'], reading: ['Reading', 'القراءة'],
  };
  const maxima = maximaForSubject(subjectName);
  return fieldsForSubject(subjectName).map((field) => { const max = maxima[field] ?? 0; return { field, label: labels[field][0], labelAr: labels[field][1], min: Math.floor(max * 0.66), max }; });
}
