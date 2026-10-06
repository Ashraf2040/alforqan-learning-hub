ALTER TABLE "Class" ADD COLUMN "gradeId" TEXT;

CREATE INDEX "Class_gradeId_idx" ON "Class"("gradeId");

ALTER TABLE "Class"
ADD CONSTRAINT "Class_gradeId_fkey"
FOREIGN KEY ("gradeId") REFERENCES "Grade"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
