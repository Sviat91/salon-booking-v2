-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN "googleEventId" TEXT;

-- AlterTable
ALTER TABLE "MasterProfile" ADD COLUMN "googleCalendarId" TEXT;
ALTER TABLE "MasterProfile" ADD COLUMN "googleSyncToken" TEXT;
ALTER TABLE "MasterProfile" ADD COLUMN "googleSyncStatus" TEXT;
ALTER TABLE "MasterProfile" ADD COLUMN "googleSyncError" TEXT;
ALTER TABLE "MasterProfile" ADD COLUMN "googleSyncedAt" DATETIME;

-- AlterTable
ALTER TABLE "TenantConfig" ADD COLUMN "googleCalendarEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TenantConfig" ADD COLUMN "googleServiceAccountKey" TEXT;
ALTER TABLE "TenantConfig" ADD COLUMN "googleServiceAccountEmail" TEXT;

-- CreateTable
CREATE TABLE "CalendarSyncTask" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "appointmentId" TEXT NOT NULL,
    "masterId" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "googleEventId" TEXT,
    "calendarId" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastError" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "CalendarSyncTask_appointmentId_key" ON "CalendarSyncTask"("appointmentId");

-- CreateIndex
CREATE INDEX "CalendarSyncTask_nextAttemptAt_idx" ON "CalendarSyncTask"("nextAttemptAt");
