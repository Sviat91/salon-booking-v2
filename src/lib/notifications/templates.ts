/**
 * Reminder template rendering (SMS / email / Telegram) — pure, Prisma-free, React-free.
 * 100% unit-testable with no mocks (same rationale as discounts/eligibility.ts).
 */

import type { Language } from '@/lib/i18n-shared'

export const REMINDER_TEMPLATE_TYPES = ['BOOKING_REMINDER_24H', 'BOOKING_REMINDER_2H'] as const
export type ReminderType = (typeof REMINDER_TEMPLATE_TYPES)[number]

export const REMINDER_CHANNELS = ['sms', 'email', 'telegram'] as const
export type ReminderChannel = (typeof REMINDER_CHANNELS)[number]

/** Per-channel body cap. SMS is cost-capped; Telegram's own hard limit is 4096. */
export const MAX_BODY_LENGTH: Record<ReminderChannel, number> = {
  sms: 640,
  email: 2000,
  telegram: 2000,
}

export const TEMPLATE_PLACEHOLDERS = ['clientName', 'date', 'time', 'service', 'master', 'brandName'] as const
export type Placeholder = (typeof TEMPLATE_PLACEHOLDERS)[number]
export type TemplateVars = Record<Placeholder, string>

const PLACEHOLDER_RE = /\{\{\s*(\w+)\s*\}\}/g

/**
 * Substitutes `{{placeholder}}` tokens with values from `vars`. A known
 * placeholder is replaced; an unknown one is left literal so a typo is
 * visible in the preview/SMS, never silently blanked. No HTML escaping —
 * this is plain text.
 */
export function renderTemplate(body: string, vars: TemplateVars): string {
  return body.replace(PLACEHOLDER_RE, (match, token: string) => {
    if ((TEMPLATE_PLACEHOLDERS as readonly string[]).includes(token)) {
      return vars[token as Placeholder]
    }
    return match
  })
}

export function validateTemplateBody(body: string): { ok: true } | { ok: false; unknown: string[] } {
  const unknown: string[] = []
  for (const match of body.matchAll(PLACEHOLDER_RE)) {
    const token = match[1]
    if (!(TEMPLATE_PLACEHOLDERS as readonly string[]).includes(token) && !unknown.includes(token)) {
      unknown.push(token)
    }
  }
  return unknown.length > 0 ? { ok: false, unknown } : { ok: true }
}

/**
 * Escapes a rendered plain-text body for safe interpolation into an HTML
 * email. Applied AFTER renderTemplate(), so it covers both the admin's
 * template text and every substituted value in one pass — and it is what
 * guarantees an admin cannot break the email's layout (locked decision:
 * the admin edits content, never markup).
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// GSM 7-bit default alphabet + extension table (basic set used by SMS carriers).
const GSM7_CHARS =
  '@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞ\x1bÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'
const GSM7_EXT_CHARS = '^{}\\[~]|€'

function isGsm7(text: string): boolean {
  for (const ch of text) {
    if (!GSM7_CHARS.includes(ch) && !GSM7_EXT_CHARS.includes(ch)) return false
  }
  return true
}

export interface SmsSegmentEstimate {
  chars: number
  encoding: 'gsm7' | 'ucs2'
  segments: number
}

/**
 * Estimates SMS segment count/cost. GSM-7 encoding allows 160 chars/segment
 * (153 when concatenated across multiple segments); UCS-2 (required for
 * Polish/Ukrainian diacritics) allows 70 chars/segment (67 when concatenated).
 */
export function estimateSmsSegments(text: string): SmsSegmentEstimate {
  const chars = text.length
  const encoding: 'gsm7' | 'ucs2' = isGsm7(text) ? 'gsm7' : 'ucs2'

  if (chars === 0) return { chars, encoding, segments: 0 }

  const singleLimit = encoding === 'gsm7' ? 160 : 70
  const multiLimit = encoding === 'gsm7' ? 153 : 67

  const segments = chars <= singleLimit ? 1 : Math.ceil(chars / multiLimit)
  return { chars, encoding, segments }
}

export const DEFAULT_REMINDER_BODIES: Record<
  ReminderChannel,
  Record<ReminderType, Record<Language, string>>
