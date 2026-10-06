require('dotenv/config');
const { PrismaClient } = require('../generated/client-weekly-v2');
const { subjects, classNames, teachersData } = require('./seed-data.json');
const prisma = new PrismaClient();
const adminPassword = 'admin123';
const teacherPassword = 'P@55word';

async function getOrCreateByName(model, name) {
  const found = await model.findFirst({ where: { name } });
  return found || model.create({ data: { name } });
}

async function main() {
  console.log('Loading the school accounts and assignments from the previous app seed.');

  const subjectRows = await Promise.all(subjects.map((name) => getOrCreateByName(prisma.subject, name)));
  const classRows = await Promise.all(classNames.map((name) => getOrCreateByName(prisma.class, name)));
  const subjectMap = new Map(subjectRows.map((subject) => [subject.name, subject.id]));
  const classMap = new Map(classRows.map((schoolClass) => [schoolClass.name, schoolClass.id]));

  const gradeNames = [...new Set(classNames.map((name) => name.match(/^\d+/)?.[0]).filter(Boolean))];
  for (const name of gradeNames) {
    await prisma.grade.upsert({ where: { name }, update: {}, create: { name } });
  }
  const gradeMap = new Map((await prisma.grade.findMany()).map((grade) => [grade.name, grade.id]));

  // Make the grade/class relationship explicit for the admin's grade-first
  // planner filter. Classes without a numeric prefix remain unassigned.
  for (const schoolClass of classRows) {
    const gradeName = schoolClass.name.match(/^\d+/)?.[0];
    await prisma.class.update({
      where: { id: schoolClass.id },
      data: { gradeId: gradeName ? (gradeMap.get(gradeName) ?? null) : null },
    });
  }

  const gradeSubjectPairs = new Map();
  for (const teacher of teachersData) {
    for (const className of teacher.classes) {
      const gradeName = className.match(/^\d+/)?.[0];
      const gradeId = gradeName ? gradeMap.get(gradeName) : undefined;
      if (!gradeId) continue;
      for (const subjectName of teacher.subjects) {
        const subjectId = subjectMap.get(subjectName);
        if (subjectId) gradeSubjectPairs.set(`${gradeId}:${subjectId}`, { gradeId, subjectId });
      }
    }
  }
  if (gradeSubjectPairs.size) {
    await prisma.gradeSubject.createMany({ data: [...gradeSubjectPairs.values()], skipDuplicates: true });
  }

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: { name: 'Admin User', password: adminPassword, role: 'ADMIN' },
    create: { username: 'admin', name: 'Admin User', password: adminPassword, role: 'ADMIN' },
  });

  for (const teacher of teachersData) {
    const classIds = teacher.classes.map((name) => classMap.get(name)).filter(Boolean);
    const subjectIds = teacher.subjects.map((name) => subjectMap.get(name)).filter(Boolean);
    await prisma.user.upsert({
      where: { username: teacher.username },
      update: {
        name: teacher.name,
        password: teacherPassword,
        role: 'TEACHER',
        classes: { set: classIds.map((id) => ({ id })) },
        subjects: { set: subjectIds.map((id) => ({ id })) },
      },
      create: {
        username: teacher.username,
        name: teacher.name,
        password: teacherPassword,
        role: 'TEACHER',
        classes: { connect: classIds.map((id) => ({ id })) },
        subjects: { connect: subjectIds.map((id) => ({ id })) },
      },
    });
  }

  // Add one repeatable example plan using a real teacher and assignments from
  // the previous seed. Running this seed again will not duplicate this plan.
  const sampleTeacherData = teachersData.find((teacher) => teacher.username === 'moaliarab3');
  const sampleTeacher = sampleTeacherData
    ? await prisma.user.findUnique({ where: { username: sampleTeacherData.username } })
    : null;
  const sampleSubjectId = subjectMap.get('Math');
  const sampleClassIds = ['4A', '5A'].map((name) => classMap.get(name)).filter(Boolean);
  const fromDate = new Date('2026-09-21T00:00:00.000Z');

  if (sampleTeacher && sampleSubjectId && sampleClassIds.length) {
    const alreadySeeded = await prisma.weeklyPlannerSubmission.findFirst({
      where: { teacherId: sampleTeacher.id, week: 'Demo week 4', fromDate },
    });
    if (!alreadySeeded) {
      await prisma.weeklyPlannerSubmission.create({
        data: {
          teacherId: sampleTeacher.id,
          week: 'Demo week 4',
          semester: '1st Semester',
          fromDate,
          toDate: new Date('2026-09-25T23:59:59.999Z'),
        dictation: 'Practise spelling the weekly dictation words and sentences.',
          notes: 'Sample weekly plan for testing the admin table and print view.',
          classes: { connect: sampleClassIds.map((id) => ({ id })) },
          items: { create: [{
            subjectId: sampleSubjectId,
            classwork: 'Mathematical modeling and fluency practice, pages 45–47.',
            homework: 'Complete the assigned practice pages and review the lesson.',
          }] },
        },
      });
    }
  }

  console.log(`Seed complete: ${subjects.length} subjects, ${classNames.length} classes, ${gradeNames.length} grades, ${teachersData.length} teachers.`);
  console.log(`Admin login: admin / ${adminPassword}`);
  console.log(`Teacher login: ${sampleTeacherData?.username ?? 'see previous seed'} / ${teacherPassword}`);
  console.log('This script preserves other existing records; it does not clear the database.');
}

main()
  .catch((error) => { console.error('Seed failed:', error); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
