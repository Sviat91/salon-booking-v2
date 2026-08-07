/**
 * Email notification templates for the booking system.
 * All functions call sendEmail() from src/lib/email.ts.
 * Never throw — errors propagate as thrown exceptions caught by the caller.
 *
 * Client-facing templates (confirmation/reminder to the client) take a
 * `lang: Language` param and render via `emailT()` (`emailNotif.*` keys) —
 * 2026-08-07 fix: they used to hardcode Polish chrome (headings/labels/
 * subject) even though the caller already resolved `data.service` into the
 * client's actual booking-time language, so e.g. an English-language booking
 * got an English service name inside an otherwise all-Polish email. Admin/
 * salon-facing templates (`sendBookingConfirmationToAdmin`,
 * `sendContactFormToAdmin`) intentionally stay hardcoded Polish — that's the
 * salon operator's own language, not the client's, and is unaffected by this.
 */

import { sendEmail } from '@/lib/email'
import { emailT } from './email-i18n'
import type { Language } from '@/lib/i18n-shared'

export interface BookingData {
  name: string
  date: string
  time: string
  service: string
  master: string
}

export interface ContactFormData {
  senderName: string
  senderEmail?: string
  message: string
  subject?: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Booking confirmation — client copy
// ─────────────────────────────────────────────────────────────────────────────

export async function sendBookingConfirmationToClient(
  to: string,
  data: BookingData,
  brandName: string,
  lang: Language
): Promise<void> {
  const t = emailT(lang)
  const year = new Date().getFullYear()
  const subject = t('emailNotif.confirmation.subject', { brandName })
  const html = `
<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
<tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0"
       style="background:#ffffff;border-radius:12px;padding:40px 32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<tr><td style="padding-bottom:24px;border-bottom:1px solid #eee;text-align:center;">
  <span style="font-size:22px;font-weight:700;color:#1a1a1a;">${brandName}</span>
</td></tr>
<tr><td style="padding-top:28px;">
  <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#1a1a1a;">${t('emailNotif.confirmation.heading')}</p>
  <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6;">
    ${t('emailNotif.confirmation.greeting', { name: data.name })}
  </p>
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#f9f9f9;border-radius:8px;padding:16px;margin-bottom:24px;">
    <tr><td style="padding:4px 0;font-size:14px;color:#555;">
      <strong>${t('emailNotif.confirmation.serviceLabel')}:</strong> ${data.service}
    </td></tr>
    <tr><td style="padding:4px 0;font-size:14px;color:#555;">
      <strong>${t('emailNotif.confirmation.masterLabel')}:</strong> ${data.master}
    </td></tr>
    <tr><td style="padding:4px 0;font-size:14px;color:#555;">
      <strong>${t('emailNotif.confirmation.dateLabel')}:</strong> ${data.date}
    </td></tr>
    <tr><td style="padding:4px 0;font-size:14px;color:#555;">
      <strong>${t('emailNotif.confirmation.timeLabel')}:</strong> ${data.time}
    </td></tr>
  </table>
</td></tr>
<tr><td style="padding-top:28px;border-top:1px solid #eee;text-align:center;">
  <p style="margin:0;font-size:12px;color:#bbb;">${t('emailNotif.confirmation.footer', { year, brandName })}</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`.trim()

  await sendEmail({ to, subject, html })
}

// ─────────────────────────────────────────────────────────────────────────────
// Booking confirmation — admin copy
// ─────────────────────────────────────────────────────────────────────────────

export async function sendBookingConfirmationToAdmin(
  to: string,
  data: BookingData,
  brandName: string
): Promise<void> {
  const html = `
<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
<tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0"
       style="background:#ffffff;border-radius:12px;padding:40px 32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<tr><td style="padding-bottom:24px;border-bottom:1px solid #eee;text-align:center;">
  <span style="font-size:22px;font-weight:700;color:#1a1a1a;">${brandName}</span>
</td></tr>
<tr><td style="padding-top:28px;">
  <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#1a1a1a;">Nowa rezerwacja</p>
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#f9f9f9;border-radius:8px;padding:16px;margin-bottom:24px;">
    <tr><td style="padding:4px 0;font-size:14px;color:#555;"><strong>Klient:</strong> ${data.name}</td></tr>
    <tr><td style="padding:4px 0;font-size:14px;color:#555;"><strong>Usługa:</strong> ${data.service}</td></tr>
    <tr><td style="padding:4px 0;font-size:14px;color:#555;"><strong>Mistrz:</strong> ${data.master}</td></tr>
    <tr><td style="padding:4px 0;font-size:14px;color:#555;"><strong>Data:</strong> ${data.date}</td></tr>
    <tr><td style="padding:4px 0;font-size:14px;color:#555;"><strong>Godzina:</strong> ${data.time}</td></tr>
  </table>
</td></tr>
<tr><td style="padding-top:28px;border-top:1px solid #eee;text-align:center;">
  <p style="margin:0;font-size:12px;color:#bbb;">© ${new Date().getFullYear()} ${brandName}</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`.trim()

  await sendEmail({ to, subject: `${brandName} — Nowa rezerwacja: ${data.name}`, html })
}

// ─────────────────────────────────────────────────────────────────────────────
// Booking reminder — client copy
// ─────────────────────────────────────────────────────────────────────────────

export async function sendBookingReminderToClient(
  to: string,
  data: BookingData,
  hoursAhead: 24 | 2,
  brandName: string,
  lang: Language
): Promise<void> {
  const t = emailT(lang)
  const year = new Date().getFullYear()
  const when = hoursAhead === 24 ? t('emailNotif.reminder.whenTomorrow') : t('emailNotif.reminder.whenSoon')
  const subject = t('emailNotif.reminder.subject', { brandName, when })
  const html = `
<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
<tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0"
       style="background:#ffffff;border-radius:12px;padding:40px 32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<tr><td style="padding-bottom:24px;border-bottom:1px solid #eee;text-align:center;">
  <span style="font-size:22px;font-weight:700;color:#1a1a1a;">${brandName}</span>
</td></tr>
<tr><td style="padding-top:28px;">
  <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#1a1a1a;">${t('emailNotif.reminder.heading')}</p>
  <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6;">
    ${t('emailNotif.reminder.greeting', { name: data.name, when: `<strong>${when}</strong>` })}
  </p>
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#f9f9f9;border-radius:8px;padding:16px;margin-bottom:24px;">
    <tr><td style="padding:4px 0;font-size:14px;color:#555;"><strong>${t('emailNotif.confirmation.serviceLabel')}:</strong> ${data.service}</td></tr>
    <tr><td style="padding:4px 0;font-size:14px;color:#555;"><strong>${t('emailNotif.confirmation.masterLabel')}:</strong> ${data.master}</td></tr>
    <tr><td style="padding:4px 0;font-size:14px;color:#555;"><strong>${t('emailNotif.confirmation.dateLabel')}:</strong> ${data.date}</td></tr>
    <tr><td style="padding:4px 0;font-size:14px;color:#555;"><strong>${t('emailNotif.confirmation.timeLabel')}:</strong> ${data.time}</td></tr>
  </table>
</td></tr>
<tr><td style="padding-top:28px;border-top:1px solid #eee;text-align:center;">
  <p style="margin:0;font-size:12px;color:#bbb;">${t('emailNotif.reminder.footer', { year, brandName })}</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`.trim()

  await sendEmail({ to, subject, html })
}

// ─────────────────────────────────────────────────────────────────────────────
// Contact form — admin copy
// ─────────────────────────────────────────────────────────────────────────────

export async function sendContactFormToAdmin(
  to: string,
  data: ContactFormData,
  brandName: string
): Promise<void> {
  const subjectLine = data.subject ? ` — ${data.subject}` : ''
  const html = `
<!DOCTYPE html><html lang="pl"><head><meta charset="UTF-8"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
<tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0"
       style="background:#ffffff;border-radius:12px;padding:40px 32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
<tr><td style="padding-bottom:24px;border-bottom:1px solid #eee;text-align:center;">
  <span style="font-size:22px;font-weight:700;color:#1a1a1a;">${brandName}</span>
</td></tr>
<tr><td style="padding-top:28px;">
  <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#1a1a1a;">Nowa wiadomość z formularza</p>
  <table width="100%" cellpadding="0" cellspacing="0"
         style="background:#f9f9f9;border-radius:8px;padding:16px;margin-bottom:16px;">
    <tr><td style="padding:4px 0;font-size:14px;color:#555;"><strong>Od:</strong> ${data.senderName}</td></tr>
    ${data.senderEmail ? `<tr><td style="padding:4px 0;font-size:14px;color:#555;"><strong>Email:</strong> ${data.senderEmail}</td></tr>` : ''}
    ${data.subject ? `<tr><td style="padding:4px 0;font-size:14px;color:#555;"><strong>Temat:</strong> ${data.subject}</td></tr>` : ''}
  </table>
  <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#333;">Wiadomość:</p>
  <p style="margin:0;font-size:14px;color:#555;line-height:1.6;white-space:pre-wrap;">${data.message}</p>
</td></tr>
<tr><td style="padding-top:28px;border-top:1px solid #eee;text-align:center;">
  <p style="margin:0;font-size:12px;color:#bbb;">© ${new Date().getFullYear()} ${brandName}</p>
</td></tr>
</table>
</td></tr>
</table>
</body></html>`.trim()

  await sendEmail({
    to,
    subject: `${brandName} — Formularz kontaktowy${subjectLine}: ${data.senderName}`,
    html,
  })
}
