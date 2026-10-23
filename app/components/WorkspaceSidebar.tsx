'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { AdminFeature } from '@/lib/admin-features';

type LinkItem = { href: string; label: string; icon: 'plan' | 'clock' | 'people' | 'report' | 'marks' | 'certificate' | 'setup' | 'quiz' | 'settings' | 'backup'; enabled?: boolean };
const Icon = ({ name }: { name: LinkItem['icon'] }) => {
  const paths: Record<LinkItem['icon'], React.ReactNode> = {
    plan: <><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h3"/></>,
    clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
    people: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M10 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></>,
    report: <><path d="M4 3h12l4 4v14H4zM16 3v5h5M8 13h8M8 17h8M8 9h3"/></>,
    marks: <><path d="M4 5h16M4 12h16M4 19h16M8 3v4M16 10v4M10 17v4"/></>,
    certificate: <><path d="M5 3h14v18l-7-4-7 4zM8 8h8M8 11h8"/></>,
    setup: <><path d="M4 5h16M4 12h16M4 19h16"/><circle cx="9" cy="5" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="7" cy="19" r="2"/></>,
    quiz: <><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></>,
    settings: <><circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.5.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.5-.9l-1.7.6-1.4-2.4 1.4-1.1a8 8 0 0 1 0-1.8l-1.4-1.1 1.4-2.4 1.7.6a8 8 0 0 1 1.5-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.5.9l1.7-.6 1.4 2.4-1.4 1.1a8 8 0 0 1 0 1.8Z"/></>,
    backup: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></>,
  };
  return <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
};

