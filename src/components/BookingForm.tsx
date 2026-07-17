"use client"
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSession } from 'next-auth/react'
import PhoneInput from './ui/PhoneInput'
import BookingSuccess from './BookingSuccess'
import BookingConsentModal from './BookingConsentModal'
import { useBookingSubmit, type Slot } from './hooks/useBookingSubmit'

import { fullDateFormatter, formatTimeRange } from '@/lib/utils/date-formatters'
import { validateName, validatePhone, validateEmail, validateTurnstileToken } from '@/lib/validation/client-validators'
import { useSelectedMasterId } from '@/contexts/MasterContext'
import { useCurrentLanguage } from '@/contexts/LanguageContext'
import { resolveLocalized } from '@/lib/localized-content'

type Procedure = { id: string; name_pl: string; name_en?: string; name_uk?: string; price_pln?: number }
type ProceduresResponse = { items: Procedure[] }

export default function BookingForm({
  slot,
  procedureId,
  onSuccess,
}: {
  slot: Slot
  procedureId?: string
  onSuccess?: () => void
}) {
  const { t } = useTranslation()
  const language = useCurrentLanguage()
  const masterId = useSelectedMasterId()

  const { data: session } = useSession()
  const isAuth = session?.user?.role === 'CLIENT'
  const authUser = session?.user

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')

  // In-place profile editing while booking
  const [isEditingDetails, setIsEditingDetails] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [saveToProfile, setSaveToProfile] = useState(true)
  const [detailsSaving, setDetailsSaving] = useState(false)
  const [detailsMessage, setDetailsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    if (isAuth && authUser) {
      setName(authUser.name || '')
      setPhone(authUser.phone || '')
      setEmail(authUser.email || '')
    }
  }, [isAuth, authUser])

  const [nameError, setNameError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [emailError, setEmailError] = useState<string | null>(null)

  const [dataProcessingConsent, setDataProcessingConsent] = useState(false)
  const [termsConsent, setTermsConsent] = useState(false)
  const [notificationsConsent, setNotificationsConsent] = useState(false)

  const [tsToken, setTsToken] = useState<string | null>(null)
  const tsRef = useRef<HTMLDivElement | null>(null)
  const phoneValidationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY as string | undefined

  const { data: proceduresData } = useQuery<ProceduresResponse>({
    queryKey: ['procedures', masterId],
    queryFn: () => fetch(`/api/procedures?masterId=${masterId}`).then((r) => r.json() as Promise<ProceduresResponse>),
  })

  const selectedProcedure = useMemo(() => {
    if (!procedureId) return null
    return proceduresData?.items.find((p) => p.id === procedureId) ?? null
  }, [procedureId, proceduresData])

  const selectedProcedureName = useMemo(() => {
    if (!selectedProcedure) return null
    return resolveLocalized({ pl: selectedProcedure.name_pl, en: selectedProcedure.name_en, uk: selectedProcedure.name_uk }, language)
  }, [selectedProcedure, language])

  const {
    loading,
    error,
    bookingState,
    isCheckingConsent,
    checkConsentAndProceed,
    bookWithConsents,
    resetToForm,
  } = useBookingSubmit({
    slot,
    procedureId,
    masterId,
    name,
    phone,
    email,
    tsToken,
    isAuthenticatedClient: isAuth,
    onSuccess,
  })

  useEffect(() => {
    if (!siteKey) return

    const id = 'cf-turnstile'
    if (!document.getElementById(id)) {
      const s = document.createElement('script')
      s.id = id
      s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      s.async = true
      s.defer = true
      document.head.appendChild(s)
    }

    const turnstileLang = language === 'uk' ? 'uk-ua' : language

    const iv = setInterval(() => {
      // @ts-ignore -- Turnstile render helper lacks type definitions
      const turnstile = (window as any).turnstile
      if (turnstile && tsRef.current) {
        try {
          tsRef.current.setAttribute('data-language', turnstileLang)
          turnstile.render(tsRef.current, {
            sitekey: siteKey,
            language: turnstileLang,
            callback: (token: string) => setTsToken(token),
          })
          clearInterval(iv)
        } catch {
          // no-op
        }
      }
    }, 200)
    return () => clearInterval(iv)
  }, [siteKey, language])

  useEffect(() => {
    if (bookingState === 'consent' && tsRef.current) {
      tsRef.current.style.display = 'none'
    } else if (tsRef.current) {
      tsRef.current.style.display = 'block'
    }
  }, [bookingState])

  useEffect(() => {
    return () => {
      if (phoneValidationTimeoutRef.current) {
        clearTimeout(phoneValidationTimeoutRef.current)
      }
    }
  }, [])

  const canSubmit = useMemo(() => {
    const nameValid = validateName(name).valid
    const phoneValid = isAuth ? true : validatePhone(phone).valid
    const emailValid = !email || validateEmail(email).valid
    const tokenValid = !siteKey || validateTurnstileToken(tsToken).valid

    return nameValid && phoneValid && emailValid && tokenValid && !loading
  }, [name, phone, email, loading, siteKey, tsToken, isAuth])

  const handleNameBlur = () => {
    const result = validateName(name)
    setNameError(result.valid ? null : result.error ? t(result.error, result.errorParams) : null)
  }

  const handleEmailBlur = () => {
    if (!email) {
      setEmailError(null)
      return
    }
    const result = validateEmail(email)
    setEmailError(result.valid ? null : result.error ? t(result.error, result.errorParams) : null)
  }

  const startDate = useMemo(() => new Date(slot.startISO), [slot.startISO])
  const endDate = useMemo(() => new Date(slot.endISO), [slot.endISO])
  const label = formatTimeRange(startDate, endDate)
  const terminLabel = `${fullDateFormatter.format(startDate)}, ${label}`

  const handleConsentConfirm = () => {
    if (!dataProcessingConsent || !termsConsent) return
    bookWithConsents({
      dataProcessing: dataProcessingConsent,
      terms: termsConsent,
      notifications: notificationsConsent,
    })
  }

  const handleConsentBack = () => {
    resetToForm()
    if (tsRef.current) {
      tsRef.current.style.display = 'block'
    }
  }

  const handleSuccessClose = () => {
    resetToForm()

    if (!isAuth) {
      setName('')
      setPhone('')
      setEmail('')
    }

    setDataProcessingConsent(false)
    setTermsConsent(false)
    setNotificationsConsent(false)
  }

  const openInlineEditor = () => {
    setEditName(name || authUser?.name || '')
    setEditPhone(phone || authUser?.phone || '')
    setEditEmail(email || authUser?.email || '')
    setSaveToProfile(true)
    setDetailsMessage(null)
    setIsEditingDetails(true)
  }

  const handleInlineDetailsSave = async () => {
    const trimmedName = editName.trim()
    const trimmedPhone = editPhone.trim()
    const trimmedEmail = editEmail.trim()

    if (trimmedName.length < 2) {
      setDetailsMessage({ type: 'error', text: t('validation.nameMinLength', 'Name must be at least 2 characters') })
      return
    }

    if (trimmedPhone && !validatePhone(trimmedPhone).valid) {
      setDetailsMessage({ type: 'error', text: t('validation.phoneInvalid', 'Invalid phone number') })
      return
    }

    if (!trimmedEmail || !validateEmail(trimmedEmail).valid) {
      setDetailsMessage({ type: 'error', text: t('validation.emailInvalid', 'Invalid email address') })
      return
    }

    setDetailsSaving(true)
    setDetailsMessage(null)

    try {
      setName(trimmedName)
      setPhone(trimmedPhone)
      setEmail(trimmedEmail)

      if (saveToProfile) {
        const res = await fetch('/api/client/profile', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: trimmedName, email: trimmedEmail, phone: trimmedPhone || null }),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || t('profile.errorLoading', 'Failed to update profile'))
        }
      }

      setIsEditingDetails(false)
      setDetailsMessage({
        type: 'success',
        text: saveToProfile
          ? t('profile.updateSuccess', 'Profile updated successfully')
          : t('common.success', 'Saved successfully'),
      })
    } catch (e: any) {
      setDetailsMessage({ type: 'error', text: e?.message || t('common.error', 'Error') })
    } finally {
      setDetailsSaving(false)
    }
  }

  if (bookingState === 'success') {
    return (
      <BookingSuccess
        procedureName={selectedProcedureName}
        terminLabel={terminLabel}
        procedurePrice={selectedProcedure?.price_pln}
        isAuth={isAuth}
        onClose={handleSuccessClose}
      />
    )
  }

  if (bookingState === 'consent') {
    return (
      <BookingConsentModal
        procedureName={selectedProcedureName}
        terminLabel={terminLabel}
        dataProcessingConsent={dataProcessingConsent}
        termsConsent={termsConsent}
        notificationsConsent={notificationsConsent}
        onDataProcessingChange={setDataProcessingConsent}
        onTermsChange={setTermsConsent}
        onNotificationsChange={setNotificationsConsent}
        loading={loading}
        error={error}
        onBack={handleConsentBack}
        onConfirm={handleConsentConfirm}
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="text-muted-foreground">
        <div className="font-medium text-foreground mb-0.5">{selectedProcedureName}</div>
        <div className="text-sm">{terminLabel}</div>
      </div>

      {isAuth ? (
        <div className="bg-primary/5 dark:bg-primary/10 border border-primary/20 rounded-xl p-4">
          <div className="flex justify-between items-start mb-2">
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">
              {t('booking.yourDetails', 'Your Details')}
            </span>
            {!isEditingDetails && (
              <button
                type="button"
                onClick={openInlineEditor}
                className="text-xs underline text-muted-foreground hover:text-primary"
              >
                {t('common.edit', 'Edit')}
              </button>
            )}
          </div>

          {!isEditingDetails ? (
            <div className="text-sm space-y-1">
              <p className="font-medium text-foreground">{name || authUser?.name}</p>
              {phone || authUser?.phone ? (
                <p className="text-muted-foreground">{phone || authUser?.phone}</p>
              ) : (
                <p className="text-muted-foreground text-xs">{t('profile.noPhone', 'Phone not provided')}</p>
              )}
              {email || authUser?.email ? <p className="text-muted-foreground">{email || authUser?.email}</p> : null}
            </div>
          ) : (
            <div className="space-y-3">
              <input
                className="w-full rounded-xl border border-border bg-transparent px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder={t('form.name', 'Full name')}
              />

              <PhoneInput
                value={editPhone}
                onChange={setEditPhone}
                placeholder={t('form.phone', 'Phone')}
              />

              <input
                className="w-full rounded-xl border border-border bg-transparent px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder={t('form.email', 'E-mail')}
                type="email"
              />

              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={saveToProfile}
                  onChange={(e) => setSaveToProfile(e.target.checked)}
                  className="mt-0.5"
                />
                <span>
                  {t(
                    'profile.applyGlobally',
                    'Also update these details in your profile globally'
                  )}
                </span>
              </label>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleInlineDetailsSave}
                  disabled={detailsSaving}
                  className="btn btn-primary text-xs px-3 py-2"
                >
                  {detailsSaving ? t('common.loading', 'Loading...') : t('common.save', 'Save')}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingDetails(false)}
                  disabled={detailsSaving}
                  className="btn btn-outline text-xs px-3 py-2"
                >
                  {t('common.cancel', 'Cancel')}
                </button>
              </div>
            </div>
          )}

          {detailsMessage && (
            <p className={`mt-3 text-xs ${detailsMessage.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
              {detailsMessage.text}
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <div>
            <input
              className={`w-full rounded-xl border ${nameError ? 'border-red-500' : 'border-border'} bg-transparent px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary`}
              placeholder={t('form.name')}
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                if (nameError) setNameError(null)
              }}
              onBlur={handleNameBlur}
            />
            {nameError && <div className="mt-1 text-xs text-red-600 dark:text-red-400">{nameError}</div>}
          </div>

          <div>
            <PhoneInput
              value={phone}
              onChange={(val) => {
                setPhone(val)
                if (phoneValidationTimeoutRef.current) {
                  clearTimeout(phoneValidationTimeoutRef.current)
                }
                phoneValidationTimeoutRef.current = setTimeout(() => {
                  if (!val.trim()) {
                    setPhoneError(null)
                    return
                  }
                  const result = validatePhone(val)
                  setPhoneError(result.valid ? null : result.error ? t(result.error, result.errorParams) : null)
                }, 500)
              }}
              placeholder={t('form.phone')}
            />
            {phoneError && <div className="mt-1 text-xs text-red-600 dark:text-red-400">{phoneError}</div>}
          </div>

          <div>
            <input
              className={`w-full rounded-xl border ${emailError ? 'border-red-500' : 'border-border'} bg-transparent px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary`}
              placeholder={t('form.emailOptional')}
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                if (emailError) setEmailError(null)
              }}
              onBlur={handleEmailBlur}
            />
            {emailError && <div className="mt-1 text-xs text-red-600 dark:text-red-400">{emailError}</div>}
          </div>
        </div>
      )}

      {siteKey && (
        <div className="mt-3">
          <div ref={tsRef} className="rounded-xl" />
        </div>
      )}

      {error && <div className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</div>}

      <button
        disabled={!canSubmit || isCheckingConsent}
        onClick={checkConsentAndProceed}
        className={`btn btn-primary mt-4 w-full transition-all duration-200 ${
          !canSubmit || isCheckingConsent ? 'opacity-60 pointer-events-none' : 'hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'
        }`}
      >
        {isCheckingConsent ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <span>{t('booking.preparing')}</span>
          </span>
        ) : (
          t('booking.book')
        )}
      </button>
    </div>
  )
}
