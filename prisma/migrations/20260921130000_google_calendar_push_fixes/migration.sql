-- AlterTable
ALTER TABLE "CalendarSyncTask" ADD COLUMN "staleCalendarId" TEXT;
ALTER TABLE "CalendarSyncTask" ADD COLUMN "staleGoogleEventId" TEXT;
