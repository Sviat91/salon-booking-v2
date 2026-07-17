import type {
  BookingResult,
  ProcedureOption,
  SearchFormData,
  SlotSelection,
} from '../types'
import { clientLog } from '@/lib/client-logger'

// API response interfaces
export interface SearchResultApi {
  eventId: string
  firstName: string
  lastName: string
  phone: string
  email?: string
  procedureName: string
  procedureName_en?: string
  procedureName_uk?: string
  procedureId?: string
  masterName?: string
  masterId?: string
  startTime: string
  endTime: string
  price: number
  canModify: boolean
  canCancel: boolean
}

export interface SearchResponseApi {
  results: SearchResultApi[]
  totalFound?: number
}

export interface ProceduresResponse {
  items: ProcedureOption[]
}

/**
 * Thrown by every mutating/fetching function in this module when the API
 * responds with a non-OK status. `message` is a dev-only diagnostic (the raw,
 * possibly mixed-language `error` field from the response) — UI code must
 * NOT render it directly. Render `t(apiErrorKey(err.code))` instead.
 */
export class ApiError extends Error {
  code?: string
  constructor(message: string, code?: string) {
    super(message)
    this.name = 'ApiError'
    this.code = code
  }
}

// Utility functions
export function splitFullName(fullName: string) {
  const trimmed = fullName.trim()
  if (!trimmed) {
    return { firstName: '', lastName: '' }
  }
  const parts = trimmed.split(/\s+/)
  return {
    firstName: parts[0] ?? '',
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : '',
  }
}

export function mapApiResult(entry: SearchResultApi, procedures: ProcedureOption[]): BookingResult {
  const start = new Date(entry.startTime)
  const end = new Date(entry.endTime)
  const durationMin = Math.max(15, Math.round((end.getTime() - start.getTime()) / 60000))
  // Prefer matching by procedureId (new API returns it), fall back to name match
  const matchedProcedure = procedures.find((proc) => proc.id === (entry as any).procedureId)
    ?? procedures.find((proc) => proc.name_pl === entry.procedureName)

  return {
    eventId: entry.eventId,
    procedureName: entry.procedureName,
    procedureName_en: entry.procedureName_en,
    procedureName_uk: entry.procedureName_uk,
    procedureId: matchedProcedure?.id,
    procedureDurationMin: durationMin,
    startTime: start,
    endTime: end,
    price: entry.price,
    canModify: entry.canModify,
    canCancel: entry.canCancel,
    firstName: entry.firstName,
    lastName: entry.lastName,
    phone: entry.phone,
    email: entry.email,
    masterName: entry.masterName,
    masterId: entry.masterId,
  }
}

// API Functions
export async function fetchProcedures(masterId?: string): Promise<ProceduresResponse> {
  const url = masterId ? `/api/procedures?masterId=${masterId}` : '/api/procedures'
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Nie udało się pobrać listy procedur')
  }
  return response.json()
}

export async function searchBookings(
  form: SearchFormData,
  procedures: ProcedureOption[],
  _turnstileToken?: string,  // kept for API compatibility — not sent to server
  _dateRange?: { start: string; end: string }, // no longer needed — server returns all upcoming
  _masterId?: string, // passed as sort hint (current master's bookings shown first)
): Promise<BookingResult[]> {
  clientLog.info('🔍 Searching for:', { fullName: form.fullName, phone: form.phone })

  // Send phone + name to server. masterId is optional — used only for sort priority.
  const params = new URLSearchParams({
    phone: form.phone,
    name:  form.fullName.trim(),
  })
  if (_masterId) params.set('currentMasterId', _masterId)
  const url = `/api/bookings/all?${params.toString()}`

  const response = await fetch(url)

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({} as { error?: string; code?: string }))
    throw new ApiError(errorData.error ?? 'Nie udało się pobrać danych z kalendarza', errorData.code)
  }

  const data = await response.json()
  clientLog.info(`📅 Received ${data.count} bookings from server`)

  const bookings: SearchResultApi[] = data.bookings ?? []

  clientLog.info(`✅ Found ${bookings.length} matching bookings`)

  return bookings.map((booking) => mapApiResult(booking, procedures))
}

