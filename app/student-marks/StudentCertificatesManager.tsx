'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';
import { useAdminFeature } from '@/app/admin/useAdminFeature';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import type { MarkColumn } from '@/lib/student-marks';
import { ControlLoader } from '@/app/components/ControlLoader';
import { SEMESTERS } from '@/lib/academic-periods';

type SchoolClass = { id: string; name: string };
type Subject = { id: string; name: string; columns: MarkColumn[] };
type EditInfo = { name: string | null; at: string | Date };
type Student = { id: string; name: string; marks: Record<string, Record<string, number>>; gradedSubjectIds?: string[]; completedSubjectIds?: string[]; recordedColumns?: Record<string, string[]>; absentFinalExams?: Record<string, boolean>; lastEdited?: Record<string, { marks: EditInfo | null; quizzes: EditInfo | null }> };
type Summary = { className: string; subjects: Subject[]; students: Student[]; curriculumFallback?: boolean; curriculumWarning?: string | null };

function recordedColumnsFor(student: Student, subject: Subject) {
  return new Set(student.recordedColumns?.[subject.id] ?? []);
}

function ClassMarksPrintTable({ summary, academicYear, semester, rtl }: { summary: Summary; academicYear: string; semester: string; rtl: boolean }) {
  const everyoneComplete = summary.students.every((student) => summary.subjects.every((subject) => student.completedSubjectIds?.includes(subject.id)));
  return <section className="class-marks-print-only hidden">
    <header className="mb-3 flex items-end justify-between border-b-2 border-[#222831] pb-2"><div><p className="text-[8pt] font-bold uppercase tracking-widest text-[#e16262]">{rtl ? 'كشف درجات الفصل' : 'Class marks report'}</p><h1 className="text-xl font-black text-[#222831]">{summary.className}</h1></div><p className="text-[9pt] font-semibold text-[#333333]">{academicYear} · {rtl ? (semester === '1st Semester' ? 'الفصل الدراسي الأول' : 'الفصل الدراسي الثاني') : semester} · {summary.students.length} {rtl ? 'طلاب' : 'students'}</p></header>
    <table className="w-full border-collapse text-[8pt]"><thead><tr><th className="w-8">{rtl ? 'م' : '#'}</th><th className="min-w-36 text-start">{rtl ? 'اسم الطالب' : 'Student'}</th>{summary.subjects.map((subject) => <th key={subject.id} className="text-center">{subject.name}<span className="mt-0.5 block font-normal">{rtl ? 'المجموع' : 'Subject total'}</span></th>)}<th>{everyoneComplete ? (rtl ? 'المجموع الكلي' : 'Grand total') : (rtl ? 'الدرجات المسجلة' : 'Recorded marks')}<span className="block font-normal">{rtl ? 'يختلف حسب اكتمال الدرجات' : 'Based on recorded columns'}</span></th></tr></thead><tbody>{summary.students.map((student, index) => {
      const total = summary.subjects.reduce((sum, subject) => sum + subject.columns.filter((column) => recordedColumnsFor(student, subject).has(column.field)).reduce((subjectSum, column) => subjectSum + Number(student.marks[subject.id]?.[column.field] ?? 0), 0), 0);
      return <tr key={student.id}><td className="text-center">{index + 1}</td><td className="font-semibold">{student.name}</td>{summary.subjects.map((subject) => {
        const recorded = recordedColumnsFor(student, subject);
        const complete = student.completedSubjectIds?.includes(subject.id) ?? false;
        const earned = subject.columns.filter((column) => recorded.has(column.field)).reduce((sum, column) => sum + Number(student.marks[subject.id]?.[column.field] ?? 0), 0);
        const possible = subject.columns.filter((column) => recorded.has(column.field)).reduce((sum, column) => sum + column.max, 0);
        const absent = student.absentFinalExams?.[subject.id] === true;
        return <td key={subject.id} className="text-center"><bdi dir="ltr">{earned} / {possible}</bdi>{!complete && <span className="block font-semibold">{rtl ? 'درجة جزئية' : 'Partial marks'}</span>}{absent && <span className="block font-bold text-[#e16262]">{rtl ? 'غائب عن الاختبار النهائي' : 'Final exam absent'}</span>}</td>;
      })}<td className="text-center font-bold"><bdi dir="ltr">{total}</bdi><span className="block">{everyoneComplete ? (rtl ? 'مكتمل' : 'Complete') : (rtl ? 'مسجل فقط' : 'Recorded only')}</span></td></tr>;
    })}</tbody></table>
  </section>;
}

