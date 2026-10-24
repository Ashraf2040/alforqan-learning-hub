'use client';

import { useEffect, useState } from 'react';

type Props = { deadline: string; rtl: boolean };

export function MarkDeadlineCountdown({ deadline, rtl }: Props) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    const update = () => setNow(Date.now());
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (now === null) return null;
  const remaining = Date.parse(deadline) - now;
  if (!Number.isFinite(remaining)) return null;
  if (remaining <= 0) return <p role="status" className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-900">{rtl ? 'انتهى موعد إدخال الدرجات. حدّث الصفحة لمعرفة حالة الصلاحية.' : 'The mark entry deadline has passed. Refresh the page to check your access.'}</p>;

  const days = Math.floor(remaining / 86_400_000);
  const hours = Math.floor((remaining % 86_400_000) / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  const locale = rtl ? 'ar-SA' : 'en-GB';
  const deadlineDate = new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(deadline));
  const deadlineTime = new Intl.DateTimeFormat(locale, { timeStyle: 'short' }).format(new Date(deadline));
  const units = rtl
    ? [{ value: days, label: 'يوم' }, { value: hours, label: 'ساعة' }, { value: minutes, label: 'دقيقة' }, { value: seconds, label: 'ثانية' }]
    : [{ value: days, label: 'days' }, { value: hours, label: 'hours' }, { value: minutes, label: 'minutes' }, { value: seconds, label: 'seconds' }];

  return <section role="timer" aria-live="off" aria-label={rtl ? 'الوقت المتبقي لإدخال الدرجات' : 'Time remaining to enter marks'} className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 shadow-sm sm:px-5">
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-xl" aria-hidden>⏳</span>
    <div className="min-w-36 flex-1">
      <p className="text-sm font-black text-amber-950">{rtl ? 'الوقت المتبقي لإدخال الدرجات' : 'Time left to enter marks'}</p>
      <p className="mt-0.5 text-xs font-medium leading-5 text-amber-800"><span className="block">{rtl ? 'التاريخ:' : 'Date:'} {deadlineDate}</span><span className="block" dir="ltr">{rtl ? 'الوقت:' : 'Time:'} {deadlineTime}</span></p>
    </div>
    <div className="flex gap-1.5 sm:gap-2" dir="ltr">
      {units.map(({ value, label }) => <div key={label} className="min-w-[48px] rounded-xl border border-amber-200/80 bg-white/85 px-2 py-1.5 text-center shadow-sm sm:min-w-[58px] sm:px-2.5">
        <span className="block font-mono text-lg font-black leading-5 tabular-nums text-amber-950 sm:text-xl">{String(value).padStart(2, '0')}</span>
        <span className="mt-1 block text-[9px] font-bold uppercase tracking-wide text-amber-800 sm:text-[10px]">{label}</span>
      </div>)}
    </div>
  </section>;
}
