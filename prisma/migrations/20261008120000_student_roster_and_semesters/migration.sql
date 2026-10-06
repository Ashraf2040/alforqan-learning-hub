-- Student identity is kept to name and class; grade is derived from the class.
ALTER TABLE "Student"
  DROP COLUMN IF EXISTS "arabicName",
  DROP COLUMN IF EXISTS "nationality",
  DROP COLUMN IF EXISTS "dateOfBirth",
  DROP COLUMN IF EXISTS "iqamaNo",
  DROP COLUMN IF EXISTS "passportNo",
  DROP COLUMN IF EXISTS "username",
  DROP COLUMN IF EXISTS "password",
  DROP COLUMN IF EXISTS "academicYear",
  DROP COLUMN IF EXISTS "school",
  DROP COLUMN IF EXISTS "expenses";

ALTER TABLE "StudentReport" RENAME COLUMN "trimester" TO "semester";
ALTER INDEX "StudentReport_studentId_teacherId_subjectId_academicYear_trimester_key"
  RENAME TO "StudentReport_studentId_teacherId_subjectId_academicYear_semester_key";
ALTER INDEX "StudentReport_teacherId_academicYear_trimester_idx"
  RENAME TO "StudentReport_teacherId_academicYear_semester_idx";
