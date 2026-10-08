'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

export function WorkspaceSidebar() {
  const { data } = useSession();
  const pathname = usePathname();
  const t = useTranslations('nav');
  const [teacherSections, setTeacherSections] = useState({ weeklyPlans: true, todaysProgress: true, studentReports: true, studentMarks: true, quizMarks: true });
  const role = data?.user?.role;
  useEffect(() => {
    if (role !== 'TEACHER') return;
    let live = true;
    void fetch('/api/admin/teacher-sections', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).then((result) => { if (live && result?.sections) setTeacherSections((current) => ({ ...current, ...result.sections })); }).catch(() => undefined);
    return () => { live = false; };
  }, [role]);
  if ((role !== 'ADMIN' && role !== 'TEACHER' && role !== 'COORDINATOR') || pathname === '/' || pathname === '/login') return null;
  const links = role === 'ADMIN'
    ? [{ href: '/admin', label: t('weeklyPlannerAdmin'), icon: '▤' }, { href: '/admin/todays-progress', label: t('todayProgress'), icon: '◷' }, { href: '/admin/people', label: t('people'), icon: '♙' }, { href: '/reports', label: t('studentReports'), icon: '▧' }, { href: '/admin/student-marks', label: t('studentMarks'), icon: '∑' }, { href: '/admin/mark-schemes', label: t('markSchemes'), icon: '☷' }, { href: '/admin/quiz-marks', label: t('quizMarks'), icon: '✓' }, { href: '/admin/teacher-sections', label: t('teacherSections'), icon: '☷' }]
    : role === 'COORDINATOR' ? [{ href: '/admin/mark-schemes', label: t('markSchemes'), icon: '☷' }]
    : [{ href: '/teacher', label: t('weeklyPlans'), icon: '▤', enabled: teacherSections.weeklyPlans }, { href: '/teacher/todays-progress', label: t('todayProgress'), icon: '◷', enabled: teacherSections.todaysProgress }, { href: '/reports', label: t('classReports'), icon: '▧', enabled: teacherSections.studentReports }, { href: '/teacher/student-marks', label: t('studentMarks'), icon: '∑', enabled: teacherSections.studentMarks }, { href: '/teacher/quiz-marks', label: t('quizMarks'), icon: '✓', enabled: teacherSections.quizMarks }].filter((item) => item.enabled);
  return <aside aria-label="Workspace sections" className="no-print z-30 shrink-0 border-b border-slate-200/80 bg-[#fbfcfb] px-3 py-2.5 shadow-[0_8px_24px_-24px_rgba(15,45,40,.5)] md:sticky md:top-[68px] md:h-[calc(100vh-68px)] md:w-64 md:border-b-0 md:border-e md:border-slate-200/80 md:px-4 md:py-6 md:shadow-[8px_0_30px_-30px_rgba(15,45,40,.35)]">
    <div className="mb-7 hidden items-center gap-3 rounded-2xl bg-gradient-to-br from-[#102f36] via-[#164e54] to-[#287b78] px-3.5 py-4 text-white shadow-lg shadow-teal-950/15 ring-1 ring-white/30 md:flex"><span aria-hidden className="grid h-10 w-10 place-items-center rounded-xl bg-white/15 text-sm font-black tracking-wide ring-1 ring-white/20">AF</span><span><span className="block text-sm font-extrabold tracking-wide">{t('brand')}</span><span className="mt-0.5 block text-[11px] font-medium text-teal-100">Al Forqan Schools</span></span></div>
    <p className="mb-2 hidden px-3 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 md:block">Workspace</p>
    <nav aria-label="Workspace sections" className="flex gap-1 overflow-x-auto md:flex-col md:gap-2">{links.map((item) => {
      const isDashboardRoot = item.href === '/admin' || item.href === '/teacher';
      const active = isDashboardRoot ? pathname === item.href : pathname === item.href || pathname?.startsWith(`${item.href}/`);
      return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`group flex shrink-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-sm font-semibold no-underline transition md:w-full md:px-3.5 ${active ? 'border-emerald-100 bg-emerald-50 text-emerald-950 shadow-sm' : 'border-transparent text-slate-600 hover:border-slate-100 hover:bg-slate-50 hover:text-slate-950'}`}><span aria-hidden className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-base ${active ? 'bg-white text-emerald-900 shadow-sm' : 'bg-slate-100 text-slate-500 group-hover:bg-white group-hover:text-emerald-800'}`}>{item.icon}</span><span>{item.label}</span>{active && <span aria-hidden className="ms-auto hidden h-1.5 w-1.5 rounded-full bg-emerald-700 md:block" />}</Link>;
    })}</nav>
    <div className="mt-8 hidden border-t border-slate-100 px-3 pt-4 text-[11px] font-medium leading-5 text-slate-400 md:block">{t('sidebarFooter')}</div>
  </aside>;
}
