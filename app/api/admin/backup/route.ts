import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasAdminFeature } from '@/lib/custom-admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const groups = ['people', 'marks', 'reports', 'planning', 'schedules', 'settings'] as const;
type BackupGroup = (typeof groups)[number];

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !(await hasAdminFeature(session.user, 'dataBackup'))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  const selected = new Set(request.nextUrl.searchParams.getAll('group').filter((value): value is BackupGroup => groups.includes(value as BackupGroup)));
  if (selected.size === 0) return NextResponse.json({ error: 'Select at least one data group to export.' }, { status: 400 });

  const gradeId = request.nextUrl.searchParams.get('gradeId') || '';
  const classId = request.nextUrl.searchParams.get('classId') || '';
  const academicYear = request.nextUrl.searchParams.get('academicYear') || '';
  const term = request.nextUrl.searchParams.get('term') || '';
  let scopedClassIds: string[] | undefined;
  if (gradeId || classId) {
    const classes = await prisma.class.findMany({ where: gradeId ? { gradeId } : undefined, select: { id: true } });
    scopedClassIds = classes.map((item) => item.id);
    if (classId) {
      if (!scopedClassIds.includes(classId)) return NextResponse.json({ error: 'The selected class does not belong to the selected grade.' }, { status: 400 });
      scopedClassIds = [classId];
    }
    if (!scopedClassIds.length) return NextResponse.json({ error: 'No classes match the selected filters.' }, { status: 400 });
  }
  const marksWhere = {
    ...(scopedClassIds ? { classId: { in: scopedClassIds } } : {}),
    ...(academicYear ? { academicYear } : {}),
    ...(term ? { term } : {}),
  };

  try {
    const data = await prisma.$transaction(async (tx) => {
      const [users, appSettings, classes, subjects, classTeachers, classSubjects, subjectTeachers, marks, managedStudentMarks, managedMarkSchemes, managedQuizSchemes, managedQuizMarks, students, studentReports, lessons, schedules, scheduleItems, grades, gradeSubjects, weeklyPlans, weeklyPlanItems, weeklyPlannerSubmissions, weeklyPlannerItems, adminPlannerNotes, adminWeeklyPlans, adminWeeklyPlanItems] = await Promise.all([
        selected.has('people') || selected.has('marks') ? tx.user.findMany({ select: { id: true, name: true, username: true } }) : Promise.resolve([]),
        selected.has('settings') ? tx.appSetting.findMany() : Promise.resolve([]),
        selected.has('people') || selected.has('marks') ? tx.class.findMany({ select: { id: true, name: true, gradeId: true } }) : Promise.resolve([]),
        selected.has('people') || selected.has('marks') ? tx.subject.findMany({ select: { id: true, name: true } }) : Promise.resolve([]),
        selected.has('people') ? tx.classTeacher.findMany() : Promise.resolve([]),
        selected.has('people') ? tx.classSubject.findMany() : Promise.resolve([]),
        selected.has('people') ? tx.subjectTeacher.findMany() : Promise.resolve([]),
        selected.has('marks') && !academicYear && !term ? tx.mark.findMany(scopedClassIds ? { where: { student: { classId: { in: scopedClassIds } } } } : undefined) : Promise.resolve([]),
        selected.has('marks') ? tx.managedStudentMark.findMany({ where: marksWhere }) : Promise.resolve([]),
        selected.has('marks') ? tx.managedMarkScheme.findMany() : Promise.resolve([]),
        selected.has('marks') ? tx.managedQuizScheme.findMany() : Promise.resolve([]),
        selected.has('marks') ? tx.managedQuizMark.findMany({ where: marksWhere }) : Promise.resolve([]),
        selected.has('people') || selected.has('marks') ? tx.student.findMany({ select: { id: true, name: true, classId: true } }) : Promise.resolve([]),
        selected.has('reports') ? tx.studentReport.findMany() : Promise.resolve([]),
        selected.has('planning') ? tx.lesson.findMany() : Promise.resolve([]),
        selected.has('schedules') ? tx.schedule.findMany() : Promise.resolve([]),
        selected.has('schedules') ? tx.scheduleItem.findMany() : Promise.resolve([]),
        selected.has('people') ? tx.grade.findMany() : Promise.resolve([]),
        selected.has('people') ? tx.gradeSubject.findMany() : Promise.resolve([]),
        selected.has('planning') ? tx.weeklyPlan.findMany() : Promise.resolve([]),
        selected.has('planning') ? tx.weeklyPlanItem.findMany() : Promise.resolve([]),
        selected.has('planning') ? tx.weeklyPlannerSubmission.findMany() : Promise.resolve([]),
        selected.has('planning') ? tx.weeklyPlannerItem.findMany() : Promise.resolve([]),
        selected.has('planning') ? tx.adminPlannerNote.findMany() : Promise.resolve([]),
        selected.has('planning') ? tx.adminWeeklyPlan.findMany() : Promise.resolve([]),
        selected.has('planning') ? tx.adminWeeklyPlanItem.findMany() : Promise.resolve([]),
      ]);

      return {
        users, appSettings, classes, subjects, classTeachers, classSubjects, subjectTeachers, marks,
        managedStudentMarks, managedMarkSchemes, managedQuizSchemes, managedQuizMarks, students,
        studentReports, lessons, schedules, scheduleItems, grades, gradeSubjects, weeklyPlans,
        weeklyPlanItems, weeklyPlannerSubmissions, weeklyPlannerItems, adminPlannerNotes,
        adminWeeklyPlans, adminWeeklyPlanItems,
      };
    }, { isolationLevel: 'RepeatableRead', maxWait: 10000, timeout: 30000 });

    const timestamp = new Date().toISOString();
    const tableGroups: Record<BackupGroup, string[]> = {
      people: ['users', 'classes', 'subjects', 'classTeachers', 'classSubjects', 'subjectTeachers', 'students', 'grades', 'gradeSubjects'],
      marks: ['marks', 'managedStudentMarks', 'managedMarkSchemes', 'managedQuizSchemes', 'managedQuizMarks'],
      reports: ['studentReports'],
      planning: ['lessons', 'weeklyPlans', 'weeklyPlanItems', 'weeklyPlannerSubmissions', 'weeklyPlannerItems', 'adminPlannerNotes', 'adminWeeklyPlans', 'adminWeeklyPlanItems'],
      schedules: ['schedules', 'scheduleItems'],
      settings: ['appSettings'],
    };
    if (selected.has('marks') && (scopedClassIds || academicYear || term)) {
      const relevantSubjectIds = new Set([
        ...data.managedStudentMarks.map((item) => item.subjectId),
        ...data.managedQuizMarks.map((item) => item.subjectId),
        ...data.marks.map((item) => item.subjectId),
      ]);
      data.managedMarkSchemes = data.managedMarkSchemes.filter((scheme) => relevantSubjectIds.has(scheme.subjectId));
      data.managedQuizSchemes = data.managedQuizSchemes.filter((scheme) => relevantSubjectIds.has(scheme.subjectId));
    }
    const usersById = new Map(data.users.map((user) => [user.id, user]));
    const classesById = new Map(data.classes.map((item) => [item.id, item]));
    const subjectsById = new Map(data.subjects.map((item) => [item.id, item]));
    const studentsById = new Map(data.students.map((item) => [item.id, item]));
    const schedulesById = new Map(data.schedules.map((item) => [item.id, item]));
    const weeklyPlansById = new Map(data.weeklyPlans.map((item) => [item.id, item]));
    const submissionsById = new Map(data.weeklyPlannerSubmissions.map((item) => [item.id, item]));
    const adminPlansById = new Map(data.adminWeeklyPlans.map((item) => [item.id, item]));
    const addNames = (record: Record<string, unknown>) => {
      const enriched = { ...record };
      const student = typeof record.studentId === 'string' ? studentsById.get(record.studentId) : undefined;
      const schoolClass = typeof record.classId === 'string' ? classesById.get(record.classId) : student ? classesById.get(student.classId) : undefined;
      const subject = typeof record.subjectId === 'string' ? subjectsById.get(record.subjectId) : undefined;
      const teacherId = typeof record.teacherId === 'string' ? record.teacherId : typeof record.updatedById === 'string' ? record.updatedById : typeof record.createdBy === 'string' ? record.createdBy : undefined;
      if (student) enriched.studentName = student.name;
      if (schoolClass) enriched.className = schoolClass.name;
      if (subject) enriched.subjectName = subject.name;
      if (teacherId) enriched.teacherName = usersById.get(teacherId)?.name ?? '';
      if (typeof record.scheduleId === 'string') enriched.scheduleName = schedulesById.get(record.scheduleId)?.name ?? '';
      if (typeof record.weeklyPlanId === 'string') enriched.week = weeklyPlansById.get(record.weeklyPlanId)?.week ?? '';
      if (typeof record.submissionId === 'string') enriched.submissionWeek = submissionsById.get(record.submissionId)?.week ?? '';
      if (typeof record.adminWeeklyPlanId === 'string') enriched.week = adminPlansById.get(record.adminWeeklyPlanId)?.week ?? '';
      return enriched;
    };
    const rows: Record<string, unknown>[] = [...selected].flatMap((group) => tableGroups[group].flatMap((table) =>
      (data as Record<string, Record<string, unknown>[]>)[table].map((record): Record<string, unknown> => ({ table, ...addNames(record) })),
    ));
    const allColumns = [...new Set(['table', ...rows.flatMap((row) => Object.keys(row))])];
    const nameColumns = ['studentName', 'className', 'subjectName', 'teacherName'];
    const idColumns = ['id', 'studentId', 'classId', 'subjectId', 'teacherId', 'updatedById', 'createdBy', 'scheduleId', 'weeklyPlanId', 'submissionId', 'adminWeeklyPlanId', 'gradeId'];
    const columns = [
      ...nameColumns.filter((column) => allColumns.includes(column)),
      ...allColumns.filter((column) => column !== 'table' && !nameColumns.includes(column) && !idColumns.includes(column)),
      ...idColumns.filter((column) => allColumns.includes(column)),
      ...(allColumns.includes('table') ? ['table'] : []),
    ];
    const csvValue = (value: unknown) => {
      const raw = value instanceof Date ? value.toISOString() : value === null || value === undefined ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
      return `"${raw.replaceAll('"', '""')}"`;
    };
    const csv = `\uFEFF${columns.map(csvValue).join(',')}\r\n${rows.map((row) => columns.map((column) => csvValue(row[column])).join(',')).join('\r\n')}`;
    const filename = `forqan-school-backup-${timestamp.slice(0, 10)}.csv`;
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Database backup export failed', error);
    return NextResponse.json({ error: 'Could not export the selected database data.' }, { status: 500 });
  }
}
