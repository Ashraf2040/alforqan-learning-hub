'use client';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import Image from 'next/image';
import Link from 'next/link';
import AdminNotesManager from './AdminNotesManager';
import AdminBulkAssignment from './AdminBulkAssignment';
import { createWeeklyPlannerDocx } from '@/lib/weekly-planner-docx';

type SchoolClass = { id: string; name: string; gradeId: string | null; grade?: { id: string; name: string } | null };
type Subject = { id: string; name: string };
type Grade = { id: string; name: string; classes: { id: string; name: string }[]; subjects: { position: number; subject: Subject }[] };
type Plan = { id: string; week: string; semester?: string | null; fromDate: string; toDate: string; dictation?: string | null; dictationStyle?: string | null; notes?: string | null; notesStyle?: string | null; teacher: { name: string }; items: { id: string; classwork: string; homework: string; classworkStyle?: string | null; homeworkStyle?: string | null; subject: Subject }[] };
type Payload = { grades: Grade[]; classes: SchoolClass[]; subjects: Subject[] };
type AdminNote = { id: string; content: string; scope: 'GLOBAL' | 'SPECIFIC'; week: string; grades: { id: string; name: string }[] };
type CellFormat = { start: number; end: number; fontSize?: string; color?: string; fontWeight?: '400' | '700'; textDecoration?: 'none' | 'underline' };
type TextSelection = { start: number; end: number };
type TeacherTrackerRow = { id: string; username: string; name: string; classes: { id: string; name: string }[]; subjects: { id: string; name: string }[]; submitted: boolean; submittedAt: string | null };

