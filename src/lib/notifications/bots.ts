/**
 * Dispatches a pre-rendered notification message to every enabled
 * NotificationBot matching a scope filter. This is the only salon Telegram
 * notification mechanism (the legacy general bot was folded into this table
 * by migration 20260923090000_unify_general_telegram_bot). Never throws.
 */
import type { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import { broadcastTelegram, logNotification } from './internal'

export const BOT_SCOPES = ['ALL', 'SELECTED'] as const
export type BotScope = (typeof BOT_SCOPES)[number]

async function dispatchToBots(
  where: Prisma.NotificationBotWhereInput,
  params: { html: string; type: string; appointmentId?: string }
): Promise<void> {
  const { html, type, appointmentId } = params

  const bots = await prisma.notificationBot.findMany({
    where,
    select: { id: true, label: true, token: true, recipients: { select: { chatId: true } } },
  })

  let attempted = 0
  let anySuccess = false
  let lastError: string | null = null

  for (const bot of bots) {
    if (bot.recipients.length === 0) continue

    const token = decrypt(bot.token)
    if (!token) continue

    attempted++
    const chatIds = bot.recipients.map((r) => r.chatId)
    const res = await broadcastTelegram(token, chatIds, html)
    if (res.anySuccess) anySuccess = true
    if (res.lastError) lastError = `${bot.label}: ${res.lastError.message}`
  }

  if (attempted === 0) return

  await logNotification({
    type,
    channel: 'telegram_bot',
    appointmentId,
    status: anySuccess ? 'sent' : 'failed',
    error: lastError ?? undefined,
  })
}

export async function broadcastToMasterBots(params: {
  masterId: string
  html: string
  type: string
  appointmentId?: string
}): Promise<void> {
  try {
    const { masterId, ...rest } = params
    await dispatchToBots({ enabled: true, OR: [{ scope: 'ALL' }, { masters: { some: { masterId } } }] }, rest)
  } catch (err) {
    console.error('[notifications] broadcastToMasterBots error:', err)
  }
}

export async function broadcastToAllScopeBots(params: {
  html: string
  type: string
  appointmentId?: string
}): Promise<void> {
  try {
    await dispatchToBots({ enabled: true, scope: 'ALL' }, params)
  } catch (err) {
    console.error('[notifications] broadcastToAllScopeBots error:', err)
  }
}
