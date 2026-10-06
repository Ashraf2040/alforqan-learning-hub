'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import { useLocale, useTranslations } from 'next-intl';

const navLink = (active: boolean) =>
  `relative rounded-lg px-3 py-2 text-sm font-semibold no-underline transition-colors ${active ? 'bg-emerald-50 text-emerald-900' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'}`;

export function Navbar() {
  const locale = useLocale();
  const t = useTranslations('nav');
  const { data: session } = useSession();
  const pathname = usePathname();
  function toggleLocale() {
    const next = locale === 'en' ? 'ar' : 'en';
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; samesite=lax`;
    window.location.reload();
  }
  const initial = (session?.user?.name ?? '').trim().charAt(0).toUpperCase();
  return <header className="no-print sticky top-0 z-40 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70">
    <div aria-hidden className="h-[3px] bg-gradient-to-r from-[#0d302c] via-[#1d5a50] to-[#c9972f]" />
    <nav aria-label="Main navigation" className="flex w-full items-center justify-between gap-3 px-4 py-2.5 sm:px-7 xl:px-10">
      <Link href="/" className="group flex min-w-0 items-center gap-3 no-underline">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#1d5a50] to-[#0d302c] text-[13px] font-extrabold tracking-wide text-white shadow-md shadow-emerald-950/20 ring-1 ring-white/20 transition-transform group-hover:scale-105">AF</span>
        <span className="min-w-0 leading-tight"><span className="block truncate text-[15px] font-bold text-[#123b36]">{t('brand')}</span><span className="mt-0.5 hidden truncate text-xs font-medium text-slate-500 sm:block">Al Forqan Schools</span></span>
      </Link>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        {session?.user?.role === 'ADMIN' && <Link href="/admin" aria-current={pathname?.startsWith('/admin') ? 'page' : undefined} className={navLink(Boolean(pathname?.startsWith('/admin')))}>{t('admin')}</Link>}
        {session?.user?.role === 'TEACHER' && <Link href="/teacher" aria-current={pathname?.startsWith('/teacher') ? 'page' : undefined} className={navLink(Boolean(pathname?.startsWith('/teacher')))}>{t('teacher')}</Link>}
        <span aria-hidden className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />
        <button type="button" onClick={toggleLocale} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:border-emerald-700/40 hover:bg-emerald-50 hover:text-emerald-900">
          <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.7 3.9 5.7 3.9 9s-1.3 6.3-3.9 9c-2.6-2.7-3.9-5.7-3.9-9S9.4 5.7 12 3Z" /></svg>
          {t('language')}
        </button>
        {session && <>
          {initial && <span aria-hidden title={session.user?.name ?? undefined} className="hidden h-9 w-9 place-items-center rounded-full bg-emerald-100 text-sm font-bold text-emerald-900 ring-2 ring-white sm:grid">{initial}</span>}
          <button type="button" onClick={() => signOut({ callbackUrl: '/login' })} aria-label={t('signOut')} className="inline-flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-semibold text-slate-500 hover:bg-rose-50 hover:text-rose-700 sm:px-3">
            <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 rtl:-scale-x-100" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H4" /></svg>
            <span className="hidden sm:inline">{t('signOut')}</span>
          </button>
        </>}
      </div>
    </nav>
  </header>;
}
