ALTER TABLE "StudentReport"
  ADD COLUMN "reportType" TEXT NOT NULL DEFAULT 'First Report';

DROP INDEX "StudentReport_studentId_teacherId_subjectId_academicYear_semester_key";

CREATE UNIQUE INDEX "StudentReport_studentId_teacherId_subjectId_academicYear_semester_reportType_key"
  ON "StudentReport"("studentId", "teacherId", "subjectId", "academicYear", "semester", "reportType");
