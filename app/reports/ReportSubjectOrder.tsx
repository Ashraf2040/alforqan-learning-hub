'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { toast } from 'react-hot-toast';

type Subject = { id: string; name: string; position: number };
type Grade = { id: string; name: string; subjects: Subject[] };

export default function ReportSubjectOrder({ onOrderSaved }: { onOrderSaved: () => Promise<void> }) {
  const locale = useLocale();
  const ar = locale === 'ar';
  const [grades, setGrades] = useState<Grade[]>([]);
  const [gradeId, setGradeId] = useState('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const selectedGrade = grades.find((grade) => grade.id === gradeId);

  useEffect(() => {
    let active = true;
    void fetch('/api/admin/report-subject-order').then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (active) {
        const loadedGrades = (data.grades ?? []) as Grade[];
        setGrades(loadedGrades);
        const initial = loadedGrades.find((grade) => grade.subjects.length > 0);
        setGradeId(initial?.id ?? '');
        setSubjects(initial?.subjects ?? []);
      }
    }).catch((error) => toast.error(error instanceof Error ? error.message : (ar ? 'تعذر تحميل ترتيب المواد.' : 'Could not load subject order.'))).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [ar]);

  function chooseGrade(nextId: string) {
    setGradeId(nextId);
    setSubjects(grades.find((grade) => grade.id === nextId)?.subjects ?? []);
  }

  function setPosition(subjectId: string, position: number) {
    setSubjects((current) => {
      const from = current.findIndex((subject) => subject.id === subjectId);
      const to = Math.max(0, Math.min(current.length - 1, position - 1));
      if (from < 0 || from === to) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  async function save() {
    if (!gradeId) return;
    setSaving(true);
    try {
      const response = await fetch('/api/admin/report-subject-order', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gradeId, subjectIds: subjects.map((subject) => subject.id) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setGrades((current) => current.map((grade) => grade.id === gradeId ? { ...grade, subjects: subjects.map((subject, position) => ({ ...subject, position })) } : grade));
      await onOrderSaved();
      toast.success(ar ? 'تم حفظ ترتيب المواد للصف.' : 'Subject order saved for this grade.');
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (ar ? 'تعذر حفظ ترتيب المواد.' : 'Could not save subject order.'));
    } finally { setSaving(false); }
  }

  const arabicNames: Record<string, string> = {
    arabic: 'اللغة العربية', 'arabic language': 'اللغة العربية',
    islamic: 'التربية الإسلامية', 'islamic studies': 'التربية الإسلامية',
    'social arabic': 'الدراسات الاجتماعية باللغة العربية', 'social studies in arabic': 'الدراسات الاجتماعية باللغة العربية',
  };
  const subjectLabel = (name: string) => ar ? arabicNames[name.trim().toLocaleLowerCase()] ?? name : name;
  const gradesWithSubjects = useMemo(() => grades.filter((grade) => grade.subjects.length > 0), [grades]);

  return <div className="mb-6 print:hidden" dir={ar ? 'rtl' : 'ltr'}>
    <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:border-emerald-700/40 hover:bg-emerald-50 hover:text-emerald-900"><span aria-hidden className="grid h-6 w-6 place-items-center rounded-lg bg-emerald-50 text-emerald-900">↕</span>{ar ? 'ترتيب مواد التقرير حسب الصف' : 'Set subject order by grade'}</button>
    {open && <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-6" onClick={() => { if (!saving) setOpen(false); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="report-subject-order-title" onClick={(event) => event.stopPropagation()} className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-7">
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-[min(100%,16rem)] flex-1">
        <h2 id="report-subject-order-title" className="text-lg font-bold text-slate-900">{ar ? 'ترتيب مواد التقرير حسب الصف' : 'Report subject order by grade'}</h2>
        <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{ar ? 'اختر الصف ثم حدّد رقم ظهور كل مادة. يؤثر الترتيب على تقارير هذا الصف فقط.' : 'Choose a grade, then set each subject’s position. This only affects reports for that grade.'}</p>
        <label className="mt-4 block text-sm font-semibold text-slate-700">{ar ? 'الصف' : 'Grade'}
          <select value={gradeId} onChange={(event) => chooseGrade(event.target.value)} disabled={loading || saving || !gradesWithSubjects.length} className="mt-1.5 block w-full max-w-sm rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium">
            {gradesWithSubjects.map((grade) => <option key={grade.id} value={grade.id}>{grade.name}</option>)}
            {!gradesWithSubjects.length && <option value="">{ar ? 'لا توجد مواد مرتبطة بالصفوف' : 'No grade subjects configured'}</option>}
          </select>
        </label>
      </div>
      <div className="flex items-center gap-2"><button type="button" onClick={() => setOpen(false)} disabled={saving} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50">{ar ? 'إلغاء' : 'Cancel'}</button><button type="button" onClick={() => void save()} disabled={loading || saving || !subjects.length} className="rounded-xl bg-[#123b36] px-4 py-2.5 text-sm font-bold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-50">{saving ? (ar ? 'جارٍ الحفظ…' : 'Saving…') : (ar ? 'حفظ ترتيب الصف' : 'Save grade order')}</button></div>
    </div>
    {loading ? <p className="mt-4 text-sm text-slate-500">{ar ? 'جارٍ تحميل المواد…' : 'Loading grades…'}</p> : selectedGrade && subjects.length ? <ol className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{subjects.map((subject, index) => <li key={subject.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50/70 p-3"><span className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-800">{subjectLabel(subject.name)}</span><label className="flex shrink-0 items-center gap-2 text-xs font-semibold text-slate-500">{ar ? 'الترتيب' : 'Position'}<select aria-label={`${subject.name} position`} value={index + 1} onChange={(event) => setPosition(subject.id, Number(event.target.value))} disabled={saving} className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm font-bold text-slate-800">{subjects.map((_, position) => <option key={position} value={position + 1}>{position + 1}</option>)}</select></label></li>)}</ol> : !loading && <p className="mt-4 text-sm text-slate-500">{ar ? 'الصف المحدد ليس لديه مواد.' : 'This grade has no assigned subjects.'}</p>}
    </section></div>}
  </div>;
}
