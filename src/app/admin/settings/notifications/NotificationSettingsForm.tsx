'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
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
import TelegramRecipientsField from './TelegramRecipientsField'
import { recipientSchema, type RecipientRow } from './recipient-schema'

const formSchema = z.object({
  notifEmailEnabled: z.boolean(),
  notifTelegramEnabled: z.boolean(),
  telegramBotToken: z.string().trim().max(256).optional(),
  notifReminder24hEnabled: z.boolean(),
  notifReminder2hEnabled: z.boolean(),
  recipients: z.array(recipientSchema),
})

export type FormValues = z.infer<typeof formSchema>

async function fetchRecipients(): Promise<RecipientRow[]> {
  const res = await fetch('/api/admin/notification-settings/recipients')
  const data = await res.json()
  return (data.recipients ?? []).map((r: { id: string; chatId: string; label: string | null }) => ({
    dbId: r.id,
    chatId: r.chatId,
    label: r.label ?? '',
  }))
}

function ToggleRow({
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
      recipients: [],
    },
  })

  const { watch, formState } = form
  const emailEnabled = watch('notifEmailEnabled')
  const telegramEnabled = watch('notifTelegramEnabled')
  const anyChannelEnabled = emailEnabled || telegramEnabled

  React.useEffect(() => {
    document.dispatchEvent(
      new CustomEvent('settings-dirty', { detail: { isDirty: formState.isDirty } })
    )
  }, [formState.isDirty])

  React.useEffect(() => {
    async function load() {
      try {
        const [notifRes, emailRes, recipients] = await Promise.all([
          fetch('/api/admin/notification-settings'),
          fetch('/api/admin/email-settings'),
          fetchRecipients(),
        ])
        const notifData = await notifRes.json()
        const emailData = await emailRes.json()
        setSmtpConfigured(Boolean(emailData.smtpHost))
        form.reset({
          notifEmailEnabled: notifData.notifEmailEnabled ?? false,
          notifTelegramEnabled: notifData.notifTelegramEnabled ?? false,
          telegramBotToken: notifData.telegramBotToken ?? '',
          notifReminder24hEnabled: notifData.notifReminder24hEnabled ?? false,
          notifReminder2hEnabled: notifData.notifReminder2hEnabled ?? false,
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
      const { recipients, ...settings } = values
      const res = await fetch('/api/admin/notification-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.code ? t(apiErrorKey(err.code)) : t('admin.settings.notifications.saveFailed'))
      }

      // Diff recipients against the last-loaded/last-saved baseline: new rows
      // (dbId === null) get created, rows dropped from the current list get
      // deleted. Editing an existing recipient in place isn't supported (same
      // as before), so no update case.
      const baseline = form.formState.defaultValues?.recipients ?? []
      const currentIds = new Set(recipients.map((r) => r.dbId).filter(Boolean))
      const toCreate = recipients.filter((r) => r.dbId === null)
      const toDelete = baseline.filter((r) => r?.dbId && !currentIds.has(r.dbId))

      const results = await Promise.allSettled([
        ...toCreate.map((r) =>
          fetch('/api/admin/notification-settings/recipients', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chatId: r.chatId, label: r.label || undefined }),
          })
        ),
        ...toDelete.map((r) =>
          fetch(`/api/admin/notification-settings/recipients/${r!.dbId}`, { method: 'DELETE' })
        ),
      ])
      if (results.some((r) => r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.ok))) {
        throw new Error(t('admin.settings.notifications.saveFailed'))
      }

      const freshRecipients = await fetchRecipients()
      form.reset({ ...settings, recipients: freshRecipients })
      toast.success(t('admin.settings.notifications.saveSuccess'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('admin.settings.notifications.saveFailed'))
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">{t('common.loading')}</div>
  }

  return (
    <Form {...form}>
      <form id="settings-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

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
