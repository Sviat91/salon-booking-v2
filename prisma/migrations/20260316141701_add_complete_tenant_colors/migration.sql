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
    "successColor" TEXT NOT NULL DEFAULT '#21A67A',
    "errorColor" TEXT NOT NULL DEFAULT '#D84E4E',
    "darkBgColor" TEXT NOT NULL DEFAULT '#9c6849',
    "darkTextColor" TEXT NOT NULL DEFAULT '#FFFFFF',
    "darkMutedColor" TEXT NOT NULL DEFAULT '#D0D0D0',
    "darkBorderColor" TEXT NOT NULL DEFAULT '#7A4F35',
    "darkCardColor" TEXT NOT NULL DEFAULT '#2A2A2A',
    "logoUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_TenantConfig" ("brandName", "createdAt", "id", "logoUrl", "primaryColor", "secondaryColor", "updatedAt") SELECT "brandName", "createdAt", "id", "logoUrl", "primaryColor", "secondaryColor", "updatedAt" FROM "TenantConfig";
DROP TABLE "TenantConfig";
ALTER TABLE "new_TenantConfig" RENAME TO "TenantConfig";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
