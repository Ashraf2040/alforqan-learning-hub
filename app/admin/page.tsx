'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useLocale } from 'next-intl';
import { ADMIN_FEATURE_LABELS, ADMIN_FEATURES, type AdminFeature } from '@/lib/admin-features';

const destinations: Record<AdminFeature, string> = {
  planner: '/admin/weekly-plans', people: '/admin/people', teacherProgress: '/admin/todays-progress',
  teacherSections: '/admin/teacher-sections', studentMarks: '/admin/student-marks',
  certificates: '/admin/student-certificates', markSchemes: '/admin/mark-schemes',
  quizMarks: '/admin/quiz-marks', studentReports: '/reports', dataBackup: '/admin/backup',
};
const descriptions: Record<AdminFeature, { en: string; ar: string }> = {
  planner: { en: 'Review weekly plans and school planning activity.', ar: 'راجع الخطط الأسبوعية ومتابعة التخطيط المدرسي.' },
  people: { en: 'Manage teacher and student information.', ar: 'إدارة بيانات المعلمين والطلاب.' },
  teacherProgress: { en: 'Follow daily submissions and teacher progress.', ar: 'تابع الإرسالات اليومية وإنجاز المعلمين.' },
  teacherSections: { en: 'Control which tools teachers can use.', ar: 'تحكم في الأدوات المتاحة للمعلمين.' },
  studentMarks: { en: 'Review and manage student marks.', ar: 'راجع درجات الطلاب وأدرها.' },
  certificates: { en: 'Prepare certificates and marks reports.', ar: 'جهّز الشهادات وتقارير الدرجات.' },
  markSchemes: { en: 'Set up the mark structure and grading.', ar: 'أعدّ توزيع الدرجات ونظام التقييم.' },
  quizMarks: { en: 'Review short quiz marks.', ar: 'راجع درجات الاختبارات القصيرة.' },
  studentReports: { en: 'Read and manage student progress reports.', ar: 'اطلع على تقارير تقدم الطلاب وأدرها.' },
  dataBackup: { en: 'Choose data and download a backup file.', ar: 'اختر البيانات ونزّل ملفًا احتياطيًا.' },
};

type Card = { key: AdminFeature | 'customAdmins' | 'teacherSubmission'; href: string; title: string; text: string };

const cardPaint: Record<Card['key'], { gradient: string; accent: string }> = {
  planner: { gradient: 'from-amber-50 via-orange-50/70 to-white', accent: 'text-amber-800' },
  people: { gradient: 'from-emerald-50 via-teal-50/70 to-white', accent: 'text-emerald-800' },
  teacherProgress: { gradient: 'from-lime-50 via-emerald-50/60 to-white', accent: 'text-lime-800' },
  teacherSections: { gradient: 'from-violet-50 via-purple-50/70 to-white', accent: 'text-violet-800' },
  studentMarks: { gradient: 'from-yellow-50 via-amber-50/70 to-white', accent: 'text-amber-800' },
  certificates: { gradient: 'from-purple-50 via-violet-50/70 to-white', accent: 'text-purple-800' },
  markSchemes: { gradient: 'from-teal-50 via-cyan-50/70 to-white', accent: 'text-teal-800' },
  quizMarks: { gradient: 'from-fuchsia-50 via-purple-50/60 to-white', accent: 'text-fuchsia-800' },
  studentReports: { gradient: 'from-stone-50 via-amber-50/50 to-white', accent: 'text-stone-700' },
  dataBackup: { gradient: 'from-green-50 via-lime-50/60 to-white', accent: 'text-green-800' },
  customAdmins: { gradient: 'from-slate-100 via-violet-50/50 to-white', accent: 'text-slate-700' },
  teacherSubmission: { gradient: 'from-orange-50 via-amber-50/60 to-white', accent: 'text-orange-800' },
};