export function WorkspaceSidebar() {
  const { data } = useSession();
  const pathname = usePathname();
  const locale = useLocale();
  const rtl = locale === 'ar';
  const t = useTranslations('nav');
  const [teacherSections, setTeacherSections] = useState({ weeklyPlans: true, todaysProgress: true, studentReports: true, studentMarks: true, quizMarks: true });
  const [customAdminFeatures, setCustomAdminFeatures] = useState<AdminFeature[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const role = data?.user?.role;
  useEffect(() => {
    setCollapsed(localStorage.getItem('workspace-sidebar-collapsed') === 'true');
    if (role !== 'TEACHER') return;
    let live = true;
    void fetch('/api/admin/teacher-sections', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).then((result) => { if (live && result?.sections) setTeacherSections((current) => ({ ...current, ...result.sections })); }).catch(() => undefined);
    return () => { live = false; };
  }, [role]);
  useEffect(() => {
    if (role !== 'CUSTOM_ADMIN') return;
    let live = true;
    void fetch('/api/admin/custom-admins/access', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).then((result) => { if (live && result?.features) setCustomAdminFeatures(result.features); }).catch(() => undefined);
    return () => { live = false; };
  }, [role]);
  if ((role !== 'ADMIN' && role !== 'CUSTOM_ADMIN' && role !== 'TEACHER' && role !== 'COORDINATOR') || pathname === '/' || pathname === '/login') return null;
  const allAdminGroups: { title: string; links: (LinkItem & { feature: AdminFeature })[] }[] = [
    { title: rtl ? 'التخطيط' : 'Planning', links: [{ href: '/admin/weekly-plans', label: t('weeklyPlannerAdmin'), icon: 'plan', feature: 'planner' }, { href: '/admin/todays-progress', label: t('todayProgress'), icon: 'clock', feature: 'teacherProgress' }] },
    { title: rtl ? 'الأشخاص' : 'People', links: [{ href: '/admin/people', label: t('people'), icon: 'people', feature: 'people' }, { href: '/admin/teacher-sections', label: t('teacherSections'), icon: 'settings', feature: 'teacherSections' }] },
    { title: rtl ? 'الدراسة' : 'Academics', links: [{ href: '/admin/student-marks', label: t('studentMarks'), icon: 'marks', feature: 'studentMarks' }, { href: '/admin/student-certificates', label: rtl ? 'الشهادات والدرجات' : 'Certificates', icon: 'certificate', feature: 'certificates' }, { href: '/admin/mark-schemes', label: rtl ? 'إعداد الدرجات' : 'Marks setup', icon: 'setup', feature: 'markSchemes' }, { href: '/admin/quiz-marks', label: t('quizMarks'), icon: 'quiz', feature: 'quizMarks' }] },
    { title: rtl ? 'التقارير' : 'Reports', links: [{ href: '/reports', label: t('studentReports'), icon: 'report', feature: 'studentReports' }] },
    { title: rtl ? 'إدارة البيانات' : 'Data management', links: [{ href: '/admin/backup', label: rtl ? 'نسخ احتياطي للبيانات' : 'Data backup', icon: 'backup', feature: 'dataBackup' }] },
  ];
  const visibleAdminGroups = allAdminGroups.map((group) => ({ ...group, links: group.links.filter((link) => role === 'ADMIN' || customAdminFeatures.includes(link.feature)) })).filter((group) => group.links.length > 0);
  const groups: { title: string; links: LinkItem[] }[] = role === 'ADMIN' || role === 'CUSTOM_ADMIN' ? [
    { title: rtl ? 'الرئيسية' : 'Home', links: [{ href: '/admin', label: rtl ? 'لوحة البداية' : 'Dashboard', icon: 'plan' as const }] },
    ...(role === 'ADMIN' ? [{ title: rtl ? 'إدارة الحسابات' : 'Account management', links: [{ href: '/admin/custom-admins', label: rtl ? 'الأدوار المخصصة' : 'Custom admin roles', icon: 'people' as const }] }] : []),
    ...visibleAdminGroups,
  ] : role === 'COORDINATOR' ? [{ title: rtl ? 'الدراسة' : 'Academics', links: [{ href: '/admin/mark-schemes', label: t('markSchemes'), icon: 'setup' }] }] : [{ title: rtl ? 'مساحة العمل' : 'Workspace', links: ([
    { href: '/teacher', label: rtl ? 'لوحة البداية' : 'Dashboard', icon: 'plan' }, { href: '/teacher/weekly-plans', label: t('weeklyPlans'), icon: 'plan', enabled: teacherSections.weeklyPlans }, { href: '/teacher/todays-progress', label: t('todayProgress'), icon: 'clock', enabled: teacherSections.todaysProgress }, { href: '/teacher/student-marks', label: t('studentMarks'), icon: 'marks', enabled: teacherSections.studentMarks }, { href: '/teacher/quiz-marks', label: t('quizMarks'), icon: 'quiz', enabled: teacherSections.quizMarks }, { href: '/reports', label: t('classReports'), icon: 'report', enabled: teacherSections.studentReports },
  ] as LinkItem[]).filter((item) => item.enabled) }];
  function toggleCollapsed() { setCollapsed((value) => { localStorage.setItem('workspace-sidebar-collapsed', String(!value)); return !value; }); }
  return <aside aria-label={rtl ? 'أقسام مساحة العمل' : 'Workspace sections'} className={`no-print z-30 w-full shrink-0 border-b border-slate-200 bg-white px-3 py-2 md:sticky md:top-16 md:h-[calc(100vh-64px)] md:border-b-0 md:border-e md:px-3 md:py-5 ${collapsed ? 'md:w-[76px]' : 'md:w-64'}`}>
    <div className="flex items-center justify-between md:hidden"><span className="px-2 text-xs font-bold text-slate-500">{rtl ? 'القائمة' : 'Workspace'}</span><button type="button" aria-expanded={mobileOpen} onClick={() => setMobileOpen((value) => !value)} className="min-h-10 rounded-lg border border-slate-200 px-3 text-sm font-semibold text-slate-700">{mobileOpen ? (rtl ? 'إغلاق' : 'Close') : (rtl ? 'القائمة' : 'Menu')}</button></div>
    <div className={`${mobileOpen ? 'flex' : 'hidden'} gap-1 overflow-x-auto py-1 md:flex md:flex-col md:overflow-visible md:py-0`}>
      <div className="hidden justify-end md:flex"><button type="button" title={collapsed ? (rtl ? 'توسيع القائمة' : 'Expand sidebar') : (rtl ? 'طي القائمة' : 'Collapse sidebar')} aria-label={collapsed ? (rtl ? 'توسيع القائمة' : 'Expand sidebar') : (rtl ? 'طي القائمة' : 'Collapse sidebar')} onClick={toggleCollapsed} className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-blue-700"><span aria-hidden className="text-xl">{collapsed ? '»' : '«'}</span></button></div>
      {groups.map((group) => <section key={group.title} className="min-w-max md:min-w-0 md:pt-3"><h2 className={`hidden px-3 pb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500 md:block ${collapsed ? 'md:sr-only' : ''}`}>{group.title}</h2><nav aria-label={group.title} className="flex gap-1 md:flex-col">{group.links.map((item) => {
        const active = item.href === '/admin' || item.href === '/teacher' ? pathname === item.href : pathname === item.href || pathname?.startsWith(`${item.href}/`);
        return <Link key={item.href} href={item.href} onClick={() => setMobileOpen(false)} title={collapsed ? item.label : undefined} aria-current={active ? 'page' : undefined} className={`group relative flex min-h-10 shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium no-underline transition-colors md:w-full ${collapsed ? 'md:justify-center md:px-0' : ''} ${active ? 'bg-blue-50 text-blue-800 before:absolute before:inset-y-2 before:start-0 before:w-[3px] before:rounded-full before:bg-blue-700' : 'text-slate-700 hover:bg-slate-100 hover:text-slate-950'}`}><Icon name={item.icon}/><span className={`whitespace-nowrap ${collapsed ? 'md:hidden' : ''}`}>{item.label}</span></Link>;
      })}</nav></section>)}
    </div>
  </aside>;
}
