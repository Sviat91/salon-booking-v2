"use client"

import * as React from "react"
import { toast } from "sonner"
import { useTranslation } from "react-i18next"
import { Copy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { SettingsSection } from "@/app/admin/settings/FormFields"
import FormSkeleton from "@/components/admin/skeletons/FormSkeleton"
import MasterCalendarField from "@/components/admin/google-calendar/MasterCalendarField"

interface MasterCalendarState {
  serviceAccountEmail: string
  enabled: boolean
  calendarId: string
  syncStatus: string | null
  syncError: string | null
  syncedAt: string | null
}

export default function MasterGoogleCalendarClient() {
  const { t } = useTranslation()
  const [state, setState] = React.useState<MasterCalendarState | null>(null)

  const load = React.useCallback(async () => {
    try {
      const res = await fetch("/api/master/google-calendar")
      if (!res.ok) throw new Error("load failed")
      setState(await res.json())
    } catch {
      toast.error(t("admin.settings.googleCalendar.loadFailed"))
    }
  }, [t])

  React.useEffect(() => {
    load()
  }, [load])

  async function copyEmail() {
    if (!state) return
    try {
      await navigator.clipboard.writeText(state.serviceAccountEmail)
      toast.success(t("admin.settings.googleCalendar.copiedToast"))
    } catch {
      toast.error(t("errors.generic"))
    }
  }

  // No translated text while loading — hydration rule, see NotificationSettingsForm.tsx.
  if (!state) return <FormSkeleton />

  if (!state.enabled) {
    return (
      <p className="rounded-[20px] border border-border bg-card p-6 text-sm text-muted-foreground">
        {t("admin.settings.googleCalendar.notConfiguredNotice")}
      </p>
    )
  }

  return (
    <SettingsSection
      title={t("admin.settings.googleCalendar.mastersSectionTitle")}
      description={t("admin.settings.googleCalendar.instructionsShareSummary")}
    >
      <p className="whitespace-pre-line text-sm text-muted-foreground">
        {t("admin.settings.googleCalendar.instructionsShareBody")}
      </p>

      <div className="grid gap-1.5">
        <p className="text-sm font-medium">
          {t("admin.settings.googleCalendar.serviceAccountEmailLabel")}
        </p>
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-md border border-border bg-muted/30 px-3 py-1.5 text-xs">
            {state.serviceAccountEmail}
          </code>
          <Button type="button" variant="outline" onClick={copyEmail}>
            <Copy className="h-3.5 w-3.5" />
            {t("admin.settings.googleCalendar.copyEmailBtn")}
          </Button>
        </div>
      </div>

      <MasterCalendarField
        initialCalendarId={state.calendarId}
        syncStatus={state.syncStatus}
        syncError={state.syncError}
        syncedAt={state.syncedAt}
        saveUrl="/api/master/google-calendar"
        testUrl="/api/master/google-calendar/test"
        onSaved={load}
      />
    </SettingsSection>
  )
}
