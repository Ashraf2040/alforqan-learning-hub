import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';

type FeatureKey = 'plan' | 'progress' | 'reports' | 'marks';
function Icon({ name, className = 'h-5 w-5' }: { name: FeatureKey | 'arrow' | 'check'; className?: string }) {
  const icons = {
    plan: <><path d="M8 3v3M16 3v3M4 8h16" /><rect x="3" y="5" width="18" height="16" rx="3" /><path d="m8 14 2 2 5-5" /></>,
    progress: <><path d="M4 19V5M4 19h17" /><path d="m7 14 4-4 3 2 6-7" /></>,
    reports: <><path d="M7 3h8l4 4v14H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z" /><path d="M15 3v5h5M8 12h7M8 16h7" /></>,
    marks: <><path d="M4 5h16M4 12h16M4 19h16" /><circle cx="8" cy="5" r="2" fill="currentColor" /><circle cx="15" cy="12" r="2" fill="currentColor" /><circle cx="10" cy="19" r="2" fill="currentColor" /></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className}>{icons[name]}</svg>;
}

export default async function Home() {
  const t = await getTranslations('landing');
  const session = await getServerSession(authOptions);
  const destination = session ? (['ADMIN', 'CUSTOM_ADMIN'].includes(session.user.role ?? '') ? '/admin' : '/teacher') : '/login';
  const features: { key: FeatureKey; title: string; text: string }[] = [
    { key: 'plan', title: t('featurePlanTitle'), text: t('featurePlanText') },
    { key: 'progress', title: t('featureProgressTitle'), text: t('featureProgressText') },
    { key: 'reports', title: t('featureReportsTitle'), text: t('featureReportsText') },
    { key: 'marks', title: t('featureMarksTitle'), text: t('featureMarksText') },
  ];
  const steps = [
    { number: t('stepOneNumber'), title: t('stepOneTitle'), text: t('stepOneText') },
    { number: t('stepTwoNumber'), title: t('stepTwoTitle'), text: t('stepTwoText') },
    { number: t('stepThreeNumber'), title: t('stepThreeTitle'), text: t('stepThreeText') },
  ];
  const questions = [
    { question: t('faqOneQuestion'), answer: t('faqOneAnswer') },
    { question: t('faqTwoQuestion'), answer: t('faqTwoAnswer') },
    { question: t('faqThreeQuestion'), answer: t('faqThreeAnswer') },
  ];
  const navLinks = [
    { href: '#platform', label: t('navFeatures') },
    { href: '#how-it-works', label: t('navHowItWorks') },
    { href: '#roles', label: t('navTeachers') },
    { href: '#contact', label: t('navContact') },
  ];
  return <main id="main-content" className="text-slate-900">
    <a href="#main-content" className="sr-only z-50 rounded-lg bg-white px-4 py-3 text-slate-900 shadow focus:not-sr-only focus:fixed focus:start-4 focus:top-4">{t('skipToContent')}</a>
    <section className="relative overflow-hidden border-b border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_48%,#f1f5f9_100%)]">
      <div className="mx-auto grid w-full max-w-[1320px] items-center gap-12 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[1.04fr_.96fr] lg:gap-16 lg:px-12 lg:py-24 xl:py-28">
        <div className="min-w-0">
          <p className="inline-flex min-h-9 items-center gap-2 rounded-full border border-slate-200 bg-white/80 px-3.5 text-xs font-semibold text-slate-700 shadow-sm sm:text-sm"><span className="h-2 w-2 rounded-full bg-emerald-600 ring-4 ring-emerald-100" />{t('eyebrow')}</p>
          <h1 className="mt-6 max-w-[17ch] text-[clamp(2.4rem,5vw,4.25rem)] font-extrabold leading-[1.04] tracking-[-.045em] text-slate-950">{t('title')}</h1>
          <p className="mt-6 max-w-[54ch] text-lg leading-8 text-slate-600 sm:text-xl sm:leading-9">{t('intro')}</p>
          <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href={destination} className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 text-sm font-semibold text-white no-underline shadow-lg shadow-slate-900/15 transition hover:-translate-y-0.5 hover:bg-slate-800 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900">{session ? t('primaryCta') : t('signedOutCta')}<Icon name="arrow" className="h-4 w-4 transition-transform group-hover:translate-x-0.5 rtl:rotate-180" /></Link>
            <a href="#platform" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300 bg-white/80 px-6 text-sm font-semibold text-slate-700 no-underline shadow-sm transition hover:-translate-y-0.5 hover:border-slate-400 hover:bg-white hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900">{t('secondaryCta')}</a>
          </div>
          <div className="mt-7 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-200 pt-5 text-sm text-slate-600">{[t('featurePlanTitle'), t('featureProgressTitle'), t('featureReportsTitle')].map((item) => <span key={item} className="inline-flex items-center gap-2"><Icon name="check" className="h-4 w-4 text-emerald-700" />{item}</span>)}</div>
        </div>
        <div className="min-w-0 lg:ps-2" role="img" aria-label={t('dashboardCaption')}>
          <div className="rounded-[1.75rem] border border-white bg-white p-5 shadow-[0_30px_80px_-42px_rgba(15,23,42,.42)] ring-1 ring-slate-200/80 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-4"><div><p className="text-sm font-medium text-slate-500">{t('dashboardLabel')}</p><h2 className="mt-1 text-xl font-bold tracking-tight text-slate-950 sm:text-2xl">{t('dashboardTitle')}</h2></div><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800">{t('weekLabel')}</span></div>
            <article className="mt-5 flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 p-4"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"><Icon name="plan" /></span><div className="min-w-0"><p className="text-xs font-medium text-slate-500">{t('featurePlanTitle')}</p><p className="mt-1 truncate text-sm font-semibold text-slate-900">{t('weekValue')}</p></div></article>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <article className="rounded-2xl border border-slate-200/90 bg-white p-[18px] shadow-sm"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium text-slate-600">{t('progressValue')}</p><span className="text-sm font-bold text-slate-900">{t('progressPercent')}</span></div><p className="mt-2 text-2xl font-bold tracking-tight text-slate-950">{t('progressCount')}</p><div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><span className="block h-full w-4/5 rounded-full bg-slate-900" /></div><p className="mt-2 text-xs text-slate-500">{t('progressFootnote')}</p></article>
              <article className="rounded-2xl border border-slate-200/90 bg-white p-[18px] shadow-sm"><p className="text-sm font-medium text-slate-600">{t('classLabel')}</p><p className="mt-2 text-base font-bold text-slate-950">{t('classValue')}</p><p className="mt-2 border-t border-slate-100 pt-2 text-sm leading-5 text-slate-600">{t('classFootnote')}</p></article>
            </div><p className="mt-4 text-xs leading-5 text-slate-500">{t('dashboardCaption')}</p>
          </div>
        </div>
      </div>
    </section>
    <section id="platform" className="scroll-mt-20 bg-slate-50">
      <div className="mx-auto w-full max-w-[1320px] px-5 py-16 sm:px-8 sm:py-20 lg:px-10 lg:py-28">
        <div className="max-w-2xl"><p className="text-sm font-semibold text-slate-800">{t('sectionEyebrow')}</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{t('sectionTitle')}</h2><p className="mt-4 text-base leading-7 text-slate-600">{t('sectionIntro')}</p></div>
        <div className="mt-10 overflow-hidden rounded-2xl border border-slate-200 bg-white sm:grid sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => <article key={feature.key} className={['p-5 transition-colors duration-200 hover:bg-slate-50/80 sm:p-7', index > 0 ? 'border-t border-slate-200 sm:border-t-0' : '', index >= 2 ? 'sm:border-t sm:border-slate-200 lg:border-t-0' : '', index % 2 === 1 ? 'sm:border-s' : '', index > 0 ? 'lg:border-s' : ''].join(' ')}><span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-100 text-slate-900 shadow-sm ring-1 ring-slate-200/70"><Icon name={feature.key} className="h-6 w-6" /></span><h3 className="mt-5 text-xl font-semibold tracking-tight text-slate-950">{feature.title}</h3><p className="mt-2 text-[15px] leading-6 text-slate-600">{feature.text}</p></article>)}
        </div>
      </div>
    </section>
    <section id="how-it-works" className="scroll-mt-20 border-y border-slate-200 bg-white">
      <div className="mx-auto w-full max-w-[1320px] px-5 py-16 sm:px-8 sm:py-20 lg:px-10 lg:py-28"><div className="max-w-2xl"><p className="text-sm font-semibold text-slate-800">{t('stepsEyebrow')}</p><h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{t('stepsTitle')}</h2></div><div className="mt-10 grid gap-8 md:grid-cols-3 md:gap-6">{steps.map((step, index) => <article key={step.number} className="relative border-t border-slate-300 pt-5 md:pe-5"><span className="inline-grid h-9 min-w-9 place-items-center rounded-full bg-slate-900 px-2 text-sm font-bold text-white shadow-sm">{step.number}</span><h3 className="mt-4 text-lg font-semibold text-slate-950">{step.title}</h3><p className="mt-2 text-[15px] leading-6 text-slate-600">{step.text}</p>{index < 2 && <span aria-hidden className="hidden md:absolute md:-end-1 md:-top-1 md:block md:h-2 md:w-2 md:rounded-full md:bg-slate-900" />}</article>)}</div></div>
    </section>
    <section id="roles" className="scroll-mt-20 bg-slate-50">
      <div className="mx-auto grid w-full max-w-[1320px] gap-8 px-5 py-16 sm:px-8 sm:py-20 lg:grid-cols-[.8fr_1.2fr] lg:items-center lg:px-10 lg:py-28"><div><p className="text-sm font-semibold text-slate-800">{t('rolesEyebrow')}</p><h2 className="mt-3 max-w-md text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{t('rolesTitle')}</h2></div><div className="grid gap-4 sm:grid-cols-2"><article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg"><span className="mb-5 block h-1 w-12 rounded-full bg-emerald-600"/><p className="text-base font-semibold text-slate-950">{t('teacherRole')}</p><p className="mt-2 text-[15px] leading-6 text-slate-600">{t('teacherRoleText')}</p></article><article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-200 hover:-translate-y-1 hover:shadow-lg"><span className="mb-5 block h-1 w-12 rounded-full bg-slate-900"/><p className="text-base font-semibold text-slate-950">{t('adminRole')}</p><p className="mt-2 text-[15px] leading-6 text-slate-600">{t('adminRoleText')}</p></article></div></div>
    </section>
    <section id="faq" className="scroll-mt-20 bg-white"><div className="mx-auto w-full max-w-[900px] px-5 py-16 sm:px-8 sm:py-20 lg:py-28"><h2 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">{t('faqTitle')}</h2><div className="mt-7 divide-y divide-slate-200 border-y border-slate-200">{questions.map((item) => <details key={item.question} className="group"><summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 py-4 text-start font-semibold text-slate-900 marker:content-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900"><span>{item.question}</span><span aria-hidden className="text-xl font-normal text-slate-900 transition-transform group-open:rotate-45">+</span></summary><p className="pb-5 pe-8 text-[15px] leading-6 text-slate-600">{item.answer}</p></details>)}</div></div></section>
    <section id="contact" className="scroll-mt-20 px-5 pb-16 sm:px-8 sm:pb-20 lg:px-10 lg:pb-28"><div className="mx-auto flex w-full max-w-[1320px] flex-col items-start justify-between gap-6 rounded-3xl bg-slate-900 px-6 py-8 text-white sm:px-9 sm:py-10 md:flex-row md:items-center"><div className="max-w-2xl"><h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{t('closingTitle')}</h2><p className="mt-2 text-base leading-7 text-slate-300">{t('closingText')}</p></div><Link href={destination} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-slate-900 no-underline hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">{session ? t('primaryCta') : t('signedOutCta')}<Icon name="arrow" className="h-4 w-4 rtl:rotate-180" /></Link></div></section>
    <footer className="border-t border-slate-200 bg-white"><div className="mx-auto flex w-full max-w-[1320px] flex-col gap-4 px-5 py-6 text-sm text-slate-500 sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10"><p>{t('footer')}</p><nav aria-label={t('footer')} className="flex flex-wrap gap-x-5 gap-y-2">{navLinks.map((link) => <a key={link.href} href={link.href} className="text-inherit no-underline hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-slate-900">{link.label}</a>)}</nav></div></footer>
  </main>;
}
