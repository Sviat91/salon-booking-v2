'use client'

import * as React from 'react'
import { useForm } from 'react-hook-form'
import type { FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { SettingsSection } from '@/app/admin/settings/FormFields'
import { apiErrorKey } from '@/lib/errors/apiErrorKey'
import FormSkeleton from '@/components/admin/skeletons/FormSkeleton'
import ReminderTemplateField from './ReminderTemplateField'
import {
  REMINDER_TEMPLATE_TYPES,
  REMINDER_CHANNELS,
  DEFAULT_REMINDER_BODIES,
  type ReminderType,
  type ReminderChannel,
} from '@/lib/notifications/templates'
import { LANGUAGE_NAMES, type Language } from '@/lib/i18n-shared'

interface ReminderTemplatesFormProps {
  enabledLocales: Language[]
}

interface TemplateApiRow {
  type: ReminderType
  language: Language
  channel: ReminderChannel
  body: string
  isDefault: boolean
}

function fieldName(channel: ReminderChannel, type: ReminderType, lang: Language): string {
  return `${channel}__${type}__${lang}`
}

const formSchema = z.record(z.string().max(4000))
type FormValues = z.infer<typeof formSchema>

const TYPE_TITLE_KEYS: Record<ReminderType, string> = {
  BOOKING_REMINDER_24H: 'admin.settings.reminderTemplates.section24hTitle',
  BOOKING_REMINDER_2H: 'admin.settings.reminderTemplates.section2hTitle',
}

const CHANNEL_LABEL_KEYS: Record<ReminderChannel, string> = {
  sms: 'admin.settings.reminderTemplates.channelSms',
  email: 'admin.settings.reminderTemplates.channelEmail',
  telegram: 'admin.settings.reminderTemplates.channelTelegram',
}

const CHANNEL_DESC_KEYS: Record<ReminderChannel, string> = {
  sms: 'admin.settings.reminderTemplates.channelSmsDesc',
  email: 'admin.settings.reminderTemplates.channelEmailDesc',
  telegram: 'admin.settings.reminderTemplates.channelTelegramDesc',
}

async function loadTemplates(): Promise<{ values: FormValues; rows: TemplateApiRow[] }> {
  const res = await fetch('/api/admin/reminder-templates')
  const data = await res.json()
  const rows: TemplateApiRow[] = data.templates ?? []
  const values: FormValues = {}
  for (const row of rows) {
    if (!row.isDefault) {
      values[fieldName(row.channel, row.type, row.language)] = row.body
    }
  }
  return { values, rows }
}

export default function ReminderTemplatesForm({ enabledLocales }: ReminderTemplatesFormProps) {
  const { t } = useTranslation()
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [channel, setChannel] = React.useState<ReminderChannel>('sms')

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {},
  })

  React.useEffect(() => {
    async function load() {
      try {
        const { values } = await loadTemplates()
        form.reset(values)
      } catch {
        toast.error(t('admin.settings.reminderTemplates.loadFailed'))
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [form, t])

  async function onSubmit(values: FormValues) {
    setIsSaving(true)
    try {
      const templates = REMINDER_CHANNELS.flatMap((c) =>
        REMINDER_TEMPLATE_TYPES.flatMap((type) =>
          enabledLocales.map((language) => ({
            type,
            language,
            channel: c,
            body: values[fieldName(c, type, language)] ?? '',
          }))
        )
      )

      const res = await fetch('/api/admin/reminder-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.code ? t(apiErrorKey(err.code)) : t('admin.settings.reminderTemplates.saveFailed'))
      }

      const { values: freshValues } = await loadTemplates()
      form.reset(freshValues)
      toast.success(t('admin.settings.reminderTemplates.saveSuccess'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('admin.settings.reminderTemplates.saveFailed'))
    } finally {
      setIsSaving(false)
    }
  }

  function onInvalid(errors: FieldErrors<FormValues>) {
    console.error('[ReminderTemplatesForm] submit blocked by validation', errors)
    toast.error(t('admin.settings.reminderTemplates.saveFailed'))
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <FormSkeleton />
        <FormSkeleton />
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} className="space-y-6">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            {REMINDER_CHANNELS.map((c) => (
              <Button
                type="button"
                key={c}
                size="sm"
                variant={c === channel ? 'default' : 'outline'}
                aria-pressed={c === channel}
                onClick={() => setChannel(c)}
              >
                {t(CHANNEL_LABEL_KEYS[c])}
              </Button>
            ))}
          </div>
          <p className="text-sm text-muted-foreground">{t(CHANNEL_DESC_KEYS[channel])}</p>
        </div>

        {REMINDER_TEMPLATE_TYPES.map((type) => (
          <SettingsSection key={type} title={t(TYPE_TITLE_KEYS[type])} description={t('admin.settings.reminderTemplates.transactionalOnlyNote')}>
            {enabledLocales.map((lang) => (
              <ReminderTemplateField
                key={fieldName(channel, type, lang)}
                control={form.control}
                name={fieldName(channel, type, lang)}
                label={LANGUAGE_NAMES[lang]}
                placeholder={DEFAULT_REMINDER_BODIES[channel][type][lang]}
                channel={channel}
              />
            ))}
          </SettingsSection>
        ))}

        <div className="flex border-t pt-4">
          <Button type="submit" disabled={isSaving || !form.formState.isDirty}>
            {isSaving ? t('common.saving') : t('admin.nav.saveSettings')}
          </Button>
        </div>
      </form>
    </Form>
  )
}
