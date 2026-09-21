/**
 * Salon-facing notice that two entries in a master's calendar overlap
 * (typically a Google-origin block over a site booking). Never throws.
 * Copy is hardcoded Polish like every other salon-facing message.
 */
import { getTenantConfig } from '@/lib/tenant'
import { sendEmail } from '@/lib/email'
import { logNotification, getTelegramRecipients, broadcastTelegram } from './internal'
import { escapeHtml } from './templates'

export interface CalendarConflictInput {
  masterName: string
  dateLabel: string
  first: { label: string; time: string }
  second: { label: string; time: string }
}

export async function notifyCalendarConflict(input: CalendarConflictInput): Promise<void> {
  try {
    const config = await getTenantConfig()
    const { masterName, dateLabel, first, second } = input

    if (config.notifTelegramEnabled && config.telegramBotToken) {
      const recipients = await getTelegramRecipients()
      if (recipients.length > 0) {
        const msg =
          `<b>⚠️ Konflikt w kalendarzu</b>\n👩‍🎨 ${escapeHtml(masterName)}\n📅 ${escapeHtml(dateLabel)}\n` +
          `• ${escapeHtml(first.label)} (${escapeHtml(first.time)})\n• ${escapeHtml(second.label)} (${escapeHtml(second.time)})`
        const { anySuccess, lastError } = await broadcastTelegram(config.telegramBotToken, recipients, msg)
        await logNotification({
          type: 'CALENDAR_CONFLICT',
          channel: 'telegram',
          status: anySuccess ? 'sent' : 'failed',
          error: lastError?.message,
        })
      }
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
