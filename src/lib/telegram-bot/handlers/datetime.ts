/**
 * Date & time selection steps of the client booking wizard. Renders an
 * inline month calendar (only bookable days tappable, month arrows clamped
 * to the booking horizon) and, once a day is picked, a paginated time-slot
 * list. Advances `DATE` → `TIME` → `CONTACT`, handing off to
 * `renderContactStep` (`handlers/contact.ts`, Group 4).
 */
import type { Bot, Context } from 'grammy'
import { addDays } from 'date-fns'
import { toZonedTime, formatInTimeZone } from 'date-fns-tz'
import { botT } from '../i18n'
import { calendarKeyboard, slotsKeyboard, mastersKeyboard, proceduresKeyboard, SLOTS_PAGE_SIZE } from '../keyboards'
import { shiftMonth, monthBounds } from '../calendar-utils'
import { getState, setState, type WizardState } from '../wizard-state'
import { listBookableMasters, listMasterProcedures } from '../catalog'
import { renderContactStep } from './contact'
import { getAvailableDays, getDaySlots } from '@/lib/availability'
import { isoDate, SCHEDULE_TZ } from '@/lib/schedule-utils'

/** Booking horizon in days from "today" (Warsaw) — how far ahead the calendar allows picking a date. */
const BOOKING_HORIZON_DAYS = 60

function warsawHorizon(): { todayISO: string; maxISO: string } {
  const nowWarsaw = toZonedTime(new Date(), SCHEDULE_TZ)
  return { todayISO: isoDate(nowWarsaw), maxISO: isoDate(addDays(nowWarsaw, BOOKING_HORIZON_DAYS)) }
}

/**
 * Computes and renders the calendar for `state`'s master/duration, clamped
 * to `[today, today+horizon]`. Persists the resolved step (`DATE`) and
 * `calMonth`. `promptOverride` lets callers (e.g. the "no slots that day"
 * case) show a different message while still re-rendering the calendar.
 */
export async function renderDateStep(
  ctx: Context,
  chatId: number,
  state: WizardState,
  monthOverride?: string,
  promptOverride?: string
) {
  const { lang, masterId, durationMin } = state
  if (!lang || !masterId || !durationMin) return

  const { todayISO, maxISO } = warsawHorizon()
  const month = monthOverride ?? state.calMonth ?? todayISO.slice(0, 7)
  const { start: monthStart, end: monthEnd } = monthBounds(month)
  const fromISO = monthStart < todayISO ? todayISO : monthStart
  const untilISO = monthEnd > maxISO ? maxISO : monthEnd

  const availableDates = new Set<string>()
  if (fromISO <= untilISO) {
    // getAvailableDays' return type is loosely typed (`Record<string, unknown>`) upstream;
    // this cast reflects its documented `{ days: { date, hasWindow }[] }` shape.
    const { days } = (await getAvailableDays(fromISO, untilISO, durationMin, { masterId })) as {
      days: { date: string; hasWindow: boolean }[]
    }
    days.forEach((d) => {
      if (d.hasWindow) availableDates.add(d.date)
    })
  }

  const hasPrevMonth = monthBounds(shiftMonth(month, -1)).end >= todayISO
  const hasNextMonth = monthBounds(shiftMonth(month, 1)).start <= maxISO

  await setState(chatId, { ...state, step: 'DATE', calMonth: month })

  const t = botT(lang)
  await ctx.editMessageText(promptOverride ?? t('bot.date.prompt'), {
    reply_markup: calendarKeyboard({ month, lang, availableDates, hasPrevMonth, hasNextMonth }),
  })
}

