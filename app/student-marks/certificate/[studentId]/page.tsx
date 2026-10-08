'use client';

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import type { MarkColumn } from '@/lib/student-marks';

type Certificate = { className: string; academicYear: string; semester: string; subjects: { id: string; name: string; columns: MarkColumn[] }[]; students: { id: string; name: string; marks: Record<string, Record<string, number>> }[] };
function letterGrade(percent: number) {
  if (percent >= 96) return 'A+'; if (percent >= 93) return 'A'; if (percent >= 89) return 'A−'; if (percent >= 86) return 'B+'; if (percent >= 83) return 'B'; if (percent >= 79) return 'B−'; if (percent >= 76) return 'C+'; if (percent >= 73) return 'C'; if (percent >= 69) return 'C−'; if (percent >= 66) return 'D+'; if (percent >= 63) return 'D'; if (percent >= 60) return 'D−'; return '—';
}

export default function StudentMarksCertificatePage() {
  const { studentId } = useParams<{ studentId: string }>();
  const search = useSearchParams();
  const locale = useLocale();
  const rtl = locale === 'ar';
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
  if (loading) return <main className="grid min-h-[65vh] place-items-center text-sm text-slate-500">{rtl ? 'جارٍ تحميل الشهادة…' : 'Loading certificate…'}</main>;
  if (error || !certificate?.students[0]) return <main className="mx-auto max-w-xl px-5 py-16 text-center text-sm text-rose-700">{error || (rtl ? 'لم يتم العثور على الطالب.' : 'Student not found.')}</main>;
  const student = certificate.students[0];
  const earned = certificate.subjects.reduce((sum, subject) => sum + subject.columns.reduce((total, column) => total + Number(student.marks[subject.id]?.[column.field] ?? 0), 0), 0);
  const possible = certificate.subjects.reduce((sum, subject) => sum + subject.columns.reduce((total, column) => total + column.max, 0), 0);
  const percent = possible ? earned / possible * 100 : 0;
  return <main dir={rtl ? 'rtl' : 'ltr'} className="mx-auto max-w-5xl px-4 py-8 sm:px-7 print:max-w-none print:px-0 print:py-0">
    <div className="mb-5 flex justify-end print:hidden"><button type="button" onClick={() => window.print()} className="rounded-xl bg-[#123b36] px-5 py-2.5 text-sm font-bold text-white">{rtl ? 'طباعة الشهادة' : 'Print certificate'}</button></div>
    <article className="rounded-2xl border border-slate-300 bg-white p-6 shadow-sm print:rounded-none print:border-0 print:p-5 print:shadow-none">
      <header className="border-b-2 border-[#123b36] pb-5 text-center"><img src="/school-emblem.png" alt="School emblem" className="mx-auto mb-3 h-16 w-16 object-contain"/><p className="text-sm font-bold tracking-[0.14em] text-emerald-900">AL FORQAN PRIVATE SCHOOL</p><h1 className="mt-2 text-2xl font-black text-slate-900">{rtl ? 'إشعار درجات الطالب' : 'Student Marks Certificate'}</h1><p className="mt-2 text-sm font-semibold text-slate-600">{rtl ? 'الفصل الدراسي' : 'Semester'}: {certificate.semester} · {rtl ? 'السنة الدراسية' : 'Academic year'}: {certificate.academicYear}</p></header>
      <div className="my-5 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2"><p><strong>{rtl ? 'اسم الطالب:' : 'Student:'}</strong> {student.name}</p><p><strong>{rtl ? 'الفصل:' : 'Class:'}</strong> {certificate.className}</p></div>
      <div className="space-y-5">{certificate.subjects.map((subject) => {
        const score = subject.columns.reduce((total, column) => total + Number(student.marks[subject.id]?.[column.field] ?? 0), 0);
        const max = subject.columns.reduce((total, column) => total + column.max, 0);
        return <section key={subject.id} className="break-inside-avoid"><h2 className="mb-2 text-base font-black text-[#123b36]">{subject.name}</h2><div className="overflow-x-auto"><table className="w-full border-collapse text-sm"><thead className="bg-[#123b36] text-white"><tr><th className="border border-slate-300 px-2 py-2">{rtl ? 'المادة' : 'Subject'}</th>{subject.columns.map((column) => <th key={column.field} className="border border-slate-300 px-2 py-2">{rtl ? column.labelAr : column.label}<span className="ms-1 text-xs">({column.max})</span></th>)}<th className="border border-slate-300 px-2 py-2">{rtl ? 'المجموع' : 'Total'}</th><th className="border border-slate-300 px-2 py-2">{rtl ? 'التقدير' : 'Grade'}</th></tr></thead><tbody><tr className="text-center"><td className="border border-slate-300 px-2 py-2 font-semibold">{subject.name}</td>{subject.columns.map((column) => <td key={column.field} className="border border-slate-300 px-2 py-2">{student.marks[subject.id]?.[column.field] ?? 0}</td>)}<td className="border border-slate-300 px-2 py-2 font-bold">{score} / {max}</td><td className="border border-slate-300 px-2 py-2 font-bold">{letterGrade(max ? score / max * 100 : 0)}</td></tr></tbody></table></div></section>;
      })}</div>
      <div className="mt-6 grid gap-3 border-t border-slate-200 pt-5 text-center sm:grid-cols-3"><div><span className="block text-xs font-bold uppercase text-slate-500">{rtl ? 'إجمالي الدرجات' : 'Overall marks'}</span><strong className="mt-1 block text-xl">{earned} / {possible}</strong></div><div><span className="block text-xs font-bold uppercase text-slate-500">{rtl ? 'المعدل' : 'Average'}</span><strong className="mt-1 block text-xl">{percent.toFixed(1)}%</strong></div><div><span className="block text-xs font-bold uppercase text-slate-500">{rtl ? 'التقدير العام' : 'Overall grade'}</span><strong className="mt-1 block text-xl">{letterGrade(percent)}</strong></div></div>
      <footer className="mt-8 border-t border-slate-200 pt-4 text-center text-xs font-medium text-slate-500">{rtl ? 'إشعار درجات للفصل الدراسي المحدد.' : 'Marks notification for the selected semester.'}</footer>
    </article>
    <style jsx global>{`@media print { body { background: white !important; } @page { size: A4 portrait; margin: 12mm; } }`}</style>
  </main>;
}
