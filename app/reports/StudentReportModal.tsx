'use client';
import { FormEvent, PointerEvent, useEffect, useRef } from 'react';

export type ReportDraft = { status: string; ixlPracticeStatus: string; recommendations: string[]; comment: string; quizScore: string; projectScore: string; signature: string };
type Props = { student: { name: string }; className: string; subjectName: string; showIxl: boolean; arabicSubject: boolean; index: number; total: number; editing: boolean; saving: boolean; draft: ReportDraft; onDraftChange: (draft: ReportDraft) => void; onPrevious: () => void; onClose: () => void; onSubmit: (event: FormEvent) => void };
const control = 'mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm';
const label = 'block text-sm font-semibold text-slate-700';
const recommendationKeys = ['continuedGoodWork', 'betterWrittenWork', 'moreSeriousApproach', 'increasedPreparation', 'increasedParticipation', 'additionalHelp'] as const;
const arabicLabels = {
  close: 'إغلاق', status: 'مستوى الأداء', selectStatus: 'اختر مستوى الأداء', excellent: 'ممتاز', good: 'جيد', average: 'متوسط', belowAverage: 'أقل من المتوسط', signature: 'توقيع المعلم', signatureHint: 'ارسم توقيعك، وسيظهر في التقرير المطبوع.', clearSignature: 'مسح التوقيع', preview: 'معاينة التقرير',
  recommendations: 'التوصيات', continuedGoodWork: 'استمر في العمل الجيد', betterWrittenWork: 'تحسين الأعمال التحريرية', moreSeriousApproach: 'مزيد من الجدية', increasedPreparation: 'زيادة التحضير والدراسة', increasedParticipation: 'زيادة المشاركة الصفية', additionalHelp: 'يحتاج إلى مساعدة إضافية',
  comment: 'ملاحظة المعلم', commentPlaceholder: 'أضف ملاحظة للطالب', quiz: 'درجة الاختبار القصير', project: 'درجة المشروع', ixlPractices: 'تدريبات IXL', notRecorded: 'غير مسجل', complete: 'مكتمل', incomplete: 'غير مكتمل', missing: 'مفقود',
  editingReport: 'تعديل تقرير محفوظ', newReport: 'تقرير جديد', reportTitle: 'تقرير التقدم', previousStudent: 'الطالب السابق', saving: 'جارٍ الحفظ…', saveNext: 'حفظ والانتقال للطالب التالي', saveFinish: 'حفظ وإنهاء الفصل',
} as const;
const englishLabels = {
  close: 'Close', status: 'Present status', selectStatus: 'Select status', excellent: 'Excellent', good: 'Good', average: 'Average', belowAverage: 'Below average', signature: 'Teacher signature', signatureHint: 'Draw your signature. It will appear on the printed report.', clearSignature: 'Clear signature', preview: 'Report preview',
  recommendations: 'Recommendations', continuedGoodWork: 'Continued good work', betterWrittenWork: 'Better written work', moreSeriousApproach: 'More serious approach', increasedPreparation: 'Increased preparation and study', increasedParticipation: 'Increased class participation', additionalHelp: 'Additional help needed',
  comment: 'Teacher note', commentPlaceholder: 'Add a note for this student', quiz: 'Quiz mark', project: 'Project mark', ixlPractices: 'IXL Practices', notRecorded: 'Not recorded', complete: 'Complete', incomplete: 'Incomplete', missing: 'Missing',
  editingReport: 'Editing saved report', newReport: 'New report', reportTitle: 'Progress report', previousStudent: 'Previous student', saving: 'Saving…', saveNext: 'Save & next student', saveFinish: 'Save & finish class',
} as const;

