'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { toast } from 'react-hot-toast';
import type { MarkColumn } from '@/lib/student-marks';

type SchoolClass = { id: string; name: string };
type Subject = { id: string; name: string };
type Teacher = { id: string; name: string; classes: SchoolClass[]; subjects: Subject[] };
type Student = { id: string; name: string; mark: Record<string, number> };
type Summary = { className: string; subjects: { id: string; name: string; columns: MarkColumn[] }[]; students: { id: string; name: string; marks: Record<string, Record<string, number>> }[] };
type Props = { mode: 'admin' | 'teacher' };
const years = ['2024-2025', '2025-2026', '2026-2027'];
const semesters = ['1st Semester', '2nd Semester'];
const control = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 shadow-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100';

export default function StudentMarksManager({ mode }: Props) {
  const router = useRouter();
  const locale = useLocale();
  const rtl = locale === 'ar';
  const adminMode = mode === 'admin';
  const { data: session, status } = useSession();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherId, setTeacherId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [semester, setSemester] = useState(semesters[0]);
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, Record<string, number>>>({});
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [columns, setColumns] = useState<MarkColumn[]>([]);
  const [view, setView] = useState<'marks' | 'collective'>('marks');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    if (status !== 'authenticated') return;
    if ((adminMode && session?.user.role !== 'ADMIN') || (!adminMode && session?.user.role !== 'TEACHER')) { router.replace('/'); return; }
    let live = true;
    void (async () => {
      try {
        if (!adminMode) {
          const settingsResponse = await fetch('/api/admin/teacher-sections', { cache: 'no-store' });
          const settings = await settingsResponse.json();
          if (live && settingsResponse.ok && settings.sections?.studentMarks === false) { router.replace('/teacher'); return; }
        }
        const response = await fetch('/api/student-marks/options', { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!live) return;
        if (adminMode) setTeachers(data.teachers ?? []);
        else {
          const teacher = data.teacher as Teacher | undefined;
          if (teacher) {
            setTeachers([teacher]); setTeacherId(teacher.id);
            if (teacher.subjects.length === 1) setSubjectId(teacher.subjects[0].id);
          }
        }
      } catch (error) { if (live) toast.error(error instanceof Error ? error.message : (rtl ? 'تعذر تحميل بيانات الدرجات.' : 'Could not load marks workspace.')); }
      finally { if (live) setLoadingOptions(false); }
    })();
    return () => { live = false; };
  }, [status, session?.user?.role, adminMode, router, rtl]);

  const selectedTeacher = teachers.find((item) => item.id === teacherId);
  const classes = selectedTeacher?.classes ?? [];
  const subjects = selectedTeacher?.subjects ?? [];
  const selectedSubject = subjects.find((item) => item.id === subjectId);
  const maxima = useMemo(() => Object.fromEntries(columns.map(({ field, max }) => [field, max])), [columns]);

  useEffect(() => {
    if (!subjectId || !selectedSubject || !classId) { setColumns([]); return; }
    let live = true;
    setColumns([]);
    return () => { live = false; };
  }, [subjectId, selectedSubject?.name, classId, rtl]);

  useEffect(() => {
    setStudents([]); setMarks({});
    if (!classId || !subjectId || !academicYear || !semester || !teacherId) { setLoadingStudents(false); return; }
    const controller = new AbortController();
    setLoadingStudents(true);
    const query = new URLSearchParams({ classId, subjectId, academicYear, semester });
    if (adminMode) query.set('teacherId', teacherId);
    void fetch(`/api/student-marks?${query}`, { cache: 'no-store', signal: controller.signal }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const list = data.students as Student[];
      setColumns(data.columns ?? []);
      setStudents(list);
      setMarks(Object.fromEntries(list.map((student) => [student.id, Object.fromEntries((data.columns ?? []).map((column: MarkColumn) => [column.field, Number(student.mark?.[column.field] ?? 0)]))])));
    }).catch((error) => { if (error.name !== 'AbortError') toast.error(error instanceof Error ? error.message : (rtl ? 'تعذر تحميل درجات الطلاب.' : 'Could not load student marks.')); })
      .finally(() => { if (!controller.signal.aborted) setLoadingStudents(false); });
    return () => controller.abort();
  }, [teacherId, classId, subjectId, academicYear, semester, adminMode, rtl]);

  function changeMark(studentId: string, field: string, value: string) {
    const parsed = value === '' ? 0 : Number(value);
    setMarks((current) => ({ ...current, [studentId]: { ...current[studentId], [field]: Math.min(maxima[field] ?? 0, Math.max(0, Number.isFinite(parsed) ? parsed : 0)) } }));
  }
  function fillOrReset(field: string, fill: boolean) {
    const value = fill ? (maxima[field] ?? 0) : 0;
    setMarks((current) => Object.fromEntries(Object.entries(current).map(([studentId, values]) => [studentId, { ...values, [field]: value }])));
  }
  function totalFor(studentId: string) { return columns.reduce((total, column) => total + (marks[studentId]?.[column.field] ?? 0), 0); }
  async function save() {
    setSaving(true);
    try {
      const response = await fetch('/api/student-marks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacherId, classId, subjectId, academicYear, semester, students: students.map((student) => ({ studentId: student.id, values: marks[student.id] ?? {} })) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      toast.success(rtl ? `تم حفظ درجات ${data.saved} طالباً.` : `Marks saved for ${data.saved} students.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : (rtl ? 'تعذر حفظ الدرجات.' : 'Could not save marks.')); }
    finally { setSaving(false); }
  }
  async function loadCollectiveMarks() {
    setLoadingSummary(true); setSummary(null);
    try {
      const query = new URLSearchParams({ classId, academicYear, semester });
      if (adminMode) query.set('teacherId', teacherId);
      const response = await fetch(`/api/student-marks/summary?${query}`, { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setSummary(data as Summary); setView('collective');
    } catch (error) { toast.error(error instanceof Error ? error.message : (rtl ? 'تعذر تحميل كشف درجات الفصل.' : 'Could not load class marks overview.')); }
    finally { setLoadingSummary(false); }
  }
  function subjectTotal(student: Summary['students'][number], subject: Summary['subjects'][number]) {
    return subject.columns.reduce((total, column) => total + Number(student.marks[subject.id]?.[column.field] ?? 0), 0);
  }
  function gradeFor(value: number) {
    if (value >= 96) return 'A+'; if (value >= 93) return 'A'; if (value >= 89) return 'A−'; if (value >= 86) return 'B+'; if (value >= 83) return 'B'; if (value >= 79) return 'B−'; if (value >= 76) return 'C+'; if (value >= 73) return 'C'; if (value >= 69) return 'C−'; if (value >= 66) return 'D+'; if (value >= 63) return 'D'; if (value >= 60) return 'D−'; return '—';
  }
  function certificateUrl(studentId: string) {
    const query = new URLSearchParams({ classId, academicYear, semester });
    if (adminMode) query.set('teacherId', teacherId);
    return `/student-marks/certificate/${studentId}?${query}`;
  }

  const title = rtl ? 'درجات الطلاب' : 'Students Marks';
  const teacherLabel = rtl ? 'المعلم' : 'Teacher';
  const classLabel = rtl ? 'الفصل' : 'Class';
  const subjectLabel = rtl ? 'المادة' : 'Subject';
  const yearLabel = rtl ? 'السنة الدراسية' : 'Academic year';
  const termLabel = rtl ? 'الفصل الدراسي' : 'Semester';
  return <main dir={rtl ? 'rtl' : 'ltr'} className="mx-auto w-full max-w-[1500px] px-4 py-8 sm:px-7 xl:px-10">
    <div className="mb-7"><p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-800">{adminMode ? (rtl ? 'إدارة الدرجات' : 'Marks management') : (rtl ? 'مساحة المعلم' : 'Teacher workspace')}</p><h1 className="mt-2 text-3xl font-black text-slate-900">{title}</h1><p className="mt-2 text-slate-500">{rtl ? 'أدخل درجات الطلاب واحفظها حسب المادة والفصل الدراسي والسنة.' : 'Enter and save student marks by subject, semester, and academic year.'}</p></div>
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {adminMode && <label className="block text-sm font-semibold text-slate-700">{teacherLabel}<select className={`${control} mt-2`} value={teacherId} onChange={(event) => { setTeacherId(event.target.value); setClassId(''); setSubjectId(''); }}><option value="">{rtl ? 'اختر المعلم' : 'Choose teacher'}</option>{teachers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        <label className="block text-sm font-semibold text-slate-700">{classLabel}<select className={`${control} mt-2`} value={classId} onChange={(event) => setClassId(event.target.value)}><option value="">{rtl ? 'اختر الفصل' : 'Choose class'}</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="block text-sm font-semibold text-slate-700">{subjectLabel}<select className={`${control} mt-2`} value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">{rtl ? 'اختر المادة' : 'Choose subject'}</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="block text-sm font-semibold text-slate-700">{yearLabel}<select className={`${control} mt-2`} value={academicYear} onChange={(event) => setAcademicYear(event.target.value)}>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
        <label className="block text-sm font-semibold text-slate-700">{termLabel}<select className={`${control} mt-2`} value={semester} onChange={(event) => setSemester(event.target.value)}>{semesters.map((item, index) => <option key={item} value={item}>{rtl ? ['الفصل الدراسي الأول', 'الفصل الدراسي الثاني'][index] : item}</option>)}</select></label>
      </div>
      {!loadingOptions && (adminMode ? teachers.length === 0 : subjects.length === 0 || classes.length === 0) && <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">{rtl ? 'لا توجد فصول أو مواد مسندة لهذا الحساب.' : 'No classes or subjects are assigned to this account.'}</p>}
    </section>
    <div className="mb-4 flex flex-wrap gap-2 print:hidden">
      <button type="button" onClick={() => setView('marks')} className={`rounded-xl px-4 py-2 text-sm font-bold ${view === 'marks' ? 'bg-[#123b36] text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>{rtl ? 'إدخال الدرجات' : 'Enter marks'}</button>
      <button type="button" disabled={!classId || loadingSummary} onClick={() => void loadCollectiveMarks()} className={`rounded-xl px-4 py-2 text-sm font-bold ${view === 'collective' ? 'bg-[#123b36] text-white' : 'border border-slate-200 bg-white text-slate-700'} disabled:opacity-50`}>{loadingSummary ? (rtl ? 'جارٍ تحميل الكشف…' : 'Loading overview…') : (rtl ? 'كشف الفصل لكل المواد' : 'Collective class marks')}</button>
    </div> {view === 'collective' ? <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6"><div><h2 className="text-lg font-bold text-slate-900">{rtl ? 'كشف درجات الفصل لجميع المواد' : 'Collective class marks across subjects'}</h2><p className="mt-1 text-sm text-slate-500">{summary ? `${summary.className} · ${academicYear} · ${semester}` : (rtl ? 'اختر الفصل الدراسي لعرض كشف جميع المواد.' : 'Load the selected class and semester to view the subject totals.')}</p></div><div className="flex gap-2 print:hidden"><button type="button" disabled={!classId || loadingSummary} onClick={() => void loadCollectiveMarks()} className="rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">{rtl ? 'تحديث' : 'Refresh'}</button>{summary && <button type="button" onClick={() => window.print()} className="rounded-xl bg-[#123b36] px-4 py-2 text-sm font-bold text-white">{rtl ? 'طباعة الكشف' : 'Print overview'}</button>}</div></div>
      {loadingSummary ? <p className="px-5 py-12 text-center text-sm text-slate-500">{rtl ? 'جارٍ تحميل الكشف…' : 'Loading class overview…'}</p> : !summary ? <p className="px-5 py-12 text-center text-sm text-slate-500">{rtl ? 'اضغط كشف الفصل لعرض درجات جميع المواد.' : 'Choose “Collective class marks” to load every subject.'}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] border-collapse text-sm"><thead className="bg-[#123b36] text-white"><tr><th className="px-3 py-3 text-center">{rtl ? 'م' : '#'}</th><th className="px-4 py-3 text-start">{rtl ? 'اسم الطالب' : 'Student'}</th>{summary.subjects.map((subject) => <th key={subject.id} className="px-3 py-3 text-center">{subject.name}<span className="mt-1 block text-xs text-emerald-100">{rtl ? 'الدرجة / القصوى' : 'Score / max'}</span></th>)}<th className="px-3 py-3 text-center">{rtl ? 'المجموع' : 'Grand total'}</th><th className="px-3 py-3 text-center print:hidden">{rtl ? 'الشهادة' : 'Certificate'}</th></tr></thead><tbody className="divide-y divide-slate-100">{summary.students.map((student, index) => { const total = summary.subjects.reduce((sum, subject) => sum + subjectTotal(student, subject), 0); const possible = summary.subjects.reduce((sum, subject) => sum + subject.columns.reduce((columnSum, column) => columnSum + column.max, 0), 0); return <tr key={student.id} className="even:bg-slate-50"><td className="px-3 py-3 text-center text-slate-500">{index + 1}</td><td className="px-4 py-3 font-semibold text-slate-900">{student.name}</td>{summary.subjects.map((subject) => { const score = subjectTotal(student, subject); const max = subject.columns.reduce((sum, column) => sum + column.max, 0); return <td key={subject.id} className="px-3 py-3 text-center font-semibold">{score} / {max}<span className="ms-1 text-xs text-slate-500">{gradeFor(max ? score / max * 100 : 0)}</span></td>; })}<td className="px-3 py-3 text-center font-black">{total} / {possible}</td><td className="px-3 py-3 text-center print:hidden"><a href={certificateUrl(student.id)} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-900">{rtl ? 'عرض / طباعة' : 'View / print'}</a></td></tr>; })}{summary.students.length === 0 && <tr><td colSpan={summary.subjects.length + 4} className="px-4 py-10 text-center text-slate-500">{rtl ? 'لا يوجد طلاب في هذا الفصل.' : 'There are no students in this class.'}</td></tr>}</tbody></table></div>}
    </section> : <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6"><div><h2 className="text-lg font-bold text-slate-900">{classes.find((item) => item.id === classId)?.name ?? (rtl ? 'قائمة الطلاب' : 'Class roster')}</h2><p className="mt-1 text-sm text-slate-500">{selectedSubject?.name ?? (rtl ? 'اختر المادة والفصل لعرض الطلاب' : 'Choose a class and subject to view students')}</p></div>{students.length > 0 && <button type="button" disabled={saving} onClick={() => void save()} className="rounded-xl bg-[#123b36] px-4 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50">{saving ? (rtl ? 'جارٍ الحفظ…' : 'Saving…') : (rtl ? 'حفظ الدرجات' : 'Save marks')}</button>}</div>
      {loadingStudents ? <div className="px-5 py-12 text-center text-sm text-slate-500">{rtl ? 'جارٍ تحميل درجات الطلاب…' : 'Loading student marks…'}</div> : students.length === 0 ? <div className="px-5 py-12 text-center text-sm text-slate-500">{rtl ? 'اختر الفصل والمادة لعرض الطلاب.' : 'Choose a class and subject to load students.'}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] border-collapse text-sm"><thead className="bg-[#123b36] text-white"><tr><th className="px-3 py-3 text-center">{rtl ? 'م' : '#'}</th><th className="min-w-48 px-4 py-3 text-start">{rtl ? 'اسم الطالب' : 'Student'}</th>{columns.map((column) => <th key={column.field} className="min-w-32 px-2 py-3 text-center"><span className="block">{rtl ? column.labelAr : column.label}</span><span className="mt-0.5 block text-xs text-emerald-100">({column.max})</span><span className="mt-2 flex justify-center gap-1">{column.field === 'quiz1' || column.field === 'quiz2' ? <span className="rounded bg-white/15 px-2 py-1 text-[11px]">{rtl ? 'من قسم الاختبارات' : 'From Quiz Marks'}</span> : <><button type="button" onClick={() => fillOrReset(column.field, true)} className="rounded bg-white/15 px-2 py-1 text-[11px] font-bold hover:bg-white/25">{rtl ? 'تعبئة' : 'Fill'}</button><button type="button" onClick={() => fillOrReset(column.field, false)} className="rounded bg-white/15 px-2 py-1 text-[11px] font-bold hover:bg-white/25">{rtl ? 'تصفير' : 'Reset'}</button></>}</span></th>)}<th className="px-3 py-3 text-center">{rtl ? 'المجموع' : 'Total'}</th></tr></thead><tbody className="divide-y divide-slate-100">{students.map((student, index) => <tr key={student.id} className="even:bg-slate-50"><td className="px-3 py-3 text-center text-slate-500">{index + 1}</td><td className="px-4 py-3 font-semibold text-slate-900"><a href={certificateUrl(student.id)} target="_blank" rel="noreferrer" className="hover:text-emerald-800 hover:underline">{student.name}</a></td>{columns.map((column) => { const field = column.field; const value = marks[student.id]?.[field] ?? 0; const max = column.max; const below = max > 0 && value < column.min; return <td key={field} className="p-2"><input aria-label={`${student.name} ${rtl ? column.labelAr : column.label}`} type="number" min={0} max={max} value={value} disabled={field === 'quiz1' || field === 'quiz2'} onChange={(event) => changeMark(student.id, field, event.target.value)} className={`w-full rounded-lg border px-2 py-2 text-center font-semibold outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:bg-slate-100 ${below ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-slate-200 bg-white text-slate-800'}`} /></td>; })}<td className="px-3 py-3 text-center font-black text-slate-900">{totalFor(student.id)}</td></tr>)}</tbody></table></div>}
      {students.length > 0 && <div className="flex justify-end border-t border-slate-100 p-4"><button type="button" disabled={saving} onClick={() => void save()} className="rounded-xl bg-[#123b36] px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50">{saving ? (rtl ? 'جارٍ الحفظ…' : 'Saving…') : (rtl ? 'حفظ الدرجات' : 'Save marks')}</button></div>}
    </section>}
  </main>;
}
