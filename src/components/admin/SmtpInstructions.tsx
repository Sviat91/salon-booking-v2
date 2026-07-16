"use client"
import * as React from "react"
import { Trans, useTranslation } from "react-i18next"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronDown, Mail, AlertCircle } from "lucide-react"

export function SmtpInstructions() {
  const { t } = useTranslation()

  return (
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg flex items-center gap-2">
          <Mail className="w-5 h-5" />
          {t('admin.settings.smtp.title')}
        </CardTitle>
        <CardDescription>{t('admin.settings.smtp.subtitle')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Gmail */}
        <details className="group/details border rounded-lg overflow-hidden bg-card">
          <summary className="cursor-pointer px-4 py-3 font-medium flex items-center justify-between hover:bg-muted/50 transition-colors outline-none list-none [&::-webkit-details-marker]:hidden">
            <span>{t('admin.settings.smtp.gmailTitle')}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open/details:rotate-180" />
          </summary>
          <div className="px-4 py-3 border-t text-sm space-y-2 text-muted-foreground bg-muted/20">
            <p><strong>{t('admin.settings.smtp.hostLabel')}</strong> smtp.gmail.com</p>
            <p><strong>{t('admin.settings.smtp.portLabel')}</strong> {t('admin.settings.smtp.gmailPort')}</p>
            <div className="flex gap-2 p-3 mt-2 bg-yellow-500/10 text-yellow-600 dark:text-yellow-500 rounded-md items-start">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p className="text-xs">
                <Trans i18nKey="admin.settings.smtp.gmailNote" components={{ strong: <strong />, b: <b />, br: <br /> }} />
              </p>
            </div>
          </div>
        </details>

        {/* Outlook */}
        <details className="group/details border rounded-lg overflow-hidden bg-card">
          <summary className="cursor-pointer px-4 py-3 font-medium flex items-center justify-between hover:bg-muted/50 transition-colors outline-none list-none [&::-webkit-details-marker]:hidden">
            <span>{t('admin.settings.smtp.outlookTitle')}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open/details:rotate-180" />
          </summary>
          <div className="px-4 py-3 border-t text-sm space-y-2 text-muted-foreground bg-muted/20">
            <p><strong>{t('admin.settings.smtp.hostLabel')}</strong> smtp-mail.outlook.com</p>
            <p><strong>{t('admin.settings.smtp.portLabel')}</strong> {t('admin.settings.smtp.outlookPort')}</p>
            <p><strong>{t('admin.settings.smtp.passwordLabel')}</strong> <Trans i18nKey="admin.settings.smtp.outlookNote" components={{ b: <b /> }} /></p>
          </div>
        </details>

        {/* Hostinger */}
        <details className="group/details border rounded-lg overflow-hidden bg-card">
          <summary className="cursor-pointer px-4 py-3 font-medium flex items-center justify-between hover:bg-muted/50 transition-colors outline-none list-none [&::-webkit-details-marker]:hidden">
            <span>{t('admin.settings.smtp.hostingerTitle')}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open/details:rotate-180" />
          </summary>
          <div className="px-4 py-3 border-t text-sm space-y-2 text-muted-foreground bg-muted/20">
            <p><strong>{t('admin.settings.smtp.hostLabel')}</strong> smtp.hostinger.com <br /> <span className="text-xs italic">{t('admin.settings.smtp.hostingerHostNote')}</span></p>
            <p><strong>{t('admin.settings.smtp.portLabel')}</strong> {t('admin.settings.smtp.hostingerPort')}</p>
            <p><strong>{t('admin.settings.smtp.passwordLabel')}</strong> {t('admin.settings.smtp.hostingerPassword')}</p>
          </div>
        </details>
      </CardContent>
    </Card>
  )
}
