/**
 * Confirmation + booking-creation step of the client booking wizard. Renders
 * a summary of the pending booking, then on `confirm:yes` calls the shared
 * `createBooking()` (`@/lib/booking-service`) — the same transaction used by
 * the web `POST /api/book` route (plan decision #3). Also owns the light
 * per-chat-id rate-limit guard (plan Step 4.5) applied right before creating
 * the booking.
 */
import type { Bot, Context } from 'grammy'
import { formatInTimeZone } from 'date-fns-tz'
import { botT } from '../i18n'
import { confirmKeyboard, confirmSuccessKeyboard, slotsKeyboard } from '../keyboards'
import { getState, setState, clearState, type WizardState } from '../wizard-state'
import { listMasterProcedures } from '../catalog'
import { renderDateStep } from './datetime'
import { renderContactStep } from './contact'
import { renderConsentStep } from './consent'
import { createBooking } from '@/lib/booking-service'
import { resolveSiteUrl } from '../site-url'
import { rateLimit } from '@/lib/cache'
import { SCHEDULE_TZ } from '@/lib/schedule-utils'
import { localeFor, type Language } from '@/lib/i18n-shared'

/** Per-chat-id cap on the final `confirm:yes` action — cheap abuse guard (plan Step 4.5). */
const BOOKING_RATE_LIMIT = 5
const BOOKING_RATE_WINDOW_SEC = 3600

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

async function resolvePrice(masterId: string, procedureId: string): Promise<number | null> {
  const procedures = await listMasterProcedures(masterId)
  return procedures.find((p) => p.id === procedureId)?.price ?? null
}

/**
 * Formats the master/procedure/date/time/price interpolation values shared by
 * `bot.confirm.summary` (`renderConfirmStep`) and `bot.confirm.success` (the
 * `confirm:yes` success branch).
 */
async function formatBookingSummary(params: {
  lang: Language
  masterName: string
  procedureName: string
  masterId: string
  procedureId: string
  startISO: string
}) {
  const { lang, masterName, procedureName, masterId, procedureId, startISO } = params
  const t = botT(lang)
  const currency = t('common.currency')
  const price = await resolvePrice(masterId, procedureId)

  const dateLabel = new Intl.DateTimeFormat(localeFor(lang), {
    dateStyle: 'long',
    timeZone: SCHEDULE_TZ,
  }).format(new Date(startISO))
  const timeLabel = formatInTimeZone(new Date(startISO), SCHEDULE_TZ, 'HH:mm')

  return {
    master: masterName,
    procedure: procedureName,
    date: dateLabel,
    time: timeLabel,
    price: price !== null ? `${price} ${currency}` : '—',
  }
}

/** Renders the booking summary with confirm/back buttons. Persists `step: 'CONFIRM'`. */
export async function renderConfirmStep(ctx: Context, chatId: number, state: WizardState) {
  const { lang, masterName, procedureName, masterId, procedureId, startISO } = state
  if (!lang || !masterName || !procedureName || !masterId || !procedureId || !startISO) return

  await setState(chatId, { ...state, step: 'CONFIRM' })
  const t = botT(lang)
  const labels = await formatBookingSummary({ lang, masterName, procedureName, masterId, procedureId, startISO })

  await ctx.reply(t('bot.confirm.summary', labels), { reply_markup: confirmKeyboard(lang) })
}

export function registerConfirmHandlers(bot: Bot) {
  bot.callbackQuery('back:time', async (ctx) => {
    const chatId = ctx.chat?.id
    if (chatId === undefined) {
      await ctx.answerCallbackQuery()
      return
    }

    const state = await getState(chatId)
    if (!state?.lang || !state.slots) {
      await ctx.answerCallbackQuery()
      return
    }
    await ctx.answerCallbackQuery()
    await setState(chatId, { ...state, step: 'TIME' })
    const t = botT(state.lang)
    await ctx.editMessageText(t('bot.time.prompt'), {
      reply_markup: slotsKeyboard({ slots: state.slots, page: state.slotPage ?? 0, lang: state.lang }),
    })
  })

  bot.callbackQuery('confirm:yes', async (ctx) => {
    const chatId = ctx.chat?.id
    if (chatId === undefined) {
      await ctx.answerCallbackQuery()
      return
    }

    const state = await getState(chatId)
    if (
      !state ||
      state.step !== 'CONFIRM' ||
      !state.lang ||
      !state.startISO ||
      !state.endISO ||
      !state.name ||
      !state.phone ||
      !state.masterId ||
      !state.procedureId ||
      !state.masterName ||
      !state.procedureName
    ) {
      await ctx.answerCallbackQuery()
      return
    }

    const t = botT(state.lang)

    const { allowed } = await rateLimit(`tgbook:${chatId}`, BOOKING_RATE_LIMIT, BOOKING_RATE_WINDOW_SEC)
    if (!allowed) {
      await ctx.answerCallbackQuery()
      await ctx.editMessageText(t('bot.error.rateLimited'))
      return
    }

    await ctx.answerCallbackQuery()

    const result = await createBooking({
      startISO: state.startISO,
      endISO: state.endISO,
      procedureId: state.procedureId,
      masterId: state.masterId,
      name: state.name,
      phone: state.phone,
      language: state.lang,
      consents: state.consentGiven
        ? { dataProcessing: true, terms: true, notifications: true }
        : undefined,
      ip: null,
      authenticatedUserId: null,
      telegramChatId: String(chatId),
    })

    if (result.ok) {
      await clearState(chatId)
      const labels = await formatBookingSummary({
        lang: state.lang,
        masterName: state.masterName,
        procedureName: state.procedureName,
        masterId: state.masterId,
        procedureId: state.procedureId,
        startISO: state.startISO,
      })
      const siteUrl = await resolveSiteUrl()
      try {
        await ctx.editMessageText(t('bot.confirm.success', labels), {
          reply_markup: confirmSuccessKeyboard(state.lang, siteUrl),
        })
      } catch (err) {
        console.error('[telegram-bot confirm] success message with url button failed, retrying without it:', describeError(err))
        await ctx.editMessageText(t('bot.confirm.success', labels), {
          reply_markup: confirmSuccessKeyboard(state.lang, undefined),
        })
      }
      return
    }

    switch (result.code) {
      case 'CONFLICT':
        await renderDateStep(ctx, chatId, { ...state, step: 'DATE' }, undefined, t('bot.error.slotTaken'))
        return
      case 'CONSENT_REQUIRED':
        await renderConsentStep(ctx, chatId, state)
        return
      case 'INVALID_PHONE':
        await renderContactStep(ctx, chatId, { ...state, step: 'CONTACT' })
        return
      default:
        await ctx.editMessageText(t('bot.error.generic'))
        return
    }
  })
}
