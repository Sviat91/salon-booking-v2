'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { Trans, useTranslation } from 'react-i18next'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Form,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { SettingsSection } from '@/app/admin/settings/FormFields'
import { apiErrorKey } from '@/lib/errors/apiErrorKey'
import FormSkeleton from '@/components/admin/skeletons/FormSkeleton'
import MasterCalendarField from '@/components/admin/google-calendar/MasterCalendarField'
import GoogleCalendarInstructions from './GoogleCalendarInstructions'
import ServiceAccountKeyField, { KEY_MASK as MASK } from './ServiceAccountKeyField'

const formSchema = z.object({
  googleCalendarEnabled: z.boolean(),
  serviceAccountKey: z.string().max(8192),
})

type FormValues = z.infer<typeof formSchema>

interface MasterRow {
  id: string
  name: string | null
  calendarId: string
  syncStatus: string | null
  syncError: string | null
  syncedAt: string | null
}

export default function GoogleCalendarSettingsForm() {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [isTesting, setIsTesting] = React.useState(false)
  const [hasKey, setHasKey] = React.useState(false)
  const [serviceAccountEmail, setServiceAccountEmail] = React.useState('')
  const [pendingEmail, setPendingEmail] = React.useState<string | null>(null)
  const [masters, setMasters] = React.useState<MasterRow[]>([])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { googleCalendarEnabled: false, serviceAccountKey: '' },
  })

  const { formState } = form

  React.useEffect(() => {
    document.dispatchEvent(
      new CustomEvent('settings-dirty', { detail: { isDirty: formState.isDirty } })
    )
  }, [formState.isDirty])

  const load = React.useCallback(async () => {
    try {
      const res = await fetch('/api/admin/google-calendar-settings')
      if (!res.ok) throw new Error('load failed')
      const data = await res.json()
      setHasKey(Boolean(data.hasKey))
      setServiceAccountEmail(data.serviceAccountEmail ?? '')
      setMasters(data.masters ?? [])
      return data as { googleCalendarEnabled?: boolean; hasKey?: boolean }
    } catch {
      toast.error(t('admin.settings.googleCalendar.loadFailed'))
      return null
    }
  }, [t])

  React.useEffect(() => {
    async function init() {
      const data = await load()
      if (data) {
        form.reset({
          googleCalendarEnabled: data.googleCalendarEnabled ?? false,
          serviceAccountKey: data.hasKey ? MASK : '',
        })
        setPendingEmail(null)
      }
      setIsLoading(false)
    }
    init()
  }, [form, load])

  async function onSubmit(values: FormValues) {
    setIsSaving(true)
    try {
      const res = await fetch('/api/admin/google-calendar-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.code ? t(apiErrorKey(err.code)) : t('admin.settings.googleCalendar.saveFailed'))
      }
      const data = await load()
      form.reset({
        googleCalendarEnabled: values.googleCalendarEnabled,
        serviceAccountKey: data?.hasKey ? MASK : '',
      })
      setPendingEmail(null)
      toast.success(t('admin.settings.googleCalendar.saveSuccess'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('admin.settings.googleCalendar.saveFailed'))
    } finally {
      setIsSaving(false)
    }
  }

  function onInvalid() {
    toast.error(t('admin.settings.googleCalendar.saveFailed'))
  }

  async function testConnection() {
    setIsTesting(true)
    try {
      const res = await fetch('/api/admin/google-calendar-settings/test', { method: 'POST' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        toast.error(t(apiErrorKey(err.code)))
        return
      }
      toast.success(t('admin.settings.googleCalendar.testKeySuccess'))
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setIsTesting(false)
    }
  }

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(shownEmail)
      toast.success(t('admin.settings.googleCalendar.copiedToast'))
    } catch {
      toast.error(t('errors.generic'))
    }
  }

  const shownEmail = pendingEmail ?? serviceAccountEmail
  const showTestHint = !hasKey || Boolean(formState.dirtyFields.serviceAccountKey)

  if (isLoading) {
    // No translated text here — see NotificationSettingsForm.tsx (hydration rule).
    return (
      <div className="flex flex-col gap-6">
        <FormSkeleton />
      </div>
    )
  }

  return (
    <Form {...form}>
      <form
        id="settings-form"
        onSubmit={form.handleSubmit(onSubmit, onInvalid)}
        className="space-y-6"
      >
        <SettingsSection
          title={t('admin.settings.googleCalendar.accountSectionTitle')}
          description={t('admin.settings.googleCalendar.accountSectionDesc')}
        >
          <GoogleCalendarInstructions />

          <FormField
            control={form.control}
            name="googleCalendarEnabled"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center justify-between gap-4 py-1">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium leading-none">
                      {t('admin.settings.googleCalendar.enableLabel')}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('admin.settings.googleCalendar.enableDesc')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground w-7 text-right">
                      {field.value
                        ? t('admin.settings.notifications.onLabel')
                        : t('admin.settings.notifications.offLabel')}
                    </span>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </div>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="serviceAccountKey"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('admin.settings.googleCalendar.keyLabel')}</FormLabel>
                <ServiceAccountKeyField
                  value={field.value}
                  onChange={(v) =>
                    form.setValue('serviceAccountKey', v, {
                      shouldDirty: true,
                      shouldValidate: true,
                    })
                  }
                  onBlur={field.onBlur}
                  hasKey={hasKey}
                  onParsedEmail={setPendingEmail}
                />
                <FormDescription>
                  <Trans
                    i18nKey="admin.settings.googleCalendar.keyDesc"
                    components={{ code: <code /> }}
                  />
                </FormDescription>
                {hasKey && (
                  <FormDescription>
                    {t('admin.settings.googleCalendar.keyClearHint')}
                  </FormDescription>
                )}
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-1.5">
            <p className="text-sm font-medium">
              {t('admin.settings.googleCalendar.serviceAccountEmailLabel')}
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs">
                {shownEmail || t('admin.settings.googleCalendar.serviceAccountEmailEmpty')}
              </code>
              <Button
                type="button"
                variant="outline"
                disabled={!shownEmail}
                onClick={copyEmail}
              >
                <Copy className="h-3.5 w-3.5" />
                {t('admin.settings.googleCalendar.copyEmailBtn')}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {t('admin.settings.googleCalendar.serviceAccountEmailDesc')}
            </p>
            {pendingEmail && (
              <p className="text-xs text-muted-foreground">
                {t('admin.settings.googleCalendar.emailNotSavedHint')}
              </p>
            )}
          </div>

          <div>
            <Button
              type="button"
              variant="outline"
              disabled={isTesting || !hasKey}
              onClick={testConnection}
            >
              {isTesting
                ? t('admin.settings.googleCalendar.testingBtn')
                : t('admin.settings.googleCalendar.testKeyBtn')}
            </Button>
            {showTestHint && (
              <p className="mt-1.5 text-xs text-muted-foreground">
                {t('admin.settings.googleCalendar.testAfterSaveHint')}
              </p>
            )}
          </div>
        </SettingsSection>

        <SettingsSection
          title={t('admin.settings.googleCalendar.mastersSectionTitle')}
          description={t('admin.settings.googleCalendar.mastersSectionDesc')}
        >
          {masters.map((m) => (
            <MasterCalendarField
              key={m.id}
              masterName={m.name ?? undefined}
              initialCalendarId={m.calendarId}
              syncStatus={m.syncStatus}
              syncError={m.syncError}
              syncedAt={m.syncedAt}
              saveUrl={`/api/admin/masters/${m.id}/google-calendar`}
              testUrl={`/api/admin/masters/${m.id}/google-calendar/test`}
              onSaved={load}
            />
          ))}
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
