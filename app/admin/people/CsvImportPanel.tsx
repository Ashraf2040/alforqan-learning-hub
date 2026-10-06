'use client';

import { useState } from 'react';
import { toast } from 'react-hot-toast';

type Option = { id: string; name: string };
type SchoolClass = Option & { grade: Option | null };
type StudentRow = { name: string; classId: string; grade: string; className: string; row: number };
type TeacherRow = { name: string; username: string; password: string; email: string; academicYear: string; school: string; classIds: string[]; subjectIds: string[]; classes: string; subjects: string; row: number };

function parseCsv(input: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], value = '', quoted = false;
  const text = input.replace(/^\uFEFF/, '');
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (char === '"') {
      if (quoted && text[index + 1] === '"') { value += '"'; index += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(value.trim()); value = ''; }
    else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value.trim()); value = '';
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
    } else value += char;
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted value.');
  row.push(value.trim());
  if (row.some((cell) => cell !== '')) rows.push(row);
  return rows;
}

const norm = (value: string) => value.trim().toLocaleLowerCase();
const gradeNumber = (value: string) => value.trim().match(/^\D*(\d+)/)?.[1] ?? '';
function gradeMatches(classItem: SchoolClass, grade: string) {
  const requestedGrade = norm(grade);
  const assignedGrade = norm(classItem.grade?.name ?? '');
  if (assignedGrade === requestedGrade) return true;

  // Grade names are sometimes stored as "Grade 5" while the roster CSV uses
  // "5". Numeric-prefixed class names (5A, 7B, etc.) also identify their grade
  // and let imports work with older classes whose grade relation is missing or stale.
  const requestedNumber = gradeNumber(grade);
  const classNumber = gradeNumber(classItem.name);
  return Boolean(requestedNumber && classNumber && requestedNumber === classNumber);
}
const headings = (cells: string[]) => cells.map((cell) => norm(cell).replace(/\s+/g, ''));
const button = 'rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50';

