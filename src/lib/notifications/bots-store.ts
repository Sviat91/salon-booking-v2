/**
 * bots-store.ts
 *
 * Shared Zod schemas + CRUD + authorization for `NotificationBot`, imported by
 * both `api/admin/notification-bots/**` and `api/master/notification-bots/**`
 * (AD-12 — one definition, not duplicated per route). Prisma-backed.
 *
 * A bot token is never selected or returned by anything in this module — see
 * `hasToken` on `SerializedBot` (AD-9).
 */
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { encrypt, decrypt } from '@/lib/encryption'
import { getTelegramBotInfo } from './telegram'
import { BOT_SCOPES, type BotScope } from './bots'

/** Telegram's `<bot_id>:<secret>` token shape. */
const BOT_TOKEN_PATTERN = /^\d+:[A-Za-z0-9_-]{20,}$/

// ---------------------------------------------------------------------------
// Schemas (AD-12)
// ---------------------------------------------------------------------------

const labelSchema = z.string().trim().min(1).max(64)
const tokenSchema = z.string().trim().max(256)
const recipientSchema = z.object({
  chatId: z.string().trim().min(1).max(64),
  label: z.string().trim().max(64).optional(),
})
const recipientsSchema = z.array(recipientSchema).max(50)
const masterIdsSchema = z.array(z.string()).max(50)

export const AdminCreateBotSchema = z.object({
  label: labelSchema,
  token: tokenSchema.min(1),
  enabled: z.boolean().optional(),
  scope: z.enum(BOT_SCOPES),
  masterIds: masterIdsSchema.optional(),
  recipients: recipientsSchema.optional(),
})
export type AdminCreateBotInput = z.infer<typeof AdminCreateBotSchema>

export const AdminUpdateBotSchema = z.object({
  label: labelSchema.optional(),
  token: tokenSchema.optional(),
  enabled: z.boolean().optional(),
  scope: z.enum(BOT_SCOPES).optional(),
  masterIds: masterIdsSchema.optional(),
  recipients: recipientsSchema.optional(),
})
export type AdminUpdateBotInput = z.infer<typeof AdminUpdateBotSchema>

export const MasterCreateBotSchema = z.object({
  label: labelSchema,
  token: tokenSchema.min(1),
  enabled: z.boolean().optional(),
  recipients: recipientsSchema.optional(),
})
export type MasterCreateBotInput = z.infer<typeof MasterCreateBotSchema>

export const MasterUpdateBotSchema = z.object({
  label: labelSchema.optional(),
  token: tokenSchema.optional(),
  enabled: z.boolean().optional(),
  recipients: recipientsSchema.optional(),
})
export type MasterUpdateBotInput = z.infer<typeof MasterUpdateBotSchema>

// ---------------------------------------------------------------------------
// Authorization (AD-3) — row-targeted, mirrors canManageDiscount/canManagePage
// ---------------------------------------------------------------------------

export function canManageBot(
  user: { id?: string; role?: string } | null | undefined,
  bot: { ownerId: string | null }
): boolean {
  if (!user) return false
  if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') return true
  if (user.role === 'MASTER') return !!user.id && bot.ownerId === user.id
  return false
}

/** Minimal row for a canManageBot() check before a PATCH/DELETE/test. */
export async function findBotOwner(id: string): Promise<{ id: string; ownerId: string | null } | null> {
  return prisma.notificationBot.findUnique({ where: { id }, select: { id: true, ownerId: true } })
}

// ---------------------------------------------------------------------------
// Serialization — never selects/returns `token`
// ---------------------------------------------------------------------------

export interface SerializedBot {
  id: string
  label: string
  username: string | null
  enabled: boolean
  scope: BotScope
  masterIds: string[]
  scopeMasterNames: string[]
  ownerId: string | null
  ownerName: string | null
  hasToken: boolean
  recipients: { chatId: string; label: string | null }[]
}

const botSelect = {
  id: true,
  label: true,
  username: true,
  enabled: true,
  scope: true,
  ownerId: true,
  owner: { select: { name: true } },
  masters: { select: { masterId: true, master: { select: { name: true } } } },
  recipients: { select: { chatId: true, label: true } },
} as const

interface BotRow {
  id: string
  label: string
  username: string | null
  enabled: boolean
  scope: string
  ownerId: string | null
  owner: { name: string | null } | null
  masters: { masterId: string; master: { name: string | null } }[]
  recipients: { chatId: string; label: string | null }[]
}

