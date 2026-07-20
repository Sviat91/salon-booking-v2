/**
 * Inline keyboard builders for the Telegram client booking bot.
 * Group 1 ships only the language picker; master/procedure/calendar/slot/
 * consent/confirm keyboards are added in later groups. Keep all
 * `callback_data` short (<64 bytes, Telegram's hard limit).
 */
import { InlineKeyboard } from 'grammy'
import { SUPPORTED_LANGUAGES, LANGUAGE_NAMES } from '@/lib/i18n-shared'

/** One button per supported language, one per row, callback_data `lang:<code>`. */
export function languageKeyboard(): InlineKeyboard {
  const keyboard = new InlineKeyboard()
  SUPPORTED_LANGUAGES.forEach((lang, index) => {
    keyboard.text(LANGUAGE_NAMES[lang], `lang:${lang}`)
    if (index < SUPPORTED_LANGUAGES.length - 1) keyboard.row()
  })
  return keyboard
}
