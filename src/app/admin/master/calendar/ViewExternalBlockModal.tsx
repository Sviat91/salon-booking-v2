"use client"

import { X, Calendar, Clock, CalendarCheck, AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { format, parseISO } from "date-fns"
import { useTranslation } from "react-i18next"
import { useCurrentLanguage } from "@/contexts/LanguageContext"
import { dateFnsLocale } from "@/lib/utils/date-fns-locale"
import type { Appointment } from "./ModernCalendar"

interface Props {
  block: Appointment
  onClose: () => void
}

/** Read-only detail of a Google-origin calendar block — no edit/copy/delete by design. */
export default function ViewExternalBlockModal({ block, onClose }: Props) {
  const { t } = useTranslation()
  const language = useCurrentLanguage()
  const title = block.externalTitle?.trim() || t("admin.calendar.external.titleFallback")
  const description = block.externalDescription?.trim() || t("admin.calendar.external.descriptionFallback")

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4 animate-in fade-in">
      <div className="bg-background rounded-xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden">
        <div className="flex justify-between items-start p-5 border-b border-border bg-card">
          <div className="flex gap-4 items-center">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold leading-tight">{t("admin.calendar.external.modalTitle")}</h2>
              <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">
                {t("admin.calendar.external.sourceLabel")}
              </p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-5 w-5" /></Button>
        </div>

        <div className="p-6 space-y-6">
          {block.hasConflict && (
            <div
              title={t("admin.calendar.external.conflictTooltip")}
              className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium bg-[var(--md-error-container)] text-[var(--md-on-error-container)]"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" /> {t("admin.calendar.external.conflictBadge")}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1 bg-muted/20 p-3 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {t("admin.calendar.dateLabel")}</p>
              <p className="font-semibold">{format(parseISO(block.date), "EEEE, MMM d, yyyy", { locale: dateFnsLocale(language) })}</p>
            </div>
            <div className="space-y-1 bg-muted/20 p-3 rounded-lg border border-border">
              <p className="text-xs text-muted-foreground font-medium flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> {t("admin.calendar.timeFieldLabel")}</p>
              <p className="font-semibold">
                {block.allDay ? t("admin.calendar.external.allDayLabel") : `${block.startTime} - ${block.endTime}`}
              </p>
            </div>
          </div>

          <div className="bg-muted/30 rounded-lg p-4 border border-border space-y-2">
            <p className="font-semibold text-lg break-words">{title}</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{description}</p>
          </div>

          <p className="text-xs text-muted-foreground">{t("admin.calendar.external.readOnlyNote")}</p>
        </div>
      </div>
    </div>
  )
}
