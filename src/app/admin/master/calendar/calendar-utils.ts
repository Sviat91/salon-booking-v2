import type { Appointment } from "./ModernCalendar"
import { resolveLocalized } from "@/lib/localized-content"
import type { Language } from "@/lib/i18n-shared"

/** Shared helpers used by MonthView/WeekView/DayView — hoisted to remove duplication. */

/** Hard UI cap on how many masters one bulk schedule edit may target — keeps BulkSettingsModal's stacked day marks legible (5 lines ≈ 18px in a 40px cell, 5 dots ≈ 38px in a ~45px row). */
export const MAX_TARGET_MASTERS = 5

export function groupOverlappingAppointments(appointments: Appointment[]): Appointment[][] {
  if (appointments.length === 0) return []

  const sorted = [...appointments].sort((a, b) => {
    const aStart = parseInt(a.startTime.split(':')[0]) * 60 + parseInt(a.startTime.split(':')[1])
    const bStart = parseInt(b.startTime.split(':')[0]) * 60 + parseInt(b.startTime.split(':')[1])
    return aStart - bStart
  })

  const groups: Appointment[][] = []
  let currentGroup: Appointment[] = [sorted[0]]
  let groupEnd = parseInt(sorted[0].endTime.split(':')[0]) * 60 + parseInt(sorted[0].endTime.split(':')[1])

  for (let i = 1; i < sorted.length; i++) {
    const appt = sorted[i]
    const apptStart = parseInt(appt.startTime.split(':')[0]) * 60 + parseInt(appt.startTime.split(':')[1])

    if (apptStart < groupEnd) {
      currentGroup.push(appt)
      const apptEnd = parseInt(appt.endTime.split(':')[0]) * 60 + parseInt(appt.endTime.split(':')[1])
      groupEnd = Math.max(groupEnd, apptEnd)
    } else {
      groups.push(currentGroup)
      currentGroup = [appt]
      groupEnd = parseInt(appt.endTime.split(':')[0]) * 60 + parseInt(appt.endTime.split(':')[1])
    }
  }
  groups.push(currentGroup)

  return groups
}

export function pluralize(count: number, one: string, few: string, many: string): string {
  if (count === 1) return one
  if (count >= 2 && count <= 4) return few
  return many
}

export function parseTime(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number)
  return h * 60 + m
}

export type DayScheduleState = "working" | "dayoff" | null

export function resolveDayScheduleState(
  dateStr: string,                                        // "yyyy-MM-dd"
  dayOfWeek: number,                                      // date-fns getDay(): 0=Sun
  overrides: { date: string; isDayOff: boolean }[],
  templates: { dayOfWeek: number; isDayOff: boolean }[]
): DayScheduleState {
  const override = overrides.find(o => o.date === dateStr)
  if (override) return override.isDayOff ? "dayoff" : "working"
  const template = templates.find(t => t.dayOfWeek === dayOfWeek)
  if (template) return template.isDayOff ? "dayoff" : "working"
  return null
}

const EXTERNAL_SUMMARY_MAX = 80

/** First non-empty line of a Google description, trimmed and truncated to 80 chars with "…". */
export function externalSummaryLine(description: string | null | undefined): string | null {
  const first = (description ?? "").split(/\r?\n/).map(l => l.trim()).find(l => l.length > 0)
  if (!first) return null
  return first.length > EXTERNAL_SUMMARY_MAX ? `${first.slice(0, EXTERNAL_SUMMARY_MAX - 1).trimEnd()}…` : first
}

/** Line 1 of a calendar block: Google title (or localized fallback) / client name. */
export function entryPrimaryLabel(a: Appointment, clientFallback: string, t: (k: string) => string): string {
  if (a.isExternal) return a.externalTitle?.trim() || t("admin.calendar.external.titleFallback")
  return a.client.name || clientFallback
}

/** Line 2 of a calendar block: first description line (or localized fallback) / service name. */
export function entrySecondaryLabel(a: Appointment, language: Language, t: (k: string) => string): string {
  if (a.isExternal) return externalSummaryLine(a.externalDescription) ?? t("admin.calendar.external.descriptionFallback")
  return resolveLocalized({ pl: a.service.name_pl, en: a.service.name_en, uk: a.service.name_uk }, language)
}

/** Flags every entry involved in an overlapping pair (same master + same day) with hasConflict. */
export function markConflicts(entries: Appointment[]): Appointment[] {
  const groups = new Map<string, Appointment[]>()
  for (const e of entries) {
    const key = `${e.master?.id ?? ""}|${String(e.date).slice(0, 10)}`
    const list = groups.get(key)
    if (list) list.push(e)
    else groups.set(key, [e])
  }
  const conflicted = new Set<string>()
  for (const list of groups.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]
        const b = list[j]
        if (parseTime(a.startTime) < parseTime(b.endTime) && parseTime(a.endTime) > parseTime(b.startTime)) {
          conflicted.add(a.id)
          conflicted.add(b.id)
        }
      }
    }
  }
  return entries.map(e => (conflicted.has(e.id) ? { ...e, hasConflict: true } : e))
}
