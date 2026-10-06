import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { AdminTodayProgress } from '@/app/components/TodayProgress';

export default async function AdminTodayProgressPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'ADMIN') redirect('/teacher');
  return <main className="w-full px-4 py-8 sm:px-7 xl:px-10 sm:py-10"><AdminTodayProgress /></main>;
}
