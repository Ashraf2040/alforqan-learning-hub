ALTER TABLE "AdminPlannerNote" ADD COLUMN "week" TEXT NOT NULL DEFAULT '';

DROP INDEX "AdminPlannerNote_scope_updatedAt_idx";
CREATE INDEX "AdminPlannerNote_scope_week_updatedAt_idx" ON "AdminPlannerNote"("scope", "week", "updatedAt");
