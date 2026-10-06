'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';

type GradeOption = { id: string; name: string };
type AdminNote = { id: string; content: string; scope: 'GLOBAL' | 'SPECIFIC'; week: string; grades: GradeOption[]; updatedAt: string };

export default function AdminNotesManager({ grades, selectedWeek, onNotesChange }: { grades: GradeOption[]; selectedWeek: string; onNotesChange: (notes: AdminNote[]) => void }) {
  const t = useTranslations('admin');
  const [notes, setNotes] = useState<AdminNote[]>([]);
  const [content, setContent] = useState('');
  const [week, setWeek] = useState(selectedWeek);
  const [scope, setScope] = useState<'GLOBAL' | 'SPECIFIC'>('GLOBAL');
  const [gradeIds, setGradeIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function refresh() {
    setLoading(true);
    try {
      const response = await fetch('/api/admin/notes');
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setNotes(result.notes ?? []);
      onNotesChange(result.notes ?? []);
    } catch { setError(t('notesLoadError')); }
    finally { setLoading(false); }
  }

  useEffect(() => { void refresh(); }, []);

  function resetForm() {
    setEditingId(null); setContent(''); setWeek(selectedWeek); setScope('GLOBAL'); setGradeIds([]);
  }

  function edit(note: AdminNote) {
    setEditingId(note.id); setContent(note.content); setWeek(note.week); setScope(note.scope); setGradeIds(note.grades.map((grade) => grade.id));
    setError(''); setNotice('');
  }

  async function save(event: FormEvent) {
    event.preventDefault(); setSaving(true); setError(''); setNotice('');
    try {
      const response = await fetch(editingId ? `/api/admin/notes/${editingId}` : '/api/admin/notes', {
        method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, scope, week, gradeIds }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || t('noteSaveError'));
      setNotice(editingId ? t('noteUpdated') : t('noteCreated'));
      resetForm(); await refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : t('noteSaveError')); }
    finally { setSaving(false); }
  }

  async function remove(note: AdminNote) {
    if (!window.confirm(t('confirmNoteDelete'))) return;
    setError(''); setNotice('');
    try {
      const response = await fetch(`/api/admin/notes/${note.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error();
      if (editingId === note.id) resetForm();
      setNotice(t('noteDeleted')); await refresh();
    } catch { setError(t('noteDeleteError')); }
  }

  return <section className="card mt-6 p-5 sm:p-7">
    <div className="mb-6 flex items-start gap-4">
      <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100"><svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></svg></span>
      <div><h2 className="text-xl font-bold text-slate-900">{t('notesManagement')}</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">{t('notesManagementHint')}</p></div>
    </div>
    <form onSubmit={save} className="grid gap-5 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-2 sm:p-6">
      <label className="text-[13px] font-semibold text-slate-700 sm:col-span-2">{t('noteContent')}<textarea required value={content} onChange={(event) => setContent(event.target.value)} rows={3} placeholder={t('notePlaceholder')} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-sm font-normal leading-6 shadow-sm" /></label>
      <fieldset className="sm:col-span-2"><legend className="mb-2 text-[13px] font-semibold text-slate-700">{t('noteScope')}</legend><div className="flex flex-wrap gap-3"><label className="choice"><input type="radio" name="noteScope" checked={scope === 'GLOBAL'} onChange={() => setScope('GLOBAL')} />{t('globalNote')}</label><label className="choice"><input type="radio" name="noteScope" checked={scope === 'SPECIFIC'} onChange={() => setScope('SPECIFIC')} />{t('specificNote')}</label></div></fieldset>
      <label className="text-[13px] font-semibold text-slate-700">{t('noteWeek')}<input required value={week} onChange={(event) => setWeek(event.target.value)} placeholder={t('weekPlaceholder')} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-normal shadow-sm" /></label>
      {scope === 'SPECIFIC' && <fieldset className="sm:col-span-2"><legend className="mb-2 text-[13px] font-semibold text-slate-700">{t('noteGrades')}</legend>{grades.length ? <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">{grades.map((grade) => <label key={grade.id} className="choice"><input type="checkbox" checked={gradeIds.includes(grade.id)} onChange={(event) => setGradeIds((current) => event.target.checked ? [...current, grade.id] : current.filter((id) => id !== grade.id))} />{grade.name}</label>)}</div> : <p className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800">{t('noGrades')}</p>}</fieldset>}
      {(error || notice) && <p role={error ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm font-medium sm:col-span-2 ${error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-900'}`}>{error || notice}</p>}
      <div className="flex flex-wrap gap-2 sm:col-span-2"><button disabled={saving || !content.trim() || !week.trim() || (scope === 'SPECIFIC' && !gradeIds.length)} className="btn-primary">{saving ? t('saving') : editingId ? t('updateNote') : t('saveNote')}</button>{editingId && <button type="button" onClick={resetForm} className="btn-secondary">{t('cancelNoteEdit')}</button>}</div>
    </form>
    <div className="mt-6 space-y-3">{loading ? <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-sm text-slate-500">{t('loadingNotes')}</p> : notes.length ? notes.map((note) => <article key={note.id} className={`flex flex-wrap items-start justify-between gap-4 rounded-xl border bg-white p-4 shadow-sm transition-shadow hover:shadow-md sm:p-5 ${editingId === note.id ? 'border-emerald-600 ring-2 ring-emerald-600/15' : 'border-slate-200'} border-s-4 ${note.scope === 'GLOBAL' ? 'border-s-indigo-400' : 'border-s-emerald-600'}`}><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${note.scope === 'GLOBAL' ? 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-100' : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100'}`}>{note.scope === 'GLOBAL' ? t('globalNote') : t('specificNote')}</span><span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{t('week')} {note.week}</span>{note.scope === 'SPECIFIC' && <span className="text-xs font-medium text-slate-500">{note.grades.map((grade) => grade.name).join(', ')}</span>}</div><p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{note.content}</p></div><div className="flex gap-2"><button type="button" onClick={() => edit(note)} className="btn-secondary !px-3.5 !py-2">{t('editNote')}</button><button type="button" onClick={() => void remove(note)} className="btn-danger !px-3.5 !py-2">{t('deleteNote')}</button></div></article>) : <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 py-10 text-center text-sm text-slate-500">{t('noManagedNotes')}</p>}</div>
  </section>;
}