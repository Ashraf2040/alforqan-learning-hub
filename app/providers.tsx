'use client';
import { SessionProvider } from 'next-auth/react';
import { NextIntlClientProvider, type AbstractIntlMessages } from 'next-intl';
import { Toaster } from 'react-hot-toast';
export function Providers({ children, locale, messages, timeZone }: { children: React.ReactNode; locale: string; messages: AbstractIntlMessages; timeZone: string }) {
  return <NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone}><SessionProvider>{children}<Toaster position="top-right" toastOptions={{ duration: 3500, style: { borderRadius: '14px', border: '1px solid #dde7e3', background: '#fff', color: '#14282a', fontSize: '14px' }, success: { iconTheme: { primary: '#17635a', secondary: '#fff' } } }} /></SessionProvider></NextIntlClientProvider>;
}
