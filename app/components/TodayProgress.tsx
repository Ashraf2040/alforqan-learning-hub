'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

type SchoolClass = { id: string; name: string };
type Subject = { id: string; name: string };
type Lesson = {
  id: string; classId: string; subjectId: string; teacherId?: string; date: string; unit: string; pages: string;
  lesson: string; objective: string; homework?: string | null; comments?: string | null;
  class?: SchoolClass; subject?: Subject; teacher?: { id: string; name: string; username: string };
};
type FormFields = { classIds: string[]; subjectId: string; date: string; unit: string; pages: string; lesson: string; objective: string; homework: string; comments: string };
const today = () => new Date().toLocaleDateString('en-CA');
const inputClass = 'mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-700/10';
const labelClass = 'text-[13px] font-semibold text-slate-600';
const blankForm = (): FormFields => ({ classIds: [], subjectId: '', date: today(), unit: '', pages: '', lesson: '', objective: '', homework: '', comments: '' });
const escapeHtml = (value: unknown) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
function sanitizeReportMarkup(markup: string) {
  const parsed = new DOMParser().parseFromString(markup, 'text/html');
  const allowed = new Set(['TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD']);
  const copySafe = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent ?? '');
    if (!(node instanceof Element) || !allowed.has(node.tagName)) return null;
    const safe = document.createElement(node.tagName.toLowerCase());
    node.childNodes.forEach((child) => { const copied = copySafe(child); if (copied) safe.appendChild(copied); });
    return safe;
  };
  return [...parsed.body.childNodes].map(copySafe).filter(Boolean).map((node) => (node as Element).outerHTML ?? node?.textContent ?? '').join('');
}

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed.');
  return data;
}