const years = ['2024-2025', '2025-2026', '2026-2027'];
const terms = SEMESTERS;
const control = 'mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 shadow-sm focus:border-[#e16262] focus:outline-none focus:ring-2 focus:ring-[#fce1e1]';

export default function StudentCertificatesManager() {
  useAdminFeature('certificates');
  const locale = useLocale();
  const rtl = locale === 'ar';
  const router = useRouter();
  const { data: session, status } = useSession();
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [academicYears, setAcademicYears] = useState(years);
  const [classId, setClassId] = useState('');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [semester, setSemester] = useState<string>(terms[0]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingReport, setLoadingReport] = useState(false);
  const [savingCells, setSavingCells] = useState<Set<string>>(new Set());
  const [changedCells, setChangedCells] = useState<Set<string>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    if (status !== 'authenticated') return;
    if (!['ADMIN', 'CUSTOM_ADMIN'].includes(session?.user.role ?? '')) { router.replace('/'); return; }
    let active = true;
    void fetch('/api/admin/student-certificates/options', { cache: 'no-store' })
      .then(async (response) => { const data = await response.json(); if (!response.ok) throw new Error(data.error); if (active) { setClasses(data.classes ?? []); setAcademicYears([...new Set([...years, ...(data.academicYears ?? [])])].sort((a, b) => b.localeCompare(a))); } })
      .catch((error) => toast.error(error instanceof Error ? error.message : (rtl ? 'تعذر تحميل الفصول.' : 'Could not load classes.')))
      .finally(() => { if (active) setLoadingOptions(false); });
    return () => { active = false; };
  }, [status, session?.user?.role, router, rtl]);

  useEffect(() => { setSummary(null); setExpandedSubjects(new Set()); setChangedCells(new Set()); }, [classId, academicYear, semester]);

  async function loadReport() {
    if (!classId) return;
    setLoadingReport(true);
    try {
      const query = new URLSearchParams({ classId, academicYear, semester });
      const response = await fetch(`/api/student-marks/summary?${query}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSummary(data as Summary);
    } catch (error) { toast.error(error instanceof Error ? error.message : (rtl ? 'تعذر تحميل كشف الدرجات.' : 'Could not load class marks.')); }
    finally { setLoadingReport(false); }
  }

  function studentTotal(student: Student) { return summary?.subjects.reduce((sum, subject) => sum + subject.columns.filter((column) => recordedColumnsFor(student, subject).has(column.field)).reduce((sub, column) => sub + Number(student.marks[subject.id]?.[column.field] ?? 0), 0), 0) ?? 0; }
  function certificateUrl(studentId: string) {
    const query = new URLSearchParams({ classId, academicYear, semester });
    return `/student-marks/certificate/${studentId}?${query}`;
  }
  const semesterLabel = (value: string) => rtl ? ({ '1st Semester': 'الفصل الدراسي الأول', '2nd Semester': 'الفصل الدراسي الثاني' } as Record<string, string>)[value] ?? value : value;
  function cellKey(studentId: string, subjectId: string, field: string) { return `${studentId}:${subjectId}:${field}`; }
  function toggleSubject(subjectId: string) {
    setExpandedSubjects((current) => {
      const next = new Set(current);
      if (next.has(subjectId)) next.delete(subjectId); else next.add(subjectId);
      return next;
    });
  }
  async function saveCell(student: Student, subject: Subject, column: MarkColumn, score: number) {
    const key = cellKey(student.id, subject.id, column.field);
    if (!changedCells.has(key)) return;
    setSavingCells((current) => new Set(current).add(key));
    try {
      const response = await fetch('/api/admin/student-certificates/marks', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ studentId: student.id, classId, subjectId: subject.id, academicYear, semester, field: column.field, score: score || null }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const editedAt = data.editedAt as string;
      const quiz = column.quizAverage === true;
      const editInfo = { name: data.editorName ?? null, at: editedAt };
      setSummary((current) => current ? { ...current, students: current.students.map((row) => {
        if (row.id !== student.id) return row;
        const previous = row.lastEdited?.[subject.id];
        return { ...row, lastEdited: { ...row.lastEdited, [subject.id]: { marks: quiz ? previous?.marks ?? null : editInfo, quizzes: quiz ? editInfo : previous?.quizzes ?? null } } };
      }) } : current);
      setChangedCells((current) => { const next = new Set(current); next.delete(key); return next; });
      toast.success(rtl ? 'تم حفظ الدرجة.' : 'Mark saved.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : (rtl ? 'تعذر حفظ الدرجة.' : 'Could not save mark.'));
      await loadReport();
      setChangedCells((current) => { const next = new Set(current); next.delete(key); return next; });
    } finally { setSavingCells((current) => { const next = new Set(current); next.delete(key); return next; }); }
  }

  return <main dir={rtl ? 'rtl' : 'ltr'} className="class-marks-print mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-7 xl:px-10">
    {(loadingOptions || loadingReport) && <ControlLoader message={rtl ? 'يرجى الانتظار، جارٍ معالجة طلبك…' : 'Please wait, we are processing your request…'} />}
    <div className="mb-7"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#e16262]">{rtl ? 'إدارة الدرجات' : 'Marks management'}</p><h1 className="mt-2 text-3xl font-black text-slate-900">{rtl ? 'كشف درجات الطلاب' : 'Student marks by class'}</h1><p className="mt-2 text-slate-500">{rtl ? 'اختر الفصل والسنة والفصل الدراسي لعرض درجات جميع الطلاب في جميع المواد.' : 'Choose a class, academic year, and semester to view every student’s marks across all subjects.'}</p></div>

    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="block text-sm font-semibold text-slate-700">{rtl ? 'الفصل' : 'Class'}<select className={control} value={classId} onChange={(event) => setClassId(event.target.value)}><option value="">{rtl ? 'اختر الفصل' : 'Choose class'}</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="block text-sm font-semibold text-slate-700">{rtl ? 'السنة الدراسية' : 'Academic year'}<select className={control} value={academicYear} onChange={(event) => setAcademicYear(event.target.value)}>{academicYears.map((year) => <option key={year}>{year}</option>)}</select></label>
        <label className="block text-sm font-semibold text-slate-700">{rtl ? 'الفصل الدراسي' : 'Semester'}<select className={control} value={semester} onChange={(event) => setSemester(event.target.value)}>{terms.map((item) => <option key={item} value={item}>{semesterLabel(item)}</option>)}</select></label>
        <div className="flex items-end"><button type="button" disabled={!classId || loadingReport} onClick={() => void loadReport()} className="w-full rounded-xl bg-[#18181b] px-4 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50">{rtl ? 'عرض الدرجات' : 'View marks'}</button></div>
      </div>
      {!loadingOptions && classes.length === 0 && <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">{rtl ? 'لا توجد فصول متاحة.' : 'No classes are available.'}</p>}
      {summary?.curriculumWarning && <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">{rtl ? 'لا توجد مواد مرتبطة بهذا الفصل. اربط المواد بالصف أو بالفصل حتى يظهر كشف الدرجات.' : summary.curriculumWarning}</p>}
      {summary?.curriculumFallback && summary.subjects.length > 0 && <p role="status" className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">{rtl ? 'روابط منهج الفصل غير مكتملة؛ نستخدم مواد مدرسي الفصل والمواد المسجلة عليه، أو كتالوج المدرسة عند غيابها. اربط مواد الصف أو الفصل لضمان دقة القائمة.' : 'This class is missing curriculum links. The report falls back to teacher assignments, existing marks, or the school catalog; link the class or grade curriculum to confirm the complete subject list.'}</p>}
    </section>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6"><div><h2 className="text-lg font-bold text-slate-900">{rtl ? 'درجات الفصل لجميع المواد' : 'Class marks across all subjects'}</h2><p className="mt-1 text-sm text-slate-500">{summary ? `${summary.className} · ${academicYear} · ${semesterLabel(semester)} · ${summary.students.length} ${rtl ? 'طلاب' : 'students'}` : (rtl ? 'اختر المعايير ثم اعرض الدرجات.' : 'Select the filters above, then view the class report.')}</p></div>{summary && <button type="button" onClick={() => window.print()} className="rounded-xl bg-[#18181b] px-4 py-2 text-sm font-bold text-white print:hidden">{rtl ? 'طباعة الكشف' : 'Print report'}</button>}</div>
      {loadingReport ? <div className="px-5 py-12 text-center text-sm text-slate-500">{rtl ? 'جارٍ تحميل الدرجات…' : 'Loading marks…'}</div> : !summary ? <div className="px-5 py-12 text-center text-sm text-slate-500">{rtl ? 'سيظهر كشف الفصل هنا.' : 'The class report will appear here.'}</div> : <><p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs text-slate-600 print:hidden">{rtl ? 'اسحب الجدول أفقيًا لرؤية كل المواد. يظل اسم الطالب ورؤوس الأعمدة ظاهرة أثناء التمرير.' : 'Scroll horizontally to see all subjects. Student names and headers stay visible while scrolling.'}</p><div className="screen-class-marks-report overflow-x-auto"><table className="w-full min-w-max border-collapse text-sm"><thead className="bg-[#18181b] text-white"><tr><th rowSpan={2} className="border border-white/15 px-3 py-3 text-center">{rtl ? 'م' : '#'}</th><th rowSpan={2} className="min-w-48 border border-white/15 px-4 py-3 text-start">{rtl ? 'اسم الطالب' : 'Student'}</th>{summary.subjects.map((subject) => { const expanded = expandedSubjects.has(subject.id); return <th key={subject.id} colSpan={expanded ? subject.columns.length + 1 : 1} className="border border-white/15 px-3 py-3 text-center"><span className="block">{subject.name}</span><button type="button" onClick={() => toggleSubject(subject.id)} className="mt-1 rounded bg-white/15 px-2 py-1 text-[11px] font-semibold text-white hover:bg-white/25 print:hidden">{expanded ? (rtl ? 'إخفاء التفاصيل' : 'Hide details') : (rtl ? 'عرض التفاصيل' : 'Show details')}</button></th>; })}<th rowSpan={2} className="border border-white/15 px-3 py-3 text-center">{rtl ? 'الدرجات المسجلة' : 'Recorded marks'}<span className="mt-1 block text-xs text-zinc-300">{rtl ? 'المكونات المسجلة فقط' : 'Recorded components only'}</span></th><th rowSpan={2} className="border border-white/15 px-3 py-3 text-center print:hidden">{rtl ? 'الشهادة' : 'Certificate'}</th></tr><tr>{summary.subjects.flatMap((subject) => [...(expandedSubjects.has(subject.id) ? subject.columns.map((column) => <th key={`${subject.id}:${column.field}`} className="min-w-24 border border-white/15 px-2 py-2 text-center"><span className="block">{rtl ? column.labelAr : column.label}</span><span className="text-xs text-zinc-300"><bdi dir="ltr">/ {column.max}</bdi></span></th>) : []), <th key={`${subject.id}:total`} className="border border-white/15 px-2 py-2 text-center">{rtl ? 'مجموع المادة' : 'Subject total'}</th>])}</tr></thead><tbody className="divide-y divide-slate-100">{summary.students.map((student, index) => <tr key={student.id} className="even:bg-slate-50"><td className="border-x border-slate-100 px-3 py-3 text-center text-slate-500">{index + 1}</td><td className="border-x border-slate-100 px-4 py-3 font-semibold text-slate-900">{student.name}</td>{summary.subjects.flatMap((subject) => [...(expandedSubjects.has(subject.id) ? subject.columns.map((column) => { const key = cellKey(student.id, subject.id, column.field); const quiz = column.quizAverage === true; const editor = student.lastEdited?.[subject.id]?.[quiz ? 'quizzes' : 'marks']; const editedDate = editor?.at ? new Date(editor.at).toLocaleDateString() : ''; return <td key={`${subject.id}:${column.field}`} className="border-x border-slate-100 px-2 py-2 text-center"><input type="number" min={1} max={column.max} aria-label={`${student.name} ${subject.name} ${column.label}`} value={Number(student.marks[subject.id]?.[column.field] ?? 0) || undefined} disabled={savingCells.has(key) || Boolean(column.readOnly) || (column.field === 'finalExam' && student.absentFinalExams?.[subject.id] === true)} onChange={(event) => { const value = event.target.value === '' ? 0 : Number(event.target.value); setSummary((current) => current ? { ...current, students: current.students.map((row) => row.id !== student.id ? row : { ...row, marks: { ...row.marks, [subject.id]: { ...row.marks[subject.id], [column.field]: value } } }) } : current); setChangedCells((current) => new Set(current).add(key)); }} onBlur={(event) => void saveCell(student, subject, column, Number(event.currentTarget.value))} placeholder={student.absentFinalExams?.[subject.id] && column.field === 'finalExam' ? (rtl ? 'غائب' : 'Absent') : ''} className="w-20 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-center font-semibold text-slate-800 outline-none focus:border-[#e16262] focus:ring-2 focus:ring-[#fce1e1] print:hidden" /><span className="hidden print:inline"><bdi dir="ltr">{student.absentFinalExams?.[subject.id] && column.field === 'finalExam' ? (rtl ? 'غائب' : 'Absent') : recordedColumnsFor(student, subject).has(column.field) ? Number(student.marks[subject.id]?.[column.field] ?? 0) : '—'}</bdi></span><span className="mt-1 block max-w-28 text-[10px] leading-tight text-slate-500" title={editor?.at ? new Date(editor.at).toLocaleString() : undefined}>{savingCells.has(key) ? (rtl ? 'جارٍ الحفظ…' : 'Saving…') : editor?.name ? <>{rtl ? 'آخر تعديل: ' : 'Edited by '}{editor.name}<span className="block">{editedDate}</span></> : (rtl ? 'لم تعدل' : 'Not edited')}</span></td>; }) : []), <td key={`${subject.id}:total`} className="border-x border-slate-100 px-2 py-3 text-center font-bold"><bdi dir="ltr">{subject.columns.filter((column) => recordedColumnsFor(student, subject).has(column.field)).reduce((sum, column) => sum + Number(student.marks[subject.id]?.[column.field] ?? 0), 0)} / {subject.columns.filter((column) => recordedColumnsFor(student, subject).has(column.field)).reduce((sum, column) => sum + column.max, 0)}</bdi>{!student.completedSubjectIds?.includes(subject.id) && <span className="block text-[10px]">{rtl ? 'جزئي' : 'Partial'}</span>}</td>])}<td className="border-x border-slate-100 px-3 py-3 text-center font-black"><bdi dir="ltr">{studentTotal(student)}</bdi><span className="block text-[10px]">{rtl ? 'الإجمالي المسجل' : 'Recorded total'}</span></td><td className="border-x border-slate-100 px-3 py-3 text-center print:hidden"><a href={certificateUrl(student.id)} target="_blank" rel="noreferrer" className="whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#e16262]">{rtl ? 'عرض / طباعة' : 'View / print'}</a></td></tr>)}{summary.students.length === 0 && <tr><td colSpan={summary.subjects.length + 4} className="px-4 py-10 text-center text-slate-500">{rtl ? 'لا يوجد طلاب في هذا الفصل.' : 'There are no students in this class.'}</td></tr>}</tbody></table></div></>}
    </section>
    {summary && <ClassMarksPrintTable summary={summary} academicYear={academicYear} semester={semester} rtl={rtl} />}
  </main>;
}
