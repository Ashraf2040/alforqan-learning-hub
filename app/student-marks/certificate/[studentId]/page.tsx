'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import type { MarkColumn } from '@/lib/student-marks';
import { ControlLoader } from '@/app/components/ControlLoader';

type Certificate = {
  className: string;
  academicYear: string;
  semester: string;
  subjects: { id: string; name: string; columns: MarkColumn[] }[];
  students: { id: string; name: string; marks: Record<string, Record<string, number>>; gradedSubjectIds?: string[]; completedSubjectIds?: string[]; recordedColumns?: Record<string, string[]>; absentFinalExams?: Record<string, boolean> }[];
};

function letterGrade(percent: number) {
  if (percent >= 96) return 'A+';
  if (percent >= 93) return 'A';
  if (percent >= 89) return 'A−';
  if (percent >= 86) return 'B+';
  if (percent >= 83) return 'B';
  if (percent >= 79) return 'B−';
  if (percent >= 76) return 'C+';
  if (percent >= 73) return 'C';
  if (percent >= 69) return 'C−';
  if (percent >= 66) return 'D+';
  if (percent >= 63) return 'D';
  if (percent >= 60) return 'D−';
  return 'Below B−';
}

export default function StudentMarksCertificatePage() {
  const { studentId } = useParams<{ studentId: string }>();
  const search = useSearchParams();
  const rtl = useLocale() === 'ar';
  const [certificate, setCertificate] = useState<Certificate | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const query = new URLSearchParams({ classId: search.get('classId') ?? '', academicYear: search.get('academicYear') ?? '', semester: search.get('semester') ?? '', studentId });
    const teacherId = search.get('teacherId');
    if (teacherId) query.set('teacherId', teacherId);
    void fetch(`/api/student-marks/summary?${query}`, { cache: 'no-store' }).then(async (response) => {
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setCertificate(data as Certificate);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : (rtl ? 'تعذر تحميل الشهادة.' : 'Could not load student certificate.'))).finally(() => setLoading(false));
  }, [studentId, search, rtl]);

  if (loading) return <><ControlLoader message={rtl ? 'يرجى الانتظار، جارٍ معالجة طلبك…' : 'Please wait, we are processing your request…'} /><main className="min-h-[65vh]" /></>;
  if (error || !certificate?.students[0]) return <main className="mx-auto max-w-xl px-5 py-16 text-center text-sm font-semibold text-[#ff5959]">{error || (rtl ? 'لم يتم العثور على الطالب.' : 'Student not found.')}</main>;

  const student = certificate.students[0];
  const gradedSubjectIds = new Set(student.gradedSubjectIds ?? []);
  const completedSubjectIds = new Set(student.completedSubjectIds ?? []);
  const recordedColumns = student.recordedColumns ?? {};
  const gradedSubjects = certificate.subjects.filter((subject) => gradedSubjectIds.has(subject.id));
  const isComplete = certificate.subjects.length > 0 && completedSubjectIds.size === certificate.subjects.length;
  const earned = gradedSubjects.reduce((sum, subject) => sum + subject.columns.reduce((total, column) => total + (recordedColumns[subject.id]?.includes(column.field) ? Number(student.marks[subject.id]?.[column.field] ?? 0) : 0), 0), 0);
  const possible = gradedSubjects.reduce((sum, subject) => sum + subject.columns.reduce((total, column) => total + (recordedColumns[subject.id]?.includes(column.field) ? column.max : 0), 0), 0);
  const percent = isComplete && possible ? earned / possible * 100 : 0;
  const grade = isComplete ? letterGrade(percent) : (rtl ? 'قيد الانتظار' : 'Pending');
  const termLabels: Record<string, string> = { '1st Semester': 'الفصل الدراسي الأول', '2nd Semester': 'الفصل الدراسي الثاني' };
  const term = rtl ? termLabels[certificate.semester] ?? certificate.semester : certificate.semester;
  const allColumns = certificate.subjects.flatMap((subject) => subject.columns);
  const sharedColumns = allColumns.filter((column, index) => allColumns.findIndex((candidate) => candidate.field === column.field) === index);

  return <main dir={rtl ? 'rtl' : 'ltr'} className="mx-auto max-w-6xl px-4 py-8 sm:px-7 print:max-w-none print:px-0 print:py-0">
    <div className="mb-5 flex justify-end print:hidden"><button type="button" onClick={() => window.print()} className="rounded-xl bg-[#222831] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#18181b]">{rtl ? 'طباعة الشهادة' : 'Print certificate'}</button></div>
    <article className="marks-certificate overflow-hidden rounded-2xl border border-[#cccccc] bg-white shadow-xl">
      <header className="certificate-heading bg-[#222831] px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-4">
          <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#ff8585]">{isComplete ? (rtl ? 'كشف درجات رسمي' : 'Official student report') : (rtl ? 'مسودة كشف درجات' : 'Draft student report')}</p><h1 className="mt-1 text-2xl font-black leading-tight">{rtl ? `إشعار درجات ${term}` : `${term} Result Notification`}</h1><p className="mt-1 text-xs font-medium text-white/75">{rtl ? 'العام الدراسي' : 'Academic year'} · <span className="font-bold text-white">{certificate.academicYear}</span></p></div>
          <div className="text-end"><strong className="block text-lg font-black text-white">{isComplete ? (rtl ? 'كشف درجات' : 'Report card') : (rtl ? 'مسودة' : 'Draft')}</strong>{!isComplete && <span className="text-xs text-white/75">{gradedSubjects.length}/{certificate.subjects.length} {rtl ? 'مواد مسجلة' : 'subjects recorded'}</span>}</div>
        </div>
      </header>

      <div className="certificate-body">
        <section className="certificate-summary-strip" aria-label={rtl ? 'بيانات الطالب وملخص الدرجات' : 'Student details and marks summary'}>
          <span><b>{rtl ? 'الطالب' : 'Student'}</b>{student.name}</span>
          <span><b>{rtl ? 'الفصل' : 'Class'}</b>{certificate.className}</span>
          <span><b>{rtl ? 'المعدل' : 'Average'}</b>{isComplete ? `${percent.toFixed(1)}%` : (rtl ? 'قيد الانتظار' : 'Pending')}</span>
          <span><b>{isComplete ? (rtl ? 'المجموع' : 'Total') : (rtl ? 'المسجل' : 'Recorded')}</b><bdi dir="ltr">{earned} / {possible}</bdi></span>
          <span><b>{rtl ? 'التقدير' : 'Grade'}</b>{grade}</span>
        </section>
        {!isComplete && <p role="status" className="certificate-completion-note">{rtl ? `درجات جزئية · تم التسجيل في ${gradedSubjects.length} من ${certificate.subjects.length} مواد` : `Partial results · Marks recorded in ${gradedSubjects.length} of ${certificate.subjects.length} subjects`}</p>}

        <section className="certificate-results">
          <div className="certificate-results-heading"><h2>{rtl ? 'درجات المواد' : 'Subject marks'}</h2><span>{rtl ? `${certificate.subjects.length} مواد` : `${certificate.subjects.length} subjects`}</span></div>
          <div className="certificate-table-scroll overflow-x-auto rounded-xl border border-[#cccccc]"><table className="certificate-marks-table w-full border-collapse text-sm"><thead><tr><th className="min-w-36 text-start">{rtl ? 'المادة' : 'Subject'}</th>{sharedColumns.map((column) => <th key={column.field} className="min-w-24">{rtl ? column.labelAr : column.label}<span className="mt-1 block text-[10px] font-medium text-white/65">{rtl ? 'الدرجة' : 'Mark'}</span></th>)}<th className="min-w-24">{rtl ? 'المجموع' : 'Total'}</th><th className="min-w-20">{rtl ? 'التقدير' : 'Grade'}</th></tr></thead><tbody>{certificate.subjects.map((subject, index) => {
            const isGraded = gradedSubjectIds.has(subject.id);
            const isSubjectComplete = completedSubjectIds.has(subject.id);
            const recorded = new Set(recordedColumns[subject.id] ?? []);
            const score = subject.columns.reduce((total, column) => total + (recorded.has(column.field) ? Number(student.marks[subject.id]?.[column.field] ?? 0) : 0), 0);
            const max = subject.columns.reduce((total, column) => total + (recorded.has(column.field) ? column.max : 0), 0);
            const subjectMax = subject.columns.reduce((total, column) => total + column.max, 0);
            const columnsByField = new Map(subject.columns.map((column) => [column.field, column]));
            return <tr key={subject.id} className={index % 2 ? 'bg-[#f9f9f9]' : 'bg-white'}><th scope="row" className="text-start font-bold text-[#222831]"><span className="me-2 inline-grid h-6 w-6 place-items-center rounded-md bg-[#ffe8e8] text-[10px] font-black text-[#e16262]">{index + 1}</span>{subject.name}</th>{sharedColumns.map((column) => {
              const subjectColumn = columnsByField.get(column.field);
              const absent = column.field === 'finalExam' && student.absentFinalExams?.[subject.id] === true;
              return <td key={column.field} className="text-center font-semibold text-[#333333]">{absent && recorded.has(column.field) ? <span className="rounded-md bg-[#fff1f1] px-2 py-1 text-[#e16262]">{rtl ? 'غائب' : 'Absent'}</span> : !recorded.has(column.field) || !subjectColumn ? <span className="text-[#666666]">—</span> : <bdi dir="ltr">{Number(student.marks[subject.id]?.[column.field] ?? 0)} / {subjectColumn.max}</bdi>}</td>;
            })}<td className="text-center font-black text-[#222831]">{isGraded ? <><bdi dir="ltr">{score} / {max}</bdi>{!isSubjectComplete && <small className="ms-1 text-amber-700">({rtl ? 'جزئي' : 'partial'})</small>}</> : <bdi dir="ltr" className="text-[#666666]">— / {subjectMax}</bdi>}</td><td className="text-center"><span className={`inline-flex min-w-10 justify-center rounded-lg px-2 py-1 font-black ${isSubjectComplete ? 'bg-[#f4f4f4] text-[#e16262]' : 'bg-[#fff7e6] text-[#8a5400]'}`}>{isSubjectComplete ? letterGrade(subjectMax ? score / subjectMax * 100 : 0) : isGraded ? (rtl ? 'جزئي' : 'Partial') : (rtl ? 'قيد الانتظار' : 'Pending')}</span></td></tr>;
          })}{certificate.subjects.length === 0 && <tr><td colSpan={sharedColumns.length + 3} className="px-4 py-8 text-center text-[#666666]">{rtl ? 'لا توجد مواد مسجلة لهذه الفترة.' : 'No subjects are recorded for this period.'}</td></tr>}</tbody></table></div>
        </section>

        <footer className="certificate-footer"><span>{rtl ? 'إشعار بالدرجات المسجلة للفصل الدراسي المحدد.' : 'Marks recorded for the selected academic period.'}</span><span className="certificate-signature">{rtl ? 'مدير المدرسة' : 'School principal'} <i /></span></footer>
      </div>
    </article>
    <style jsx global>{`@media print {
      body:has(.marks-certificate) main { page: certificate !important; }
      body { background: #fff !important; }
      body:has(.marks-certificate) * { visibility: hidden !important; }
      body:has(.marks-certificate) .marks-certificate, body:has(.marks-certificate) .marks-certificate * { visibility: visible !important; }
      .marks-certificate { page: certificate !important; position: absolute !important; inset: 0 auto auto 0 !important; box-sizing: border-box !important; width: 100% !important; height: auto !important; max-height: none !important; max-width: none !important; overflow: visible !important; break-inside: avoid !important; page-break-inside: avoid !important; border: 1px solid #cccccc !important; border-radius: 0 !important; box-shadow: none !important; print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
      .certificate-heading { padding: 2mm 5mm !important; background: #f4f4f4 !important; color: #222831 !important; }
      .certificate-heading > div { gap: 2mm !important; }
      .certificate-heading p, .certificate-heading h1, .certificate-heading strong { color: #222831 !important; }
      .certificate-heading .text-white\\/75, .certificate-heading .text-white\\/60 { color: #333333 !important; }
      .certificate-heading h1 { margin-top: 1mm !important; font-size: 16pt !important; line-height: 1.1 !important; }
      .certificate-heading .rounded-2xl { padding: 1.5mm 4mm !important; }
      .certificate-body { display: flex !important; flex-direction: column !important; gap: 2mm !important; padding: 2mm 4mm !important; }
      .marks-certificate > div > :not([hidden]) ~ :not([hidden]) { margin-block: 0 !important; }
      .certificate-summary-strip { display: flex !important; flex-wrap: nowrap !important; align-items: center !important; gap: 0 !important; padding: 1.5mm 2mm !important; border: 1px solid #d4d8df !important; background: #f5f6f8 !important; }
      .certificate-summary-strip > span { flex: 1 1 auto !important; min-width: 0 !important; padding: 0 2mm !important; border-inline-end: 1px solid #d4d8df !important; font-size: 8pt !important; line-height: 1.15 !important; white-space: nowrap !important; }
      .certificate-summary-strip > span:first-child { flex: 2 1 auto !important; }
      .certificate-summary-strip > span:last-child { border: 0 !important; }
      .certificate-summary-strip b { display: block !important; margin-bottom: .5mm !important; color: #666 !important; font-size: 5.5pt !important; letter-spacing: .04em !important; text-transform: uppercase !important; }
      .certificate-completion-note { padding: 1mm 2mm !important; border-inline-start: 1mm solid #e5a000 !important; background: #fff8e5 !important; color: #654300 !important; font-size: 6.5pt !important; line-height: 1.15 !important; }
      .certificate-results-heading { display: flex !important; align-items: baseline !important; justify-content: space-between !important; margin: 0 0 1mm !important; }
      .certificate-results-heading h2 { margin: 0 !important; font-size: 10pt !important; line-height: 1.1 !important; }
      .certificate-results-heading span { color: #666 !important; font-size: 6pt !important; }
      .certificate-marks-table { table-layout: fixed !important; font-size: 6.5pt !important; line-height: 1.05 !important; }
      .certificate-marks-table th, .certificate-marks-table td { padding: .5mm .4mm !important; line-height: 1.05 !important; }
      .certificate-marks-table th:first-child, .certificate-marks-table td:first-child { min-width: 22mm !important; }
      .certificate-marks-table th:not(:first-child), .certificate-marks-table td:not(:first-child) { min-width: 0 !important; }
      .certificate-marks-table th span { margin-top: .3mm !important; font-size: 5.5pt !important; }
      .certificate-table-scroll { overflow: visible !important; }
      .certificate-marks-table thead { break-after: avoid; page-break-after: avoid; }
      .certificate-marks-table tr { break-inside: avoid; page-break-inside: avoid; }
      .certificate-footer { display: flex !important; justify-content: space-between !important; align-items: end !important; gap: 4mm !important; padding-top: 1mm !important; border-top: 1px solid #ddd !important; color: #666 !important; font-size: 5.5pt !important; line-height: 1 !important; }
      .certificate-signature { display: flex !important; align-items: end !important; gap: 2mm !important; color: #222831 !important; font-size: 6.5pt !important; font-weight: 700 !important; white-space: nowrap !important; }
      .certificate-signature i { display: inline-block !important; width: 25mm !important; border-bottom: 1px dashed #999 !important; }
    }`}</style>
  </main>;
}
