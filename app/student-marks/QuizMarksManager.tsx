'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { toast } from 'react-hot-toast';

type Item = { id: string; name: string };
type Teacher = Item & { classes: Item[]; subjects: Item[] };
type Student = Item & { firstQuiz: number; secondQuiz: number };
type Props = { mode: 'admin' | 'teacher' };
const years = ['2024-2025', '2025-2026', '2026-2027'];
const semesters = ['1st Semester', '2nd Semester'];
const control = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-medium text-slate-800 shadow-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-100';

export default function QuizMarksManager({ mode }: Props) {
  const admin = mode === 'admin';
  const rtl = useLocale() === 'ar';
  const { data, status } = useSession();
  const router = useRouter();
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Item[]>([]);
  const [teacherId, setTeacherId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [semester, setSemester] = useState(semesters[0]);
  const [students, setStudents] = useState<Student[]>([]);
  const [limits, setLimits] = useState({ firstMax: 10, secondMax: 10 });
  const [entryLimits, setEntryLimits] = useState({ firstMax: 10, secondMax: 10 });
  const [configSubjectId, setConfigSubjectId] = useState('');
  const [subjectDropdownOpen, setSubjectDropdownOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadedQueryKey, setLoadedQueryKey] = useState('');
  const selectedTeacher = teachers.find((teacher) => teacher.id === teacherId);
  const classes = selectedTeacher?.classes ?? [];
  const teacherSubjects = selectedTeacher?.subjects ?? [];
  const configSubject = subjects.find((subject) => subject.id === configSubjectId);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    if (status !== 'authenticated') return;
    if ((admin && data?.user?.role !== 'ADMIN') || (!admin && data?.user?.role !== 'TEACHER')) { router.replace('/'); return; }
    let live = true;
    void (async () => {
      try {
        if (!admin) {
          const sectionResponse = await fetch('/api/admin/teacher-sections', { cache: 'no-store' });
          const sectionData = await sectionResponse.json();
          if (sectionResponse.ok && sectionData.sections?.quizMarks === false) { router.replace('/teacher'); return; }
          const response = await fetch('/api/student-marks/options', { cache: 'no-store' });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error);
          if (live && result.teacher) { setTeachers([result.teacher]); setTeacherId(result.teacher.id); if (result.teacher.subjects.length === 1) setSubjectId(result.teacher.subjects[0].id); }
        } else {
          // Use the existing admin academic catalog as the source of subjects. This
          // keeps subject management independent from quiz scheme records.
          const response = await fetch('/api/admin/academic-management', { cache: 'no-store' });
          const result = await response.json();
          if (!response.ok) throw new Error(result.error);
          if (live) {
            const adminTeachers = (result.teachers ?? []).map((teacher: { id: string; name: string; classes?: Item[]; classTeacherAssignments?: { class: Item }[]; subjects?: Item[]; subjectTeacherAssignments?: { subject: Item }[] }) => ({
              id: teacher.id, name: teacher.name,
              classes: [...new Map([...(teacher.classes ?? []), ...(teacher.classTeacherAssignments ?? []).map(({ class: item }) => item)].map((item) => [item.id, item])).values()],
              subjects: [...new Map([...(teacher.subjects ?? []), ...(teacher.subjectTeacherAssignments ?? []).map(({ subject }) => subject)].map((item) => [item.id, item])).values()],
            }));
            setTeachers(adminTeachers); setSubjects(result.subjects ?? []);
            if (adminTeachers[0]) setTeacherId(adminTeachers[0].id);
            if (result.subjects?.[0]) setConfigSubjectId(result.subjects[0].id);
          }
        }
      } catch (error) { if (live) toast.error(error instanceof Error ? error.message : 'Could not load quiz marks.'); }
      finally { if (live) setLoading(false); }
    })();
    return () => { live = false; };
  }, [status, data?.user?.role, admin, router]);

  useEffect(() => {
    if (!admin || !configSubjectId) return;
    let live = true;
    void fetch(`/api/quiz-marks/scheme?subjectId=${encodeURIComponent(configSubjectId)}`, { cache: 'no-store' }).then(async (response) => {
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      if (live) setLimits(result.scheme ? { firstMax: result.scheme.firstMax, secondMax: result.scheme.secondMax } : { firstMax: 10, secondMax: 10 });
    }).catch((error) => { if (live) toast.error(error instanceof Error ? error.message : 'Could not load this subject’s quiz limits.'); });
    return () => { live = false; };
  }, [admin, configSubjectId]);

  useEffect(() => {
    setStudents([]);
    setLoadedQueryKey('');
    if (!teacherId || !classId || !subjectId) { setLoadingStudents(false); return; }
    const controller = new AbortController();
    const queryKey = JSON.stringify([teacherId, classId, subjectId, academicYear, semester]);
    setLoadingStudents(true);
    const query = new URLSearchParams({ teacherId, classId, subjectId, academicYear, semester });
    void fetch(`/api/quiz-marks?${query}`, { cache: 'no-store', signal: controller.signal }).then(async (response) => {
      const result = await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(result.error);
      setStudents(result.students ?? []);
      setEntryLimits(result.scheme ?? { firstMax: 10, secondMax: 10 });
      if (!admin) setLimits(result.scheme ?? { firstMax: 10, secondMax: 10 });
      setLoadedQueryKey(queryKey);
    }).catch((error) => { if (error.name !== 'AbortError') toast.error(error instanceof Error ? error.message : 'Could not load quiz marks.'); })
      .finally(() => { if (!controller.signal.aborted) setLoadingStudents(false); });
    return () => controller.abort();
  }, [teacherId, classId, subjectId, academicYear, semester, admin]);

  function update(studentId: string, field: 'firstQuiz' | 'secondQuiz', raw: string) {
    const maximum = field === 'firstQuiz' ? entryLimits.firstMax : entryLimits.secondMax;
    const value = raw === '' ? 0 : Number(raw);
    setStudents((current) => current.map((student) => student.id === studentId ? { ...student, [field]: Math.min(maximum, Math.max(0, Number.isFinite(value) ? value : 0)) } : student));
  }
  function fillOrReset(field: 'firstQuiz' | 'secondQuiz', fill: boolean) {
    const maximum = field === 'firstQuiz' ? entryLimits.firstMax : entryLimits.secondMax;
    setStudents((current) => current.map((student) => ({ ...student, [field]: fill ? maximum : 0 })));
  }
  async function saveMarks() {
    const activeQueryKey = JSON.stringify([teacherId, classId, subjectId, academicYear, semester]);
    if (!classId || !subjectId || !teacherId || loadedQueryKey !== activeQueryKey || loadingStudents) return;
    setSaving(true);
    try {
      const response = await fetch('/api/quiz-marks', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ teacherId, classId, subjectId, academicYear, semester, students: students.map(({ id, firstQuiz, secondQuiz }) => ({ studentId: id, firstQuiz, secondQuiz })) }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      toast.success(rtl ? `تم حفظ درجات ${result.saved} طالباً.` : `Quiz marks saved for ${result.saved} students.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save quiz marks.'); }
    finally { setSaving(false); }
  }
  async function saveLimits() {
    if (!configSubjectId) return;
    setSaving(true);
    try {
      const response = await fetch('/api/quiz-marks/scheme', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subjectId: configSubjectId, ...limits }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      toast.success(rtl ? 'تم حفظ حدود الاختبارات.' : 'Quiz maximum marks saved.');
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save quiz limits.'); }
    finally { setSaving(false); }
  }

  return <main dir={rtl ? 'rtl' : 'ltr'} className="mx-auto w-full max-w-[1300px] px-4 py-8 sm:px-7 xl:px-10">
    <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-800">{admin ? (rtl ? 'إدارة درجات الاختبارات' : 'Quiz marks administration') : (rtl ? 'مساحة المعلم' : 'Teacher workspace')}</p>
    <h1 className="mt-2 text-3xl font-black text-slate-900">{rtl ? 'درجات الاختبارات القصيرة' : 'Quiz Marks'}</h1>
    <p className="mt-2 text-slate-500">{rtl ? 'أدخل درجة الاختبار الأول والثاني خلال الفصل الدراسي. ستظهر الدرجات تلقائياً في جدول درجات الفصل.' : 'Enter the first and second quiz scores during the semester. Saved scores flow into the semester marks table automatically.'}</p>
    {admin && <section className="mt-6 rounded-2xl border border-emerald-100 bg-emerald-50/40 p-5 shadow-sm sm:p-6">
      <h2 className="text-lg font-black text-slate-900">{rtl ? 'الدرجة القصوى حسب المادة' : 'Set quiz maximums by subject'}</h2>
      <p className="mt-1 text-sm text-slate-500">{rtl ? 'هذه الحدود مستقلة عن رؤوس وجدول درجات الفصل.' : 'These limits are separate from the semester marks table headers and settings.'}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-4 sm:items-end">
        <div className="relative text-sm font-semibold text-slate-700"><span>{rtl ? 'المادة' : 'Subject'}</span><button type="button" aria-haspopup="listbox" aria-expanded={subjectDropdownOpen} disabled={loading || subjects.length === 0} onClick={() => setSubjectDropdownOpen((open) => !open)} className={`${control} mt-2 flex items-center justify-between text-start disabled:cursor-not-allowed disabled:bg-slate-100`}><span>{loading ? (rtl ? 'جارٍ تحميل المواد…' : 'Loading subjects…') : configSubject?.name ?? (rtl ? 'اختر المادة' : subjects.length ? 'Choose a subject' : 'No subjects available')}</span><span aria-hidden className="ms-3 text-slate-400">{subjectDropdownOpen ? '▴' : '▾'}</span></button>{subjectDropdownOpen && <div role="listbox" aria-label={rtl ? 'المواد' : 'Subjects'} className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-xl">{subjects.map((item) => <button type="button" role="option" aria-selected={item.id === configSubjectId} key={item.id} onClick={() => { setConfigSubjectId(item.id); setSubjectDropdownOpen(false); }} className={`block w-full rounded-lg px-3 py-2 text-start text-sm font-medium ${item.id === configSubjectId ? 'bg-emerald-50 text-emerald-950' : 'text-slate-700 hover:bg-slate-50'}`}>{item.name}</button>)}</div>}{!loading && subjects.length === 0 && <span className="mt-1 block text-xs font-medium text-amber-800">{rtl ? 'لم يتم تحميل أي مواد.' : 'No subjects were returned for this account.'}</span>}</div>
        <label className="text-sm font-semibold text-slate-700">{rtl ? 'الاختبار الأول — الدرجة القصوى' : 'First quiz maximum'}<input type="number" min="1" max="10000" className={`${control} mt-2`} value={limits.firstMax} onChange={(event) => setLimits((current) => ({ ...current, firstMax: Number(event.target.value) }))} /></label>
        <label className="text-sm font-semibold text-slate-700">{rtl ? 'الاختبار الثاني — الدرجة القصوى' : 'Second quiz maximum'}<input type="number" min="1" max="10000" className={`${control} mt-2`} value={limits.secondMax} onChange={(event) => setLimits((current) => ({ ...current, secondMax: Number(event.target.value) }))} /></label>
        <button type="button" disabled={saving || !configSubject} onClick={() => void saveLimits()} className="rounded-xl bg-[#123b36] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{rtl ? 'حفظ الحدود' : 'Save maximums'}</button>
      </div>
    </section>}
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {admin && <label className="text-sm font-semibold text-slate-700">{rtl ? 'المعلم' : 'Teacher'}<select className={`${control} mt-2`} value={teacherId} onChange={(event) => { setTeacherId(event.target.value); setClassId(''); setSubjectId(''); }}><option value="">{rtl ? 'اختر المعلم' : 'Choose teacher'}</option>{teachers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        <label className="text-sm font-semibold text-slate-700">{rtl ? 'الفصل' : 'Class'}<select className={`${control} mt-2`} value={classId} onChange={(event) => setClassId(event.target.value)}><option value="">{rtl ? 'اختر الفصل' : 'Choose class'}</option>{classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">{rtl ? 'المادة' : 'Subject'}<select className={`${control} mt-2`} value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">{rtl ? 'اختر المادة' : 'Choose subject'}</option>{teacherSubjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">{rtl ? 'السنة الدراسية' : 'Academic year'}<select className={`${control} mt-2`} value={academicYear} onChange={(event) => setAcademicYear(event.target.value)}>{years.map((year) => <option key={year}>{year}</option>)}</select></label>
        <label className="text-sm font-semibold text-slate-700">{rtl ? 'الفصل الدراسي' : 'Semester'}<select className={`${control} mt-2`} value={semester} onChange={(event) => setSemester(event.target.value)}>{semesters.map((term, index) => <option key={term} value={term}>{rtl ? ['الفصل الدراسي الأول', 'الفصل الدراسي الثاني'][index] : term}</option>)}</select></label>
      </div>
    </section>
    <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4"><div><h2 className="text-lg font-bold text-slate-900">{classes.find((item) => item.id === classId)?.name ?? (rtl ? 'قائمة الطلاب' : 'Class roster')}</h2><p className="mt-1 text-sm text-slate-500">{teacherSubjects.find((item) => item.id === subjectId)?.name ?? (rtl ? 'اختر الفصل والمادة' : 'Choose a class and subject')}</p></div>{students.length > 0 && <button type="button" onClick={() => void saveMarks()} disabled={saving || loadingStudents || !classId || loadedQueryKey !== JSON.stringify([teacherId, classId, subjectId, academicYear, semester])} className="rounded-xl bg-[#123b36] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{saving ? (rtl ? 'جارٍ الحفظ…' : 'Saving…') : (rtl ? 'حفظ درجات الاختبارات' : 'Save quiz marks')}</button>}</div>
      {loading || loadingStudents ? <p className="px-5 py-12 text-center text-sm text-slate-500">{rtl ? 'جارٍ التحميل…' : 'Loading…'}</p> : students.length === 0 ? <p className="px-5 py-12 text-center text-sm text-slate-500">{rtl ? 'اختر الفصل والمادة لعرض الطلاب.' : 'Choose a class and subject to load students.'}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[650px] border-collapse text-sm"><thead className="bg-[#123b36] text-white"><tr><th className="px-3 py-3 text-center">{rtl ? 'م' : '#'}</th><th className="px-4 py-3 text-start">{rtl ? 'اسم الطالب' : 'Student'}</th>{(['firstQuiz', 'secondQuiz'] as const).map((field) => { const first = field === 'firstQuiz'; const maximum = first ? entryLimits.firstMax : entryLimits.secondMax; return <th key={field} className="px-3 py-3 text-center"><span className="block">{first ? (rtl ? 'الاختبار الأول' : 'First quiz') : (rtl ? 'الاختبار الثاني' : 'Second quiz')} ({maximum})</span><span className="mt-2 flex justify-center gap-1"><button type="button" onClick={() => fillOrReset(field, true)} className="rounded bg-white/15 px-2 py-1 text-[11px] font-bold hover:bg-white/25">{rtl ? 'تعبئة الأعلى' : 'Fill max'}</button><button type="button" onClick={() => fillOrReset(field, false)} className="rounded bg-white/15 px-2 py-1 text-[11px] font-bold hover:bg-white/25">{rtl ? 'تصفير' : 'Reset'}</button></span></th>; })}</tr></thead><tbody className="divide-y divide-slate-100">{students.map((student, index) => <tr key={student.id} className="even:bg-slate-50"><td className="px-3 py-3 text-center text-slate-500">{index + 1}</td><td className="px-4 py-3 font-semibold text-slate-900">{student.name}</td><td className="p-2"><input aria-label={`${student.name} ${rtl ? 'الاختبار الأول' : 'first quiz'}`} type="number" min="0" max={entryLimits.firstMax} value={student.firstQuiz} onChange={(event) => update(student.id, 'firstQuiz', event.target.value)} className="w-full rounded-lg border border-slate-200 px-2 py-2 text-center font-semibold" /></td><td className="p-2"><input aria-label={`${student.name} ${rtl ? 'الاختبار الثاني' : 'second quiz'}`} type="number" min="0" max={entryLimits.secondMax} value={student.secondQuiz} onChange={(event) => update(student.id, 'secondQuiz', event.target.value)} className="w-full rounded-lg border border-slate-200 px-2 py-2 text-center font-semibold" /></td></tr>)}</tbody></table></div>}
    </section>
  </main>;
}
