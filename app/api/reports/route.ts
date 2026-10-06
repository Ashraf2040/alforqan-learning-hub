import { getServerSession } from 'next-auth';
import { NextRequest, NextResponse } from 'next/server';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['ADMIN', 'TEACHER'].includes(session.user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const teacherId = session.user.role === 'TEACHER' ? session.user.id : request.nextUrl.searchParams.get('teacherId') || undefined;
  const user = session.user.role === 'TEACHER' ? await prisma.user.findUnique({ where: { id: session.user.id }, include: { classes: true, subjects: true, classTeacherAssignments: true, subjectTeacherAssignments: true } }) : null;
  const classIds = user ? [...new Set([...user.classes.map((item) => item.id), ...user.classTeacherAssignments.map((item) => item.classId)])] : undefined;
  const subjectIds = user ? [...new Set([...user.subjects.map((item) => item.id), ...user.subjectTeacherAssignments.map((item) => item.subjectId)])] : undefined;
  const selectedClassId = request.nextUrl.searchParams.get('classId');
  const visibleClassIds = classIds ? (selectedClassId ? (classIds.includes(selectedClassId) ? [selectedClassId] : []) : classIds) : (selectedClassId ? [selectedClassId] : undefined);
  const [selectedClass, grades] = selectedClassId ? await Promise.all([
    prisma.class.findUnique({ where: { id: selectedClassId }, select: { name: true, grade: { select: { id: true } } } }),
    prisma.grade.findMany({ select: { id: true, name: true, subjects: { select: { subjectId: true, position: true } } } }),
  ]) : [null, []];
  const leadingGradeNumber = selectedClass?.name.match(/^\s*(\d+)/)?.[1];
  const effectiveGrade = grades.find((grade) => grade.id === selectedClass?.grade?.id)
    ?? (leadingGradeNumber ? grades.find((grade) => grade.name.match(/\d+/)?.[0] === leadingGradeNumber) : undefined);
  const subjectPositions = new Map((effectiveGrade?.subjects ?? []).map(({ subjectId, position }) => [subjectId, position]));
  const reports = await prisma.studentReport.findMany({
    where: { ...(teacherId ? { teacherId } : {}), ...(visibleClassIds ? { student: { classId: { in: visibleClassIds } } } : {}), ...(subjectIds ? { subjectId: { in: subjectIds } } : {}),
      ...(request.nextUrl.searchParams.get('semester') ? { semester: request.nextUrl.searchParams.get('semester')! } : {}),
      ...(request.nextUrl.searchParams.get('reportType') ? { reportType: request.nextUrl.searchParams.get('reportType')! } : {}),
      ...(request.nextUrl.searchParams.get('academicYear') ? { academicYear: request.nextUrl.searchParams.get('academicYear')! } : {}),
      ...(request.nextUrl.searchParams.get('subjectId') ? { subjectId: request.nextUrl.searchParams.get('subjectId')! } : {}) },
    orderBy: [{ student: { name: 'asc' } }, { subject: { reportOrder: 'asc' } }, { subject: { name: 'asc' } }], include: { student: { include: { class: { select: { id: true, name: true } } } }, teacher: { select: { id: true, name: true, signature: true } }, subject: { select: { id: true, name: true, reportOrder: true } } },
  });
  const orderedReports = reports
    .map((report) => ({ ...report, subjectPosition: subjectPositions.get(report.subjectId) ?? Number.MAX_SAFE_INTEGER }))
    .sort((a, b) => a.student.name.localeCompare(b.student.name) || a.subjectPosition - b.subjectPosition || a.subject.name.localeCompare(b.subject.name));
  const signatureOwner = teacherId ? await prisma.user.findUnique({ where: { id: teacherId }, select: { signature: true } }) : null;
  return NextResponse.json({ reports: orderedReports, signature: signatureOwner?.signature ?? '' });
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user || !['ADMIN', 'TEACHER'].includes(session.user.role)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await request.json();
    const studentId = String(body.studentId ?? ''); const subjectId = String(body.subjectId ?? '');
    const teacherId = session.user.role === 'TEACHER' ? session.user.id : String(body.teacherId ?? session.user.id);
    const academicYear = String(body.academicYear ?? '').trim(); const semester = String(body.semester ?? '').trim();
    const reportType = String(body.reportType ?? '').trim();
    const student = await prisma.student.findUnique({ where: { id: studentId }, include: { class: { include: { grade: { select: { name: true } }, teachers: { select: { id: true } }, classTeacherAssignments: { select: { teacherId: true, classId: true } } } } } });
    const teacher = await prisma.user.findUnique({ where: { id: teacherId }, include: { classes: true, subjects: true, classTeacherAssignments: true } });
    if (!student || !teacher || teacher.role !== 'TEACHER' || !academicYear || !['1st Semester', '2nd Semester'].includes(semester) || !['First Report', 'Second Report'].includes(reportType)) return NextResponse.json({ error: 'Choose a valid student, teacher, academic year, semester, and report.' }, { status: 400 });
    const teachesClass = teacher.classes.some((item) => item.id === student.classId) || teacher.classTeacherAssignments.some((item) => item.classId === student.classId);
    const teachesSubject = teacher.subjects.some((item) => item.id === subjectId) || await prisma.subjectTeacher.findFirst({ where: { teacherId, subjectId } }) !== null;
    if (session.user.role === 'TEACHER' && (!teachesClass || !teachesSubject)) return NextResponse.json({ error: 'You can only report on your assigned classes and subjects.' }, { status: 403 });
    if (session.user.role === 'ADMIN' && (!teachesClass || !teachesSubject)) return NextResponse.json({ error: 'The selected teacher is not assigned to this class and subject.' }, { status: 400 });
    const status = String(body.status ?? '');
    if (!['Excellent', 'Good', 'Average', 'Below Average'].includes(status)) return NextResponse.json({ error: 'Choose a valid present status.' }, { status: 400 });
    const score = (value: unknown) => {
      if (value === '' || value == null) return null;
      const parsed = Number(value);
      return Number.isInteger(parsed) && parsed >= 0 && parsed <= 100 ? parsed : Number.NaN;
    };
    const quizScore = score(body.quizScore), projectScore = score(body.projectScore);
    if (Number.isNaN(quizScore) || Number.isNaN(projectScore)) return NextResponse.json({ error: 'Quiz and project marks must be whole numbers from 0 to 100.' }, { status: 400 });
    const signature = body.signature === undefined ? undefined : String(body.signature ?? '');
    if (signature !== undefined && signature && (signature.length > 200_000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(signature))) return NextResponse.json({ error: 'The signature image is invalid or too large.' }, { status: 400 });
    if (signature !== undefined) await prisma.user.update({ where: { id: teacherId }, data: { signature: signature || null } });
    const classGradeNumber = (student.class.grade?.name ?? student.class.name).match(/\d+/)?.[0];
    const subject = await prisma.subject.findUnique({ where: { id: subjectId }, select: { name: true } });
    const supportsIxl = (!classGradeNumber || Number(classGradeNumber) < 7) && Boolean(subject && /\b(math|mathematics|english)\b/i.test(subject.name));
    const allowedIxlStatuses = ['Complete', 'Incomplete', 'Missing'];
    const requestedIxlStatus = String(body.ixlPracticeStatus ?? '');
    if (supportsIxl && requestedIxlStatus && !allowedIxlStatuses.includes(requestedIxlStatus)) return NextResponse.json({ error: 'Choose a valid IXL Practices status.' }, { status: 400 });
    const ixlPracticeStatus = supportsIxl ? requestedIxlStatus || null : null;
    const recommendations = Array.isArray(body.recommendations) ? body.recommendations.map(String) : [];
    const comment = String(body.comment ?? '').trim();
    const report = await prisma.studentReport.upsert({ where: { studentId_teacherId_subjectId_academicYear_semester_reportType: { studentId, teacherId, subjectId, academicYear, semester, reportType } }, create: { studentId, teacherId, subjectId, academicYear, semester, reportType, status, recommendations, comment, ixlPracticeStatus, quizScore, projectScore }, update: { status, recommendations, comment, ixlPracticeStatus, quizScore, projectScore } });
    return NextResponse.json({ report }, { status: 201 });
  } catch (error) { console.error('Report save failed', error); return NextResponse.json({ error: 'The report could not be saved.' }, { status: 400 }); }
}