function serializeBot(row: BotRow): SerializedBot {
  return {
    id: row.id,
    label: row.label,
    username: row.username,
    enabled: row.enabled,
    scope: row.scope as BotScope,
    masterIds: row.masters.map((m) => m.masterId),
    scopeMasterNames: row.masters.map((m) => m.master.name ?? ''),
    ownerId: row.ownerId,
    ownerName: row.owner?.name ?? null,
    // `token` is a required column — every row has one and it is never
    // selected here, so this is a constant, not a derived leak.
    hasToken: true,
    recipients: row.recipients.map((r) => ({ chatId: r.chatId, label: r.label })),
  }
}

async function getBot(id: string): Promise<SerializedBot | null> {
  const row = await prisma.notificationBot.findUnique({ where: { id }, select: botSelect })
  return row ? serializeBot(row) : null
}

export async function listBots(params: { ownerId?: string }): Promise<SerializedBot[]> {
  const rows = await prisma.notificationBot.findMany({
    where: params.ownerId !== undefined ? { ownerId: params.ownerId } : {},
    orderBy: { createdAt: 'desc' },
    select: botSelect,
  })
  return rows.map(serializeBot)
}

// ---------------------------------------------------------------------------
// Writes (AD-8 — full-replace of masters/recipients, AD-9/AD-10 — token+test)
// ---------------------------------------------------------------------------

function sanitizeRecipients(
  recipients: { chatId: string; label?: string }[]
): { chatId: string; label: string | null }[] {
  return recipients
    .map((r) => ({ chatId: r.chatId.trim(), label: r.label?.trim() || null }))
    .filter((r) => r.chatId.length > 0)
}

async function refreshUsernameBestEffort(botId: string, token: string): Promise<'ok' | 'failed'> {
  const info = await getTelegramBotInfo(token)
  if (!info.ok) return 'failed'
  await prisma.notificationBot.update({ where: { id: botId }, data: { username: info.username } })
  return 'ok'
}

export type WriteBotResult =
  | { ok: true; bot: SerializedBot; tokenCheck: 'ok' | 'failed' | null }
  | { ok: false; code: 'VALIDATION_ERROR' | 'BOT_TOKEN_INVALID' | 'BOT_SCOPE_REQUIRED' | 'NOT_FOUND'; status: number }

export async function createBot(
  input: {
    label: string
    token: string
    enabled?: boolean
    scope: BotScope
    masterIds?: string[]
    recipients?: { chatId: string; label?: string }[]
  },
  ctx: { ownerId: string | null }
): Promise<WriteBotResult> {
  const label = input.label.trim()
  const token = input.token.trim()
  if (!BOT_TOKEN_PATTERN.test(token)) return { ok: false, code: 'BOT_TOKEN_INVALID', status: 400 }

  const masterIds = Array.from(new Set(input.masterIds ?? []))
  if (input.scope === 'SELECTED' && masterIds.length === 0) {
    return { ok: false, code: 'BOT_SCOPE_REQUIRED', status: 400 }
  }
  if (masterIds.length > 0) {
    const validCount = await prisma.user.count({ where: { id: { in: masterIds }, role: 'MASTER' } })
    if (validCount !== masterIds.length) return { ok: false, code: 'VALIDATION_ERROR', status: 400 }
  }

  const recipients = sanitizeRecipients(input.recipients ?? [])
  const encryptedToken = encrypt(token) as string

  const created = await prisma.$transaction(async (tx) => {
    const bot = await tx.notificationBot.create({
      data: { label, token: encryptedToken, enabled: input.enabled ?? true, scope: input.scope, ownerId: ctx.ownerId },
    })
    if (masterIds.length > 0) {
      await tx.notificationBotMaster.createMany({ data: masterIds.map((masterId) => ({ botId: bot.id, masterId })) })
    }
    if (recipients.length > 0) {
      await tx.notificationBotRecipient.createMany({
        data: recipients.map((r) => ({ botId: bot.id, chatId: r.chatId, label: r.label })),
      })
    }
    return bot
  })

  const tokenCheck = await refreshUsernameBestEffort(created.id, token)
  const bot = await getBot(created.id)
  return { ok: true, bot: bot as SerializedBot, tokenCheck }
}

