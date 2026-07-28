"use client"
import { useQuery } from '@tanstack/react-query'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSession } from 'next-auth/react'
import PhoneInput from './ui/PhoneInput'
import BookingSuccess from './BookingSuccess'
import BookingConsentModal from './BookingConsentModal'
import BookingAuthDetailsCard from './BookingAuthDetailsCard'
import BookingPriceSummary from './BookingPriceSummary'
import BookingPromoCodeField from './BookingPromoCodeField'
import { useBookingSubmit, type Slot, type BookedPricing } from './hooks/useBookingSubmit'
import { useDiscountPreview } from './hooks/useDiscountPreview'

import { getFullDateFormatter, formatTimeRange } from '@/lib/utils/date-formatters'
import { validateName, validatePhone, validateEmail, validateTurnstileToken } from '@/lib/validation/client-validators'
import { useSelectedMasterId } from '@/contexts/MasterContext'
import { useCurrentLanguage } from '@/contexts/LanguageContext'
import { resolveLocalized } from '@/lib/localized-content'
import { localeFor } from '@/lib/i18n-shared'

type Procedure = { id: string; name_pl: string; name_en?: string; name_uk?: string; price_pln?: number }
type ProceduresResponse = { items: Procedure[] }

export default function BookingForm({
  slot,
  procedureId,
  onSuccess,
}: {
  slot: Slot
  procedureId?: string
  onSuccess?: (pricing: BookedPricing) => void
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

  const effectivePhone = phone || authUser?.phone || undefined

  const {
    preview: discountPreview,
    loading: discountLoading,
    appliedCode,
    applyCode: applyDiscountCode,
    clearCode: clearDiscountCode,
  } = useDiscountPreview({
    masterId,
    serviceId: procedureId,
    startISO: slot.startISO,
    phone: effectivePhone,
  })

  const {
    loading,
    error,
    bookingState,
    bookedPricing,
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
    language,
    isAuthenticatedClient: isAuth,
    discountCode: appliedCode,
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
  const label = formatTimeRange(startDate, endDate, localeFor(language))
  const terminLabel = `${getFullDateFormatter(localeFor(language)).format(startDate)}, ${label}`

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

  if (bookingState === 'success') {
    return (
      <BookingSuccess
        procedureName={selectedProcedureName}
        terminLabel={terminLabel}
        procedurePrice={bookedPricing?.finalPrice ?? selectedProcedure?.price_pln}
        originalPrice={bookedPricing?.originalPrice}
        discountPercent={bookedPricing?.discountPercent ?? null}
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

      {discountPreview && (
        <BookingPriceSummary
          originalPrice={discountPreview.originalPrice}
          finalPrice={discountPreview.finalPrice}
          percent={discountPreview.percent}
          label={discountPreview.label}
          currency={t('common.currency')}
          provisional
        />
      )}

      {isAuth ? (
        <>
          <BookingAuthDetailsCard
            name={name}
            phone={phone}
            email={email}
            authUser={authUser}
            onCommit={({ name: n, phone: p, email: e }) => {
              setName(n)
              setPhone(p)
              setEmail(e)
            }}
          />
          <BookingPromoCodeField
            appliedCode={appliedCode}
            codeStatus={discountPreview?.codeStatus ?? null}
            loading={discountLoading}
            onApply={applyDiscountCode}
            onRemove={clearDiscountCode}
          />
        </>
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

          <BookingPromoCodeField
            appliedCode={appliedCode}
            codeStatus={discountPreview?.codeStatus ?? null}
            loading={discountLoading}
            onApply={applyDiscountCode}
            onRemove={clearDiscountCode}
          />

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
