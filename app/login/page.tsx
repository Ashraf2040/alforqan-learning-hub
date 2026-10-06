'use client';
import { FormEvent, useState } from 'react';
import { getSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';

export default function LoginPage() {
  const t = useTranslations('login');
  const router = useRouter();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const data = new FormData(event.currentTarget);
    const result = await signIn('credentials', { username: data.get('username'), password: data.get('password'), redirect: false });
    if (result?.error) { setError(t('invalid')); setBusy(false); return; }
    const session = await getSession();
    const workspace = session?.user?.role === 'ADMIN' ? '/admin' : '/teacher';
    router.replace(workspace); router.refresh();
  }
  return <main className="grid min-h-screen place-items-center bg-[radial-gradient(ellipse_at_top_right,_#dcefeb,_transparent_45%),linear-gradient(135deg,#f8fafc,#edf2f8)] px-5 py-12">
    <section className="w-full max-w-md rounded-3xl border border-white bg-white/95 p-8 shadow-[0_25px_70px_-35px_rgba(16,40,65,.35)] sm:p-10">
      <div className="mb-8 flex items-center gap-3"><div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#1d5a50] to-[#0d302c] text-lg font-extrabold text-white shadow-lg shadow-emerald-950/15">WP</div><div><p className="text-xs font-bold uppercase tracking-[.2em] text-emerald-800">{t('eyebrow')}</p><p className="text-sm text-slate-500">{t('subtitle')}</p></div></div>
      <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{t('title')}</h1><p className="mt-2 text-sm text-slate-500">{t('intro')}</p>
      <form onSubmit={submit} className="mt-8 space-y-5">{error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        <label className="block text-sm font-medium text-slate-700">{t('username')}<input name="username" autoComplete="username" required className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10" /></label>
        <label className="block text-sm font-medium text-slate-700">{t('password')}<input name="password" type="password" autoComplete="current-password" required className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-600/10" /></label>
        <button disabled={busy} className="w-full rounded-xl bg-[#123b36] px-4 py-3.5 font-semibold text-white shadow-lg shadow-emerald-950/10 transition hover:bg-[#194c44] disabled:opacity-60">{busy ? t('submitting') : t('submit')}</button>
      </form><p className="mt-7 text-center text-xs text-slate-400">{t('footer')}</p>
    </section>
  </main>;
}
