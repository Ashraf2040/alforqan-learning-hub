CREATE TABLE "AdminPlannerNote" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdminPlannerNote_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AdminPlannerNote_scope_updatedAt_idx" ON "AdminPlannerNote"("scope", "updatedAt");

CREATE TABLE "_AdminPlannerNoteGrades" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_AdminPlannerNoteGrades_AB_pkey" PRIMARY KEY ("A", "B")
);

CREATE INDEX "_AdminPlannerNoteGrades_B_index" ON "_AdminPlannerNoteGrades"("B");

ALTER TABLE "_AdminPlannerNoteGrades" ADD CONSTRAINT "_AdminPlannerNoteGrades_A_fkey" FOREIGN KEY ("A") REFERENCES "AdminPlannerNote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "_AdminPlannerNoteGrades" ADD CONSTRAINT "_AdminPlannerNoteGrades_B_fkey" FOREIGN KEY ("B") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
