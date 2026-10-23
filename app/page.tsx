import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';

function Icon({ name }: { name: 'plan' | 'progress' | 'reports' | 'arrow' | 'marks' }) {
  const paths = {
    plan: <><path d="M8 3v3M16 3v3M4 8h16" /><rect x="3" y="5" width="18" height="16" rx="3" /><path d="m8 14 2.3 2.3L16 11" /></>,
    progress: <><path d="M4 19V5M4 19h17" /><path d="m7 14 4-4 3 2 6-7" /><path d="M17 5h3v3" /></>,
    reports: <><path d="M7 3h8l4 4v14H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z" /><path d="M15 3v5h5M8 12h7M8 16h7" /></>,
    marks: <><path d="M4 5h16M4 12h16M4 19h16"/><circle cx="8" cy="5" r="2" fill="currentColor"/><circle cx="15" cy="12" r="2" fill="currentColor"/><circle cx="10" cy="19" r="2" fill="currentColor"/></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  };
  return <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">{paths[name]}</svg>;
}

export default async function Home() {
  const t = await getTranslations('landing');
  const session = await getServerSession(authOptions);
  const workspace = ['ADMIN', 'CUSTOM_ADMIN'].includes(session?.user.role ?? '') ? '/admin' : '/teacher';
  return <main id="main-content" className="overflow-hidden text-slate-900">
    <a href="#platform" className="sr-only z-50 rounded-lg bg-white px-4 py-3 text-blue-800 focus:not-sr-only focus:fixed focus:start-4 focus:top-4">{t('secondaryCta')}</a>
    <section className="relative isolate overflow-hidden border-b border-slate-200 bg-[radial-gradient(ellipse_at_78%_18%,rgba(219,234,254,.9),transparent_34%),linear-gradient(135deg,#f8fafc_0%,#fff_55%,#f1f5f9_100%)]">
      <div aria-hidden className="pointer-events-none absolute -end-24 top-16 h-72 w-72 rounded-full bg-blue-200/30 blur-3xl sm:h-96 sm:w-96" />
      <div className="relative mx-auto grid w-full max-w-[1280px] items-center gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-2 lg:gap-12 lg:px-8 lg:py-20 xl:px-10 xl:py-24">
        <div className="relative z-10 min-w-0 max-w-2xl lg:justify-self-end">
          <p className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white/90 px-3.5 py-2 text-xs font-bold tracking-wide text-slate-700 shadow-sm sm:text-sm"><span aria-hidden className="grid h-5 w-5 place-items-center rounded-full bg-blue-50 text-blue-700">✓</span>{t('eyebrow')}</p>
          <h1 className="mt-6 max-w-[15ch] text-[clamp(2.15rem,5vw,4.4rem)] font-bold leading-[1.04] tracking-[-.05em] text-[#182230]">{t('title')}</h1>
          <p className="mt-5 max-w-[52ch] text-base leading-7 text-slate-600 sm:text-xl sm:leading-8">{t('intro')}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href={session ? workspace : '/login'} className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-blue-700 px-5 py-3 text-sm font-bold text-white no-underline transition hover:-translate-y-0.5 hover:bg-blue-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">{session ? t('primaryCta') : t('signedOutCta')}<span className="transition-transform group-hover:translate-x-0.5 rtl:rotate-180 rtl:group-hover:-translate-x-0.5"><Icon name="arrow" /></span></Link>
            <a href="#platform" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 no-underline transition hover:border-blue-300 hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">{t('secondaryCta')}</a>
          </div>
          <div className="mt-9 flex flex-col gap-2 border-t border-slate-200/80 pt-5 text-sm font-semibold text-slate-600 sm:flex-row sm:flex-wrap sm:gap-x-6"><span className="inline-flex items-center gap-2"><span className="text-blue-700">✓</span>{t('featurePlanTitle')}</span><span className="inline-flex items-center gap-2"><span className="text-blue-700">✓</span>{t('featureProgressTitle')}</span><span className="inline-flex items-center gap-2"><span className="text-blue-700">✓</span>{t('featureReportsTitle')}</span></div>
        </div>

        <div className="relative mx-auto w-full max-w-[640px] min-w-0 lg:justify-self-start" role="img" aria-label={t('dashboardCaption')}>
          <div className="relative rounded-2xl border border-white/80 bg-white/80 p-2 shadow-[0_32px_80px_-42px_rgba(15,23,42,.4)] ring-1 ring-slate-900/5 backdrop-blur sm:rounded-3xl sm:p-3">
            <div className="overflow-hidden rounded-[1.25rem] border border-slate-200/90 bg-gradient-to-br from-slate-50 to-white sm:rounded-[1.5rem]">
              <div className="grid gap-3 p-3 sm:gap-4 sm:p-5">
                <div className="min-w-0 space-y-3 sm:space-y-4">
                  <div><p className="text-xs font-bold text-blue-700 sm:text-sm">{t('dashboardLabel')}</p><h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900 sm:text-2xl">{t('dashboardTitle')}</h2></div>
                  <p className="-mt-1 text-sm leading-6 text-slate-600">{t('dashboardCaption')}</p>
                  <div className="grid grid-cols-2 gap-3"><article className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:rounded-2xl sm:p-4"><div className="flex items-center justify-between"><span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-700"><Icon name="plan"/></span><span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-bold text-blue-800">{t('weekLabel')}</span></div><p className="mt-3 text-sm text-slate-600">{t('weekLabel')}</p><p className="mt-1 text-base font-bold text-slate-900">{t('weekValue')}</p></article>
                    <article className="min-w-0 rounded-xl border border-slate-200 bg-white p-3 sm:rounded-2xl sm:p-4"><div className="flex items-center justify-between"><span className="grid h-9 w-9 place-items-center rounded-lg bg-blue-50 text-blue-700"><Icon name="progress"/></span><span className="text-xs font-bold text-blue-800">{t('progressPercent')}</span></div><p className="mt-3 text-sm text-slate-600">{t('progressValue')}</p><p className="mt-1 text-base font-bold text-slate-900">{t('progressCount')}</p><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full w-4/5 rounded-full bg-blue-700"/></div><p className="mt-1.5 text-xs text-slate-500">{t('progressFootnote')}</p></article></div>
                  <article className="rounded-xl border border-slate-200 bg-white p-3 sm:rounded-2xl sm:p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs font-semibold text-slate-500">{t('classLabel')}</p><p className="mt-1 text-sm font-bold text-slate-900 sm:text-base">{t('classValue')}</p></div><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-50 text-blue-700"><Icon name="reports"/></span></div><p className="mt-2 border-t border-slate-100 pt-2 text-sm text-slate-600">{t('classFootnote')}</p></article>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section id="platform" className="scroll-mt-20 mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
      <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-800">{t('sectionEyebrow')}</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.04em] text-[#222831] sm:text-4xl">{t('sectionTitle')}</h2><p className="mt-4 text-base leading-7 text-slate-600">{t('sectionIntro')}</p></div>
      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-5">
        {(['plan','progress','reports','marks'] as const).map((name) => {
          const title = name === 'plan' ? t('featurePlanTitle') : name === 'progress' ? t('featureProgressTitle') : name === 'reports' ? t('featureReportsTitle') : t('featureMarksTitle');
          const copy = name === 'plan' ? t('featurePlanText') : name === 'progress' ? t('featureProgressText') : name === 'reports' ? t('featureReportsText') : t('featureMarksText');
          return <article key={name} className="group rounded-2xl border border-slate-200 bg-white p-6 transition motion-safe:hover:-translate-y-1 hover:border-blue-200 sm:p-7"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-blue-50 text-blue-800 transition group-hover:bg-blue-700 group-hover:text-white"><Icon name={name}/></span><h3 className="mt-5 text-lg font-bold text-slate-900">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p></article>;
        })}
      </div>
    </section>

    <section id="how-it-works" className="scroll-mt-20 border-y border-slate-200 bg-white">
      <div className="mx-auto w-full max-w-[1200px] px-5 py-14 sm:px-8 sm:py-16 lg:px-10 lg:py-20"><div className="max-w-2xl"><p className="text-xs font-bold uppercase tracking-[.18em] text-blue-700">{t('stepsEyebrow')}</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.04em] text-[#222831] sm:text-4xl">{t('stepsTitle')}</h2></div><div className="mt-8 grid gap-4 md:grid-cols-3"><article className="rounded-2xl bg-slate-50 p-6"><span className="grid h-10 w-10 place-items-center rounded-full bg-blue-700 text-sm font-bold text-white">{t('stepOneNumber')}</span><h3 className="mt-4 font-bold text-slate-900">{t('stepOneTitle')}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{t('stepOneText')}</p></article><article className="rounded-2xl bg-slate-50 p-6"><span className="grid h-10 w-10 place-items-center rounded-full bg-blue-700 text-sm font-bold text-white">{t('stepTwoNumber')}</span><h3 className="mt-4 font-bold text-slate-900">{t('stepTwoTitle')}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{t('stepTwoText')}</p></article><article className="rounded-2xl bg-slate-50 p-6"><span className="grid h-10 w-10 place-items-center rounded-full bg-blue-700 text-sm font-bold text-white">{t('stepThreeNumber')}</span><h3 className="mt-4 font-bold text-slate-900">{t('stepThreeTitle')}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{t('stepThreeText')}</p></article></div></div>
    </section>
    <section id="roles" className="scroll-mt-20 border-y border-slate-200 bg-[#f8fafc]">
      <div className="mx-auto grid w-full max-w-[1280px] gap-8 px-5 py-14 sm:px-8 sm:py-16 md:grid-cols-[.8fr_1.2fr] md:items-center lg:px-12 lg:py-20"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-800">{t('rolesEyebrow')}</p><h2 className="mt-3 max-w-md text-3xl font-semibold tracking-[-.04em] text-[#222831] sm:text-4xl">{t('rolesTitle')}</h2></div><div className="grid gap-3 sm:grid-cols-2"><article className="rounded-2xl border border-white bg-white/80 p-5 shadow-sm sm:p-6"><p className="text-sm font-bold text-emerald-900">{t('teacherRole')}</p><p className="mt-2 text-sm leading-6 text-slate-600">{t('teacherRoleText')}</p></article><article className="rounded-2xl border border-white bg-white/80 p-5 shadow-sm sm:p-6"><p className="text-sm font-bold text-emerald-900">{t('adminRole')}</p><p className="mt-2 text-sm leading-6 text-slate-600">{t('adminRoleText')}</p></article></div></div>
    </section>

    <section id="faq" className="scroll-mt-20 mx-auto w-full max-w-[900px] px-5 py-14 sm:px-8 sm:py-16"><h2 className="text-3xl font-semibold tracking-tight text-[#222831]">{t('faqTitle')}</h2><div className="mt-6 divide-y divide-slate-200 border-y border-slate-200"><details className="py-4"><summary className="cursor-pointer font-semibold text-slate-900">{t('faqOneQuestion')}</summary><p className="mt-3 text-sm leading-6 text-slate-600">{t('faqOneAnswer')}</p></details><details className="py-4"><summary className="cursor-pointer font-semibold text-slate-900">{t('faqTwoQuestion')}</summary><p className="mt-3 text-sm leading-6 text-slate-600">{t('faqTwoAnswer')}</p></details><details className="py-4"><summary className="cursor-pointer font-semibold text-slate-900">{t('faqThreeQuestion')}</summary><p className="mt-3 text-sm leading-6 text-slate-600">{t('faqThreeAnswer')}</p></details></div></section>
    <section id="contact" className="scroll-mt-20 px-5 py-12 sm:px-8"><div className="mx-auto flex max-w-[1100px] flex-col items-start justify-between gap-6 rounded-3xl bg-[#222831] px-6 py-8 text-white sm:px-9 sm:py-10 md:flex-row md:items-center"><div className="max-w-2xl"><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('closingTitle')}</h2><p className="mt-2 text-sm leading-6 text-slate-200 sm:text-base">{t('closingText')}</p></div><Link href={session ? workspace : '/login'} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-3 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white no-underline transition hover:bg-blue-500">{session ? t('primaryCta') : t('signedOutCta')}<Icon name="arrow"/></Link></div></section>
    <footer className="border-t border-slate-200 px-5 py-6 text-center text-xs font-medium text-slate-500 sm:px-8"><nav aria-label={t('footer')} className="mb-3 flex flex-wrap justify-center gap-x-5 gap-y-2"><a href="#platform" className="text-inherit no-underline hover:text-blue-700">{t('secondaryCta')}</a><a href="#how-it-works" className="text-inherit no-underline hover:text-blue-700">{t('stepsTitle')}</a><a href="#faq" className="text-inherit no-underline hover:text-blue-700">{t('faqTitle')}</a><Link href="/login" className="text-inherit no-underline hover:text-blue-700">{session ? t('primaryCta') : t('signedOutCta')}</Link></nav>{t('footer')}</footer>
  </main>;
}
