'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { useConfirm } from '@/components/ConfirmDialogProvider'
import { apiErrorKey } from '@/lib/errors/apiErrorKey'
import { localeFor } from '@/lib/i18n-shared'
import { useCurrentLanguage } from '@/contexts/LanguageContext'

interface Props {
  masterName?: string
  initialCalendarId: string
  syncStatus: string | null
  syncError: string | null
  syncedAt: string | null
  saveUrl: string
  testUrl: string
  onSaved?: () => void
}

/**
 * Shared connect/test/disconnect control for one master's Google calendar,
 * used by both the admin settings page and the master's own page.
 */
export default function MasterCalendarField({
  masterName,
  initialCalendarId,
  syncStatus,
  syncError,
  syncedAt,
  saveUrl,
  testUrl,
  onSaved,
}: Props) {
  const { t } = useTranslation()
  const lang = useCurrentLanguage()
  const confirm = useConfirm()
  const [value, setValue] = React.useState(initialCalendarId)
  const [busy, setBusy] = React.useState<'save' | 'test' | 'disconnect' | null>(null)

  React.useEffect(() => {
    setValue(initialCalendarId)
  }, [initialCalendarId])

  async function errorMessage(res: Response): Promise<string> {
    const err = await res.json().catch(() => ({}))
    return t(apiErrorKey(err.code))
  }

  async function put(calendarId: string, kind: 'save' | 'disconnect') {
    setBusy(kind)
    try {
      const res = await fetch(saveUrl, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId }),
      })
      if (!res.ok) {
        toast.error(await errorMessage(res))
        return
      }
      const data = await res.json().catch(() => ({}))
      if (kind === 'disconnect') setValue('')
      toast.success(t('admin.settings.googleCalendar.saveSuccess'))
      if (data.queued > 0) {
        toast.info(t('admin.settings.googleCalendar.backfillQueued', { count: data.queued }))
      }
      onSaved?.()
    } catch {
      toast.error(t('admin.settings.googleCalendar.saveFailed'))
    } finally {
      setBusy(null)
    }
  }

  async function test() {
    setBusy('test')
    try {
      const res = await fetch(testUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ calendarId: value }),
      })
      if (!res.ok) {
        toast.error(await errorMessage(res))
        return
      }
      toast.success(t('admin.settings.googleCalendar.testCalendarSuccess'))
    } catch {
      toast.error(t('errors.generic'))
    } finally {
      setBusy(null)
    }
  }

  async function disconnect() {
    if (!(await confirm(t('admin.settings.googleCalendar.disconnectConfirm')))) return
    await put('', 'disconnect')
  }

  const badge =
    syncStatus === 'ok'
      ? { variant: 'success' as const, label: t('admin.settings.googleCalendar.statusOk') }
      : syncStatus === 'error'
        ? { variant: 'warning' as const, label: t('admin.settings.googleCalendar.statusError') }
        : { variant: 'muted' as const, label: t('admin.settings.googleCalendar.statusNotConnected') }

  const inputId = React.useId()

  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={inputId}>
          {masterName ? `${masterName} — ` : ''}
          {t('admin.settings.googleCalendar.calendarIdLabel')}
        </Label>
        <Badge variant={badge.variant}>{badge.label}</Badge>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          id={inputId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t('admin.settings.googleCalendar.calendarIdPlaceholder')}
          autoComplete="off"
          className="sm:max-w-md"
        />
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={busy !== null} onClick={() => put(value, 'save')}>
            {t('admin.settings.googleCalendar.saveBtn')}
          </Button>
          <Button type="button" variant="outline" disabled={busy !== null || !value.trim()} onClick={test}>
            {t('admin.settings.googleCalendar.testCalendarBtn')}
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={busy !== null || !initialCalendarId}
            onClick={disconnect}
          >
            {t('admin.settings.googleCalendar.disconnectBtn')}
          </Button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t('admin.settings.googleCalendar.calendarIdDesc')}</p>
      {syncedAt && (
        <p className="text-xs text-muted-foreground">
          {t('admin.settings.googleCalendar.lastSyncedAt', {
            time: new Date(syncedAt).toLocaleString(localeFor(lang)),
          })}
        </p>
      )}
      {syncStatus === 'error' && syncError && (
        <p className="truncate text-xs text-destructive" title={syncError}>
          {syncError}
        </p>
      )}
    </div>
  )
}
