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
  sendContactFormToAdmin,
  type ContactFormData,
} from './email'

export { notifyBookingReminders } from './reminders'

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
