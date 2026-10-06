import type { Metadata, Viewport } from 'next';
import { Inter, IBM_Plex_Sans_Arabic } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { getLocale, getMessages, getTimeZone } from 'next-intl/server';
import { Navbar } from './components/Navbar';
import { WorkspaceSidebar } from './components/WorkspaceSidebar';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const plexArabic = IBM_Plex_Sans_Arabic({ subsets: ['arabic'], weight: ['400', '500', '600', '700'], variable: '--font-arabic', display: 'swap' });

export const metadata: Metadata = { title: 'Forqan School Hub | Al Forqan Schools', description: 'Weekly planning, daily lesson progress, and student reports in one school workspace.' };
export const viewport: Viewport = { themeColor: '#123b36', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const locale = await getLocale();
  const messages = await getMessages();
  const timeZone = await getTimeZone();
  return <html lang={locale} dir={locale === 'ar' ? 'rtl' : 'ltr'} className={`${inter.variable} ${plexArabic.variable}`}><body className="antialiased"><Providers locale={locale} messages={messages} timeZone={timeZone}><Navbar /><div className="min-h-[calc(100vh-64px)] w-full md:flex"><WorkspaceSidebar /><div className="min-w-0 w-full flex-1">{children}</div></div></Providers></body></html>;
}
