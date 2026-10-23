'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { toast, type Toast } from 'react-hot-toast';
import type { MarkColumn } from '@/lib/student-marks';
import { ControlLoader } from '@/app/components/ControlLoader';
import { MarkDeadlineCountdown } from '@/app/student-marks/MarkDeadlineCountdown';
import { SEMESTERS } from '@/lib/academic-periods';
import { useAdminFeature } from '@/app/admin/useAdminFeature';

type SchoolClass = { id: string; name: string };
type Subject = { id: string; name: string };
type Teacher = { id: string; name: string; classes: SchoolClass[]; subjects: Subject[] };
type Student = { id: string; name: string; mark: Record<string, number>; finalExamAbsent?: boolean };
type Summary = { className: string; subjects: { id: string; name: string; columns: MarkColumn[] }[]; students: { id: string; name: string; marks: Record<string, Record<string, number>>; absentFinalExams?: Record<string, boolean> }[] };
type Props = { mode: 'admin' | 'teacher'; initialView?: 'marks' | 'collective' };
const years = ['2024-2025', '2025-2026', '2026-2027'];
const semesters = SEMESTERS;
const control = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 shadow-sm focus:border-[#e16262] focus:outline-none focus:ring-2 focus:ring-[#fce1e1]';

function markColor(score: number, max: number) {
  if (score <= 0 || max <= 0) return 'border-slate-200 bg-white text-slate-800';
  const percent = score / max * 100;
  if (percent >= 90) return 'border-green-300 bg-green-100 text-green-950';
  if (percent >= 80) return 'border-pink-300 bg-pink-100 text-pink-950';
  if (percent >= 70) return 'border-yellow-300 bg-yellow-100 text-yellow-950';
  return 'border-red-300 bg-red-100 text-red-950';
}

export default function StudentMarksManager({ mode, initialView = 'marks' }: Props) {
  const adminMode = mode === 'admin';
  useAdminFeature('studentMarks', adminMode);
  const router = useRouter();
  const locale = useLocale();
  const rtl = locale === 'ar';
  const { data: session, status } = useSession();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [teacherId, setTeacherId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [semester, setSemester] = useState<string>(semesters[0]);
  const [students, setStudents] = useState<Student[]>([]);
  const [marks, setMarks] = useState<Record<string, Record<string, number>>>({});
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [columns, setColumns] = useState<MarkColumn[]>([]);
  const [resolvedScope, setResolvedScope] = useState<'class' | 'grade' | 'global' | 'defaults' | ''>('');
  const [view, setView] = useState<'marks' | 'collective'>(initialView);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [marksRefreshKey, setMarksRefreshKey] = useState(0);
  const [teacherCanEdit, setTeacherCanEdit] = useState(true);
  const [submissionDeadline, setSubmissionDeadline] = useState<string | null>(null);
  const [showAbsentStudents, setShowAbsentStudents] = useState(false);
  const [tableLastEditedBy, setTableLastEditedBy] = useState<string | null>(null);
  const [tableLastEditedAt, setTableLastEditedAt] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    if (status !== 'authenticated') return;
    if ((adminMode && !['ADMIN', 'CUSTOM_ADMIN'].includes(session?.user.role ?? '')) || (!adminMode && session?.user.role !== 'TEACHER')) { router.replace('/'); return; }
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

  useEffect(() => {
    if (adminMode || status !== 'authenticated') return;
    let live = true;
    void fetch('/api/admin/mark-submission-policy', { cache: 'no-store' }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      if (live) { setTeacherCanEdit(data.canEdit !== false); setSubmissionDeadline(data.policy?.deadlineAt ?? null); }
    }).catch((error) => { if (live) toast.error(error instanceof Error ? error.message : 'Could not check the mark submission deadline.'); });
    return () => { live = false; };
  }, [adminMode, status]);

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
      setTableLastEditedBy(data.lastEditedBy ?? null);
      setTableLastEditedAt(data.lastEditedAt ?? null);
      setResolvedScope(data.resolvedScope ?? 'defaults');
      setStudents(list);
      setMarks(Object.fromEntries(list.map((student) => [student.id, Object.fromEntries((data.columns ?? []).map((column: MarkColumn) => [column.field, Number(student.mark?.[column.field] ?? 0)]))])));
    }).catch((error) => { if (error.name !== 'AbortError') toast.error(error instanceof Error ? error.message : (rtl ? 'تعذر تحميل درجات الطلاب.' : 'Could not load student marks.')); })
      .finally(() => { if (!controller.signal.aborted) setLoadingStudents(false); });
    return () => controller.abort();
  }, [teacherId, classId, subjectId, academicYear, semester, adminMode, rtl, marksRefreshKey]);

  function changeMark(studentId: string, field: string, value: string) {
    const parsed = value === '' ? 0 : Number(value);
    setMarks((current) => ({ ...current, [studentId]: { ...current[studentId], [field]: value === '' || !Number.isFinite(parsed) || parsed <= 0 ? 0 : Math.min(maxima[field] ?? 0, parsed) } }));
  }
  function fillOrReset(field: string, fill: boolean) {
    const value = fill ? (maxima[field] ?? 0) : 0;
    setMarks((current) => Object.fromEntries(Object.entries(current).map(([studentId, values]) => [studentId, { ...values, [field]: value }])));
  }
  function totalFor(studentId: string) { return columns.reduce((total, column) => total + (marks[studentId]?.[column.field] ?? 0), 0); }
  const absentStudents = students.filter((student) => student.finalExamAbsent === true);
  function printReport() {
    const hasAbsences = view === 'marks'
      ? absentStudents.length > 0
      : Boolean(summary?.students.some((student) => Object.values(student.absentFinalExams ?? {}).some(Boolean)));
    if (hasAbsences) {
      const absentCount = view === 'marks' ? absentStudents.length : summary?.students.reduce((count, student) => count + Object.values(student.absentFinalExams ?? {}).filter(Boolean).length, 0) ?? 0;
      toast((toastItem: Toast) => <div className="flex items-center gap-3" dir={rtl ? 'rtl' : 'ltr'}>
        <span className="flex-1">{rtl ? `يوجد ${absentCount} طالب غائب. هل تريد الطباعة على أي حال؟` : `${absentCount} student${absentCount === 1 ? ' is' : 's are'} marked absent. Print anyway?`}</span>
        <button type="button" onClick={() => { toast.dismiss(toastItem.id); window.print(); }} className="shrink-0 rounded-lg bg-[#18181b] px-3 py-2 text-xs font-bold text-white">{rtl ? 'اطبع رغم ذلك' : 'Print anyway'}</button>
      </div>, { duration: 8000, style: { maxWidth: 'min(560px, calc(100vw - 32px))' } });
      return;
    }
    window.print();
  }
  function toggleFinalExamAbsence(studentId: string) {
    const student = students.find((item) => item.id === studentId);
    if (student && !student.finalExamAbsent) setMarks((current) => ({ ...current, [studentId]: { ...current[studentId], finalExam: 0 } }));
    setStudents((current) => current.map((item) => item.id !== studentId ? item : { ...item, finalExamAbsent: !item.finalExamAbsent }));
  }
  async function save() {
    setSaving(true);
    try {
      const response = await fetch('/api/student-marks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacherId, classId, subjectId, academicYear, semester, students: students.map((student) => ({ studentId: student.id, finalExamAbsent: student.finalExamAbsent === true, values: Object.fromEntries(columns.map((column) => [column.field, column.readOnly ? null : (marks[student.id]?.[column.field] || null)])) })) }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setTableLastEditedBy(session?.user?.name ?? null);
      setTableLastEditedAt(new Date().toISOString());
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
    {(loadingOptions || loadingStudents || loadingSummary || saving) && <ControlLoader message={rtl ? 'يرجى الانتظار، جارٍ معالجة طلبك…' : 'Please wait, we are processing your request…'} />}
    <div className="mb-7"><p className="text-xs font-black uppercase tracking-[0.16em] text-[#e16262]">{adminMode ? (rtl ? 'إدارة الدرجات' : 'Marks management') : (rtl ? 'مساحة المعلم' : 'Teacher workspace')}</p><h1 className="mt-2 text-3xl font-black text-slate-900">{title}</h1><p className="mt-2 text-slate-500">{rtl ? 'أدخل درجات الطلاب واحفظها حسب المادة والفصل الدراسي والسنة.' : 'Enter and save student marks by subject, semester, and academic year.'}</p></div>
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {adminMode && <label className="block text-sm font-semibold text-slate-700">{teacherLabel}<select className={`${control} mt-2`} value={teacherId} onChange={(event) => { setTeacherId(event.target.value); setClassId(''); setSubjectId(''); }}><option value="">{rtl ? 'اختر المعلم' : 'Choose teacher'}</option>{teachers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        <label className="block text-sm font-semibold text-slate-700">{classLabel}<select className={`${control} mt-2`} value={classId} onChange={(event) => setClassId(event.target.value)}><option value="">{rtl ? 'اختر الفصل' : 'Choose class'}</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="block text-sm font-semibold text-slate-700">{subjectLabel}<select className={`${control} mt-2`} value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">{rtl ? 'اختر المادة' : 'Choose subject'}</option>{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="block text-sm font-semibold text-slate-700">{yearLabel}<select className={`${control} mt-2`} value={academicYear} onChange={(event) => setAcademicYear(event.target.value)}>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
        <label className="block text-sm font-semibold text-slate-700">{termLabel}<select className={`${control} mt-2`} value={semester} onChange={(event) => setSemester(event.target.value)}>{semesters.map((item) => <option key={item} value={item}>{rtl ? ({ '1st Semester': 'الفصل الدراسي الأول', '2nd Semester': 'الفصل الدراسي الثاني' } as Record<string, string>)[item] : item}</option>)}</select></label>
      </div>
      {!loadingOptions && (adminMode ? teachers.length === 0 : subjects.length === 0 || classes.length === 0) && <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">{rtl ? 'لا توجد فصول أو مواد مسندة لهذا الحساب.' : 'No classes or subjects are assigned to this account.'}</p>}
    </section>
    {!adminMode && !teacherCanEdit && <p role="status" className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-900">{rtl ? `انتهى موعد إدخال الدرجات${submissionDeadline ? ` في ${new Date(submissionDeadline).toLocaleString()}` : ''}. يمكنك عرض الدرجات فقط.` : `The mark submission deadline has passed${submissionDeadline ? ` (${new Date(submissionDeadline).toLocaleString()})` : ''}. You can view marks but cannot edit them.`}</p>}
    {!adminMode && teacherCanEdit && submissionDeadline && <MarkDeadlineCountdown deadline={submissionDeadline} rtl={rtl} />}
    <div className="mb-4 flex flex-wrap gap-2 print:hidden">
      <button type="button" onClick={() => setView('marks')} className={`rounded-xl px-4 py-2 text-sm font-bold ${view === 'marks' ? 'bg-[#18181b] text-white' : 'border border-slate-200 bg-white text-slate-700'}`}>{rtl ? 'إدخال الدرجات' : 'Enter marks'}</button>
      <button type="button" disabled={!classId || loadingSummary} onClick={() => void loadCollectiveMarks()} className={`rounded-xl px-4 py-2 text-sm font-bold ${view === 'collective' ? 'bg-[#18181b] text-white' : 'border border-slate-200 bg-white text-slate-700'} disabled:opacity-50`}>{loadingSummary ? (rtl ? 'جارٍ تحميل الكشف…' : 'Loading overview…') : (rtl ? 'كشف الفصل لكل المواد' : 'Collective class marks')}</button>
      <button type="button" disabled={!classId || !subjectId || loadingStudents} onClick={() => setMarksRefreshKey((key) => key + 1)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">{rtl ? 'تحديث الجدول' : 'Refresh table'}</button>
    </div> {view === 'collective' ? <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6"><div><h2 className="text-lg font-bold text-slate-900">{rtl ? 'كشف درجات الفصل لجميع المواد' : 'Collective class marks across subjects'}</h2><p className="mt-1 text-sm text-slate-500">{summary ? `${summary.className} · ${academicYear} · ${semester}` : (rtl ? 'اختر الفصل الدراسي لعرض كشف جميع المواد.' : 'Load the selected class and semester to view the subject totals.')}</p></div><div className="flex gap-2 print:hidden"><button type="button" disabled={!classId || loadingSummary} onClick={() => void loadCollectiveMarks()} className="rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">{rtl ? 'تحديث' : 'Refresh'}</button>{summary && <button type="button" onClick={printReport} className="rounded-xl bg-[#18181b] px-4 py-2 text-sm font-bold text-white">{rtl ? 'طباعة الكشف' : 'Print overview'}</button>}</div></div>
      {loadingSummary ? <p className="px-5 py-12 text-center text-sm text-slate-500">{rtl ? 'جارٍ تحميل الكشف…' : 'Loading class overview…'}</p> : !summary ? <p className="px-5 py-12 text-center text-sm text-slate-500">{rtl ? 'اضغط كشف الفصل لعرض درجات جميع المواد.' : 'Choose “Collective class marks” to load every subject.'}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] border-collapse text-sm"><thead className="bg-[#18181b] text-white"><tr><th className="px-3 py-3 text-center">{rtl ? 'م' : '#'}</th><th className="px-4 py-3 text-start">{rtl ? 'اسم الطالب' : 'Student'}</th>{summary.subjects.map((subject) => <th key={subject.id} className="px-3 py-3 text-center">{subject.name}<span className="mt-1 block text-xs text-zinc-300">{rtl ? 'الدرجة / القصوى' : 'Score / max'}</span></th>)}<th className="px-3 py-3 text-center">{rtl ? 'المجموع' : 'Grand total'}</th><th className="px-3 py-3 text-center print:hidden">{rtl ? 'الشهادة' : 'Certificate'}</th></tr></thead><tbody className="divide-y divide-slate-100">{summary.students.map((student, index) => { const total = summary.subjects.reduce((sum, subject) => sum + subjectTotal(student, subject), 0); const possible = summary.subjects.reduce((sum, subject) => sum + subject.columns.reduce((columnSum, column) => columnSum + column.max, 0), 0); return <tr key={student.id} className="even:bg-slate-50"><td className="px-3 py-3 text-center text-slate-500">{index + 1}</td><td className="px-4 py-3 font-semibold text-slate-900">{student.name}</td>{summary.subjects.map((subject) => { const score = subjectTotal(student, subject); const max = subject.columns.reduce((sum, column) => sum + column.max, 0); return <td key={subject.id} className={`px-3 py-3 text-center font-semibold ${markColor(score, max)}`}>{score} / {max}<span className="ms-1 text-xs text-slate-700">{gradeFor(max ? score / max * 100 : 0)}</span></td>; })}<td className={`px-3 py-3 text-center font-black ${markColor(total, possible)}`}>{total} / {possible}</td><td className="px-3 py-3 text-center print:hidden"><a href={certificateUrl(student.id)} target="_blank" rel="noreferrer" className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-[#e16262]">{rtl ? 'عرض / طباعة' : 'View / print'}</a></td></tr>; })}{summary.students.length === 0 && <tr><td colSpan={summary.subjects.length + 4} className="px-4 py-10 text-center text-slate-500">{rtl ? 'لا يوجد طلاب في هذا الفصل.' : 'There are no students in this class.'}</td></tr>}</tbody></table></div>}
    </section> : <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6"><div><h2 className="text-lg font-bold text-slate-900">{classes.find((item) => item.id === classId)?.name ?? (rtl ? 'قائمة الطلاب' : 'Class roster')}</h2><p className="mt-1 text-sm text-slate-500">{selectedSubject?.name ?? (rtl ? 'اختر المادة والفصل لعرض الطلاب' : 'Choose a class and subject to view students')}</p></div>{students.length > 0 && <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setShowAbsentStudents((value) => !value)} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700">{rtl ? `الطلاب الغائبون (${absentStudents.length})` : `Absent students (${absentStudents.length})`}</button><button type="button" onClick={printReport} className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 print:hidden">{rtl ? 'طباعة التقرير' : 'Print report'}</button><button type="button" disabled={saving || !adminMode && !teacherCanEdit} onClick={() => void save()} className="rounded-xl bg-[#18181b] px-4 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50">{saving ? (rtl ? 'جارٍ الحفظ…' : 'Saving…') : (rtl ? 'حفظ الدرجات' : 'Save marks')}</button></div>}</div>
      {showAbsentStudents && <div className="border-b border-slate-100 bg-amber-50/70 px-5 py-3 text-sm"><strong className="text-slate-900">{rtl ? 'الغائبون عن الاختبار النهائي:' : 'Absent from the final exam:'}</strong>{absentStudents.length ? <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-slate-700">{absentStudents.map((student) => <li key={student.id}>{student.name}</li>)}</ul> : <p className="mt-1 text-slate-600">{rtl ? 'لا يوجد طلاب غائبون.' : 'No students are marked absent.'}</p>}</div>}
      {students.length > 0 && <p className="border-b border-slate-100 bg-slate-50 px-5 py-2 text-xs text-slate-600">{rtl ? `مصدر إعداد الجدول: ${resolvedScope === 'class' ? 'إعداد هذا الفصل' : resolvedScope === 'grade' ? 'إعداد هذا الصف' : resolvedScope === 'global' ? 'الإعداد العام للمادة' : 'الإعدادات الافتراضية'}` : `Table settings source: ${resolvedScope === 'class' ? 'this class' : resolvedScope === 'grade' ? 'this grade' : resolvedScope === 'global' ? 'subject-wide settings' : 'built-in defaults'}`}</p>}
      {students.length > 0 && <div className="flex flex-wrap gap-3 border-b border-slate-100 px-5 py-2 text-xs font-semibold text-slate-700"><span className="rounded-md bg-green-100 px-2 py-1">{rtl ? '٩٠–١٠٠٪ ممتاز' : '90–100%'}</span><span className="rounded-md bg-pink-100 px-2 py-1">{rtl ? '٨٠–أقل من ٩٠٪' : '80–<90%'}</span><span className="rounded-md bg-yellow-100 px-2 py-1">{rtl ? '٧٠–أقل من ٨٠٪' : '70–<80%'}</span><span className="rounded-md bg-red-100 px-2 py-1">{rtl ? 'أقل من ٧٠٪' : '<70%'}</span></div>}
      {loadingStudents ? <div className="px-5 py-12 text-center text-sm text-slate-500">{rtl ? 'جارٍ تحميل درجات الطلاب…' : 'Loading student marks…'}</div> : students.length === 0 ? <div className="px-5 py-12 text-center text-sm text-slate-500">{rtl ? 'اختر الفصل والمادة لعرض الطلاب.' : 'Choose a class and subject to load students.'}</div> : <div className="overflow-x-auto"><table className="w-full min-w-[900px] border-collapse text-sm"><caption className="caption-top border-b border-slate-200 bg-slate-50 px-4 py-2 text-start text-xs font-semibold text-slate-600">{rtl ? 'آخر تعديل بواسطة: ' : 'Last edited by: '}{tableLastEditedBy || '—'}{tableLastEditedAt && <span className="ms-2 font-medium text-slate-500">· {new Date(tableLastEditedAt).toLocaleString(rtl ? 'ar-SA' : undefined)}</span>}</caption><thead className="bg-[#18181b] text-white"><tr><th className="px-3 py-3 text-center">{rtl ? 'م' : '#'}</th><th className="min-w-48 px-4 py-3 text-start">{rtl ? 'اسم الطالب' : 'Student'}</th>{columns.map((column) => <th key={column.field} className="min-w-32 px-2 py-3 text-center"><span className="block">{rtl ? column.labelAr : column.label}</span><span className="mt-0.5 block text-xs text-zinc-300">({column.max})</span><span className="mt-2 flex justify-center gap-1">{column.readOnly ? <span className="rounded bg-white/15 px-2 py-1 text-[11px]">{rtl ? 'متوسط الاختبارين' : 'Average of both quizzes'}</span> : <><button type="button" disabled={!adminMode && !teacherCanEdit} onClick={() => fillOrReset(column.field, true)} className="rounded bg-white/15 px-2 py-1 text-[11px] font-bold hover:bg-white/25 disabled:opacity-40">{rtl ? 'تعبئة' : 'Fill'}</button><button type="button" disabled={!adminMode && !teacherCanEdit} onClick={() => fillOrReset(column.field, false)} className="rounded bg-white/15 px-2 py-1 text-[11px] font-bold hover:bg-white/25 disabled:opacity-40">{rtl ? 'مسح' : 'Clear'}</button></>}</span></th>)}<th className="px-3 py-3 text-center">{rtl ? 'المجموع' : 'Total'}</th></tr></thead><tbody className="divide-y divide-slate-100">{students.map((student, index) => <tr key={student.id} className="even:bg-slate-50"><td className="px-3 py-3 text-center text-slate-500">{index + 1}</td><td className="px-4 py-3 font-semibold text-slate-900"><a href={certificateUrl(student.id)} target="_blank" rel="noreferrer" className="hover:text-[#e16262] hover:underline">{student.name}</a></td>{columns.map((column) => { const field = column.field; const value = marks[student.id]?.[field] ?? 0; const max = column.max; const absent = field === 'finalExam' && student.finalExamAbsent; const percent = max > 0 ? value / max * 100 : 0; const scoreColor = value <= 0 ? 'border-slate-200 bg-white text-slate-800' : percent >= 90 ? 'border-green-300 bg-green-100 text-green-950' : percent >= 80 ? 'border-pink-300 bg-pink-100 text-pink-950' : percent >= 70 ? 'border-yellow-300 bg-yellow-100 text-yellow-950' : 'border-red-300 bg-red-100 text-red-950'; return <td key={field} className="p-2"><input aria-label={`${student.name} ${rtl ? column.labelAr : column.label}`} type="number" min={1} max={max} value={absent ? '' : value || ''} placeholder={absent ? (rtl ? 'غائب' : 'Absent') : ''} disabled={Boolean(column.readOnly || absent || !adminMode && !teacherCanEdit)} onChange={(event) => changeMark(student.id, field, event.target.value)} className={`w-full rounded-lg border px-2 py-2 text-center font-semibold outline-none focus:ring-2 focus:ring-[#f3b3b3] disabled:cursor-not-allowed disabled:bg-slate-100 ${scoreColor}`} />{field === 'finalExam' && <label className="mt-1 flex items-center justify-center gap-1 text-[11px] font-semibold text-slate-600"><input type="checkbox" checked={student.finalExamAbsent === true} disabled={!adminMode && !teacherCanEdit} onChange={() => toggleFinalExamAbsence(student.id)} className="h-3.5 w-3.5 accent-[#e16262]" />{rtl ? 'غائب' : 'Absent'}</label>}</td>; })}<td className={`px-3 py-3 text-center font-black ${markColor(totalFor(student.id), columns.reduce((sum, column) => sum + column.max, 0))}`}>{totalFor(student.id)}</td></tr>)}</tbody></table></div>}
      {students.length > 0 && <div className="flex justify-end border-t border-slate-100 p-4"><button type="button" disabled={saving || !adminMode && !teacherCanEdit} onClick={() => void save()} className="rounded-xl bg-[#18181b] px-5 py-2.5 text-sm font-bold text-white shadow-sm disabled:opacity-50">{saving ? (rtl ? 'جارٍ الحفظ…' : 'Saving…') : (rtl ? 'حفظ الدرجات' : 'Save marks')}</button></div>}
    </section>}
    {view === 'marks' && students.length > 0 && selectedSubject && <section id="admin-student-marks-print" className="hidden" dir={rtl ? 'rtl' : 'ltr'}>
      <header className="marks-print-heading"><div><p>{rtl ? 'تقرير درجات الطلاب' : 'Student marks report'}</p><h1>{classes.find((item) => item.id === classId)?.name ?? ''}</h1></div><div className="marks-print-meta"><span>{rtl ? 'المادة' : 'Subject'}: <strong>{selectedSubject.name}</strong></span><span>{rtl ? 'المعلم' : 'Teacher'}: <strong>{selectedTeacher?.name ?? ''}</strong></span><span>{academicYear} · {rtl ? ({ '1st Semester': 'الفصل الدراسي الأول', '2nd Semester': 'الفصل الدراسي الثاني' } as Record<string, string>)[semester] : semester}</span></div></header>
      <table><colgroup><col className="marks-print-number-col"/><col className="marks-print-student-col"/>{columns.map((column) => <col key={column.field}/>)}<col/></colgroup><thead><tr><th>{rtl ? 'م' : '#'}</th><th>{rtl ? 'اسم الطالب' : 'Student'}</th>{columns.map((column) => <th key={column.field}>{rtl ? column.labelAr : column.label}<small> / {column.max}</small></th>)}<th>{rtl ? 'المجموع' : 'Total'}</th></tr></thead><tbody>{students.map((student, index) => <tr key={student.id}><td>{index + 1}</td><td>{student.name}</td>{columns.map((column) => { const value = marks[student.id]?.[column.field] ?? 0; const percent = column.max ? value / column.max * 100 : 0; const scoreColor = value <= 0 ? '' : percent >= 90 ? 'bg-green-100' : percent >= 80 ? 'bg-pink-100' : percent >= 70 ? 'bg-yellow-100' : 'bg-red-100'; return <td key={column.field} className={scoreColor}>{column.field === 'finalExam' && student.finalExamAbsent ? (rtl ? 'غائب' : 'Absent') : value || '—'}</td>; })}<td className="marks-print-total-cell">{totalFor(student.id)}</td></tr>)}</tbody></table>
      <footer className="marks-print-signature"><span>{rtl ? 'توقيع المعلم' : 'Teacher signature'}</span><i /></footer>
    </section>}
    {view === 'collective' && summary && <section id="admin-student-marks-print" className="hidden" dir={rtl ? 'rtl' : 'ltr'}>
      <header className="marks-print-heading"><div><p>{rtl ? 'تقرير درجات الطلاب' : 'Student marks report'}</p><h1>{summary.className}</h1></div><div className="marks-print-meta"><span>{rtl ? 'المواد' : 'Subjects'}: <strong>{rtl ? 'جميع المواد' : 'All subjects'}</strong></span><span>{rtl ? 'المعلم' : 'Teacher'}: <strong>{selectedTeacher?.name ?? ''}</strong></span><span>{academicYear} · {rtl ? ({ '1st Semester': 'الفصل الدراسي الأول', '2nd Semester': 'الفصل الدراسي الثاني' } as Record<string, string>)[semester] : semester}</span></div></header>
      <table><thead><tr><th>{rtl ? 'م' : '#'}</th><th>{rtl ? 'اسم الطالب' : 'Student'}</th>{summary.subjects.map((subject) => <th key={subject.id}>{subject.name}<small> / {subject.columns.reduce((sum, column) => sum + column.max, 0)}</small></th>)}<th>{rtl ? 'المجموع الكلي' : 'Grand total'}</th></tr></thead><tbody>{summary.students.map((student, index) => { const possible = summary.subjects.reduce((sum, subject) => sum + subject.columns.reduce((columnSum, column) => columnSum + column.max, 0), 0); const total = summary.subjects.reduce((sum, subject) => sum + subjectTotal(student, subject), 0); return <tr key={student.id}><td>{index + 1}</td><td>{student.name}</td>{summary.subjects.map((subject) => <td key={subject.id} className={markColor(subjectTotal(student, subject), subject.columns.reduce((sum, column) => sum + column.max, 0))}>{subjectTotal(student, subject)} / {subject.columns.reduce((sum, column) => sum + column.max, 0)}</td>)}<td className={markColor(total, possible)}>{total} / {possible}</td></tr>; })}</tbody></table>
      <footer className="marks-print-signature"><span>{rtl ? 'توقيع المعلم' : 'Teacher signature'}</span><i /></footer>
    </section>}
  </main>;
}



