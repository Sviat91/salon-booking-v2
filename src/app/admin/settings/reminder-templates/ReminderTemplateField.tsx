'use client'

import * as React from 'react'
import type { Control } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { FormField, FormItem, FormMessage } from '@/components/ui/form'
import {
  TEMPLATE_PLACEHOLDERS,
  MAX_BODY_LENGTH,
  estimateSmsSegments,
  type ReminderChannel,
} from '@/lib/notifications/templates'

type FormValues = Record<string, string>

interface ReminderTemplateFieldProps {
  control: Control<FormValues>
  name: string // the RHF field key, also the <textarea> DOM id
  label: string // LANGUAGE_NAMES[lang]
  placeholder: string // DEFAULT_REMINDER_BODIES[channel][type][lang]
  channel: ReminderChannel
}

/** Inserts `{{token}}` at the textarea's current cursor position. */
function insertPlaceholder(
  fieldId: string,
  token: string,
  currentValue: string,
  onChange: (v: string) => void
) {
  const insertion = `{{${token}}}`
  const el = document.getElementById(fieldId) as HTMLTextAreaElement | null

  if (!el) {
    onChange((currentValue || '') + insertion)
    return
  }

  const start = el.selectionStart ?? currentValue.length
  const end = el.selectionEnd ?? currentValue.length
  const next = currentValue.slice(0, start) + insertion + currentValue.slice(end)
  onChange(next)

  requestAnimationFrame(() => {
    el.focus()
    const pos = start + insertion.length
    el.setSelectionRange(pos, pos)
  })
}

export default function ReminderTemplateField({
  control,
  name,
  label,
  placeholder,
  channel,
}: ReminderTemplateFieldProps) {
  const { t } = useTranslation()

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => {
        const value = field.value ?? ''
        const estimate = estimateSmsSegments(value)
        const encodingLabel = t(
          estimate.encoding === 'gsm7'
            ? 'admin.settings.reminderTemplates.encodingGsm7'
            : 'admin.settings.reminderTemplates.encodingUcs2'
        )
        return (
          <FormItem>
            <div className="flex items-center justify-between gap-2">
              <label htmlFor={name} className="text-sm font-medium leading-none">
                {label}
              </label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={() => field.onChange('')}
              >
                {t('admin.settings.reminderTemplates.resetToDefault')}
              </Button>
            </div>
            <Textarea
              id={name}
              name={field.name}
              value={value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              rows={channel === 'sms' ? 3 : 8}
              maxLength={MAX_BODY_LENGTH[channel]}
              placeholder={placeholder}
            />
            <div className="flex flex-wrap items-center gap-2">
              {TEMPLATE_PLACEHOLDERS.map((token) => (
                <button
                  key={token}
                  type="button"
                  className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[0.7rem] text-muted-foreground hover:bg-muted"
                  onClick={() => insertPlaceholder(name, token, value, field.onChange)}
                >
                  {`{{${token}}}`}
                </button>
              ))}
            </div>
            {channel === 'sms' && (
              <p className="text-xs text-muted-foreground">
                {t('admin.settings.reminderTemplates.segmentCounter', {
                  chars: estimate.chars,
                  encoding: encodingLabel,
                  segments: estimate.segments,
                })}
                {estimate.encoding === 'ucs2' && (
                  <span className="block">{t('admin.settings.reminderTemplates.diacriticsHint')}</span>
                )}
              </p>
            )}
            <FormMessage />
          </FormItem>
        )
      }}
    />
  )
}
