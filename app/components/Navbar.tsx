'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';

export function Navbar() {
  const locale = useLocale();
  const rtl = locale === 'ar';
  const t = useTranslations('nav');
  const { data: session } = useSession();
  const pathname = usePathname();
  function toggleLocale() {
    const next = locale === 'en' ? 'ar' : 'en';
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  }
  const initial = (session?.user?.name ?? '').trim().charAt(0).toUpperCase() || 'A';
  const isLanding = pathname === '/';
  const pageTitle = pathname?.startsWith('/admin') ? (rtl ? 'الإدارة' : 'Administration') : pathname?.startsWith('/teacher') ? (rtl ? 'مساحة المعلم' : 'Teacher workspace') : pathname?.startsWith('/reports') ? (rtl ? 'تقارير الطلاب' : 'Student reports') : t('brand');
  return <header className="no-print sticky top-0 z-40 border-b border-slate-700 bg-slate-900 text-white">
    <nav aria-label={rtl ? 'التنقل الرئيسي' : 'Main navigation'} className="flex min-h-16 w-full items-center justify-between gap-3 px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3"><Link href="/" aria-label={t('brand')} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-blue-600 text-xs font-extrabold tracking-wide text-white no-underline">AF</Link><span className="truncate text-sm font-semibold text-white">{pageTitle}</span></div>
      <div className="flex shrink-0 items-center gap-2">
        {isLanding && <div className="hidden items-center gap-6 text-sm font-semibold text-slate-600 md:flex" dir={rtl ? 'rtl' : 'ltr'}><a href="#platform" className="text-inherit no-underline hover:text-blue-700">{rtl ? 'المزايا' : 'Features'}</a><a href="#how-it-works" className="text-inherit no-underline hover:text-blue-700">{rtl ? 'كيف يعمل' : 'How it works'}</a><a href="#roles" className="text-inherit no-underline hover:text-blue-700">{rtl ? 'للمعلمين' : 'For teachers'}</a><a href="#contact" className="text-inherit no-underline hover:text-blue-700">{rtl ? 'تواصل' : 'Contact'}</a></div>}
        {isLanding && !session && <details className="relative md:hidden"><summary aria-label={rtl ? 'فتح القائمة' : 'Open menu'} className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-lg border border-slate-600 text-xl">☰</summary><div className="absolute end-0 top-12 z-50 grid w-52 gap-1 rounded-xl border border-slate-200 bg-white p-2 text-slate-800 shadow-xl" dir={rtl ? 'rtl' : 'ltr'}><a href="#platform" className="rounded-lg px-3 py-2.5 text-sm text-inherit no-underline hover:bg-slate-50">{rtl ? 'المزايا' : 'Features'}</a><a href="#how-it-works" className="rounded-lg px-3 py-2.5 text-sm text-inherit no-underline hover:bg-slate-50">{rtl ? 'كيف يعمل' : 'How it works'}</a><a href="#roles" className="rounded-lg px-3 py-2.5 text-sm text-inherit no-underline hover:bg-slate-50">{rtl ? 'للمعلمين' : 'For teachers'}</a><a href="#contact" className="rounded-lg px-3 py-2.5 text-sm text-inherit no-underline hover:bg-slate-50">{rtl ? 'تواصل' : 'Contact'}</a><Link href="/login" className="rounded-lg bg-blue-700 px-3 py-2.5 text-sm font-bold text-white no-underline">{rtl ? 'تسجيل الدخول' : 'Sign in'}</Link></div></details>}
        <button type="button" onClick={toggleLocale} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-600 px-3 text-sm font-medium text-slate-100 hover:bg-slate-800" aria-label={rtl ? 'تغيير اللغة' : 'Switch language'}>
          <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.7 3.9 5.7 3.9 9s-1.3 6.3-3.9 9c-2.6-2.7-3.9-5.7-3.9-9S9.4 3.7 12 3Z"/></svg>{t('language')}
        </button>
        {isLanding && !session && <Link href="/login" className="inline-flex min-h-10 items-center justify-center rounded-lg bg-blue-700 px-4 text-sm font-bold text-white no-underline hover:bg-blue-800">{rtl ? 'تسجيل الدخول' : 'Sign in'}</Link>}
        {session && <details className="relative"><summary aria-label={rtl ? 'قائمة المستخدم' : 'User menu'} className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-full bg-white text-sm font-bold text-slate-900 ring-2 ring-slate-600 focus-visible:outline-blue-300">{initial}</summary><div className="absolute end-0 top-12 z-50 w-64 rounded-xl border border-slate-200 bg-white p-2 text-slate-900 shadow-xl" dir={rtl ? 'rtl' : 'ltr'}><div className="border-b border-slate-100 px-3 py-2"><p className="truncate text-sm font-semibold">{session.user?.name}</p><p className="mt-1 text-xs text-slate-500">{session.user?.role}</p></div>{session.user?.role === 'ADMIN' && <Link href="/admin" className="mt-1 block min-h-10 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 no-underline hover:bg-slate-50">{t('admin')}</Link>}{session.user?.role === 'TEACHER' && <Link href="/teacher" className="mt-1 block min-h-10 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 no-underline hover:bg-slate-50">{t('teacher')}</Link>}<button type="button" onClick={() => signOut({ callbackUrl: '/login' })} className="min-h-10 w-full rounded-lg px-3 py-2.5 text-start text-sm font-semibold text-red-700 hover:bg-red-50">{t('signOut')}</button></div></details>}
      </div>
    </nav>
  </header>;
}
