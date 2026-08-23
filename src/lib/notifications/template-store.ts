/**
 * Prisma-backed reads of admin-authored NotificationTemplate rows.
 * Pairs with the pure rendering/default logic in templates.ts.
 */

import prisma from '@/lib/prisma'
import type { Language } from '@/lib/i18n-shared'
import { DEFAULT_LANGUAGE } from '@/lib/i18n-shared'
import { DEFAULT_REMINDER_BODIES, type ReminderChannel, type ReminderType } from './templates'

/**
 * Loads every NotificationTemplate row for a given channel, keyed by
 * `${type}:${language}`. Call once per cron run, not per appointment.
 */
export async function loadReminderTemplates(channel: string): Promise<Map<string, string>> {
  const rows = await prisma.notificationTemplate.findMany({ where: { channel } })
  const map = new Map<string, string>()
  for (const row of rows) {
    map.set(`${row.type}:${row.language}`, row.body)
  }
  return map
}

/**
 * Resolves the body to send for (channel, type, language): the admin-authored
 * row if present, else the built-in default, else the `pl` default.
 */
export function resolveReminderBody(
  templates: Map<string, string>,
  channel: ReminderChannel,
  type: ReminderType,
  language: Language
): string {
  const stored = templates.get(`${type}:${language}`)
  if (stored) return stored
  return DEFAULT_REMINDER_BODIES[channel][type][language] ?? DEFAULT_REMINDER_BODIES[channel][type][DEFAULT_LANGUAGE]
}
