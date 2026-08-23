/**
 * Shared internals for the notification dispatcher (extracted from index.ts per the 500-line file guard).
 */

import prisma from '@/lib/prisma'
import { sendTelegramMessage } from './telegram'
import { fromZonedTime } from 'date-fns-tz'
import { SCHEDULE_TZ } from '@/lib/schedule-utils'

/**
 * Reconstructs an appointment's absolute UTC instant from its stored
 * `date` (UTC midnight) + `startTime` ("HH:MM", Warsaw local wall-clock
 * as written by booking-service.ts). DST-aware.
 */
export function appointmentStartUtc(date: Date, startTime: string): Date {
  const dateStr = date.toISOString().slice(0, 10)
  return fromZonedTime(`${dateStr}T${startTime}:00`, SCHEDULE_TZ)
}

export async function logNotification(params: {
  type: string
  channel: string
  appointmentId?: string
  recipientId?: string
  status: 'sent' | 'failed' | 'skipped'
  error?: string
}) {
  try {
    await prisma.notificationLog.create({
      data: {
        type: params.type,
        channel: params.channel,
        appointmentId: params.appointmentId ?? null,
        recipientId: params.recipientId ?? null,
        status: params.status,
        error: params.error ?? null,
      },
    })
  } catch (err) {
    console.error('[notifications] Failed to write NotificationLog:', err)
  }
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export async function getTelegramRecipients(): Promise<string[]> {
  const rows = await prisma.telegramNotificationRecipient.findMany({ select: { chatId: true } })
  return rows.map((r) => r.chatId)
}

export async function broadcastTelegram(
  botToken: string,
  recipients: string[],
  html: string
): Promise<{ anySuccess: boolean; lastError: Error | null }> {
  let anySuccess = false
  let lastError: Error | null = null
  for (const chatId of recipients) {
    const err = await sendTelegramMessage(botToken, chatId, html)
    if (err) {
      lastError = err
    } else {
      anySuccess = true
    }
  }
  return { anySuccess, lastError }
}

export type BookingActor = 'client' | 'master' | 'admin'

export function actorLabel(actor: BookingActor, masterName?: string | null): string {
  switch (actor) {
    case 'client':
      return 'Klient'
    case 'admin':
      return 'Administrator'
    case 'master':
      return masterName ? `Mistrz ${masterName}` : 'Mistrz'
  }
}

export interface BookingUpdateSnapshot {
  date: Date
  startTime: string
  serviceId: string
  serviceName: string
}

export function buildBookingUpdateMessage(input: {
  clientName: string
  masterName: string
  previous: BookingUpdateSnapshot
  current: BookingUpdateSnapshot
  actorLabel: string
}): string | null {
  const { clientName, masterName, previous, current } = input
  const serviceChanged = previous.serviceId !== current.serviceId
  const dateTimeChanged =
    previous.date.getTime() !== current.date.getTime() || previous.startTime !== current.startTime

  if (!serviceChanged && !dateTimeChanged) return null

  const lines = [`<b>✏️ Rezerwacja zaktualizowana</b>`, `👤 ${clientName}`, `👩‍🎨 ${masterName}`]

  if (serviceChanged) {
    lines.push(`💆 było: ${previous.serviceName}`)
    lines.push(`💆 jest: ${current.serviceName}`)
  }

  if (dateTimeChanged) {
    lines.push(`📅 było: ${formatDate(previous.date)} ${previous.startTime}`)
    lines.push(`📅 jest: ${formatDate(current.date)} ${current.startTime}`)
  }

  lines.push(`✍️ Zmienione przez: ${input.actorLabel}`)

  return lines.join('\n')
}
