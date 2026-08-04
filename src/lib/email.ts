/**
 * Email transport layer — powered by nodemailer + SMTP stored in TenantConfig.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * ⚡ REUSE NOTE: This module is the single email transport for the entire app.
 *   Future features (booking confirmations, reminders, master notifications,
 *   marketing campaigns) should add NEW template functions here and call
 *   sendEmail() — do NOT create separate transports.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Configuration: Admin Panel → Email Settings → fill SMTP fields once.
 * Supports any provider: Gmail, Outlook, Hostinger, OVH, custom SMTP, etc.
 */

import nodemailer from 'nodemailer'
import prisma from '@/lib/prisma'
import { decrypt } from '@/lib/encryption'
import { DEFAULT_BRAND_NAME } from '@/lib/constants/brand'

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  auth: { user: string; pass: string }
  from: string      // full from-address, e.g. "Salon Beauty <info@salon.pl>"
  brandName: string
}

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
}

// ─────────────────────────────────────────────────────────────────────────────
// SMTP config loader
// Reads TenantConfig from DB. Returns null if SMTP is not yet configured.
// ─────────────────────────────────────────────────────────────────────────────

export async function getSmtpConfig(): Promise<SmtpConfig | null> {
  try {
    const config = await prisma.tenantConfig.findFirst()

    if (!config?.smtpHost || !config?.smtpUser || !config?.smtpPass) {
      return null // SMTP not configured yet — silently skip sending
    }

    let from = config.smtpFrom?.trim() || config.smtpUser
    // If the user only enter "Salon Beauty" instead of "Salon Beauty <email@...>", we fix it
    if (from && !from.includes('<') && config.smtpUser) {
      from = `"${from}" <${config.smtpUser}>`
    }
    
    const brandName = config.brandName || DEFAULT_BRAND_NAME
    
    const decryptedPass = decrypt(config.smtpPass)

    return {
      host: config.smtpHost,
      port: config.smtpPort ?? 587,
      secure: config.smtpSecure ?? false,
      auth: { user: config.smtpUser, pass: decryptedPass || '' },
      from,
      brandName,
    }
  } catch (err) {
    console.error('[email] Failed to load SMTP config from TenantConfig:', err)
    return null
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Core send function
// Creates a fresh transporter per call (stateless, safe for serverless).
// ─────────────────────────────────────────────────────────────────────────────

export async function sendEmail({ to, subject, html }: SendEmailOptions): Promise<void> {
  const smtp = await getSmtpConfig()

  if (!smtp) {
    // SMTP not configured — log once and return silently.
    // The API route should NOT expose this error to the end-user.
    console.error('[email] SMTP is not configured. Go to Admin Panel → Email Settings.')
    return
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure, // true = SSL (port 465), false = STARTTLS (port 587)
    auth: smtp.auth,
  })

  await transporter.sendMail({
    from: smtp.from,
    to,
    subject,
    html,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Template: Password Reset
// Called by POST /api/auth/forgot-password
// ─────────────────────────────────────────────────────────────────────────────

export async function sendPasswordResetEmail(
  to: string,
  resetUrl: string
): Promise<void> {
  const smtp = await getSmtpConfig()
  const brandName = smtp?.brandName ?? DEFAULT_BRAND_NAME

  const html = buildPasswordResetHtml(resetUrl, brandName)

  await sendEmail({
    to,
    subject: `${brandName} — Reset your password`,
    html,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// HTML builder: Password Reset email
// Plain inline-CSS HTML — maximum email client compatibility.
// ─────────────────────────────────────────────────────────────────────────────

function buildPasswordResetHtml(resetUrl: string, brandName: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Reset your password</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0"
               style="background:#ffffff;border-radius:12px;padding:40px 32px;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Brand name -->
          <tr>
            <td style="padding-bottom:24px;border-bottom:1px solid #eee;text-align:center;">
              <span style="font-size:22px;font-weight:700;color:#1a1a1a;">${brandName}</span>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding-top:28px;">
              <p style="margin:0 0 8px;font-size:18px;font-weight:600;color:#1a1a1a;">
                Reset your password
              </p>
              <p style="margin:0 0 24px;font-size:14px;color:#555;line-height:1.6;">
                We received a request to reset the password for your account.
                Click the button below to choose a new password.
              </p>

              <!-- CTA button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding-bottom:24px;">
                    <a href="${resetUrl}"
                       style="display:inline-block;padding:14px 32px;background:#1a1a1a;color:#ffffff;
                              text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;
                              letter-spacing:0.3px;">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 8px;font-size:13px;color:#888;line-height:1.6;">
                This link will expire in <strong>1 hour</strong>.
              </p>
              <p style="margin:0;font-size:13px;color:#888;line-height:1.6;">
                If you didn't request a password reset, you can safely ignore this email —
                your password will not be changed.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding-top:28px;border-top:1px solid #eee;text-align:center;">
              <p style="margin:0;font-size:12px;color:#bbb;">
                © ${new Date().getFullYear()} ${brandName}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`.trim()
}
