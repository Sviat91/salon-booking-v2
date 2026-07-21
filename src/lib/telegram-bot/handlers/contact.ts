/**
 * Contact (phone) step of the client booking wizard. Collects the client's
 * phone number either via Telegram's native "share contact" button or as
 * manually-typed text, normalizes it with the same helper the web flow
 * requires, derives a display name from the Telegram profile, then hands
 * off to the consent step (`handlers/consent.ts`).
 */
import type { Bot, Context } from 'grammy'
import { botT } from '../i18n'
import { contactKeyboard } from '../keyboards'
import { getState, setState, type WizardState } from '../wizard-state'
import { normalizePhoneToE164 } from '@/lib/utils/phone-normalization'
import { renderConsentStep } from './consent'

/** Sends the contact-request prompt with the native share-contact button. Persists `step: 'CONTACT'`. */
export async function renderContactStep(ctx: Context, chatId: number, state: WizardState) {
  if (!state.lang) return
  await setState(chatId, { ...state, step: 'CONTACT' })
  const t = botT(state.lang)
  await ctx.reply(t('bot.contact.prompt'), { reply_markup: contactKeyboard(state.lang) })
}

/** Normalizes the raw phone, then either re-prompts on failure or advances to the consent step. */
async function handleContactSubmission(
  ctx: Context,
  chatId: number,
  state: WizardState,
  rawPhone: string,
  name: string | undefined,
) {
  const t = botT(state.lang!)

  let phone: string
  try {
    phone = normalizePhoneToE164(rawPhone)
  } catch {
    await ctx.reply(t('bot.contact.invalid'), { reply_markup: contactKeyboard(state.lang!) })
    return
  }

  // Best-effort delete the user's inbound message (phone number) for privacy/tidiness.
  try {
    await ctx.deleteMessage()
  } catch {
    // Telegram may reject deleting old/already-gone messages — never break the flow.
  }

  const ackMessage = await ctx.reply(t('bot.contact.received'), { reply_markup: { remove_keyboard: true } })

  const nextState: WizardState = { ...state, phone, name, step: 'CONTACT' }
  await renderConsentStep(ctx, chatId, nextState)

  try {
    await ctx.api.deleteMessage(chatId, ackMessage.message_id)
  } catch {
    // Best-effort — never break the flow.
  }
}

export function registerContactHandlers(bot: Bot) {
  bot.on('message:contact', async (ctx) => {
    const chatId = ctx.chat?.id
    if (chatId === undefined) return

    const state = await getState(chatId)
    if (!state || state.step !== 'CONTACT' || !state.lang) return

    const fromName = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ').trim()
    const name = fromName.length >= 2 ? fromName : ctx.msg.contact.first_name

    await handleContactSubmission(ctx, chatId, state, ctx.msg.contact.phone_number, name)
  })

  // Handles a phone number typed as plain text instead of shared via the native
  // contact button. `/start`/`/cancel` are already consumed upstream by
  // `bot.command(['start', 'cancel'])` (registered first in `bot.ts`) before this
  // generic text listener runs, since that handler never calls `next()`; the
  // leading-`/` guard below is a defensive backstop against any other command.
  bot.on('message:text', async (ctx) => {
    if (ctx.msg.text.startsWith('/')) return

    const chatId = ctx.chat?.id
    if (chatId === undefined) return

    const state = await getState(chatId)
    if (!state || state.step !== 'CONTACT' || !state.lang) return

    const fromName = [ctx.from?.first_name, ctx.from?.last_name].filter(Boolean).join(' ').trim()
    const name = fromName.length >= 2 ? fromName : ctx.from?.first_name

    await handleContactSubmission(ctx, chatId, state, ctx.msg.text, name)
  })
}
