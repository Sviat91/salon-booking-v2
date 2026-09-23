-- CreateTable
CREATE TABLE "NotificationBot" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "username" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "scope" TEXT NOT NULL DEFAULT 'SELECTED',
    "ownerId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationBot_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationBotMaster" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "botId" TEXT NOT NULL,
    "masterId" TEXT NOT NULL,
    CONSTRAINT "NotificationBotMaster_botId_fkey" FOREIGN KEY ("botId") REFERENCES "NotificationBot" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NotificationBotMaster_masterId_fkey" FOREIGN KEY ("masterId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationBotRecipient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "botId" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationBotRecipient_botId_fkey" FOREIGN KEY ("botId") REFERENCES "NotificationBot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "NotificationBot_ownerId_idx" ON "NotificationBot"("ownerId");

-- CreateIndex
CREATE INDEX "NotificationBotMaster_masterId_idx" ON "NotificationBotMaster"("masterId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationBotMaster_botId_masterId_key" ON "NotificationBotMaster"("botId", "masterId");

-- CreateIndex
CREATE INDEX "NotificationBotRecipient_botId_idx" ON "NotificationBotRecipient"("botId");
