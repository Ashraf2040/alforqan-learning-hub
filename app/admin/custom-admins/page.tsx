import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import CustomAdminsManager from './CustomAdminsManager';

export default async function CustomAdminsPage() {
  const session = await getServerSession(authOptions);
  if (session?.user.role !== 'ADMIN') redirect('/');
  return <CustomAdminsManager />;
}
