'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import type { AdminFeature } from '@/lib/admin-features';

export function useAdminFeature(feature: AdminFeature, enabled = true) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (!enabled) { setAllowed(true); setChecked(true); return; }
    if (status === 'loading') return;
    if (session?.user.role === 'ADMIN') { setAllowed(true); setChecked(true); return; }
    if (session?.user.role !== 'CUSTOM_ADMIN') { setChecked(true); router.replace('/'); return; }
    let live = true;
    void fetch('/api/admin/custom-admins/access', { cache: 'no-store' }).then((response) => response.ok ? response.json() : null).then((result) => {
      if (!live) return;
      const hasAccess = Array.isArray(result?.features) && result.features.includes(feature);
      setAllowed(hasAccess); setChecked(true);
      if (!hasAccess) {
        router.replace('/admin');
      }
    }).catch(() => { if (live) { setChecked(true); console.error('[custom-admin-access] Could not load this account’s assigned features.'); router.replace('/login?error=access'); } });
    return () => { live = false; };
  }, [status, session?.user.role, feature, enabled, router]);
  return { allowed, checked };
}
