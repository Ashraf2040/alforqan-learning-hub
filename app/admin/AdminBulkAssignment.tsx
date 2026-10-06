'use client';

import { useMemo, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';

type Subject = { id: string; name: string };
type Grade = { id: string; name: string; subjects: { position: number; subject: Subject }[] };
type TextStyle = { fontSize: string; color: string; fontWeight: '400' | '700'; fontStyle: 'normal' | 'italic'; textDecoration: 'none' | 'underline' };
type Entry = { classwork: string; homework: string; classworkStyle: TextStyle; homeworkStyle: TextStyle };
type RowData = { dictation: string; notes: string; dictationStyle: TextStyle; notesStyle: TextStyle; subjects: Record<string, Entry> };
type ExistingPlan = { gradeId: string; week: string; semester: string | null; fromDate: string; toDate: string; dictation: string | null; notes: string | null; dictationStyle: string | null; notesStyle: string | null; source: 'ADMIN' | 'TEACHER'; items: { subjectId: string; classwork: string; homework: string; classworkStyle: string | null; homeworkStyle: string | null }[] };
type ActiveEntity = { gradeId: string; key: string };
const defaultStyle: TextStyle = { fontSize: '14px', color: '#0f172a', fontWeight: '400', fontStyle: 'normal', textDecoration: 'none' };
const readStyle = (value: string | null | undefined): TextStyle => { try { return { ...defaultStyle, ...(value ? JSON.parse(value) : {}) }; } catch { return { ...defaultStyle }; } };
const emptyEntry = (): Entry => ({ classwork: '', homework: '', classworkStyle: { ...defaultStyle }, homeworkStyle: { ...defaultStyle } });
const emptyRow = (): RowData => ({ dictation: '', notes: '', dictationStyle: { ...defaultStyle }, notesStyle: { ...defaultStyle }, subjects: {} });
const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', quoted = false;
  const input = text.replace(/^\uFEFF/, '');
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (char === '"' && input[index + 1] === '"') { cell += '"'; index += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && input[index + 1] === '\n') index += 1;
      row.push(cell); cell = '';
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
    } else cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}
const normalizeCsvHeader = (value: string) => value.trim().toLocaleLowerCase().replace(/[–—_]/g, ' ').replace(/\s+/g, ' ');

