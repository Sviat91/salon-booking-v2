"use client"
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import PhoneInput from '../ui/PhoneInput'
import { Textarea } from '@/components/ui/textarea'
import { clientLog } from '@/lib/client-logger'
import { useSelectedMaster } from '@/contexts/MasterContext'
import { ApiError } from './api/bookingManagementApi'
import { apiErrorKey } from '@/lib/errors/apiErrorKey'

interface ContactMasterPanelProps {
  onBack: () => void
  onSuccess: () => void
}

export default function ContactMasterPanel({ onBack, onSuccess }: ContactMasterPanelProps) {
  const { t } = useTranslation()
  const selectedMaster = useSelectedMaster()
  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // PhoneInput возвращает телефон с кодом (например "+48123456789")
  // Проверяем что есть минимум 9 цифр (без учета кода страны и символов)
  const phoneDigits = phone.replace(/\D/g, '')
  const canSubmit = fullName.trim().length >= 2 && 
                    phoneDigits.length >= 9 && 
                    message.trim().length >= 10
  
  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return
    
    setIsSubmitting(true)
    setError(null)
    
    try {
      clientLog.info('Sending contact form to master:', {
        fullName: fullName.trim(),
        phone: phone.trim(),
        hasEmail: !!email.trim(),
        messageLength: message.trim().length,
      })
      
      const response = await fetch('/api/master/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          email: email.trim() || undefined,
          message: message.trim(),
          masterId: selectedMaster?.id ?? '',
        }),
      })
      
      clientLog.info('Response status:', response.status)
      
      const data = await response.json()
      clientLog.info('Response data:', data)
      
      if (!response.ok) {
        throw new ApiError(data.error ?? '', data.code)
      }

      // Success
      clientLog.info('Contact form sent successfully')
      onSuccess()
    } catch (err: unknown) {
      clientLog.error('Failed to send message to master:', err)
      setError(t(apiErrorKey(err instanceof ApiError ? err.code : undefined)))
    } finally {
      setIsSubmitting(false)
    }
  }
  
  return (
    <div className="overflow-y-auto space-y-4 pr-1 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600 scrollbar-track-transparent">
      <div>
        <h3 className="text-lg font-semibold text-foreground">
          {t('management.contactMasterBtn')}
        </h3>
        <p className="text-sm text-muted-foreground mt-1">
          {t('management.masterName', { name: selectedMaster?.name || 'Master' })}
        </p>
      </div>
      
      {error && (
        <div className="rounded-lg border border-red-300 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
          <div className="text-sm text-red-700 dark:text-red-300">{error}</div>
        </div>
      )}
      
      <div className="space-y-3">
        {/* Full Name */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {t('management.fullNameLabel')}
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder={t('management.fullNamePlaceholder')}
            disabled={isSubmitting}
            className="w-full max-w-full box-border px-3 py-2.5 rounded-lg border border-border bg-card text-sm text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        
        {/* Phone */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {t('management.phoneLabel')}
          </label>
          <PhoneInput
            value={phone}
            onChange={setPhone}
            placeholder={t('management.phonePlaceholder')}
            disabled={isSubmitting}
          />
        </div>
        
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {t('management.emailOptionalLabel')}
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('management.emailPlaceholder')}
            disabled={isSubmitting}
            className="w-full max-w-full box-border px-3 py-2.5 rounded-lg border border-border bg-card text-sm text-card-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
        
        {/* Message */}
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">
            {t('management.messageForMaster')}
          </label>
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder={t('management.messagePlaceholder')}
            rows={5}
            disabled={isSubmitting}
            className="max-w-full box-border rounded-lg bg-card resize-none"
          />
          <div className="text-xs text-muted-foreground mt-1">
            {t('management.minChars')}
          </div>
        </div>
      </div>
      
      {/* Action buttons */}
      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="flex-1 rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-card-foreground transition-all hover:bg-muted hover:border-border hover:shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!canSubmit || isSubmitting}
          className="flex-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <>
              <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {t('management.sending')}
            </>
          ) : (
            t('management.send')
          )}
        </button>
      </div>
    </div>
  )
}
