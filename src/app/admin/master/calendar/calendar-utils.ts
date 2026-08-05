import type { Appointment } from "./ModernCalendar"

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
