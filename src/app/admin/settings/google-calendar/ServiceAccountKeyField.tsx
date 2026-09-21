'use client'

import * as React from 'react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { FormControl, FormDescription } from '@/components/ui/form'
import { parseServiceAccountKey } from '@/lib/google-calendar/config'

export const KEY_MASK = '••••••••'
// Matches the form schema's max(8192) — a bigger file could never be saved.
const MAX_FILE_BYTES = 8192

interface Props {
  value: string
  onChange: (value: string) => void
  onBlur: () => void
  hasKey: boolean
  onParsedEmail: (email: string | null) => void
}

interface LoadedFile {
  name: string
  email: string
  text: string
}

export default function ServiceAccountKeyField({
  value,
  onChange,
  onBlur,
  hasKey,
  onParsedEmail,
}: Props) {
  const { t } = useTranslation()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [loaded, setLoaded] = React.useState<LoadedFile | null>(null)

  // The loaded key text lives only in form state; it is never rendered.
  const fileActive = loaded !== null && value === loaded.text

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      if (file.size > MAX_FILE_BYTES) throw new Error('too large')
      const text = await file.text()
      const parsed = parseServiceAccountKey(text)
      if (!parsed) throw new Error('invalid')
      onChange(text)
      onParsedEmail(parsed.clientEmail)
      setLoaded({ name: file.name, email: parsed.clientEmail, text })
    } catch {
      toast.error(t('admin.settings.googleCalendar.fileInvalid'))
    }
  }

  function onPasteChange(text: string) {
    onChange(text)
    setLoaded(null)
    if (text === KEY_MASK) return
    // Clearing the field or pasting text that isn't a valid key must drop any earlier
    // file/paste email, otherwise the "not saved yet" row keeps showing a stale address.
    onParsedEmail(parseServiceAccountKey(text)?.clientEmail ?? null)
  }

  function discardFile() {
    onChange(hasKey ? KEY_MASK : '')
    setLoaded(null)
    onParsedEmail(null)
  }

  function removeSavedKey() {
    onChange('')
    onParsedEmail(null)
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" />
          {t('admin.settings.googleCalendar.chooseFileBtn')}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          aria-label={t('admin.settings.googleCalendar.chooseFileBtn')}
          onChange={onFilePicked}
        />
        {fileActive && loaded && (
          <>
            <span className="min-w-0 truncate text-xs text-muted-foreground">
              {t('admin.settings.googleCalendar.fileLoaded', { name: loaded.name })} ({loaded.email})
            </span>
            <Button type="button" variant="ghost" size="sm" onClick={discardFile}>
              <X className="h-3.5 w-3.5" />
              {t('admin.settings.googleCalendar.discardFileBtn')}
            </Button>
          </>
        )}
        {hasKey && !fileActive && value === KEY_MASK && (
          <Button type="button" variant="ghost" size="sm" onClick={removeSavedKey}>
            <X className="h-3.5 w-3.5" />
            {t('admin.settings.googleCalendar.removeKeyBtn')}
          </Button>
        )}
      </div>

      {hasKey && !fileActive && (
        <FormDescription>{t('admin.settings.googleCalendar.keyConfiguredHint')}</FormDescription>
      )}

      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
          {t('admin.settings.googleCalendar.pasteInsteadLabel')}
        </summary>
        <div className="mt-2">
          <FormControl>
            <Textarea
              rows={5}
              autoComplete="off"
              spellCheck={false}
              className="font-mono text-xs"
              placeholder={t('admin.settings.googleCalendar.keyPlaceholder')}
              value={fileActive ? '' : value}
              onChange={(e) => onPasteChange(e.target.value)}
              onBlur={onBlur}
              onFocus={(e) => {
                if (e.target.value === KEY_MASK) e.target.select()
              }}
            />
          </FormControl>
        </div>
      </details>
    </div>
  )
}
