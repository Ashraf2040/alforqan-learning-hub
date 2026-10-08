CREATE TABLE "ManagedQuizScheme" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "firstMax" INTEGER NOT NULL DEFAULT 10,
    "secondMax" INTEGER NOT NULL DEFAULT 10,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ManagedQuizScheme_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManagedQuizScheme_subjectId_key" ON "ManagedQuizScheme"("subjectId");
ALTER TABLE "ManagedQuizScheme" ADD CONSTRAINT "ManagedQuizScheme_subjectId_fkey"
FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ManagedQuizMark" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "updatedById" TEXT,
    "academicYear" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "firstQuiz" INTEGER NOT NULL DEFAULT 0,
    "secondQuiz" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ManagedQuizMark_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ManagedQuizMark_studentId_classId_subjectId_academicYear_term_key"
ON "ManagedQuizMark"("studentId", "classId", "subjectId", "academicYear", "term");
CREATE INDEX "ManagedQuizMark_classId_subjectId_academicYear_term_idx"
ON "ManagedQuizMark"("classId", "subjectId", "academicYear", "term");
ALTER TABLE "ManagedQuizMark" ADD CONSTRAINT "ManagedQuizMark_studentId_fkey"
FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManagedQuizMark" ADD CONSTRAINT "ManagedQuizMark_classId_fkey"
FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManagedQuizMark" ADD CONSTRAINT "ManagedQuizMark_subjectId_fkey"
FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManagedQuizMark" ADD CONSTRAINT "ManagedQuizMark_updatedById_fkey"
FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
