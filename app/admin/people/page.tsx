'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import CsvImportPanel from './CsvImportPanel';
import TeacherAssignmentEditor, { type EditableTeacher } from './TeacherAssignmentEditor';

type Option = { id: string; name: string };
type ClassChoice = Option & { grade: Option | null };
type Payload = { teachers: (Option & { username: string; email: string | null; arabicName: string | null; academicYear: string | null; school: string | null; classes: Option[]; classTeacherAssignments: { classId: string }[]; subjects: Option[]; subjectTeacherAssignments: { subjectId: string }[] })[]; classes: ClassChoice[]; subjects: Option[] };
type ManagedStudent = { id: string; name: string; classId: string; class: Option & { grade: Option | null } };
const field = 'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm';
const label = 'block text-sm font-semibold text-slate-700';
const action = 'inline-flex items-center justify-center rounded-xl bg-[#123b36] px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#17635a] disabled:cursor-not-allowed disabled:opacity-50';
const card = 'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm';

export default function PeoplePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [data, setData] = useState<Payload>({ teachers: [], classes: [], subjects: [] });
  const [busy, setBusy] = useState(false);
  const [students, setStudents] = useState<ManagedStudent[]>([]);
  const [studentQuery, setStudentQuery] = useState('');
  const [studentClassFilter, setStudentClassFilter] = useState('');
  const [editingTeacher, setEditingTeacher] = useState<EditableTeacher | null>(null);
  const [editId, setEditId] = useState('');
  const [editStudent, setEditStudent] = useState({ name: '', classId: '' });
  const [teacher, setTeacher] = useState({ name: '', arabicName: '', email: '', academicYear: '2026-2027', school: '', username: '', password: '', classIds: [] as string[], subjectIds: [] as string[] });
  const [student, setStudent] = useState({ name: '', classId: '' });

  async function load() {
    const response = await fetch('/api/admin/roster');
    if (!response.ok) throw new Error();
    setData(await response.json());
  }

  async function loadStudents() {
    const response = await fetch('/api/admin/students');
    if (!response.ok) throw new Error();
    setStudents((await response.json()).students);
  }

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
    if (status === 'authenticated' && session?.user.role !== 'ADMIN') router.replace('/teacher');
    if (status === 'authenticated' && session?.user.role === 'ADMIN') {
      void Promise.all([load(), loadStudents()]).catch(() => toast.error('Could not load school data.'));
    }
  }, [status, session, router]);

  async function submitTeacher(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch('/api/admin/roster', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(teacher) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      toast.success('Teacher account created.');
      setTeacher({ name: '', arabicName: '', email: '', academicYear: '2026-2027', school: '', username: '', password: '', classIds: [], subjectIds: [] });
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not create teacher.'); }
    finally { setBusy(false); }
  }

  async function submitStudent(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch('/api/admin/roster', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(student) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      toast.success('Student added to the class.');
      setStudent({ name: '', classId: '' });
      await loadStudents();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not create student.'); }
    finally { setBusy(false); }
  }

  async function saveTeacher(updated: EditableTeacher) {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/teachers/${encodeURIComponent(updated.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updated) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      toast.success('Teacher details and assignments updated.');
      setEditingTeacher(null);
      await load();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update teacher.'); }
    finally { setBusy(false); }
  }

  function startEdit(item: ManagedStudent) { setEditId(item.id); setEditStudent({ name: item.name, classId: item.classId }); }

  async function saveStudent(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch('/api/admin/students', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...editStudent, id: editId }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      toast.success('Student details updated.');
      setEditId('');
      await loadStudents();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update student.'); }
    finally { setBusy(false); }
  }

  async function removeStudent(item: ManagedStudent) {
    if (!window.confirm(`Remove ${item.name} and their reports?`)) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/students?id=${encodeURIComponent(item.id)}`, { method: 'DELETE' });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error);
      toast.success('Student removed.');
      await loadStudents();
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not remove student.'); }
    finally { setBusy(false); }
  }

  const toggle = (key: 'classIds' | 'subjectIds', id: string) => setTeacher((old) => ({ ...old, [key]: old[key].includes(id) ? old[key].filter((value) => value !== id) : [...old[key], id] }));
  const visibleStudents = useMemo(() => students.filter((item) => item.name.toLocaleLowerCase().includes(studentQuery.trim().toLocaleLowerCase()) && (!studentClassFilter || item.classId === studentClassFilter)), [students, studentQuery, studentClassFilter]);

  return <main className="w-full px-4 py-7 sm:px-7 xl:px-10">
    <header className="mb-6 overflow-hidden rounded-3xl bg-gradient-to-br from-[#0d302c] via-[#164e46] to-[#23796d] p-6 text-white shadow-lg sm:p-8">
      <a href="/admin" className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-100 hover:text-white">← Admin dashboard</a>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-200">School administration</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">People &amp; access</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-emerald-50/85">Set up teacher access, place students in classes, and keep the school roster current.</p></div><nav aria-label="Page sections" className="flex flex-wrap gap-2 text-sm">{[['#create-teacher', 'Teachers'], ['#create-student', 'Students'], ['#csv-imports', 'CSV imports'], ['#student-roster', 'Roster']].map(([href, text]) => <a key={href} href={href} className="rounded-full border border-white/20 bg-white/10 px-3.5 py-2 font-semibold text-white backdrop-blur hover:bg-white/20">{text}</a>)}</nav></div>
      <div className="mt-7 grid grid-cols-2 gap-3 xl:grid-cols-4">{[['Teachers', data.teachers.length], ['Students', students.length], ['Classes', data.classes.length], ['Subjects', data.subjects.length]].map(([title, count]) => <div key={String(title)} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur"><p className="text-xs font-semibold text-emerald-100">{title}</p><p className="mt-1 text-2xl font-black">{count}</p></div>)}</div>
    </header>

    <div className="grid scroll-mt-5 gap-6 xl:grid-cols-2">
      <form id="create-teacher" onSubmit={submitTeacher} className={`${card} scroll-mt-5 space-y-5`}>
        <div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-50 text-lg text-emerald-900">♙</span><div><h2 className="text-xl font-bold text-slate-900">Create teacher</h2><p className="mt-1 text-sm text-slate-500">Set up sign-in details and select the teacher’s classes and subjects.</p></div></div>
        <div className="grid gap-4 md:grid-cols-2"><label className={label}>Full name<input className={`${field} mt-2`} required value={teacher.name} onChange={(e) => setTeacher({ ...teacher, name: e.target.value })}/></label><label className={label}>Arabic name<input className={`${field} mt-2`} value={teacher.arabicName} onChange={(e) => setTeacher({ ...teacher, arabicName: e.target.value })}/></label><label className={label}>Email<input className={`${field} mt-2`} type="email" value={teacher.email} onChange={(e) => setTeacher({ ...teacher, email: e.target.value })}/></label><label className={label}>Academic year<input className={`${field} mt-2`} required value={teacher.academicYear} onChange={(e) => setTeacher({ ...teacher, academicYear: e.target.value })}/></label><label className={label}>School<input className={`${field} mt-2`} value={teacher.school} onChange={(e) => setTeacher({ ...teacher, school: e.target.value })}/></label><label className={label}>Username<input className={`${field} mt-2`} required autoComplete="username" value={teacher.username} onChange={(e) => setTeacher({ ...teacher, username: e.target.value })}/></label><label className={`${label} md:col-span-2`}>Temporary password<input className={`${field} mt-2`} required minLength={8} type="password" autoComplete="new-password" value={teacher.password} onChange={(e) => setTeacher({ ...teacher, password: e.target.value })}/></label></div>
        <fieldset><legend className={label}>Assigned classes</legend><div className="mt-2 grid max-h-44 gap-2 overflow-y-auto rounded-xl border border-slate-100 p-2 sm:grid-cols-2">{data.classes.map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm hover:bg-emerald-50"><input type="checkbox" checked={teacher.classIds.includes(item.id)} onChange={() => toggle('classIds', item.id)}/><span>{item.name}</span></label>)}</div></fieldset>
        <fieldset><legend className={label}>Assigned subjects</legend><div className="mt-2 grid max-h-44 gap-2 overflow-y-auto rounded-xl border border-slate-100 p-2 sm:grid-cols-2">{data.subjects.map((item) => <label key={item.id} className="flex cursor-pointer items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm hover:bg-emerald-50"><input type="checkbox" checked={teacher.subjectIds.includes(item.id)} onChange={() => toggle('subjectIds', item.id)}/><span>{item.name}</span></label>)}</div></fieldset>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4"><p className="text-xs text-slate-500">{teacher.classIds.length} classes · {teacher.subjectIds.length} subjects selected</p><button className={action} disabled={busy}>{busy ? 'Saving…' : 'Create teacher account'}</button></div>
      </form>

      <div className="space-y-6">
        <form id="create-student" onSubmit={submitStudent} className={`${card} scroll-mt-5 space-y-5`}><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-50 text-lg text-amber-900">♧</span><div><h2 className="text-xl font-bold text-slate-900">Create student</h2><p className="mt-1 text-sm text-slate-500">Add a student by name and class. Their grade follows the class assignment.</p></div></div><div className="grid gap-4 md:grid-cols-2"><label className={label}>Student name<input className={`${field} mt-2`} required value={student.name} onChange={(e) => setStudent({ ...student, name: e.target.value })}/></label><label className={label}>Grade and class<select className={`${field} mt-2`} required value={student.classId} onChange={(e) => setStudent({ ...student, classId: e.target.value })}><option value="">Choose class</option>{data.classes.map((item) => <option key={item.id} value={item.id}>{item.grade?.name ?? 'No grade'} · {item.name}</option>)}</select></label></div><div className="flex justify-end border-t border-slate-100 pt-4"><button className={action} disabled={busy}>{busy ? 'Saving…' : 'Add student'}</button></div></form>

        <details className={`${card} group p-0`}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl p-5 outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 sm:p-6"><span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-lg text-slate-700">☷</span><span><span className="block font-bold text-slate-900">Teacher assignments</span><span className="mt-0.5 block text-sm text-slate-500">{data.teachers.length} teacher{data.teachers.length === 1 ? '' : 's'} · view assigned classes and subjects</span></span></span><span aria-hidden="true" className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-slate-200 text-slate-600 transition-transform group-open:rotate-180">⌄</span></summary>
          <div className="divide-y divide-slate-100 border-t border-slate-100 px-5 sm:px-6">{data.teachers.map((item) => <article key={item.id} className="grid gap-3 py-4 sm:grid-cols-[minmax(180px,0.75fr)_1fr_1fr_auto] sm:items-center"><div><p className="font-semibold text-slate-900">{item.name}</p><p className="text-xs text-slate-500">@{item.username}</p></div><div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Classes</p><p className="mt-1 text-sm text-slate-700">{[...new Map([...item.classes, ...item.classTeacherAssignments.map((assignment) => data.classes.find((schoolClass) => schoolClass.id === assignment.classId)).filter((schoolClass): schoolClass is ClassChoice => Boolean(schoolClass))].map((value) => [value.id, value])).values()].map((x) => x.name).join(', ') || 'No classes assigned'}</p></div><div><p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Subjects</p><p className="mt-1 text-sm text-slate-700">{[...new Map([...item.subjects, ...item.subjectTeacherAssignments.map((assignment) => data.subjects.find((subject) => subject.id === assignment.subjectId)).filter((subject): subject is Option => Boolean(subject))].map((value) => [value.id, value])).values()].map((x) => x.name).join(', ') || 'No subjects assigned'}</p></div><button type="button" disabled={busy} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50" onClick={() => setEditingTeacher({ id: item.id, username: item.username, name: item.name, email: item.email, arabicName: item.arabicName, academicYear: item.academicYear, school: item.school, password: '', classIds: [...new Set([...item.classes.map((x) => x.id), ...item.classTeacherAssignments.map((x) => x.classId)])], subjectIds: [...new Set([...item.subjects.map((x) => x.id), ...item.subjectTeacherAssignments.map((x) => x.subjectId)])] })}>Edit</button></article>)}{data.teachers.length === 0 && <p className="py-5 text-sm text-slate-500">No teachers have been created yet.</p>}</div>
        </details>
      </div>
    </div>

    <div id="csv-imports" className="scroll-mt-5"><CsvImportPanel classes={data.classes} subjects={data.subjects} existingStudents={students} onImported={async () => { await Promise.all([loadStudents(), load()]); }}/></div>

    <details id="student-roster" className={`${card} group mt-7 scroll-mt-5 p-0`}><summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-2xl p-5 outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 sm:p-6"><span className="flex items-center gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-lg text-emerald-900">☷</span><span><span className="block text-xs font-bold uppercase tracking-[0.16em] text-emerald-800">Student directory</span><span className="mt-1 block font-bold text-slate-900">Manage students</span><span className="mt-0.5 block text-sm text-slate-500">{students.length} students · update names or class assignments</span></span></span><span className="flex items-center gap-3"><span className="hidden text-sm font-semibold text-slate-500 sm:inline">View roster</span><span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-full border border-slate-200 text-slate-600 transition-transform group-open:rotate-180">⌄</span></span></summary><div className="border-t border-slate-100 p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-4"><p className="text-sm text-slate-500">Update a student’s name or move them to another class.</p><button type="button" className="rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50" onClick={() => void loadStudents().catch(() => toast.error('Could not refresh students.'))}>Refresh roster</button></div>
      <div className="mt-5 grid gap-3 rounded-2xl bg-slate-50 p-4 md:grid-cols-[minmax(220px,1fr)_minmax(200px,0.6fr)_auto] md:items-end"><label className={label}>Search by name<input className={`${field} mt-2`} value={studentQuery} onChange={(event) => setStudentQuery(event.target.value)} placeholder="Type a student name"/></label><label className={label}>Filter by class<select className={`${field} mt-2`} value={studentClassFilter} onChange={(event) => setStudentClassFilter(event.target.value)}><option value="">All classes</option>{data.classes.map((item) => <option key={item.id} value={item.id}>{item.grade?.name ?? 'No grade'} · {item.name}</option>)}</select></label><p className="pb-2 text-sm font-semibold text-slate-500">Showing {visibleStudents.length} of {students.length}</p></div>
      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200"><table className="w-full min-w-[680px] text-left text-sm"><thead className="bg-slate-50"><tr className="border-b text-xs uppercase tracking-wide text-slate-500"><th className="px-4 py-3">Student name</th><th className="px-4 py-3">Grade</th><th className="px-4 py-3">Class</th><th className="px-4 py-3">Actions</th></tr></thead><tbody>{visibleStudents.map((item) => <tr key={item.id} className="border-b border-slate-100 align-top last:border-0 hover:bg-emerald-50/30">{editId === item.id ? <td colSpan={4} className="p-3"><form onSubmit={saveStudent} className="grid gap-3 md:grid-cols-[1fr_1fr_auto]"><input className={field} required aria-label="Student name" value={editStudent.name} onChange={(e) => setEditStudent({ ...editStudent, name: e.target.value })}/><select className={field} aria-label="Class and grade" required value={editStudent.classId} onChange={(e) => setEditStudent({ ...editStudent, classId: e.target.value })}>{data.classes.map((c) => <option key={c.id} value={c.id}>{c.grade?.name ?? 'No grade'} · {c.name}</option>)}</select><div className="flex gap-2"><button className={action} disabled={busy}>Save</button><button type="button" className="rounded-xl border border-slate-200 px-4 py-2 text-sm" onClick={() => setEditId('')}>Cancel</button></div></form></td> : <><td className="px-4 py-3.5 font-semibold text-slate-900">{item.name}</td><td className="px-4 py-3.5 text-slate-700">{item.class.grade?.name ?? '—'}</td><td className="px-4 py-3.5 text-slate-700">{item.class.name}</td><td className="px-4 py-3.5"><div className="flex gap-2"><button type="button" className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-white" onClick={() => startEdit(item)}>Edit</button><button type="button" disabled={busy} className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50" onClick={() => void removeStudent(item)}>Remove</button></div></td></>}</tr>)}{visibleStudents.length === 0 && <tr><td colSpan={4} className="px-4 py-12 text-center text-slate-500">{students.length ? 'No students match your search.' : 'No students added yet.'}</td></tr>}</tbody></table></div>
    </div></details>
    {editingTeacher && <TeacherAssignmentEditor teacher={editingTeacher} setTeacher={setEditingTeacher} classes={data.classes} subjects={data.subjects} pending={busy} onClose={() => setEditingTeacher(null)} onSave={saveTeacher}/>}
  </main>;
}
