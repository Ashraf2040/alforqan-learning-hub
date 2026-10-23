import { getServerSession } from 'next-auth';
import { NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { getCustomAdminAccess } from '@/lib/custom-admin';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ features: await getCustomAdminAccess(session.user), isAdmin: session.user.role === 'ADMIN' });
}
