'use client'

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'

export default function SmsInstructions() {
  const { t } = useTranslation()

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-medium">{t('admin.settings.sms.help.title')}</p>
        <p className="text-sm text-muted-foreground">{t('admin.settings.sms.help.subtitle')}</p>
      </div>

      <details className="group/details border rounded-lg overflow-hidden bg-card">
        <summary className="cursor-pointer px-4 py-3 font-medium flex items-center justify-between hover:bg-muted/50 transition-colors outline-none list-none [&::-webkit-details-marker]:hidden">
          <span>{t('admin.settings.sms.help.twilioTitle')}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open/details:rotate-180" />
        </summary>
        <div className="px-4 py-3 border-t text-sm space-y-2 text-muted-foreground bg-muted/20">
          <p>{t('admin.settings.sms.help.twilioStep1')}</p>
          <p>{t('admin.settings.sms.help.twilioStep2')}</p>
          <p>{t('admin.settings.sms.help.twilioStep3')}</p>
          <p>{t('admin.settings.sms.help.twilioStep4')}</p>
        </div>
      </details>

      <details className="group/details border rounded-lg overflow-hidden bg-card">
        <summary className="cursor-pointer px-4 py-3 font-medium flex items-center justify-between hover:bg-muted/50 transition-colors outline-none list-none [&::-webkit-details-marker]:hidden">
          <span>{t('admin.settings.sms.help.smsApiTitle')}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open/details:rotate-180" />
        </summary>
        <div className="px-4 py-3 border-t text-sm space-y-2 text-muted-foreground bg-muted/20">
          <p>{t('admin.settings.sms.help.smsApiStep1')}</p>
          <p>{t('admin.settings.sms.help.smsApiStep2')}</p>
          <p>{t('admin.settings.sms.help.smsApiStep3')}</p>
          <p>{t('admin.settings.sms.help.smsApiStep4')}</p>
        </div>
      </details>

      <details className="group/details border rounded-lg overflow-hidden bg-card">
        <summary className="cursor-pointer px-4 py-3 font-medium flex items-center justify-between hover:bg-muted/50 transition-colors outline-none list-none [&::-webkit-details-marker]:hidden">
          <span>{t('admin.settings.sms.help.enableTitle')}</span>
          <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open/details:rotate-180" />
        </summary>
        <div className="px-4 py-3 border-t text-sm space-y-2 text-muted-foreground bg-muted/20">
          <p>{t('admin.settings.sms.help.enableStep1')}</p>
          <p>{t('admin.settings.sms.help.enableStep2')}</p>
          <p>{t('admin.settings.sms.help.enableStep3')}</p>
          <p>{t('admin.settings.sms.help.enableStep4')}</p>
        </div>
      </details>
    </div>
  )
}
