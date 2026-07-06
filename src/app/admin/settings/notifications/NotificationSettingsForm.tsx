'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
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

const formSchema = z.object({
  notifEmailEnabled: z.boolean(),
  notifTelegramEnabled: z.boolean(),
  telegramBotToken: z.string().trim().max(256).optional(),
  notifAdminChatId: z.string().trim().max(64).optional(),
  notifReminder24hEnabled: z.boolean(),
  notifReminder2hEnabled: z.boolean(),
})

type FormValues = z.infer<typeof formSchema>

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
          {checked ? 'On' : 'Off'}
        </span>
        <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
      </div>
    </div>
  )
}

export default function NotificationSettingsForm() {
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [smtpConfigured, setSmtpConfigured] = React.useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      notifEmailEnabled: false,
      notifTelegramEnabled: false,
      telegramBotToken: '',
      notifAdminChatId: '',
      notifReminder24hEnabled: false,
      notifReminder2hEnabled: false,
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
        const [notifRes, emailRes] = await Promise.all([
          fetch('/api/admin/notification-settings'),
          fetch('/api/admin/email-settings'),
        ])
        const notifData = await notifRes.json()
        const emailData = await emailRes.json()
        setSmtpConfigured(Boolean(emailData.smtpHost))
        form.reset({
          notifEmailEnabled: notifData.notifEmailEnabled ?? false,
          notifTelegramEnabled: notifData.notifTelegramEnabled ?? false,
          telegramBotToken: notifData.telegramBotToken ?? '',
          notifAdminChatId: notifData.notifAdminChatId ?? '',
          notifReminder24hEnabled: notifData.notifReminder24hEnabled ?? false,
          notifReminder2hEnabled: notifData.notifReminder2hEnabled ?? false,
        })
      } catch {
        toast.error('Failed to load notification settings')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [form])

  async function onSubmit(values: FormValues) {
    setIsSaving(true)
    try {
      const res = await fetch('/api/admin/notification-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Save failed')
      }
      form.reset(values)
      toast.success('Notification settings saved')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading…</div>
  }

  return (
    <Form {...form}>
      <form id="settings-form" onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

        {/* Email channel */}
        <SettingsSection
          title="Email"
          description="Send booking confirmations and reminders by email. Requires SMTP configured under Email Settings."
        >
          <FormField
            control={form.control}
            name="notifEmailEnabled"
            render={({ field }) => (
              <FormItem>
                <ToggleRow
                  label="Send email notifications"
                  description={
                    smtpConfigured
                      ? 'Booking confirmations and reminders sent via email.'
                      : <span className="text-destructive font-medium">SMTP not configured — go to <a href="/admin/settings/email" className="underline">Email Settings</a> first.</span>
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
          title="Telegram"
          description="Admin alerts for new bookings and contact form submissions via a Telegram bot."
        >
          <FormField
            control={form.control}
            name="notifTelegramEnabled"
            render={({ field }) => (
              <FormItem>
                <ToggleRow
                  label="Send Telegram notifications"
                  description="Admin alerts for new bookings and contact form submissions."
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
                <FormLabel>Bot Token</FormLabel>
                <FormControl>
                  <Input
                    placeholder="1234567890:ABCdef..."
                    type="password"
                    autoComplete="off"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Get it from <code>@BotFather</code> → /newbot or /mybots.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="notifAdminChatId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Admin Chat ID</FormLabel>
                <FormControl>
                  <Input placeholder="e.g. 123456789" {...field} />
                </FormControl>
                <FormDescription>
                  Send <code>/start</code> to your bot, then message <code>@userinfobot</code> to get your Chat ID.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsSection>

        {/* Reminders */}
        <SettingsSection
          title="Reminders"
          description="Automated appointment reminders, sent on the channels enabled above."
        >
          {!anyChannelEnabled && (
            <p className="text-sm text-muted-foreground">
              Enable at least one channel above to activate reminders.
            </p>
          )}

          <FormField
            control={form.control}
            name="notifReminder24hEnabled"
            render={({ field }) => (
              <FormItem>
                <ToggleRow
                  label="24-hour reminder"
                  description="Remind clients one day before their appointment."
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
                  label="2-hour reminder"
                  description="Remind clients two hours before their appointment."
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
            {isSaving ? 'Saving…' : 'Save Settings'}
          </Button>
        </div>
      </form>
    </Form>
  )
}
