'use client';
import { FormEvent, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

type SchoolClass = { id: string; name: string };
type Subject = { id: string; name: string };
type Item = { subjectId: string; classwork: string; homework: string };
type PreviousPlan = { id: string; week: string; semester: string | null; fromDate: string; toDate: string; dictation: string | null; notes: string | null; classes: SchoolClass[]; items: (Item & { subject: Subject })[]; updatedAt: string };

/* Presentation-only class tokens */
const fieldLabel = 'text-[13px] font-semibold text-slate-600';
const fieldControl = 'mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-normal text-slate-800 shadow-sm';
const sectionTitle = 'text-lg font-bold text-slate-900';
const sectionHint = 'mt-1 text-sm leading-6 text-slate-500';
const segBtn = (active: boolean) => `rounded-md px-3.5 py-2 text-sm font-semibold transition-colors ${active ? 'bg-[#123b36] text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100'}`;

export default function TeacherPage() {
  const t = useTranslations('teacher');
  const { data: session, status } = useSession();
  const router = useRouter();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [previousPlans, setPreviousPlans] = useState<PreviousPlan[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [showPlanFilters, setShowPlanFilters] = useState(false);
  const [filterMode, setFilterMode] = useState<'week' | 'date'>('week');
  const [filterWeek, setFilterWeek] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [appliedPlanFilter, setAppliedPlanFilter] = useState<{ type: 'week' | 'date'; value: string } | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classIds, setClassIds] = useState<string[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [week, setWeek] = useState('');
  const [semester, setSemester] = useState('1st Semester');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [dictation, setDictation] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => { if (status === 'unauthenticated') router.replace('/login'); }, [status, router]);
  useEffect(() => {
    if (status !== 'authenticated') return;
    void fetch('/api/teacher/options').then(async (response) => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      setClasses(data.classes ?? []); setSubjects(data.subjects ?? []);
      if ((data.subjects ?? []).length) setItems([{ subjectId: data.subjects[0].id, classwork: '', homework: '' }]);
    }).catch(() => setError(t('saveError')));
  }, [status]);

  async function loadPreviousPlans(filter: { type: 'week' | 'date'; value: string }) {
    setLoadingPlans(true);
    try {
      const query = new URLSearchParams();
      query.set(filter.type, filter.value);
      const response = await fetch('/api/plans?' + query.toString());
      const data = await response.json();
      if (!response.ok) throw new Error();
      setPreviousPlans(data.plans ?? []);
    } catch { setError(t('saveError')); }
    finally { setLoadingPlans(false); }
  }

  async function applyPlanFilter(event: FormEvent) {
    event.preventDefault();
    const value = filterMode === 'week' ? filterWeek.trim() : filterDate;
    if (!value) { setError(t('filterRequired')); return; }
    const filter = { type: filterMode, value } as const;
    setAppliedPlanFilter(filter); setError('');
    await loadPreviousPlans(filter);
  }

  async function clearPlanFilter() {
    setAppliedPlanFilter(null); setFilterWeek(''); setFilterDate(''); setError(''); setPreviousPlans([]);
  }

  function editPlan(plan: PreviousPlan) {
    setEditingId(plan.id); setClassIds(plan.classes.map((item) => item.id)); setWeek(plan.week);
    setSemester(plan.semester ?? '1st Semester'); setFromDate(plan.fromDate.slice(0, 10)); setToDate(plan.toDate.slice(0, 10));
    setDictation(plan.dictation ?? ''); setNotes(plan.notes ?? '');
    setItems(plan.items.map(({ subjectId, classwork, homework }) => ({ subjectId, classwork, homework })));
    setError(''); setMessage(''); window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function deletePlan(plan: PreviousPlan) {
    const confirmed = window.confirm(t('confirmDelete'));
    if (!confirmed) return;
    setDeletingId(plan.id); setError('');
    try {
      const response = await fetch('/api/plans/' + plan.id, { method: 'DELETE' });
      if (!response.ok) throw new Error();
      setPreviousPlans((current) => current.filter((item) => item.id !== plan.id));
      if (editingId === plan.id) cancelEdit();
      setMessage(t('deleted'));
    } catch { setError(t('deleteError')); }
    finally { setDeletingId(null); }
  }

  function cancelEdit() {
    setEditingId(null); setClassIds([]); setWeek(''); setSemester('1st Semester'); setFromDate(''); setToDate('');
    setDictation(''); setNotes(''); setItems(subjects.length ? [{ subjectId: subjects[0].id, classwork: '', homework: '' }] : []);
  }

  async function submit(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch(editingId ? '/api/plans/' + editingId : '/api/plans', { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classIds, week, semester, fromDate, toDate, dictation, notes, items }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Save failed');
      setMessage(editingId ? t('updated') : t('saved'));
      setEditingId(null);
      cancelEdit();
      if (appliedPlanFilter) await loadPreviousPlans(appliedPlanFilter);
    } catch { setError(t('saveError')); }
    finally { setSaving(false); }
  }

  if (status === 'loading') return <div className="grid min-h-[70vh] place-items-center text-sm font-medium text-slate-500"><span className="inline-flex items-center gap-3"><span aria-hidden className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-700" />{t('loading')}</span></div>;
  return <main className="w-full px-4 py-9 sm:px-7 xl:px-10">
    <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white p-5 shadow-sm"><div><p className="text-xl font-bold tracking-tight text-slate-900">{t('welcome', { name: session?.user.name || t('there') })}</p><p className="mt-1 text-sm text-slate-600">{t('welcomeHint')}</p></div><Link href="/reports" className="btn-primary no-underline">Student reports</Link></div>
    <header className="card mb-8 !rounded-3xl px-5 py-6 shadow-[0_20px_60px_-45px_rgba(18,59,54,.38)] sm:px-8 sm:py-7"><p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-100 before:h-1.5 before:w-1.5 before:rounded-full before:bg-emerald-600 before:content-['']">{t('eyebrow')}</p><h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{t('title')}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{t('intro')}</p></header>

    <section className="card mb-7 p-5 sm:p-7"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className={sectionTitle}>{t('previousPlans')}</h2><p className={sectionHint}>{t('previousPlansHint')}</p></div><div className="flex gap-2"><button type="button" aria-expanded={showPlanFilters} onClick={() => setShowPlanFilters((value) => !value)} className="btn-secondary !px-3.5 !py-2">{showPlanFilters ? t('hideFilters') : t('filterPlans')}</button><button type="button" disabled={!appliedPlanFilter} onClick={() => appliedPlanFilter && void loadPreviousPlans(appliedPlanFilter)} className="btn-secondary !px-3.5 !py-2">{t('refreshPlans')}</button></div></div>
      {showPlanFilters && <form onSubmit={applyPlanFilter} className="mt-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5"><fieldset><legend className="text-[13px] font-semibold text-slate-600">{t('filterBy')}</legend><div className="mt-3 inline-flex gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm"><button type="button" aria-pressed={filterMode === 'week'} onClick={() => setFilterMode('week')} className={segBtn(filterMode === 'week')}>{t('filterByWeek')}</button><button type="button" aria-pressed={filterMode === 'date'} onClick={() => setFilterMode('date')} className={segBtn(filterMode === 'date')}>{t('filterByDate')}</button></div></fieldset><div className="mt-4 flex flex-wrap items-end gap-3">{filterMode === 'week' ? <label className={`min-w-48 flex-1 ${fieldLabel}`}>{t('week')}<input value={filterWeek} onChange={(event) => setFilterWeek(event.target.value)} placeholder={t('weekPlaceholder')} className={fieldControl} /></label> : <label className={`min-w-48 flex-1 ${fieldLabel}`}>{t('filterDate')}<input type="date" value={filterDate} onChange={(event) => setFilterDate(event.target.value)} className={fieldControl} /></label>}<button disabled={loadingPlans} className="btn-primary">{t('applyFilter')}</button><button type="button" disabled={loadingPlans} onClick={() => void clearPlanFilter()} className="btn-secondary">{t('clearFilter')}</button></div></form>}
      {!appliedPlanFilter ? <p className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500">{t('useFilterToSeePlans')}</p> : loadingPlans ? <p className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-sm text-slate-500">{t('loading')}</p> : previousPlans.length ? <div className="mt-5 space-y-3">{previousPlans.map((plan) => <article key={plan.id} className={`flex flex-wrap items-center justify-between gap-4 rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${editingId === plan.id ? 'border-emerald-600 ring-2 ring-emerald-600/15' : 'border-slate-200'}`}><div className="min-w-0"><p className="font-semibold text-slate-900">{t('week')} {plan.week} <span className="font-normal text-slate-500">· {new Date(plan.fromDate).toLocaleDateString()} – {new Date(plan.toDate).toLocaleDateString()}</span></p><p className="mt-1 text-sm leading-6 text-slate-500">{plan.classes.map((item) => item.name).join(', ')} · {plan.items.map((item) => item.subject.name).join(', ')}</p></div><div className="flex gap-2"><button type="button" onClick={() => editPlan(plan)} className="btn-secondary !px-3.5 !py-2">{t('editPlan')}</button><button type="button" disabled={deletingId === plan.id} onClick={() => void deletePlan(plan)} className="btn-danger !px-3.5 !py-2 disabled:opacity-50">{deletingId === plan.id ? t('deleting') : t('deletePlan')}</button></div></article>)}</div> : <p className="mt-5 rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-4 py-8 text-center text-sm text-slate-500">{appliedPlanFilter ? t('noFilteredPlans') : t('noPreviousPlans')}</p>}</section>

    <form onSubmit={submit} className="space-y-6">
      <section className="card p-5 sm:p-7"><h2 className={sectionTitle}>{t('classes')}</h2><p className={sectionHint}>{t('classesHint')}</p>{classes.length ? <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{classes.map((item) => <label key={item.id} className="choice"><input type="checkbox" checked={classIds.includes(item.id)} onChange={(e) => setClassIds((current) => e.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} className="h-4 w-4" />{item.name}</label>)}</div> : <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">{t('none')}</p>}</section>
      <section className={`card p-5 transition-shadow sm:p-7 ${editingId ? '!border-emerald-600 ring-2 ring-emerald-600/15' : ''}`}><div className="flex items-center justify-between gap-3"><h2 className={sectionTitle}>{t('details')}</h2>{editingId && <button type="button" onClick={cancelEdit} className="btn-danger !px-3.5 !py-2">{t('cancelEdit')}</button>}</div><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className={fieldLabel}>{t('week')}<input required value={week} onChange={(e) => setWeek(e.target.value)} className={fieldControl} /></label>
        <label className={fieldLabel}>{t('semester')}<select value={semester} onChange={(e) => setSemester(e.target.value)} className={fieldControl}><option value="1st Semester">{t('firstSemester')}</option><option value="2nd Semester">{t('secondSemester')}</option><option value="Summer Term">{t('summer')}</option></select></label>
        <label className={fieldLabel}>{t('from')}<input required type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className={fieldControl} /></label>
        <label className={fieldLabel}>{t('to')}<input required type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className={fieldControl} /></label>
      </div></section>
      <section className="card p-5 sm:p-7"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className={sectionTitle}>{t('subjects')}</h2><p className={sectionHint}>{t('subjectsHint')}</p></div><button type="button" onClick={() => setItems((current) => [...current, { subjectId: subjects[0]?.id ?? '', classwork: '', homework: '' }])} disabled={!subjects.length} className="btn-secondary !px-3.5 !py-2">{t('addSubject')}</button></div>
        {subjects.length ? <div className="mt-5 space-y-4">{items.map((item, index) => <div key={index} className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-2 sm:p-5"><label className={`sm:col-span-2 ${fieldLabel}`}>{t('subject')}<select required value={item.subjectId} onChange={(e) => setItems((current) => current.map((row, i) => i === index ? { ...row, subjectId: e.target.value } : row))} className={fieldControl}><option value="">{t('chooseSubject')}</option>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label><label className={fieldLabel}>{t('classwork')}<textarea value={item.classwork} onChange={(e) => setItems((current) => current.map((row, i) => i === index ? { ...row, classwork: e.target.value } : row))} placeholder={t('classworkPlaceholder')} rows={3} className={`${fieldControl} leading-6`} /></label><label className={fieldLabel}>{t('activity')}<textarea value={item.homework} onChange={(e) => setItems((current) => current.map((row, i) => i === index ? { ...row, homework: e.target.value } : row))} placeholder={t('activityPlaceholder')} rows={3} className={`${fieldControl} leading-6`} /></label>{items.length > 1 && <button type="button" onClick={() => setItems((current) => current.filter((_, i) => i !== index))} className="btn-danger justify-self-start !px-3.5 !py-2">{t('remove')}</button>}</div>)}</div> : <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">{t('noSubjects')}</p>}
      </section>
      <section className="grid gap-5 sm:grid-cols-2"><label className="card p-5 text-[13px] font-semibold text-slate-700 sm:p-6">{t('dictation')}<p className="mt-1 text-xs font-normal leading-5 text-slate-500">{t('dictationHint')}</p><textarea value={dictation} onChange={(e) => setDictation(e.target.value)} rows={3} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-normal leading-6 text-slate-800 shadow-sm" /></label><label className="card p-5 text-[13px] font-semibold text-slate-700 sm:p-6">{t('notes')}<p className="mt-1 text-xs font-normal leading-5 text-slate-500">{t('notesHint')}</p><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-normal leading-6 text-slate-800 shadow-sm" /></label></section>
      {(error || message) && <p role={error ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm font-medium ${error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>{error || message}</p>}
      <div className="card sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 !bg-white/90 px-4 py-3 shadow-[0_12px_32px_-12px_rgba(15,45,40,.35)] backdrop-blur sm:px-5"><p className="text-sm text-slate-500">{t('submitHint')}</p><button disabled={saving || !classes.length || !subjects.length} className="btn-primary !px-6 !py-3">{saving ? t('saving') : editingId ? t('updatePlan') : t('save')}</button></div>
    </form>
  </main>;
}
