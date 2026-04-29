-- DropIndex
DROP INDEX "User_phone_key";

-- DropIndex
DROP INDEX "User_email_key";

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN "notes" TEXT;

-- AlterTable
ALTER TABLE "MasterProfile" ADD COLUMN "color" TEXT DEFAULT '#166534';

-- AlterTable
ALTER TABLE "User" ADD COLUMN "adminPermissions" TEXT;

-- CreateTable
CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_TenantConfig" ("accentColor", "borderColor", "brandName", "cardColor", "createdAt", "darkAccentColor", "darkBgColor", "darkBorderColor", "darkCardColor", "darkLogoUrl", "darkMutedColor", "darkPrimaryColor", "darkTextColor", "errorColor", "faviconUrl", "id", "logoHeight", "logoLayer", "logoPages", "logoPositionX", "logoPositionY", "logoUrl", "logoWidth", "mutedColor", "primaryColor", "secondaryColor", "successColor", "textColor", "updatedAt") SELECT "accentColor", "borderColor", "brandName", "cardColor", "createdAt", "darkAccentColor", "darkBgColor", "darkBorderColor", "darkCardColor", "darkLogoUrl", "darkMutedColor", "darkPrimaryColor", "darkTextColor", "errorColor", "faviconUrl", "id", "logoHeight", "logoLayer", "logoPages", "logoPositionX", "logoPositionY", "logoUrl", "logoWidth", "mutedColor", "primaryColor", "secondaryColor", "successColor", "textColor", "updatedAt" FROM "TenantConfig";
DROP TABLE "TenantConfig";
ALTER TABLE "new_TenantConfig" RENAME TO "TenantConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "PasswordResetToken_token_idx" ON "PasswordResetToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");
