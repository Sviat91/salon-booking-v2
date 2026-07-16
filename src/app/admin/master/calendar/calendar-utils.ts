import type { Appointment } from "./ModernCalendar"

/** Shared helpers used by MonthView/WeekView/DayView — hoisted to remove duplication. */

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
