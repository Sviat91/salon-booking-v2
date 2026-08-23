/**
 * Booking reminders — called by cron.
 * Behavior-preserving extraction of the logic formerly inline in `index.ts` —
 * see `src/lib/AGENTS.md`'s 500-line rule.
 */
import prisma from '@/lib/prisma'
import { getTenantConfig } from '@/lib/tenant'
import { DEFAULT_BRAND_NAME } from '@/lib/constants/brand'
import { resolveLocalized } from '@/lib/localized-content'
import { DEFAULT_LANGUAGE, type Language } from '@/lib/i18n-shared'
import { sendClientBookingReminder } from './client-telegram'
import { logNotification, formatDate, appointmentStartUtc } from './internal'
import { sendBookingReminderToClient } from './email'
import { getSmsSender } from './sms'
import { loadReminderTemplates, resolveReminderBody } from './template-store'
import { renderTemplate, type TemplateVars } from './templates'

export async function notifyBookingReminders(): Promise<{ sent: number; skipped: number }> {
  let sent = 0
  let skipped = 0

  try {
    const config = await getTenantConfig()

    if (!config.notifReminder24hEnabled && !config.notifReminder2hEnabled) {
      return { sent, skipped }
    }

    if (!config.notifEmailEnabled && !config.clientBotEnabled && !config.notifSmsEnabled) {
      return { sent, skipped }
    }

    const now = new Date()
    const brandName = config.brandName || DEFAULT_BRAND_NAME
    const smsSender = getSmsSender(config)
    const smsTemplates = smsSender ? await loadReminderTemplates('sms') : null
    const emailTemplates = config.notifEmailEnabled ? await loadReminderTemplates('email') : null
    const clientBotUsable = config.clientBotEnabled && !!config.clientBotToken
    const telegramTemplates = clientBotUsable ? await loadReminderTemplates('telegram') : null

    interface ReminderWindowConfig {
      type: 'BOOKING_REMINDER_24H' | 'BOOKING_REMINDER_2H'
      hours: 24 | 2
      enabled: boolean
      targetDate: Date        // The calendar date (UTC midnight) appointments fall on
      windowFrom: Date        // Lower bound for reconstructed full datetime
      windowTo: Date          // Upper bound for reconstructed full datetime
    }

    // 24h window: appointments on tomorrow's date, post-filter ±1h around now+24h
    const tomorrowUTC = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
    ))
    const tomorrowPlusOneUTC = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 2,
    ))

    // 2h window: appointments on today's date, post-filter ±15m around now+2h
    const todayUTC = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
    ))
    const todayPlusOneUTC = new Date(Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate() + 1,
    ))

    const windows: ReminderWindowConfig[] = [
      {
        type: 'BOOKING_REMINDER_24H',
        hours: 24,
        enabled: config.notifReminder24hEnabled,
        targetDate: tomorrowUTC,
        windowFrom: new Date(now.getTime() + 23 * 3600_000),
        windowTo: new Date(now.getTime() + 25 * 3600_000),
      },
      {
        type: 'BOOKING_REMINDER_2H',
        hours: 2,
        enabled: config.notifReminder2hEnabled,
        targetDate: todayUTC,
        windowFrom: new Date(now.getTime() + 1.75 * 3600_000),
        windowTo: new Date(now.getTime() + 2.25 * 3600_000),
      },
    ]

    for (const window of windows) {
      if (!window.enabled) continue

      const targetDateEnd = window.hours === 24 ? tomorrowPlusOneUTC : todayPlusOneUTC

      const appointments = await prisma.appointment.findMany({
        where: {
          status: 'CONFIRMED',
          date: { gte: window.targetDate, lt: targetDateEnd },
        },
        include: { client: true, master: true, service: true },
      })

      // Post-filter: reconstruct full datetime from date + startTime and check window
      const filtered = appointments.filter((appt) => {
        const apptDateTime = appointmentStartUtc(appt.date, appt.startTime)
        return apptDateTime >= window.windowFrom && apptDateTime <= window.windowTo
      })

      for (const appt of filtered) {
        // Deduplication check — per channel, checked independently below
        const alreadyEmail = await prisma.notificationLog.findFirst({
          where: {
            appointmentId: appt.id,
            type: window.type,
            channel: 'email',
            status: 'sent',
          },
        })

        const alreadyClientTelegram = await prisma.notificationLog.findFirst({
          where: { appointmentId: appt.id, type: window.type, channel: 'telegram_client', status: 'sent' },
        })
        const clientTelegramEligible =
          config.clientBotEnabled && !!config.clientBotToken && !!appt.client.telegramChatId

        const alreadySms = await prisma.notificationLog.findFirst({
          where: { appointmentId: appt.id, type: window.type, channel: 'sms', status: 'sent' },
        })
        const smsEligible = !!smsSender && !!appt.client.phone

        const emailDone = alreadyEmail !== null || !config.notifEmailEnabled
        const clientTelegramDone = alreadyClientTelegram !== null || !clientTelegramEligible
        const smsDone = alreadySms !== null || !smsEligible
        if (emailDone && clientTelegramDone && smsDone) {
          skipped++
          continue
        }

        const reminderServiceVariants = {
          pl: appt.service.name_pl,
          en: appt.service.name_en,
          uk: appt.service.name_uk,
        }

        const data = {
          name: appt.client.name ?? 'Klient',
          date: formatDate(appt.date),
          time: appt.startTime,
          service: resolveLocalized(reminderServiceVariants, DEFAULT_LANGUAGE),
          master: appt.master.name ?? 'Mistrz',
        }

        // Client-facing reminder uses the client's booking-time language; Telegram salon reminder stays DEFAULT_LANGUAGE.
        const clientData = {
          ...data,
          service: resolveLocalized(reminderServiceVariants, appt.clientLanguage as Language),
        }

        const lang = (appt.clientLanguage as Language) || DEFAULT_LANGUAGE
        const templateVars: TemplateVars = {
          clientName: clientData.name,
          date: clientData.date,
          time: clientData.time,
          service: clientData.service,
          master: clientData.master,
          brandName,
        }

        if (config.notifEmailEnabled && appt.client.email && !alreadyEmail) {
          try {
            const emailBody = renderTemplate(
              resolveReminderBody(emailTemplates!, 'email', window.type, lang),
              templateVars
            )
            await sendBookingReminderToClient(appt.client.email, emailBody, window.hours, brandName, lang)
            await logNotification({
              type: window.type,
              channel: 'email',
              appointmentId: appt.id,
              recipientId: appt.client.id,
              status: 'sent',
            })
            sent++
          } catch (err) {
            await logNotification({
              type: window.type,
              channel: 'email',
              appointmentId: appt.id,
              recipientId: appt.client.id,
              status: 'failed',
              error: String(err),
            })
          }
        }

        if (clientTelegramEligible && !alreadyClientTelegram) {
          const telegramBody = renderTemplate(
            resolveReminderBody(telegramTemplates!, 'telegram', window.type, lang),
            templateVars
          )
          const sendErr = await sendClientBookingReminder({
            botToken: config.clientBotToken!,
            chatId: appt.client.telegramChatId!,
            text: telegramBody,
          })
          await logNotification({
            type: window.type,
            channel: 'telegram_client',
            appointmentId: appt.id,
            recipientId: appt.client.id,
            status: sendErr ? 'failed' : 'sent',
            error: sendErr ? sendErr.message : undefined,
          })
          if (!sendErr) sent++
        }

        if (smsEligible && !alreadySms) {
          const body = resolveReminderBody(smsTemplates!, 'sms', window.type, lang)
          const text = renderTemplate(body, templateVars)
          const sendErr = await smsSender!(appt.client.phone!, text)
          await logNotification({
            type: window.type,
            channel: 'sms',
            appointmentId: appt.id,
            recipientId: appt.client.id,
            status: sendErr ? 'failed' : 'sent',
            error: sendErr ? sendErr.message : undefined,
          })
          if (!sendErr) sent++
        }
      }
    }
  } catch (err) {
    console.error('[notifications] notifyBookingReminders error:', err)
  }

  return { sent, skipped }
}
