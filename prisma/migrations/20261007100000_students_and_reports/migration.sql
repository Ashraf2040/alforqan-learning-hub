CREATE TABLE "Student" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "arabicName" TEXT,
  "classId" TEXT NOT NULL,
  "nationality" TEXT,
  "dateOfBirth" TIMESTAMP(3),
  "iqamaNo" TEXT,
  "passportNo" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "StudentReport" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "academicYear" TEXT NOT NULL,
  "trimester" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'Not Started',
  "recommendations" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "comment" TEXT NOT NULL DEFAULT '',
  "participation" INTEGER,
  "behavior" INTEGER,
  "quizScore" INTEGER,
  "projectScore" INTEGER,
  "finalExam" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentReport_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ClassTeacher" (
  "id" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  CONSTRAINT "ClassTeacher_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ClassSubject" (
  "id" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  CONSTRAINT "ClassSubject_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SubjectTeacher" (
  "id" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  CONSTRAINT "SubjectTeacher_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "Mark" (
  "id" TEXT NOT NULL,
  "participation" INTEGER,
  "behavior" INTEGER,
  "workingQuiz" INTEGER,
  "project" INTEGER,
  "finalExam" INTEGER,
  "totalMarks" INTEGER,
  "studentId" TEXT NOT NULL,
  "classTeacherId" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  CONSTRAINT "Mark_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Student_classId_name_idx" ON "Student"("classId", "name");
CREATE UNIQUE INDEX "ClassTeacher_classId_teacherId_key" ON "ClassTeacher"("classId", "teacherId");
CREATE UNIQUE INDEX "ClassSubject_classId_subjectId_key" ON "ClassSubject"("classId", "subjectId");
CREATE UNIQUE INDEX "SubjectTeacher_subjectId_teacherId_key" ON "SubjectTeacher"("subjectId", "teacherId");
CREATE UNIQUE INDEX "Mark_studentId_subjectId_classTeacherId_key" ON "Mark"("studentId", "subjectId", "classTeacherId");
ALTER TABLE "User" ADD COLUMN "email" TEXT, ADD COLUMN "arabicName" TEXT, ADD COLUMN "academicYear" TEXT, ADD COLUMN "school" TEXT, ADD COLUMN "signature" TEXT;
ALTER TABLE "Student" ADD COLUMN "username" TEXT, ADD COLUMN "password" TEXT, ADD COLUMN "academicYear" TEXT, ADD COLUMN "school" TEXT, ADD COLUMN "expenses" TEXT NOT NULL DEFAULT 'paid';
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "Student_username_key" ON "Student"("username");
CREATE UNIQUE INDEX "StudentReport_studentId_teacherId_subjectId_academicYear_trimester_key" ON "StudentReport"("studentId", "teacherId", "subjectId", "academicYear", "trimester");
CREATE INDEX "StudentReport_teacherId_academicYear_trimester_idx" ON "StudentReport"("teacherId", "academicYear", "trimester");
ALTER TABLE "Student" ADD CONSTRAINT "Student_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentReport" ADD CONSTRAINT "StudentReport_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentReport" ADD CONSTRAINT "StudentReport_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudentReport" ADD CONSTRAINT "StudentReport_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ClassTeacher" ADD CONSTRAINT "ClassTeacher_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassTeacher" ADD CONSTRAINT "ClassTeacher_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassSubject" ADD CONSTRAINT "ClassSubject_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ClassSubject" ADD CONSTRAINT "ClassSubject_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubjectTeacher" ADD CONSTRAINT "SubjectTeacher_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SubjectTeacher" ADD CONSTRAINT "SubjectTeacher_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Mark" ADD CONSTRAINT "Mark_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Mark" ADD CONSTRAINT "Mark_classTeacherId_fkey" FOREIGN KEY ("classTeacherId") REFERENCES "ClassTeacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Mark" ADD CONSTRAINT "Mark_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