export function registerDatetimeHandlers(bot: Bot) {
  // Noop cells (blank days, disabled nav arrows, weekday/month headers) —
  // still must answer the callback query or Telegram shows a stuck spinner.
  bot.callbackQuery('nop', async (ctx) => {
    await ctx.answerCallbackQuery()
  })

  bot.callbackQuery('cal:prev', async (ctx) => {
    const chatId = ctx.chat?.id
    if (chatId === undefined) {
      await ctx.answerCallbackQuery()
      return
    }
    const state = await getState(chatId)
    if (!state || state.step !== 'DATE') {
      await ctx.answerCallbackQuery()
      return
    }
    await ctx.answerCallbackQuery()
    const { todayISO } = warsawHorizon()
    await renderDateStep(ctx, chatId, state, shiftMonth(state.calMonth ?? todayISO.slice(0, 7), -1))
  })

  bot.callbackQuery('cal:next', async (ctx) => {
    const chatId = ctx.chat?.id
    if (chatId === undefined) {
      await ctx.answerCallbackQuery()
      return
    }
    const state = await getState(chatId)
    if (!state || state.step !== 'DATE') {
      await ctx.answerCallbackQuery()
      return
    }
    await ctx.answerCallbackQuery()
    const { todayISO } = warsawHorizon()
    await renderDateStep(ctx, chatId, state, shiftMonth(state.calMonth ?? todayISO.slice(0, 7), 1))
  })

  bot.callbackQuery(/^d:(\d{4}-\d{2}-\d{2})$/, async (ctx) => {
    const chatId = ctx.chat?.id
    if (chatId === undefined) {
      await ctx.answerCallbackQuery()
      return
    }
    const state = await getState(chatId)
    if (!state || state.step !== 'DATE' || !state.lang || !state.masterId || !state.durationMin) {
      await ctx.answerCallbackQuery()
      return
    }
    const dateISO = ctx.match?.[1]
    if (!dateISO) {
      await ctx.answerCallbackQuery()
      return
    }
    await ctx.answerCallbackQuery()

    const { slots } = await getDaySlots(dateISO, state.durationMin, 15, state.masterId)
    const t = botT(state.lang)
    if (slots.length === 0) {
      // Raced to full since getAvailableDays ran — re-render the calendar with a note.
      await renderDateStep(ctx, chatId, state, undefined, t('bot.date.noSlots'))
      return
    }

    await setState(chatId, { ...state, dateISO, slots, slotPage: 0, step: 'TIME' })
    await ctx.editMessageText(t('bot.time.prompt'), {
      reply_markup: slotsKeyboard({ slots, page: 0, lang: state.lang }),
    })
  })

  bot.callbackQuery('sp:prev', async (ctx) => {
    const chatId = ctx.chat?.id
    if (chatId === undefined) {
      await ctx.answerCallbackQuery()
      return
    }
    const state = await getState(chatId)
    if (!state || state.step !== 'TIME' || !state.lang || !state.slots) {
      await ctx.answerCallbackQuery()
      return
    }
    await ctx.answerCallbackQuery()
    const page = Math.max(0, (state.slotPage ?? 0) - 1)
    await setState(chatId, { ...state, slotPage: page })
    const t = botT(state.lang)
    await ctx.editMessageText(t('bot.time.prompt'), {
      reply_markup: slotsKeyboard({ slots: state.slots, page, lang: state.lang }),
    })
  })

  bot.callbackQuery('sp:next', async (ctx) => {
    const chatId = ctx.chat?.id
    if (chatId === undefined) {
      await ctx.answerCallbackQuery()
      return
    }
    const state = await getState(chatId)
    if (!state || state.step !== 'TIME' || !state.lang || !state.slots) {
      await ctx.answerCallbackQuery()
      return
    }
    await ctx.answerCallbackQuery()
    const maxPage = Math.max(0, Math.ceil(state.slots.length / SLOTS_PAGE_SIZE) - 1)
    const page = Math.min(maxPage, (state.slotPage ?? 0) + 1)
    await setState(chatId, { ...state, slotPage: page })
    const t = botT(state.lang)
    await ctx.editMessageText(t('bot.time.prompt'), {
      reply_markup: slotsKeyboard({ slots: state.slots, page, lang: state.lang }),
    })
  })

  bot.callbackQuery(/^t:(\d+)$/, async (ctx) => {
    const chatId = ctx.chat?.id
    if (chatId === undefined) {
      await ctx.answerCallbackQuery()
      return
    }
    const state = await getState(chatId)
    if (!state || state.step !== 'TIME' || !state.lang || !state.slots) {
      await ctx.answerCallbackQuery()
      return
    }
    const idx = Number(ctx.match?.[1])
    const slot = state.slots[idx]
    if (!slot) {
      await ctx.answerCallbackQuery()
      return
    }
    await ctx.answerCallbackQuery()

    const slotLabel = formatInTimeZone(new Date(slot.startISO), SCHEDULE_TZ, 'HH:mm')
    const nextState: WizardState = {
      ...state,
      startISO: slot.startISO,
      endISO: slot.endISO,
      slotLabel,
      step: 'CONTACT',
    }
    await renderContactStep(ctx, chatId, nextState)
  })

  bot.callbackQuery('back:date', async (ctx) => {
    const chatId = ctx.chat?.id
    if (chatId === undefined) {
      await ctx.answerCallbackQuery()
      return
    }
    const state = await getState(chatId)
    if (!state?.lang || !state.masterId || !state.durationMin) {
      await ctx.answerCallbackQuery()
      return
    }
    await ctx.answerCallbackQuery()
    await renderDateStep(ctx, chatId, { ...state, step: 'DATE' })
  })

  bot.callbackQuery('back:procedure', async (ctx) => {
    const chatId = ctx.chat?.id
    if (chatId === undefined) {
      await ctx.answerCallbackQuery()
      return
    }
    const state = await getState(chatId)
    if (!state?.lang || !state.masterId) {
      await ctx.answerCallbackQuery()
      return
    }
    await setState(chatId, { ...state, step: 'PROCEDURE' })
    await ctx.answerCallbackQuery()

    const t = botT(state.lang)
    const procedures = await listMasterProcedures(state.masterId)
    if (procedures.length === 0) {
      const masters = await listBookableMasters()
      await ctx.editMessageText(t('bot.procedure.noServices'), { reply_markup: mastersKeyboard(masters, state.lang) })
      return
    }
    await ctx.editMessageText(t('bot.procedure.prompt'), { reply_markup: proceduresKeyboard(procedures, state.lang) })
  })
}
