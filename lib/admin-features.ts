export const ADMIN_FEATURES = [
  'planner', 'people', 'teacherProgress', 'teacherSections', 'studentMarks',
  'certificates', 'markSchemes', 'quizMarks', 'studentReports', 'dataBackup',
] as const;

export type AdminFeature = typeof ADMIN_FEATURES[number];

export const ADMIN_FEATURE_LABELS: Record<AdminFeature, { en: string; ar: string }> = {
  planner: { en: 'Weekly planner', ar: 'التخطيط الأسبوعي' },
  people: { en: 'Teachers and students', ar: 'المعلمون والطلاب' },
  teacherProgress: { en: 'Teacher progress', ar: 'متابعة المعلمين' },
  teacherSections: { en: 'Teacher workspace settings', ar: 'إعدادات مساحة المعلم' },
  studentMarks: { en: 'Student marks', ar: 'درجات الطلاب' },
  certificates: { en: 'Certificates and marks reports', ar: 'الشهادات وتقارير الدرجات' },
  markSchemes: { en: 'Mark setup', ar: 'إعداد الدرجات' },
  quizMarks: { en: 'Quiz marks', ar: 'درجات الاختبارات القصيرة' },
  studentReports: { en: 'Student reports', ar: 'تقارير الطلاب' },
  dataBackup: { en: 'Data backup', ar: 'النسخ الاحتياطي للبيانات' },
};