export async function updateBot(
  id: string,
  input: {
    label?: string
    token?: string
    enabled?: boolean
    scope?: BotScope
    masterIds?: string[]
    recipients?: { chatId: string; label?: string }[]
  }
): Promise<WriteBotResult> {
  const existing = await prisma.notificationBot.findUnique({
    where: { id },
    select: { id: true, scope: true, masters: { select: { masterId: true } } },
  })
  if (!existing) return { ok: false, code: 'NOT_FOUND', status: 404 }

  let masterIds: string[] | undefined
  if (input.masterIds !== undefined) {
    masterIds = Array.from(new Set(input.masterIds))
    if (masterIds.length > 0) {
      const validCount = await prisma.user.count({ where: { id: { in: masterIds }, role: 'MASTER' } })
      if (validCount !== masterIds.length) return { ok: false, code: 'VALIDATION_ERROR', status: 400 }
    }
  }

  // Validate the bot's resulting EFFECTIVE state, not the request in isolation:
  // an omitted field means "keep the existing value", so merge against the
  // current row before applying the scope/masterIds invariant.
  const effectiveScope = input.scope ?? (existing.scope as BotScope)
  const effectiveMasterIds = masterIds ?? existing.masters.map((m) => m.masterId)
  if (effectiveScope === 'SELECTED' && effectiveMasterIds.length === 0) {
    return { ok: false, code: 'BOT_SCOPE_REQUIRED', status: 400 }
  }

  const data: Record<string, unknown> = {}
  if (input.label !== undefined) data.label = input.label.trim()
  if (input.enabled !== undefined) data.enabled = input.enabled
  if (input.scope !== undefined) data.scope = input.scope

  let newPlainToken: string | null = null
  if (input.token !== undefined) {
    const trimmed = input.token.trim()
    if (!trimmed) return { ok: false, code: 'VALIDATION_ERROR', status: 400 }
    if (!BOT_TOKEN_PATTERN.test(trimmed)) return { ok: false, code: 'BOT_TOKEN_INVALID', status: 400 }
    data.token = encrypt(trimmed)
    newPlainToken = trimmed
  }

  await prisma.$transaction(async (tx) => {
    if (Object.keys(data).length > 0) {
      await tx.notificationBot.update({ where: { id }, data })
    }
    if (masterIds !== undefined) {
      await tx.notificationBotMaster.deleteMany({ where: { botId: id } })
      if (masterIds.length > 0) {
        await tx.notificationBotMaster.createMany({ data: masterIds.map((masterId) => ({ botId: id, masterId })) })
      }
    }
    if (input.recipients !== undefined) {
      const recipients = sanitizeRecipients(input.recipients)
      await tx.notificationBotRecipient.deleteMany({ where: { botId: id } })
      if (recipients.length > 0) {
        await tx.notificationBotRecipient.createMany({
          data: recipients.map((r) => ({ botId: id, chatId: r.chatId, label: r.label })),
        })
      }
    }
  })

  const tokenCheck = newPlainToken ? await refreshUsernameBestEffort(id, newPlainToken) : null
  const bot = await getBot(id)
  return { ok: true, bot: bot as SerializedBot, tokenCheck }
}

export async function deleteBot(id: string): Promise<void> {
  await prisma.notificationBot.delete({ where: { id } })
}

/**
 * Telegram `getMe`, mirroring `testMasterCalendar` (AD-10). Uses the supplied
 * token when given (test-before-save), else decrypts the stored one — and
 * only persists a refreshed `username` when the stored token was the one
 * actually tested.
 */
export async function testBotToken(
  botId: string,
  rawToken?: string
): Promise<
  | { ok: true; username: string | null }
  | { ok: false; status: number; code: 'BOT_TOKEN_INVALID' | 'TELEGRAM_API_ERROR' }
> {
  const suppliedToken = rawToken?.trim()
  let token = suppliedToken || null
  const usingStored = !token

  if (usingStored) {
    const bot = await prisma.notificationBot.findUnique({ where: { id: botId }, select: { token: true } })
    if (!bot) return { ok: false, status: 400, code: 'BOT_TOKEN_INVALID' }
    token = decrypt(bot.token)
  }

  if (!token || !BOT_TOKEN_PATTERN.test(token)) {
    return { ok: false, status: 400, code: 'BOT_TOKEN_INVALID' }
  }

  const info = await getTelegramBotInfo(token)
  if (!info.ok) {
    if (info.status === 401 || info.status === 404) return { ok: false, status: 400, code: 'BOT_TOKEN_INVALID' }
    return { ok: false, status: 502, code: 'TELEGRAM_API_ERROR' }
  }

  if (usingStored) {
    await prisma.notificationBot.update({ where: { id: botId }, data: { username: info.username } })
  }
  return { ok: true, username: info.username }
}
