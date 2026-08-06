'use client'

import * as React from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'
import type { Control } from 'react-hook-form'
import { useFieldArray } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { FormValues } from './NotificationSettingsForm'

interface TelegramRecipientsFieldProps {
  control: Control<FormValues>
}

/**
 * Staged, not auto-saved: add/remove only edit the in-memory field array
 * (react-hook-form marks the form dirty), so recipients persist together
 * with the rest of the page on the shared "Save Settings" click. Previously
 * this posted/deleted immediately on click, bypassing the form entirely —
 * a user who filled the fields and clicked the (seemingly complete) "Save
 * Settings" button instead lost the recipient silently (2026-08-06 bug report).
 */
export default function TelegramRecipientsField({ control }: TelegramRecipientsFieldProps) {
  const { t } = useTranslation()
  const { fields, append, remove } = useFieldArray({ control, name: 'recipients' })
  const [newChatId, setNewChatId] = React.useState('')
  const [newLabel, setNewLabel] = React.useState('')

  function handleAdd() {
    if (!newChatId.trim()) return
    append({ dbId: null, chatId: newChatId.trim(), label: newLabel.trim() })
    setNewChatId('')
    setNewLabel('')
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium leading-none">{t('admin.settings.notifications.recipientsLabel')}</p>
        <p className="mt-1 text-xs text-muted-foreground">{t('admin.settings.notifications.recipientsDesc')}</p>
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('admin.settings.notifications.noRecipientsHint')}</p>
      ) : (
        <div className="space-y-2">
          {fields.map((field, index) => (
            <div key={field.id} className="flex items-center gap-2">
              <Input value={field.chatId} disabled className="flex-1" />
              <Input value={field.label ?? ''} disabled className="flex-1" />
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
      )}

      <div className="flex items-center gap-2">
        <Input
          value={newChatId}
          onChange={(e) => setNewChatId(e.target.value)}
          placeholder={t('admin.settings.notifications.recipientChatIdPlaceholder')}
          className="flex-1"
        />
        <Input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          placeholder={t('admin.settings.notifications.recipientLabelPlaceholder')}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 gap-1 shrink-0"
          disabled={!newChatId.trim()}
          onClick={handleAdd}
        >
          <Plus className="w-3.5 h-3.5" />
          {t('admin.settings.notifications.addRecipientBtn')}
        </Button>
      </div>

      <p className="text-[0.8rem] text-muted-foreground">
        <Trans i18nKey="admin.settings.notifications.groupChatHelp" components={{ code: <code /> }} />
      </p>
    </div>
  )
}
