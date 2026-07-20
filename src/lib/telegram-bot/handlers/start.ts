/**
 * `/start` (and `/cancel`) entry point + language-selection callback for the
 * client booking wizard. Picking a language advances into the master-
 * selection step (`select.ts`).
 */
import type { Bot } from 'grammy'
import { botT } from '../i18n'
import { languageKeyboard } from '../keyboards'
import { clearState, setState } from '../wizard-state'
import { renderMasterStep } from './select'
import { DEFAULT_LANGUAGE, isValidLanguage } from '@/lib/i18n-shared'

export function registerStartHandler(bot: Bot) {
  bot.command(['start', 'cancel'], async (ctx) => {
    const chatId = ctx.chat.id
    await clearState(chatId)
    await setState(chatId, { step: 'LANGUAGE' })
    const t = botT(DEFAULT_LANGUAGE)
    await ctx.reply(t('bot.language.prompt'), { reply_markup: languageKeyboard() })
  })

  bot.callbackQuery(/^lang:(.+)$/, async (ctx) => {
    const chatId = ctx.chat?.id
    if (chatId === undefined) {
      await ctx.answerCallbackQuery()
      return
    }

    const lang = ctx.match?.[1]
    if (!lang || !isValidLanguage(lang)) {
      await ctx.answerCallbackQuery()
      return
    }

    await setState(chatId, { step: 'MASTER', lang })
    await ctx.answerCallbackQuery()
    await renderMasterStep(ctx, lang)
  })
}
