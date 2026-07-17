-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MasterProfile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "bio_pl" TEXT,
    "bio_en" TEXT,
    "bio_uk" TEXT,
    "specialties" TEXT,
    "showOnHomepage" BOOLEAN NOT NULL DEFAULT true,
    "color" TEXT DEFAULT '#166534',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "MasterProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_MasterProfile" ("id", "userId", "avatarUrl", "bio_pl", "specialties", "showOnHomepage", "color", "createdAt", "updatedAt") SELECT "id", "userId", "avatarUrl", "bio", "specialties", "showOnHomepage", "color", "createdAt", "updatedAt" FROM "MasterProfile";
DROP TABLE "MasterProfile";
ALTER TABLE "new_MasterProfile" RENAME TO "MasterProfile";
CREATE UNIQUE INDEX "MasterProfile_userId_key" ON "MasterProfile"("userId");
CREATE TABLE "new_Service" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name_pl" TEXT NOT NULL,
    "name_en" TEXT,
    "name_uk" TEXT,
    "duration" INTEGER NOT NULL,
    "price" REAL NOT NULL,
    "masterId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Service_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Service" ("id", "name_pl", "duration", "price", "masterId", "createdAt", "updatedAt") SELECT "id", "name", "duration", "price", "masterId", "createdAt", "updatedAt" FROM "Service";
DROP TABLE "Service";
ALTER TABLE "new_Service" RENAME TO "Service";
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
    "availableSlotColor" TEXT NOT NULL DEFAULT '#22c55e',
    "dayOffColor" TEXT NOT NULL DEFAULT '#ef4444',
    "workingHourStart" INTEGER NOT NULL DEFAULT 8,
    "workingHourEnd" INTEGER NOT NULL DEFAULT 21,
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
    "bgType" TEXT NOT NULL DEFAULT 'solid',
    "bgImageUrl" TEXT,
    "bgGradientFrom" TEXT NOT NULL DEFAULT '#FDE5C3',
    "bgGradientTo" TEXT NOT NULL DEFAULT '#FFF6E9',
    "bgGradientAngle" INTEGER NOT NULL DEFAULT 135,
    "bgApplyToDark" BOOLEAN NOT NULL DEFAULT true,
    "logoFullscreen" BOOLEAN NOT NULL DEFAULT false,
    "darkBgType" TEXT NOT NULL DEFAULT 'solid',
    "darkBgImageUrl" TEXT,
    "darkBgGradientFrom" TEXT NOT NULL DEFAULT '#9c6849',
    "darkBgGradientTo" TEXT NOT NULL DEFAULT '#2A2A2A',
    "darkBgGradientAngle" INTEGER NOT NULL DEFAULT 135,
    "salonAddress" TEXT,
    "salonCity" TEXT,
    "salonPhone" TEXT,
    "salonEmail" TEXT,
    "salonCompanyName" TEXT,
    "salonNip" TEXT,
    "salonLegalAddress" TEXT,
    "smtpHost" TEXT,
    "smtpPort" INTEGER DEFAULT 587,
    "smtpUser" TEXT,
    "smtpPass" TEXT,
    "smtpFrom" TEXT,
    "smtpSecure" BOOLEAN NOT NULL DEFAULT false,
    "googleClientId" TEXT,
    "googleClientSecret" TEXT,
    "appleClientId" TEXT,
    "appleTeamId" TEXT,
    "appleKeyId" TEXT,
    "applePrivateKey" TEXT,
    "telegramBotToken" TEXT,
    "telegramBotUsername" TEXT,
    "notifEmailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "notifTelegramEnabled" BOOLEAN NOT NULL DEFAULT false,
    "notifAdminChatId" TEXT,
    "notifReminder24hEnabled" BOOLEAN NOT NULL DEFAULT false,
    "notifReminder2hEnabled" BOOLEAN NOT NULL DEFAULT false,
    "enabledLocales" TEXT NOT NULL DEFAULT '["pl","en","uk"]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_TenantConfig" ("accentColor", "appleClientId", "appleKeyId", "applePrivateKey", "appleTeamId", "availableSlotColor", "bgApplyToDark", "bgGradientAngle", "bgGradientFrom", "bgGradientTo", "bgImageUrl", "bgType", "borderColor", "brandName", "cardColor", "createdAt", "darkAccentColor", "darkBgColor", "darkBgGradientAngle", "darkBgGradientFrom", "darkBgGradientTo", "darkBgImageUrl", "darkBgType", "darkBorderColor", "darkCardColor", "darkLogoUrl", "darkMutedColor", "darkPrimaryColor", "darkTextColor", "dayOffColor", "errorColor", "faviconUrl", "googleClientId", "googleClientSecret", "id", "logoFullscreen", "logoHeight", "logoLayer", "logoPages", "logoPositionX", "logoPositionY", "logoUrl", "logoWidth", "mutedColor", "notifAdminChatId", "notifEmailEnabled", "notifReminder24hEnabled", "notifReminder2hEnabled", "notifTelegramEnabled", "primaryColor", "salonAddress", "salonCity", "salonCompanyName", "salonEmail", "salonLegalAddress", "salonNip", "salonPhone", "secondaryColor", "smtpFrom", "smtpHost", "smtpPass", "smtpPort", "smtpSecure", "smtpUser", "successColor", "telegramBotToken", "telegramBotUsername", "textColor", "updatedAt", "workingHourEnd", "workingHourStart") SELECT "accentColor", "appleClientId", "appleKeyId", "applePrivateKey", "appleTeamId", "availableSlotColor", "bgApplyToDark", "bgGradientAngle", "bgGradientFrom", "bgGradientTo", "bgImageUrl", "bgType", "borderColor", "brandName", "cardColor", "createdAt", "darkAccentColor", "darkBgColor", "darkBgGradientAngle", "darkBgGradientFrom", "darkBgGradientTo", "darkBgImageUrl", "darkBgType", "darkBorderColor", "darkCardColor", "darkLogoUrl", "darkMutedColor", "darkPrimaryColor", "darkTextColor", "dayOffColor", "errorColor", "faviconUrl", "googleClientId", "googleClientSecret", "id", "logoFullscreen", "logoHeight", "logoLayer", "logoPages", "logoPositionX", "logoPositionY", "logoUrl", "logoWidth", "mutedColor", "notifAdminChatId", "notifEmailEnabled", "notifReminder24hEnabled", "notifReminder2hEnabled", "notifTelegramEnabled", "primaryColor", "salonAddress", "salonCity", "salonCompanyName", "salonEmail", "salonLegalAddress", "salonNip", "salonPhone", "secondaryColor", "smtpFrom", "smtpHost", "smtpPass", "smtpPort", "smtpSecure", "smtpUser", "successColor", "telegramBotToken", "telegramBotUsername", "textColor", "updatedAt", "workingHourEnd", "workingHourStart" FROM "TenantConfig";
DROP TABLE "TenantConfig";
ALTER TABLE "new_TenantConfig" RENAME TO "TenantConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
