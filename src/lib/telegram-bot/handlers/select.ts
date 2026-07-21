/**
 * Master & procedure selection steps of the client booking wizard. Advances
 * `MASTER` → `PROCEDURE` → `DATE`, handing off to `renderDateStep`
 * (`handlers/datetime.ts`, Group 3) which renders the calendar.
 */
import type { Bot, Context } from 'grammy'
import { botT } from '../i18n'
import { languageKeyboard, mastersKeyboard, proceduresKeyboard } from '../keyboards'
import { getState, setState, type WizardState } from '../wizard-state'
import { listBookableMasters, listMasterProcedures } from '../catalog'
import { renderDateStep } from './datetime'
import { resolveLocalized, parseEnabledLocales } from '@/lib/localized-content'
import { DEFAULT_LANGUAGE, type Language } from '@/lib/i18n-shared'
import { getTenantConfig } from '@/lib/tenant'

/**
 * Renders the master-selection step. Reused by the language callback and
 * `back:master` (both callback contexts — edits in place), and by
 * `beginWizard` (start.ts) when skipping the language step entirely on a
 * fresh `/start` — a command context with no prior bot message to edit, so
 * it sends a new message there instead.
 */
export async function renderMasterStep(ctx: Context, lang: Language) {
  const masters = await listBookableMasters()
  const t = botT(lang)
  const text = t('bot.master.prompt')
  const reply_markup = mastersKeyboard(masters, lang)
  if (ctx.callbackQuery) {
    await ctx.editMessageText(text, { reply_markup })
  } else {
    await ctx.reply(text, { reply_markup })
  }
}

export function registerSelectHandlers(bot: Bot) {
  bot.callbackQuery(/^m:(.+)$/, async (ctx) => {
    const chatId = ctx.chat?.id
    if (chatId === undefined) {
      await ctx.answerCallbackQuery()
      return
    }

    const state = await getState(chatId)
    if (!state || state.step !== 'MASTER' || !state.lang) {
      await ctx.answerCallbackQuery()
      return
    }

    const masterId = ctx.match?.[1]
    if (!masterId) {
      await ctx.answerCallbackQuery()
      return
    }

    const masters = await listBookableMasters()
    const master = masters.find((m) => m.id === masterId)
    if (!master) {
      await ctx.answerCallbackQuery()
      const t = botT(state.lang)
      await ctx.editMessageText(t('bot.common.noLongerAvailable'), {
        reply_markup: mastersKeyboard(masters, state.lang),
      })
      return
    }

    const procedures = await listMasterProcedures(masterId)
    await ctx.answerCallbackQuery()
    const t = botT(state.lang)

    if (procedures.length === 0) {
      await setState(chatId, state)
      await ctx.editMessageText(t('bot.procedure.noServices'), {
        reply_markup: mastersKeyboard(masters, state.lang),
      })
      return
    }

    await setState(chatId, { ...state, masterId: master.id, masterName: master.name, step: 'PROCEDURE' })
    await ctx.editMessageText(t('bot.procedure.prompt'), {
      reply_markup: proceduresKeyboard(procedures, state.lang),
    })
  })

  bot.callbackQuery(/^p:(.+)$/, async (ctx) => {
    const chatId = ctx.chat?.id
    if (chatId === undefined) {
      await ctx.answerCallbackQuery()
      return
    }

    const state = await getState(chatId)
    if (!state || state.step !== 'PROCEDURE' || !state.lang || !state.masterId) {
      await ctx.answerCallbackQuery()
      return
    }

    const procedureId = ctx.match?.[1]
    if (!procedureId) {
      await ctx.answerCallbackQuery()
      return
    }

    const procedures = await listMasterProcedures(state.masterId)
    const procedure = procedures.find((p) => p.id === procedureId)
    if (!procedure) {
      await ctx.answerCallbackQuery()
      const t = botT(state.lang)
      await ctx.editMessageText(t('bot.common.noLongerAvailable'), {
        reply_markup: proceduresKeyboard(procedures, state.lang),
      })
      return
    }

    await ctx.answerCallbackQuery()
    const nextState: WizardState = {
      ...state,
      procedureId: procedure.id,
      procedureName: resolveLocalized(procedure.nameField, state.lang),
      durationMin: procedure.duration,
      step: 'DATE',
    }
    await renderDateStep(ctx, chatId, nextState)
  })

  bot.callbackQuery('back:lang', async (ctx) => {
    const chatId = ctx.chat?.id
    if (chatId === undefined) {
      await ctx.answerCallbackQuery()
      return
    }

    await setState(chatId, { step: 'LANGUAGE' })
    await ctx.answerCallbackQuery()
    const config = await getTenantConfig()
    const enabledLocales = parseEnabledLocales(config.enabledLocales)
    const t = botT(DEFAULT_LANGUAGE)
    await ctx.editMessageText(t('bot.language.prompt', { brandName: config.brandName }), {
      reply_markup: languageKeyboard(enabledLocales),
    })
  })

  bot.callbackQuery('back:master', async (ctx) => {
    const chatId = ctx.chat?.id
    if (chatId === undefined) {
      await ctx.answerCallbackQuery()
      return
    }

    const state = await getState(chatId)
    if (!state?.lang) {
      await ctx.answerCallbackQuery()
      return
    }

    await setState(chatId, { step: 'MASTER', lang: state.lang })
    await ctx.answerCallbackQuery()
    await renderMasterStep(ctx, state.lang)
  })
}