export function StudentReportModal({ student, className, subjectName, showIxl, arabicSubject, index, total, editing, saving, draft, onDraftChange, onPrevious, onClose, onSubmit }: Props) {
  const text = (key: keyof typeof arabicLabels) => arabicSubject ? arabicLabels[key] : englishLabels[key];
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasDrawn = useRef(false);
  const currentIndex = useRef(index);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (currentIndex.current !== index) { currentIndex.current = index; hasDrawn.current = false; }
    if (!canvas || !draft.signature) return;
    if (hasDrawn.current) return;
    const image = new Image();
    image.onload = () => canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.src = draft.signature;
  }, [draft.signature, index]);
  function startDrawing(event: PointerEvent<HTMLCanvasElement>) {
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const context = canvas.getContext('2d');
    if (!context) return;
    if (!hasDrawn.current) { context.clearRect(0, 0, canvas.width, canvas.height); hasDrawn.current = true; }
    canvas.setPointerCapture(event.pointerId);
    drawing.current = true;
    context.beginPath();
    context.moveTo((event.clientX - rect.left) * canvas.width / rect.width, (event.clientY - rect.top) * canvas.height / rect.height);
  }
  function continueDrawing(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const canvas = event.currentTarget;
    const rect = canvas.getBoundingClientRect();
    const context = canvas.getContext('2d');
    if (!context) return;
    context.lineWidth = 3;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = '#18334b';
    context.lineTo((event.clientX - rect.left) * canvas.width / rect.width, (event.clientY - rect.top) * canvas.height / rect.height);
    context.stroke();
  }
  function stopDrawing(event: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    drawing.current = false;
    event.currentTarget.releasePointerCapture(event.pointerId);
    onDraftChange({ ...draft, signature: event.currentTarget.toDataURL('image/png') });
  }
  function clearSignature() {
    hasDrawn.current = true;
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
    onDraftChange({ ...draft, signature: '' });
  }
  function toggleRecommendation(value: string) {
    onDraftChange({ ...draft, recommendations: draft.recommendations.includes(value) ? draft.recommendations.filter((item) => item !== value) : [...draft.recommendations, value] });
  }
  return <div dir={arabicSubject ? 'rtl' : 'ltr'} className={`no-print fixed inset-0 z-[80] grid place-items-center bg-slate-950/60 p-3 backdrop-blur-sm sm:p-6 ${arabicSubject ? 'report-arabic' : ''}`} onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) onClose(); }}>
    <section role="dialog" aria-modal="true" aria-labelledby="student-report-title" className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
      <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur sm:px-7"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-800">{className} · {subjectName}</p><h2 id="student-report-title" className="mt-1 text-xl font-black text-slate-900">{student.name}</h2><p className="mt-1 text-sm text-slate-500">{arabicSubject ? `الطالب ${index + 1} من ${total}` : `Student ${index + 1} of ${total}`} · {editing ? text('editingReport') : text('newReport')}</p></div><button type="button" disabled={saving} onClick={onClose} aria-label={text('close')} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-slate-200 text-lg text-slate-500 hover:bg-slate-50 disabled:opacity-50">×</button></header>
      <form onSubmit={onSubmit} className="space-y-5 p-5 sm:p-7">
        <label className={label}>{text('status')}<select required className={control} value={draft.status} onChange={(event) => onDraftChange({ ...draft, status: event.target.value })}><option value="">{text('selectStatus')}</option><option value="Excellent">{text('excellent')}</option><option value="Good">{text('good')}</option><option value="Average">{text('average')}</option><option value="Below Average">{text('belowAverage')}</option></select></label>
        {showIxl && <label className={label}>{text('ixlPractices')}<select className={control} value={draft.ixlPracticeStatus} onChange={(event) => onDraftChange({ ...draft, ixlPracticeStatus: event.target.value })}><option value="">{text('notRecorded')}</option><option value="Complete">{text('complete')}</option><option value="Incomplete">{text('incomplete')}</option><option value="Missing">{text('missing')}</option></select></label>}
        <fieldset><legend className={label}>{text('recommendations')}</legend><div className="mt-2 grid gap-2 sm:grid-cols-2">{recommendationKeys.map((key) => { const value = text(key); return <label key={key} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5 text-sm font-medium text-slate-700"><input type="checkbox" checked={draft.recommendations.includes(value)} onChange={() => toggleRecommendation(value)} />{value}</label>; })}</div></fieldset>
        <label className={label}>{text('comment')}<textarea dir={arabicSubject ? 'rtl' : 'auto'} className={control} rows={3} value={draft.comment} onChange={(event) => onDraftChange({ ...draft, comment: event.target.value })} placeholder={text('commentPlaceholder')} /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className={label}>{text('quiz')}<input dir="ltr" className={control} type="number" min="0" max="100" value={draft.quizScore} onChange={(event) => onDraftChange({ ...draft, quizScore: event.target.value })} /></label><label className={label}>{text('project')}<input dir="ltr" className={control} type="number" min="0" max="100" value={draft.projectScore} onChange={(event) => onDraftChange({ ...draft, projectScore: event.target.value })} /></label></div>
        <section aria-label={text('signature')} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex items-start justify-between gap-3"><div><h3 className="text-sm font-bold text-slate-800">{text('signature')}</h3><p className="mt-1 text-xs text-slate-500">{text('signatureHint')}</p></div><button type="button" onClick={clearSignature} className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600">{text('clearSignature')}</button></div>
          <canvas key={index} ref={canvasRef} width={640} height={180} aria-label={text('signature')} className="mt-3 h-28 w-full touch-none rounded-xl border border-dashed border-slate-300 bg-white" onPointerDown={startDrawing} onPointerMove={continueDrawing} onPointerUp={stopDrawing} onPointerCancel={stopDrawing} />
          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3"><p className="text-[10px] font-black uppercase tracking-wide text-emerald-800">{text('preview')}</p><div className="mt-2 grid grid-cols-[1fr_auto] gap-3 border-t border-slate-100 pt-2 text-xs text-slate-600"><div><strong className="block text-slate-900">{student.name}</strong><span>{className} · {subjectName}</span><p className="mt-1">{text('status')}: {draft.status || '—'}{draft.comment && <><br />{draft.comment}</>}</p></div><div className="min-w-28 text-center"><span className="block">{text('signature')}</span>{draft.signature ? <img src={draft.signature} alt={text('signature')} className="mx-auto h-10 w-28 object-contain" /> : <div className="mt-6 border-b border-slate-300" />}</div></div></div>
        </section>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><button type="button" disabled={index === 0 || saving} onClick={onPrevious} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 disabled:opacity-40">{text('previousStudent')}</button><div className="flex gap-2"><button type="button" disabled={saving} onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">{text('close')}</button><button type="submit" disabled={saving} className="rounded-xl bg-[#123b36] px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">{saving ? text('saving') : index + 1 < total ? text('saveNext') : text('saveFinish')}</button></div></div>
      </form>
    </section>
  </div>;
}
