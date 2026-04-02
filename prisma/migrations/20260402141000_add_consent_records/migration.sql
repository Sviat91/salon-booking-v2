-- CreateTable
CREATE TABLE "ConsentRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "phoneDigits" TEXT NOT NULL,
    "email" TEXT,
    "emailNormalized" TEXT,
    "fullName" TEXT NOT NULL,
    "normalizedName" TEXT NOT NULL,
    "consentDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ipHash" TEXT,
    "consentPrivacyV10" BOOLEAN NOT NULL,
    "consentTermsV10" BOOLEAN NOT NULL,
    "consentNotificationsV10" BOOLEAN NOT NULL,
    "consentWithdrawnDate" DATETIME,
    "withdrawalMethod" TEXT,
    "requestErasureDate" DATETIME,
    "erasureDate" DATETIME,
    "erasureMethod" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ConsentRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ConsentRecord_phoneDigits_normalizedName_consentDate_idx" ON "ConsentRecord"("phoneDigits", "normalizedName", "consentDate");

-- CreateIndex
CREATE INDEX "ConsentRecord_userId_consentDate_idx" ON "ConsentRecord"("userId", "consentDate");
