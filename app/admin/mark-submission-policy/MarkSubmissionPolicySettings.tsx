'use client';

import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useLocale } from 'next-intl';

type Teacher = { id: string; name: string };
type Policy = { deadlineAt: string | null; reopenAll: boolean; reopenedTeacherIds: string[] };
const control = 'mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-700 focus:ring-2 focus:ring-blue-100';

function localDateTime(value: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export default function MarkSubmissionPolicySettings() {
  const rtl = useLocale() === 'ar';
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [deadlineAt, setDeadlineAt] = useState('');
  const [noDeadline, setNoDeadline] = useState(false);
  const [reopenAll, setReopenAll] = useState(false);
  const [reopenedTeacherIds, setReopenedTeacherIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    void fetch('/api/admin/mark-submission-policy', { cache: 'no-store' }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (live) {
        const policy = data.policy as Policy;
        setTeachers(data.teachers ?? []);
        setDeadlineAt(localDateTime(policy.deadlineAt));
        setNoDeadline(!policy.deadlineAt);
        setReopenAll(policy.reopenAll);
        setReopenedTeacherIds(policy.reopenedTeacherIds ?? []);
      }
    }).catch((error) => toast.error(error instanceof Error ? error.message : 'Could not load mark deadline settings.')).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, []);

  function toggleTeacher(id: string) {
    setReopenedTeacherIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  }

  async function save() {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/mark-submission-policy', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ deadlineAt: deadlineAt ? new Date(deadlineAt).toISOString() : null, reopenAll, reopenedTeacherIds }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success(rtl ? 'تم حفظ موعد إدخال الدرجات.' : 'Mark submission settings saved.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save mark deadline settings.'); }
    finally { setSaving(false); }
  }

  return <section className="rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-lg font-semibold text-slate-900">{rtl ? 'موعد تسليم الدرجات' : 'Mark submission deadline'}</h2><p className="mt-1 max-w-3xl text-sm text-slate-600">{rtl ? 'بعد الموعد يستطيع المعلم عرض الدرجات فقط. يمكنك إعادة فتح التعديل للجميع أو لمعلم محدد.' : 'After the deadline teachers can still view marks but cannot change them. Reopen editing for everyone or selected teachers.'}</p></div></div>
    <div className="mt-5 grid items-end gap-5 lg:grid-cols-[minmax(15rem,1fr)_minmax(15rem,1fr)]">
      <div><label className="flex min-h-10 items-center gap-3 text-sm font-semibold text-slate-800"><button type="button" role="switch" aria-checked={noDeadline} aria-label={rtl ? 'بدون موعد نهائي' : 'No deadline'} onClick={() => { const next = !noDeadline; setNoDeadline(next); if (next) setDeadlineAt(''); }} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${noDeadline ? 'bg-blue-700' : 'bg-slate-300'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${noDeadline ? 'start-6' : 'start-1'}`} /></button>{rtl ? 'بدون موعد نهائي' : 'No deadline'}</label><label className={`mt-3 block text-sm font-semibold text-slate-700 ${noDeadline ? 'opacity-50' : ''}`}>{rtl ? 'آخر موعد لإدخال الدرجات' : 'Teacher entry deadline'}<input type="datetime-local" className={control} value={deadlineAt} onChange={(event) => setDeadlineAt(event.target.value)} disabled={loading || noDeadline} /></label></div>
      <div><label className="flex min-h-10 items-center gap-3 text-sm font-semibold text-slate-800"><button type="button" role="switch" aria-checked={reopenAll} aria-label={rtl ? 'إعادة فتح التعديل لجميع المعلمين' : 'Reopen editing for all teachers'} onClick={() => setReopenAll((value) => !value)} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${reopenAll ? 'bg-blue-700' : 'bg-slate-300'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${reopenAll ? 'start-6' : 'start-1'}`} /></button>{rtl ? 'إعادة فتح التعديل لجميع المعلمين' : 'Reopen editing for all teachers'}</label><p className="mt-2 text-sm text-slate-600">{rtl ? 'يتجاوز هذا الاختيار الموعد المحدد.' : 'This overrides the deadline while enabled.'}</p></div>
    </div>
    <details className="mt-5 border-t border-slate-200 pt-4"><summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold text-blue-800">{rtl ? 'إعادة فتح التعديل لمعلم محدد' : 'Reopen editing for selected teachers'}</summary><div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{teachers.map((teacher) => <label key={teacher.id} className="flex min-h-10 items-center gap-3 rounded-lg px-2 py-2 text-sm text-slate-700 hover:bg-slate-50"><input type="checkbox" checked={reopenedTeacherIds.includes(teacher.id)} onChange={() => toggleTeacher(teacher.id)} className="h-4 w-4 accent-blue-700" />{teacher.name}</label>)}{!teachers.length && <p className="text-sm text-slate-600">{rtl ? 'لا يوجد معلمون.' : 'No teachers are available.'}</p>}</div></details>
    <div className="mt-4 flex justify-end border-t border-slate-100 pt-4"><button type="button" onClick={() => void save()} disabled={loading || saving} className="min-h-10 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{saving ? (rtl ? 'جارٍ الحفظ…' : 'Saving…') : (rtl ? 'حفظ الموعد والصلاحيات' : 'Save deadline and access')}</button></div>
  </section>;
}
