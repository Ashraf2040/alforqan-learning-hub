'use client';

import { FormEvent } from 'react';
import { useLocale } from 'next-intl';

export type EditableTeacher = {
  id: string;
  username: string;
  name: string;
  email?: string | null;
  arabicName?: string | null;
  academicYear?: string | null;
  school?: string | null;
  password?: string;
  classIds: string[];
  subjectIds: string[];
};

type Item = { id: string; name: string };

export default function TeacherAssignmentEditor({
  teacher,
  setTeacher,
  classes,
  subjects,
  pending,
  onClose,
  onSave,
}: {
  teacher: EditableTeacher;
  setTeacher: (teacher: EditableTeacher) => void;
  classes: Item[];
  subjects: Item[];
  pending: boolean;
  onClose: () => void;
  onSave: (teacher: EditableTeacher) => Promise<void>;
}) {
  const rtl = useLocale() === 'ar';
  const tr = (en: string, ar: string) => rtl ? ar : en;
  const assignmentPicker = (title: string, items: Item[], selected: string[], update: (ids: string[]) => void) => {
    const available = items.filter((item) => !selected.includes(item.id));
    const assigned = items.filter((item) => selected.includes(item.id));
    return <div>
      <h4 className="mb-2 text-sm font-semibold text-emerald-950">{title}</h4>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200"><div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{tr('Available', 'المتاح')}</div><div className="max-h-44 overflow-auto">{available.map((item) => <button key={item.id} type="button" onClick={() => update([...selected, item.id])} className="block w-full px-3 py-2 text-start text-sm text-slate-600 hover:bg-slate-50">{item.name}</button>)}{available.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">{rtl ? `لا توجد ${title === tr('Classes', 'الصفوف') ? 'صفوف أخرى' : 'مواد أخرى'}` : `No more ${title.toLowerCase()}`}</div>}</div></div>
        <div className="grid place-items-center"><div className="flex flex-col gap-2"><button type="button" onClick={() => update([...selected, ...available.map((item) => item.id)])} className="rounded-lg bg-[#e0e0e0] px-3 py-1.5 text-xs font-medium text-slate-900 hover:bg-[#999999]">{tr('Add all →', 'إضافة الكل ←')}</button><button type="button" onClick={() => update([])} className="rounded-lg bg-[#e16262] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#e16262]">{tr('← Remove all', '→ إزالة الكل')}</button></div></div>
        <div className="rounded-lg border border-slate-200"><div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{tr('Assigned', 'المسند')}</div><div className="max-h-44 overflow-auto">{assigned.map((item) => <div key={item.id} className="flex items-center justify-between px-3 py-2"><span className="text-sm text-slate-600">{item.name}</span><button type="button" onClick={() => update(selected.filter((id) => id !== item.id))} className="rounded px-2 py-0.5 text-xs text-red-600 hover:bg-red-50">{tr('Remove', 'إزالة')}</button></div>)}{assigned.length === 0 && <div className="px-3 py-2 text-sm text-slate-400">{rtl ? `لم يتم إسناد ${title === tr('Classes', 'الصفوف') ? 'صفوف' : 'مواد'}` : `No ${title.toLowerCase()} assigned`}</div>}</div></div>
      </div>
    </div>;
  };

  const input = 'mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm';
  const label = 'block text-sm font-medium text-slate-700';
  return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/30 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby="edit-teacher-title" className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl ring-1 ring-slate-200">
      <div className="mb-4 flex items-center justify-between"><h3 id="edit-teacher-title" className="text-lg font-semibold text-emerald-950">{tr('Edit Teacher', 'تعديل بيانات المعلم')}</h3><button type="button" onClick={onClose} className="rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100" aria-label={tr('Close', 'إغلاق')}>✕</button></div>
      <form onSubmit={(event: FormEvent) => { event.preventDefault(); void onSave(teacher); }} className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={label}>{tr('Username', 'اسم المستخدم')}<input required value={teacher.username} onChange={(event) => setTeacher({ ...teacher, username: event.target.value })} className={input}/></label>
          <label className={label}>{tr('Name', 'الاسم')}<input required value={teacher.name} onChange={(event) => setTeacher({ ...teacher, name: event.target.value })} className={input}/></label>
          <label className={label}>{tr('Arabic name', 'الاسم بالعربية')}<input value={teacher.arabicName ?? ''} onChange={(event) => setTeacher({ ...teacher, arabicName: event.target.value })} className={input}/></label>
          <label className={label}>{tr('Email', 'البريد الإلكتروني')}<input type="email" value={teacher.email ?? ''} onChange={(event) => setTeacher({ ...teacher, email: event.target.value })} className={input}/></label>
          <label className={label}>{tr('Academic year', 'العام الدراسي')}<input value={teacher.academicYear ?? ''} onChange={(event) => setTeacher({ ...teacher, academicYear: event.target.value })} className={input}/></label>
          <label className={label}>{tr('School', 'المدرسة')}<input value={teacher.school ?? ''} onChange={(event) => setTeacher({ ...teacher, school: event.target.value })} className={input}/></label>
          <label className={`${label} sm:col-span-2`}>{tr('Password', 'كلمة المرور')} <span className="font-normal text-slate-400">{tr('(leave blank to keep current)', '(اتركه فارغاً للإبقاء على كلمة المرور الحالية)')}</span><input type="password" autoComplete="new-password" value={teacher.password ?? ''} onChange={(event) => setTeacher({ ...teacher, password: event.target.value })} className={input}/></label>
        </div>
        {assignmentPicker(tr('Classes', 'الصفوف'), classes, teacher.classIds, (classIds) => setTeacher({ ...teacher, classIds }))}
        {assignmentPicker(tr('Subjects', 'المواد'), subjects, teacher.subjectIds, (subjectIds) => setTeacher({ ...teacher, subjectIds }))}
        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4"><button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-800">{tr('Cancel', 'إلغاء')}</button><button type="submit" disabled={pending} className="rounded-lg bg-[#222831] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{pending ? tr('Saving…', 'جارٍ الحفظ…') : tr('Save Changes', 'حفظ التغييرات')}</button></div>
      </form>
    </div>
  </div>;
}
