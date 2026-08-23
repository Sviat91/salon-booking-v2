'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import type { FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Trans, useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { SettingsSection } from '@/app/admin/settings/FormFields'
import { apiErrorKey } from '@/lib/errors/apiErrorKey'
import FormSkeleton from '@/components/admin/skeletons/FormSkeleton'
import TelegramRecipientsField from './TelegramRecipientsField'
import SmsSettingsSection from './SmsSettingsSection'
import { recipientSchema, type RecipientRow } from './recipient-schema'
import { diffRecipients } from './recipient-diff'

const formSchema = z.object({
  notifEmailEnabled: z.boolean(),
  notifTelegramEnabled: z.boolean(),
  telegramBotToken: z.string().trim().max(256).optional(),
  notifReminder24hEnabled: z.boolean(),
  notifReminder2hEnabled: z.boolean(),
  notifSmsEnabled: z.boolean(),
  smsProvider: z.enum(['twilio', 'smsapi']),
  twilioAccountSid: z.string().trim().max(256).optional(),
  twilioAuthToken: z.string().trim().max(256).optional(),
  twilioFromNumber: z.string().trim().max(32).optional(),
  smsApiToken: z.string().trim().max(256).optional(),
  smsApiSender: z.string().trim().max(32).optional(),
  recipients: z.array(recipientSchema),
})

export type FormValues = z.infer<typeof formSchema>

// Always includes at least one blank row so the form always has an editable
// slot on screen (see TelegramRecipientsField.tsx) — called both on initial
// load and after save, so this blank row becomes part of `defaultValues`
// too and never falsely marks the form dirty on its own.
async function fetchRecipients(): Promise<RecipientRow[]> {
  const res = await fetch('/api/admin/notification-settings/recipients')
  const data = await res.json()
  const recipients = (data.recipients ?? []).map((r: { id: string; chatId: string; label: string | null }) => ({
    dbId: r.id,
    chatId: r.chatId,
    label: r.label ?? '',
  }))
  return recipients.length > 0 ? recipients : [{ dbId: null, chatId: '', label: '' }]
}

