import { useState, useCallback } from 'react'
import type { Language } from '@/lib/i18n-shared'

export type Slot = { startISO: string; endISO: string }

type BookingState = 'form' | 'consent' | 'success'

interface UseBookingSubmitProps {
  slot: Slot
  procedureId?: string
  masterId?: string
  name: string
  phone: string
  email: string
  tsToken: string | null
  language: Language
  isAuthenticatedClient?: boolean
  onSuccess?: () => void
}

interface ConsentData {
  dataProcessing: boolean
  terms: boolean
  notifications: boolean
}

export function useBookingSubmit({
  slot,
  procedureId,
  masterId,
  name,
  phone,
  email,
  tsToken,
  language,
  isAuthenticatedClient = false,
  onSuccess,
}: UseBookingSubmitProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bookingState, setBookingState] = useState<BookingState>('form')
  const [eventId, setEventId] = useState<string | null>(null)
  const [isCheckingConsent, setIsCheckingConsent] = useState(false)

  const handleBookingError = useCallback((e: any) => {
    const msg = String(e?.message || '')
    if (msg.startsWith('BOOKING_TURNSTILE')) {
      setError('Potwierdz weryfikacje Turnstile i sprobuj ponownie.')
    } else if (msg.startsWith('BOOKING_DUPLICATE')) {
      setError('Rezerwacja na ten przedzial juz zostala wyslana. Odczekaj 5 minut lub wybierz inny termin.')
    } else if (msg.startsWith('BOOKING_CONFLICT')) {
      setError('Ten termin jest juz zajety. Wybierz inny przedzial.')
    } else if (msg.startsWith('BOOKING_CONSENT_REQUIRED')) {
      setError('Przed rezerwacja musisz potwierdzic wymagane zgody.')
    } else if (msg.startsWith('BOOKING_RATE_LIMITED')) {
      setError('Zbyt wiele prob. Sprobuj pozniej.')
    } else {
      setError('Nie udalo sie zarezerwowac. Wybierz inny termin i sprobuj ponownie.')
    }
  }, [])

  // Book without saving new consents (user already has valid ones)
  const bookWithoutConsents = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startISO: slot.startISO,
          endISO: slot.endISO,
          procedureId,
          masterId,
          name,
          phone,
          email: email || undefined,
          turnstileToken: tsToken,
          language,
          // No consents object - user already has valid consents
        }),
      })

      const body = await res.json()
      if (!res.ok) {
        const code = (body && body.code) || 'UNKNOWN'
        const details = (body && body.details) || ''
        throw new Error(`BOOKING_${code}${details ? `: ${details}` : ''}`)
      }

      setEventId(body.eventId || null)
      setBookingState('success')
      onSuccess?.()
    } catch (e: any) {
      handleBookingError(e)
    } finally {
      setLoading(false)
    }
  }, [slot, procedureId, masterId, name, phone, email, tsToken, language, onSuccess, handleBookingError])

  // Check if user already has valid consents and proceed accordingly
  const checkConsentAndProceed = useCallback(async () => {
    setIsCheckingConsent(true)
    setLoading(true)
    setError(null)

    try {
      // For authenticated clients, consent is collected during registration
      if (isAuthenticatedClient) {
        await bookWithoutConsents()
        return
      }

      const consentCheckRes = await fetch('/api/consents/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name, email: email || undefined }),
      })

      if (consentCheckRes.ok) {
        const consentData = await consentCheckRes.json()
        if (consentData.skipConsentModal) {
          await bookWithoutConsents()
          return
        }
      }

      setBookingState('consent')
    } catch {
      setError('Nie udalo sie sprawdzic zgod. Sprobuj ponownie.')
    } finally {
      setLoading(false)
      setIsCheckingConsent(false)
    }
  }, [phone, name, email, isAuthenticatedClient, bookWithoutConsents])

  // Book with new consents
  const bookWithConsents = useCallback(async (consents: ConsentData) => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          startISO: slot.startISO,
          endISO: slot.endISO,
          procedureId,
          masterId,
          name,
          phone,
          email: email || undefined,
          turnstileToken: tsToken,
          language,
          consents: {
            dataProcessing: consents.dataProcessing,
            terms: consents.terms,
            notifications: consents.notifications,
          },
        }),
      })

      const body = await res.json()
      if (!res.ok) {
        const code = (body && body.code) || 'UNKNOWN'
        const details = (body && body.details) || ''
        throw new Error(`BOOKING_${code}${details ? `: ${details}` : ''}`)
      }

      setEventId(body.eventId || null)
      setBookingState('success')
      onSuccess?.()
    } catch (e: any) {
      handleBookingError(e)
    } finally {
      setLoading(false)
    }
  }, [slot, procedureId, masterId, name, phone, email, tsToken, language, onSuccess, handleBookingError])

  const resetToForm = useCallback(() => {
    setBookingState('form')
    setError(null)
    setEventId(null)
  }, [])

  return {
    loading,
    error,
    bookingState,
    eventId,
    isCheckingConsent,
    checkConsentAndProceed,
    bookWithConsents,
    resetToForm,
    setError,
  }
}
