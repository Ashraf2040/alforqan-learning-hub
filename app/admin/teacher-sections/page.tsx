'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { toast } from 'react-hot-toast';
import { useAdminFeature } from '@/app/admin/useAdminFeature';
import MarkSubmissionPolicySettings from '@/app/admin/mark-submission-policy/MarkSubmissionPolicySettings';

type Sections = { weeklyPlans: boolean; todaysProgress: boolean; studentReports: boolean; studentMarks: boolean; quizMarks: boolean };
const defaults: Sections = { weeklyPlans: true, todaysProgress: true, studentReports: true, studentMarks: true, quizMarks: true };

export default function TeacherSectionsPage() {
  useAdminFeature('teacherSections');
  const locale = useLocale();
  const rtl = locale === 'ar';
  const { status, data } = useSession();
  const router = useRouter();
  const [sections, setSections] = useState(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    if (status === 'authenticated' && !['ADMIN', 'CUSTOM_ADMIN'].includes(data?.user?.role ?? '')) router.replace('/');
    if (status !== 'authenticated' || !['ADMIN', 'CUSTOM_ADMIN'].includes(data?.user?.role ?? '')) return;
    void fetch('/api/admin/teacher-sections', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) throw new Error();
      const result = await response.json();
      setSections({ ...defaults, ...result.sections });
    }).catch(() => toast.error(rtl ? 'تعذر تحميل إعدادات أقسام المعلمين.' : 'Could not load teacher section settings.')).finally(() => setLoading(false));
  }, [status, data?.user?.role, router, rtl]);
  async function save() {
    setSaving(true);
    try {
      const response = await fetch('/api/admin/teacher-sections', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sections }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setSections({ ...defaults, ...result.sections });
      toast.success(rtl ? 'تم حفظ الإعدادات.' : 'Teacher sections saved.');
    } catch (error) { toast.error(error instanceof Error ? error.message : (rtl ? 'تعذر حفظ الإعدادات.' : 'Could not save settings.')); }
    finally { setSaving(false); }
  }
  const items: { key: keyof Sections; title: string; description: string }[] = rtl ? [
    { key: 'studentMarks', title: 'درجات الطلاب', description: 'إظهار أو إخفاء إدارة درجات الطلاب للمعلمين.' },
    { key: 'quizMarks', title: 'درجات الاختبارات القصيرة', description: 'إظهار أو إخفاء قسم درجات الاختبارين للمعلمين.' },
    { key: 'weeklyPlans', title: 'الخطط الأسبوعية', description: 'إظهار أو إخفاء قسم الخطط الأسبوعية للمعلمين.' },
    { key: 'todaysProgress', title: 'إنجاز اليوم', description: 'إظهار أو إخفاء قسم إنجاز اليوم للمعلمين.' },
    { key: 'studentReports', title: 'تقارير الطلاب', description: 'إظهار أو إخفاء تقارير الطلاب للمعلمين.' },
  ] : [
    { key: 'studentMarks', title: 'Students Marks', description: 'Show or hide the student marks section for teachers.' },
    { key: 'quizMarks', title: 'Quiz marks', description: 'Show or hide the two quiz marks section for teachers.' },
    { key: 'weeklyPlans', title: 'Weekly plans', description: 'Show or hide the weekly plans section for teachers.' },
    { key: 'todaysProgress', title: "Today's progress", description: "Show or hide the today's progress section for teachers." },
    { key: 'studentReports', title: 'Student reports', description: 'Show or hide student reports for teachers.' },
  ];
  return <main dir={rtl ? 'rtl' : 'ltr'} className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-7">
    <a href="/admin" className="text-sm font-semibold text-blue-700 hover:text-blue-900">← {rtl ? 'لوحة الإدارة' : 'Admin dashboard'}</a>
    <h1 className="mt-3 text-[28px] font-semibold tracking-tight text-slate-900">{rtl ? 'أقسام صفحة المعلم' : 'Teacher page sections'}</h1>
    <p className="mt-2 text-slate-500">{rtl ? 'اختر الأقسام التي يمكن للمعلمين الوصول إليها.' : 'Choose which sections teachers can access.'}</p>
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="mb-2 text-lg font-semibold text-slate-900">{rtl ? 'إتاحة الأقسام' : 'Section access'}</h2>
      <p className="mb-3 text-sm text-slate-600">{rtl ? 'غيّر إتاحة الأقسام للمعلمين، ثم احفظ تغييرات هذا القسم.' : 'Choose which sections teachers can access, then save these section settings.'}</p>
      <div className="divide-y divide-slate-100">{items.map((item) => <label key={item.key} className="flex min-h-14 cursor-pointer items-center justify-between gap-5 py-3"><span><span className="block text-sm font-semibold text-slate-900">{item.title}</span><span className="mt-1 block text-sm text-slate-600">{item.description}</span></span><button type="button" role="switch" aria-checked={sections[item.key]} aria-label={item.title} disabled={loading || saving} onClick={() => setSections((current) => ({ ...current, [item.key]: !current[item.key] }))} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${sections[item.key] ? 'bg-blue-700' : 'bg-slate-300'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${sections[item.key] ? 'start-6' : 'start-1'}`} /></button></label>)}</div>
      <div className="flex justify-end border-t border-slate-100 pt-4"><button type="button" disabled={loading || saving} onClick={() => void save()} className="min-h-10 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50">{saving ? (rtl ? 'جارٍ الحفظ…' : 'Saving…') : (rtl ? 'حفظ إتاحة الأقسام' : 'Save section access')}</button></div>
    </section>
    <section className="mt-8">
      <MarkSubmissionPolicySettings />
    </section>
  </main>;
}