export default function CsvImportPanel({ classes, subjects, existingStudents, onImported }: { classes: SchoolClass[]; subjects: Option[]; existingStudents: { name: string; classId: string }[]; onImported: () => Promise<void> }) {
  const [studentFile, setStudentFile] = useState<File | null>(null);
  const [teacherFile, setTeacherFile] = useState<File | null>(null);
  const [studentRows, setStudentRows] = useState<StudentRow[]>([]);
  const [teacherRows, setTeacherRows] = useState<TeacherRow[]>([]);
  const [studentErrors, setStudentErrors] = useState<string[]>([]);
  const [teacherErrors, setTeacherErrors] = useState<string[]>([]);
  const [busyMessage, setBusyMessage] = useState('');

  async function validateStudents() {
    if (!studentFile) { toast.error('Choose a student CSV file first.'); return; }
    setBusyMessage('Validating student CSV…'); setStudentErrors([]); setStudentRows([]);
    try {
      const rows = parseCsv(await studentFile.text());
      if (rows.length < 2) throw new Error('The student CSV has no data rows.');
      if (rows.length > 501) throw new Error('A student CSV can contain at most 500 data rows per import.');
      const columns = headings(rows[0]);
      if (columns.join('|') !== 'name|grade|class') throw new Error('Use the student template headers in this order: name, grade, class.');
      const errors: string[] = [], parsed: StudentRow[] = [], seen = new Set(existingStudents.map((student) => `${student.classId}:${norm(student.name)}`));
      rows.slice(1).forEach((cells, index) => {
        const rowNumber = index + 2;
        if (cells.length !== 3) { errors.push(`Row ${rowNumber}: expected 3 columns.`); return; }
        const [name, grade, className] = cells.map((cell) => cell.trim());
        if (!name || !grade || !className) { errors.push(`Row ${rowNumber}: name, grade, and class are required.`); return; }
        const match = classes.find((item) => norm(item.name) === norm(className) && gradeMatches(item, grade));
        const classGradeNumber = gradeNumber(className);
        const requestedGradeNumber = gradeNumber(grade);
        if (!match && (!classGradeNumber || classGradeNumber !== requestedGradeNumber)) { errors.push(`Row ${rowNumber}: class “${className}” was not found under grade “${grade}”. A missing class must start with its grade number.`); return; }
        const key = `${match?.id ?? `${norm(grade)}:${norm(className)}`}:${norm(name)}`;
        if (seen.has(key)) { errors.push(`Row ${rowNumber}: student “${name}” already exists in class “${className}” or appears more than once in this file.`); return; }
        seen.add(key); parsed.push({ name, grade, className, classId: match?.id ?? '', row: rowNumber });
      });
      setStudentErrors(errors); setStudentRows(errors.length ? [] : parsed);
      if (errors.length) toast.error(`Found ${errors.length} student CSV issue${errors.length === 1 ? '' : 's'}.`);
      else toast.success(`Validated ${parsed.length} student${parsed.length === 1 ? '' : 's'}.`);
    } catch (error) { setStudentErrors([error instanceof Error ? error.message : 'Could not read this CSV.']); }
    finally { setBusyMessage(''); }
  }

  async function validateTeachers() {
    if (!teacherFile) { toast.error('Choose a teacher CSV file first.'); return; }
    setBusyMessage('Validating teacher CSV…'); setTeacherErrors([]); setTeacherRows([]);
    try {
      const rows = parseCsv(await teacherFile.text());
      if (rows.length < 2) throw new Error('The teacher CSV has no data rows.');
      if (rows.length > 501) throw new Error('A teacher CSV can contain at most 500 data rows per import.');
      const columns = headings(rows[0]);
      const expected = 'name|username|password|email|academicyear|school|classes|subjects';
      if (columns.join('|') !== expected) throw new Error('Use the teacher template headers in this order: name, username, password, email, academicYear, school, classes, subjects.');
      const errors: string[] = [], parsed: TeacherRow[] = [], usernames = new Set<string>(), emails = new Set<string>();
      rows.slice(1).forEach((cells, index) => {
        const rowNumber = index + 2;
        if (cells.length !== 8) { errors.push(`Row ${rowNumber}: expected 8 columns.`); return; }
        const [name, usernameRaw, password, emailRaw, academicYear, school, classesRaw, subjectsRaw] = cells.map((cell) => cell.trim());
        const username = usernameRaw.toLowerCase(), email = emailRaw.toLowerCase();
        if (!name || !username || password.length < 8 || !academicYear || !classesRaw || !subjectsRaw) { errors.push(`Row ${rowNumber}: name, username, password (8+ characters), academic year, classes, and subjects are required.`); return; }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { errors.push(`Row ${rowNumber}: email address is invalid.`); return; }
        if (usernames.has(username)) { errors.push(`Row ${rowNumber}: username “${username}” is repeated in this file.`); return; }
        if (email && emails.has(email)) { errors.push(`Row ${rowNumber}: email “${email}” is repeated in this file.`); return; }
        const classNames = classesRaw.split('|').map((value) => value.trim()).filter(Boolean);
        const subjectNames = subjectsRaw.split('|').map((value) => value.trim()).filter(Boolean);
        const assignedClasses = classNames.map((className) => classes.find((item) => norm(item.name) === norm(className)));
        const assignedSubjects = subjectNames.map((subjectName) => subjects.find((item) => norm(item.name) === norm(subjectName)));
        if (!classNames.length || assignedClasses.some((item) => !item)) { errors.push(`Row ${rowNumber}: one or more class names do not match the roster. Separate multiple classes with |.`); return; }
        if (!subjectNames.length || assignedSubjects.some((item) => !item)) { errors.push(`Row ${rowNumber}: one or more subject names do not match the subject list. Separate multiple subjects with |.`); return; }
        usernames.add(username); if (email) emails.add(email);
        parsed.push({ name, username, password, email, academicYear, school, classes: classNames.join(' | '), subjects: subjectNames.join(' | '), classIds: assignedClasses.map((item) => item!.id), subjectIds: assignedSubjects.map((item) => item!.id), row: rowNumber });
      });
      setTeacherErrors(errors); setTeacherRows(errors.length ? [] : parsed);
      if (errors.length) toast.error(`Found ${errors.length} teacher CSV issue${errors.length === 1 ? '' : 's'}.`);
      else toast.success(`Validated ${parsed.length} teacher${parsed.length === 1 ? '' : 's'}.`);
    } catch (error) { setTeacherErrors([error instanceof Error ? error.message : 'Could not read this CSV.']); }
    finally { setBusyMessage(''); }
  }

  async function importRows(kind: 'students' | 'teachers') {
    const payload = kind === 'students' ? studentRows : teacherRows;
    if (!payload.length) return;
    setBusyMessage(`Importing ${kind}…`);
    try {
      const response = await fetch(kind === 'students' ? '/api/admin/students' : '/api/admin/roster', {
        method: kind === 'students' ? 'POST' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kind === 'students' ? { students: studentRows.map(({ name, classId, grade, className }) => ({ name, classId, grade, className })) } : { teachers: teacherRows.map(({ name, username, password, email, academicYear, school, classIds, subjectIds }) => ({ name, username, password, email, academicYear, school, classIds, subjectIds })) }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || `Could not import ${kind}.`);
      toast.success(`Imported ${result.count} ${kind}.`);
      if (kind === 'students') { setStudentRows([]); setStudentFile(null); }
      else { setTeacherRows([]); setTeacherFile(null); }
      await onImported();
    } catch (error) { toast.error(error instanceof Error ? error.message : `Could not import ${kind}.`); }
    finally { setBusyMessage(''); }
  }

  function errorsList(errors: string[]) { return errors.length > 0 && <div className="mt-3 max-h-36 overflow-auto rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"><strong>Validation issues</strong><ul className="mt-1 list-inside list-disc">{errors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul></div>; }

  return <>
    <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"><div className="mb-5"><h2 className="text-xl font-bold">CSV imports</h2><p className="mt-1 text-sm text-slate-500">Download a template, select a file, validate every row, then import. Imports run only when all rows are valid.</p></div><div className="grid gap-5 xl:grid-cols-2">
      <article className="rounded-2xl border border-slate-200 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">Import students</h3><p className="mt-1 text-xs text-slate-500">Required columns: name, grade, class. Missing numbered classes are created under their matching grade.</p></div><a className={button} href="/student-import-template.csv" download>Download template</a></div><input className="mt-4 block w-full text-sm" type="file" accept=".csv,text/csv" onChange={(event) => { setStudentFile(event.target.files?.[0] ?? null); setStudentRows([]); setStudentErrors([]); }} /><div className="mt-4 flex flex-wrap gap-2"><button className={button} type="button" disabled={!studentFile || Boolean(busyMessage)} onClick={() => void validateStudents()}>Validate CSV</button><button className="rounded-xl bg-[#123b36] px-4 py-2 text-sm font-bold text-white disabled:opacity-40" type="button" disabled={!studentRows.length || Boolean(busyMessage)} onClick={() => void importRows('students')}>Import {studentRows.length || ''} students</button></div>{errorsList(studentErrors)}{studentRows.length > 0 && <div className="mt-3 text-sm font-semibold text-emerald-800"><p>{studentRows.length} student rows validated.</p>{new Set(studentRows.filter((row) => !row.classId).map((row) => row.className)).size > 0 && <p className="mt-1 text-xs font-medium">New classes to add: {[...new Set(studentRows.filter((row) => !row.classId).map((row) => row.className))].join(', ')}.</p>}</div>}</article>
      <article className="rounded-2xl border border-slate-200 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="font-bold">Import teachers</h3><p className="mt-1 text-xs text-slate-500">Separate multiple class and subject names with |.</p></div><a className={button} href="/teacher-import-template.csv" download>Download template</a></div><input className="mt-4 block w-full text-sm" type="file" accept=".csv,text/csv" onChange={(event) => { setTeacherFile(event.target.files?.[0] ?? null); setTeacherRows([]); setTeacherErrors([]); }} /><div className="mt-4 flex flex-wrap gap-2"><button className={button} type="button" disabled={!teacherFile || Boolean(busyMessage)} onClick={() => void validateTeachers()}>Validate CSV</button><button className="rounded-xl bg-[#123b36] px-4 py-2 text-sm font-bold text-white disabled:opacity-40" type="button" disabled={!teacherRows.length || Boolean(busyMessage)} onClick={() => void importRows('teachers')}>Import {teacherRows.length || ''} teachers</button></div>{errorsList(teacherErrors)}{teacherRows.length > 0 && <div className="mt-3 max-h-36 overflow-auto rounded-xl bg-emerald-50 p-3 text-sm text-emerald-900"><p className="font-semibold">{teacherRows.length} teacher rows validated. Passwords are not shown in preview.</p><ul className="mt-1 list-inside list-disc">{teacherRows.slice(0, 5).map((item) => <li key={item.username}>{item.name} · {item.username} · {item.classes} · {item.subjects}</li>)}</ul></div>}</article>
    </div></section>
    {busyMessage && <div className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/55 p-4" role="dialog" aria-modal="true" aria-label={busyMessage}><div className="flex w-full max-w-sm items-center gap-4 rounded-2xl bg-white p-6 shadow-2xl"><span className="h-9 w-9 shrink-0 animate-spin rounded-full border-4 border-emerald-100 border-t-emerald-800"/><div><p className="font-bold text-slate-900">{busyMessage}</p><p className="mt-1 text-sm text-slate-500">Please wait while the CSV is processed.</p></div></div></div>}
  </>;
}