export default function AdminBulkAssignment({ grades }: { grades: Grade[] }) {
  const t = useTranslations('admin');
  const locale = useLocale();
  const [week, setWeek] = useState('');
  const [semester, setSemester] = useState('1st Semester');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [values, setValues] = useState<Record<string, RowData>>({});
  const [enabled, setEnabled] = useState<Record<string, boolean>>({});
  const [selectedGradeId, setSelectedGradeId] = useState('');
  const [existingGradeIds, setExistingGradeIds] = useState<string[]>([]);
  const [sources, setSources] = useState<Record<string, 'ADMIN' | 'TEACHER' | 'IMPORT'>>({});
  const [loadedWeek, setLoadedWeek] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeEntity, setActiveEntity] = useState<ActiveEntity | null>(null);
  const tableScroller = useRef<HTMLDivElement>(null);
  const sortedGrades = useMemo(() => [...grades].sort((a, b) => a.name.localeCompare(b.name, locale === 'ar' ? 'ar' : 'en', { numeric: true, sensitivity: 'base' })), [grades, locale]);
  const allSubjects = useMemo(() => {
    const map = new Map<string, Subject>();
    sortedGrades.forEach((grade) => grade.subjects.forEach(({ subject }) => map.set(subject.id, subject)));
    return [...map.values()];
  }, [sortedGrades]);
  const selectedGrade = sortedGrades.find((grade) => grade.id === selectedGradeId);
  const visibleGrades = selectedGrade ? [selectedGrade] : sortedGrades;
  const subjects = selectedGrade ? selectedGrade.subjects.map(({ subject }) => subject) : allSubjects;

  function localizedSubjectName(name: string) {
    if (locale !== 'ar') return name;
    const key = name.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
    const arabic: Record<string, string> = {
      arabic: 'اللغة العربية', 'arabic language': 'اللغة العربية',
      english: 'اللغة الإنجليزية', french: 'اللغة الفرنسية', ict: 'تقنية المعلومات',
      islamic: 'التربية الإسلامية', 'islamic studies': 'التربية الإسلامية',
      'life skills': 'المهارات الحياتية', math: 'الرياضيات', mathematics: 'الرياضيات',
      science: 'العلوم', 'social arabic': 'الدراسات الاجتماعية باللغة العربية',
      'social studies': 'الدراسات الاجتماعية',
    };
    return arabic[key] ?? name;
  }

  function updateRow(gradeId: string, update: (row: RowData) => RowData) {
    setValues((current) => ({ ...current, [gradeId]: update(current[gradeId] ?? emptyRow()) }));
  }

  function entityStyle(row: RowData, key: string): TextStyle {
    if (key === 'dictation') return row.dictationStyle;
    if (key === 'notes') return row.notesStyle;
    const [subjectId, field] = key.split(':');
    const entry = row.subjects[subjectId] ?? emptyEntry();
    return field === 'homework' ? entry.homeworkStyle : entry.classworkStyle;
  }

  function updateEntityStyle(target: ActiveEntity, update: Partial<TextStyle>) {
    updateRow(target.gradeId, (row) => {
      if (target.key === 'dictation') return { ...row, dictationStyle: { ...row.dictationStyle, ...update } };
      if (target.key === 'notes') return { ...row, notesStyle: { ...row.notesStyle, ...update } };
      const [subjectId, field] = target.key.split(':');
      const entry = row.subjects[subjectId] ?? emptyEntry();
      const styleKey = field === 'homework' ? 'homeworkStyle' : 'classworkStyle';
      return { ...row, subjects: { ...row.subjects, [subjectId]: { ...entry, [styleKey]: { ...entityStyle(row, target.key), ...update } } } };
    });
  }

  function updateEntityValue(target: ActiveEntity, value: string) {
    updateRow(target.gradeId, (row) => {
      if (target.key === 'dictation') return { ...row, dictation: value };
      if (target.key === 'notes') return { ...row, notes: value };
      const [subjectId, field] = target.key.split(':');
      const entry = row.subjects[subjectId] ?? emptyEntry();
      return { ...row, subjects: { ...row.subjects, [subjectId]: { ...entry, [field === 'homework' ? 'homework' : 'classwork']: value } } };
    });
  }

  function renderEntityInput(grade: Grade, row: RowData, key: string, label: string, value: string, rows = 2) {
    const target = { gradeId: grade.id, key };
    return <textarea disabled={!enabled[grade.id]} rows={rows} aria-label={`${grade.name} · ${label}`} placeholder={label} value={value} style={entityStyle(row, key)} onFocus={() => setActiveEntity(target)} onChange={(event) => updateEntityValue(target, event.target.value)} className="w-full resize-y rounded-lg border border-slate-200 bg-white px-2.5 py-2 leading-5 shadow-[inset_0_1px_1px_rgb(15_45_40/.04)] disabled:cursor-not-allowed disabled:bg-slate-50" />;
  }

  async function loadWeek() {
    const selectedWeek = week.trim();
    if (!selectedWeek) { setError(t('assignmentWeekRequired')); return; }
    setLoading(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/admin/plans?mode=assignments&week=${encodeURIComponent(selectedWeek)}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t('assignmentLoadError'));
      const plans = result as ExistingPlan[];
      const loaded: Record<string, RowData> = {};
      const active: Record<string, boolean> = {};
      const loadedSources: Record<string, 'ADMIN' | 'TEACHER' | 'IMPORT'> = {};
      for (const plan of plans) {
        active[plan.gradeId] = true;
        loadedSources[plan.gradeId] = plan.source;
        loaded[plan.gradeId] = {
          dictation: plan.dictation ?? '', notes: plan.notes ?? '', dictationStyle: readStyle(plan.dictationStyle), notesStyle: readStyle(plan.notesStyle),
          subjects: Object.fromEntries(plan.items.map((item) => [item.subjectId, { classwork: item.classwork, homework: item.homework, classworkStyle: readStyle(item.classworkStyle), homeworkStyle: readStyle(item.homeworkStyle) }])),
        };
      }
      setValues(loaded); setEnabled(active); setSources(loadedSources); setExistingGradeIds(plans.filter((plan) => plan.source === 'ADMIN').map((plan) => plan.gradeId)); setLoadedWeek(selectedWeek);
      if (plans[0]) {
        setSemester(plans[0].semester ?? '');
        setFromDate(plans[0].fromDate.slice(0, 10));
        setToDate(plans[0].toDate.slice(0, 10));
      }
      setNotice(plans.length ? t('assignmentLoaded', { count: plans.length }) : t('assignmentNoExisting'));
    } catch (reason) { setLoadedWeek(''); setError(reason instanceof Error ? reason.message : t('assignmentLoadError')); }
    finally { setLoading(false); }
  }

  function downloadCsvTemplate() {
    const rows = [['Grade', 'Subject', 'Class work', 'Activity - Homework', 'Dictation', 'Notes']];
    for (const grade of visibleGrades) {
      for (const { subject } of grade.subjects) rows.push([grade.name, subject.name, '', '', '', '']);
    }
    const blob = new Blob([`\uFEFF${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `weekly-plan-template-week-${week.trim() || 'week'}.csv`; link.click();
    URL.revokeObjectURL(url);
  }

  async function importCsv(file: File | undefined) {
    if (!file) return;
    if (!loadedWeek || loadedWeek !== week.trim() || !fromDate || !toDate || !semester) {
      setError(t('assignmentImportLoadFirst'));
      return;
    }
    setError(''); setNotice('');
    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2) throw new Error(t('assignmentCsvEmpty'));
      const headers = rows[0].map(normalizeCsvHeader);
      const findColumn = (...names: string[]) => headers.findIndex((header) => names.includes(header));
      const columns = {
        grade: findColumn('grade', 'class grade'), subject: findColumn('subject'),
        classwork: findColumn('class work', 'classwork'), homework: findColumn('activity - homework', 'activity homework', 'homework'),
        dictation: findColumn('dictation'), notes: findColumn('notes', 'note'),
      };
      if (columns.grade < 0 || columns.subject < 0 || columns.classwork < 0 || columns.homework < 0) throw new Error(t('assignmentCsvHeaders'));
      const gradeByName = new Map(sortedGrades.map((grade) => [normalizeCsvHeader(grade.name.replace(/^grade\s*/i, '')), grade]));
      const subjectByName = new Map(allSubjects.map((subject) => [normalizeCsvHeader(subject.name), subject]));
      const nextValues = { ...values };
      const importedIds = new Set<string>();
      let importedRows = 0;
      for (const [index, columnsInRow] of rows.slice(1).entries()) {
        const rawGrade = columnsInRow[columns.grade]?.trim() ?? '';
        const rawSubject = columnsInRow[columns.subject]?.trim() ?? '';
        if (!rawGrade && !rawSubject) continue;
        const grade = gradeByName.get(normalizeCsvHeader(rawGrade.replace(/^grade\s*/i, '')));
        const subject = subjectByName.get(normalizeCsvHeader(rawSubject));
        if (!grade || (selectedGradeId && grade.id !== selectedGradeId) || !subject || !grade.subjects.some(({ subject: assigned }) => assigned.id === subject.id)) {
          throw new Error(t('assignmentCsvUnknownRow', { row: index + 2, grade: rawGrade || '—', subject: rawSubject || '—' }));
        }
        const row = nextValues[grade.id] ?? emptyRow();
        const entry = row.subjects[subject.id] ?? emptyEntry();
        nextValues[grade.id] = {
          ...row,
          dictation: columns.dictation >= 0 && columnsInRow[columns.dictation]?.trim() ? columnsInRow[columns.dictation] : row.dictation,
          notes: columns.notes >= 0 && columnsInRow[columns.notes]?.trim() ? columnsInRow[columns.notes] : row.notes,
          subjects: { ...row.subjects, [subject.id]: { ...entry, classwork: columnsInRow[columns.classwork] ?? '', homework: columnsInRow[columns.homework] ?? '' } },
        };
        importedIds.add(grade.id); importedRows += 1;
      }
      if (!importedRows) throw new Error(t('assignmentCsvEmpty'));
      setValues(nextValues);
      setEnabled((current) => ({ ...current, ...Object.fromEntries([...importedIds].map((id) => [id, true])) }));
      setSources((current) => ({ ...current, ...Object.fromEntries([...importedIds].filter((id) => current[id] !== 'ADMIN').map((id) => [id, 'IMPORT'])) }));
      setNotice(t('assignmentCsvImported', { rows: importedRows, grades: importedIds.size }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t('assignmentCsvError'));
    }
  }

  async function saveAll() {
    if (loadedWeek !== week.trim()) { setError(t('assignmentLoadFirst')); return; }
    if (!fromDate || !toDate) { setError(t('assignmentDatesRequired')); return; }
    setSaving(true); setError(''); setNotice('');
    const assignedIds = Object.entries(enabled).filter(([, selected]) => selected).map(([gradeId]) => gradeId);
    const gradePlans = assignedIds.map((gradeId) => {
      const row = values[gradeId] ?? emptyRow();
      return {
        gradeId, dictation: row.dictation, notes: row.notes, dictationStyle: row.dictationStyle, notesStyle: row.notesStyle,
        items: grades.find((grade) => grade.id === gradeId)?.subjects.map(({ subject }) => ({ subjectId: subject.id, ...(row.subjects[subject.id] ?? emptyEntry()) })) ?? [],
      };
    });
    const removeGradeIds = existingGradeIds.filter((gradeId) => !enabled[gradeId]);
    try {
      const response = await fetch('/api/admin/plans', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week: week.trim(), semester, fromDate, toDate, gradePlans, removeGradeIds }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t('assignmentSaveError'));
      setExistingGradeIds(assignedIds); setSources(Object.fromEntries(assignedIds.map((gradeId) => [gradeId, 'ADMIN']))); setNotice(t('assignmentSaved', { count: result.saved }));
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('assignmentSaveError')); }
    finally { setSaving(false); }
  }

  return <section dir={locale === 'ar' ? 'rtl' : 'ltr'} className="space-y-5">
    <div className="card p-5 sm:p-7"><p className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-100 before:h-1.5 before:w-1.5 before:rounded-full before:bg-emerald-600 before:content-['']">{t('assignmentEyebrow')}</p><h2 className="mt-3 text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.7rem]">{t('assignmentTitle')}</h2><p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">{t('assignmentHint')}</p>
      <div className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-5 lg:items-end">
        <label className="text-[13px] font-semibold text-slate-600">{t('week')}<input value={week} onChange={(event) => { setWeek(event.target.value); setLoadedWeek(''); setFromDate(''); setToDate(''); setSemester('1st Semester'); setNotice(''); }} placeholder={t('weekPlaceholder')} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal shadow-sm normal-case tracking-normal text-slate-800" /></label>
        <label className="text-[13px] font-semibold text-slate-600">{t('semester')}<select value={semester} onChange={(event) => setSemester(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal shadow-sm normal-case tracking-normal text-slate-800"><option value="1st Semester">{t('firstSemester')}</option><option value="2nd Semester">{t('secondSemester')}</option><option value="Summer Term">{t('summer')}</option></select></label>
        <label className="text-[13px] font-semibold text-slate-600">{t('from')}<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal shadow-sm normal-case tracking-normal text-slate-800" /></label>
        <label className="text-[13px] font-semibold text-slate-600">{t('to')}<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal shadow-sm normal-case tracking-normal text-slate-800" /></label>
        <button type="button" onClick={() => void loadWeek()} disabled={loading || !week.trim()} className="btn-primary">{loading ? t('assignmentLoading') : t('assignmentLoad')}</button>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={downloadCsvTemplate} className="btn-secondary">{t('assignmentCsvTemplate')}</button>
        <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold shadow-sm transition-colors ${loadedWeek === week.trim() && loadedWeek ? 'border-emerald-900 bg-emerald-800 text-white hover:bg-emerald-900' : 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'}`}>
          {t('assignmentImportCsv')}<input type="file" accept=".csv,text/csv" className="sr-only" disabled={loadedWeek !== week.trim() || !loadedWeek} onChange={(event) => { void importCsv(event.target.files?.[0]); event.currentTarget.value = ''; }} />
        </label>
        <span className="text-xs text-slate-500">{t('assignmentCsvHint')}</span>
      </div>
      <label className="mt-4 block max-w-sm text-[13px] font-semibold text-slate-600">{t('assignmentGradeFilter')}<select value={selectedGradeId} onChange={(event) => { setSelectedGradeId(event.target.value); setActiveEntity(null); }} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal shadow-sm normal-case tracking-normal text-slate-800"><option value="">{t('assignmentAllGrades')}</option>{sortedGrades.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}</select></label>
      {(error || notice) && <p role={error ? 'alert' : 'status'} className={`mt-4 rounded-xl border px-4 py-3 text-sm font-medium ${error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>{error || notice}</p>}
    </div>
    {loadedWeek === week.trim() && Boolean(loadedWeek) && <>
      <div className="sticky top-[4.5rem] z-20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50/95 px-4 py-3 text-sm text-amber-950 shadow-md backdrop-blur"><span className="font-semibold">{t('assignmentPriority')}</span><button type="button" onClick={() => void saveAll()} disabled={saving || loading} className="btn-primary">{saving ? t('assignmentSaving') : t('assignmentSave')}</button></div>
      <div className="card flex flex-wrap items-center gap-3 px-4 py-3"><span className="me-auto text-sm font-semibold text-slate-600">{activeEntity ? `${sortedGrades.find((grade) => grade.id === activeEntity.gradeId)?.name ?? ''} · ${activeEntity.key === 'dictation' ? t('dictation') : activeEntity.key === 'notes' ? t('notes') : `${localizedSubjectName(subjects.find((subject) => subject.id === activeEntity.key.split(':')[0])?.name ?? '')} · ${activeEntity.key.endsWith(':homework') ? t('activity') : t('classwork')}`}` : t('styleSelectEntity')}</span><label className="flex items-center gap-2 text-xs font-semibold text-slate-600">{t('fontSize')}<select disabled={!activeEntity} value={activeEntity ? entityStyle(values[activeEntity.gradeId] ?? emptyRow(), activeEntity.key).fontSize : defaultStyle.fontSize} onChange={(event) => activeEntity && updateEntityStyle(activeEntity, { fontSize: event.target.value })} className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm shadow-sm disabled:opacity-45"><option value="12px">12</option><option value="14px">14</option><option value="16px">16</option><option value="18px">18</option><option value="22px">22</option><option value="26px">26</option></select></label><label className="flex items-center gap-2 text-xs font-semibold text-slate-600">{t('textColor')}<input disabled={!activeEntity} type="color" value={activeEntity ? entityStyle(values[activeEntity.gradeId] ?? emptyRow(), activeEntity.key).color : defaultStyle.color} onChange={(event) => activeEntity && updateEntityStyle(activeEntity, { color: event.target.value })} className="h-9 w-10 cursor-pointer rounded-lg border border-slate-200 bg-white p-1 disabled:opacity-45" /></label><button type="button" disabled={!activeEntity} onClick={() => activeEntity && updateEntityStyle(activeEntity, { fontWeight: entityStyle(values[activeEntity.gradeId] ?? emptyRow(), activeEntity.key).fontWeight === '700' ? '400' : '700' })} className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-black disabled:opacity-40 ${activeEntity && entityStyle(values[activeEntity.gradeId] ?? emptyRow(), activeEntity.key).fontWeight === '700' ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>B</button><button type="button" disabled={!activeEntity} onClick={() => activeEntity && updateEntityStyle(activeEntity, { fontStyle: entityStyle(values[activeEntity.gradeId] ?? emptyRow(), activeEntity.key).fontStyle === 'italic' ? 'normal' : 'italic' })} className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border text-sm italic disabled:opacity-40 ${activeEntity && entityStyle(values[activeEntity.gradeId] ?? emptyRow(), activeEntity.key).fontStyle === 'italic' ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>I</button><button type="button" disabled={!activeEntity} onClick={() => activeEntity && updateEntityStyle(activeEntity, { textDecoration: entityStyle(values[activeEntity.gradeId] ?? emptyRow(), activeEntity.key).textDecoration === 'underline' ? 'none' : 'underline' })} className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-bold underline disabled:opacity-40 ${activeEntity && entityStyle(values[activeEntity.gradeId] ?? emptyRow(), activeEntity.key).textDecoration === 'underline' ? 'border-emerald-700 bg-emerald-50 text-emerald-900' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>U</button></div>
      <div className="flex flex-wrap items-center justify-between gap-2"><p className="text-xs font-medium text-slate-500">{selectedGrade ? t('assignmentGradeSubjectsHint', { grade: selectedGrade.name }) : t('assignmentScrollHint')}</p><div className="flex gap-2"><button type="button" onClick={() => tableScroller.current?.scrollBy({ left: -640, behavior: 'smooth' })} aria-label={t('scrollSubjectsBackward')} className="btn-secondary !h-9 !w-9 !p-0">←</button><button type="button" onClick={() => tableScroller.current?.scrollBy({ left: 640, behavior: 'smooth' })} aria-label={t('scrollSubjectsForward')} className="btn-secondary !h-9 !w-9 !p-0">→</button></div></div>
      <div ref={tableScroller} dir="ltr" className="admin-assignment-scroll card overflow-x-auto"><table dir={locale === 'ar' ? 'rtl' : 'ltr'} className="w-full min-w-[900px] border-collapse text-sm"><thead><tr className="bg-[#123b36] text-white"><th rowSpan={2} className="sticky start-0 z-10 min-w-48 border border-[#2b6158] bg-[#123b36] px-4 py-3 text-start font-semibold">{t('grade')}</th>{subjects.map((subject) => <th key={subject.id} colSpan={2} className="min-w-64 border border-[#2b6158] px-3 py-3 text-center font-semibold">{localizedSubjectName(subject.name)}</th>)}<th rowSpan={2} className="min-w-56 border border-[#2b6158] px-3 py-3 font-semibold">{t('dictation')}</th><th rowSpan={2} className="min-w-56 border border-[#2b6158] px-3 py-3 font-semibold">{t('notes')}</th></tr><tr className="bg-emerald-50 text-xs font-semibold text-emerald-900">{subjects.flatMap((subject) => [<th key={`${subject.id}:classwork`} className="min-w-48 border border-slate-200 px-3 py-2">{t('classwork')}</th>, <th key={`${subject.id}:homework`} className="min-w-48 border border-slate-200 px-3 py-2">{t('activity')}</th>])}</tr></thead>
        <tbody>{visibleGrades.map((grade) => {
          const row = values[grade.id] ?? emptyRow();
          const assignedSubjectIds = new Set(grade.subjects.map(({ subject }) => subject.id));
          return <tr key={grade.id} className="align-top transition-colors even:bg-slate-50/60 hover:bg-emerald-50/30"><th className="sticky start-0 z-[1] border border-slate-200 bg-white px-4 py-4 text-start align-top"><span className="block font-bold text-slate-900">{grade.name}</span>{sources[grade.id] && <span className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${sources[grade.id] === 'ADMIN' ? 'bg-emerald-100 text-emerald-900' : sources[grade.id] === 'IMPORT' ? 'bg-violet-100 text-violet-900' : 'bg-sky-100 text-sky-900'}`}>{sources[grade.id] === 'ADMIN' ? t('assignmentAdminSource') : sources[grade.id] === 'IMPORT' ? t('assignmentImportSource') : t('assignmentTeacherSource')}</span>}<label className="mt-2 flex cursor-pointer items-center gap-2 text-xs font-semibold text-emerald-900"><input type="checkbox" checked={Boolean(enabled[grade.id])} onChange={(event) => setEnabled((current) => ({ ...current, [grade.id]: event.target.checked }))} className="h-4 w-4 accent-emerald-800" />{t('adminOverride')}</label></th>
            {subjects.map((subject) => assignedSubjectIds.has(subject.id) ? <td key={`${grade.id}:${subject.id}`} colSpan={2} className="border border-slate-200 p-2"><div className="space-y-2">{renderEntityInput(grade, row, `${subject.id}:classwork`, t('classwork'), row.subjects[subject.id]?.classwork ?? '')}{renderEntityInput(grade, row, `${subject.id}:homework`, t('activity'), row.subjects[subject.id]?.homework ?? '')}</div></td> : <td key={`${grade.id}:${subject.id}`} colSpan={2} className="border border-slate-200 px-3 py-4 text-center text-slate-300">—</td>)}
            <td className="border border-slate-200 p-2">{renderEntityInput(grade, row, 'dictation', t('dictation'), row.dictation, 4)}</td>
            <td className="border border-slate-200 p-2">{renderEntityInput(grade, row, 'notes', t('notes'), row.notes, 4)}</td>
          </tr>;
        })}</tbody></table></div>
      <div className="flex justify-end"><button type="button" onClick={() => void saveAll()} disabled={saving || loading} className="btn-primary !px-7 !py-3">{saving ? t('assignmentSaving') : t('assignmentSave')}</button></div>
    </>}
  </section>;
}