export async function updateBooking(
  booking: BookingResult,
  changes: {
    newProcedureId?: string
    newSlot?: SlotSelection
  },
  turnstileToken?: string, // Not used anymore - kept for compatibility
  masterId?: string,
): Promise<{ startTime?: string; endTime?: string; procedure?: string }> {
  // Server verifies ownership via phone (last 9 digits) — see /api/bookings/[id]
  const body: Record<string, unknown> = {
    phone: booking.phone,
  }

  if (changes.newProcedureId) {
    body.newProcedureId = changes.newProcedureId
  }
  
  if (changes.newSlot) {
    body.newStartISO = changes.newSlot.startISO
    body.newEndISO = changes.newSlot.endISO
  }
  
  const response = await fetch(`/api/bookings/${booking.eventId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(masterId ? { ...body, masterId } : body),
  })
  
  if (!response.ok) {
    let detail = 'Nie udało się zaktualizować rezerwacji.'
    let code: string | undefined
    try {
      const json = (await response.json()) as { error?: string; code?: string }
      if (json?.error) detail = json.error
      code = json?.code
    } catch {
      // ignore
    }
    throw new ApiError(detail, code)
  }
  
  // Return new booking data from API response
  const result = await response.json()
  return result.changes || {}
}

// Проверка возможности увеличения длительности процедуры
// NO TURNSTILE - user already verified during search
export async function checkProcedureExtension(
  booking: BookingResult,
  newProcedureId: string,
  masterId?: string,
): Promise<{
  result: {
    status: 'can_extend' | 'can_shift_back' | 'no_availability'
    message: string
    reason?: string
    reasonCode?: 'NEXT_BOOKING_CONFLICT' | 'OUTSIDE_WORKING_HOURS'
    shiftMinutes?: number
    suggestedStartISO?: string
    suggestedEndISO?: string
    alternativeSlots?: Array<{ startISO: string; endISO: string }>
  }
  currentBooking: {
    startISO: string
    endISO: string
  }
  newProcedure: {
    id: string
    name: string
    duration: number
  }
}> {
  clientLog.info('🔍 Checking procedure extension availability (no Turnstile):', {
    eventId: booking.eventId,
    newProcedureId,
  })

  const body = {
    eventId: booking.eventId,
    currentStartISO: booking.startTime.toISOString(),
    currentEndISO: booking.endTime.toISOString(),
    newProcedureId,
  }

  const response = await fetch(`/api/bookings/${booking.eventId}/check-extension`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(masterId ? { ...body, masterId } : body),
  })

  if (!response.ok) {
    let detail = 'Nie udało się sprawdzić dostępności.'
    let code: string | undefined
    try {
      const json = (await response.json()) as { error?: string; code?: string }
      if (json?.error) detail = json.error
      code = json?.code
    } catch {
      // ignore
    }
    throw new ApiError(detail, code)
  }

  return await response.json()
}

// Простая функция для изменения процедуры - NO TURNSTILE (user already verified during search)
export async function updateBookingProcedure(
  booking: BookingResult,
  newProcedureId: string,
  masterId?: string,
): Promise<void> {
  clientLog.info('🔄 Updating booking procedure (no Turnstile):', {
    eventId: booking.eventId,
    oldProcedure: booking.procedureName,
    newProcedureId,
  })

  // Payload с данными для сохранения (не для валидации)
  const body = {
    eventId: booking.eventId,
    // Данные клиента для сохранения в записи
    firstName: booking.firstName,
    lastName: booking.lastName,
    phone: booking.phone,
    email: booking.email || '',
    // Текущее время начала (для расчёта нового времени окончания)
    currentStartISO: booking.startTime.toISOString(),
    // Новая процедура
    newProcedureId,
  }
  
  const response = await fetch('/api/bookings/update-procedure', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(masterId ? { ...body, masterId } : body),
  })
  
  if (!response.ok) {
    let detail = 'Nie udało się zaktualizować procedury rezerwacji.'
    let code: string | undefined
    try {
      const json = (await response.json()) as { error?: string; code?: string }
      if (json?.error) detail = json.error
      code = json?.code
    } catch {
      // ignore
    }
    throw new ApiError(detail, code)
  }
}

// Простая функция только для изменения времени - чистая архитектура
// NO TURNSTILE - user already verified during search
export async function updateBookingTime(
  booking: BookingResult,
  newSlot: SlotSelection,
  masterId?: string,
): Promise<void> {
  clientLog.info('🔄 Updating booking time (no Turnstile):', {
    eventId: booking.eventId,
    oldTime: `${booking.startTime.toISOString()} - ${booking.endTime.toISOString()}`,
    newTime: `${newSlot.startISO} - ${newSlot.endISO}`,
  })

  // Payload с данными для сохранения (не для валидации)
  const body = {
    eventId: booking.eventId,
    // Данные для сохранения в записи
    procedureName: booking.procedureName,
    firstName: booking.firstName,
    lastName: booking.lastName,
    phone: booking.phone,
    email: booking.email || '',
    price: booking.price,
    // Новое время
    newStartISO: newSlot.startISO,
    newEndISO: newSlot.endISO,
  }
  
  const response = await fetch('/api/bookings/update-time', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(masterId ? { ...body, masterId } : body),
  })
  
  if (!response.ok) {
    let detail = 'Nie udało się zaktualizować terminu rezerwacji.'
    let code: string | undefined
    try {
      const json = (await response.json()) as { error?: string; code?: string }
      if (json?.error) detail = json.error
      code = json?.code
    } catch {
      // ignore
    }
    throw new ApiError(detail, code)
  }
  
  clientLog.info('✅ Booking time updated successfully')
}

export async function cancelBooking(booking: BookingResult, masterId?: string): Promise<void> {
  // No Turnstile needed for cancellation - user was already verified during search
  const body = {
    eventId: booking.eventId,
    firstName: booking.firstName,
    phone: booking.phone,
    email: booking.email || '',
  }
  
  clientLog.info('🔓 Cancelling without Turnstile (user already verified during search)')
  clientLog.info('🗑️ Cancelling booking with eventId:', booking.eventId)
  
  const response = await fetch('/api/bookings/cancel', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(masterId ? { ...body, masterId } : body),
  })
  
  if (!response.ok) {
    let detail = 'Nie udało się anulować rezerwacji.'
    const status = response.status
    let code: string | undefined
    try {
      const json = (await response.json()) as { error?: string; code?: string }
      if (json?.error) detail = json.error
      code = json?.code
    } catch {
      // ignore parsing errors
    }
    // HTTP-429 → RATE_LIMITED code mapping, in case the server didn't send one
    if (status === 429 && !code) {
      code = 'RATE_LIMITED'
    }
    throw new ApiError(detail, code)
  }
}
