/**
 * Main notification dispatcher.
 * All public functions never throw — errors are caught and written to NotificationLog.
 */
import prisma from '@/lib/prisma'
import { getTenantConfig } from '@/lib/tenant'
import { DEFAULT_BRAND_NAME } from '@/lib/constants/brand'
import { resolveLocalized } from '@/lib/localized-content'
import { DEFAULT_LANGUAGE, type Language } from '@/lib/i18n-shared'
import { resolveAppointmentPrice, discountPercentFromSnapshot } from '@/lib/discounts/shared'
import { sendClientBookingReminder } from './client-telegram'
import {
  logNotification,
  formatDate,
  getTelegramRecipients,
  broadcastTelegram,
  actorLabel,
  buildBookingUpdateMessage,
  type BookingActor,
} from './internal'
import {
  sendBookingConfirmationToClient,
  sendBookingConfirmationToAdmin,
  sendBookingReminderToClient,
  sendContactFormToAdmin,
  type ContactFormData,
} from './email'

// ─────────────────────────────────────────────────────────────────────────────
// Booking confirmation
// ─────────────────────────────────────────────────────────────────────────────

export async function notifyBookingConfirmation(appointmentId: string, actor: BookingActor): Promise<void> {
  try {
    const config = await getTenantConfig()
    const brandName = config.brandName || DEFAULT_BRAND_NAME

    if (!config.notifEmailEnabled && !config.notifTelegramEnabled) return

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        client: true,
        master: true,
        service: true,
        discount: { select: { label: true, percent: true } },
      },
    })

    if (!appointment) {
      console.error('[notifications] Appointment not found:', appointmentId)
      return
    }

    const serviceVariants = {
      pl: appointment.service.name_pl,
      en: appointment.service.name_en,
      uk: appointment.service.name_uk,
    }

    const data = {
      name: appointment.client.name ?? 'Klient',
      date: formatDate(appointment.date),
      time: appointment.startTime,
      service: resolveLocalized(serviceVariants, DEFAULT_LANGUAGE),
      master: appointment.master.name ?? 'Mistrz',
    }

    // Client-facing copy uses the client's booking-time language; admin/salon copy stays DEFAULT_LANGUAGE.
    const clientData = {
      ...data,
      service: resolveLocalized(serviceVariants, appointment.clientLanguage as Language),
    }

    // Email notifications
    if (config.notifEmailEnabled) {
      // Client copy
      if (appointment.client.email) {
        try {
          await sendBookingConfirmationToClient(
            appointment.client.email,
            clientData,
            brandName,
            (appointment.clientLanguage as Language) || DEFAULT_LANGUAGE
          )
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
    if (config.notifTelegramEnabled && config.telegramBotToken) {
      const recipients = await getTelegramRecipients()
      if (recipients.length > 0) {
        const finalPrice = resolveAppointmentPrice(appointment.finalPrice, appointment.service.price)
        const discountPercent =
          appointment.discount?.percent ??
          discountPercentFromSnapshot(appointment.originalPrice, appointment.finalPrice)
        const priceLine =
          appointment.discountId && discountPercent != null && appointment.originalPrice != null
            ? `💰 <s>${appointment.originalPrice} zł</s> ${finalPrice} zł (-${discountPercent}%${appointment.discount?.label ? ` ${appointment.discount.label}` : ''})`
            : `💰 ${finalPrice} zł`
        const msg = `<b>Nowa rezerwacja</b>\n👤 ${data.name}\n💆 ${data.service}\n👩‍🎨 ${data.master}\n📅 ${data.date} ${data.time}\n${priceLine}\n✍️ Utworzone przez: ${actorLabel(actor, appointment.master.name)}`
        const { anySuccess, lastError } = await broadcastTelegram(config.telegramBotToken, recipients, msg)
        await logNotification({
          type: 'BOOKING_CONFIRMATION',
          channel: 'telegram',
          appointmentId,
          status: anySuccess ? 'sent' : 'failed',
          error: lastError?.message,
        })
      }
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

    if (!config.notifEmailEnabled && !config.clientBotEnabled) {
      return { sent, skipped }
    }

    const now = new Date()
    const brandName = config.brandName || DEFAULT_BRAND_NAME

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

        const alreadyClientTelegram = await prisma.notificationLog.findFirst({
          where: { appointmentId: appt.id, type: window.type, channel: 'telegram_client', status: 'sent' },
        })
        const clientTelegramEligible =
          config.clientBotEnabled && !!config.clientBotToken && !!appt.client.telegramChatId

        const emailDone = alreadyEmail !== null || !config.notifEmailEnabled
        const clientTelegramDone = alreadyClientTelegram !== null || !clientTelegramEligible
        if (emailDone && clientTelegramDone) {
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

        if (config.notifEmailEnabled && appt.client.email && !alreadyEmail) {
          try {
            await sendBookingReminderToClient(
              appt.client.email,
              clientData,
              window.hours,
              brandName,
              (appt.clientLanguage as Language) || DEFAULT_LANGUAGE
            )
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
          const sendErr = await sendClientBookingReminder({
            botToken: config.clientBotToken!,
            chatId: appt.client.telegramChatId!,
            lang: (appt.clientLanguage as Language) || DEFAULT_LANGUAGE,
            hours: window.hours,
            labels: {
              master: clientData.master,
              service: clientData.service,
              date: clientData.date,
              time: clientData.time,
            },
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
      }
    }
  } catch (err) {
    console.error('[notifications] notifyBookingReminders error:', err)
  }

  return { sent, skipped }
}

// ─────────────────────────────────────────────────────────────────────────────
// Cancellation
// ─────────────────────────────────────────────────────────────────────────────

type CancellationAppointment = {
  id: string
  date: Date
  startTime: string
  client: { name: string | null }
  master: { name: string | null }
  service: { name_pl: string; name_en: string | null; name_uk: string | null }
}

export async function notifyBookingCancellation(
  appointment: CancellationAppointment,
  actor: BookingActor
): Promise<void> {
  try {
    const config = await getTenantConfig()

    if (!config.notifTelegramEnabled || !config.telegramBotToken) return

    const recipients = await getTelegramRecipients()
    if (recipients.length === 0) return

    const serviceVariants = {
      pl: appointment.service.name_pl,
      en: appointment.service.name_en,
      uk: appointment.service.name_uk,
    }

    const name = appointment.client.name ?? 'Klient'
    const service = resolveLocalized(serviceVariants, DEFAULT_LANGUAGE)
    const master = appointment.master.name ?? 'Mistrz'
    const date = formatDate(appointment.date)

    const msg = `<b>❌ Rezerwacja odwołana</b>\n👤 ${name}\n💆 ${service}\n👩‍🎨 ${master}\n📅 ${date} ${appointment.startTime}\n✍️ Odwołane przez: ${actorLabel(actor, appointment.master.name)}`
    const { anySuccess, lastError } = await broadcastTelegram(config.telegramBotToken, recipients, msg)
    await logNotification({
      type: 'BOOKING_CANCELLATION',
      channel: 'telegram',
      appointmentId: appointment.id,
      status: anySuccess ? 'sent' : 'failed',
      error: lastError?.message,
    })
  } catch (err) {
    console.error('[notifications] notifyBookingCancellation error:', err)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Update (service and/or date/time change after creation)
// ─────────────────────────────────────────────────────────────────────────────

export async function notifyBookingUpdate(
  appointmentId: string,
  previous: { date: Date; startTime: string; serviceId: string; serviceName: string },
  actor: BookingActor
): Promise<void> {
  try {
    const config = await getTenantConfig()

    if (!config.notifTelegramEnabled || !config.telegramBotToken) return

    const appointment = await prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: { client: true, master: true, service: true },
    })

    if (!appointment) {
      console.error('[notifications] Appointment not found:', appointmentId)
      return
    }

    const serviceVariants = {
      pl: appointment.service.name_pl,
      en: appointment.service.name_en,
      uk: appointment.service.name_uk,
    }

    const current = {
      date: appointment.date,
      startTime: appointment.startTime,
      serviceId: appointment.serviceId,
      serviceName: resolveLocalized(serviceVariants, DEFAULT_LANGUAGE),
    }

    const msg = buildBookingUpdateMessage({
      clientName: appointment.client.name ?? 'Klient',
      masterName: appointment.master.name ?? 'Mistrz',
      previous,
      current,
      actorLabel: actorLabel(actor, appointment.master.name),
    })

    if (!msg) return

    const recipients = await getTelegramRecipients()
    if (recipients.length === 0) return

    const { anySuccess, lastError } = await broadcastTelegram(config.telegramBotToken, recipients, msg)
    await logNotification({
      type: 'BOOKING_UPDATE',
      channel: 'telegram',
      appointmentId,
      status: anySuccess ? 'sent' : 'failed',
      error: lastError?.message,
    })
  } catch (err) {
    console.error('[notifications] notifyBookingUpdate error:', err)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Contact form
// ─────────────────────────────────────────────────────────────────────────────

export async function notifyContactForm(data: ContactFormData): Promise<void> {
  try {
    const config = await getTenantConfig()
    const brandName = config.brandName || DEFAULT_BRAND_NAME

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

    if (config.notifTelegramEnabled && config.telegramBotToken) {
      const recipients = await getTelegramRecipients()
      if (recipients.length > 0) {
        const subjectLine = data.subject ? `\n📌 ${data.subject}` : ''
        const emailLine = data.senderEmail ? `\n📧 ${data.senderEmail}` : ''
        const msg = `<b>Formularz kontaktowy</b>${subjectLine}\n👤 ${data.senderName}${emailLine}\n\n${data.message}`
        const { anySuccess, lastError } = await broadcastTelegram(config.telegramBotToken, recipients, msg)
        await logNotification({
          type: 'CONTACT_FORM',
          channel: 'telegram',
          status: anySuccess ? 'sent' : 'failed',
          error: lastError?.message,
        })
      }
    }
  } catch (err) {
    console.error('[notifications] notifyContactForm error:', err)
  }
}
