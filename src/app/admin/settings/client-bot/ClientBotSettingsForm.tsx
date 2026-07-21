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

const formSchema = z.object({
  clientBotEnabled: z.boolean(),
  clientBotToken: z.string().trim().max(256).optional(),
  clientBotUsername: z.string().trim().max(64).optional(),
  clientBotSiteUrl: z.union([
    z.literal(''),
    z.string().trim().max(512).url({ message: 'Enter a valid URL (e.g. https://example.com)' }),
  ]).optional(),
})

type FormValues = z.infer<typeof formSchema>

function ToggleRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string
  description?: React.ReactNode
  checked: boolean
  onCheckedChange: (v: boolean) => void
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
        <Switch checked={checked} onCheckedChange={onCheckedChange} />
      </div>
    </div>
  )
}

export default function ClientBotSettingsForm() {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      clientBotEnabled: false,
      clientBotToken: '',
      clientBotUsername: '',
      clientBotSiteUrl: '',
    },
  })

  const { formState } = form

  React.useEffect(() => {
    document.dispatchEvent(
      new CustomEvent('settings-dirty', { detail: { isDirty: formState.isDirty } })
    )
  }, [formState.isDirty])

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/admin/client-bot-settings')
        const data = await res.json()
        form.reset({
          clientBotEnabled: data.clientBotEnabled ?? false,
          clientBotToken: data.clientBotToken ?? '',
          clientBotUsername: data.clientBotUsername ?? '',
          clientBotSiteUrl: data.clientBotSiteUrl ?? '',
        })
      } catch {
        toast.error(t('admin.settings.clientBot.loadFailed'))
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [form])

  async function onSubmit(values: FormValues) {
    setIsSaving(true)
    try {
      const res = await fetch('/api/admin/client-bot-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.code ? t(apiErrorKey(err.code)) : t('admin.settings.clientBot.saveFailed'))
      }
      form.reset(values)
      toast.success(t('admin.settings.clientBot.saveSuccess'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('admin.settings.clientBot.saveFailed'))
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

        <SettingsSection
          title={t('admin.settings.clientBot.sectionTitle')}
          description={t('admin.settings.clientBot.sectionDesc')}
        >
          <FormField
            control={form.control}
            name="clientBotEnabled"
            render={({ field }) => (
              <FormItem>
                <ToggleRow
                  label={t('admin.settings.clientBot.enableLabel')}
                  description={t('admin.settings.clientBot.enableDesc')}
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="clientBotToken"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('admin.settings.clientBot.tokenLabel')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('admin.settings.clientBot.tokenPlaceholder')}
                    type="password"
                    autoComplete="off"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  <Trans i18nKey="admin.settings.clientBot.tokenDesc" components={{ code: <code /> }} />
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="clientBotUsername"
            render={({ field }) => {
              const username = field.value?.trim().replace(/^@/, '')
              return (
                <FormItem>
                  <FormLabel>{t('admin.settings.clientBot.usernameLabel')}</FormLabel>
                  <FormControl>
                    <Input placeholder={t('admin.settings.clientBot.usernamePlaceholder')} {...field} />
                  </FormControl>
                  <FormDescription>{t('admin.settings.clientBot.usernameDesc')}</FormDescription>
                  {username && (
                    <a
                      href={`https://t.me/${username}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs underline text-neutral-500 dark:text-dark-muted hover:text-primary dark:hover:text-accent transition-colors"
                    >
                      {t('admin.settings.clientBot.openBotLink')}
                    </a>
                  )}
                  <FormMessage />
                </FormItem>
              )
            }}
          />

          <FormField
            control={form.control}
            name="clientBotSiteUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('admin.settings.clientBot.siteUrlLabel')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('admin.settings.clientBot.siteUrlPlaceholder')} {...field} />
                </FormControl>
                <FormDescription>{t('admin.settings.clientBot.siteUrlDesc')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsSection>

        <SettingsSection
          title={t('admin.settings.clientBot.setupSectionTitle')}
          description={t('admin.settings.clientBot.setupSectionDesc')}
        >
          <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
            <li>
              <Trans i18nKey="admin.settings.clientBot.setupStep1" components={{ code: <code /> }} />
            </li>
            <li>{t('admin.settings.clientBot.setupStep2')}</li>
            <li>{t('admin.settings.clientBot.setupStep3')}</li>
            <li>{t('admin.settings.clientBot.setupStep4')}</li>
          </ol>
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
