/*
  Warnings:

  - You are about to drop the `DayOff` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `endTime` on the `Schedule` table. All the data in the column will be lost.
  - You are about to drop the column `startTime` on the `Schedule` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "DayOff_masterId_date_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "DayOff";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "DateOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "masterId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "isDayOff" BOOLEAN NOT NULL DEFAULT false,
    "intervals" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "DateOverride_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Schedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "masterId" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "isDayOff" BOOLEAN NOT NULL DEFAULT false,
    "intervals" TEXT NOT NULL DEFAULT '[{"start":"09:00","end":"18:00"}]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Schedule_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Schedule" ("createdAt", "dayOfWeek", "id", "isDayOff", "masterId", "updatedAt") SELECT "createdAt", "dayOfWeek", "id", "isDayOff", "masterId", "updatedAt" FROM "Schedule";
DROP TABLE "Schedule";
ALTER TABLE "new_Schedule" RENAME TO "Schedule";
CREATE UNIQUE INDEX "Schedule_masterId_dayOfWeek_key" ON "Schedule"("masterId", "dayOfWeek");
CREATE TABLE "new_Service" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "duration" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "masterId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Service_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Service" ("createdAt", "duration", "id", "name", "price", "updatedAt") SELECT "createdAt", "duration", "id", "name", "price", "updatedAt" FROM "Service";
DROP TABLE "Service";
ALTER TABLE "new_Service" RENAME TO "Service";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "DateOverride_masterId_date_key" ON "DateOverride"("masterId", "date");