export function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
}: {
  label: string
  description?: React.ReactNode
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
}) {
  const { t } = useTranslation()
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium leading-none">{label}</p>
        {description && (
          <p className="mt-1 text-xs text-muted-foreground">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-xs text-muted-foreground w-7 text-right">
          {checked ? t('admin.settings.notifications.onLabel') : t('admin.settings.notifications.offLabel')}
        </span>
        <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
      </div>
    </div>
  )
}

export default function NotificationSettingsForm() {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [smtpConfigured, setSmtpConfigured] = React.useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      notifEmailEnabled: false,
      notifTelegramEnabled: false,
      telegramBotToken: '',
      notifReminder24hEnabled: false,
      notifReminder2hEnabled: false,
      notifSmsEnabled: false,
      smsProvider: 'twilio',
      twilioAccountSid: '',
      twilioAuthToken: '',
      twilioFromNumber: '',
      smsApiToken: '',
      smsApiSender: '',
      recipients: [],
    },
  })

  const { watch, formState } = form
  const emailEnabled = watch('notifEmailEnabled')
  const telegramEnabled = watch('notifTelegramEnabled')
  const smsEnabled = watch('notifSmsEnabled')
  const anyChannelEnabled = emailEnabled || telegramEnabled || smsEnabled

  React.useEffect(() => {
    document.dispatchEvent(
      new CustomEvent('settings-dirty', { detail: { isDirty: formState.isDirty } })
    )
  }, [formState.isDirty])

  React.useEffect(() => {
    async function load() {
      try {
        const [notifRes, emailRes, smsRes, recipients] = await Promise.all([
          fetch('/api/admin/notification-settings'),
          fetch('/api/admin/email-settings'),
          fetch('/api/admin/sms-settings'),
          fetchRecipients(),
        ])
        const notifData = await notifRes.json()
        const emailData = await emailRes.json()
        const smsData = await smsRes.json()
        setSmtpConfigured(Boolean(emailData.smtpHost))
        form.reset({
          notifEmailEnabled: notifData.notifEmailEnabled ?? false,
          notifTelegramEnabled: notifData.notifTelegramEnabled ?? false,
          telegramBotToken: notifData.telegramBotToken ?? '',
          notifReminder24hEnabled: notifData.notifReminder24hEnabled ?? false,
          notifReminder2hEnabled: notifData.notifReminder2hEnabled ?? false,
          notifSmsEnabled: smsData.notifSmsEnabled ?? false,
          smsProvider: smsData.smsProvider ?? 'twilio',
          twilioAccountSid: smsData.twilioAccountSid ?? '',
          twilioAuthToken: smsData.twilioAuthToken ?? '',
          twilioFromNumber: smsData.twilioFromNumber ?? '',
          smsApiToken: smsData.smsApiToken ?? '',
          smsApiSender: smsData.smsApiSender ?? '',
          recipients,
        })
      } catch {
        toast.error(t('admin.settings.notifications.loadFailed'))
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [form])

  async function onSubmit(values: FormValues) {
    setIsSaving(true)
    try {
      const {
        recipients,
        notifSmsEnabled,
        smsProvider,
        twilioAccountSid,
        twilioAuthToken,
        twilioFromNumber,
        smsApiToken,
        smsApiSender,
        ...settings
      } = values
      const smsSettings = {
        notifSmsEnabled,
        smsProvider,
        twilioAccountSid,
        twilioAuthToken,
        twilioFromNumber,
        smsApiToken,
        smsApiSender,
      }

      const [res, smsRes] = await Promise.all([
        fetch('/api/admin/notification-settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings),
        }),
        fetch('/api/admin/sms-settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(smsSettings),
        }),
      ])
      if (!res.ok || !smsRes.ok) {
        const failed = !res.ok ? res : smsRes
        const err = await failed.json().catch(() => ({}))
        throw new Error(err.code ? t(apiErrorKey(err.code)) : t('admin.settings.notifications.saveFailed'))
      }

      const { toCreate, toUpdate, toDeleteIds } = diffRecipients(
        form.formState.defaultValues?.recipients ?? [],
        recipients
      )

      const results = await Promise.allSettled([
        ...toCreate.map((r) =>
          fetch('/api/admin/notification-settings/recipients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId: r.chatId, label: r.label || undefined }),
          })
        ),
        ...toUpdate.map((r) =>
          fetch(`/api/admin/notification-settings/recipients/${r.dbId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId: r.chatId, label: r.label || undefined }),
          })
        ),
        ...toDeleteIds.map((id) =>
          fetch(`/api/admin/notification-settings/recipients/${id}`, { method: 'DELETE' })
        ),
      ])
      if (results.some((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok))) {
        throw new Error(t('admin.settings.notifications.saveFailed'))
      }

      const [freshRecipients, freshSmsData] = await Promise.all([
        fetchRecipients(),
        fetch('/api/admin/sms-settings').then((r) => r.json()),
      ])
      form.reset({
        ...settings,
        notifSmsEnabled: freshSmsData.notifSmsEnabled ?? false,
        smsProvider: freshSmsData.smsProvider ?? 'twilio',
        twilioAccountSid: freshSmsData.twilioAccountSid ?? '',
        twilioAuthToken: freshSmsData.twilioAuthToken ?? '',
        twilioFromNumber: freshSmsData.twilioFromNumber ?? '',
        smsApiToken: freshSmsData.smsApiToken ?? '',
        smsApiSender: freshSmsData.smsApiSender ?? '',
        recipients: freshRecipients,
      })
      toast.success(t('admin.settings.notifications.saveSuccess'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('admin.settings.notifications.saveFailed'))
    } finally {
      setIsSaving(false)
    }
  }

  function onInvalid(errors: FieldErrors<FormValues>) {
    console.error('[NotificationSettingsForm] submit blocked by validation', errors)
    toast.error(t('admin.settings.notifications.saveFailed'))
  }

  if (isLoading) {
    // No translated text here (2026-08-07 fix): `useTranslation()` in a
    // client component always SSRs in the default locale (`src/lib/i18n.ts`,
    // deliberately, to avoid a *different* hydration mismatch), while the
    // browser's very first paint can already reflect the visitor's real
    // saved language — so a `t('common.loading')` string here mismatched
    // between server and client HTML, and React discarded/remounted this
    // whole subtree on every load, which is what made Save silently stop
    // responding. A skeleton has no text, so there's nothing to mismatch.
    return (
      <div className="flex flex-col gap-6">
        <FormSkeleton />
        <FormSkeleton />
      </div>
    )
  }

  return (
    <Form {...form}>
      <form id="settings-form" onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-6">

        {/* Email channel */}
        <SettingsSection
          title={t('admin.settings.notifications.emailSectionTitle')}
          description={t('admin.settings.notifications.emailSectionDesc')}
        >
          <FormField
            control={form.control}
            name="notifEmailEnabled"
            render={({ field }) => (
              <FormItem>
                <ToggleRow
                  label={t('admin.settings.notifications.sendEmailNotifLabel')}
                  description={
                    smtpConfigured
                      ? t('admin.settings.notifications.emailNotifConfiguredDesc')
                      : <span className="text-destructive font-medium">
                          <Trans
                            i18nKey="admin.settings.notifications.smtpNotConfiguredDesc"
                            components={{ a: <a href="/admin/settings/email" className="underline" /> }}
                          />
                        </span>
                  }
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={!smtpConfigured}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsSection>

        {/* Telegram channel */}
        <SettingsSection
          title={t('admin.settings.notifications.telegramSectionTitle')}
          description={t('admin.settings.notifications.telegramSectionDesc')}
        >
          <FormField
            control={form.control}
            name="notifTelegramEnabled"
            render={({ field }) => (
              <FormItem>
                <ToggleRow
                  label={t('admin.settings.notifications.sendTelegramNotifLabel')}
                  description={t('admin.settings.notifications.telegramNotifDesc')}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="telegramBotToken"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('admin.settings.notifications.botTokenLabel')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder="1234567890:ABCdef..."
                    type="password"
                    autoComplete="off"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  <Trans i18nKey="admin.settings.notifications.botTokenDesc" components={{ code: <code /> }} />
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <TelegramRecipientsField control={form.control} />
        </SettingsSection>

        {/* SMS channel */}
        <SmsSettingsSection control={form.control} isDirty={formState.isDirty} />

        {/* Reminders */}
        <SettingsSection
          title={t('admin.settings.notifications.remindersSectionTitle')}
          description={t('admin.settings.notifications.remindersSectionDesc')}
        >
          {!anyChannelEnabled && (
            <p className="text-sm text-muted-foreground">
              {t('admin.settings.notifications.enableChannelHint')}
            </p>
          )}

          <FormField
            control={form.control}
            name="notifReminder24hEnabled"
            render={({ field }) => (
              <FormItem>
                <ToggleRow
                  label={t('admin.settings.notifications.reminder24hLabel')}
                  description={t('admin.settings.notifications.reminder24hDesc')}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={!anyChannelEnabled}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notifReminder2hEnabled"
            render={({ field }) => (
              <FormItem>
                <ToggleRow
                  label={t('admin.settings.notifications.reminder2hLabel')}
                  description={t('admin.settings.notifications.reminder2hDesc')}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                  disabled={!anyChannelEnabled}
                />
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsSection>

        <div className="flex border-t pt-4">
          <Button type="submit" disabled={isSaving || !formState.isDirty}>
            {isSaving ? t('common.saving') : t('admin.nav.saveSettings')}
          </Button>
        </div>
      </form>
    </Form>
  )
}
