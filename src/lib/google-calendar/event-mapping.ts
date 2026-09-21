/**
 * Pure mapping of an Appointment to a Google Calendar event body.
 * No Prisma, no fetch. Event text is hardcoded Polish (salon-facing copy rule).
 */
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import { SCHEDULE_TZ } from '@/lib/schedule-utils'
import { resolveLocalized } from '@/lib/localized-content'
import { DEFAULT_LANGUAGE } from '@/lib/i18n-shared'

export const SALON_EVENT_MARKER = 'salonSync'
export const SALON_APPOINTMENT_KEY = 'salonAppointmentId'

/**
 * Appointment.date is UTC midnight of the local calendar day; startTime is a
 * Warsaw wall-clock "HH:MM". Returns an RFC3339 string with the Warsaw offset.
 */
export function toGoogleDateTime(date: Date, hhmm: string): string {
  const day = formatInTimeZone(date, 'UTC', 'yyyy-MM-dd')
  const utc = fromZonedTime(`${day}T${hhmm}:00`, SCHEDULE_TZ)
  return formatInTimeZone(utc, SCHEDULE_TZ, "yyyy-MM-dd'T'HH:mm:ssXXX")
}

export interface EventSourceAppointment {
  id: string
  date: Date
  startTime: string
  endTime: string
  status: string
  notes: string | null
  finalPrice: number | null
  client: { name: string | null; phone: string | null }
  master: { name: string | null }
  service: { name_pl: string; name_en: string | null; name_uk: string | null }
}

function serviceName(a: EventSourceAppointment): string {
  return resolveLocalized(
    { pl: a.service.name_pl, en: a.service.name_en, uk: a.service.name_uk },
    DEFAULT_LANGUAGE,
  )
}

export function buildEventSummary(a: EventSourceAppointment): string {
  return `${a.client.name?.trim() || 'Klient'} — ${serviceName(a)}`
}

export function buildEventDescription(a: EventSourceAppointment, brandName: string): string {
  const lines: string[] = []
  if (a.client.phone) lines.push(`Telefon: ${a.client.phone}`)
  lines.push(`Usługa: ${serviceName(a)}`)
  if (a.finalPrice) lines.push(`Cena: ${a.finalPrice} zł`)
  if (a.master.name) lines.push(`Mistrz: ${a.master.name}`)
  lines.push(`Status: ${a.status}`)
  if (a.notes) lines.push(`Notatka: ${a.notes}`)
  lines.push('')
  lines.push(
    `Utworzono przez ${brandName}. Zmiana godziny w tym kalendarzu zostanie przeniesiona na stronę.`,
  )
  return lines.join('\n')
}

export function appointmentToEventBody(
  a: EventSourceAppointment,
  brandName: string,
): Record<string, unknown> {
  return {
    summary: buildEventSummary(a),
    description: buildEventDescription(a, brandName),
    start: { dateTime: toGoogleDateTime(a.date, a.startTime), timeZone: SCHEDULE_TZ },
    end: { dateTime: toGoogleDateTime(a.date, a.endTime), timeZone: SCHEDULE_TZ },
    extendedProperties: {
      private: { [SALON_APPOINTMENT_KEY]: a.id, [SALON_EVENT_MARKER]: 'v1' },
    },
  }
}
