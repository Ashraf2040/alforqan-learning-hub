'use client';

import { Fragment, useEffect, useMemo, useState } from 'react';
import { useLocale } from 'next-intl';
import { toast } from 'react-hot-toast';

type SubmissionStatus = { submitted: number; expected?: number; complete: boolean; lastEditedAt: string | null; lastEditedBy?: string | null };
type SubmissionRow = { id: string; teacherId: string; teacherName: string; username: string; className: string; subjectName: string; expectedStudents: number; marks?: SubmissionStatus; quizzes?: SubmissionStatus; reports?: SubmissionStatus; dailyProgress?: { submitted: boolean; lastEditedAt: string | null } };
type SubmissionKind = 'marks' | 'quizzes' | 'reports' | 'dailyProgress';
const years = ['2024-2025', '2025-2026', '2026-2027'];
const semesters = ['1st Semester', '2nd Semester'];

export default function TeacherSubmissionTracker() {
  const rtl = useLocale() === 'ar';
  const [academicYear, setAcademicYear] = useState('2026-2027');
  const [semester, setSemester] = useState(semesters[0]);
  const [kind, setKind] = useState<SubmissionKind>('marks');
  const [date, setDate] = useState(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()));
  const [rows, setRows] = useState<SubmissionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [expandedTeacherId, setExpandedTeacherId] = useState<string | null>(null);
  const text = (en: string, ar: string) => rtl ? ar : en;

  async function load() {
    setLoading(true); setError('');
    try {
      const query = new URLSearchParams({ academicYear, semester });
      if (kind === 'dailyProgress') query.set('date', date);
      const response = await fetch(`/api/admin/teacher-submissions?${query}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load teacher submissions.');
      setRows(result.rows ?? []); setLoaded(true);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Could not load teacher submissions.';
      setError(message); toast.error(message);
    } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  const visibleRows = useMemo(() => rows.map((row) => {
    const status = kind === 'dailyProgress'
      ? { submitted: row.dailyProgress?.submitted ? 1 : 0, expected: 1, complete: Boolean(row.dailyProgress?.submitted), lastEditedAt: row.dailyProgress?.lastEditedAt ?? null }
      : row[kind];
    return { ...row, status: status ?? { submitted: 0, expected: row.expectedStudents, complete: false, lastEditedAt: null } };
  }), [rows, kind]);
  const groupedTeachers = useMemo(() => {
    const grouped = new Map<string, { teacherId: string; teacherName: string; username: string; classes: Set<string>; submitted: typeof visibleRows; missing: typeof visibleRows }>();
    for (const row of visibleRows) {
      const group = grouped.get(row.teacherId) ?? { teacherId: row.teacherId, teacherName: row.teacherName, username: row.username, classes: new Set<string>(), submitted: [], missing: [] };
      group.classes.add(row.className);
      (row.status.complete ? group.submitted : group.missing).push(row);
      grouped.set(row.teacherId, group);
    }
    return [...grouped.values()];
  }, [visibleRows]);
  const done = visibleRows.filter((row) => row.status.complete).length;
  const kindLabel: Record<SubmissionKind, { en: string; ar: string }> = {
    marks: { en: 'Student marks', ar: 'درجات الطلاب' }, quizzes: { en: 'Quiz marks', ar: 'درجات الاختبارات القصيرة' }, reports: { en: 'Student reports', ar: 'تقارير الطلاب' }, dailyProgress: { en: 'Today’s lesson plan', ar: 'خطة درس اليوم' },
  };
  function printReport() {
    const popup = window.open('', '_blank', 'width=1100,height=850');
    if (!popup) { toast.error(text('Allow pop-ups to print the report.', 'اسمح بالنوافذ المنبثقة لطباعة التقرير.')); return; }
    popup.opener = null;
    const safe = (value: unknown) => String(value ?? '—').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
    const incompleteTeachers = groupedTeachers.filter((teacher) => teacher.missing.length > 0);
    const teacherRows = incompleteTeachers.map((teacher) => {
      const classes = [...new Set(teacher.missing.map((row) => row.className))];
      return `<tr><td><b>${safe(teacher.teacherName)}</b></td><td>${classes.map(safe).join('، ')}</td></tr>`;
    }).join('');
    const period = kind === 'dailyProgress' ? `${text('Date', 'التاريخ')}: ${safe(date)}` : `${safe(academicYear)} · ${safe(rtl ? semester === '1st Semester' ? 'الفصل الدراسي الأول' : 'الفصل الدراسي الثاني' : semester)}`;
    popup.document.write(`<!doctype html><html lang="${rtl ? 'ar' : 'en'}" dir="${rtl ? 'rtl' : 'ltr'}"><head><meta charset="utf-8"><title>${safe(text('Incomplete teacher submissions', 'المعلمون الذين لم يكملوا التسليم'))}</title><style>
      *{box-sizing:border-box}body{margin:0;padding:28px;color:#172033;font:14px Arial,sans-serif}.report{max-width:900px;margin:auto}.heading{padding-bottom:14px;margin-bottom:20px;border-bottom:2px solid #0f766e}.heading h1{margin:0 0 7px;font-size:22px}.heading p{margin:0;color:#64748b;font-size:12px}table{width:100%;border-collapse:collapse}th,td{padding:12px;border:1px solid #dbe3ee;text-align:start}th{background:#f1f5f9;color:#334155;font-size:12px}tbody tr:nth-child(even){background:#f8fafc}.empty{text-align:center;color:#64748b;padding:24px}@page{size:A4 portrait;margin:15mm}@media print{body{padding:0}tr{break-inside:avoid}}
      </style></head><body><main class="report"><header class="heading"><h1>${safe(text('Teachers with incomplete submissions', 'المعلمون الذين لم يكملوا التسليم'))}</h1><p>${safe(kindLabel[kind][rtl ? 'ar' : 'en'])} · ${period}</p></header><table><thead><tr><th>${safe(text('Teacher name', 'اسم المعلم'))}</th><th>${safe(text('Classes not completed', 'الفصول غير المكتملة'))}</th></tr></thead><tbody>${teacherRows || `<tr><td colspan="2" class="empty">${safe(text('All teachers have completed their submissions.', 'جميع المعلمين أكملوا التسليم.'))}</td></tr>`}</tbody></table></main><script>window.addEventListener('load',()=>window.print())</script></body></html>`);
    popup.document.close();
  }

  return <main dir={rtl ? 'rtl' : 'ltr'} className="mx-auto w-full max-w-7xl px-4 py-7 sm:px-7 sm:py-10 xl:px-10">
    <header className="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 px-6 py-7 text-white shadow-xl sm:px-9 sm:py-9"><div aria-hidden className="absolute -end-16 -top-28 -z-10 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl"/><p className="text-xs font-bold uppercase tracking-[.18em] text-blue-200">{text('SUBMISSION TRACKING', 'متابعة التسليم')}</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">{text('Teacher Submission', 'متابعة تسليمات المعلمين')}</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{text('See each teacher’s assigned class and subject, how many students have marks or reports saved, and what is still missing.', 'تابع لكل معلم الفصل والمادة وعدد الطلاب المسجلة درجاتهم أو تقاريرهم وما تبقى.')}</p></header>
    <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto_auto]"><label className="text-xs font-bold text-slate-600">{text('Submission type', 'نوع التسليم')}<select className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800" value={kind} onChange={(event) => setKind(event.target.value as SubmissionKind)}>{(['marks', 'quizzes', 'reports', 'dailyProgress'] as const).map((item) => <option key={item} value={item}>{rtl ? kindLabel[item].ar : kindLabel[item].en}</option>)}</select></label>{kind === 'dailyProgress' ? <label className="text-xs font-bold text-slate-600">{text('Date', 'التاريخ')}<input type="date" className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800" value={date} onChange={(event) => setDate(event.target.value)} /></label> : <><label className="text-xs font-bold text-slate-600">{text('Academic year', 'السنة الدراسية')}<select className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800" value={academicYear} onChange={(event) => setAcademicYear(event.target.value)}>{years.map((year) => <option key={year}>{year}</option>)}</select></label><label className="text-xs font-bold text-slate-600">{text('Semester', 'الفصل الدراسي')}<select className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800" value={semester} onChange={(event) => setSemester(event.target.value)}>{semesters.map((item) => <option key={item} value={item}>{rtl ? item === '1st Semester' ? 'الفصل الدراسي الأول' : 'الفصل الدراسي الثاني' : item}</option>)}</select></label></>}<button type="button" disabled={loading || (kind === 'dailyProgress' && !date)} onClick={() => void load()} className="self-end rounded-xl bg-blue-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-blue-800 disabled:opacity-50">{loading ? text('Loading…', 'جارٍ التحميل…') : text('Refresh tracking', 'تحديث المتابعة')}</button><button type="button" disabled={!loaded || loading} onClick={printReport} className="self-end rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50">{text('Print report', 'طباعة التقرير')}</button></div>
    </section>
    {error && <p role="alert" className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800">{error}</p>}
    {loaded && !error && <>
      <div className="mt-5 grid gap-3 sm:grid-cols-3"><article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-semibold text-slate-500">{text('Teacher class and subject assignments', 'إسنادات الفصول والمواد')}</p><p className="mt-1 text-2xl font-black text-slate-900">{visibleRows.length}</p></article><article className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4"><p className="text-xs font-semibold text-emerald-800">{text('Completed', 'مكتمل')}</p><p className="mt-1 text-2xl font-black text-emerald-900">{done}</p></article><article className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4"><p className="text-xs font-semibold text-amber-800">{text('Still missing', 'لم يكتمل')}</p><p className="mt-1 text-2xl font-black text-amber-900">{visibleRows.length - done}</p></article></div>
      {groupedTeachers.length ? <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm"><table className="w-full min-w-[780px] border-separate border-spacing-0 text-start text-sm"><thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500"><tr>{[text('Teacher', 'المعلم'), text('Classes', 'الفصول'), text('Completed classes', 'الفصول المكتملة'), text('Incomplete classes', 'الفصول غير المكتملة'), text('Last edited', 'آخر تعديل')].map((label) => <th key={label} className="whitespace-nowrap border-b border-slate-200 px-4 py-3">{label}</th>)}</tr></thead><tbody>{groupedTeachers.map((teacher) => {
        const latest = [...teacher.submitted, ...teacher.missing].flatMap((row) => row.status.lastEditedAt ? [{ at: row.status.lastEditedAt, by: row.status.lastEditedBy }] : []).sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())[0];
        const expanded = expandedTeacherId === teacher.teacherId;
        const detailList = (items: typeof visibleRows, tone: 'emerald' | 'amber') => items.length ? <div className="flex flex-wrap gap-1.5">{items.map((item) => <span key={item.id} className={`rounded-md border px-2 py-1 text-xs font-medium ${tone === 'emerald' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-amber-200 bg-amber-50 text-amber-900'}`}><b>{item.className}</b><span className="text-slate-500"> · {item.subjectName}</span></span>)}</div> : <span className="text-xs text-slate-400">{text('None', 'لا يوجد')}</span>;
        return <Fragment key={teacher.teacherId}><tr className="transition-colors hover:bg-slate-50"><td className="border-b border-slate-100 px-4 py-3"><div className="font-semibold text-slate-900">{teacher.teacherName}</div><div className="mt-0.5 text-xs text-slate-500">@{teacher.username}</div><button type="button" aria-expanded={expanded} onClick={() => setExpandedTeacherId(expanded ? null : teacher.teacherId)} className="mt-1 text-[11px] font-semibold text-blue-700 hover:text-blue-900">{expanded ? text('Hide details', 'إخفاء التفاصيل') : text('View details', 'عرض التفاصيل')}</button></td><td className="max-w-[180px] border-b border-slate-100 px-4 py-3"><div title={[...teacher.classes].join(', ')} className="line-clamp-2 text-xs leading-5 text-slate-700">{[...teacher.classes].join(', ')}</div></td><td className="border-b border-slate-100 px-4 py-3">{detailList(teacher.submitted, 'emerald')}</td><td className="border-b border-slate-100 px-4 py-3">{detailList(teacher.missing, 'amber')}</td><td className="whitespace-nowrap border-b border-slate-100 px-4 py-3 text-xs text-slate-600">{latest ? <span title={latest.by ?? ''}>{new Intl.DateTimeFormat(rtl ? 'ar' : 'en-GB', { dateStyle: 'medium' }).format(new Date(latest.at))}</span> : <span className="text-slate-400">—</span>}</td></tr>{expanded && <tr className="bg-slate-50/70"><td colSpan={5} className="border-b border-slate-200 px-4 py-3"><div className="grid gap-3 sm:grid-cols-2"><section><h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-emerald-800">{text('Submitted', 'تم التسليم')}</h3>{detailList(teacher.submitted, 'emerald')}</section><section><h3 className="mb-2 text-[11px] font-bold uppercase tracking-wide text-amber-800">{text('Not submitted', 'لم يتم التسليم')}</h3>{detailList(teacher.missing, 'amber')}</section></div></td></tr>}</Fragment>;
      })}</tbody></table></div> : <p className="mt-5 rounded-2xl border border-dashed border-slate-300 px-5 py-12 text-center text-sm text-slate-500">{text('No teacher class and subject assignments were found.', 'لا توجد إسنادات فصول ومواد للمعلمين.')}</p>}
    </>}
  </main>;
}
