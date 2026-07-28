/**
 * Promo-code entry step of the client booking wizard. An optional affordance
 * on the existing CONFIRM step (mirrors the web flow: code entry at the
 * final step, after the phone is known), not a new mandatory step — reached
 * only via the `🏷 add code` button on CONFIRM, never as a forced step.
 *
 * R-11 (load-bearing): `handlers/contact.ts`'s `message:text` listener halts
 * grammy's middleware chain when it doesn't handle a message (no `next()`
 * call). This handler is therefore registered BEFORE `registerContactHandlers`
 * in `bot.ts`, and its own `message:text` listener always calls `next()` when
 * it doesn't own the current step — get this wrong and phone entry silently
 * breaks for every bot user, with no error anywhere.
 */
import type { Bot, Context } from 'grammy'
import { botT } from '../i18n'
import { promoKeyboard } from '../keyboards'
import { getState, setState, type WizardState } from '../wizard-state'
import { evaluateDiscount } from '@/lib/discounts/server'
import { normalizeDiscountCode, type CodeStatus } from '@/lib/discounts/shared'
import { rateLimit } from '@/lib/cache'
import { renderConfirmStep } from './confirm'

const PROMO_RATE_LIMIT = 10
const PROMO_RATE_WINDOW_SEC = 600

/** Sends the code-entry prompt with a skip button. Persists `step: 'PROMO'`. */
export async function renderPromoStep(ctx: Context, chatId: number, state: WizardState) {
  if (!state.lang) return
  await setState(chatId, { ...state, step: 'PROMO' })
  const t = botT(state.lang)
  await ctx.reply(t('bot.promo.prompt'), { reply_markup: promoKeyboard(state.lang) })
}

/** Maps every `CodeStatus` other than `'valid'`/`'none'` to its `bot.promo.*` key. */
const STATUS_KEY: Partial<Record<CodeStatus, string>> = {
  unknown: 'unknown',
  inactive: 'inactive',
  expired: 'expired',
  not_applicable: 'not_applicable',
  already_used: 'already_used',
}

export function registerPromoHandlers(bot: Bot) {
  bot.callbackQuery('promo:add', async (ctx) => {
    const chatId = ctx.chat?.id
    if (chatId === undefined) {
      await ctx.answerCallbackQuery()
      return
    }
    const state = await getState(chatId)
    if (!state || state.step !== 'CONFIRM' || !state.lang) {
      await ctx.answerCallbackQuery()
      return
    }
    await ctx.answerCallbackQuery()
    await renderPromoStep(ctx, chatId, state)
  })

  bot.callbackQuery('promo:skip', async (ctx) => {
    const chatId = ctx.chat?.id
    if (chatId === undefined) {
      await ctx.answerCallbackQuery()
      return
    }
    const state = await getState(chatId)
    if (!state || state.step !== 'PROMO' || !state.lang) {
      await ctx.answerCallbackQuery()
      return
    }
    await ctx.answerCallbackQuery()
    await renderConfirmStep(ctx, chatId, { ...state, step: 'CONFIRM' })
  })

  bot.callbackQuery('promo:remove', async (ctx) => {
    const chatId = ctx.chat?.id
    if (chatId === undefined) {
      await ctx.answerCallbackQuery()
      return
    }
    const state = await getState(chatId)
    if (!state || state.step !== 'CONFIRM' || !state.lang) {
      await ctx.answerCallbackQuery()
      return
    }
    await ctx.answerCallbackQuery()
    await renderConfirmStep(ctx, chatId, { ...state, promoCode: undefined, step: 'CONFIRM' })
  })

  // Load-bearing (R-11): must call next() for every step other than PROMO,
  // otherwise this listener silently swallows every other text message in
  // the bot (including the phone number typed at the CONTACT step).
  bot.on('message:text', async (ctx, next) => {
    if (ctx.msg.text.startsWith('/')) return next()

    const chatId = ctx.chat?.id
    if (chatId === undefined) return next()

    const state = await getState(chatId)
    if (!state || state.step !== 'PROMO' || !state.lang) return next()

    const t = botT(state.lang)

    const { allowed } = await rateLimit(`tgpromo:${chatId}`, PROMO_RATE_LIMIT, PROMO_RATE_WINDOW_SEC)
    if (!allowed) {
      await ctx.reply(t('bot.promo.rateLimited'))
      return
    }

    if (!state.masterId || !state.procedureId || !state.startISO) {
      await ctx.reply(t('bot.error.generic'))
      return
    }

    const code = normalizeDiscountCode(ctx.msg.text)
    const evaluation = await evaluateDiscount({
      masterId: state.masterId,
      serviceId: state.procedureId,
      stage: 'final',
      startsAt: new Date(state.startISO),
      code,
      clientPhone: state.phone ?? null,
    })

    if (evaluation?.codeStatus === 'valid') {
      await ctx.reply(t('bot.promo.applied', { code: code ?? '' }))
      await renderConfirmStep(ctx, chatId, { ...state, promoCode: code ?? undefined, step: 'CONFIRM' })
      return
    }

    const statusKey = evaluation ? STATUS_KEY[evaluation.codeStatus] : undefined
    await ctx.reply(t(`bot.promo.${statusKey ?? 'unknown'}`), { reply_markup: promoKeyboard(state.lang) })
  })
}
