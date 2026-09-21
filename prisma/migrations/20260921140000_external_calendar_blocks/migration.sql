-- CreateTable
CREATE TABLE "ExternalCalendarBlock" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "masterId" TEXT NOT NULL,
    "googleCalendarId" TEXT NOT NULL,
    "googleEventId" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "date" DATETIME NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "conflictNotifiedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExternalCalendarBlock_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ExternalCalendarBlock_masterId_date_idx" ON "ExternalCalendarBlock"("masterId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "ExternalCalendarBlock_masterId_googleEventId_date_key" ON "ExternalCalendarBlock"("masterId", "googleEventId", "date");