function formatDate(value: string, locale: string) { return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en-GB', { day: 'numeric', month: 'numeric', year: 'numeric', calendar: 'gregory' }).format(new Date(value)); }
function csvCell(value: string) { return `"${value.replaceAll('"', '""')}"`; }
function readPlanStyle(value?: string | null): React.CSSProperties {
  if (!value) return {};
  try {
    const raw = JSON.parse(value) as Record<string, unknown>;
    return {
      fontSize: typeof raw.fontSize === 'string' && /^(12|14|16|18|22|26)px$/.test(raw.fontSize) ? raw.fontSize : undefined,
      color: typeof raw.color === 'string' && /^#[0-9a-f]{6}$/i.test(raw.color) ? raw.color : undefined,
      fontWeight: raw.fontWeight === '700' ? 700 : raw.fontWeight === '400' ? 400 : undefined,
      fontStyle: raw.fontStyle === 'italic' ? 'italic' : undefined,
      textDecoration: raw.textDecoration === 'underline' ? 'underline' : undefined,
    };
  } catch { return {}; }
}
function normalizedSubject(name: string) { return name.trim().replace(/\s+/g, ' ').toLocaleLowerCase(); }
function arabicSubjectRank(name: string) {
  const key = normalizedSubject(name);
  if (key === 'arabic' || key === 'arabic language') return 0;
  if (key === 'social arabic' || key === 'social studies in arabic') return 1;
  if (key === 'islamic' || key === 'islamic studies') return 2;
  return -1;
}
function subjectLabel(name: string) {
  const rank = arabicSubjectRank(name);
  return rank === 0 ? 'اللغة العربية' : rank === 1 ? 'الدراسات الاجتماعية' : rank === 2 ? 'التربية الإسلامية' : name;
}

/* Presentation-only class tokens */
const fieldLabel = 'text-[13px] font-semibold text-slate-600';
const fieldControl = 'mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium normal-case tracking-normal text-slate-800 shadow-sm';
const tabClass = (active: boolean) => `rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors ${active ? 'bg-[#123b36] text-white shadow-md shadow-emerald-950/15' : 'text-slate-600 hover:bg-white hover:text-slate-900'}`;
const toolBtn = 'inline-flex h-9 min-w-9 items-center justify-center rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-45';

export default function AdminPage() {
  const t = useTranslations('admin');
  const locale = useLocale();
  const { data: session, status } = useSession();
  const router = useRouter();
  const [payload, setPayload] = useState<Payload>({ grades: [], classes: [], subjects: [] });
  const [tab, setTab] = useState<'planner' | 'assign' | 'manage'>('planner');
  const [gradeId, setGradeId] = useState('');
  const [classId, setClassId] = useState('');
  const [filterBy, setFilterBy] = useState<'week' | 'date'>('week');
  const [week, setWeek] = useState('');
  const [dateValue, setDateValue] = useState('');
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plannerAdminNotes, setPlannerAdminNotes] = useState<AdminNote[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [manageGradeId, setManageGradeId] = useState('');
  const [classIds, setClassIds] = useState<string[]>([]);
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [newGrade, setNewGrade] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [editValues, setEditValues] = useState(false);
  const [printDesign, setPrintDesign] = useState<'legacy' | 'planner'>('legacy');
  const [cellValues, setCellValues] = useState<Record<string, string>>({});
  const [cellFormats, setCellFormats] = useState<Record<string, CellFormat[]>>({});
  const [textSelections, setTextSelections] = useState<Record<string, TextSelection>>({});
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const [fontSize, setFontSize] = useState('12pt');
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false);
  const [trackerRows, setTrackerRows] = useState<TeacherTrackerRow[]>([]);
  const [trackerLoaded, setTrackerLoaded] = useState(false);
  const [trackerLoading, setTrackerLoading] = useState(false);
  const [trackerError, setTrackerError] = useState('');

  async function reloadManagement(selectGradeId?: string) {
    const response = await fetch('/api/admin/classes');
    if (!response.ok) throw new Error('Could not load data');
    const data = await response.json() as Payload;
    setPayload(data);
    const selected = selectGradeId ?? manageGradeId ?? data.grades[0]?.id ?? '';
    setManageGradeId(selected);
    const grade = data.grades.find((item) => item.id === selected);
    setClassIds(grade?.classes.map((item) => item.id) ?? []);
    setSubjectIds(grade?.subjects.map((item) => item.subject.id) ?? []);
    return data;
  }

  useEffect(() => { if (status === 'unauthenticated') router.replace('/login'); }, [status, router]);
  useEffect(() => { if (status === 'authenticated') void reloadManagement().catch(() => setError(t('loadError'))); }, [status]);
  useEffect(() => {
    if (!trackerOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setTrackerOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [trackerOpen]);
  useEffect(() => {
    if (!notesOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setNotesOpen(false); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [notesOpen]);
  const grades = payload.grades;
  const selectedGrade = grades.find((grade) => grade.id === gradeId);
  const selectedClass = payload.classes.find((item) => item.id === classId);
  const manageGrade = grades.find((grade) => grade.id === manageGradeId);
  const gradeClasses = useMemo(() => payload.classes.filter((item) => item.gradeId === gradeId), [payload.classes, gradeId]);

  async function loadPlanner(event?: FormEvent) {
    event?.preventDefault();
    const period = filterBy === 'week' ? week.trim() : dateValue;
    if (!gradeId || !classId || !period) { setError(t('required')); setLoaded(false); return; }
    setLoading(true); setError(''); setNotice('');
    try {
      const query = new URLSearchParams({ classId, [filterBy]: period });
      const response = await fetch(`/api/admin/plans?${query.toString()}`);
      if (!response.ok) throw new Error('Load failed');
      const planData = await response.json() as Plan[];
      const selectedWeek = filterBy === 'week' ? period : planData[0]?.week;
      const notesQuery = new URLSearchParams({ gradeId, week: selectedWeek ?? '' });
      const notesResponse = await fetch(`/api/admin/notes?${notesQuery.toString()}`);
      if (!notesResponse.ok) throw new Error('Load failed');
      const notesData = await notesResponse.json();
      setPlans(planData); setPlannerAdminNotes(notesData.notes ?? []); setCellValues({}); setCellFormats({}); setActiveCell(null); setLoaded(true);
    } catch { setError(t('loadError')); setPlans([]); setPlannerAdminNotes([]); setLoaded(false); }
    finally { setLoading(false); }
  }

  async function loadTeacherTracker() {
    setTrackerOpen(true);
    const selectedPeriod = filterBy === 'week' ? week.trim() : dateValue;
    if (!gradeId || !selectedPeriod) { setTrackerError(t('trackerRequired')); setTrackerLoaded(false); return; }
    setTrackerLoading(true); setTrackerError('');
    try {
      const query = new URLSearchParams({ gradeId, [filterBy]: selectedPeriod });
      const response = await fetch(`/api/admin/teacher-status?${query.toString()}`);
      if (!response.ok) throw new Error('Tracker load failed');
      setTrackerRows(await response.json() as TeacherTrackerRow[]);
      setTrackerLoaded(true);
    } catch { setTrackerRows([]); setTrackerLoaded(false); setTrackerError(t('trackerError')); }
    finally { setTrackerLoading(false); }
  }

  const planRows = useMemo(() => {
    const submitted = plans.flatMap((plan) => plan.items.map((item) => ({ subjectId: item.subject.id, subject: item.subject.name, classwork: item.classwork, homework: item.homework })));
    const assigned = selectedGrade?.subjects.map(({ subject }) => ({ subjectId: subject.id, subject: subject.name })) ?? [];
    const names = new Map<string, string>();
    for (const row of assigned) names.set(row.subjectId, row.subject);
    if (!assigned.length) for (const row of submitted) names.set(row.subjectId, row.subject);
    return [...names].sort((a, b) => {
      if (assigned.length) return assigned.findIndex((row) => row.subjectId === a[0]) - assigned.findIndex((row) => row.subjectId === b[0]);
      const rankA = arabicSubjectRank(a[1]);
      const rankB = arabicSubjectRank(b[1]);
      if (rankA >= 0 && rankB < 0) return 1;
      if (rankA < 0 && rankB >= 0) return -1;
      if (rankA >= 0 && rankB >= 0) return rankA - rankB;
      return a[1].localeCompare(b[1], locale === 'ar' ? 'ar' : 'en');
    }).map(([subjectId, subject]) => {
      const matches = submitted.filter((row) => row.subjectId === subjectId);
      const classworkKey = `${subjectId}:classwork`;
      const homeworkKey = `${subjectId}:homework`;
      const classwork = matches.map((row) => row.classwork).filter(Boolean).join('\n');
      const homework = matches.map((row) => row.homework).filter(Boolean).join('\n');
      return { subjectId, subject, classwork: cellValues[classworkKey] ?? classwork, homework: cellValues[homeworkKey] ?? homework };
    });
  }, [plans, selectedGrade, locale, cellValues]);

  const combinedNotes = [...plans.map((plan) => plan.notes), ...plannerAdminNotes.map((note) => note.content)].filter((value): value is string => Boolean(value)).join('\n');

  function changeActiveFormat(update: (current: CellFormat) => CellFormat) {
    if (!activeCell) return;
    const selected = textSelections[activeCell];
    const row = planRows.find((item) => activeCell === item.subjectId + ':classwork' || activeCell === item.subjectId + ':homework');
    if (!row && activeCell !== '__notes') return;
    const value = activeCell === '__notes' ? (cellValues.__notes ?? combinedNotes) : activeCell.endsWith(':classwork') ? row!.classwork : row!.homework;
    const start = selected && selected.end > selected.start ? selected.start : 0;
    const end = selected && selected.end > selected.start ? selected.end : value.length;
    if (end <= start) return;
    setCellFormats((current) => ({ ...current, [activeCell]: [...(current[activeCell] ?? []), { ...update({ start, end }), start, end }] }));
  }

  function captureTextSelection(key: string, event: React.SyntheticEvent<HTMLTextAreaElement>) {
    const input = event.currentTarget;
    setActiveCell(key);
    setTextSelections((current) => ({ ...current, [key]: { start: input.selectionStart, end: input.selectionEnd } }));
  }

  function toggleBold() {
    changeActiveFormat((current) => ({ ...current, fontWeight: current.fontWeight === '700' ? '400' : '700' }));
  }

  function toggleUnderline() {
    changeActiveFormat((current) => ({ ...current, textDecoration: current.textDecoration === 'underline' ? 'none' : 'underline' }));
  }

  function renderFormattedText(key: string, value: string, forceBold = false) {
    const formats = cellFormats[key] ?? [];
    const points = [...new Set([0, value.length, ...formats.flatMap((format) => [Math.max(0, Math.min(value.length, format.start)), Math.max(0, Math.min(value.length, format.end))])])].sort((a, b) => a - b);
    if (!value) return forceBold ? <strong>—</strong> : '—';
    return points.slice(0, -1).map((from, index) => {
      const to = points[index + 1];
      const format = formats.filter((item) => item.start < to && item.end > from).reduce((merged, item) => ({ ...merged, ...item }), {} as CellFormat);
      const text = value.slice(from, to);
      return Object.keys(format).length ? <span key={from} style={{ color: format.color, fontSize: format.fontSize, fontWeight: forceBold ? 900 : format.fontWeight, textDecoration: format.textDecoration }}>{text}</span> : <span key={from} style={forceBold ? { fontWeight: 900 } : undefined}>{text}</span>;
    });
  }

  function renderPlanValue(subjectId: string, field: 'classwork' | 'homework', value: string) {
    const key = `${subjectId}:${field}`;
    const actualValue = cellValues[key] ?? value;
    const selectedClass = activeCell === key ? 'planner-value-selected' : '';
    const savedStyle = readPlanStyle(plans.map((plan) => plan.items.find((item) => item.subject.id === subjectId)?.[`${field}Style`]).find(Boolean));
    if (editValues) return <textarea style={{ ...savedStyle, fontWeight: 900 }} aria-label={`${field} for ${subjectId}`} dir="auto" rows={Math.min(6, Math.max(1, actualValue.split('\n').length))} value={actualValue} onFocus={(event) => captureTextSelection(key, event)} onSelect={(event) => captureTextSelection(key, event)} onMouseUp={(event) => captureTextSelection(key, event)} onKeyUp={(event) => captureTextSelection(key, event)} onChange={(event) => { setCellValues((current) => ({ ...current, [key]: event.target.value })); captureTextSelection(key, event); }} className={`planner-bold-value planner-editable-value w-full resize-none border-0 bg-transparent p-0 text-start outline-none ${selectedClass}`} />;
    return <div style={{ ...savedStyle, fontWeight: 900 }} dir="auto" onClick={() => setActiveCell(key)} className={`planner-bold-value planner-value-display w-full cursor-text rounded px-1 py-0.5 text-start transition-colors hover:bg-emerald-50/60 ${selectedClass}`}>{renderFormattedText(key, actualValue, true)}</div>;
  }

  function renderNotesValue() {
    const key = '__notes';
    const value = cellValues[key] ?? combinedNotes;
    const selectedClass = activeCell === key ? 'planner-value-selected' : '';
    const savedStyle = readPlanStyle(plans.find((plan) => plan.notesStyle)?.notesStyle);
    if (editValues) return <textarea style={savedStyle} aria-label={t('notes')} dir="auto" rows={Math.min(6, Math.max(2, value.split('\n').length))} placeholder={locale === 'ar' ? 'أضف ملاحظة لأولياء الأمور…' : 'Add a note for families…'} value={value} onFocus={(event) => captureTextSelection(key, event)} onSelect={(event) => captureTextSelection(key, event)} onMouseUp={(event) => captureTextSelection(key, event)} onKeyUp={(event) => captureTextSelection(key, event)} onChange={(event) => { setCellValues((current) => ({ ...current, [key]: event.target.value })); captureTextSelection(key, event); }} className={`planner-editable-value w-full resize-none border-0 bg-transparent p-0 text-start outline-none ${selectedClass}`} />;
    return <div style={savedStyle} dir="auto" onClick={() => setActiveCell(key)} className={`planner-value-display w-full cursor-text rounded px-1 py-0.5 text-start transition-colors hover:bg-emerald-50/60 ${selectedClass}`}>{renderFormattedText(key, value)}</div>;
  }

  const period = useMemo(() => {
    if (!plans.length) return null;
    const first = plans[0];
    const from = plans.reduce((min, plan) => plan.fromDate < min ? plan.fromDate : min, first.fromDate);
    const to = plans.reduce((max, plan) => plan.toDate > max ? plan.toDate : max, first.toDate);
    return { week: first.week, semester: first.semester || (locale === 'ar' ? 'الفصل الدراسي' : 'Semester'), from: formatDate(from, locale), to: formatDate(to, locale) };
  }, [plans, locale]);

  function downloadCsv() {
    if (!selectedGrade || !selectedClass || !period) return;
    const content = '\ufeff' + [
      [t('grade'), selectedGrade.name, t('class'), selectedClass.name, t('week'), period.week, t('from'), period.from, t('to'), period.to],
      [t('subject'), t('classwork'), t('activity')],
      ...planRows.map((row) => [row.subject, row.classwork, row.homework]),
      [t('dictation'), plans.map((plan) => plan.dictation).filter(Boolean).join('\n')],
      [t('notes'), cellValues.__notes ?? combinedNotes],
    ].map((row) => row.map((value) => csvCell(String(value ?? ''))).join(',')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
    link.download = `weekly-planner-${selectedClass.name}-week-${period.week}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  function downloadDocx() {
    if (!selectedGrade || !selectedClass || !period) return;
    const dictation = plans.map((plan) => plan.dictation).filter(Boolean).join('\n');
    const blob = createWeeklyPlannerDocx({
      school: 'AL FORQAN PRIVATE SCHOOL “AMERICAN DIVISION”', subtitle: 'AL BATOOL INTERNATIONAL SCHOOL', planner: t('weeklyPlanner'),
      grade: t('grade'), className: selectedClass.name, week: `${t('week')} (${period.week})`, semester: period.semester,
      from: `${t('from')}: ${period.from}`, to: `${t('to')}: ${period.to}`,
      headers: [t('subject'), t('classwork'), t('activity')],
      rows: planRows.map((row) => ({ subject: subjectLabel(row.subject), classwork: row.classwork, homework: row.homework })),
      dictationLabel: t('dictation'), dictation, notesLabel: t('notes'), notes: cellValues.__notes ?? combinedNotes, rtl: locale === 'ar',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `weekly-planner-${selectedClass.name}-week-${period.week}.docx`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  function printPlanner() {
    const style = document.createElement('style');
    style.media = 'print';
    style.textContent = '@page { size: A4 landscape !important; margin: 8mm !important; }';
    document.head.appendChild(style);
    const cleanup = () => { style.remove(); window.removeEventListener('afterprint', cleanup); };
    window.addEventListener('afterprint', cleanup);
    try { window.print(); } catch (error) { cleanup(); throw error; }
  }

  function changeManageGrade(id: string) {
    setManageGradeId(id);
    const grade = grades.find((item) => item.id === id);
    setClassIds(grade?.classes.map((item) => item.id) ?? []);
    setSubjectIds(grade?.subjects.map((item) => item.subject.id) ?? []);
    setNotice('');
  }

  function setSubjectPosition(subjectId: string, targetIndex: number) {
    setSubjectIds((current) => {
      const from = current.indexOf(subjectId);
      if (from < 0 || targetIndex < 0 || targetIndex >= current.length || from === targetIndex) return current;
      const reordered = [...current];
      reordered.splice(from, 1);
      reordered.splice(targetIndex, 0, subjectId);
      return reordered;
    });
  }

  async function saveGrade(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const isNew = !manageGradeId;
      const response = await fetch('/api/admin/classes', {
        method: isNew ? 'POST' : 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(isNew ? { name: newGrade, classIds, subjectIds } : { gradeId: manageGradeId, classIds, subjectIds }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Save failed');
      const updated = await reloadManagement(isNew ? result.id : manageGradeId);
      setNewGrade(''); setNotice(isNew ? t('created') : t('saved'));
      if (isNew) setManageGradeId(updated.grades.find((item) => item.name === newGrade.trim())?.id ?? result.id);
    } catch { setError(t('saveError')); }
    finally { setSaving(false); }
  }

  if (status === 'loading') return <div className="grid min-h-[70vh] place-items-center text-sm font-medium text-slate-500"><span className="inline-flex items-center gap-3"><span aria-hidden className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-700" />{t('load')}</span></div>;
  return <main className="w-full px-4 py-8 sm:px-7 xl:px-10 sm:py-10">
    <div className="mb-5 rounded-2xl border border-emerald-100 bg-gradient-to-r from-emerald-50 to-white px-5 py-4 shadow-sm"><p className="text-xl font-bold tracking-tight text-slate-900">{t('welcome', { name: session?.user.name || t('there') })}</p><p className="mt-1 text-sm text-slate-600">{t('welcomeHint')}</p></div>
    <section aria-label="School management shortcuts" className="mb-6 grid gap-3 sm:grid-cols-3">
      <Link href="/admin/people" className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm no-underline transition hover:-translate-y-0.5 hover:border-emerald-700/40 hover:shadow-md"><span className="grid h-9 w-9 place-items-center rounded-xl bg-emerald-50 text-lg text-emerald-900">＋</span><span className="mt-3 block font-bold text-slate-900">Students &amp; teachers</span><span className="mt-1 block text-sm text-slate-500">Create accounts and manage class assignments</span></Link>
      <Link href="/reports" className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm no-underline transition hover:-translate-y-0.5 hover:border-emerald-700/40 hover:shadow-md"><span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-lg text-amber-800">▤</span><span className="mt-3 block font-bold text-slate-900">Student reports</span><span className="mt-1 block text-sm text-slate-500">Record and review semester progress</span></Link>
      <a href="#weekly-planner" onClick={() => setTab('planner')} className="group rounded-2xl border border-slate-200 bg-white p-4 shadow-sm no-underline transition hover:-translate-y-0.5 hover:border-emerald-700/40 hover:shadow-md"><span className="grid h-9 w-9 place-items-center rounded-xl bg-sky-50 text-lg text-sky-800">▦</span><span className="mt-3 block font-bold text-slate-900">Weekly plans</span><span className="mt-1 block text-sm text-slate-500">View, edit, and manage school plans</span></a>
    </section>
    <div className="card mb-7 flex flex-wrap items-end justify-between gap-5 !rounded-3xl p-5 shadow-[0_20px_60px_-45px_rgba(18,59,54,.38)] sm:p-7"><div><p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-100 before:h-1.5 before:w-1.5 before:rounded-full before:bg-emerald-600 before:content-['']">{t('eyebrow')}</p><h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{t('title')}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{t('intro')}</p></div><div role="tablist" className="flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-slate-100/80 p-1 shadow-inner"><button type="button" role="tab" aria-selected={tab === 'planner'} onClick={() => setTab('planner')} className={tabClass(tab === 'planner')}>{t('plannerTab')}</button><button type="button" role="tab" aria-selected={tab === 'assign'} onClick={() => setTab('assign')} className={tabClass(tab === 'assign')}>{t('assignAdminTab')}</button><button type="button" role="tab" aria-selected={tab === 'manage'} onClick={() => setTab('manage')} className={tabClass(tab === 'manage')}>{t('manageTab')}</button></div></div>

    {tab === 'planner' ? <>
      <form id="weekly-planner" onSubmit={loadPlanner} className="card no-print mb-6 grid gap-4 p-5 sm:grid-cols-2 sm:p-6 lg:grid-cols-5 lg:items-end">
        <label className={fieldLabel}>{t('grade')}<select required value={gradeId} onChange={(e) => { setGradeId(e.target.value); setClassId(''); setLoaded(false); setTrackerLoaded(false); }} className={fieldControl}><option value="">{t('chooseGrade')}</option>{grades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></label>
        <label className={fieldLabel}>{t('class')}<select required disabled={!gradeId} value={classId} onChange={(e) => { setClassId(e.target.value); setLoaded(false); }} className={`${fieldControl} disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400`}><option value="">{t('chooseClass')}</option>{gradeClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className={fieldLabel}>{t('filterBy')}<select value={filterBy} onChange={(e) => { setFilterBy(e.target.value as 'week' | 'date'); setLoaded(false); setTrackerLoaded(false); }} className={fieldControl}><option value="week">{t('byWeek')}</option><option value="date">{t('byDate')}</option></select></label>
        {filterBy === 'week' ? <label className={fieldLabel}>{t('week')}<input required value={week} onChange={(e) => { setWeek(e.target.value); setTrackerLoaded(false); }} placeholder={t('weekPlaceholder')} className={fieldControl} /></label> : <label className={fieldLabel}>{t('date')}<input required type="date" value={dateValue} onChange={(e) => { setDateValue(e.target.value); setTrackerLoaded(false); }} className={fieldControl} /></label>}
        <button disabled={loading} className="btn-primary !py-3">{loading ? t('load') : t('fetch')}</button>
      </form>
      <div className="no-print mb-5 flex flex-wrap justify-end gap-2"><button type="button" onClick={() => setNotesOpen(true)} className="btn-secondary">{t('addNote')}</button><button type="button" onClick={loadTeacherTracker} disabled={!gradeId || trackerLoading} className="btn-primary">{trackerLoading ? t('trackerLoading') : t('checkTracker')}</button></div>
      {notesOpen && <div className="no-print fixed inset-0 z-[70] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={() => setNotesOpen(false)}>
        <section role="dialog" aria-modal="true" aria-labelledby="admin-notes-dialog-title" onClick={(event) => event.stopPropagation()} className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
          <div className="sticky top-0 z-10 flex items-center justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white/95 px-5 py-4 backdrop-blur sm:px-6"><div><h2 id="admin-notes-dialog-title" className="text-lg font-bold text-slate-900">{t('notesManagement')}</h2><p className="mt-1 text-sm text-slate-500">{t('notesManagementHint')}</p></div><button type="button" onClick={() => setNotesOpen(false)} aria-label={t('closeNotes')} className="btn-secondary !h-9 !w-9 !p-0 text-lg">×</button></div>
          <div className="p-4 sm:p-6"><AdminNotesManager grades={grades.map(({ id, name }) => ({ id, name }))} selectedWeek={filterBy === 'week' ? week.trim() : plans[0]?.week ?? ''} onNotesChange={(allNotes) => {
            const targetWeek = filterBy === 'week' ? week.trim() : plans[0]?.week;
            setPlannerAdminNotes(allNotes.filter((note) => note.week === targetWeek && (note.scope === 'GLOBAL' || note.grades.some((grade) => grade.id === gradeId))));
          }} /></div>
        </section>
      </div>}
      {trackerOpen && (
      <div className="no-print fixed inset-0 z-[60] grid place-items-center bg-slate-950/55 p-4 backdrop-blur-sm" onClick={() => setTrackerOpen(false)}>
      <section role="dialog" aria-modal="true" aria-labelledby="tracker-dialog-title" onClick={(event) => event.stopPropagation()} className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 bg-gradient-to-r from-emerald-50 to-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div><h2 id="tracker-dialog-title" className="text-lg font-bold text-slate-900">{t('trackerTitle')}</h2><p className="mt-1 text-sm text-slate-500">{t('trackerHint')}</p></div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={loadTeacherTracker} disabled={!gradeId || trackerLoading} className="btn-primary">{trackerLoading ? t('trackerLoading') : t('refreshTracker')}</button><button type="button" onClick={() => setTrackerOpen(false)} className="btn-secondary">{t('closeTracker')}</button></div>
        </div>
        {trackerError && <p role="alert" className="m-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{trackerError}</p>}
        {!trackerLoaded && !trackerLoading && !trackerError && <p className="px-5 py-10 text-center text-sm text-slate-500">{t('trackerPrompt')}</p>}
        {trackerLoaded && trackerRows.length === 0 && <p className="px-5 py-10 text-center text-sm text-slate-500">{t('trackerEmpty')}</p>}
        {trackerLoaded && trackerRows.length > 0 && <div className="overflow-x-auto"><table className="w-full min-w-[650px] border-collapse text-sm">
          <thead className="bg-slate-50 text-xs font-semibold text-slate-500"><tr><th className="px-5 py-3 text-start">{t('teacherName')}</th><th className="px-5 py-3 text-start">{t('assignedClasses')}</th><th className="px-5 py-3 text-start">{t('trackedSubjects')}</th><th className="px-5 py-3 text-start">{t('status')}</th><th className="px-5 py-3 text-start">{t('submittedAt')}</th></tr></thead>
          <tbody className="divide-y divide-slate-100">{trackerRows.map((teacher) => <tr key={teacher.id} className="transition-colors hover:bg-emerald-50/40"><td className="px-5 py-3.5"><span className="block font-semibold text-slate-800">{teacher.name}</span><span className="text-xs text-slate-500">{teacher.username}</span></td><td className="px-5 py-3.5 text-slate-600">{teacher.classes.map((item) => item.name).join(', ')}</td><td className="px-5 py-3.5 text-slate-600">{teacher.subjects.map((item) => item.name).join(', ')}</td><td className="px-5 py-3.5">{teacher.submitted ? <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200 before:h-1.5 before:w-1.5 before:rounded-full before:bg-emerald-600 before:content-['']">{t('submitted')}</span> : <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800 ring-1 ring-rose-200 before:h-1.5 before:w-1.5 before:rounded-full before:bg-rose-500 before:content-['']">{t('notSubmitted')}</span>}</td><td className="px-5 py-3.5 text-sm text-slate-600">{teacher.submittedAt ? new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(teacher.submittedAt)) : '—'}</td></tr>)}</tbody>
        </table></div>}
      </section>
      </div>
      )}
      {error && <p role="alert" className="no-print mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{error}</p>}
      <section id="weekly-plan-print" data-print-design={printDesign} className="print-sheet overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-900/5">
        <div className="planner-legacy-print planner-print-header border-b-2 border-slate-900 px-5 py-5 sm:px-8">
          <div className="planner-school-header grid grid-cols-[64px_1fr_64px] items-center gap-3 text-center sm:grid-cols-[80px_1fr_80px] sm:gap-5">
            <Image src="/cognia.png" alt="Cognia accredited school" width={80} height={80} priority className="mx-auto h-14 w-14 object-contain sm:h-16 sm:w-16" />
            <div>
              <p className="text-base font-black uppercase tracking-wide text-emerald-950 sm:text-lg">AL FORQAN PRIVATE SCHOOL “AMERICAN DIVISION”</p>
              <p className="mt-1 text-sm font-bold uppercase tracking-wide text-emerald-950 sm:text-base">AL BATOOL INTERNATIONAL SCHOOL</p>
              <h2 className="mt-2 text-lg font-extrabold text-slate-900 sm:text-xl">{t('weeklyPlanner')}</h2>
            </div>
            <Image src="/school-emblem.png" alt="Al Forqan Schools emblem" width={80} height={80} priority className="mx-auto h-14 w-14 object-contain sm:h-16 sm:w-16" />
          </div>
          <div className="planner-date-band mx-auto mt-3 flex max-w-5xl flex-wrap items-center justify-center gap-x-7 gap-y-2 rounded-xl border px-4 py-3 text-sm font-bold text-slate-900 sm:text-base">
            {period ? <><span>{t('week')} ({period.week}) · {period.semester}</span><span className="planner-date-value">{t('from')}: <strong>{period.from}</strong></span><span className="planner-date-value">{t('to')}: <strong>{period.to}</strong></span><span>{t('grade')} ({selectedGrade?.name})</span></> : <span>{t('weeklyPlanner')}</span>}
          </div>
        </div>
        {loaded && plans.length > 0 && <article className="planner-modern-print">
          <header className="planner-modern-header"><div><p className="planner-modern-eyebrow">WEEKLY LEARNING HUB</p><h1>Weekly Planner</h1><p className="planner-modern-school">AL FORQAN PRIVATE SCHOOL "AMERICAN DIVISION"</p><p className="planner-modern-campus">AL BATOOL INTERNATIONAL SCHOOL</p></div><div className="planner-modern-badges"><div className="grade"><span>GRADE</span><strong>{selectedGrade?.name ?? '—'}</strong></div><div className="week"><span>WEEK</span><strong>{period?.week ?? '—'}</strong></div><div className="semester"><span>SEMESTER</span><strong>{period?.semester ?? '—'}</strong></div></div></header>
          <div className="planner-modern-focus"><strong>PLAN WINDOW</strong><span>{period?.from ?? '—'}　—　{period?.to ?? '—'}</span><i /><strong>FOCUS</strong><span>Class work + Activity &amp; Homework</span></div>
          <table className="planner-modern-table"><thead><tr><th>SUBJECT</th><th>CLASS WORK</th><th>ACTIVITY ・ HOMEWORK</th></tr></thead><tbody>{planRows.map((row, index) => <tr key={row.subject} className={index % 2 ? 'shade' : ''}><th dir={locale === 'ar' ? 'rtl' : 'auto'}><span className={`planner-subject-dot dot-${index % 8}`} />{subjectLabel(row.subject)}</th><td dir="auto" className="planner-bold-value">{renderFormattedText(`${row.subjectId}:classwork`, cellValues[`${row.subjectId}:classwork`] ?? row.classwork)}</td><td dir="auto" className="planner-bold-value">{renderFormattedText(`${row.subjectId}:homework`, cellValues[`${row.subjectId}:homework`] ?? row.homework)}</td></tr>)}{plans.some((plan) => plan.dictation) && <tr className="planner-modern-full-row"><th>{t('dictation')}</th><td colSpan={2} dir="auto" className="planner-bold-value">{plans.map((plan) => plan.dictation).filter(Boolean).join('\n')}</td></tr>}<tr className="shade planner-modern-full-row"><th>{t('notes')}</th><td colSpan={2} dir="auto">{renderFormattedText('__notes', cellValues.__notes ?? combinedNotes)}</td></tr></tbody></table>
          <footer className="planner-modern-footer"><span>Al Forqan Private School　·　American Division　·　Confidential</span><span>Generated for print　·　Week {period?.week ?? '—'}</span></footer>
        </article>}
        <div className="no-print flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50/80 px-4 py-3 sm:px-5">
          <label className="flex h-9 items-center gap-2 text-sm font-semibold text-slate-700">Print design<select aria-label="Print design" value={printDesign} onChange={(event) => setPrintDesign(event.target.value as 'legacy' | 'planner')} className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-medium text-slate-700 shadow-sm"><option value="legacy">Current design</option><option value="planner">Weekly planner design</option></select></label>
          <span aria-hidden className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />
          <button type="button" onClick={() => setEditValues((value) => !value)} disabled={!loaded || !plans.length} className={`inline-flex h-9 items-center rounded-lg border px-3.5 text-sm font-semibold shadow-sm disabled:opacity-40 ${editValues ? 'border-emerald-700 bg-emerald-100 text-emerald-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>{editValues ? t('finishEditing') : t('editValues')}</button>
          <span aria-hidden className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" />
          <select aria-label={t('fontSize')} disabled={!activeCell} value={fontSize} onChange={(event) => { setFontSize(event.target.value); changeActiveFormat((current) => ({ ...current, fontSize: event.target.value })); }} className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 shadow-sm disabled:opacity-45"><option value="11pt">11 pt</option><option value="12pt">12 pt</option><option value="14pt">14 pt</option><option value="16pt">16 pt</option><option value="18pt">18 pt</option><option value="22pt">22 pt</option></select>
          <button type="button" aria-label={t('bold')} title={t('bold')} disabled={!activeCell} onMouseDown={(event) => event.preventDefault()} onClick={toggleBold} className={`${toolBtn} font-black`}>B</button>
          <button type="button" aria-label={t('underline')} title={t('underline')} disabled={!activeCell} onMouseDown={(event) => event.preventDefault()} onClick={toggleUnderline} className={`${toolBtn} font-bold underline`}>U</button>
          <div className="flex h-9 flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 shadow-sm" aria-label={t('textColor')}>{['#111827','#475569','#dc2626','#ea580c','#d97706','#16a34a','#0d9488','#0284c7','#2563eb','#4f46e5','#9333ea','#db2777'].map((color) => <button key={color} type="button" aria-label={color} title={color} disabled={!activeCell} onMouseDown={(event) => event.preventDefault()} onClick={() => changeActiveFormat((current) => ({ ...current, color }))} className="h-5 w-5 rounded-full border border-white shadow-[0_0_0_1px_rgb(148_163_184)] transition-transform hover:scale-110 disabled:opacity-40" style={{ backgroundColor: color }} />)}<input aria-label={t('customColor')} title={t('customColor')} disabled={!activeCell} type="color" onChange={(event) => changeActiveFormat((current) => ({ ...current, color: event.target.value }))} className="ms-1 h-6 w-7 cursor-pointer border-0 bg-transparent p-0 disabled:opacity-45" /></div>
          <span className="me-auto text-xs font-medium text-slate-500">{activeCell ? t('formatSelected') : t('selectCellToFormat')}</span>
          <button type="button" disabled={!loaded || !plans.length} onClick={downloadCsv} className="btn-secondary !px-4 !py-2 disabled:opacity-40">{t('csv')}</button>
          <button type="button" disabled={!loaded || !plans.length} onClick={downloadDocx} className="inline-flex items-center justify-center rounded-xl border border-emerald-800/25 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-950 shadow-sm hover:bg-emerald-100 disabled:opacity-40">{t('downloadWord')}</button>
          <button type="button" disabled={!loaded || !plans.length} onClick={() => { setEditValues(false); window.requestAnimationFrame(printPlanner); }} className="btn-primary !py-2 disabled:opacity-40">{t('print')}</button>
        </div>
        {!loaded ? <p className="no-print px-6 py-14 text-center text-sm text-slate-500">{t('chooseFilters')}</p> : loading ? <p className="px-6 py-14 text-center text-sm text-slate-500">{t('load')}</p> : !plans.length ? <div className="px-6 py-14 text-center"><p className="font-semibold text-slate-700">{t('empty')}</p><p className="mt-1 text-sm text-slate-500">{t('emptyHint')}</p></div> : <div className="planner-table-shell overflow-x-auto rounded-xl border-2 border-[#123b36]"><table className="w-full min-w-[760px] border-collapse text-base"><thead><tr className="planner-table-heading text-center font-bold text-white"><th className="w-[18%] border border-[#2b6158] px-3 py-3">{t('subject')}</th><th className="w-[47%] border border-[#2b6158] px-3 py-3">{t('classwork')}</th><th className="w-[35%] border border-[#2b6158] px-3 py-3">{t('activity')}</th></tr></thead><tbody>{planRows.map((row) => <tr key={row.subject} className="print:break-inside-avoid"><th scope="row" className="border border-slate-300 bg-emerald-50/70 px-3 py-4 text-center font-bold text-emerald-950" dir={locale === 'ar' ? 'rtl' : 'auto'}>{subjectLabel(row.subject)}</th><td dir="auto" className="planner-value whitespace-pre-wrap border border-slate-300 bg-white px-3 py-3 text-start align-middle leading-6">{renderPlanValue(row.subjectId, 'classwork', row.classwork)}</td><td dir="auto" className="planner-value whitespace-pre-wrap border border-slate-300 bg-white px-3 py-3 text-start align-middle leading-6">{renderPlanValue(row.subjectId, 'homework', row.homework)}</td></tr>)}</tbody>
            <tfoot>{plans.some((plan) => plan.dictation) && <tr><th className="border border-slate-300 bg-emerald-50/70 px-3 py-4 text-center font-bold text-emerald-950">{t('dictation')}</th><td colSpan={2} dir="auto" className="planner-bold-value planner-value whitespace-pre-wrap border border-slate-300 bg-white px-4 py-4 text-start align-middle leading-7" style={{ ...readPlanStyle(plans.find((plan) => plan.dictationStyle)?.dictationStyle), fontWeight: 900 }}>{plans.map((plan) => plan.dictation).filter(Boolean).join('\n')}</td></tr>}<tr className="print:break-inside-avoid"><th className="border border-slate-300 bg-emerald-50/70 px-3 py-4 text-center font-bold text-emerald-950">{t('notes')}</th><td colSpan={2} dir="auto" className="planner-value whitespace-pre-wrap border border-slate-300 bg-white px-4 py-4 text-start align-middle leading-7">{renderNotesValue()}</td></tr></tfoot>
          </table></div>}
      </section>
    </> : tab === 'assign' ? <AdminBulkAssignment grades={grades} /> : <>
      <div className="card mb-5 p-5 sm:p-6"><h2 className="text-xl font-bold text-slate-900">{t('manageTitle')}</h2><p className="mt-1 text-sm text-slate-500">{t('manageHint')}</p></div>
      <div className="grid gap-6 lg:grid-cols-[290px_1fr] lg:items-start">
        <aside className="card p-4 sm:p-5 lg:sticky lg:top-24"><h3 className="mb-3 text-sm font-semibold text-slate-700">{t('grade')}</h3>{grades.length ? <div className="space-y-2">{grades.map((grade) => <button key={grade.id} onClick={() => changeManageGrade(grade.id)} aria-pressed={manageGradeId === grade.id} className={`w-full rounded-xl border px-4 py-3 text-start text-sm font-semibold transition-colors ${manageGradeId === grade.id ? 'border-emerald-800 bg-emerald-50 text-emerald-950 shadow-[inset_0_0_0_1px_#134f49]' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50'}`}>{grade.name}<span className="float-end rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">{grade.classes.length} · {grade.subjects.length}</span></button>)}</div> : <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-3 py-6 text-center text-sm text-slate-500">{t('noGrades')}</p>}
          <form onSubmit={saveGrade} className="mt-5 border-t border-slate-200 pt-5"><label className={fieldLabel}>{t('createGrade')}<input value={newGrade} onChange={(e) => { setNewGrade(e.target.value); if (e.target.value) setManageGradeId(''); }} placeholder={t('gradeNamePlaceholder')} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-normal normal-case tracking-normal shadow-sm" /></label><button disabled={!newGrade.trim() || saving} className="btn-primary mt-3 w-full">{t('addGrade')}</button></form>
        </aside>
        <form onSubmit={saveGrade} className="card space-y-7 p-5 sm:p-7">
          <h3 className="text-lg font-bold text-slate-900">{manageGrade ? `${t('grade')} ${manageGrade.name}` : t('createGrade')}</h3>
          <section><h4 className="mb-3 text-sm font-semibold text-slate-700">{t('gradeClasses')}</h4>{payload.classes.length ? <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{payload.classes.map((item) => <label key={item.id} className="choice"><input type="checkbox" checked={classIds.includes(item.id)} onChange={(e) => setClassIds((current) => e.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))} className="h-4 w-4" /><span className="font-medium">{item.name}</span>{item.grade && item.grade.id !== manageGradeId && <span className="ms-auto rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 ring-1 ring-amber-200">{item.grade.name}</span>}</label>)}</div> : <p className="text-sm text-slate-500">{t('noClasses')}</p>}</section>
          <section><h4 className="mb-1 text-sm font-semibold text-slate-700">{t('gradeSubjects')}</h4><p className="mb-3 text-xs text-slate-500">{t('subjectOrderHint')}</p><div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{payload.subjects.map((subject) => <label key={subject.id} className="choice"><input type="checkbox" checked={subjectIds.includes(subject.id)} onChange={(e) => setSubjectIds((current) => e.target.checked ? [...current, subject.id] : current.filter((id) => id !== subject.id))} className="h-4 w-4" /><span>{subject.name}</span></label>)}</div>
            {subjectIds.length > 0 && <ol aria-label={t('subjectOrder')} className="mt-5 space-y-2 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">{subjectIds.map((subjectId, index) => { const subject = payload.subjects.find((item) => item.id === subjectId); if (!subject) return null; return <li key={subjectId} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm"><span aria-hidden className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-emerald-50 text-xs font-bold text-emerald-800">{index + 1}</span><span className="min-w-0 flex-1 text-sm font-medium text-slate-800">{subject.name}</span><label className="flex items-center gap-2 text-xs font-medium text-slate-500">{t('subjectPosition')}<select aria-label={`${t('subjectPosition')}: ${subject.name}`} value={index + 1} onChange={(event) => setSubjectPosition(subjectId, Number(event.target.value) - 1)} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-800 shadow-sm">{subjectIds.map((_, position) => <option key={position} value={position + 1}>{position + 1}</option>)}</select></label></li>; })}</ol>}
          </section>
          {(error || notice) && <p role={error ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm font-medium ${error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>{error || notice}</p>}
          <div className="flex justify-end border-t border-slate-100 pt-5"><button disabled={saving || (!manageGradeId && !newGrade.trim())} className="btn-primary !px-6 !py-3">{saving ? t('saving') : t('saveAssignments')}</button></div>
        </form>
      </div>
    </>}
  </main>;
}

