CREATE TABLE "Schedule" (
  "id" TEXT NOT NULL,
  "classId" TEXT NOT NULL,
  "name" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ScheduleItem" (
  "id" TEXT NOT NULL,
  "scheduleId" TEXT NOT NULL,
  "dayIndex" INTEGER NOT NULL,
  "session" INTEGER NOT NULL DEFAULT 0,
  "start" TEXT NOT NULL DEFAULT '',
  "end" TEXT NOT NULL DEFAULT '',
  "subjectId" TEXT NOT NULL,
  "teacherId" TEXT,
  CONSTRAINT "ScheduleItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Schedule_classId_isActive_idx" ON "Schedule"("classId", "isActive");
CREATE INDEX "ScheduleItem_scheduleId_idx" ON "ScheduleItem"("scheduleId");
CREATE INDEX "ScheduleItem_teacherId_idx" ON "ScheduleItem"("teacherId");
CREATE INDEX "ScheduleItem_subjectId_idx" ON "ScheduleItem"("subjectId");
CREATE INDEX "ScheduleItem_dayIndex_session_idx" ON "ScheduleItem"("dayIndex", "session");
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Schedule" ADD CONSTRAINT "Schedule_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleItem" ADD CONSTRAINT "ScheduleItem_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "Schedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScheduleItem" ADD CONSTRAINT "ScheduleItem_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScheduleItem" ADD CONSTRAINT "ScheduleItem_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
