import type { MockAppointment } from '../../mockAdminData'

// Ported constant from the real WeekView/DayView (src/app/admin/master/calendar/)
// — 1.5px per minute drives every absolute-positioned hour-grid block in
// Week/Day view.
export const PIXELS_PER_MINUTE = 1.5

// Visible hour-grid range for Week/Day view — 08:00 to 21:00 (13-hour span),
// matching typical salon business hours.
export const START_HOUR = 8
export const END_HOUR = 21

export type ViewType = 'Month' | 'Week' | 'Day'

export function startOfWeek(d: Date) {
  const date = new Date(d)
  const day = (date.getDay() + 6) % 7 // Monday = 0
  date.setDate(date.getDate() - day)
  date.setHours(0, 0, 0, 0)
  return date
}

export function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

// 42-day (6-week) grid starting on the Monday on/before the 1st of the month —
// matches the real MonthView's date-fns startOfWeek(startOfMonth(...)) span.
export function monthGridDays(currentDate: Date): Date[] {
  const start = startOfWeek(startOfMonth(currentDate))
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    return d
  })
}

export function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export function minutesSinceMidnight(iso: string) {
  const d = new Date(iso)
  return d.getHours() * 60 + d.getMinutes()
}

export function appointmentsOnDay(appointments: MockAppointment[], day: Date) {
  const key = day.toDateString()
  return appointments.filter((a) => new Date(a.startISO).toDateString() === key)
}

export function statusLabel(status?: string) {
  if (status === 'PENDING') return 'Pending'
  if (status === 'CONFIRMED') return 'Confirmed'
  if (status?.startsWith('CANCELLED')) return 'Cancelled'
  return status ?? 'Confirmed'
}
