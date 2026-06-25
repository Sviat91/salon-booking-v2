/**
 * Main notification dispatcher.
 * All public functions never throw — errors are caught and written to NotificationLog.
 */

import prisma from '@/lib/prisma'
import { getTenantConfig } from '@/lib/tenant'
import { sendTelegramMessage } from './telegram'
import {
  sendBookingConfirmationToClient,
  sendBookingConfirmationToAdmin,
  sendBookingReminderToClient,
  sendContactFormToAdmin,
  type ContactFormData,
} from './email'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

async function logNotification(params: {
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

function formatDate(date: Date): string {
  return date.toLocaleDateString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

// ─────────────────────────────────────────────────────────────────────────────
// Booking confirmation
// ─────────────────────────────────────────────────────────────────────────────

export async function notifyBookingConfirmation(appointmentId: string): Promise<void> {
  try {
    const config = await getTenantConfig()
    const brandName = config.brandName || 'Salon Booking'

    if (!config.notifEmailEnabled && !config.notifTelegramEnabled) return

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        client: true,
        master: true,
        service: true,
      },
    })

    if (!appointment) {
      console.error('[notifications] Appointment not found:', appointmentId)
      return
    }

    const data = {
      name: appointment.client.name ?? 'Klient',
      date: formatDate(appointment.date),
      time: appointment.startTime,
      service: appointment.service.name,
      master: appointment.master.name ?? 'Mistrz',
    }

    // Email notifications
    if (config.notifEmailEnabled) {
      // Client copy
      if (appointment.client.email) {
        try {
          await sendBookingConfirmationToClient(appointment.client.email, data, brandName)
          await logNotification({
            type: 'BOOKING_CONFIRMATION',
            channel: 'email',
            appointmentId,
            recipientId: appointment.client.id,
            status: 'sent',
          })
        } catch (err) {
          await logNotification({
            type: 'BOOKING_CONFIRMATION',
            channel: 'email',
            appointmentId,
            recipientId: appointment.client.id,
            status: 'failed',
            error: String(err),
          })
        }
      }

      // Admin copy — use salonEmail if set
      const adminEmail = config.salonEmail ?? null
      if (adminEmail) {
        try {
          await sendBookingConfirmationToAdmin(adminEmail, data, brandName)
          await logNotification({
            type: 'BOOKING_CONFIRMATION',
            channel: 'email',
            appointmentId,
            status: 'sent',
          })
        } catch (err) {
          await logNotification({
            type: 'BOOKING_CONFIRMATION',
            channel: 'email',
            appointmentId,
            status: 'failed',
            error: String(err),
          })
        }
      }
    }

    // Telegram notification
    if (config.notifTelegramEnabled && config.telegramBotToken && config.notifAdminChatId) {
      const msg = `<b>Nowa rezerwacja</b>\n👤 ${data.name}\n💆 ${data.service}\n👩‍🎨 ${data.master}\n📅 ${data.date} ${data.time}`
      const err = await sendTelegramMessage(config.telegramBotToken, config.notifAdminChatId, msg)
      await logNotification({
        type: 'BOOKING_CONFIRMATION',
        channel: 'telegram',
        appointmentId,
        status: err ? 'failed' : 'sent',
        error: err?.message,
      })
    }
  } catch (err) {
    console.error('[notifications] notifyBookingConfirmation error:', err)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reminders — called by cron
// ─────────────────────────────────────────────────────────────────────────────

export async function notifyBookingReminders(): Promise<{ sent: number; skipped: number }> {
  let sent = 0
  let skipped = 0

  try {
    const config = await getTenantConfig()

    if (!config.notifReminder24hEnabled && !config.notifReminder2hEnabled) {
      return { sent, skipped }
    }

    if (!config.notifEmailEnabled && !config.notifTelegramEnabled) {
      return { sent, skipped }
    }

    const now = new Date()
    const brandName = config.brandName || 'Salon Booking'

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
        const dateStr = appt.date.toISOString().slice(0, 10) // "YYYY-MM-DD"
        // startTime is treated as UTC; correct for Vercel/cloud (always UTC). Local dev: ensure TZ=UTC or results will shift.
        const fullISO = `${dateStr}T${appt.startTime}:00.000Z`
        const apptDateTime = new Date(fullISO)
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

        const alreadyTelegram = await prisma.notificationLog.findFirst({
          where: {
            appointmentId: appt.id,
            type: window.type,
            channel: 'telegram',
            status: 'sent',
          },
        })

        const emailDone = alreadyEmail !== null || !config.notifEmailEnabled
        const telegramDone = alreadyTelegram !== null || !config.notifTelegramEnabled
        if (emailDone && telegramDone) {
          skipped++
          continue
        }

        const data = {
          name: appt.client.name ?? 'Klient',
          date: formatDate(appt.date),
          time: appt.startTime,
          service: appt.service.name,
          master: appt.master.name ?? 'Mistrz',
        }

        if (config.notifEmailEnabled && appt.client.email && !alreadyEmail) {
          try {
            await sendBookingReminderToClient(appt.client.email, data, window.hours, brandName)
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

        if (config.notifTelegramEnabled && config.telegramBotToken && config.notifAdminChatId && !alreadyTelegram) {
          const label = window.hours === 24 ? 'jutro' : 'za 2h'
          const msg = `<b>Przypomnienie o wizycie (${label})</b>\n👤 ${data.name}\n💆 ${data.service}\n👩‍🎨 ${data.master}\n📅 ${data.date} ${data.time}`
          const sendErr = await sendTelegramMessage(config.telegramBotToken, config.notifAdminChatId, msg)
          await logNotification({
            type: window.type,
            channel: 'telegram',
            appointmentId: appt.id,
            status: sendErr ? 'failed' : 'sent',
            error: sendErr?.message,
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

// ─────────────────────────────────────────────────────────────────────────────
// Contact form
// ─────────────────────────────────────────────────────────────────────────────

export async function notifyContactForm(data: ContactFormData): Promise<void> {
  try {
    const config = await getTenantConfig()
    const brandName = config.brandName || 'Salon Booking'

    if (!config.notifEmailEnabled && !config.notifTelegramEnabled) return

    const adminEmail = config.salonEmail ?? null

    if (config.notifEmailEnabled && adminEmail) {
      try {
        await sendContactFormToAdmin(adminEmail, data, brandName)
        await logNotification({ type: 'CONTACT_FORM', channel: 'email', status: 'sent' })
      } catch (err) {
        await logNotification({ type: 'CONTACT_FORM', channel: 'email', status: 'failed', error: String(err) })
      }
    }

    if (config.notifTelegramEnabled && config.telegramBotToken && config.notifAdminChatId) {
      const subjectLine = data.subject ? `\n📌 ${data.subject}` : ''
      const emailLine = data.senderEmail ? `\n📧 ${data.senderEmail}` : ''
      const msg = `<b>Formularz kontaktowy</b>${subjectLine}\n👤 ${data.senderName}${emailLine}\n\n${data.message}`
      const err = await sendTelegramMessage(config.telegramBotToken, config.notifAdminChatId, msg)
      await logNotification({
        type: 'CONTACT_FORM',
        channel: 'telegram',
        status: err ? 'failed' : 'sent',
        error: err?.message,
      })
    }
  } catch (err) {
    console.error('[notifications] notifyContactForm error:', err)
  }
}
