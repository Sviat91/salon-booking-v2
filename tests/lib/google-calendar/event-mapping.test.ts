import { describe, expect, it } from 'vitest'
import {
  SALON_APPOINTMENT_KEY,
  SALON_EVENT_MARKER,
  appointmentToEventBody,
  buildEventDescription,
  buildEventSummary,
  toGoogleDateTime,
  type EventSourceAppointment,
} from '@/lib/google-calendar/event-mapping'

const base: EventSourceAppointment = {
  id: 'appt1',
  date: new Date('2026-01-15T00:00:00.000Z'),
  startTime: '10:00',
  endTime: '11:00',
  status: 'CONFIRMED',
  notes: 'Alergia',
  finalPrice: 150,
  client: { name: 'Anna', phone: '+48123456789' },
  master: { name: 'Maria' },
  service: { name_pl: 'Masaż twarzy', name_en: 'Facial massage', name_uk: null },
}

describe('toGoogleDateTime', () => {
  it('uses the CET offset in winter', () => {
    expect(toGoogleDateTime(new Date('2026-01-15T00:00:00.000Z'), '10:00')).toBe('2026-01-15T10:00:00+01:00')
  })

  it('uses the CEST offset in summer', () => {
    expect(toGoogleDateTime(new Date('2026-07-15T00:00:00.000Z'), '10:00')).toBe('2026-07-15T10:00:00+02:00')
  })
})

describe('buildEventSummary', () => {
  it('joins client and Polish service name', () => {
    expect(buildEventSummary(base)).toBe('Anna — Masaż twarzy')
  })

  it('falls back to "Klient" when the client has no name', () => {
    expect(buildEventSummary({ ...base, client: { name: null, phone: null } })).toBe('Klient — Masaż twarzy')
  })
})

describe('buildEventDescription', () => {
  it('includes all present fields and ends with the brand line', () => {
    const text = buildEventDescription(base, 'Somique')
    expect(text).toContain('Telefon: +48123456789')
    expect(text).toContain('Usługa: Masaż twarzy')
    expect(text).toContain('Cena: 150 zł')
    expect(text).toContain('Mistrz: Maria')
    expect(text).toContain('Notatka: Alergia')
    expect(text.split('\n').pop()).toContain('Utworzono przez Somique.')
  })

  it('omits null phone, null/zero price and null notes', () => {
    const text = buildEventDescription(
      { ...base, client: { name: 'Anna', phone: null }, finalPrice: null, notes: null },
      'Somique',
    )
    expect(text).not.toContain('Telefon')
    expect(text).not.toContain('Cena')
    expect(text).not.toContain('Notatka')
    expect(buildEventDescription({ ...base, finalPrice: 0 }, 'X')).not.toContain('Cena')
    expect(text.split('\n').pop()).toContain('Utworzono przez Somique.')
  })
})

describe('appointmentToEventBody', () => {
  it('sets both marker keys and the Warsaw timezone on start and end', () => {
    const body = appointmentToEventBody(base, 'Somique') as {
      start: { dateTime: string; timeZone: string }
      end: { dateTime: string; timeZone: string }
      extendedProperties: { private: Record<string, string> }
    }
    expect(body.extendedProperties.private[SALON_APPOINTMENT_KEY]).toBe('appt1')
    expect(body.extendedProperties.private[SALON_EVENT_MARKER]).toBe('v1')
    expect(body.start).toEqual({ dateTime: '2026-01-15T10:00:00+01:00', timeZone: 'Europe/Warsaw' })
    expect(body.end).toEqual({ dateTime: '2026-01-15T11:00:00+01:00', timeZone: 'Europe/Warsaw' })
  })
})
