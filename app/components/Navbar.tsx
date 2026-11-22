'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';

export function Navbar() {
  const locale = useLocale();
  const rtl = locale === 'ar';
  const t = useTranslations('nav');
  const landing = useTranslations('landing');
  const { data: session } = useSession();
  const pathname = usePathname();
  const isLanding = pathname === '/';
  function toggleLocale() {
    const next = locale === 'en' ? 'ar' : 'en';
    document.cookie = 'NEXT_LOCALE=' + next + '; path=/; max-age=31536000; samesite=lax';
    window.location.reload();
  }
  const initial = (session?.user?.name ?? '').trim().charAt(0).toUpperCase() || 'A';
  const title = pathname?.startsWith('/admin') ? (rtl ? 'الإدارة' : 'Administration') : pathname?.startsWith('/teacher') ? (rtl ? 'مساحة المعلم' : 'Teacher workspace') : pathname?.startsWith('/reports') ? (rtl ? 'تقارير الطلاب' : 'Student reports') : t('brand');
  const links = [
    { href: '#platform', label: landing('navFeatures') },
    { href: '#how-it-works', label: landing('navHowItWorks') },
    { href: '#roles', label: landing('navTeachers') },
    { href: '#contact', label: landing('navContact') },
  ];
  return <header className="no-print sticky top-0 z-40 border-b border-slate-200 bg-white/95 text-slate-900 backdrop-blur">
    <nav aria-label={rtl ? 'التنقل الرئيسي' : 'Main navigation'} className="mx-auto flex h-16 w-full max-w-[1200px] items-center justify-between gap-3 px-5 sm:px-8 lg:px-10">
      <div className="flex min-w-0 items-center gap-2.5">
        <Link href="/" aria-label={t('brand')} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-slate-900 text-xs font-extrabold tracking-wide text-white no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900">AF</Link>
        <span className="hidden truncate text-sm font-semibold text-slate-900 sm:inline">{isLanding ? t('brand') : title}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isLanding && <div className="hidden items-center gap-1 lg:flex" dir={rtl ? 'rtl' : 'ltr'}>{links.map((link) => <a key={link.href} href={link.href} className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 no-underline transition-colors hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900">{link.label}</a>)}</div>}
        {isLanding && <details className="relative lg:hidden">
          <summary aria-label={landing('mobileMenuLabel')} className="grid h-11 w-11 cursor-pointer list-none place-items-center rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900"><svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg></summary>
          <div className="fixed end-3 top-16 z-50 grid w-[min(18rem,calc(100vw-1.5rem))] gap-1 rounded-xl border border-slate-200 bg-white p-2 shadow-lg lg:absolute lg:end-0 lg:top-12" dir={rtl ? 'rtl' : 'ltr'}>{links.map((link) => <a key={link.href} href={link.href} className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-700 no-underline hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900">{link.label}</a>)}</div>
        </details>}
        <button type="button" onClick={toggleLocale} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900" aria-label={rtl ? 'تغيير اللغة' : 'Switch language'}>
          <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></svg>{t('language')}
        </button>
        {isLanding && !session && <Link href="/login" className="inline-flex h-10 items-center justify-center rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white no-underline hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 sm:px-4">{landing('navSignIn')}</Link>}
        {session && <details className="relative">
          <summary aria-label={rtl ? 'قائمة المستخدم' : 'User menu'} className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full bg-slate-100 text-sm font-bold text-slate-900 ring-1 ring-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900">{initial}</summary>
          <div className="absolute end-0 top-12 z-50 w-64 rounded-xl border border-slate-200 bg-white p-2 text-slate-900 shadow-lg" dir={rtl ? 'rtl' : 'ltr'}>
            <div className="border-b border-slate-100 px-3 py-2"><p className="truncate text-sm font-semibold">{session.user?.name}</p><p className="mt-1 text-xs text-slate-500">{session.user?.role === 'CUSTOM_ADMIN' ? (rtl ? 'مدير بصلاحيات مخصصة' : 'Custom administrator') : session.user?.role}</p></div>
            {['ADMIN', 'CUSTOM_ADMIN'].includes(session.user?.role ?? '') && <Link href="/admin" className="mt-1 flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-700 no-underline hover:bg-slate-50">{t('admin')}</Link>}
            {session.user?.role === 'TEACHER' && <Link href="/teacher" className="mt-1 flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-700 no-underline hover:bg-slate-50">{t('teacher')}</Link>}
            <button type="button" onClick={() => signOut({ callbackUrl: '/login' })} className="min-h-11 w-full rounded-lg px-3 py-2 text-start text-sm font-semibold text-red-700 hover:bg-red-50">{t('signOut')}</button>
          </div>
        </details>}
      </div>
    </nav>
  </header>;
}
