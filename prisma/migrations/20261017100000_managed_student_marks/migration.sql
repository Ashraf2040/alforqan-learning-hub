CREATE TABLE "ManagedStudentMark" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "updatedById" TEXT,
    "academicYear" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "participation" INTEGER NOT NULL DEFAULT 0,
    "behavior" INTEGER NOT NULL DEFAULT 0,
    "workingQuiz" INTEGER NOT NULL DEFAULT 0,
    "project" INTEGER NOT NULL DEFAULT 0,
    "finalExam" INTEGER NOT NULL DEFAULT 0,
    "classActivities" INTEGER NOT NULL DEFAULT 0,
    "homework" INTEGER NOT NULL DEFAULT 0,
    "memorizing" INTEGER NOT NULL DEFAULT 0,
    "oralTest" INTEGER NOT NULL DEFAULT 0,
    "reading" INTEGER NOT NULL DEFAULT 0,
    "totalMarks" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ManagedStudentMark_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManagedStudentMark_studentId_classId_subjectId_academicYear_term_key"
ON "ManagedStudentMark"("studentId", "classId", "subjectId", "academicYear", "term");
CREATE INDEX "ManagedStudentMark_classId_subjectId_academicYear_term_idx"
ON "ManagedStudentMark"("classId", "subjectId", "academicYear", "term");
ALTER TABLE "ManagedStudentMark" ADD CONSTRAINT "ManagedStudentMark_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManagedStudentMark" ADD CONSTRAINT "ManagedStudentMark_classId_fkey"
FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManagedStudentMark" ADD CONSTRAINT "ManagedStudentMark_subjectId_fkey"
FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManagedStudentMark" ADD CONSTRAINT "ManagedStudentMark_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
