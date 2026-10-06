CREATE TABLE "AdminWeeklyPlan" (
    "id" TEXT NOT NULL,
    "gradeId" TEXT NOT NULL,
    "week" TEXT NOT NULL,
    "semester" TEXT,
    "fromDate" TIMESTAMP(3) NOT NULL,
    "toDate" TIMESTAMP(3) NOT NULL,
    "vocabulary" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdminWeeklyPlan_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminWeeklyPlanItem" (
    "id" TEXT NOT NULL,
    "adminWeeklyPlanId" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "classwork" TEXT NOT NULL DEFAULT '',
    "homework" TEXT NOT NULL DEFAULT '',
    CONSTRAINT "AdminWeeklyPlanItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AdminWeeklyPlan_gradeId_week_key" ON "AdminWeeklyPlan"("gradeId", "week");
CREATE INDEX "AdminWeeklyPlan_week_fromDate_toDate_idx" ON "AdminWeeklyPlan"("week", "fromDate", "toDate");
CREATE UNIQUE INDEX "AdminWeeklyPlanItem_adminWeeklyPlanId_subjectId_key" ON "AdminWeeklyPlanItem"("adminWeeklyPlanId", "subjectId");

ALTER TABLE "AdminWeeklyPlan" ADD CONSTRAINT "AdminWeeklyPlan_gradeId_fkey" FOREIGN KEY ("gradeId") REFERENCES "Grade"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminWeeklyPlanItem" ADD CONSTRAINT "AdminWeeklyPlanItem_adminWeeklyPlanId_fkey" FOREIGN KEY ("adminWeeklyPlanId") REFERENCES "AdminWeeklyPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AdminWeeklyPlanItem" ADD CONSTRAINT "AdminWeeklyPlanItem_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
