ALTER TABLE "GradeSubject" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

WITH ordered_subjects AS (
  SELECT "gradeId", "subjectId", ROW_NUMBER() OVER (PARTITION BY "gradeId" ORDER BY "subjectId") - 1 AS position
  FROM "GradeSubject"
)
UPDATE "GradeSubject" AS assigned
SET "position" = ordered_subjects.position
FROM ordered_subjects
WHERE assigned."gradeId" = ordered_subjects."gradeId"
  AND assigned."subjectId" = ordered_subjects."subjectId";
