/**
 * Inline (and, for the contact step, reply) keyboard builders for the
 * Telegram client booking bot. Group 1 shipped the language picker; Group 2
 * added master/procedure keyboards; Group 3 added the calendar + time-slot
 * keyboards; Group 4 adds the contact/consent/confirm keyboards. Keep all
 * `callback_data` short (<64 bytes, Telegram's hard limit).
 */
import { InlineKeyboard, Keyboard } from 'grammy'
import { formatInTimeZone } from 'date-fns-tz'
import { LANGUAGE_NAMES, type Language } from '@/lib/i18n-shared'
import { SCHEDULE_TZ } from '@/lib/schedule-utils'
import { resolveLocalized } from '@/lib/localized-content'
import { botT } from './i18n'
import { buildMonthGrid, weekdayLabels, monthLabel } from './calendar-utils'
import type { BookableMaster, BookableProcedure } from './catalog'
import type { WizardSlot } from './wizard-state'

/** One button per enabled language (`TenantConfig.enabledLocales`), one per row, callback_data `lang:<code>`. */
export function languageKeyboard(enabledLocales: Language[]): InlineKeyboard {
  const keyboard = new InlineKeyboard()
  enabledLocales.forEach((lang, index) => {
    keyboard.text(LANGUAGE_NAMES[lang], `lang:${lang}`)
    if (index < enabledLocales.length - 1) keyboard.row()
  })
  return keyboard
}

/** One button per master (one per row), callback_data `m:<masterId>`, plus a back-to-language button. */
export function mastersKeyboard(masters: BookableMaster[], lang: Language): InlineKeyboard {
  const t = botT(lang)
  const keyboard = new InlineKeyboard()
  masters.forEach((master) => {
    keyboard.text(master.name, `m:${master.id}`).row()
  })
  keyboard.text(t('bot.common.back'), 'back:lang')
  return keyboard
}

/** One button per procedure (name · duration · price), callback_data `p:<procedureId>`, plus a back-to-master button. */
export function proceduresKeyboard(procedures: BookableProcedure[], lang: Language): InlineKeyboard {
  const t = botT(lang)
  const currency = t('common.currency')
  const keyboard = new InlineKeyboard()
  procedures.forEach((procedure) => {
    const label = `${resolveLocalized(procedure.nameField, lang)} · ${procedure.duration}min · ${procedure.price} ${currency}`
    keyboard.text(label, `p:${procedure.id}`).row()
  })
  keyboard.text(t('bot.common.back'), 'back:master')
  return keyboard
}

/**
 * Month calendar: nav row (`cal:prev`/`cal:next`, noop `nop` when out of the
 * booking horizon), localized weekday header row, 4–6 week rows (blank/past/
 * unavailable days render as noop `·` cells, bookable days as `d:<date>`),
 * and a final back row. `availableDates` holds `'YYYY-MM-DD'` strings that
 * already have `hasWindow: true` (caller resolves the horizon/duration).
 */
export function calendarKeyboard(params: {
  month: string
  lang: Language
  availableDates: Set<string>
  hasPrevMonth: boolean
  hasNextMonth: boolean
}): InlineKeyboard {
  const { month, lang, availableDates, hasPrevMonth, hasNextMonth } = params
  const t = botT(lang)
  const keyboard = new InlineKeyboard()

  keyboard
    .text(hasPrevMonth ? '‹' : ' ', hasPrevMonth ? 'cal:prev' : 'nop')
    .text(monthLabel(month, lang), 'nop')
    .text(hasNextMonth ? '›' : ' ', hasNextMonth ? 'cal:next' : 'nop')
    .row()

  weekdayLabels(lang).forEach((label) => keyboard.text(label, 'nop'))
  keyboard.row()

  buildMonthGrid(month).forEach((week) => {
    week.forEach((date) => {
      if (date && availableDates.has(date)) {
        keyboard.text(String(Number(date.slice(-2))), `d:${date}`)
      } else {
        keyboard.text('·', 'nop')
      }
    })
    keyboard.row()
  })

  keyboard.text(t('bot.common.back'), 'back:procedure')
  return keyboard
}

/** Number of time-slot buttons shown per page in `slotsKeyboard`. */
export const SLOTS_PAGE_SIZE = 24

