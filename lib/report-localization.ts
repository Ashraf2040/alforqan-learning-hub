const arabicSubjects: Record<string, string> = {
  arabic: 'اللغة العربية', 'arabic language': 'اللغة العربية', 'اللغة العربية': 'اللغة العربية',
  islamic: 'التربية الإسلامية', 'islamic studies': 'التربية الإسلامية', 'islamic education': 'التربية الإسلامية',
  'التربية الإسلامية': 'التربية الإسلامية', 'التربية الاسلامية': 'التربية الإسلامية',
  'social arabic': 'الدراسات الاجتماعية باللغة العربية', 'social studies in arabic': 'الدراسات الاجتماعية باللغة العربية',
  'الدراسات الاجتماعية باللغة العربية': 'الدراسات الاجتماعية باللغة العربية',
};

const arabicRecommendations: Record<string, string> = {
  'continued good work': 'استمر في العمل الجيد',
  'better written work': 'تحسين الأعمال التحريرية',
  'more serious approach': 'مزيد من الجدية',
  'increased preparation and study': 'زيادة التحضير والدراسة',
  'increase preparation and study': 'زيادة التحضير والدراسة',
  'increased class participation': 'زيادة المشاركة الصفية',
  'increase class participation': 'زيادة المشاركة الصفية',
  'additional help needed': 'يحتاج إلى مساعدة إضافية',
  'needs additional help': 'يحتاج إلى مساعدة إضافية',
};

export function arabicSubjectName(name: string) {
  return arabicSubjects[name.trim().toLocaleLowerCase()] ?? name;
}

export function isArabicTaughtSubject(name: string) {
  return Object.hasOwn(arabicSubjects, name.trim().toLocaleLowerCase());
}

export function arabicReportStatus(value: string) {
  const status: Record<string, string> = { excellent: 'ممتاز', good: 'جيد', average: 'متوسط', 'below average': 'أقل من المتوسط' };
  return status[value.trim().toLocaleLowerCase()] ?? value;
}

export function arabicReportValue(value: string) {
  const key = value.trim().toLocaleLowerCase();
  if (arabicRecommendations[key]) return arabicRecommendations[key];
  if (key === 'complete') return 'مكتمل';
  if (key === 'incomplete') return 'غير مكتمل';
  if (key === 'missing') return 'مفقود';
  return value;
}

export function englishReportValue(value: string) {
  const recommendations: Record<string, string> = {
    'استمر في العمل الجيد': 'Continued good work',
    'تحسين الأعمال التحريرية': 'Better written work',
    'تحسين العمل الكتابي': 'Better written work',
    'مزيد من الجدية': 'More serious approach',
    'زيادة التحضير والدراسة': 'Increased preparation and study',
    'زيادة المشاركة الصفية': 'Increased class participation',
    'يحتاج إلى مساعدة إضافية': 'Additional help needed',
  };
  return recommendations[value.trim()] ?? value;
}