export function TeacherTodayProgress() {
  const t = useTranslations('dailyProgress');
  const locale = useLocale();
  const [date, setDate] = useState(today);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rows, setRows] = useState<Lesson[]>([]);
  const [form, setForm] = useState<FormFields>(blankForm);
  const [editingId, setEditingId] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    void jsonRequest('/api/teacher/options').then((data) => { setClasses(data.classes ?? []); setSubjects(data.subjects ?? []); })
      .catch((issue) => setError(issue instanceof Error ? issue.message : t('loadError')));
  }, []);

  async function reload(selectedDate = date) {
    setLoading(true);
    try { setRows(await jsonRequest(`/api/lessons?date=${encodeURIComponent(selectedDate)}`)); setError(''); }
    catch (issue) { setError(issue instanceof Error ? issue.message : t('loadError')); }
    finally { setLoading(false); }
  }
  useEffect(() => { void reload(date); }, [date]);

  const selectedSubjects = useMemo(() => subjects, [subjects]);
  function update(field: Exclude<keyof FormFields, 'classIds'>, value: string) { setForm((current) => ({ ...current, [field]: value })); }
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    const { classIds, subjectId, date: formDate, ...details } = form;
    if (!editingId && classIds.length === 0) { setError(t('selectClassError')); setBusy(false); return; }
    try {
      if (editingId) await jsonRequest(`/api/lessons/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(details) });
      else await jsonRequest('/api/lessons', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...details, classIds, subjectId, date: formDate }) });
      setNotice(editingId ? t('updated') : t('savedMultiple', { count: classIds.length }));
      setEditingId(''); setForm({ ...blankForm(), date: formDate, classIds: editingId ? classIds : [], subjectId });
      if (date !== formDate) setDate(formDate); else await reload(formDate);
    } catch (issue) { setError(issue instanceof Error ? issue.message : t('saveError')); }
    finally { setBusy(false); }
  }
  function edit(row: Lesson) {
    setEditingId(row.id);
    setForm({ classIds: [row.classId], subjectId: row.subjectId, date: row.date.slice(0, 10), unit: row.unit, pages: row.pages,
      lesson: row.lesson, objective: row.objective, homework: row.homework ?? '', comments: row.comments ?? '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  async function remove(row: Lesson) {
    if (!window.confirm(t('confirmDelete'))) return;
    setError('');
    try { await jsonRequest(`/api/lessons/${row.id}`, { method: 'DELETE' }); setRows((current) => current.filter((item) => item.id !== row.id)); setNotice(t('deleted')); }
    catch (issue) { setError(issue instanceof Error ? issue.message : t('deleteError')); }
  }
  const field = (name: Exclude<keyof FormFields, 'classIds'>) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => update(name, event.target.value);

  return <div className="space-y-6">
    <section className="card !rounded-3xl p-5 shadow-sm sm:p-7">
      <div className="mb-6"><p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-100">{t('teacherEyebrow')}</p><h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{t('teacherTitle')}</h2><p className="mt-1 text-sm leading-6 text-slate-500">{t('teacherHint')}</p></div>
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className={labelClass}>{t('date')}<input required type="date" value={form.date} onChange={field('date')} className={inputClass} /></label>
        <fieldset className="sm:col-span-2 lg:col-span-2"><legend className={labelClass}>{t('class')} · {t('chooseClassesHint')}</legend><div className="mt-2 grid max-h-36 grid-cols-2 gap-2 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-3">{classes.map((item) => <label key={item.id} className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" disabled={Boolean(editingId)} checked={form.classIds.includes(item.id)} onChange={(event) => setForm((current) => ({ ...current, classIds: event.target.checked ? [...current.classIds, item.id] : current.classIds.filter((id) => id !== item.id) }))} className="rounded border-slate-300 text-emerald-700 focus:ring-emerald-600" />{item.name}</label>)}</div></fieldset>
        <label className={labelClass}>{t('subject')}<select required value={form.subjectId} onChange={field('subjectId')} className={inputClass}><option value="">{t('chooseSubject')}</option>{selectedSubjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className={labelClass}>{t('unit')}<input required value={form.unit} onChange={field('unit')} className={inputClass} /></label>
        <label className={labelClass}>{t('pages')}<input required value={form.pages} onChange={field('pages')} className={inputClass} /></label>
        <label className={labelClass}>{t('lesson')}<input required value={form.lesson} onChange={field('lesson')} className={inputClass} /></label>
        <label className={`${labelClass} sm:col-span-2`}>{t('objective')}<textarea required rows={2} value={form.objective} onChange={field('objective')} className={inputClass} /></label>
        <label className={labelClass}>{t('homework')}<textarea rows={2} value={form.homework} onChange={field('homework')} className={inputClass} /></label>
        <label className={labelClass}>{t('comments')}<textarea rows={2} value={form.comments} onChange={field('comments')} className={inputClass} /></label>
        {(error || notice) && <p role={error ? 'alert' : 'status'} className={`sm:col-span-2 lg:col-span-4 rounded-xl border px-4 py-3 text-sm ${error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>{error || notice}</p>}
        <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4"><button disabled={busy} className="btn-primary disabled:opacity-50">{busy ? t('saving') : editingId ? t('update') : t('save')}</button>{editingId && <button type="button" onClick={() => { setEditingId(''); setForm(blankForm()); }} className="btn-secondary">{t('cancel')}</button>}</div>
      </form>
    </section>

    <section className="grid gap-3 sm:grid-cols-3"><article className="card p-5"><p className="text-sm font-medium text-slate-500">{t('assignedClasses')}</p><p className="mt-2 text-3xl font-bold text-slate-900">{classes.length}</p></article><article className="card p-5"><p className="text-sm font-medium text-slate-500">{t('assignedSubjects')}</p><p className="mt-2 text-3xl font-bold text-slate-900">{subjects.length}</p></article><article className="card p-5"><p className="text-sm font-medium text-slate-500">{t('lessonsForDate')}</p><p className="mt-2 text-3xl font-bold text-emerald-800">{rows.length}</p></article></section>

    <section className="card overflow-hidden !rounded-3xl shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-100 px-5 py-5 sm:px-7"><div><h2 className="text-lg font-bold text-slate-900">{t('teacherListTitle')}</h2><p className="mt-1 text-sm text-slate-500">{t('teacherListHint')}</p></div><div className="flex items-end gap-2"><label className={labelClass}>{t('date')}<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 block rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800" /></label><button type="button" onClick={() => void reload()} className="btn-secondary !px-3.5 !py-2">{t('refresh')}</button></div></div>
      {loading ? <p className="px-5 py-12 text-center text-sm text-slate-500">{t('loading')}</p> : rows.length === 0 ? <p className="px-5 py-12 text-center text-sm text-slate-500">{t('empty')}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr>{[t('class'),t('subject'),t('unit'),t('lesson'),t('objective'),t('pages'),t('actions')].map((title) => <th key={title} className="px-4 py-3 text-start">{title}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{rows.map((row) => <tr key={row.id} className="hover:bg-emerald-50/40"><td className="px-4 py-3 font-semibold text-slate-800">{row.class?.name}</td><td className="px-4 py-3 text-slate-700">{row.subject?.name}</td><td className="px-4 py-3 text-slate-600">{row.unit}</td><td className="max-w-48 truncate px-4 py-3 text-slate-600" title={row.lesson}>{row.lesson}</td><td className="max-w-56 truncate px-4 py-3 text-slate-600" title={row.objective}>{row.objective}</td><td className="px-4 py-3 text-slate-600">{row.pages}</td><td className="px-4 py-3"><div className="flex gap-2"><button type="button" onClick={() => edit(row)} className="btn-secondary !px-3 !py-1.5">{t('edit')}</button><button type="button" onClick={() => void remove(row)} className="btn-danger !px-3 !py-1.5">{t('delete')}</button></div></td></tr>)}</tbody></table></div>}
      <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500 sm:px-7">{new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en-GB', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00.000Z`))} · {rows.length} {t('recorded')}</p>
    </section>
  </div>;
}

type TeacherStatus = { id: string; name: string; username: string; expected: number; submitted: number; missingSubjects: string[] };
type ScheduledTeacher = { id: string; name: string; username: string; classes: { classId: string; className: string; expected: number; submitted: number; subjects: { name: string; submitted: boolean }[] }[] };
type ScheduleRow = { dayIndex: number; subjectId: string; teacherId: string; session?: number; start?: string; end?: string };
type ManagementTeacher = { id: string; name: string; username: string; classes: SchoolClass[]; classTeacherAssignments: { class: SchoolClass }[]; subjects: Subject[]; subjectTeacherAssignments: { subject: Subject }[] };
type ManagementData = { teachers: ManagementTeacher[]; classes: SchoolClass[]; subjects: Subject[] };

function AdminAcademicTools({ view, data, onRefresh }: { view: 'teacher-details' | 'teacher-cards' | 'classes' | 'subjects'; data: ManagementData; onRefresh: () => void }) {
  const t = useTranslations('dailyProgress');
  const [name, setName] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const type = view === 'classes' ? 'class' : 'subject';
  const records = type === 'class' ? data.classes : data.subjects;
  async function create(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try { await jsonRequest('/api/admin/academic-management', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, name }) }); setName(''); onRefresh(); }
    catch (issue) { setError(issue instanceof Error ? issue.message : t('loadError')); }
    finally { setBusy(false); }
  }
  async function remove(id: string) {
    if (!window.confirm(t('confirmRemove'))) return;
    setBusy(true); setError('');
    try { await jsonRequest('/api/admin/academic-management', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, id }) }); onRefresh(); }
    catch (issue) { setError(issue instanceof Error ? issue.message : t('loadError')); }
    finally { setBusy(false); }
  }
  if (view === 'teacher-details') return <section className="card overflow-hidden !rounded-3xl"><div className="border-b border-slate-100 px-5 py-4 sm:px-7"><h3 className="font-bold text-slate-900">{t('showTeacherDetails')}</h3><p className="mt-1 text-sm text-slate-500">{t('teacherManagementHint')}</p></div><div className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500"><tr>{[t('teacher'),t('username'),t('class'),t('subject')].map((item) => <th key={item} className="px-5 py-3 text-start">{item}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{data.teachers.map((teacher) => <tr key={teacher.id}><td className="px-5 py-3 font-semibold text-slate-800">{teacher.name}</td><td className="px-5 py-3 text-slate-600">{teacher.username}</td><td className="px-5 py-3 text-slate-600">{[...new Map([...teacher.classes, ...teacher.classTeacherAssignments.map((x) => x.class)].map((x) => [x.id, x])).values()].map((x) => x.name).join(', ') || '—'}</td><td className="px-5 py-3 text-slate-600">{[...new Map([...teacher.subjects, ...teacher.subjectTeacherAssignments.map((x) => x.subject)].map((x) => [x.id, x])).values()].map((x) => x.name).join(', ') || '—'}</td></tr>)}</tbody></table></div>{!data.teachers.length && <p className="p-8 text-center text-sm text-slate-500">{t('noManagedTeachers')}</p>}</section>;
  if (view === 'teacher-cards') return <section className="card !rounded-3xl p-5 sm:p-7"><div className="mb-4"><h3 className="font-bold text-slate-900">{t('teacherCards')}</h3><p className="mt-1 text-sm text-slate-500">{t('teacherManagementHint')}</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{data.teachers.map((teacher) => <article key={teacher.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><div className="flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-full bg-emerald-50 font-bold text-emerald-900">{teacher.name.slice(0, 1).toLocaleUpperCase()}</span><div><h4 className="font-bold text-slate-900">{teacher.name}</h4><p className="text-xs text-slate-500">@{teacher.username}</p></div></div><p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-400">{t('class')}</p><p className="mt-1 text-sm text-slate-700">{[...new Map([...teacher.classes, ...teacher.classTeacherAssignments.map((x) => x.class)].map((x) => [x.id, x])).values()].map((x) => x.name).join(', ') || '—'}</p><p className="mt-3 text-xs font-bold uppercase tracking-wide text-slate-400">{t('subject')}</p><p className="mt-1 text-sm text-slate-700">{[...new Map([...teacher.subjects, ...teacher.subjectTeacherAssignments.map((x) => x.subject)].map((x) => [x.id, x])).values()].map((x) => x.name).join(', ') || '—'}</p></article>)}</div>{!data.teachers.length && <p className="py-8 text-center text-sm text-slate-500">{t('noManagedTeachers')}</p>}</section>;
  return <section className="card !rounded-3xl p-5 shadow-sm sm:p-7"><div className="mb-4"><h3 className="font-bold text-slate-900">{type === 'class' ? t('manageClasses') : t('manageSubjects')}</h3><p className="mt-1 text-sm text-slate-500">{type === 'class' ? t('manageClassesHint') : t('manageSubjectsHint')}</p></div><form onSubmit={create} className="flex flex-col gap-3 sm:flex-row"><input required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder={type === 'class' ? t('className') : t('subjectName')} className={inputClass}/><button disabled={busy} className="btn-primary shrink-0">{busy ? t('saving') : t('create')}</button></form>{error && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}<div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{records.map((item) => <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"><span className="font-medium text-slate-800">{item.name}</span><button type="button" disabled={busy} onClick={() => void remove(item.id)} className="text-sm font-semibold text-rose-700 hover:text-rose-900 disabled:opacity-40">{t('remove')}</button></div>)}</div></section>;
}
export function AdminTodayProgress() {
  const t = useTranslations('dailyProgress');
  const locale = useLocale();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classId, setClassId] = useState('');
  const [date, setDate] = useState(today);
  const [teachers, setTeachers] = useState<TeacherStatus[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [allTeachers, setAllTeachers] = useState<ScheduledTeacher[]>([]);
  const [allLoaded, setAllLoaded] = useState(false);
  const [showAssigned, setShowAssigned] = useState(false);
  const [scheduleOptions, setScheduleOptions] = useState<{ subjects: Subject[]; teachers: { id: string; name: string }[] }>({ subjects: [], teachers: [] });
  const [scheduleList, setScheduleList] = useState<{ classId: string; items: ScheduleRow[] }[]>([]);
  const [scheduleClassId, setScheduleClassId] = useState('');
  const [scheduleRows, setScheduleRows] = useState<ScheduleRow[]>([]);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState('');
  const [managementData, setManagementData] = useState<ManagementData>({ teachers: [], classes: [], subjects: [] });
  const [managementView, setManagementView] = useState<'teacher-details' | 'teacher-cards' | 'classes' | 'subjects' | null>(null);
  const [showScheduleHub, setShowScheduleHub] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { void jsonRequest('/api/admin/daily-progress').then((data) => setClasses(data.classes ?? [])).catch((issue) => setError(issue.message || t('loadError'))); }, []);
  async function refreshManagement() { try { const data = await jsonRequest('/api/admin/academic-management'); setManagementData(data); setClasses(data.classes ?? []); } catch (issue) { setError(issue instanceof Error ? issue.message : t('loadError')); } }
  useEffect(() => { void refreshManagement(); }, []);
  async function load(showTeacherList = false) {
    if (!classId) { setError(t('selectClassError')); return; }
    setLoading(true); setError('');
    try { const data = await jsonRequest(`/api/admin/daily-progress?classId=${encodeURIComponent(classId)}&date=${encodeURIComponent(date)}`); setTeachers(data.teachers ?? []); setLessons(data.lessons ?? []); setShowAssigned(showTeacherList); setLoaded(true); setAllLoaded(false); }
    catch (issue) { setError(issue instanceof Error ? issue.message : t('loadError')); }
    finally { setLoading(false); }
  }
  async function loadAll() {
    setLoading(true); setError('');
    try { const data = await jsonRequest(`/api/admin/daily-progress?mode=all&date=${encodeURIComponent(date)}`); setAllTeachers(data.allTeachers ?? []); setLessons(data.lessons ?? []); setAllLoaded(true); setLoaded(false); }
    catch (issue) { setError(issue instanceof Error ? issue.message : t('loadError')); }
    finally { setLoading(false); }
  }
  async function loadScheduleOptions() {
    try {
      const data = await jsonRequest('/api/admin/schedules');
      setClasses(data.classes ?? []); setScheduleOptions({ subjects: data.subjects ?? [], teachers: data.teachers ?? [] });
      setScheduleList(data.schedules ?? []);
      const selected = (data.schedules ?? []).find((item: { classId: string }) => item.classId === scheduleClassId);
      setScheduleRows(selected?.items.map((item: ScheduleRow) => ({ ...item, teacherId: item.teacherId ?? '', session: item.session ?? 0, start: item.start ?? '', end: item.end ?? '' })) ?? []);
    } catch (issue) { setError(issue instanceof Error ? issue.message : t('loadError')); }
  }
  async function saveSchedule() {
    if (!scheduleClassId) return;
    setScheduleBusy(true); setScheduleMessage('');
    try {
      await jsonRequest('/api/admin/schedules', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ classId: scheduleClassId, entries: scheduleRows }) });
      setScheduleList((current) => [...current.filter((item) => item.classId !== scheduleClassId), { classId: scheduleClassId, items: scheduleRows }]);
      setScheduleMessage(t('scheduleSaved'));
    } catch (issue) { setScheduleMessage(issue instanceof Error ? issue.message : t('loadError')); }
    finally { setScheduleBusy(false); }
  }
  function printReport(title: string, body: string) {
    const popup = window.open('', '_blank', 'width=1000,height=800');
    if (!popup) { setError(t('printPopupBlocked')); return; }
    popup.opener = null;
    popup.document.write(`<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>body{font:14px Arial,sans-serif;color:#172033;margin:36px}h1{font-size:24px;margin:0 0 6px}p{color:#64748b;margin:0 0 20px}table{width:100%;border-collapse:collapse;margin:18px 0}th,td{border:1px solid #cbd5e1;padding:9px;text-align:start;vertical-align:top}th{background:#f1f5f9}.brand{color:#047857;font-weight:bold}@media print{body{margin:14mm}button{display:none}}</style></head><body><div class="brand">${escapeHtml(t('brand'))}</div><h1>${escapeHtml(title)}</h1><p>${new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en-GB', { dateStyle: 'full', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00Z`))}</p>${sanitizeReportMarkup(body)}<script>window.onload=()=>window.print()</script></body></html>`);
    popup.document.close();
  }
  function exportCsv() {
    const rows = [
      [t('date'), t('class'), t('subject'), t('teacher'), t('unit'), t('lesson'), t('objective'), t('pages'), t('homework'), t('comments')],
      ...lessons.map((item) => [date, className ?? '', item.subject?.name ?? '', item.teacher?.name ?? '', item.unit, item.lesson, item.objective, item.pages, item.homework ?? '', item.comments ?? '']),
    ];
    const csv = `\uFEFF${rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n')}`;
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = `daily-progress-${date}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }
  const complete = teachers.filter((item) => item.expected > 0 && item.submitted >= item.expected).length;
  const missing = teachers.filter((item) => item.submitted < item.expected).length;
  const className = classes.find((item) => item.id === classId)?.name;
  return <div className="space-y-6">
    <section className="card !rounded-3xl p-5 shadow-sm sm:p-7"><p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-100">{t('adminEyebrow')}</p><h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{t('adminTitle')}</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{t('adminHint')}</p>
      <form onSubmit={(event) => { event.preventDefault(); void load(); }} className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end"><label className={labelClass}>{t('class')}<select required value={classId} onChange={(event) => { setClassId(event.target.value); setLoaded(false); }} className={inputClass}><option value="">{t('chooseClass')}</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className={labelClass}>{t('date')}<input required type="date" value={date} onChange={(event) => { setDate(event.target.value); setLoaded(false); setAllLoaded(false); }} className={inputClass} /></label><button disabled={loading} className="btn-primary !py-3 disabled:opacity-50">{loading ? t('loading') : t('show')}</button><button type="button" disabled={loading} onClick={() => { setLoaded(false); setAllLoaded(false); setShowAssigned(false); }} className="btn-secondary !py-3 disabled:opacity-50">{t('hide')}</button><button type="button" disabled={loading || !classId} onClick={() => { if (loaded) document.getElementById('daily-teacher-status')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); else void load(true); }} className="btn-secondary !py-3 disabled:opacity-50">{t('teachers')}</button><button type="button" disabled={loading} onClick={() => void loadAll()} className="btn-secondary !py-3 disabled:opacity-50">{t('allTeachers')}</button></form>
    </section>
    <section aria-label={t('managementTools')} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">{[[t('teachers'), managementData.teachers.length], [t('classes'), managementData.classes.length], [t('subjects'), managementData.subjects.length]].map(([label, count]) => <article key={String(label)} className="card flex items-center gap-3 p-4"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-800">{String(label) === t('teachers') ? '♙' : String(label) === t('classes') ? '▦' : '▤'}</span><div><p className="text-xl font-bold text-slate-900">{count}</p><p className="text-sm text-slate-500">{label}</p></div></article>)}</div>
      <nav aria-label={t('managementTools')} className="flex flex-wrap gap-2">
        <a href="/admin/people#create-teacher" className="btn-primary no-underline">＋ {t('createTeacher')}</a>
        <button type="button" onClick={() => { setManagementView(managementView === 'teacher-details' ? null : 'teacher-details'); void refreshManagement(); }} className="btn-secondary">♙ {t('showTeacherDetails')}</button>
        <button type="button" onClick={() => { setManagementView(managementView === 'teacher-cards' ? null : 'teacher-cards'); void refreshManagement(); }} className="btn-primary !bg-amber-600">▦ {t('teacherCards')}</button>
        <button type="button" onClick={() => { setShowScheduleHub((current) => !current); setManagementView(null); }} className="btn-primary">▦ {t('schedulesHub')}</button>
        <button type="button" onClick={() => { setManagementView(managementView === 'classes' ? null : 'classes'); void refreshManagement(); }} className="btn-secondary">＋ {t('manageClasses')}</button>
        <button type="button" onClick={() => { setManagementView(managementView === 'subjects' ? null : 'subjects'); void refreshManagement(); }} className="btn-primary">＋ {t('manageSubjects')}</button>
        <a href="/admin/people#csv-imports" className="btn-secondary no-underline">⇧ {t('importTeachers')}</a>
      </nav>
      {managementView && <AdminAcademicTools view={managementView} data={managementData} onRefresh={() => void refreshManagement()} />}
    </section>
    <details open={showScheduleHub} className="card !rounded-3xl p-5 shadow-sm sm:p-7" onToggle={(event) => { const opened = (event.currentTarget as HTMLDetailsElement).open; setShowScheduleHub(opened); if (opened && !scheduleOptions.subjects.length) void loadScheduleOptions(); }}><summary className="cursor-pointer font-bold text-slate-900">{t('scheduleSetup')}</summary><p className="mt-2 text-sm text-slate-500">{t('scheduleSetupHint')}</p><div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end"><label className={labelClass}>{t('class')}<select value={scheduleClassId} onChange={(event) => { const selectedId = event.target.value; setScheduleClassId(selectedId); setScheduleRows(scheduleList.find((item) => item.classId === selectedId)?.items.map((item) => ({ ...item, teacherId: item.teacherId ?? '' })) ?? []); }} className={inputClass}><option value="">{t('chooseClass')}</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><button type="button" onClick={() => setScheduleRows((current) => [...current, { dayIndex: 0, subjectId: '', teacherId: '', session: 0, start: '', end: '' }])} className="btn-secondary !py-3">{t('addScheduleEntry')}</button></div>{scheduleRows.map((row, index) => <div key={index} className="mt-3 grid gap-2 rounded-xl border border-slate-100 p-3 sm:grid-cols-2 xl:grid-cols-[.8fr_1fr_1fr_.5fr_.8fr_.8fr_auto] sm:items-end"><label className={labelClass}>{t('day')}<select value={row.dayIndex} onChange={(event) => setScheduleRows((current) => current.map((item, i) => i === index ? { ...item, dayIndex: Number(event.target.value) } : item))} className={inputClass}>{[t('sunday'),t('monday'),t('tuesday'),t('wednesday'),t('thursday'),t('friday'),t('saturday')].map((day, dayIndex) => <option key={dayIndex} value={dayIndex}>{day}</option>)}</select></label><label className={labelClass}>{t('subject')}<select required value={row.subjectId} onChange={(event) => setScheduleRows((current) => current.map((item, i) => i === index ? { ...item, subjectId: event.target.value } : item))} className={inputClass}><option value="">{t('chooseSubject')}</option>{scheduleOptions.subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className={labelClass}>{t('teacher')}<select value={row.teacherId} onChange={(event) => setScheduleRows((current) => current.map((item, i) => i === index ? { ...item, teacherId: event.target.value } : item))} className={inputClass}><option value="">{t('autoAssignTeacher')}</option>{scheduleOptions.teachers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label className={labelClass}>{t('session')}<input type="number" min="1" value={row.session ?? 0} onChange={(event) => setScheduleRows((current) => current.map((item, i) => i === index ? { ...item, session: Number(event.target.value) } : item))} className={inputClass}/></label><label className={labelClass}>{t('startTime')}<input type="time" value={row.start ?? ''} onChange={(event) => setScheduleRows((current) => current.map((item, i) => i === index ? { ...item, start: event.target.value } : item))} className={inputClass}/></label><label className={labelClass}>{t('endTime')}<input type="time" value={row.end ?? ''} onChange={(event) => setScheduleRows((current) => current.map((item, i) => i === index ? { ...item, end: event.target.value } : item))} className={inputClass}/></label><button type="button" onClick={() => setScheduleRows((current) => current.filter((_, i) => i !== index))} className="btn-danger !px-3 !py-2">{t('remove')}</button></div>)}<div className="mt-4 flex flex-wrap items-center gap-3"><button type="button" disabled={scheduleBusy || !scheduleClassId} onClick={() => void saveSchedule()} className="btn-primary disabled:opacity-50">{scheduleBusy ? t('saving') : t('saveSchedule')}</button>{scheduleMessage && <span role="status" className="text-sm text-emerald-800">{scheduleMessage}</span>}</div></details>
    {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
    {loaded && <>
      <section className="grid gap-3 sm:grid-cols-3"><article className="card p-5"><p className="text-sm font-medium text-slate-500">{t('lessonsRecorded')}</p><p className="mt-2 text-3xl font-bold text-slate-900">{lessons.length}</p></article><article className="card p-5"><p className="text-sm font-medium text-slate-500">{t('teachersComplete')}</p><p className="mt-2 text-3xl font-bold text-emerald-800">{complete}</p></article><article className="card p-5"><p className="text-sm font-medium text-slate-500">{t('teachersPending')}</p><p className="mt-2 text-3xl font-bold text-amber-700">{missing}</p></article></section>
      <section id="daily-teacher-status" className="card overflow-hidden !rounded-3xl"><div className="border-b border-slate-100 px-5 py-4 sm:px-7"><h3 className="font-bold text-slate-900">{t('teacherStatus')} · {className} · {new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en-GB', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${date}T12:00:00.000Z`))}</h3></div>{teachers.length ? <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3 text-start">{t('teacher')}</th><th className="px-5 py-3 text-start">{t('progress')}</th><th className="px-5 py-3 text-start">{t('status')}</th><th className="px-5 py-3 text-start">{t('missingSubjects')}</th></tr></thead><tbody className="divide-y divide-slate-100">{teachers.map((teacher) => { const done = teacher.expected > 0 && teacher.submitted >= teacher.expected; return <tr key={teacher.id} className="hover:bg-emerald-50/40"><td className="px-5 py-3.5"><span className="block font-semibold text-slate-800">{teacher.name}</span><span className="text-xs text-slate-500">{teacher.username}</span></td><td className="px-5 py-3.5 text-slate-700">{teacher.submitted} / {teacher.expected}</td><td className="px-5 py-3.5"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${done ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200' : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200'}`}>{done ? t('complete') : t('pending')}</span></td><td className="px-5 py-3.5 text-slate-600">{teacher.missingSubjects.join(', ') || '—'}</td></tr>; })}</tbody></table></div> : <p className="px-5 py-12 text-center text-sm text-slate-500">{t('noTeachers')}</p>}</section>
      <section className="card overflow-hidden !rounded-3xl"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-7"><h3 className="font-bold text-slate-900">{t('lessonRecords')}</h3><div className="flex gap-2"><button type="button" disabled={!lessons.length} onClick={exportCsv} className="btn-secondary !px-3.5 !py-2 disabled:opacity-40">{t('exportCsv')}</button><button type="button" disabled={!lessons.length} onClick={() => printReport(`${t('lessonRecords')} · ${className}`, `<table><thead><tr>${[t('subject'),t('teacher'),t('unit'),t('lesson'),t('objective'),t('pages'),t('homework'),t('comments')].map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>${lessons.map((x) => `<tr><td>${x.subject?.name ?? ''}</td><td>${x.teacher?.name ?? ''}</td><td>${x.unit}</td><td>${x.lesson}</td><td>${x.objective}</td><td>${x.pages}</td><td>${x.homework ?? '—'}</td><td>${x.comments ?? '—'}</td></tr>`).join('')}</tbody></table>`)} className="btn-secondary !px-3.5 !py-2 disabled:opacity-40">{t('printReport')}</button></div></div>{lessons.length ? <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-sm"><thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr>{[t('subject'),t('teacher'),t('unit'),t('lesson'),t('objective'),t('pages'),t('homework')].map((title) => <th key={title} className="px-4 py-3 text-start">{title}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{lessons.map((row) => <tr key={row.id}><td className="px-4 py-3 font-semibold text-slate-800">{row.subject?.name}</td><td className="px-4 py-3 text-slate-700">{row.teacher?.name}</td><td className="px-4 py-3 text-slate-600">{row.unit}</td><td className="max-w-48 truncate px-4 py-3 text-slate-600" title={row.lesson}>{row.lesson}</td><td className="max-w-56 truncate px-4 py-3 text-slate-600" title={row.objective}>{row.objective}</td><td className="px-4 py-3 text-slate-600">{row.pages}</td><td className="px-4 py-3 text-slate-600">{row.homework || '—'}</td></tr>)}</tbody></table></div> : <p className="px-5 py-10 text-center text-sm text-slate-500">{t('empty')}</p>}</section>
    </>}
    {allLoaded && <section className="card overflow-hidden !rounded-3xl"><div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-7"><div><h3 className="font-bold text-slate-900">{t('allTeachers')}</h3><p className="mt-1 text-sm text-slate-500">{t('allTeachersHint')}</p></div><button type="button" onClick={() => printReport(t('allTeachers'), `<table><thead><tr><th>${t('teacher')}</th><th>${t('class')}</th><th>${t('subject')}</th><th>${t('status')}</th></tr></thead><tbody>${allTeachers.flatMap((teacher) => teacher.classes.flatMap((item) => item.subjects.map((subject) => `<tr><td>${teacher.name}</td><td>${item.className}</td><td>${subject.name}</td><td>${subject.submitted ? t('complete') : t('pending')}</td></tr>`))).join('')}</tbody></table>`)} className="btn-secondary !px-3.5 !py-2">{t('printReport')}</button></div>{allTeachers.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500"><tr>{[t('teacher'),t('class'),t('scheduledSubjects'),t('progress'),t('status')].map((title) => <th key={title} className="px-5 py-3 text-start">{title}</th>)}</tr></thead><tbody className="divide-y divide-slate-100">{allTeachers.flatMap((teacher) => teacher.classes.map((item) => <tr key={`${teacher.id}:${item.classId}`}><td className="px-5 py-3 font-semibold text-slate-800">{teacher.name}<span className="block text-xs font-normal text-slate-500">{teacher.username}</span></td><td className="px-5 py-3">{item.className}</td><td className="px-5 py-3">{item.subjects.map((subject) => subject.name).join(', ')}</td><td className="px-5 py-3">{item.submitted} / {item.expected}</td><td className="px-5 py-3">{item.submitted >= item.expected ? t('complete') : t('pending')}</td></tr>))}</tbody></table></div> : <p className="px-5 py-10 text-center text-sm text-slate-500">{t('noScheduledTeachers')}</p>}</section>}
  </div>;
}