> = {
  sms: {
    BOOKING_REMINDER_24H: {
      pl: '{{brandName}}: przypominamy o wizycie jutro o {{time}} — {{service}}.',
      en: '{{brandName}}: reminder — your {{service}} appointment is tomorrow at {{time}}.',
      uk: '{{brandName}}: нагадуємо про візит завтра о {{time}} — {{service}}.',
    },
    BOOKING_REMINDER_2H: {
      pl: '{{brandName}}: Twoja wizyta ({{service}}) zaczyna się o {{time}}.',
      en: '{{brandName}}: your {{service}} appointment starts at {{time}}.',
      uk: '{{brandName}}: ваш візит ({{service}}) розпочнеться о {{time}}.',
    },
  },
  email: {
    BOOKING_REMINDER_24H: {
      pl: 'Cześć {{clientName}}!\n\nPrzypominamy o Twojej wizycie jutro o {{time}}.\n\nUsługa: {{service}}\nMistrz: {{master}}\nData: {{date}}\nGodzina: {{time}}\n\nDo zobaczenia!\n{{brandName}}',
      en: 'Hi {{clientName}},\n\nThis is a reminder about your appointment tomorrow at {{time}}.\n\nService: {{service}}\nSpecialist: {{master}}\nDate: {{date}}\nTime: {{time}}\n\nSee you soon!\n{{brandName}}',
      uk: 'Привіт, {{clientName}}!\n\nНагадуємо про ваш візит завтра о {{time}}.\n\nПослуга: {{service}}\nМайстер: {{master}}\nДата: {{date}}\nЧас: {{time}}\n\nДо зустрічі!\n{{brandName}}',
    },
    BOOKING_REMINDER_2H: {
      pl: 'Cześć {{clientName}}!\n\nTwoja wizyta zaczyna się już za 2 godziny, o {{time}}.\n\nUsługa: {{service}}\nMistrz: {{master}}\nData: {{date}}\nGodzina: {{time}}\n\nDo zobaczenia!\n{{brandName}}',
      en: 'Hi {{clientName}},\n\nYour appointment starts in 2 hours, at {{time}}.\n\nService: {{service}}\nSpecialist: {{master}}\nDate: {{date}}\nTime: {{time}}\n\nSee you soon!\n{{brandName}}',
      uk: 'Привіт, {{clientName}}!\n\nВаш візит розпочнеться за 2 години, о {{time}}.\n\nПослуга: {{service}}\nМайстер: {{master}}\nДата: {{date}}\nЧас: {{time}}\n\nДо зустрічі!\n{{brandName}}',
    },
  },
  telegram: {
    BOOKING_REMINDER_24H: {
      pl: '⏰ Przypomnienie: Twoja wizyta jest jutro\n\n👤 Specjalista: {{master}}\n💇 Usługa: {{service}}\n📅 Data: {{date}}\n🕐 Godzina: {{time}}',
      en: '⏰ Reminder: your appointment is tomorrow\n\n👤 Specialist: {{master}}\n💇 Service: {{service}}\n📅 Date: {{date}}\n🕐 Time: {{time}}',
      uk: '⏰ Нагадування: ваш візит завтра\n\n👤 Спеціаліст: {{master}}\n💇 Послуга: {{service}}\n📅 Дата: {{date}}\n🕐 Час: {{time}}',
    },
    BOOKING_REMINDER_2H: {
      pl: '⏰ Przypomnienie: Twoja wizyta jest za 2 godziny\n\n👤 Specjalista: {{master}}\n💇 Usługa: {{service}}\n📅 Data: {{date}}\n🕐 Godzina: {{time}}',
      en: '⏰ Reminder: your appointment is in 2 hours\n\n👤 Specialist: {{master}}\n💇 Service: {{service}}\n📅 Date: {{date}}\n🕐 Time: {{time}}',
      uk: '⏰ Нагадування: ваш візит за 2 години\n\n👤 Спеціаліст: {{master}}\n💇 Послуга: {{service}}\n📅 Дата: {{date}}\n🕐 Час: {{time}}',
    },
  },
}
