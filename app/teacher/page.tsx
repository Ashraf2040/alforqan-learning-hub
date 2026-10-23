'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useLocale } from 'next-intl';

type SectionKey = 'weeklyPlans' | 'todaysProgress' | 'studentMarks' | 'quizMarks' | 'studentReports';
type TeacherSections = Record<SectionKey, boolean>;
const sectionDetails: Record<SectionKey, { href: string; title: { en: string; ar: string }; description: { en: string; ar: string } }> = {
  weeklyPlans: { href: '/teacher/weekly-plans', title: { en: 'Weekly plans', ar: 'الخطط الأسبوعية' }, description: { en: 'Prepare and review your weekly teaching plans.', ar: 'أعدّ خططك الأسبوعية وراجعها.' } },
  todaysProgress: { href: '/teacher/todays-progress', title: { en: 'Today’s progress', ar: 'إنجاز اليوم' }, description: { en: 'Record and follow your class progress for today.', ar: 'سجّل وتابع إنجاز حصص اليوم.' } },
  studentMarks: { href: '/teacher/student-marks', title: { en: 'Student marks', ar: 'درجات الطلاب' }, description: { en: 'Enter and review marks for your classes.', ar: 'أدخل درجات طلاب فصولك وراجعها.' } },
  quizMarks: { href: '/teacher/quiz-marks', title: { en: 'Quiz marks', ar: 'درجات الاختبارات القصيرة' }, description: { en: 'Record and review short quiz results.', ar: 'سجّل نتائج الاختبارات القصيرة وراجعها.' } },
  studentReports: { href: '/reports', title: { en: 'Student reports', ar: 'تقارير الطلاب' }, description: { en: 'Write progress reports and recommendations for students.', ar: 'اكتب تقارير تقدم الطلاب وتوصياتهم.' } },
};

export default function TeacherHomePage() {
  const rtl = useLocale() === 'ar';
  const { data: session } = useSession();
  const [sections, setSections] = useState<TeacherSections | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    void fetch('/api/admin/teacher-sections', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error('Could not load teacher sections');
      const result = await response.json();
      if (active) setSections(result.sections as TeacherSections);
    }).catch((cause) => { console.error('[teacher-home] Could not load enabled teacher sections.', cause); if (active) setError(true); });
    return () => { active = false; };
  }, []);

  const available = sections ? (Object.keys(sectionDetails) as SectionKey[]).filter((key) => sections[key]) : [];
  return <main dir={rtl ? 'rtl' : 'ltr'} className="mx-auto w-full max-w-6xl px-4 py-7 sm:px-7 sm:py-10 xl:px-10">
    <section className="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-6 py-8 text-white shadow-xl shadow-slate-900/10 sm:px-10 sm:py-11">
      <div aria-hidden className="absolute -end-16 -top-28 -z-10 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl" />
      <div aria-hidden className="absolute -bottom-32 start-1/3 -z-10 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
      <p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-200">{rtl ? 'مساحة المعلم' : 'TEACHER WORKSPACE'}</p>
      <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">{rtl ? `مرحبًا، ${session?.user?.name || 'بك'}` : `Welcome${session?.user?.name ? `, ${session.user.name}` : ''}`}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300 sm:text-base">{rtl ? 'اختر القسم الذي تريد العمل عليه. ستظهر هنا الأقسام المتاحة لك.' : 'Choose where you want to work. Your enabled sections are ready below.'}</p>
      <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-2 text-sm font-semibold text-white backdrop-blur"><span className="h-2 w-2 rounded-full bg-emerald-400" />{sections === null ? (rtl ? 'جارٍ تحميل الأقسام…' : 'Loading your sections…') : rtl ? `${available.length} أقسام متاحة` : `${available.length} available ${available.length === 1 ? 'section' : 'sections'}`}</div>
    </section>
    <div className="mb-4 mt-9"><p className="text-xs font-bold uppercase tracking-[.16em] text-emerald-800">{rtl ? 'مساحة العمل' : 'YOUR WORKSPACE'}</p><h2 className="mt-1 text-xl font-extrabold text-slate-900 sm:text-2xl">{rtl ? 'ابدأ من هنا' : 'Get started'}</h2></div>
    {error ? <div role="alert" className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-medium text-rose-800">{rtl ? 'تعذر تحميل أقسام المعلم. حدّث الصفحة أو تواصل مع المسؤول.' : 'Could not load your teacher sections. Refresh the page or contact the administrator.'}</div> : sections === null ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((item) => <div key={item} className="h-40 animate-pulse rounded-2xl border border-slate-200 bg-white" />)}</div> : available.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center"><h3 className="font-bold text-slate-800">{rtl ? 'لا توجد أقسام متاحة' : 'No sections are available'}</h3><p className="mt-2 text-sm text-slate-500">{rtl ? 'اطلب من مسؤول النظام تفعيل الأقسام المطلوبة.' : 'Ask the administrator to enable the sections you need.'}</p></div> : <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{available.map((key, index) => <Link key={key} href={sectionDetails[key].href} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition duration-200 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg hover:shadow-emerald-950/5 focus:outline-none focus:ring-4 focus:ring-emerald-100 sm:p-6"><div className="flex items-start justify-between gap-4"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-100 text-sm font-black tracking-wide text-emerald-900 ring-1 ring-emerald-100">{String(index + 1).padStart(2, '0')}</span><span aria-hidden className="text-xl text-slate-300 transition group-hover:text-emerald-700">{rtl ? '←' : '→'}</span></div><h3 className="mt-5 text-lg font-extrabold text-slate-900 group-hover:text-emerald-800">{rtl ? sectionDetails[key].title.ar : sectionDetails[key].title.en}</h3><p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{rtl ? sectionDetails[key].description.ar : sectionDetails[key].description.en}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-emerald-800">{rtl ? 'فتح القسم' : 'Open section'}<span aria-hidden>↗</span></span></Link>)}</div>}
  </main>;
}
