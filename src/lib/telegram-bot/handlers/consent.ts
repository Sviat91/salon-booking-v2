/**
 * Consent step of the client booking wizard. Reuses the web flow's
 * `evaluateConsentStatus()` (`@/lib/consent-service`) to skip the step for a
 * returning phone+name pair that already holds valid consent — mirrors
 * `POST /api/book`. Consent PERSISTENCE happens inside `createBooking`
 * (`saveConsentRecord`), not here — this step only collects the in-chat
 * agree/decline choice and passes it through `WizardState.consentGiven`.
 */
import type { Bot, Context } from 'grammy'
import { botT } from '../i18n'
import { consentKeyboard } from '../keyboards'
import { getState, setState, clearState, type WizardState } from '../wizard-state'
import { evaluateConsentStatus } from '@/lib/consent-service'
import { resolveSiteUrl } from '../site-url'
import { renderConfirmStep } from './confirm'

/**
 * Safe error summary for logging — never returns the raw error/context value,
 * which for grammy errors can carry the bot token nested inside `ctx.api`.
 * Duplicated from `../lifecycle`'s `describeError` to avoid a circular import
 * (`lifecycle.ts` → `bot.ts` → this module).
 */
function describeError(err: unknown): string {
  if (err instanceof Error) return `${err.name}: ${err.message}`
  return String(err)
}

async function legalLinks(): Promise<{ termsUrl: string | undefined; privacyUrl: string | undefined }> {
  const siteUrl = await resolveSiteUrl()
  return {
    termsUrl: siteUrl ? `${siteUrl}/terms` : undefined,
    privacyUrl: siteUrl ? `${siteUrl}/privacy` : undefined,
  }
}

/**
 * Evaluates consent for `state.phone`/`state.name`; skips straight to CONFIRM
 * when a valid consent already exists (mirrors the web flow), otherwise
 * renders the in-chat agree/decline prompt. `/terms`/`/privacy` are shown as
 * URL buttons (only when a real absolute site URL resolves — Telegram
 * rejects relative-path URLs for `url`-type buttons) rather than as raw links
 * in the message text.
 */
export async function renderConsentStep(ctx: Context, chatId: number, state: WizardState) {
  if (!state.lang || !state.phone || !state.name) return

  const consentStatus = await evaluateConsentStatus({ phone: state.phone, name: state.name })
  if (consentStatus.hasValidConsent) {
    await renderConfirmStep(ctx, chatId, { ...state, step: 'CONFIRM' })
    return
  }

  await setState(chatId, { ...state, step: 'CONSENT' })
  const t = botT(state.lang)
  const { termsUrl, privacyUrl } = await legalLinks()
  try {
    await ctx.reply(t('bot.consent.prompt'), {
      reply_markup: consentKeyboard(state.lang, { termsUrl, privacyUrl }),
    })
  } catch (err) {
    console.error('[telegram-bot consent] reply with url buttons failed, retrying without them:', describeError(err))
    await ctx.reply(t('bot.consent.prompt'), {
      reply_markup: consentKeyboard(state.lang, {}),
    })
  }
}

export function registerConsentHandlers(bot: Bot) {
  bot.callbackQuery('consent:yes', async (ctx) => {
    const chatId = ctx.chat?.id
    if (chatId === undefined) {
      await ctx.answerCallbackQuery()
      return
    }

    const state = await getState(chatId)
    if (!state || state.step !== 'CONSENT' || !state.lang) {
      await ctx.answerCallbackQuery()
      return
    }
    await ctx.answerCallbackQuery()

    await renderConfirmStep(ctx, chatId, { ...state, consentGiven: true, step: 'CONFIRM' })
  })

  bot.callbackQuery('consent:no', async (ctx) => {
    const chatId = ctx.chat?.id
    if (chatId === undefined) {
      await ctx.answerCallbackQuery()
      return
    }

    const state = await getState(chatId)
    if (!state || state.step !== 'CONSENT' || !state.lang) {
      await ctx.answerCallbackQuery()
      return
    }
    const t = botT(state.lang)
    await ctx.answerCallbackQuery()
    await clearState(chatId)
    await ctx.editMessageText(t('bot.consent.declined'))
  })
}
