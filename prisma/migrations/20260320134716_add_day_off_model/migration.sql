-- AlterTable
ALTER TABLE "User" ADD COLUMN "plainPassword" TEXT;

-- CreateTable
CREATE TABLE "MasterService" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "masterProfileId" TEXT NOT NULL,
    "serviceId" TEXT NOT NULL,
    "priceOverride" REAL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MasterService_masterProfileId_fkey" FOREIGN KEY ("masterProfileId") REFERENCES "MasterProfile" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MasterService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "Service" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DayOff" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "masterId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DayOff_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MasterProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "bio" TEXT,
    "specialties" TEXT,
    "showOnHomepage" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MasterProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MasterProfile" ("avatarUrl", "bio", "createdAt", "id", "specialties", "updatedAt", "userId") SELECT "avatarUrl", "bio", "createdAt", "id", "specialties", "updatedAt", "userId" FROM "MasterProfile";
DROP TABLE "MasterProfile";
ALTER TABLE "new_MasterProfile" RENAME TO "MasterProfile";
CREATE UNIQUE INDEX "MasterProfile_userId_key" ON "MasterProfile"("userId");
CREATE TABLE "new_TenantConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "brandName" TEXT NOT NULL DEFAULT 'Salon Booking',
    "primaryColor" TEXT NOT NULL DEFAULT '#FDE5C3',
    "secondaryColor" TEXT NOT NULL DEFAULT '#FFF6E9',
    "accentColor" TEXT NOT NULL DEFAULT '#FFBBBD',
    "textColor" TEXT NOT NULL DEFAULT '#2B2B2B',
    "mutedColor" TEXT NOT NULL DEFAULT '#6B6B6B',
    "borderColor" TEXT NOT NULL DEFAULT '#E9E2D6',
    "cardColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "successColor" TEXT NOT NULL DEFAULT '#21A67A',
    "errorColor" TEXT NOT NULL DEFAULT '#D84E4E',
    "darkBgColor" TEXT NOT NULL DEFAULT '#9c6849',
    "darkPrimaryColor" TEXT NOT NULL DEFAULT '#FDE5C3',
    "darkAccentColor" TEXT NOT NULL DEFAULT '#FFBBBD',
    "darkCardColor" TEXT NOT NULL DEFAULT '#2A2A2A',
    "darkTextColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "darkMutedColor" TEXT NOT NULL DEFAULT '#D0D0D0',
    "darkBorderColor" TEXT NOT NULL DEFAULT '#7A4F35',
    "logoUrl" TEXT,
    "faviconUrl" TEXT,
    "darkLogoUrl" TEXT,
    "logoPositionX" REAL NOT NULL DEFAULT 0,
    "logoPositionY" REAL NOT NULL DEFAULT 0,
    "logoWidth" INTEGER NOT NULL DEFAULT 200,
    "logoHeight" INTEGER NOT NULL DEFAULT 80,
    "logoPages" TEXT NOT NULL DEFAULT '["home","booking"]',
    "logoLayer" TEXT NOT NULL DEFAULT 'above',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_TenantConfig" ("accentColor", "borderColor", "brandName", "createdAt", "darkBgColor", "darkBorderColor", "darkCardColor", "darkMutedColor", "darkTextColor", "errorColor", "id", "logoUrl", "mutedColor", "primaryColor", "secondaryColor", "successColor", "textColor", "updatedAt") SELECT "accentColor", "borderColor", "brandName", "createdAt", "darkBgColor", "darkBorderColor", "darkCardColor", "darkMutedColor", "darkTextColor", "errorColor", "id", "logoUrl", "mutedColor", "primaryColor", "secondaryColor", "successColor", "textColor", "updatedAt" FROM "TenantConfig";
DROP TABLE "TenantConfig";
ALTER TABLE "new_TenantConfig" RENAME TO "TenantConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "MasterService_masterProfileId_serviceId_key" ON "MasterService"("masterProfileId", "serviceId");

-- CreateIndex
CREATE UNIQUE INDEX "DayOff_masterId_date_key" ON "DayOff"("masterId", "date");
