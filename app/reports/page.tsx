'use client';
import { FormEvent, Fragment, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { useLocale, useTranslations } from 'next-intl';
import { StudentReportModal, type ReportDraft } from './StudentReportModal';
import ReportSubjectOrder from './ReportSubjectOrder';
import { arabicReportStatus, arabicReportValue, arabicSubjectName, englishReportValue, isArabicTaughtSubject } from '@/lib/report-localization';

type Basic = { id: string; name: string; reportOrder?: number };
type Student = Basic;
type ClassOption = Basic & { students: Student[]; grade: (Basic & { subjects?: { subjectId: string; position: number }[] }) | null };
type Teacher = Basic & { classes: Basic[]; subjects: Basic[] };
type Report = { id: string; studentId: string; teacherId: string; subjectId: string; subjectPosition?: number; academicYear: string; semester: string; reportType: string; status: string; ixlPracticeStatus: string | null; quizScore: number | null; projectScore: number | null; recommendations: string[]; comment: string; updatedAt: string; student: Student & { class: Basic }; teacher: Basic & { signature: string | null }; subject: Basic & { reportOrder: number } };
const blankDraft: ReportDraft = { status: '', ixlPracticeStatus: '', recommendations: [], comment: '', quizScore: '', projectScore: '', signature: '' };
const control = 'mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm';
const label = 'block text-sm font-semibold text-slate-700';
const isIxlSubject = (name: string) => /\b(math|mathematics|english)\b/i.test(name);

function SubjectReportCard({ report, showIxl, locale }: { report: Report; showIxl: boolean; locale: string }) {
  const rtl = isArabicTaughtSubject(report.subject.name);
  return <section lang={rtl ? 'ar' : locale} dir={rtl ? 'rtl' : 'ltr'} className="report-subject-card break-inside-avoid overflow-hidden rounded-2xl border border-[#d8e4ed] bg-white p-4 shadow-[0_12px_32px_-28px_rgba(25,52,77,.5)] print:rounded-2xl print:p-3 print:shadow-none">
    <div className="flex items-start justify-between gap-2"><div><h4 className="text-lg font-black text-[#19344d] print:text-base">{rtl ? arabicSubjectName(report.subject.name) : report.subject.name}</h4><p className="mt-1 text-xs text-[#66829c]">{rtl ? 'المعلم' : 'Teacher'}: <strong className="font-bold text-[#294563]">{report.teacher.name}</strong><span className="ms-2">· {rtl ? 'التاريخ' : 'Date'}: <strong className="font-bold text-[#294563]">{new Date(report.updatedAt).toLocaleDateString('en-GB')}</strong></span></p></div><span className="shrink-0 rounded-full bg-[#0f766e] px-3 py-1.5 text-xs font-extrabold text-white">{rtl ? arabicReportStatus(report.status) : report.status}</span></div>
    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">{[[rtl ? 'درجة الاختبار القصير' : 'Quiz mark', report.quizScore], [rtl ? 'درجة المشروع' : 'Project mark', report.projectScore]].map(([name, score]) => <div key={String(name)} className="rounded-xl bg-[#f1f7fa] px-3 py-2 text-center"><span className="block text-[11px] font-bold text-[#66829c]">{name}</span><strong className="mt-0.5 block text-xl font-black text-[#19344d] print:text-lg">{score ?? '—'}{score !== null ? ' / 20' : ''}</strong></div>)}{showIxl && <p className="col-span-2 rounded-xl bg-[#f1f7fa] px-3 py-2"><span className="text-xs font-bold text-[#66829c]">{rtl ? 'تدريبات IXL' : 'IXL Practices'}:</span> <strong>{report.ixlPracticeStatus ? (rtl ? arabicReportValue(report.ixlPracticeStatus) : report.ixlPracticeStatus === 'Complete' ? 'Complete' : report.ixlPracticeStatus === 'Incomplete' ? 'Incomplete' : 'Missing') : '—'}</strong></p>}</div>
    {report.recommendations?.length > 0 && <div className="mt-3"><p className="mb-1.5 text-xs font-black uppercase tracking-wide text-[#66829c]">{rtl ? 'التوصيات' : 'Recommendations'}</p><ul className="list-disc space-y-1 ps-5 text-sm font-semibold leading-relaxed text-[#294563]">{report.recommendations.map((recommendation, index) => <li key={`${report.id}-${index}`}>{rtl ? arabicReportValue(recommendation) : englishReportValue(recommendation)}</li>)}</ul></div>}
    <p className="mt-3 whitespace-pre-wrap border-t border-[#d8e4ed] pt-2 text-sm font-semibold leading-relaxed text-[#294563]"><strong className="text-[#19344d]">{rtl ? 'ملاحظة المعلم' : 'Teacher note'}:</strong> {report.comment || '—'}</p><div className="mt-2 flex items-end gap-2 text-xs font-semibold text-[#66829c]"><span>{rtl ? 'توقيع المعلم' : 'Teacher signature'}:</span>{report.teacher.signature ? <img src={report.teacher.signature} alt={rtl ? 'توقيع المعلم' : 'Teacher signature'} className="h-10 w-32 object-contain object-left-bottom" /> : <span aria-hidden className="inline-block h-5 min-w-36 flex-1 border-b border-slate-400" />}</div>
  </section>;
}

export default function ReportsPage() {
  const t = useTranslations('reports');
  const locale = useLocale();
  const { data: session, status: sessionStatus } = useSession();
  const router = useRouter();
  const isAdmin = session?.user.role === 'ADMIN';
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [subjects, setSubjects] = useState<Basic[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [teacherSignature, setTeacherSignature] = useState('');
  const [teacherId, setTeacherId] = useState('');
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [semester, setSemester] = useState('1st Semester');
  const [reportType, setReportType] = useState('First Report');
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [studentIndex, setStudentIndex] = useState<number | null>(null);
  const [draft, setDraft] = useState<ReportDraft>(blankDraft);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [printStudentId, setPrintStudentId] = useState('');

  useEffect(() => {
    if (sessionStatus === 'unauthenticated') router.replace('/login');
    if (sessionStatus === 'authenticated' && !['ADMIN', 'TEACHER'].includes(session?.user.role ?? '')) router.replace('/');
    if (sessionStatus !== 'authenticated') return;
    let live = true;
    void fetch('/api/students', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error();
      const data = await response.json();
      if (!live) return;
      setClasses(data.classes ?? []); setTeachers(data.teachers ?? []); setSubjects(data.subjects ?? []);
      const defaultTeacher = data.teachers?.[0]?.id ?? '';
      const defaultSubject = data.subjects?.[0]?.id ?? '';
      setTeacherId(defaultTeacher); setSubjectId(defaultSubject);
      if (data.classes?.length) setClassId(data.classes[0].id);
    }).catch(() => toast.error(t('loadError')));
    return () => { live = false; };
  }, [sessionStatus, session, router]);

  const selectedTeacher = teachers.find((item) => item.id === teacherId);
  const visibleClasses = useMemo(() => [...classes].sort((a, b) => {
    const gradeA = Number((a.grade?.name ?? '').match(/\d+/)?.[0] ?? 0);
    const gradeB = Number((b.grade?.name ?? '').match(/\d+/)?.[0] ?? 0);
    return gradeA - gradeB || (a.grade?.name ?? '').localeCompare(b.grade?.name ?? '', undefined, { numeric: true }) || a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  }), [classes]);
  const selectedClass = visibleClasses.find((item) => item.id === classId);
  const classGradeNumber = (selectedClass?.grade?.name ?? selectedClass?.name ?? '').match(/\d+/)?.[0];
  const gradeAllowsIxl = !classGradeNumber || Number(classGradeNumber) < 7;
  const students = selectedClass?.students ?? [];
  const gradeSubjectPositions = new Map((selectedClass?.grade?.subjects ?? []).map((item) => [item.subjectId, item.position]));
  const visibleSubjects = [...(isAdmin ? (selectedTeacher?.subjects ?? []) : subjects)].sort((a, b) => (gradeSubjectPositions.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (gradeSubjectPositions.get(b.id) ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name));
  const selectedSubject = visibleSubjects.find((item) => item.id === subjectId);
  const showIxl = gradeAllowsIxl && Boolean(selectedSubject && isIxlSubject(selectedSubject.name));
  const arabicSubject = Boolean(selectedSubject && isArabicTaughtSubject(selectedSubject.name));
  const currentStudent = studentIndex === null ? null : students[studentIndex] ?? null;
  const currentReport = currentStudent ? reports.find((item) => item.studentId === currentStudent.id && item.subjectId === subjectId && item.academicYear === academicYear && item.semester === semester && item.reportType === reportType && (!isAdmin || item.teacherId === teacherId)) : undefined;

  async function loadReports() {
    if (!classId || (!isAdmin && !subjectId) || !academicYear.trim() || !semester) { setLoaded(false); setReports([]); return; }
    setLoading(true);
    try {
      const query = new URLSearchParams({ classId, academicYear: academicYear.trim(), semester, reportType });
      if (!isAdmin) query.set('subjectId', subjectId);
      else if (teacherId) query.set('teacherId', teacherId);
      const response = await fetch('/api/reports?' + query.toString(), { cache: 'no-store' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setReports(data.reports ?? []); setTeacherSignature(data.signature ?? ''); setLoaded(true);
    } catch (error) { toast.error(error instanceof Error ? error.message : t('reportsError')); setLoaded(false); }
    finally { setLoading(false); }
  }

  async function refreshReportSubjectOrder() {
    const response = await fetch('/api/students', { cache: 'no-store' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? t('loadError'));
    setClasses(data.classes ?? []);
    await loadReports();
  }

  useEffect(() => { setReports([]); setLoaded(false); setStudentIndex(null); }, [classId, subjectId, teacherId, semester, reportType, academicYear]);
  useEffect(() => { if (sessionStatus === 'authenticated' && classId && (isAdmin || subjectId) && academicYear.trim()) void loadReports(); }, [sessionStatus, classId, subjectId, semester, reportType, academicYear, isAdmin]);
  useEffect(() => {
    if (!printStudentId) return;
    const finish = () => setPrintStudentId('');
    window.addEventListener('afterprint', finish);
    const timer = window.setTimeout(() => window.print(), 80);
    return () => { window.clearTimeout(timer); window.removeEventListener('afterprint', finish); };
  }, [printStudentId]);

  function openStudent(index: number) {
    setStudentIndex(index);
    const student = students[index];
    const existing = reports.find((item) => item.studentId === student.id && item.subjectId === subjectId && item.academicYear === academicYear && item.semester === semester && item.reportType === reportType && (!isAdmin || item.teacherId === teacherId));
    setDraft(existing ? { status: existing.status, ixlPracticeStatus: existing.ixlPracticeStatus ?? '', recommendations: (existing.recommendations ?? []).map((value) => arabicSubject ? arabicReportValue(value) : value), comment: existing.comment ?? '', quizScore: existing.quizScore?.toString() ?? '', projectScore: existing.projectScore?.toString() ?? '', signature: existing.teacher.signature ?? teacherSignature } : { ...blankDraft, signature: teacherSignature });
  }

  function closeModal() { setStudentIndex(null); setDraft(blankDraft); }

  async function saveAndAdvance(event: FormEvent) {
    event.preventDefault();
    if (!currentStudent || !selectedClass || !subjectId || (isAdmin && !teacherId)) return;
    if (!draft.status) { toast.error(t('statusRequired')); return; }
    setSaving(true);
    try {
      const response = await fetch('/api/reports', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...draft, studentId: currentStudent.id, subjectId, teacherId, academicYear: academicYear.trim(), semester, reportType }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t('saveError'));
      setTeacherSignature(draft.signature);
      toast.success(t('savedStudent', { name: currentStudent.name }));
      await loadReports();
      if (studentIndex !== null && studentIndex + 1 < students.length) {
        const nextIndex = studentIndex + 1;
        const nextStudent = students[nextIndex];
        const existing = reports.find((item) => item.studentId === nextStudent.id && item.subjectId === subjectId && item.academicYear === academicYear && item.semester === semester && item.reportType === reportType && (!isAdmin || item.teacherId === teacherId));
        setStudentIndex(nextIndex);
        setDraft(existing ? { status: existing.status, ixlPracticeStatus: existing.ixlPracticeStatus ?? '', recommendations: (existing.recommendations ?? []).map((value) => arabicSubject ? arabicReportValue(value) : value), comment: existing.comment ?? '', quizScore: existing.quizScore?.toString() ?? '', projectScore: existing.projectScore?.toString() ?? '', signature: existing.teacher.signature || draft.signature || teacherSignature } : { ...blankDraft, signature: draft.signature || teacherSignature });
        toast(t('nextStudent', { name: nextStudent.name }), { icon: '➡️' });
      } else {
        closeModal();
        toast.success(t('allDone'));
      }
    } catch (error) { toast.error(error instanceof Error ? error.message : t('saveError')); }
    finally { setSaving(false); }
  }

  if (sessionStatus === 'loading') return <main className="grid min-h-[65vh] place-items-center"><span className="inline-flex items-center gap-3 text-sm font-medium text-slate-500"><span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-200 border-t-emerald-700" />{t('loading')}</span></main>;

  if (isAdmin) return <main className="w-full px-4 py-8 sm:px-7 xl:px-10">
    <div className="mb-7 print:hidden"><a href="/admin" className="text-sm font-semibold text-emerald-800">← {t('backAdmin')}</a><h1 className="mt-3 text-3xl font-black text-slate-900">{t('title')}</h1><p className="mt-2 text-slate-500">{t('adminFullReportsIntro')}</p></div>
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 print:hidden">
      <div className="grid gap-4 sm:grid-cols-4">
        <label className={label}>{t('class')}<select className={control} value={classId} onChange={(event) => setClassId(event.target.value)}><option value="">{t('chooseClass')}</option>{visibleClasses.map((item) => <option key={item.id} value={item.id}>{item.grade?.name ? `${item.grade.name} · ${item.name}` : item.name}</option>)}</select></label>
        <label className={label}>{t('year')}<input className={control} value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} placeholder="2026-2027" /></label>
        <label className={label}>{t('semester')}<select className={control} value={semester} onChange={(event) => setSemester(event.target.value)}>{[['1st Semester', t('firstSemester')], ['2nd Semester', t('secondSemester')]].map(([value, optionLabel]) => <option key={value} value={value}>{optionLabel}</option>)}</select></label>
        <label className={label}>{t('reportType')}<select className={control} value={reportType} onChange={(event) => setReportType(event.target.value)}><option value="First Report">{t('firstReport')}</option><option value="Second Report">{t('secondReport')}</option></select></label>
      </div>
      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><p className="text-sm text-slate-500">{selectedClass ? t('students', { count: students.length, semester: t(semester === '1st Semester' ? 'firstSemester' : 'secondSemester') }) : t('chooseClass')}</p><div className="flex gap-2"><button type="button" disabled={!classId || loading} onClick={() => void loadReports()} className="rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">{loading ? t('refreshing') : t('refresh')}</button><button type="button" disabled={!classId || loading || reports.length === 0} onClick={() => window.print()} className="rounded-xl bg-[#123b36] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{t('printFullReport')}</button></div></div>
    </section>
    <ReportSubjectOrder onOrderSaved={refreshReportSubjectOrder} />
    {!classId ? <p className="rounded-2xl border border-slate-200 bg-white px-5 py-12 text-center text-sm text-slate-500 print:hidden">{t('chooseClass')}</p> : loading && !loaded ? <p className="px-5 py-12 text-center text-sm text-slate-500 print:hidden">{t('loading')}</p> : <section id="student-reports-print" className="w-full space-y-6 rounded-2xl bg-white p-4 sm:p-7 xl:p-9 print:max-w-none print:space-y-0 print:p-0">
      {students.map((student, studentIndex) => {
        const studentReports = reports.filter((report) => report.studentId === student.id).sort((a, b) => (a.subjectPosition ?? gradeSubjectPositions.get(a.subjectId) ?? Number.MAX_SAFE_INTEGER) - (b.subjectPosition ?? gradeSubjectPositions.get(b.subjectId) ?? Number.MAX_SAFE_INTEGER) || a.subject.name.localeCompare(b.subject.name));
        const reportPages = Array.from({ length: Math.max(1, Math.ceil(studentReports.length / 4)) }, (_, index) => studentReports.slice(index * 4, index * 4 + 4));
        const gradeName = selectedClass?.grade?.name ?? selectedClass?.name.match(/\d+/)?.[0] ?? '—';
        const needsDuplexSpacer = printStudentId !== student.id && studentIndex < students.length - 1 && reportPages.length % 2 === 1;
        return <Fragment key={student.id}>{reportPages.map((pageReports, pageIndex) => <article key={`${student.id}-${pageIndex}`} data-student-id={student.id} data-single-print={printStudentId === student.id ? 'true' : undefined} data-last-student-page={pageIndex === reportPages.length - 1 ? 'true' : undefined} className="student-report-sheet rounded-2xl border border-slate-200 p-5 print:rounded-none print:border-2 print:border-slate-200 print:p-4">
          {pageIndex === 0 && <div className="no-print mb-2 flex justify-end print:hidden"><button type="button" onClick={() => setPrintStudentId(student.id)} className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 shadow-sm hover:border-emerald-700 hover:text-emerald-900">Print this report</button></div>}
          {pageIndex === 0 && <header className="student-report-header mb-5 overflow-hidden rounded-3xl border border-[#d4e1e8] bg-white shadow-sm print:mb-4 print:rounded-2xl print:shadow-none"><div className="h-2 bg-[#0f766e] print:h-1.5"/><div className="grid items-center gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(15rem,.82fr)_5rem] sm:p-5 print:grid-cols-[minmax(0,1fr)_minmax(12rem,.82fr)_4rem] print:gap-3 print:p-3"><div className="flex min-w-0 items-center gap-4"><img src="/school-emblem.png" alt="School emblem" className="h-16 w-16 shrink-0 rounded-xl bg-slate-50 object-contain p-1.5 print:h-12 print:w-12"/><div className="min-w-0"><p className="truncate text-xl font-black tracking-tight text-[#18334b] sm:text-2xl print:text-lg">AL FORQAN PRIVATE SCHOOL</p><p className="mt-1 text-sm font-extrabold tracking-wide text-[#0f766e] print:text-xs">AMERICAN DIVISION</p><p className="mt-1 text-xs font-bold uppercase tracking-[0.16em] text-[#66829c] print:text-[9px]">Student Progress Report</p></div></div><div className="grid grid-cols-[4.5rem_1fr] gap-x-3 gap-y-1 border-t border-slate-200 pt-3 text-sm leading-5 text-[#19344d] sm:border-s sm:border-t-0 sm:ps-5 sm:pt-0 print:text-xs"><strong className="text-[#66829c]">Student</strong><span className="font-extrabold">{student.name}</span><strong className="text-[#66829c]">Class</strong><span className="font-bold">{selectedClass?.name}</span><strong className="text-[#66829c]">Date</strong><span className="font-bold">{new Date().toLocaleDateString('en-GB')}</span></div><div className="flex items-center justify-between rounded-2xl bg-[#e8f6f2] px-4 py-2 text-center sm:block sm:px-2 sm:py-3 print:rounded-xl"><span className="text-[10px] font-black uppercase tracking-[0.16em] text-[#0f766e]">Grade</span><span className="text-3xl font-black leading-none text-[#18334b] sm:mt-1 sm:block print:text-2xl">{gradeName}</span></div></div><p className="px-5 pb-3 text-[11px] font-bold tracking-wide text-[#66829c] print:px-3 print:pb-2">{academicYear} <span className="px-1">·</span> {semester === '1st Semester' ? '1st Semester' : '2nd Semester'} - {reportType}</p></header>}
          {pageIndex === 0 && <div className="student-report-parent-note mt-3 mb-4 rounded-xl border border-[#d6e3ef] bg-[#f2f7fb] px-4 py-3 text-sm font-semibold leading-relaxed text-[#294563] print:mt-2 print:mb-3 print:px-3 print:py-2"><strong className="me-3 font-black uppercase tracking-wide text-[#0f766e]">Note to parents</strong>This report summarizes the student’s progress across subjects. Please review the comments and recommendations with your child.</div>}
          {pageReports.length ? <div className="student-report-subject-grid grid gap-4 sm:grid-cols-2 print:grid-cols-2 print:gap-3">{pageReports.map((report) => <SubjectReportCard key={report.id} report={report} showIxl={gradeAllowsIxl && isIxlSubject(report.subject.name)} locale={locale} />)}</div> : <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900 print:border print:border-amber-300">No subject reports have been submitted for this student yet.</p>}
        </article>)}{needsDuplexSpacer && <div key={`${student.id}-duplex-spacer`} aria-hidden="true" className="student-report-duplex-spacer" />}</Fragment>;
      })}
    </section>}
  </main>;

  return <main className="w-full px-4 py-8 sm:px-7 xl:px-10">
    <div className="mb-7"><a href={isAdmin ? '/admin' : '/teacher'} className="text-sm font-semibold text-emerald-800">← {isAdmin ? t('backAdmin') : t('backTeacher')}</a><h1 className="mt-3 text-3xl font-black text-slate-900">{t('title')}</h1><p className="mt-2 text-slate-500">{t('intro')}</p></div>
    <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {isAdmin && <label className={label}>{t('teacher')}<select className={control} value={teacherId} onChange={(event) => { setTeacherId(event.target.value); setClassId(''); setSubjectId(''); }}><option value="">{t('chooseTeacher')}</option>{teachers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>}
        <label className={label}>{t('class')}<select className={control} value={classId} onChange={(event) => setClassId(event.target.value)}><option value="">{t('chooseClass')}</option>{visibleClasses.map((item) => <option key={item.id} value={item.id}>{item.grade?.name ? `${item.grade.name} · ${item.name}` : item.name}</option>)}</select></label>
        <label className={label}>{t('subject')}<select className={control} value={subjectId} onChange={(event) => setSubjectId(event.target.value)}><option value="">{t('chooseSubject')}</option>{visibleSubjects.map((item) => <option key={item.id} value={item.id}>{isArabicTaughtSubject(item.name) ? arabicSubjectName(item.name) : item.name}</option>)}</select></label>
        <label className={label}>{t('year')}<input className={control} value={academicYear} onChange={(event) => setAcademicYear(event.target.value)} placeholder="2026-2027" /></label>
        <label className={label}>{t('semester')}<select className={control} value={semester} onChange={(event) => setSemester(event.target.value)}>{[['1st Semester', t('firstSemester')], ['2nd Semester', t('secondSemester')]].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className={label}>{t('reportType')}<select className={control} value={reportType} onChange={(event) => setReportType(event.target.value)}><option value="First Report">{t('firstReport')}</option><option value="Second Report">{t('secondReport')}</option></select></label>
      </div>
    </section>
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6"><div><h2 className="text-lg font-bold text-slate-900">{selectedClass?.name ?? t('roster')}</h2><p className="mt-1 text-sm text-slate-500">{selectedClass ? t('students', { count: students.length, semester: t(semester === '1st Semester' ? 'firstSemester' : 'secondSemester') }) : t('chooseFilters')}</p></div><button type="button" disabled={!classId || !subjectId || loading} onClick={() => void loadReports()} className="rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">{loading ? t('refreshing') : t('refresh')}</button></div>
      {!classId || !subjectId ? <p className="px-5 py-12 text-center text-sm text-slate-500">{t('chooseFilters')}</p> : loading && !loaded ? <p className="px-5 py-12 text-center text-sm text-slate-500">{t('loading')}</p> : <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">#</th><th className="px-5 py-3">{t('student')}</th><th className="px-5 py-3">{t('status')}</th><th className="px-5 py-3">{t('action')}</th></tr></thead><tbody className="divide-y divide-slate-100">{students.map((student, index) => { const report = reports.find((item) => item.studentId === student.id && item.subjectId === subjectId && item.academicYear === academicYear && item.semester === semester && item.reportType === reportType && (!isAdmin || item.teacherId === teacherId)); return <tr key={student.id} className="hover:bg-emerald-50/30"><td className="px-5 py-3.5 text-slate-500">{index + 1}</td><td className="px-5 py-3.5"><span className="font-semibold text-slate-900">{student.name}</span></td><td className="px-5 py-3.5">{report ? <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">{t('saved')}</span> : <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-800">{t('notStarted')}</span>}</td><td className="px-5 py-3.5"><button type="button" onClick={() => openStudent(index)} className={report ? 'rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700' : 'rounded-lg bg-[#123b36] px-3 py-1.5 text-xs font-bold text-white'}>{report ? t('edit') : t('add')}</button></td></tr>; })}{students.length === 0 && <tr><td colSpan={4} className="px-5 py-10 text-center text-slate-500">{t('noStudents')}</td></tr>}</tbody></table></div>}
    </section>

    {currentStudent && studentIndex !== null && <StudentReportModal student={currentStudent} className={selectedClass?.name ?? ''} subjectName={selectedSubject ? isArabicTaughtSubject(selectedSubject.name) ? arabicSubjectName(selectedSubject.name) : selectedSubject.name : ''} showIxl={showIxl} arabicSubject={arabicSubject} index={studentIndex} total={students.length} editing={Boolean(currentReport)} saving={saving} draft={draft} onDraftChange={setDraft} onPrevious={() => openStudent(studentIndex - 1)} onClose={closeModal} onSubmit={saveAndAdvance} />}
  </main>;
}


