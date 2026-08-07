"use client"
import LegalPageHeader from '@/components/legal/LegalPageHeader'
import ConsentWithdrawalModal from '../../components/ConsentWithdrawalModal'
import DataErasureModal from '../../components/DataErasureModal'
import DataExportModal from '../../components/DataExportModal'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectItemText } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useState, useRef, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { clientLog } from '@/lib/client-logger'
import { getTurnstileTheme } from '@/lib/turnstile-theme'

type SalonConfig = {
  salonAddress?: string | null
  salonCity?: string | null
  salonPhone?: string | null
}

export default function SupportPage() {
  const { t } = useTranslation()
  const subjectLabels: Record<string, string> = {
    '': t('form.selectTopic'),
    booking: t('support.topics.booking'),
    cancellation: t('support.topics.booking'),
    payment: t('support.topics.other'),
    technical: t('support.topics.technical'),
    privacy: t('support.topics.privacy'),
    other: t('support.topics.other'),
  }
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isConsentModalOpen, setConsentModalOpen] = useState(false)
  const [isErasureModalOpen, setErasureModalOpen] = useState(false)
  const [isExportModalOpen, setExportModalOpen] = useState(false)

  // Fetch salon contact info for the sidebar
  const { data: salonConfig } = useQuery<SalonConfig>({
    queryKey: ['tenant-config-contact'],
    queryFn: () => fetch('/api/tenant-config').then(r => r.json() as Promise<SalonConfig>),
    staleTime: 60 * 60 * 1000,
  })
  
  // Turnstile
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY as string | undefined
  const turnstileRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null)

  // Load Turnstile
  useEffect(() => {
    if (!siteKey) return
    const scriptId = 'cf-turnstile'
    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script')
      script.id = scriptId
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js'
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }

    const interval = setInterval(() => {
      const turnstile = (window as any)?.turnstile
      if (turnstile && turnstileRef.current && !widgetIdRef.current) {
        try {
          widgetIdRef.current = turnstile.render(turnstileRef.current, {
            sitekey: siteKey,
            language: 'pl',
            theme: getTurnstileTheme(),
            callback: (token: string) => setTurnstileToken(token),
          })
          clearInterval(interval)
        } catch (error) {
          clientLog.warn('Turnstile render failed:', error)
        }
      }
    }, 200)

    return () => {
      clearInterval(interval)
      if (turnstileRef.current && widgetIdRef.current) {
        const turnstile = (window as any)?.turnstile
        if (turnstile) {
          try {
            turnstile.remove(widgetIdRef.current)
          } catch (error) {
            clientLog.warn('Turnstile cleanup failed:', error)
          }
        }
      }
      widgetIdRef.current = null
    }
  }, [siteKey])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setSubmitError(null)
    
    try {
      const response = await fetch('/api/support/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({...formData, turnstileToken}),
      })

      const result = await response.json()

      if (response.ok) {
        setSubmitted(true)
        setFormData({ name: '', email: '', subject: '', message: '' })
      } else {
        // Handle API errors
        if (result.field) {
          setSubmitError(`${result.field}: ${result.error}`)
        } else {
          setSubmitError(result.error || 'Wystąpił błąd podczas wysyłania wiadomości')
        }
      }
    } catch (error) {
      clientLog.error('Contact form submission failed:', error)
      setSubmitError('Wystąpił błąd połączenia. Sprawdź połączenie internetowe i spróbuj ponownie.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleOpenConsentModal = () => {
    setErasureModalOpen(false)
    setExportModalOpen(false)
    setConsentModalOpen(true)
  }

  const handleOpenErasureModal = () => {
    setConsentModalOpen(false)
    setExportModalOpen(false)
    setErasureModalOpen(true)
  }

  const handleOpenExportModal = () => {
    setConsentModalOpen(false)
    setErasureModalOpen(false)
    setExportModalOpen(true)
  }

  const handleCloseAllModals = () => {
    setConsentModalOpen(false)
    setErasureModalOpen(false)
    setExportModalOpen(false)
  }

  return (
    <main className="px-3 py-4 sm:p-6 relative flex-1 flex flex-col w-full max-w-full box-border overflow-x-hidden">
      <LegalPageHeader />
      <div className="container mx-auto max-w-6xl px-0 pt-4 pb-6">
        {/* Header */}
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-3">
            {t('support.title')}
          </h1>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            {t('support.subtitle')}
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <div className="bg-card backdrop-blur-sm rounded-2xl border border-border p-6 text-foreground">
              <h2 className="text-xl font-semibold text-foreground mb-4">
                {t('support.contactForm')}
              </h2>
              
              {submitted ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">{t('support.successTitle')}</h3>
                  <p className="text-muted-foreground mb-6">
                    {t('support.successMessage')}
                  </p>
                  <button 
                    onClick={() => {
                      setSubmitted(false)
                      setSubmitError(null)
                    }}
                    className="btn btn-primary"
                  >
                    {t('support.sendAnother')}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        {t('form.name')} *
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="Wprowadź swoje imię i nazwisko"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-foreground mb-2">
                        E-mail *
                      </label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => handleInputChange('email', e.target.value)}
                        className="w-full rounded-xl border border-border bg-card px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="twoj.email@example.com"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {t('support.subject')} *
                    </label>
                    <Select
                      required
                      value={formData.subject}
                      onValueChange={(v) => handleInputChange('subject', v ?? '')}
                    >
                      <SelectTrigger className="h-auto w-full rounded-xl px-4 py-3">
                        <SelectValue>{(v: string) => subjectLabels[v] ?? v}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value=""><SelectItemText>{t('form.selectTopic')}</SelectItemText></SelectItem>
                        <SelectItem value="booking"><SelectItemText>{t('support.topics.booking')}</SelectItemText></SelectItem>
                        <SelectItem value="cancellation"><SelectItemText>{t('support.topics.booking')}</SelectItemText></SelectItem>
                        <SelectItem value="payment"><SelectItemText>{t('support.topics.other')}</SelectItemText></SelectItem>
                        <SelectItem value="technical"><SelectItemText>{t('support.topics.technical')}</SelectItemText></SelectItem>
                        <SelectItem value="privacy"><SelectItemText>{t('support.topics.privacy')}</SelectItemText></SelectItem>
                        <SelectItem value="other"><SelectItemText>{t('support.topics.other')}</SelectItemText></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-2">
                      {t('form.message')} *
                    </label>
                    <Textarea
                      required
                      rows={4}
                      value={formData.message}
                      onChange={(e) => handleInputChange('message', e.target.value)}
                      className="rounded-xl px-4 py-3 resize-none"
                      placeholder="Opisz szczegółowo swój problem lub pytanie..."
                    />
                  </div>
                  
                  {submitError && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/40 dark:bg-red-900/30 dark:text-red-200">
                      <p className="font-medium">Błąd wysyłania</p>
                      <p>{submitError}</p>
                    </div>
                  )}

                  {/* Turnstile */}
                  {siteKey && (
                    <div className="flex justify-center">
                      <div ref={turnstileRef} className="rounded-xl"></div>
                    </div>
                  )}

                  {siteKey && !turnstileToken && (
                    <div className="text-xs text-muted-foreground text-center">
                      Potwierdź weryfikację Turnstile, aby kontynuować.
                    </div>
                  )}
                  
                  <button
                    type="submit"
                    disabled={isSubmitting || !!(siteKey && !turnstileToken)}
                    className={`btn btn-primary w-full py-3 ${isSubmitting || (siteKey && !turnstileToken) ? 'opacity-70 cursor-not-allowed' : ''}`}
                  >
                    {isSubmitting ? t('support.sending') : t('support.send')}
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact Info */}
            <div className="bg-card backdrop-blur-sm rounded-2xl border border-border p-5">
              <h3 className="text-lg font-semibold text-foreground mb-3">
                {t('support.contactInfo', 'Contact Information')}
              </h3>
              <div className="space-y-4">
                {(salonConfig?.salonAddress || salonConfig?.salonCity) && (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">{t('support.address', 'Address')}</h4>
                    <p className="text-sm text-muted-foreground">
                      {salonConfig.salonAddress && <>{salonConfig.salonAddress}<br /></>}
                      {salonConfig.salonCity}
                    </p>
                  </div>
                </div>
                )}
                
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-medium text-foreground">{t('support.responseTime', 'Response Time')}</h4>
                    <p className="text-sm text-muted-foreground">
                      {t('support.responseTimeValue', 'Usually within 72 hours')}<br />
                      {t('support.responseTimeDays', 'on business days')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-card backdrop-blur-sm rounded-2xl border border-border p-5">
              <h3 className="text-lg font-semibold text-foreground mb-3">
                Szybkie akcje
              </h3>
              <div className="space-y-3">
                <button 
                  onClick={handleOpenErasureModal}
                  className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="font-medium text-foreground text-sm">{t('support.eraseButton')}</div>
                  <div className="text-xs text-muted-foreground">{t('support.eraseData')}</div>
                </button>
                
                <button 
                  onClick={handleOpenExportModal}
                  className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="font-medium text-foreground text-sm">{t('support.exportButton')}</div>
                  <div className="text-xs text-muted-foreground">{t('support.exportData')}</div>
                </button>
                
                <button 
                  onClick={handleOpenConsentModal}
                  className="w-full text-left p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="font-medium text-foreground text-sm">{t('support.withdrawButton')}</div>
                  <div className="text-xs text-muted-foreground">{t('support.withdrawConsent')}</div>
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
      <ConsentWithdrawalModal isOpen={isConsentModalOpen} onClose={handleCloseAllModals} />
      <DataErasureModal isOpen={isErasureModalOpen} onClose={handleCloseAllModals} />
      <DataExportModal isOpen={isExportModalOpen} onClose={handleCloseAllModals} />
    </main>
  )
}
