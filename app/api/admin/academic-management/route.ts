import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

async function requireAdmin() {
  const session = await getServerSession(authOptions);
  return session?.user?.role === 'ADMIN' ? session : null;
}

export async function GET() {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const [teachers, classes, subjects] = await Promise.all([
    prisma.user.findMany({ where: { role: 'TEACHER' }, orderBy: { name: 'asc' }, select: { id: true, name: true, username: true, email: true, arabicName: true, academicYear: true, school: true, classes: { select: { id: true, name: true } }, classTeacherAssignments: { include: { class: { select: { id: true, name: true } } } }, subjects: { select: { id: true, name: true } }, subjectTeacherAssignments: { include: { subject: { select: { id: true, name: true } } } } } }),
    prisma.class.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.subject.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
  ]);
  return NextResponse.json({ teachers, classes, subjects });
}

export async function POST(request: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const type = body.type === 'class' ? 'class' : body.type === 'subject' ? 'subject' : null;
  const name = String(body.name ?? '').trim();
  if (!type || !name || name.length > 100) return NextResponse.json({ error: 'Enter a valid class or subject name.' }, { status: 400 });
  try {
    const existing = type === 'class'
      ? await prisma.class.findFirst({ where: { name: { equals: name, mode: 'insensitive' } }, select: { id: true } })
      : await prisma.subject.findFirst({ where: { name: { equals: name, mode: 'insensitive' } }, select: { id: true } });
    if (existing) return NextResponse.json({ error: 'A record with this name already exists.' }, { status: 409 });
    const record = type === 'class' ? await prisma.class.create({ data: { name }, select: { id: true, name: true } }) : await prisma.subject.create({ data: { name }, select: { id: true, name: true } });
    return NextResponse.json(record, { status: 201 });
  } catch (error) { console.error('Academic record create failed', error); return NextResponse.json({ error: 'Could not create this record.' }, { status: 400 }); }
}

export async function DELETE(request: NextRequest) {
  if (!await requireAdmin()) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json();
  const type = body.type === 'class' ? 'class' : body.type === 'subject' ? 'subject' : null;
  const id = typeof body.id === 'string' ? body.id : '';
  if (!type || !id) return NextResponse.json({ error: 'Choose a valid record to remove.' }, { status: 400 });
  try {
    if (type === 'class') {
      const [lessons, students, schedules, weeklySubmissions, classSubjects, teacherAssignments, teachers] = await Promise.all([
        prisma.lesson.count({ where: { classId: id } }), prisma.student.count({ where: { classId: id } }), prisma.schedule.count({ where: { classId: id } }),
        prisma.weeklyPlannerSubmission.count({ where: { classes: { some: { id } } } }), prisma.classSubject.count({ where: { classId: id } }), prisma.classTeacher.count({ where: { classId: id } }), prisma.user.count({ where: { role: 'TEACHER', classes: { some: { id } } } }),
      ]);
      if (lessons + students + schedules + weeklySubmissions + classSubjects + teacherAssignments + teachers) return NextResponse.json({ error: 'This class is in use. Remove its students, schedules, assignments, and plans before deleting it.' }, { status: 409 });
      await prisma.class.delete({ where: { id } });
    } else {
      const [lessons, weeklyItems, adminItems, legacyWeeklyItems, gradeAssignments, classAssignments, teacherAssignments, directTeacherAssignments, marks, reports, schedules] = await Promise.all([
        prisma.lesson.count({ where: { subjectId: id } }), prisma.weeklyPlannerItem.count({ where: { subjectId: id } }), prisma.adminWeeklyPlanItem.count({ where: { subjectId: id } }), prisma.weeklyPlanItem.count({ where: { subjectId: id } }),
        prisma.gradeSubject.count({ where: { subjectId: id } }), prisma.classSubject.count({ where: { subjectId: id } }), prisma.subjectTeacher.count({ where: { subjectId: id } }),
        prisma.user.count({ where: { role: 'TEACHER', subjects: { some: { id } } } }), prisma.mark.count({ where: { subjectId: id } }), prisma.studentReport.count({ where: { subjectId: id } }), prisma.scheduleItem.count({ where: { subjectId: id } }),
      ]);
      if (lessons + weeklyItems + adminItems + legacyWeeklyItems + gradeAssignments + classAssignments + teacherAssignments + directTeacherAssignments + marks + reports + schedules) return NextResponse.json({ error: 'This subject is in use. Remove its plans, reports, assignments, and schedules before deleting it.' }, { status: 409 });
      await prisma.subject.delete({ where: { id } });
    }
    return NextResponse.json({ success: true });
  } catch (error) { console.error('Academic record delete failed', error); return NextResponse.json({ error: 'Could not delete this record.' }, { status: 400 }); }
}
