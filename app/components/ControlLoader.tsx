'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export function ControlLoader({ message }: { message: string }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;

  return createPortal(<div role="status" aria-live="polite" className="fixed inset-0 z-[100] grid min-h-screen place-items-center overflow-y-auto bg-slate-950/50 px-4 py-6 backdrop-blur-[2px]">
    <div className="flex w-full max-w-md flex-col items-center rounded-2xl border border-white/80 bg-white p-7 shadow-2xl shadow-slate-950/20 sm:p-9">
      <span aria-hidden="true" className="mb-5 h-12 w-12 animate-spin rounded-full border-4 border-slate-100 border-b-[#ff5959]" />
      <p className="text-center text-base font-semibold leading-7 text-slate-700 sm:text-lg">{message}</p>
      <div aria-hidden="true" className="mt-5 flex gap-2">
        {[0, 1, 2].map((dot) => <span key={dot} className="h-2.5 w-2.5 animate-bounce rounded-full bg-[#ff5959]" style={{ animationDelay: `${dot * 100}ms` }} />)}
      </div>
    </div>
  </div>, document.body);
}
