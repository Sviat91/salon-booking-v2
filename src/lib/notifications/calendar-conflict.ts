/**
 * Salon-facing notice that two entries in a master's calendar overlap
 * (typically a Google-origin block over a site booking). Never throws.
 * Copy is hardcoded Polish like every other salon-facing message.
 */
import { getTenantConfig } from '@/lib/tenant'
import { sendEmail } from '@/lib/email'
import { logNotification } from './internal'
import { broadcastToMasterBots } from './bots'
import { escapeHtml } from './templates'

export interface CalendarConflictInput {
  masterId: string
  masterName: string
  dateLabel: string
  first: { label: string; time: string }
  second: { label: string; time: string }
}

export async function notifyCalendarConflict(input: CalendarConflictInput): Promise<void> {
  try {
    const config = await getTenantConfig()
    const { masterId, masterName, dateLabel, first, second } = input

    if (config.notifTelegramEnabled) {
      const msg =
        `<b>⚠️ Konflikt w kalendarzu</b>\n👩‍🎨 ${escapeHtml(masterName)}\n📅 ${escapeHtml(dateLabel)}\n` +
        `• ${escapeHtml(first.label)} (${escapeHtml(first.time)})\n• ${escapeHtml(second.label)} (${escapeHtml(second.time)})`

      await broadcastToMasterBots({ masterId, html: msg, type: 'CALENDAR_CONFLICT' })
    }

    if (config.notifEmailEnabled && config.salonEmail) {
      try {
        const html =
          `<p><b>Konflikt w kalendarzu</b></p><p>Mistrz: ${escapeHtml(masterName)}<br>Data: ${escapeHtml(dateLabel)}</p>` +
          `<ul><li>${escapeHtml(first.label)} (${escapeHtml(first.time)})</li>` +
          `<li>${escapeHtml(second.label)} (${escapeHtml(second.time)})</li></ul>`
        await sendEmail({ to: config.salonEmail, subject: `Konflikt w kalendarzu — ${masterName}`, html })
        await logNotification({ type: 'CALENDAR_CONFLICT', channel: 'email', status: 'sent' })
      } catch (err) {
        await logNotification({ type: 'CALENDAR_CONFLICT', channel: 'email', status: 'failed', error: String(err) })
      }
    }
  } catch (err) {
    console.error('[notifications] notifyCalendarConflict error:', err)
  }
}
