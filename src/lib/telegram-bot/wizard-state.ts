/**
 * Redis-backed wizard state for the Telegram client booking bot, built on the
 * existing `src/lib/cache.ts` (`cacheGet`/`cacheSet`/`cacheDel`) — no new DB
 * table, no new state store. Keyed per chat (`tgwiz:<chatId>`), TTL refreshed
 * on every step so abandoned sessions expire naturally.
 */
import { cacheGet, cacheSet, cacheDel } from '@/lib/cache'
import type { Language } from '@/lib/i18n-shared'

export type WizardStep =
  | 'LANGUAGE'
  | 'MASTER'
  | 'PROCEDURE'
  | 'DATE'
  | 'TIME'
  | 'CONTACT'
  | 'CONSENT'
  | 'CONFIRM'

export interface WizardSlot {
  startISO: string
  endISO: string
}

export interface WizardState {
  step: WizardStep
  lang?: Language
  masterId?: string
  masterName?: string
  procedureId?: string
  procedureName?: string
  durationMin?: number
  calMonth?: string
  dateISO?: string
  slots?: WizardSlot[]
  startISO?: string
  endISO?: string
  slotLabel?: string
  slotPage?: number
  phone?: string
  name?: string
  consentGiven?: boolean
}

const TTL_SECONDS = 1800

function stateKey(chatId: number | string): string {
  return `tgwiz:${chatId}`
}

export async function getState(chatId: number | string): Promise<WizardState | null> {
  return cacheGet<WizardState>(stateKey(chatId))
}

export async function setState(chatId: number | string, state: WizardState): Promise<void> {
  await cacheSet(stateKey(chatId), state, TTL_SECONDS)
}

export async function clearState(chatId: number | string): Promise<void> {
  await cacheDel(stateKey(chatId))
}

/**
 * Separate, longer-lived record of the last-picked language per chat —
 * independent of the wizard-session key/TTL above, so a returning user
 * doesn't have to re-pick their language on every new booking. Refreshed on
 * every read and write; long TTL rather than no-expiry so truly-abandoned
 * chat histories eventually clean up.
 */
const LANGUAGE_TTL_SECONDS = 60 * 60 * 24 * 180 // 180 days

function languageKey(chatId: number | string): string {
  return `tgbotlang:${chatId}`
}

export async function getRememberedLanguage(chatId: number | string): Promise<Language | null> {
  const lang = await cacheGet<Language>(languageKey(chatId))
  if (lang) await cacheSet(languageKey(chatId), lang, LANGUAGE_TTL_SECONDS)
  return lang
}

export async function setRememberedLanguage(chatId: number | string, lang: Language): Promise<void> {
  await cacheSet(languageKey(chatId), lang, LANGUAGE_TTL_SECONDS)
}
