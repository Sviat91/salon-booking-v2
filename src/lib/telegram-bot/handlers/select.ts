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
import { resolveLocalized } from '@/lib/localized-content'
import { DEFAULT_LANGUAGE, type Language } from '@/lib/i18n-shared'

/** Renders the master-selection step. Reused by the language callback (start.ts) and `back:master`. */
export async function renderMasterStep(ctx: Context, lang: Language) {
  const masters = await listBookableMasters()
  const t = botT(lang)
  await ctx.editMessageText(t('bot.master.prompt'), { reply_markup: mastersKeyboard(masters, lang) })
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
    const t = botT(DEFAULT_LANGUAGE)
    await ctx.editMessageText(t('bot.language.prompt'), { reply_markup: languageKeyboard() })
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