/**
 * Paginated `HH:mm` time-slot buttons, 3 per row, callback `t:<idx>` where
 * `idx` indexes into the caller's full (unpaginated) `slots` array. Adds a
 * `sp:prev`/`sp:next` pagination row only when there is more than one page,
 * plus a final back-to-date row.
 */
export function slotsKeyboard(params: { slots: WizardSlot[]; page: number; lang: Language }): InlineKeyboard {
  const { slots, page, lang } = params
  const t = botT(lang)
  const keyboard = new InlineKeyboard()

  const start = page * SLOTS_PAGE_SIZE
  const pageSlots = slots.slice(start, start + SLOTS_PAGE_SIZE)

  pageSlots.forEach((slot, i) => {
    const label = formatInTimeZone(new Date(slot.startISO), SCHEDULE_TZ, 'HH:mm')
    keyboard.text(label, `t:${start + i}`)
    if ((i + 1) % 3 === 0) keyboard.row()
  })
  if (pageSlots.length % 3 !== 0) keyboard.row()

  const hasPrev = start > 0
  const hasNext = start + SLOTS_PAGE_SIZE < slots.length
  if (hasPrev || hasNext) {
    keyboard
      .text(hasPrev ? '‹' : ' ', hasPrev ? 'sp:prev' : 'nop')
      .text(hasNext ? '›' : ' ', hasNext ? 'sp:next' : 'nop')
      .row()
  }

  keyboard.text(t('bot.common.back'), 'back:date')
  return keyboard
}

/** Reply keyboard with a single native "share contact" button, shown for the CONTACT step. */
export function contactKeyboard(lang: Language): Keyboard {
  const t = botT(lang)
  return new Keyboard().requestContact(t('bot.contact.button')).resized().oneTime()
}

/**
 * Inline agree/decline buttons for the CONSENT step, preceded by `/terms`/
 * `/privacy` URL button rows when the caller resolved a real absolute site
 * URL (Telegram rejects relative-path URLs for `url`-type buttons — the
 * caller must pass `undefined` rather than a relative path when unavailable).
 */
export function consentKeyboard(lang: Language, links: { termsUrl?: string; privacyUrl?: string }): InlineKeyboard {
  const t = botT(lang)
  const keyboard = new InlineKeyboard()
  if (links.termsUrl) {
    keyboard.url(t('bot.consent.termsButton'), links.termsUrl).row()
  }
  if (links.privacyUrl) {
    keyboard.url(t('bot.consent.privacyButton'), links.privacyUrl).row()
  }
  keyboard.text(t('bot.consent.agree'), 'consent:yes').row().text(t('bot.consent.decline'), 'consent:no')
  return keyboard
}

/**
 * Inline confirm/promo/back-to-time buttons for the CONFIRM step. The middle
 * row toggles between "add a promo code" and "remove code <code>" depending
 * on whether one is currently applied.
 */
export function confirmKeyboard(lang: Language, opts: { promoCode?: string } = {}): InlineKeyboard {
  const t = botT(lang)
  const keyboard = new InlineKeyboard().text(t('bot.confirm.book'), 'confirm:yes').row()
  if (opts.promoCode) {
    keyboard.text(t('bot.promo.removeButton', { code: opts.promoCode }), 'promo:remove').row()
  } else {
    keyboard.text(t('bot.promo.addButton'), 'promo:add').row()
  }
  keyboard.text(t('bot.common.back'), 'back:time')
  return keyboard
}

/** Single "skip" button shown on the PROMO step's code-entry prompt. */
export function promoKeyboard(lang: Language): InlineKeyboard {
  const t = botT(lang)
  return new InlineKeyboard().text(t('bot.promo.cancel'), 'promo:skip')
}

/**
 * "Book again" (+ "Open website", only when a site URL is resolved — DB
 * `TenantConfig.clientBotSiteUrl`, falling back to `NEXT_PUBLIC_SITE_URL`)
 * buttons shown on the post-booking success message. Caller resolves
 * `siteUrl` (see `resolveSiteUrl()` in `../site-url`).
 */
export function confirmSuccessKeyboard(lang: Language, siteUrl: string | undefined): InlineKeyboard {
  const t = botT(lang)
  const keyboard = new InlineKeyboard().text(t('bot.confirm.bookAgain'), 'restart:book')
  if (siteUrl) {
    keyboard.row().url(t('bot.confirm.openWebsite'), siteUrl)
  }
  return keyboard
}
