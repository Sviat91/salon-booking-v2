'use client'

import * as React from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import type { Control } from 'react-hook-form'
import { useFieldArray } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FormField } from '@/components/ui/form'
import type { FormValues } from './NotificationSettingsForm'

interface TelegramRecipientsFieldProps {
  control: Control<FormValues>
}

/**
 * Every row (including the very first, empty one) is a live field-array
 * entry — type directly into it, no separate "stage then click Add" step.
 * The whole page saves together on the shared "Save Settings" click, same
 * as any other field here (2026-08-07: the earlier two-step add flow read
 * as broken — a user with exactly one recipient had to click "+ Add
 * recipient" before Save would pick up what they'd typed). "+ Add recipient"
 * only exists to append an *additional* row beyond the first. Blank rows
 * (chatId trims to '') are silently ignored on save, never sent to the API
 * — see the diff logic in NotificationSettingsForm.tsx's onSubmit.
 * These inputs must stay `Controller`/`FormField`-bound rather than
 * `register()`-bound: `src/components/ui/input.tsx` is not `forwardRef`-
 * wrapped under React 18, so `register()`'s ref never attaches and RHF then
 * reads `undefined` off the `_f.ref` stub on every keystroke.
 */
export default function TelegramRecipientsField({ control }: TelegramRecipientsFieldProps) {
  const { t } = useTranslation()
  const { fields, append, remove } = useFieldArray({ control, name: 'recipients' })

  // Always keep at least one editable slot on screen, even after the user
  // removes every row (e.g. clearing out to zero recipients).
  React.useEffect(() => {
    if (fields.length === 0) {
      append({ dbId: null, chatId: '', label: '' })
    }
  }, [fields.length, append])

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium leading-none">{t('admin.settings.notifications.recipientsLabel')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('admin.settings.notifications.recipientsDesc')}</p>
      </div>

      <div className="space-y-2">
        {fields.map((row, index) => (
          <div key={row.id} className="flex items-center gap-2">
            <FormField
              control={control}
              name={`recipients.${index}.chatId` as const}
              render={({ field }) => (
                <Input
                  name={field.name}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  maxLength={64}
                  placeholder={t('admin.settings.notifications.recipientChatIdPlaceholder')}
                  className="flex-1"
                />
              )}
            />
            <FormField
              control={control}
              name={`recipients.${index}.label` as const}
              render={({ field }) => (
                <Input
                  name={field.name}
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  maxLength={64}
                  placeholder={t('admin.settings.notifications.recipientLabelPlaceholder')}
                  className="flex-1"
                />
              )}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="hover:text-destructive shrink-0"
              aria-label={t('admin.settings.notifications.removeRecipientAria')}
              onClick={() => remove(index)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1"
        onClick={() => append({ dbId: null, chatId: '', label: '' })}
      >
        <Plus className="w-3.5 h-3.5" />
        {t('admin.settings.notifications.addRecipientBtn')}
      </Button>

      <p className="text-[0.8rem] text-muted-foreground">
        <Trans i18nKey="admin.settings.notifications.groupChatHelp" components={{ code: <code /> }} />
      </p>
    </div>
  )
}
