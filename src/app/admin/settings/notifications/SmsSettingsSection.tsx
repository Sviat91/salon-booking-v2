'use client'

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import type { Control } from 'react-hook-form'
import { useWatch } from 'react-hook-form'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectItemText } from '@/components/ui/select'
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { SettingsSection } from '@/app/admin/settings/FormFields'
import { apiErrorKey } from '@/lib/errors/apiErrorKey'
import { ToggleRow } from './NotificationSettingsForm'
import type { FormValues } from './NotificationSettingsForm'
import SmsInstructions from './SmsInstructions'

interface SmsSettingsSectionProps {
  control: Control<FormValues>
  isDirty: boolean
}

export default function SmsSettingsSection({ control, isDirty }: SmsSettingsSectionProps) {
  const { t } = useTranslation()
  const [testPhone, setTestPhone] = React.useState('')
  const [isTesting, setIsTesting] = React.useState(false)

  const smsProvider = useWatch({ control, name: 'smsProvider' })

  async function handleTestSend() {
    if (!testPhone.trim()) return
    setIsTesting(true)
    try {
      const res = await fetch('/api/admin/sms-settings/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testPhone }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.code ? t(apiErrorKey(data.code)) : (data.error || t('admin.settings.sms.testSendError')))
      }
      toast.success(t('admin.settings.sms.testSendSuccess'))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t('admin.settings.sms.testSendError'))
    } finally {
      setIsTesting(false)
    }
  }

  return (
    <SettingsSection
      title={t('admin.settings.sms.sectionTitle')}
      description={t('admin.settings.sms.sectionDesc')}
    >
      <SmsInstructions />

      <FormField
        control={control}
        name="notifSmsEnabled"
        render={({ field }) => (
          <FormItem>
            <ToggleRow
              label={t('admin.settings.sms.toggleLabel')}
              description={t('admin.settings.sms.toggleDesc')}
              checked={field.value}
              onCheckedChange={field.onChange}
            />
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="smsProvider"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('admin.settings.sms.providerLabel')}</FormLabel>
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="twilio"><SelectItemText>{t('admin.settings.sms.providerTwilio')}</SelectItemText></SelectItem>
                <SelectItem value="smsapi"><SelectItemText>{t('admin.settings.sms.providerSmsApi')}</SelectItemText></SelectItem>
              </SelectContent>
            </Select>
            <FormMessage />
          </FormItem>
        )}
      />

      {smsProvider === 'twilio' && (
        <>
          <FormField
            control={control}
            name="twilioAccountSid"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('admin.settings.sms.twilioAccountSidLabel')}</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="off" {...field} />
                </FormControl>
                <FormDescription>{t('admin.settings.sms.twilioAccountSidDesc')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="twilioAuthToken"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('admin.settings.sms.twilioAuthTokenLabel')}</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="off" {...field} />
                </FormControl>
                <FormDescription>{t('admin.settings.sms.twilioAuthTokenDesc')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="twilioFromNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('admin.settings.sms.twilioFromNumberLabel')}</FormLabel>
                <FormControl>
                  <Input placeholder="+14155551234" {...field} />
                </FormControl>
                <FormDescription>{t('admin.settings.sms.twilioFromNumberDesc')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}

      {smsProvider === 'smsapi' && (
        <>
          <FormField
            control={control}
            name="smsApiToken"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('admin.settings.sms.smsApiTokenLabel')}</FormLabel>
                <FormControl>
                  <Input type="password" autoComplete="off" {...field} />
                </FormControl>
                <FormDescription>{t('admin.settings.sms.smsApiTokenDesc')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={control}
            name="smsApiSender"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('admin.settings.sms.smsApiSenderLabel')}</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormDescription>{t('admin.settings.sms.smsApiSenderDesc')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </>
      )}

      <div className="flex items-center gap-2 pt-2">
        <Input
          value={testPhone}
          onChange={(e) => setTestPhone(e.target.value)}
          placeholder="+48123456789"
          className="max-w-[220px]"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isDirty || isTesting || !testPhone.trim()}
          onClick={handleTestSend}
        >
          {isTesting ? t('common.saving') : t('admin.settings.sms.testSendBtn')}
        </Button>
      </div>
      {isDirty && (
        <p className="text-xs text-muted-foreground">{t('admin.settings.sms.testSendSaveFirstHint')}</p>
      )}
    </SettingsSection>
  )
}
