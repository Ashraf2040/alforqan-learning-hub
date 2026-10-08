CREATE TABLE "ManagedMarkScheme" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "columns" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ManagedMarkScheme_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ManagedMarkScheme_subjectId_key" ON "ManagedMarkScheme"("subjectId");
ALTER TABLE "ManagedMarkScheme" ADD CONSTRAINT "ManagedMarkScheme_subjectId_fkey"
FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