export default function CustomAdminHomePage() {
  const rtl = useLocale() === 'ar';
  const { data: session } = useSession();
  const [features, setFeatures] = useState<AdminFeature[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch('/api/admin/custom-admins/access', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error('Could not load access');
      const result = await response.json();
      if (active) setFeatures(Array.isArray(result.features) ? result.features.filter((value: string): value is AdminFeature => ADMIN_FEATURES.includes(value as AdminFeature)) : []);
    }).catch((cause) => { console.error('[custom-admin-home] Could not load assigned sections.', cause); if (active) setError(true); });
    return () => { active = false; };
  }, []);

  const cards: Card[] = (features ?? []).map((feature) => ({
    key: feature,
    href: destinations[feature],
    title: rtl ? ADMIN_FEATURE_LABELS[feature].ar : ADMIN_FEATURE_LABELS[feature].en,
    text: rtl ? descriptions[feature].ar : descriptions[feature].en,
  }));
  if (features?.includes('teacherProgress')) {
    cards.push({
      key: 'teacherSubmission',
      href: '/admin/teacher-submissions',
      title: rtl ? 'Teacher Submission' : 'Teacher Submission',
      text: rtl ? 'تابع الفصول التي أكمل المعلمون تسليمها والفصول المتبقية.' : 'Track which classes teachers have submitted and what is still missing.',
    });
  }
  if (session?.user?.role === 'ADMIN') {
    cards.push({
      key: 'customAdmins',
      href: '/admin/custom-admins',
      title: rtl ? 'الأدوار الإدارية المخصصة' : 'Custom admin roles',
      text: rtl ? 'أنشئ حسابات إدارية وحدد الأقسام المتاحة لكل حساب.' : 'Create admin accounts and choose which sections each account can access.',
    });
  }
  const cardCount = cards.length;
  const grid = 'grid gap-2.5 sm:grid-cols-2 sm:gap-3 lg:grid-cols-3';

  return (
    <main dir={rtl ? 'rtl' : 'ltr'} className="mx-auto w-full max-w-[1200px] px-4 py-5 sm:px-6 sm:py-7 lg:px-8">
      {/* Welcome */}
      <section className="flex flex-col gap-4 rounded-2xl bg-slate-900 px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            {rtl ? `مرحبًا، ${session?.user?.name || 'بك'}` : `Welcome${session?.user?.name ? `, ${session.user.name}` : ''}`}
          </h1>
          <p className="mt-1.5 max-w-[60ch] text-sm leading-6 text-slate-300 sm:text-[15px]">
            {rtl ? 'اختر القسم الذي تريد العمل عليه. ستظهر هنا الأقسام المتاحة لحسابك فقط.' : 'Choose where you want to work. This page shows only the sections available to your account.'}
          </p>
        </div>
        <div className="inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-semibold ring-1 ring-white/15 sm:self-center">
          <span aria-hidden className="h-2 w-2 rounded-full bg-emerald-400" />
          {features === null && !error
            ? (rtl ? 'جارٍ تحميل الأقسام…' : 'Loading your sections…')
            : rtl ? `${cardCount} أقسام متاحة` : `${cardCount} available ${cardCount === 1 ? 'section' : 'sections'}`}
        </div>
      </section>

      {/* Sections */}
      <h2 className="mb-4 mt-6 text-lg font-bold tracking-tight text-slate-900 sm:mt-8 sm:text-xl">{rtl ? 'ابدأ من هنا' : 'Get started'}</h2>

      {error ? (
        <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-base font-medium leading-7 text-rose-800">
          {rtl ? 'تعذر تحميل الأقسام المتاحة. حدّث الصفحة أو تواصل مع المسؤول.' : 'Could not load your available sections. Refresh the page or contact the administrator.'}
        </div>
      ) : features === null ? (
        <div className={grid} aria-busy="true">
          {[0, 1, 2].map((item) => <div key={item} className="h-32 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
      ) : cardCount === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center">
          <h3 className="text-lg font-bold text-slate-900">{rtl ? 'لا توجد أقسام متاحة' : 'No sections are available'}</h3>
          <p className="mx-auto mt-2 max-w-[44ch] text-base leading-7 text-slate-600">{rtl ? 'اطلب من مسؤول النظام مراجعة صلاحيات حسابك.' : 'Ask the system administrator to review your account permissions.'}</p>
        </div>
      ) : (
        <div className={grid}>
          {cards.map((card) => (
            <Link
              key={card.key}
              href={card.href}
              className={'group flex flex-col rounded-xl border border-white/80 bg-gradient-to-br p-3.5 no-underline shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 sm:p-4 ' + cardPaint[card.key].gradient}
            >
              <h3 className="text-sm font-bold leading-snug text-slate-900 sm:text-base">{card.title}</h3>
              <p className="mt-1 flex-1 text-xs leading-5 text-slate-600">{card.text}</p>
              <span className={'mt-2 inline-flex items-center text-xs font-bold ' + cardPaint[card.key].accent}>
                {rtl ? 'فتح القسم' : 'Open section'}
              </span>
            </Link>
          ))}
        </div>
      )}
    </main>
  );
}
