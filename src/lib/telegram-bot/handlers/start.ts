/**
 * `/start` (and `/cancel`) entry point + language-selection callback for the
 * client booking wizard. Picking a language advances into the master-
 * selection step (`select.ts`). Shares its reset logic (`beginWizard`) with
 * the post-booking `restart:book` callback (Group 4 polish round 2, Fix D).
 */
import type { Bot, Context } from 'grammy'
import { botT } from '../i18n'
import { languageKeyboard } from '../keyboards'
import { clearState, setState, getRememberedLanguage, setRememberedLanguage } from '../wizard-state'
import { renderMasterStep } from './select'
import { DEFAULT_LANGUAGE, isValidLanguage } from '@/lib/i18n-shared'
import { getTenantConfig } from '@/lib/tenant'
import { parseEnabledLocales } from '@/lib/localized-content'

/**
 * Resets the wizard state and either skips straight to the master-selection
 * step — when only one locale is enabled in Settings → Content Languages, or
 * when this chat has a remembered language (`getRememberedLanguage`) that's
 * still enabled — or shows the minimal language prompt filtered to the
 * enabled locales. Shared by the `/start`/`/cancel` command handler and the
 * `restart:book` callback.
 */
async function beginWizard(ctx: Context, chatId: number) {
  await clearState(chatId)

  const config = await getTenantConfig()
  const enabledLocales = parseEnabledLocales(config.enabledLocales)

  if (enabledLocales.length === 1) {
    const lang = enabledLocales[0]
    await setState(chatId, { step: 'MASTER', lang })
    await renderMasterStep(ctx, lang)
    return
  }

  const rememberedLang = await getRememberedLanguage(chatId)
  if (rememberedLang && enabledLocales.includes(rememberedLang)) {
    await setState(chatId, { step: 'MASTER', lang: rememberedLang })
    await renderMasterStep(ctx, rememberedLang)
    return
  }

  await setState(chatId, { step: 'LANGUAGE' })
  const t = botT(DEFAULT_LANGUAGE)
  await ctx.reply(t('bot.language.prompt', { brandName: config.brandName }), {
    reply_markup: languageKeyboard(enabledLocales),
  })
}

export function registerStartHandler(bot: Bot) {
  bot.command(['start', 'cancel'], async (ctx) => {
    await beginWizard(ctx, ctx.chat.id)
  })

  bot.callbackQuery('restart:book', async (ctx) => {
    const chatId = ctx.chat?.id
    if (chatId === undefined) {
      await ctx.answerCallbackQuery()
      return
    }

    await ctx.answerCallbackQuery()
    await beginWizard(ctx, chatId)
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

    // Re-validate against a fresh `enabledLocales` read — defense against a
    // stale keyboard from before an admin disabled a locale mid-session.
    const config = await getTenantConfig()
    const enabledLocales = parseEnabledLocales(config.enabledLocales)
    if (!enabledLocales.includes(lang)) {
      await ctx.answerCallbackQuery()
      const t = botT(DEFAULT_LANGUAGE)
      await ctx.editMessageText(t('bot.common.noLongerAvailable'), {
        reply_markup: languageKeyboard(enabledLocales),
      })
      return
    }

    await setRememberedLanguage(chatId, lang)
    await setState(chatId, { step: 'MASTER', lang })
    await ctx.answerCallbackQuery()
    await renderMasterStep(ctx, lang)
  })
}
