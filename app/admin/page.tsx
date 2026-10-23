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

  const cards = (features ?? []).map((feature, index) => ({ feature, index }));
  const cardCount = cards.length + (session?.user?.role === 'ADMIN' ? 1 : 0);
  return <main dir={rtl ? 'rtl' : 'ltr'} className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-7 sm:py-10 xl:px-10">
    <section className="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-8 text-white shadow-xl shadow-slate-900/10 sm:px-10 sm:py-11">
      <div aria-hidden className="absolute -end-16 -top-28 -z-10 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
      <div aria-hidden className="absolute -bottom-32 start-1/3 -z-10 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
      <p className="text-xs font-bold uppercase tracking-[.2em] text-blue-200">{rtl ? 'مساحة العمل' : 'YOUR WORKSPACE'}</p>
      <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{rtl ? `مرحبًا، ${session?.user?.name || 'بك'}` : `Welcome${session?.user?.name ? `, ${session.user.name}` : ''}`}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">{rtl ? 'اختر القسم الذي تريد العمل عليه. ستظهر هنا الأقسام المتاحة لحسابك فقط.' : 'Choose where you want to work. This page shows only the sections available to your account.'}</p>
      <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur"><span className="h-2 w-2 rounded-full bg-emerald-400" />{features === null ? (rtl ? 'جارٍ تحميل الأقسام…' : 'Loading your sections…') : rtl ? `${cardCount} أقسام متاحة` : `${cardCount} available ${cardCount === 1 ? 'section' : 'sections'}`}</div>
    </section>

    <div className="mb-4 mt-9 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[.16em] text-blue-700">{rtl ? 'الأقسام المخصصة لك' : 'YOUR SECTIONS'}</p><h2 className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">{rtl ? 'ابدأ من هنا' : 'Get started'}</h2></div></div>
    {error ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-medium text-rose-800">{rtl ? 'تعذر تحميل الأقسام المتاحة. حدّث الصفحة أو تواصل مع المسؤول.' : 'Could not load your available sections. Refresh the page or contact the administrator.'}</div> : features === null ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}</div> : cardCount === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center"><h3 className="font-bold text-slate-800">{rtl ? 'لا توجد أقسام متاحة' : 'No sections are available'}</h3><p className="mt-2 text-sm text-slate-500">{rtl ? 'اطلب من مسؤول النظام مراجعة صلاحيات حسابك.' : 'Ask the system administrator to review your account permissions.'}</p></div> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{cards.map(({ feature, index }) => <Link key={feature} href={destinations[feature]} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-950/5 focus:outline-none focus:ring-4 focus:ring-blue-100 sm:p-6">
      <div className="flex items-start justify-between gap-4"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-blue-50 to-indigo-100 text-sm font-black tracking-wide text-blue-800 ring-1 ring-blue-100">{String(index + 1).padStart(2, '0')}</span><span aria-hidden className="text-xl text-slate-300 transition group-hover:text-blue-700">{rtl ? '←' : '→'}</span></div>
      <h3 className="mt-5 text-lg font-extrabold text-slate-900 group-hover:text-blue-800">{rtl ? ADMIN_FEATURE_LABELS[feature].ar : ADMIN_FEATURE_LABELS[feature].en}</h3>
      <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{rtl ? descriptions[feature].ar : descriptions[feature].en}</p>
      <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-blue-700">{rtl ? 'فتح القسم' : 'Open section'}<span aria-hidden>↗</span></span>
    </Link>)}{session?.user?.role === 'ADMIN' && <Link href="/admin/custom-admins" className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-blue-200 hover:shadow-lg hover:shadow-blue-950/5 focus:outline-none focus:ring-4 focus:ring-blue-100 sm:p-6"><div className="flex items-start justify-between gap-4"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-100 text-xl font-black text-violet-800 ring-1 ring-violet-100">✦</span><span aria-hidden className="text-xl text-slate-300 transition group-hover:text-blue-700">{rtl ? '←' : '→'}</span></div><h3 className="mt-5 text-lg font-extrabold text-slate-900 group-hover:text-blue-800">{rtl ? 'الأدوار الإدارية المخصصة' : 'Custom admin roles'}</h3><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{rtl ? 'أنشئ حسابات إدارية وحدد الأقسام المتاحة لكل حساب.' : 'Create admin accounts and choose which sections each account can access.'}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-blue-700">{rtl ? 'فتح القسم' : 'Open section'}<span aria-hidden>↗</span></span></Link>}</div>}
  </main>;
}
