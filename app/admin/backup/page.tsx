'use client';

import { useAdminFeature } from '@/app/admin/useAdminFeature';
import DataBackup from '@/app/admin/DataBackup';
import { useLocale } from 'next-intl';

export default function AdminBackupPage() {
  const { allowed, checked } = useAdminFeature('dataBackup');
  const rtl = useLocale() === 'ar';
  if (!checked || !allowed) return <main className="mx-auto max-w-4xl px-5 py-12 text-center text-sm text-slate-500">{rtl ? 'جارٍ التحقق من صلاحية الوصول…' : 'Checking your access…'}</main>;
  return <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-7 xl:px-10"><DataBackup /></main>;
}
