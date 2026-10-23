'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';

type Group = 'people' | 'marks' | 'reports' | 'planning' | 'schedules' | 'settings';
type BackupOptions = { grades: { id: string; name: string }[]; classes: { id: string; name: string; gradeId: string | null }[]; years: string[]; terms: string[] };

export default function DataBackup() {
  const locale = useLocale();
  const ar = locale === 'ar';
  const groups: { id: Group; title: string; description: string }[] = ar ? [
    { id: 'people', title: 'الطلاب والمعلمون والفصول والمواد', description: 'الحسابات، الطلاب، الصفوف، المواد، والتكليفات والربط بينهم.' },
    { id: 'marks', title: 'الدرجات وإعداداتها', description: 'درجات كل فصل دراسي، نتائج الاختبارات، ومخططات توزيع الدرجات.' },
    { id: 'reports', title: 'تقارير الطلاب', description: 'تقارير المعلمين وملاحظاتهم وتوصياتهم لكل طالب.' },
    { id: 'planning', title: 'الخطط والدروس', description: 'الدروس والخطط الأسبوعية وتسليمات المعلمين وملاحظات الإدارة.' },
    { id: 'schedules', title: 'الجداول', description: 'الجداول الدراسية والحصص والمعلمين والمواد المرتبطة بها.' },
    { id: 'settings', title: 'إعدادات التطبيق', description: 'إعدادات التطبيق المحفوظة.' },
  ] : [
    { id: 'people', title: 'People, classes and subjects', description: 'Accounts, students, grades, classes, subjects and their assignments.' },
    { id: 'marks', title: 'Marks and grading setup', description: 'Marks from every term, quiz results and grading schemes.' },
    { id: 'reports', title: 'Student reports', description: 'Teacher reports, comments and recommendations for each student.' },
    { id: 'planning', title: 'Plans and lessons', description: 'Lessons, weekly plans, teacher submissions and admin notes.' },
    { id: 'schedules', title: 'Schedules', description: 'Class schedules, sessions, teachers and assigned subjects.' },
    { id: 'settings', title: 'App settings', description: 'Saved application settings.' },
  ];
  const [selected, setSelected] = useState<Group[]>(groups.map(({ id }) => id));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [options, setOptions] = useState<BackupOptions>({ grades: [], classes: [], years: [], terms: [] });
  const [gradeId, setGradeId] = useState('');
  const [classId, setClassId] = useState('');
  const [academicYear, setAcademicYear] = useState('');
  const [term, setTerm] = useState('');
  const [optionsError, setOptionsError] = useState('');
  const eligibleClasses = useMemo(() => options.classes.filter((item) => !gradeId || item.gradeId === gradeId), [options.classes, gradeId]);

  useEffect(() => {
    let live = true;
    void fetch('/api/admin/backup/options', { cache: 'no-store' }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not load backup filters.');
      if (live) setOptions(data as BackupOptions);
    }).catch((cause) => { if (live) setOptionsError(cause instanceof Error ? cause.message : 'Could not load backup filters.'); });
    return () => { live = false; };
  }, []);

  function toggle(id: Group) {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
    setError('');
    setNotice('');
  }

  async function exportSelected() {
    if (!selected.length || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const query = new URLSearchParams();
      selected.forEach((group) => query.append('group', group));
      if (selected.includes('marks')) {
        if (gradeId) query.set('gradeId', gradeId);
        if (classId) query.set('classId', classId);
        if (academicYear) query.set('academicYear', academicYear);
        if (term) query.set('term', term);
      }
      const response = await fetch(`/api/admin/backup?${query.toString()}`, { cache: 'no-store' });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error || (ar ? 'تعذر تصدير النسخة الاحتياطية.' : 'Could not export the backup.'));
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `forqan-school-backup-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setNotice(ar ? 'تم تنزيل ملف النسخة الاحتياطية.' : 'Your backup file has been downloaded.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : (ar ? 'تعذر تصدير النسخة الاحتياطية.' : 'Could not export the backup.'));
    } finally {
      setBusy(false);
    }
  }

  return <section className="card space-y-6 p-5 sm:p-7">
    <div><h2 className="text-xl font-bold text-slate-900">{ar ? 'نسخ احتياطي للبيانات' : 'Data backup'}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{ar ? 'اختر أقسام البيانات التي تريد تضمينها، ثم نزّلها في ملف CSV واحد.' : 'Choose the data sections to include, then download them as one CSV file.'}</p></div>
    <div className="grid gap-3 sm:grid-cols-2">
      {groups.map((group) => <label key={group.id} className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${selected.includes(group.id) ? 'border-blue-300 bg-blue-50/60' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
        <input type="checkbox" checked={selected.includes(group.id)} onChange={() => toggle(group.id)} className="mt-1 h-4 w-4 shrink-0 accent-blue-700" />
        <span><span className="block text-sm font-semibold text-slate-900">{group.title}</span><span className="mt-1 block text-xs leading-5 text-slate-600">{group.description}</span></span>
      </label>)}
    </div>
    {selected.includes('marks') && <section className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5"><div className="mb-4"><h3 className="text-base font-bold text-slate-900">{ar ? 'تصفية تصدير الدرجات' : 'Filter marks export'}</h3><p className="mt-1 text-xs leading-5 text-slate-600">{ar ? 'اترك الحقل على «الكل» لتصدير جميع البيانات المتاحة فيه. اختيار الصف يحدّث قائمة الفصول.' : 'Leave a filter on “All” to include every available value. Choosing a grade narrows the class list.'}</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <label className="text-sm font-semibold text-slate-700">{ar ? 'الصف' : 'Grade'}<select value={gradeId} onChange={(event) => { setGradeId(event.target.value); setClassId(''); }} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium"><option value="">{ar ? 'كل الصفوف' : 'All grades'}</option>{options.grades.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="text-sm font-semibold text-slate-700">{ar ? 'الفصل' : 'Class'}<select value={classId} onChange={(event) => setClassId(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium"><option value="">{ar ? 'كل الفصول' : 'All classes'}</option>{eligibleClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className="text-sm font-semibold text-slate-700">{ar ? 'السنة الدراسية' : 'Academic year'}<select value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium"><option value="">{ar ? 'كل السنوات' : 'All years'}</option>{options.years.map((year) => <option key={year} value={year}>{year}</option>)}</select></label>
      <label className="text-sm font-semibold text-slate-700">{ar ? 'الفصل الدراسي' : 'Term'}<select value={term} onChange={(event) => setTerm(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium"><option value="">{ar ? 'كل الفصول الدراسية' : 'All terms'}</option>{options.terms.map((item) => <option key={item} value={item}>{ar ? (item === '1st Semester' ? 'الفصل الدراسي الأول' : 'الفصل الدراسي الثاني') : item}</option>)}</select></label>
    </div><p className="mt-3 text-xs leading-5 text-slate-500">{ar ? 'تُطبّق السنة والفصل الدراسي على سجلات الدرجات التي تحتوي على بيانات الفترة. السجلات القديمة التي لا تحتوي على سنة أو فصل تُضمّن فقط عند اختيار «كل السنوات» و«كل الفصول الدراسية».' : 'Year and term filters apply to marks that store period details. Legacy marks without a year or term are included only when both filters are set to “All”.'}</p>{optionsError && <p role="status" className="mt-3 text-xs text-amber-800">{ar ? 'تعذر تحميل خيارات التصفية.' : optionsError}</p>}</section>}
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">{ar ? 'يتضمن ملف النسخة الاحتياطية بيانات حساسة، ومنها حسابات المستخدمين والتوقيعات. احفظه في مكان آمن.' : 'Backup files contain sensitive data, including user accounts and signatures. Store the downloaded file securely.'}</div>
    {(error || notice) && <p role={error ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm font-medium ${error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>{error || notice}</p>}
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-5"><p className="text-sm text-slate-500">{ar ? `تم اختيار ${selected.length} من ${groups.length} أقسام` : `${selected.length} of ${groups.length} sections selected`}</p><button type="button" disabled={!selected.length || busy} onClick={() => void exportSelected()} className="btn-primary disabled:cursor-not-allowed disabled:opacity-50">{busy ? (ar ? 'جارٍ تجهيز النسخة…' : 'Preparing backup…') : (ar ? 'تصدير المحدد' : 'Export selected data')}</button></div>
  </section>;
}
