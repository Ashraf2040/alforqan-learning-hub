import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { getTranslations } from 'next-intl/server';
import { authOptions } from '@/lib/auth';

function Icon({ name }: { name: 'plan' | 'progress' | 'reports' | 'arrow' }) {
  const paths = {
    plan: <><path d="M8 3v3M16 3v3M4 8h16" /><rect x="3" y="5" width="18" height="16" rx="3" /><path d="m8 14 2.3 2.3L16 11" /></>,
    progress: <><path d="M4 19V5M4 19h17" /><path d="m7 14 4-4 3 2 6-7" /><path d="M17 5h3v3" /></>,
    reports: <><path d="M7 3h8l4 4v14H7a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3Z" /><path d="M15 3v5h5M8 12h7M8 16h7" /></>,
    arrow: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  };
  return <svg aria-hidden viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">{paths[name]}</svg>;
}

export default async function Home() {
  const t = await getTranslations('landing');
  const session = await getServerSession(authOptions);
  const workspace = session?.user.role === 'ADMIN' ? '/admin' : '/teacher';
  return <main className="overflow-hidden text-slate-900">
    <section className="relative isolate border-b border-emerald-100/80 bg-[radial-gradient(ellipse_at_76%_18%,rgba(210,232,222,.72),transparent_35%),linear-gradient(135deg,#f8fbf9_0%,#f1f7f4_46%,#f7f9f8_100%)]">
      <div aria-hidden className="pointer-events-none absolute -end-32 top-12 h-80 w-80 rounded-full border border-emerald-900/[0.06] sm:h-[28rem] sm:w-[28rem]" />
      <div aria-hidden className="pointer-events-none absolute -end-16 top-28 h-52 w-52 rounded-full border border-emerald-900/[0.06] sm:h-80 sm:w-80" />
      <div className="relative mx-auto grid w-full max-w-[1440px] items-center gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[.94fr_1.06fr] lg:gap-12 lg:px-12 lg:py-20 xl:px-16 xl:py-24">
        <div className="relative z-10 max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-emerald-800/10 bg-white/80 px-3.5 py-2 text-xs font-bold tracking-wide text-emerald-950 shadow-sm sm:text-sm"><span aria-hidden className="h-2 w-2 rounded-full bg-[#c9972f] shadow-[0_0_0_4px_rgba(201,151,47,.12)]" />{t('eyebrow')}</p>
          <h1 className="mt-6 max-w-[13ch] text-[clamp(2.55rem,7vw,5.3rem)] font-semibold leading-[1.03] tracking-[-.055em] text-[#123b36]">{t('title')}</h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">{t('intro')}</p>
          <div className="mt-8 flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-center">
            <Link href={session ? workspace : '/login'} className="group inline-flex min-h-12 items-center justify-center gap-3 rounded-xl bg-[#123b36] px-5 py-3 text-sm font-bold text-white no-underline shadow-lg shadow-emerald-950/15 transition hover:-translate-y-0.5 hover:bg-[#18574f] hover:shadow-xl">{session ? t('primaryCta') : t('signedOutCta')}<span className="transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5"><Icon name="arrow" /></span></Link>
            <Link href="#platform" className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-300/80 bg-white/65 px-5 py-3 text-sm font-bold text-slate-700 no-underline transition hover:border-emerald-800/30 hover:bg-white">{t('secondaryCta')}</Link>
          </div>
          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-emerald-900/10 pt-5 text-xs font-semibold text-slate-500 sm:text-sm"><span className="inline-flex items-center gap-2"><span className="text-emerald-800">✓</span>{t('featurePlanTitle')}</span><span className="inline-flex items-center gap-2"><span className="text-emerald-800">✓</span>{t('featureProgressTitle')}</span><span className="inline-flex items-center gap-2"><span className="text-emerald-800">✓</span>{t('featureReportsTitle')}</span></div>
        </div>

        <div className="relative mx-auto w-full max-w-[650px] lg:me-0" aria-hidden="true">
          <div aria-hidden className="absolute -inset-5 rounded-[2.5rem] bg-gradient-to-br from-white/80 via-emerald-100/40 to-amber-100/40 blur-2xl sm:-inset-8" />
          <div className="relative rounded-[1.65rem] border border-white/90 bg-white/75 p-2.5 shadow-[0_34px_90px_-40px_rgba(18,59,54,.38)] backdrop-blur sm:rounded-[2rem] sm:p-4">
            <div className="overflow-hidden rounded-[1.25rem] border border-slate-200/90 bg-[#f7f9f8] sm:rounded-[1.5rem]">
              <div className="flex items-center justify-between border-b border-slate-200/80 bg-white px-4 py-3 sm:px-5 sm:py-4"><div className="flex items-center gap-2.5"><span className="grid h-8 w-8 place-items-center rounded-lg bg-[#123b36] text-xs font-black text-white">AF</span><span className="text-xs font-bold text-[#123b36] sm:text-sm">Forqan School Hub</span></div><div className="flex gap-1.5"><i className="h-2 w-2 rounded-full bg-slate-200"/><i className="h-2 w-2 rounded-full bg-slate-200"/><i className="h-2 w-2 rounded-full bg-[#c9972f]"/></div></div>
              <div className="grid gap-3 p-3 sm:gap-4 sm:p-5 md:grid-cols-[.72fr_1.28fr]">
                <div className="hidden flex-col rounded-xl bg-[#123b36] p-3 text-white md:flex"><div className="mb-7 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-white/15 text-[10px] font-black">AF</span><span className="text-[10px] font-bold tracking-wide text-white/90">SCHOOL HUB</span></div>{[t('weekLabel'),t('progressLabel'),t('classLabel')].map((item,index)=><div key={item} className={`mb-2 rounded-lg px-2.5 py-2 text-[10px] font-semibold ${index===0?'bg-white/15 text-white':'text-emerald-100/70'}`}><span className="me-2 opacity-70">{index===0?'▤':index===1?'◷':'▧'}</span>{item}</div>)}<div className="mt-auto rounded-lg border border-white/10 bg-white/[0.07] p-2.5"><div className="h-1.5 w-10 rounded bg-white/20"/><div className="mt-2 h-1.5 w-16 rounded bg-white/10"/></div></div>
                <div className="min-w-0 space-y-3 sm:space-y-4">
                  <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.14em] text-emerald-800 sm:text-xs">{t('dashboardLabel')}</p><h2 className="mt-1 text-lg font-bold tracking-tight text-slate-900 sm:text-2xl">{t('dashboardTitle')}</h2></div><span className="rounded-full border border-emerald-100 bg-white px-2.5 py-1 text-[9px] font-semibold text-slate-500 sm:text-[10px]">AL FORQAN</span></div>
                  <p className="-mt-1 text-[11px] leading-5 text-slate-500 sm:text-xs">{t('dashboardCaption')}</p>
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3"><article className="rounded-xl border border-slate-200 bg-white p-3 sm:rounded-2xl sm:p-4"><div className="flex items-center justify-between"><span className="grid h-7 w-7 place-items-center rounded-lg bg-emerald-50 text-emerald-800"><Icon name="plan"/></span><span className="rounded-full bg-emerald-50 px-2 py-1 text-[9px] font-bold text-emerald-800">{t('weekLabel')}</span></div><p className="mt-3 text-[10px] text-slate-500 sm:text-xs">{t('weekLabel')}</p><p className="mt-1 text-sm font-bold text-slate-900 sm:text-base">{t('weekValue')}</p></article>
                    <article className="rounded-xl border border-slate-200 bg-white p-3 sm:rounded-2xl sm:p-4"><div className="flex items-center justify-between"><span className="grid h-7 w-7 place-items-center rounded-lg bg-amber-50 text-amber-800"><Icon name="progress"/></span><span className="text-[10px] font-bold text-emerald-800">80%</span></div><p className="mt-3 text-[10px] text-slate-500 sm:text-xs">{t('progressValue')}</p><div className="mt-1 flex items-baseline gap-1.5"><p className="text-sm font-bold text-slate-900 sm:text-base">{t('progressCount')}</p><span className="text-[9px] text-slate-400">{t('progressLabel')}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100"><span className="block h-full w-4/5 rounded-full bg-gradient-to-r from-[#17635a] to-[#c9972f]"/></div><p className="mt-1.5 text-[9px] text-slate-400">{t('progressFootnote')}</p></article></div>
                  <article className="rounded-xl border border-slate-200 bg-white p-3 sm:rounded-2xl sm:p-4"><div className="flex items-center justify-between"><div><p className="text-[9px] font-bold tracking-[.12em] text-slate-400">{t('classLabel')}</p><p className="mt-1 text-xs font-bold text-slate-900 sm:text-sm">{t('classValue')}</p></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-sky-800"><Icon name="reports"/></span></div><p className="mt-2 border-t border-slate-100 pt-2 text-[10px] text-slate-500 sm:text-xs">{t('classFootnote')}</p></article>
                  <div className="grid grid-cols-3 gap-2"><div className="h-12 rounded-xl border border-slate-200 bg-white p-2"><div className="h-1.5 w-10 rounded bg-slate-100"/><div className="mt-2 h-1.5 w-full rounded bg-emerald-100"/></div><div className="h-12 rounded-xl border border-slate-200 bg-white p-2"><div className="h-1.5 w-8 rounded bg-slate-100"/><div className="mt-2 h-1.5 w-4/5 rounded bg-amber-100"/></div><div className="h-12 rounded-xl border border-slate-200 bg-white p-2"><div className="h-1.5 w-9 rounded bg-slate-100"/><div className="mt-2 h-1.5 w-3/4 rounded bg-sky-100"/></div></div>
                </div>
              </div>
            </div>
          </div>
          <div aria-hidden className="absolute -bottom-4 -start-3 hidden items-center gap-2 rounded-2xl border border-white bg-white/95 px-4 py-3 text-xs font-semibold text-slate-700 shadow-xl shadow-slate-900/10 sm:flex"><span className="grid h-8 w-8 place-items-center rounded-xl bg-emerald-50 text-emerald-800">✓</span>Weekly plans · Daily progress · Reports</div>
        </div>
      </div>
    </section>

    <section id="platform" className="mx-auto w-full max-w-[1280px] px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24">
      <div className="mx-auto max-w-2xl text-center"><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-800">{t('sectionEyebrow')}</p><h2 className="mt-3 text-3xl font-semibold tracking-[-.04em] text-[#123b36] sm:text-4xl">{t('sectionTitle')}</h2><p className="mt-4 text-base leading-7 text-slate-600">{t('sectionIntro')}</p></div>
      <div className="mt-10 grid gap-4 md:grid-cols-3 md:gap-5">
        {(['plan','progress','reports'] as const).map((name) => {
          const title = name === 'plan' ? t('featurePlanTitle') : name === 'progress' ? t('featureProgressTitle') : t('featureReportsTitle');
          const copy = name === 'plan' ? t('featurePlanText') : name === 'progress' ? t('featureProgressText') : t('featureReportsText');
          return <article key={name} className="group rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_16px_46px_-38px_rgba(18,59,54,.36)] transition hover:-translate-y-1 hover:border-emerald-800/20 hover:shadow-[0_24px_52px_-34px_rgba(18,59,54,.28)] sm:p-7"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-900 transition group-hover:bg-[#123b36] group-hover:text-white"><Icon name={name}/></span><h3 className="mt-5 text-lg font-bold text-slate-900">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600">{copy}</p></article>;
        })}
      </div>
    </section>

    <section className="border-y border-emerald-900/[.06] bg-gradient-to-br from-[#edf4f1] via-white to-[#f4f1e9]">
      <div className="mx-auto grid w-full max-w-[1280px] gap-8 px-5 py-14 sm:px-8 sm:py-16 md:grid-cols-[.8fr_1.2fr] md:items-center lg:px-12 lg:py-20"><div><p className="text-xs font-bold uppercase tracking-[.18em] text-emerald-800">{t('rolesEyebrow')}</p><h2 className="mt-3 max-w-md text-3xl font-semibold tracking-[-.04em] text-[#123b36] sm:text-4xl">{t('rolesTitle')}</h2></div><div className="grid gap-3 sm:grid-cols-2"><article className="rounded-2xl border border-white bg-white/80 p-5 shadow-sm sm:p-6"><p className="text-sm font-bold text-emerald-900">{t('teacherRole')}</p><p className="mt-2 text-sm leading-6 text-slate-600">{t('teacherRoleText')}</p></article><article className="rounded-2xl border border-white bg-white/80 p-5 shadow-sm sm:p-6"><p className="text-sm font-bold text-emerald-900">{t('adminRole')}</p><p className="mt-2 text-sm leading-6 text-slate-600">{t('adminRoleText')}</p></article></div></div>
    </section>

    <section className="px-5 py-14 sm:px-8 sm:py-16 lg:px-12"><div className="mx-auto flex max-w-[1100px] flex-col items-start justify-between gap-6 rounded-[1.75rem] bg-[#123b36] px-6 py-8 text-white shadow-xl shadow-emerald-950/15 sm:rounded-[2rem] sm:px-9 sm:py-10 md:flex-row md:items-center"><div className="max-w-2xl"><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t('closingTitle')}</h2><p className="mt-2 text-sm leading-6 text-emerald-50/80 sm:text-base">{t('closingText')}</p></div><Link href={session ? workspace : '/login'} className="inline-flex min-h-12 shrink-0 items-center justify-center gap-3 rounded-xl bg-white px-5 py-3 text-sm font-bold text-[#123b36] no-underline transition hover:bg-emerald-50">{session ? t('primaryCta') : t('signedOutCta')}<Icon name="arrow"/></Link></div></section>
    <footer className="border-t border-slate-200/80 px-5 py-6 text-center text-xs font-medium text-slate-500 sm:px-8">{t('footer')}</footer>
  </main>;
}
