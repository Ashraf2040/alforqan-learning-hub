ALTER TABLE "ManagedStudentMark" ADD COLUMN "extraMarks" TEXT NOT NULL DEFAULT '{}';

ALTER TABLE "ManagedMarkScheme" DROP CONSTRAINT "ManagedMarkScheme_subjectId_fkey";
DROP INDEX "ManagedMarkScheme_subjectId_key";
ALTER TABLE "ManagedMarkScheme" ADD COLUMN "scopeKey" TEXT;
ALTER TABLE "ManagedMarkScheme" ADD COLUMN "gradeId" TEXT;
ALTER TABLE "ManagedMarkScheme" ADD COLUMN "classId" TEXT;
UPDATE "ManagedMarkScheme" SET "scopeKey" = "subjectId" || ':global';
ALTER TABLE "ManagedMarkScheme" ALTER COLUMN "scopeKey" SET NOT NULL;
CREATE UNIQUE INDEX "ManagedMarkScheme_scopeKey_key" ON "ManagedMarkScheme"("scopeKey");
CREATE INDEX "ManagedMarkScheme_subjectId_idx" ON "ManagedMarkScheme"("subjectId");
CREATE INDEX "ManagedMarkScheme_gradeId_idx" ON "ManagedMarkScheme"("gradeId");
CREATE INDEX "ManagedMarkScheme_classId_idx" ON "ManagedMarkScheme"("classId");
ALTER TABLE "ManagedMarkScheme" ADD CONSTRAINT "ManagedMarkScheme_subjectId_fkey"
FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManagedMarkScheme" ADD CONSTRAINT "ManagedMarkScheme_gradeId_fkey"
FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ManagedMarkScheme" ADD CONSTRAINT "ManagedMarkScheme_classId_fkey"
FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
