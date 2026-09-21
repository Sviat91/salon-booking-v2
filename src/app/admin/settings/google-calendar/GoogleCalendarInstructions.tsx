'use client'

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'

const SECTIONS = [
  { summary: 'instructionsGcpSummary', body: 'instructionsGcpBody' },
  { summary: 'instructionsShareSummary', body: 'instructionsShareBody' },
  { summary: 'instructionsTroubleshootSummary', body: 'instructionsTroubleshootBody' },
] as const

export default function GoogleCalendarInstructions() {
  const { t } = useTranslation()

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">{t('admin.settings.googleCalendar.instructionsTitle')}</p>

      {SECTIONS.map(({ summary, body }) => (
        <details key={summary} className="group/details border rounded-lg overflow-hidden bg-card">
          <summary className="cursor-pointer px-4 py-3 font-medium flex items-center justify-between hover:bg-muted/50 transition-colors outline-none list-none [&::-webkit-details-marker]:hidden">
            <span>{t(`admin.settings.googleCalendar.${summary}`)}</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-open/details:rotate-180" />
          </summary>
          <div className="px-4 py-3 border-t text-sm whitespace-pre-line text-muted-foreground bg-muted/20">
            {t(`admin.settings.googleCalendar.${body}`)}
          </div>
        </details>
      ))}
    </div>
  )
}
