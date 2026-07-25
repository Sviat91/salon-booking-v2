-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Page" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ownerType" TEXT NOT NULL,
    "masterId" TEXT,
    "slug" TEXT NOT NULL,
    "title_pl" TEXT,
    "title_en" TEXT,
    "title_uk" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "visibility" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Page_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Page" ("createdAt", "enabled", "id", "masterId", "order", "ownerType", "slug", "title_en", "title_pl", "title_uk", "updatedAt", "visibility") SELECT "createdAt", "enabled", "id", "masterId", "order", "ownerType", "slug", "title_en", "title_pl", "title_uk", "updatedAt", "visibility" FROM "Page";
DROP TABLE "Page";
ALTER TABLE "new_Page" RENAME TO "Page";
CREATE UNIQUE INDEX "Page_ownerType_masterId_slug_key" ON "Page"("ownerType", "masterId", "slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

