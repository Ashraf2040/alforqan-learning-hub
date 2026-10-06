import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { TeacherTodayProgress } from '@/app/components/TodayProgress';

export default async function TeacherTodayProgressPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/login');
  if (session.user.role !== 'TEACHER') redirect('/admin');
  return <main className="w-full px-4 py-8 sm:px-7 xl:px-10 sm:py-10"><TeacherTodayProgress /></main>;
}
