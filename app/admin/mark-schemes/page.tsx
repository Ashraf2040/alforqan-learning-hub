'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { toast } from 'react-hot-toast';
import { defaultMarkColumns, type MarkColumn } from '@/lib/student-marks';

type Subject = { id: string; name: string };
type Grade = { id: string; name: string };
type SchoolClass = { id: string; name: string; gradeId: string | null };
const control = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800';

export default function MarkSchemesPage() {
  const rtl = useLocale() === 'ar';
  const { data, status } = useSession();
  const router = useRouter();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjectId, setSubjectId] = useState('');
  const [scopeType, setScopeType] = useState<'global' | 'grade' | 'class'>('global');
  const [gradeId, setGradeId] = useState('');
  const [classId, setClassId] = useState('');
  const [columns, setColumns] = useState<MarkColumn[]>([]);
  const [overridden, setOverridden] = useState(false);
  const [resolvedScope, setResolvedScope] = useState('defaults');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    if (status === 'authenticated' && !['ADMIN', 'COORDINATOR'].includes(data?.user?.role ?? '')) router.replace('/');
    if (status !== 'authenticated' || !['ADMIN', 'COORDINATOR'].includes(data?.user?.role ?? '')) return;
    let live = true;
    void fetch('/api/student-marks/scheme/options', { cache: 'no-store' }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (!live) return;
      setSubjects(result.subjects ?? []); setGrades(result.grades ?? []); setClasses(result.classes ?? []);
      if (result.subjects?.[0]) setSubjectId(result.subjects[0].id);
    }).catch((error) => { if (live) toast.error(error instanceof Error ? error.message : (rtl ? 'تعذر تحميل بيانات المواد والصفوف.' : 'Could not load subject and class options.')); }).finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [status, data?.user?.role, router, rtl]);

  const selectedSubject = subjects.find((item) => item.id === subjectId);
  const defaultColumns = useMemo(() => selectedSubject ? defaultMarkColumns(selectedSubject.name) : [], [selectedSubject]);
  const selectedScope = useMemo(() => ({ subjectId, ...(scopeType === 'grade' && gradeId ? { gradeId } : {}), ...(scopeType === 'class' && classId ? { classId } : {}) }), [subjectId, scopeType, gradeId, classId]);
  const scopeReady = Boolean(subjectId && (scopeType === 'global' || (scopeType === 'grade' && gradeId) || (scopeType === 'class' && classId)));

  async function reloadScheme() {
    if (!scopeReady) { setColumns([]); return; }
    setLoading(true);
    try {
      const query = new URLSearchParams(Object.entries(selectedScope).map(([key, value]) => [key, String(value)]));
      const response = await fetch(`/api/student-marks/scheme?${query}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setColumns(result.columns ?? []); setOverridden(Boolean(result.overridden)); setResolvedScope(result.resolvedScope ?? 'defaults');
    } catch (error) { toast.error(error instanceof Error ? error.message : (rtl ? 'تعذر تحميل إعدادات الجدول.' : 'Could not load table settings.')); }
    finally { setLoading(false); }
  }
  useEffect(() => { void reloadScheme(); // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subjectId, scopeType, gradeId, classId]);

  function toggleDefault(column: MarkColumn, checked: boolean) {
    setColumns((current) => checked ? [...current, column] : current.filter((item) => item.field !== column.field));
  }
  function updateColumn(field: string, key: keyof MarkColumn, value: string) {
    setColumns((current) => current.map((column) => column.field === field ? { ...column, [key]: key === 'min' || key === 'max' ? Number(value) : value } : column));
  }
  function addHeader() {
    const field = `custom_${crypto.randomUUID().replaceAll('-', '')}`;
    setColumns((current) => [...current, { field, label: '', labelAr: '', min: 0, max: 10 }]);
  }
  async function save() {
    if (!scopeReady || !columns.length) return;
    setSaving(true);
    try {
      const response = await fetch('/api/student-marks/scheme', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...selectedScope, columns }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setOverridden(true); setResolvedScope(scopeType);
      toast.success(rtl ? 'تم حفظ إعدادات الأعمدة لهذا النطاق.' : 'Table settings saved for this scope.');
    } catch (error) { toast.error(error instanceof Error ? error.message : (rtl ? 'تعذر حفظ إعدادات الجدول.' : 'Could not save table settings.')); }
    finally { setSaving(false); }
  }
  async function resetOverride() {
    if (!scopeReady || !overridden) return;
    setSaving(true);
    try {
      const response = await fetch('/api/student-marks/scheme', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(selectedScope) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      await reloadScheme();
      toast.success(rtl ? 'تمت إزالة الإعداد الخاص وعاد الجدول إلى الإعداد الموروث.' : 'Scope override removed; the inherited table settings are active.');
    } catch (error) { toast.error(error instanceof Error ? error.message : (rtl ? 'تعذر إعادة الإعدادات.' : 'Could not reset this scope.')); }
    finally { setSaving(false); }
  }
  const sourceLabel = resolvedScope === 'class' ? (rtl ? 'الفصل المحدد' : 'this class') : resolvedScope === 'grade' ? (rtl ? 'الصف المحدد' : 'this grade') : resolvedScope === 'global' ? (rtl ? 'الإعداد العام للمادة' : 'the subject default') : (rtl ? 'الإعدادات الأصلية للمادة' : 'the built-in subject defaults');

  return <main dir={rtl ? 'rtl' : 'ltr'} className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-7 xl:px-10">
    <a href="/admin/student-marks" className="text-sm font-semibold text-emerald-800">← {rtl ? 'درجات الطلاب' : 'Students Marks'}</a>
    <h1 className="mt-3 text-3xl font-black text-slate-900">{rtl ? 'إعداد جداول درجات المواد' : 'Subject marks table setup'}</h1>
    <p className="mt-2 text-slate-500">{rtl ? 'أنشئ رؤوساً مختلفة لكل مادة وصف أو فصل، وأضف أعمدة درجات جديدة حسب الحاجة.' : 'Set different score columns by subject and grade or class, and add new score headers whenever needed.'}</p>
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-semibold text-slate-700">{rtl ? 'المادة' : 'Subject'}<select className={`${control} mt-2`} value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">{rtl ? 'اختر المادة' : 'Choose subject'}</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">{rtl ? 'تطبيق الإعداد على' : 'Apply settings to'}<select className={`${control} mt-2`} value={scopeType} onChange={(event) => { setScopeType(event.target.value as typeof scopeType); setGradeId(''); setClassId(''); }}><option value="global">{rtl ? 'كل الصفوف والفصول لهذه المادة' : 'All grades and classes for this subject'}</option><option value="grade">{rtl ? 'صف دراسي محدد' : 'A specific grade'}</option><option value="class">{rtl ? 'فصل محدد' : 'A specific class'}</option></select></label>
        {scopeType === 'grade' && <label className="text-sm font-semibold text-slate-700">{rtl ? 'الصف' : 'Grade'}<select className={`${control} mt-2`} value={gradeId} onChange={(event) => setGradeId(event.target.value)}><option value="">{rtl ? 'اختر الصف' : 'Choose grade'}</option>{grades.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        {scopeType === 'class' && <label className="text-sm font-semibold text-slate-700">{rtl ? 'الفصل' : 'Class'}<select className={`${control} mt-2`} value={classId} onChange={(event) => setClassId(event.target.value)}><option value="">{rtl ? 'اختر الفصل' : 'Choose class'}</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}{item.gradeId ? ` · ${grades.find((grade) => grade.id === item.gradeId)?.name ?? ''}` : ''}</option>)}</select></label>}
      </div>
      {scopeReady && <div className="mt-4 space-y-2 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-600"><p>{rtl ? `يعرض هذا النطاق حالياً إعدادات ${sourceLabel}.` : `This scope currently uses ${sourceLabel}.`}</p><p>{rtl ? 'التخصيص أو Override هو إعداد استثناء لصف أو فصل محدد. عند وجوده، يستخدمه المعلمون لذلك الصف أو الفصل بدلاً من إعداد المادة العام.' : 'A scope override is a special setup for one grade or class. When present, teachers for that grade or class use it instead of the subject-wide setup.'}</p></div>}
    </section>
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3"><div><h2 className="text-xl font-black text-slate-900">{rtl ? 'رؤوس الأعمدة وحدود الدرجات' : 'Headers and score limits'}</h2><p className="mt-1 text-sm text-slate-500">{rtl ? 'أزل تحديد العمود لإخفائه. الحد الأدنى يحدد متى تظهر الدرجة منخفضة، والحد الأقصى يمنع تجاوز الدرجة.' : 'Uncheck a column to hide it. The minimum is the low-score alert threshold; maximum limits the entered score.'}</p></div><div className="flex gap-2"><button type="button" onClick={() => void resetOverride()} disabled={!overridden || saving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-40">{rtl ? 'إزالة تخصيص النطاق' : 'Remove scope override'}</button><button type="button" onClick={() => void save()} disabled={!scopeReady || !columns.length || loading || saving} className="rounded-xl bg-[#123b36] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? (rtl ? 'جارٍ الحفظ…' : 'Saving…') : (rtl ? 'حفظ إعدادات النطاق' : 'Save scope settings')}</button></div></div>
      {!scopeReady || loading ? <p className="py-10 text-center text-sm text-slate-500">{loading ? (rtl ? 'جارٍ تحميل الإعدادات…' : 'Loading settings…') : (rtl ? 'اختر المادة والنطاق لعرض الأعمدة.' : 'Choose a subject and scope to edit its columns.')}</p> : <><div className="mb-4 flex justify-end"><button type="button" onClick={addHeader} className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-900">＋ {rtl ? 'إضافة رأس درجة' : 'Add score header'}</button></div><div className="space-y-3">{defaultColumns.map((column) => { const configured = columns.find((item) => item.field === column.field); return <div key={column.field} className="grid gap-3 rounded-xl border border-slate-100 p-3 sm:grid-cols-[auto_minmax(9rem,1fr)_minmax(9rem,1fr)_8rem_8rem] sm:items-end"><label className="flex items-center gap-2 pb-2 text-sm font-bold text-slate-800"><input type="checkbox" checked={Boolean(configured)} onChange={(event) => toggleDefault(column, event.target.checked)} className="h-4 w-4 accent-emerald-800" />{rtl ? column.labelAr : column.label}</label>{configured ? <ColumnEditor column={configured} rtl={rtl} onChange={updateColumn} onRemove={() => setColumns((current) => current.filter((item) => item.field !== configured.field))} /> : <p className="pb-2 text-sm text-slate-400 sm:col-span-4">{rtl ? 'هذا العمود مخفي.' : 'This column is hidden.'}</p>}</div>; })}{columns.filter((column) => column.field.startsWith('custom_')).map((column) => <div key={column.field} className="rounded-xl border border-emerald-100 bg-emerald-50/30 p-3"><div className="mb-2 flex items-center justify-between"><strong className="text-sm text-emerald-950">{rtl ? 'رأس مخصص' : 'Custom header'}</strong><button type="button" onClick={() => setColumns((current) => current.filter((item) => item.field !== column.field))} className="text-xs font-bold text-rose-700">{rtl ? 'إزالة' : 'Remove'}</button></div><ColumnEditor column={column} rtl={rtl} onChange={updateColumn} /></div>)}</div></>}
    </section>
  </main>;
}

function ColumnEditor({ column, rtl, onChange, onRemove }: { column: MarkColumn; rtl: boolean; onChange: (field: string, key: keyof MarkColumn, value: string) => void; onRemove?: () => void }) {
  return <div className="grid flex-1 gap-3 sm:col-span-4 sm:grid-cols-[minmax(9rem,1fr)_minmax(9rem,1fr)_8rem_8rem_auto] sm:items-end">
    <label className="text-xs font-semibold text-slate-600">{rtl ? 'الرأس بالإنجليزية' : 'Header (English)'}<input className={`${control} mt-1`} value={column.label} onChange={(event) => onChange(column.field, 'label', event.target.value)} /></label>
    <label className="text-xs font-semibold text-slate-600">{rtl ? 'الرأس بالعربية' : 'Header (Arabic)'}<input className={`${control} mt-1`} value={column.labelAr} onChange={(event) => onChange(column.field, 'labelAr', event.target.value)} /></label>
    <label className="text-xs font-semibold text-slate-600">{rtl ? 'الحد الأدنى للتنبيه' : 'Low-score threshold'}<input type="number" min="0" max={column.max} className={`${control} mt-1`} value={column.min} onChange={(event) => onChange(column.field, 'min', event.target.value)} /></label>
    <label className="text-xs font-semibold text-slate-600">{rtl ? 'الدرجة القصوى' : 'Maximum score'}<input type="number" min="1" className={`${control} mt-1`} value={column.max} onChange={(event) => onChange(column.field, 'max', event.target.value)} /></label>
    {onRemove && <button type="button" onClick={onRemove} className="rounded-lg px-3 py-2 text-xs font-bold text-rose-700">{rtl ? 'إزالة' : 'Remove'}</button>}
  </div>;
}
