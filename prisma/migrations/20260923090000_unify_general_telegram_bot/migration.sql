-- Data migration: fold the legacy general salon bot into the unified
-- NotificationBot table as one enabled, ALL-scope, admin-owned bot.
--
-- The token is copied VERBATIM on purpose: src/lib/encryption.ts's decrypt()
-- returns any string that is not `iv:authTag:data` (3 colon-separated parts)
-- unchanged, and a Telegram token has exactly one colon. So both storage
-- forms this column has historically held — plaintext (old
-- api/admin/notification-settings) and encrypted (api/admin/social-settings)
-- — resolve correctly through decrypt(bot.token) in src/lib/notifications/bots.ts.
-- SQL cannot call encrypt() (AES-GCM keyed off AUTH_SECRET).
--
-- TenantConfig.telegramBotToken/telegramBotUsername are NOT cleared: they still
-- back the Telegram login widget. TelegramNotificationRecipient rows are copied,
-- not deleted.
INSERT INTO "NotificationBot" ("id", "label", "token", "username", "enabled", "scope", "ownerId", "createdAt", "updatedAt")
SELECT
    'legacy_general_bot',
    COALESCE(NULLIF(TRIM("telegramBotUsername"), ''), 'Telegram'),
    "telegramBotToken",
    NULLIF(TRIM("telegramBotUsername"), ''),
    true,
    'ALL',
    NULL,
    "createdAt",
    "updatedAt"
FROM "TenantConfig"
WHERE "telegramBotToken" IS NOT NULL AND TRIM("telegramBotToken") <> ''
LIMIT 1;

INSERT INTO "NotificationBotRecipient" ("id", "botId", "chatId", "label", "createdAt")
SELECT
    'legacy_' || r."id",
    'legacy_general_bot',
    r."chatId",
    r."label",
    r."createdAt"
FROM "TelegramNotificationRecipient" r
WHERE EXISTS (SELECT 1 FROM "NotificationBot" b WHERE b."id" = 'legacy_general_bot');
