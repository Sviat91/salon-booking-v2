"use client"

import { useEffect, useMemo, useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { useTranslation } from "react-i18next"
import { formatTimeRange } from "@/lib/utils/date-formatters"
import { DatePickerDropdown } from "@/components/DatePickerDropdown"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem, SelectItemText } from "@/components/ui/select"
import { useCurrentLanguage } from "@/contexts/LanguageContext"
import { resolveLocalized } from "@/lib/localized-content"
import { localeFor, type Language } from "@/lib/i18n-shared"

type ProcedureOption = {
  id: string
  name_pl: string
  name_en?: string | null
  name_uk?: string | null
  duration_min: number
  price_pln: number
}

type DaySlot = {
  startISO: string
  endISO: string
}

export type EditableAppointment = {
  id: string
  date: string
  startTime: string
  endTime: string
  service: { id: string; name_pl: string; name_en: string | null; name_uk: string | null; duration: number; price: number }
  master: { id: string; name: string }
}

interface EditAppointmentModalProps {
  open: boolean
  appointment: EditableAppointment | null
  onClose: () => void
  onSaved: () => void
}

function getDatePart(dateIso: string) {
  return new Date(dateIso).toISOString().slice(0, 10)
}

function formatSlotLabel(slot: DaySlot, language: Language) {
  return formatTimeRange(new Date(slot.startISO), new Date(slot.endISO), localeFor(language))
}

export default function EditAppointmentModal({
  open,
  appointment,
  onClose,
  onSaved,
}: EditAppointmentModalProps) {
  const { t } = useTranslation()
  const language = useCurrentLanguage()
  const [selectedProcedureId, setSelectedProcedureId] = useState<string>("")
  const [selectedDate, setSelectedDate] = useState<string>("")
  const [selectedSlot, setSelectedSlot] = useState<DaySlot | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!appointment || !open) return
    setSelectedProcedureId(appointment.service.id)
    setSelectedDate(getDatePart(appointment.date))
    setSelectedSlot(null)
    setError(null)
  }, [appointment, open])

  const { data: proceduresData } = useQuery<{ items: ProcedureOption[] }>({
    queryKey: ["procedures", appointment?.master.id],
    queryFn: async () => {
      const res = await fetch(`/api/procedures?masterId=${appointment?.master.id}`)
      if (!res.ok) throw new Error("Failed to load procedures")
      return res.json()
    },
    enabled: open && Boolean(appointment?.master.id),
  })

  const { data: slotsData, isLoading: slotsLoading } = useQuery<{ slots: DaySlot[] }>({
    queryKey: ["day-slots", selectedDate, selectedProcedureId, appointment?.master.id],
    queryFn: async () => {
      const res = await fetch(
        `/api/day/${selectedDate}?masterId=${appointment?.master.id}&procedureId=${selectedProcedureId}`
      )
      if (!res.ok) throw new Error("Failed to load day slots")
      return res.json()
    },
    enabled: open && Boolean(selectedDate) && Boolean(selectedProcedureId) && Boolean(appointment?.master.id),
  })

  const hasProcedureChanged = useMemo(() => {
    if (!appointment) return false
    return selectedProcedureId !== appointment.service.id
  }, [selectedProcedureId, appointment])

  const hasTimeChanged = Boolean(selectedSlot)
  const canSave = Boolean(appointment) && (hasProcedureChanged || hasTimeChanged) && !saving

  const handleSave = async () => {
    if (!appointment) return
    if (!canSave) {
      setError(t("profile.noChanges", "No changes to save"))
      return
    }

    setSaving(true)
    setError(null)

    try {
      const payload: Record<string, string> = {}

      if (hasProcedureChanged) {
        payload.newProcedureId = selectedProcedureId
      }

      if (selectedSlot) {
        payload.newStartISO = selectedSlot.startISO
        payload.newEndISO = selectedSlot.endISO
      }

      const res = await fetch(`/api/client/appointments/${appointment.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || t("common.error", "Error"))
      }

      onSaved()
      onClose()
    } catch (e: any) {
      setError(e?.message || t("common.error", "Error"))
    } finally {
      setSaving(false)
    }
  }

  if (!open || !appointment) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-xl border border-border bg-card p-4 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-semibold text-foreground">
              {t("profile.editBookingTitle", "Edit booking")}
            </h3>
            <p className="text-sm text-muted-foreground">
              {resolveLocalized({ pl: appointment.service.name_pl, en: appointment.service.name_en, uk: appointment.service.name_uk }, language)} - {appointment.master.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-muted"
          >
            {t("common.close", "Close")}
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              {t("booking.service", "Service")}
            </label>
            <Select
              value={selectedProcedureId}
              onValueChange={(v) => {
                setSelectedProcedureId(v ?? "")
                setSelectedSlot(null)
              }}
            >
              <SelectTrigger>
                <SelectValue>
                  {(v: string) => {
                    const p = proceduresData?.items?.find((p: any) => p.id === v)
                    return p ? resolveLocalized({ pl: p.name_pl, en: p.name_en, uk: p.name_uk }, language) : v
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {(proceduresData?.items || []).map((procedure) => (
                  <SelectItem key={procedure.id} value={procedure.id}>
                    <SelectItemText>{resolveLocalized({ pl: procedure.name_pl, en: procedure.name_en, uk: procedure.name_uk }, language)}</SelectItemText>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              {t("management.selectDateLabel", "Select date")}
            </label>
            <DatePickerDropdown
              date={selectedDate}
              onChange={(d: string) => {
                setSelectedDate(d)
                setSelectedSlot(null)
              }}
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-foreground">
              {t("management.selectTimeLabel", "Select time")}
            </label>
            <div className="max-h-44 overflow-y-auto rounded-lg border border-border p-2">
              {slotsLoading ? (
                <p className="text-sm text-muted-foreground">{t("common.loading", "Loading...")}</p>
              ) : (slotsData?.slots || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("slots.noAvailable", "No available time slots")}
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {(slotsData?.slots || []).map((slot) => {
                    const active =
                      selectedSlot?.startISO === slot.startISO && selectedSlot?.endISO === slot.endISO
                    return (
                      <button
                        key={`${slot.startISO}-${slot.endISO}`}
                        type="button"
                        onClick={() => setSelectedSlot(slot)}
                        className={`rounded-md border px-3 py-1.5 text-sm ${
                          active
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-foreground hover:bg-muted"
                        }`}
                      >
                        {formatSlotLabel(slot, language)}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {t(
                "profile.keepTimeHint",
                "Leave time unchanged if you only want to update the service."
              )}
            </p>
          </div>
        </div>

        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={!canSave}
            className="btn btn-primary flex-1 disabled:opacity-60 disabled:pointer-events-none"
          >
            {saving ? t("common.saving", "Saving...") : t("common.save", "Save")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn btn-outline flex-1"
          >
            {t("common.cancel", "Cancel")}
          </button>
        </div>
      </div>
    </div>
  )
}
