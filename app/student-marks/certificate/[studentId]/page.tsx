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
  students: { id: string; name: string; marks: Record<string, Record<string, number>>; gradedSubjectIds?: string[]; absentFinalExams?: Record<string, boolean> }[];
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
  const gradedSubjects = certificate.subjects.filter((subject) => gradedSubjectIds.has(subject.id));
  const earned = gradedSubjects.reduce((sum, subject) => sum + subject.columns.reduce((total, column) => total + Number(student.marks[subject.id]?.[column.field] ?? 0), 0), 0);
  const possible = gradedSubjects.reduce((sum, subject) => sum + subject.columns.reduce((total, column) => total + column.max, 0), 0);
  const percent = possible ? earned / possible * 100 : 0;
  const grade = gradedSubjects.length ? letterGrade(percent) : (rtl ? 'قيد الانتظار' : 'Pending');
  const termLabels: Record<string, string> = { '1st Semester': 'الفصل الدراسي الأول', '2nd Semester': 'الفصل الدراسي الثاني' };
  const term = rtl ? termLabels[certificate.semester] ?? certificate.semester : certificate.semester;
  const allColumns = certificate.subjects.flatMap((subject) => subject.columns);
  const sharedColumns = allColumns.filter((column, index) => allColumns.findIndex((candidate) => candidate.field === column.field) === index);

  return <main dir={rtl ? 'rtl' : 'ltr'} className="mx-auto max-w-6xl px-4 py-8 sm:px-7 print:max-w-none print:px-0 print:py-0">
    <div className="mb-5 flex justify-end print:hidden"><button type="button" onClick={() => window.print()} className="rounded-xl bg-[#222831] px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#18181b]">{rtl ? 'طباعة الشهادة' : 'Print certificate'}</button></div>
    <article className="marks-certificate overflow-hidden rounded-2xl border border-[#cccccc] bg-white shadow-xl">
      <header className="certificate-heading relative overflow-hidden bg-[#222831] px-6 py-8 text-white sm:px-10 sm:py-10">
        <span className="absolute inset-y-0 start-0 w-2 bg-[#ff5959]" />
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div><p className="text-xs font-black uppercase tracking-[0.22em] text-[#ff8585]">{rtl ? 'كشف درجات رسمي' : 'Official student report'}</p><h1 className="mt-3 text-2xl font-black leading-tight sm:text-4xl">{rtl ? `إشعار درجات ${term}` : `${term} Result Notification`}</h1><p className="mt-2 text-sm font-medium text-white/75">{rtl ? 'العام الدراسي' : 'Academic year'} · <span className="font-bold text-white">{certificate.academicYear}</span></p></div>
          <div className="grid min-w-32 place-items-center rounded-2xl border border-white/20 bg-white/5 px-6 py-4 text-center"><span className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/60">{rtl ? 'وثيقة رسمية' : 'Official document'}</span><strong className="mt-1 text-xl font-black text-white">{rtl ? 'كشف درجات' : 'Report card'}</strong></div>
        </div>
        <div className="absolute -bottom-16 -end-6 h-40 w-40 rounded-full border-[20px] border-white/5" />
      </header>

      <div className="space-y-7 p-5 sm:p-9">
        <section className="grid gap-3 sm:grid-cols-2" aria-label={rtl ? 'بيانات الطالب' : 'Student details'}>
          <div className="rounded-xl border border-[#e0e0e0] bg-[#f9f9f9] p-4"><p className="text-xs font-bold uppercase tracking-wide text-[#666666]">{rtl ? 'اسم الطالب' : 'Student name'}</p><p className="mt-1 text-lg font-extrabold text-[#222831]">{student.name}</p></div>
          <div className="rounded-xl border border-[#e0e0e0] bg-[#f9f9f9] p-4"><p className="text-xs font-bold uppercase tracking-wide text-[#666666]">{rtl ? 'الفصل' : 'Class'}</p><p className="mt-1 text-lg font-extrabold text-[#222831]">{certificate.className}</p></div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3" aria-label={rtl ? 'ملخص الدرجات' : 'Marks summary'}>
          <div className="certificate-stat"><span>{rtl ? 'المعدل' : 'Average'} · {rtl ? 'مواد مرصودة' : 'Marks entered'} {gradedSubjects.length}/{certificate.subjects.length}</span><strong>{gradedSubjects.length ? `${percent.toFixed(1)}%` : (rtl ? 'قيد الانتظار' : 'Pending')}</strong></div>
          <div className="certificate-stat"><span>{rtl ? 'المجموع الكلي' : 'Total marks'}</span><strong>{earned}<small> / {possible}</small></strong></div>
          <div className="certificate-stat"><span>{rtl ? 'التقدير العام' : 'Overall grade'}</span><strong>{grade}</strong></div>
        </section>

        <section>
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2"><div><p className="text-xs font-black uppercase tracking-[0.16em] text-[#e16262]">{rtl ? 'النتائج الأكاديمية' : 'Academic results'}</p><h2 className="mt-1 text-xl font-black text-[#222831]">{rtl ? 'درجات المواد' : 'Subject marks'}</h2></div><p className="text-xs font-medium text-[#666666]">{rtl ? `${certificate.subjects.length} مواد` : `${certificate.subjects.length} subjects`}</p></div>
          <div className="certificate-table-scroll overflow-x-auto rounded-xl border border-[#cccccc]"><table className="certificate-marks-table w-full border-collapse text-sm"><thead><tr><th className="min-w-36 text-start">{rtl ? 'المادة' : 'Subject'}</th>{sharedColumns.map((column) => <th key={column.field} className="min-w-24">{rtl ? column.labelAr : column.label}<span className="mt-1 block text-[10px] font-medium text-white/65">{rtl ? 'الدرجة' : 'Mark'}</span></th>)}<th className="min-w-24">{rtl ? 'المجموع' : 'Total'}</th><th className="min-w-20">{rtl ? 'التقدير' : 'Grade'}</th></tr></thead><tbody>{certificate.subjects.map((subject, index) => {
            const isGraded = gradedSubjectIds.has(subject.id);
            const score = subject.columns.reduce((total, column) => total + Number(student.marks[subject.id]?.[column.field] ?? 0), 0);
            const max = subject.columns.reduce((total, column) => total + column.max, 0);
            const columnsByField = new Map(subject.columns.map((column) => [column.field, column]));
            return <tr key={subject.id} className={index % 2 ? 'bg-[#f9f9f9]' : 'bg-white'}><th scope="row" className="text-start font-bold text-[#222831]"><span className="me-2 inline-grid h-6 w-6 place-items-center rounded-md bg-[#ffe8e8] text-[10px] font-black text-[#e16262]">{index + 1}</span>{subject.name}</th>{sharedColumns.map((column) => {
              const subjectColumn = columnsByField.get(column.field);
              const absent = column.field === 'finalExam' && student.absentFinalExams?.[subject.id] === true;
              return <td key={column.field} className="text-center font-semibold text-[#333333]">{absent ? <span className="rounded-md bg-[#fff1f1] px-2 py-1 text-[#e16262]">{rtl ? 'غائب' : 'Absent'}</span> : !isGraded || !subjectColumn ? <span className="text-[#666666]">—</span> : <>{Number(student.marks[subject.id]?.[column.field] ?? 0)}<span className="text-[#666666]"> / {subjectColumn.max}</span></>}</td>;
            })}<td className="text-center font-black text-[#222831]">{isGraded ? <>{score}<span className="font-semibold text-[#666666]"> / {max}</span></> : <span className="text-[#666666]">— / {max}</span>}</td><td className="text-center"><span className={`inline-flex min-w-10 justify-center rounded-lg px-2 py-1 font-black ${isGraded ? 'bg-[#f4f4f4] text-[#e16262]' : 'bg-[#f4f4f4] text-[#666666]'}`}>{isGraded ? letterGrade(max ? score / max * 100 : 0) : (rtl ? 'قيد الانتظار' : 'Pending')}</span></td></tr>;
          })}{certificate.subjects.length === 0 && <tr><td colSpan={sharedColumns.length + 3} className="px-4 py-8 text-center text-[#666666]">{rtl ? 'لا توجد مواد مسجلة لهذه الفترة.' : 'No subjects are recorded for this period.'}</td></tr>}</tbody></table></div>
        </section>

        <footer className="grid gap-4 border-t border-[#e0e0e0] pt-5 sm:grid-cols-[1fr_auto] sm:items-end"><p className="max-w-2xl text-xs leading-6 text-[#666666]">{rtl ? 'هذا المستند إشعار بالدرجات المسجلة للفصل الدراسي المحدد. يمنع التعديل أو الإضافة على هذا المستند.' : 'This document reports the marks recorded for the selected academic period. Alteration or addition to this document is prohibited.'}</p><div className="min-w-48 text-center"><p className="text-sm font-bold text-[#222831]">{rtl ? 'مدير المدرسة' : 'School principal'}</p><div className="mt-8 border-b border-dashed border-[#999999]" /><p className="mt-2 text-[10px] font-medium text-[#999999]">{rtl ? 'التوقيع والختم' : 'Signature and stamp'}</p></div></footer>
      </div>
    </article>
    <style jsx global>{`@page { size: A4 landscape !important; margin: 5mm; } @media print { body { background: #fff !important; } body:has(.marks-certificate) * { visibility: hidden !important; } body:has(.marks-certificate) .marks-certificate, body:has(.marks-certificate) .marks-certificate * { visibility: visible !important; } .marks-certificate { position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; max-width: none !important; border: 1px solid #cccccc !important; border-radius: 0 !important; box-shadow: none !important; print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; } .certificate-heading { padding: 3mm 5mm !important; background: #f4f4f4 !important; color: #222831 !important; } .certificate-heading p, .certificate-heading h1, .certificate-heading strong { color: #222831 !important; } .certificate-heading .text-white\\/75, .certificate-heading .text-white\\/60 { color: #333333 !important; } .marks-certificate > div { gap: 2mm !important; padding: 3mm 5mm !important; } .certificate-stat { padding: 1.5mm !important; } .certificate-marks-table { font-size: 6.5pt !important; } .certificate-marks-table th, .certificate-marks-table td { padding: 1mm !important; } .certificate-marks-table th:first-child, .certificate-marks-table td:first-child { min-width: 22mm !important; } .certificate-marks-table th:not(:first-child), .certificate-marks-table td:not(:first-child) { min-width: 0 !important; } .certificate-table-scroll { overflow: visible !important; } .certificate-marks-table thead { break-after: avoid; page-break-after: avoid; } .certificate-marks-table tr { break-inside: avoid; page-break-inside: avoid; } .marks-certificate footer { padding-top: 2mm !important; } .marks-certificate footer .mt-8 { margin-top: 3mm !important; } }`}</style>
  </main>;
}
