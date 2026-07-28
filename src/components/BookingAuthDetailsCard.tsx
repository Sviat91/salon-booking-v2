"use client"
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import PhoneInput from './ui/PhoneInput'
import { validatePhone, validateEmail } from '@/lib/validation/client-validators'

type AuthUser = { name?: string | null; phone?: string | null; email?: string | null } | null | undefined

/**
 * Pure, behaviour-preserving extraction of the authenticated "Your Details"
 * card out of `BookingForm.tsx` (AD-11) — kept the 500-line limit from being
 * breached by the promo-code UI added in Steps 16/17. Owns its own edit-mode
 * state; the parent keeps only the committed `name`/`phone`/`email`.
 */
export default function BookingAuthDetailsCard({
  name,
  phone,
  email,
  authUser,
  onCommit,
}: {
  name: string
  phone: string
  email: string
  authUser: AuthUser
  onCommit: (v: { name: string; phone: string; email: string }) => void
}) {
  const { t } = useTranslation()

  const [isEditingDetails, setIsEditingDetails] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [saveToProfile, setSaveToProfile] = useState(true)
  const [detailsSaving, setDetailsSaving] = useState(false)
  const [detailsMessage, setDetailsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

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
      onCommit({ name: trimmedName, phone: trimmedPhone, email: trimmedEmail })

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

  return (
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
  )
}
