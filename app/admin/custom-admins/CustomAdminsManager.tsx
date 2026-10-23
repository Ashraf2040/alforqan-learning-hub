'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useLocale } from 'next-intl';
import { toast } from 'react-hot-toast';
import { ADMIN_FEATURE_LABELS, ADMIN_FEATURES, type AdminFeature } from '@/lib/admin-features';

type CustomAdmin = { id: string; name: string; username: string; features: AdminFeature[] };
const field = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100';

export default function CustomAdminsManager() {
  const rtl = useLocale() === 'ar';
  const [users, setUsers] = useState<CustomAdmin[]>([]);
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [features, setFeatures] = useState<AdminFeature[]>([]);
  const [busy, setBusy] = useState(false);
  const tr = (en: string, ar: string) => rtl ? ar : en;

  async function load() {
    const response = await fetch('/api/admin/custom-admins', { cache: 'no-store' });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setUsers(result.users);
  }
  useEffect(() => { void load().catch((error) => toast.error(error.message)); }, []);

  function toggle(list: AdminFeature[], feature: AdminFeature) {
    return list.includes(feature) ? list.filter((item) => item !== feature) : [...list, feature];
  }
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true);
    try {
      const response = await fetch('/api/admin/custom-admins', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, username, password, features }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setUsers((current) => [...current, result.user].sort((a, b) => a.name.localeCompare(b.name)));
      setName(''); setUsername(''); setPassword(''); setFeatures([]);
      toast.success(tr('Admin account created.', 'تم إنشاء الحساب الإداري.'));
    } catch (error) { toast.error(error instanceof Error ? error.message : tr('Could not create account.', 'تعذر إنشاء الحساب.')); }
    finally { setBusy(false); }
  }
  async function saveAccount(user: CustomAdmin, edits: { name: string; username: string; password: string; features: AdminFeature[] }) {
    const response = await fetch('/api/admin/custom-admins', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: user.id, ...edits }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    const updated: CustomAdmin = { ...result.user, features: result.features };
    setUsers((current) => current.map((item) => item.id === user.id ? updated : item).sort((a, b) => a.name.localeCompare(b.name)));
    toast.success(tr('Admin account updated.', 'تم تحديث الحساب الإداري.'));
    return updated;
  }
  async function remove(user: CustomAdmin) {
    if (!window.confirm(tr(`Remove the admin account “${user.name}”?`, `هل تريد حذف الحساب الإداري «${user.name}»؟`))) return;
    try {
      const response = await fetch(`/api/admin/custom-admins?id=${encodeURIComponent(user.id)}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setUsers((current) => current.filter((item) => item.id !== user.id));
      toast.success(tr('Admin account removed.', 'تم حذف الحساب الإداري.'));
    } catch (error) { toast.error(error instanceof Error ? error.message : tr('Could not remove account.', 'تعذر حذف الحساب.')); }
  }

  return <main dir={rtl ? 'rtl' : 'ltr'} className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-7 xl:px-10">
    <header className="mb-7"><p className="text-xs font-black uppercase tracking-[.16em] text-blue-800">{tr('ACCESS CONTROL', 'إدارة الوصول')}</p><h1 className="mt-2 text-3xl font-black text-slate-900">{tr('Custom admin roles', 'الأدوار الإدارية المخصصة')}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{tr('Create an admin login and choose exactly which areas it can access. Changes apply to the account immediately.', 'أنشئ حسابًا إداريًا وحدد الأقسام التي يمكنه الوصول إليها. تُطبق التغييرات على الحساب فورًا.')}</p></header>

    <form onSubmit={create} className="mb-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
      <h2 className="text-lg font-bold text-slate-900">{tr('Add an admin account', 'إضافة حساب إداري')}</h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-semibold text-slate-700">{tr('Display name', 'الاسم')}<input required maxLength={80} className={`${field} mt-2`} value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="text-sm font-semibold text-slate-700">{tr('Username', 'اسم المستخدم')}<input required minLength={3} maxLength={40} autoComplete="off" className={`${field} mt-2`} value={username} onChange={(event) => setUsername(event.target.value)} /></label>
        <label className="text-sm font-semibold text-slate-700">{tr('Password (8+ characters)', 'كلمة المرور (٨ أحرف على الأقل)')}<input required minLength={8} autoComplete="new-password" type="password" className={`${field} mt-2`} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      </div>
      <fieldset className="mt-5"><legend className="text-sm font-bold text-slate-800">{tr('Available features', 'الصلاحيات المتاحة')}</legend><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_FEATURES.map((feature) => <label key={feature} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"><input type="checkbox" checked={features.includes(feature)} onChange={() => setFeatures((current) => toggle(current, feature))} className="h-4 w-4 accent-blue-700" />{rtl ? ADMIN_FEATURE_LABELS[feature].ar : ADMIN_FEATURE_LABELS[feature].en}</label>)}
      </div></fieldset>
      <button disabled={busy || features.length === 0} className="mt-5 rounded-xl bg-[#222831] px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50">{busy ? tr('Creating…', 'جارٍ الإنشاء…') : tr('Create admin account', 'إنشاء الحساب الإداري')}</button>
    </form>

    <section className="space-y-4">
      <h2 className="text-lg font-bold text-slate-900">{tr('Admin accounts', 'الحسابات الإدارية')}</h2>
      {users.length === 0 ? <p className="rounded-2xl border border-dashed border-slate-300 px-5 py-10 text-center text-sm text-slate-500">{tr('No custom admin accounts yet.', 'لا توجد حسابات إدارية مخصصة حتى الآن.')}</p> : <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="w-full min-w-[680px] text-start text-sm"><thead className="bg-slate-50 text-xs font-bold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">{tr('Name', 'الاسم')}</th><th className="px-5 py-3">{tr('Username', 'اسم المستخدم')}</th><th className="px-5 py-3">{tr('Password', 'كلمة المرور')}</th><th className="px-5 py-3">{tr('Actions', 'إجراءات')}</th></tr></thead><tbody className="divide-y divide-slate-100">{users.map((user) => <AdminAccountCard key={user.id} user={user} rtl={rtl} tr={tr} onSave={saveAccount} onDelete={remove} />)}</tbody></table></div>}
    </section>
  </main>;
}

function AdminAccountCard({ user, rtl, tr, onSave, onDelete }: { user: CustomAdmin; rtl: boolean; tr: (en: string, ar: string) => string; onSave: (user: CustomAdmin, edits: { name: string; username: string; password: string; features: AdminFeature[] }) => Promise<CustomAdmin>; onDelete: (user: CustomAdmin) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [password, setPassword] = useState('');
  const [selected, setSelected] = useState(user.features);
  const [saving, setSaving] = useState(false);
  useEffect(() => { setName(user.name); setUsername(user.username); setSelected(user.features); }, [user.name, user.username, user.features]);
  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true);
    try { await onSave(user, { name, username, password, features: selected }); setPassword(''); setEditing(false); }
    catch (error) { toast.error(error instanceof Error ? error.message : tr('Could not update account.', 'تعذر تحديث الحساب.')); }
    finally { setSaving(false); }
  }
  return <>
    <tr className="align-middle"><td className="px-5 py-4 font-semibold text-slate-900">{user.name}</td><td className="px-5 py-4 text-slate-600">@{user.username}</td><td className="px-5 py-4"><span aria-label={tr('Password hidden', 'كلمة المرور مخفية')} className="tracking-[.2em] text-slate-500">••••••••</span><span className="ms-2 text-xs text-slate-400">{tr('Hidden', 'مخفية')}</span></td><td className="px-5 py-4"><div className="flex items-center gap-2"><button type="button" onClick={() => setEditing((value) => !value)} className="rounded-lg bg-blue-700 px-3 py-2 text-xs font-bold text-white hover:bg-blue-800">{editing ? tr('Close', 'إغلاق') : tr('Edit', 'تعديل')}</button><button type="button" onClick={() => void onDelete(user)} className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50">{tr('Remove', 'حذف')}</button></div></td></tr>
    {editing && <tr><td colSpan={4} className="bg-slate-50 px-5 py-5"><form onSubmit={save}>
      <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">{tr('Name', 'الاسم')}<input required maxLength={80} className={`${field} mt-2`} value={name} onChange={(event) => setName(event.target.value)} /></label><label className="text-sm font-semibold text-slate-700">{tr('Username', 'اسم المستخدم')}<input required minLength={3} maxLength={40} autoComplete="off" className={`${field} mt-2`} value={username} onChange={(event) => setUsername(event.target.value)} /></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">{tr('New password (leave blank to keep current)', 'كلمة مرور جديدة (اتركها فارغة للإبقاء على الحالية)')}<input minLength={8} autoComplete="new-password" type="password" className={`${field} mt-2`} value={password} onChange={(event) => setPassword(event.target.value)} /></label></div>
      <fieldset className="mt-5"><legend className="text-sm font-bold text-slate-800">{tr('Available features', 'الصلاحيات المتاحة')}</legend><div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{ADMIN_FEATURES.map((feature) => <label key={feature} className="flex min-h-10 cursor-pointer items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"><input type="checkbox" checked={selected.includes(feature)} onChange={() => setSelected((current) => current.includes(feature) ? current.filter((item) => item !== feature) : [...current, feature])} className="h-4 w-4 accent-blue-700" />{rtl ? ADMIN_FEATURE_LABELS[feature].ar : ADMIN_FEATURE_LABELS[feature].en}</label>)}</div></fieldset>
      <div className="mt-4 flex gap-2"><button type="submit" disabled={saving || selected.length === 0} className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? tr('Saving…', 'جارٍ الحفظ…') : tr('Save changes', 'حفظ التغييرات')}</button><button type="button" disabled={saving} onClick={() => { setName(user.name); setUsername(user.username); setPassword(''); setSelected(user.features); setEditing(false); }} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700">{tr('Cancel', 'إلغاء')}</button></div>
    </form></td></tr>}
  </>;
}
