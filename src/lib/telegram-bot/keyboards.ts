/**
 * Inline keyboard builders for the Telegram client booking bot.
 * Group 1 shipped the language picker; Group 2 adds master/procedure
 * keyboards. Calendar/slot/consent/confirm keyboards are added in later
 * groups. Keep all `callback_data` short (<64 bytes, Telegram's hard limit).
 */
import { InlineKeyboard } from 'grammy'
import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES, type Language } from '@/lib/i18n-shared'
import { resolveLocalized } from '@/lib/localized-content'
import { botT } from './i18n'
import type { BookableMaster, BookableProcedure } from './catalog'

/** One button per supported language, one per row, callback_data `lang:<code>`. */
export function languageKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard()
  SUPPORTED_LANGUAGES.forEach((lang, index) => {
    keyboard.text(LANGUAGE_NAMES[lang], `lang:${lang}`)
    if (index < SUPPORTED_LANGUAGES.length - 1) keyboard.row()
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
