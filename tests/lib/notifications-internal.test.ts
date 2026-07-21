/// <reference types='vitest' />

import { describe, expect, it } from 'vitest'
import { actorLabel, buildBookingUpdateMessage } from '../../src/lib/notifications/internal'

describe('actorLabel', () => {
  it('returns "Klient" for client', () => {
    expect(actorLabel('client')).toBe('Klient')
  })

  it('returns "Administrator" for admin', () => {
    expect(actorLabel('admin')).toBe('Administrator')
  })

  it('returns "Mistrz <name>" for master with a name', () => {
    expect(actorLabel('master', 'Anna')).toBe('Mistrz Anna')
  })

  it('returns "Mistrz" for master with no name', () => {
    expect(actorLabel('master', null)).toBe('Mistrz')
  })
})

describe('buildBookingUpdateMessage', () => {
  const baseInput = {
    clientName: 'Jan Kowalski',
    masterName: 'Anna',
    actorLabel: 'Klient',
  }

  it('includes both service and date/time pairs when both changed', () => {
    const msg = buildBookingUpdateMessage({
      ...baseInput,
      previous: { date: new Date('2026-08-01'), startTime: '10:00', serviceId: 'svc_1', serviceName: 'Manicure' },
      current: { date: new Date('2026-08-02'), startTime: '11:00', serviceId: 'svc_2', serviceName: 'Pedicure' },
    })

    expect(msg).not.toBeNull()
    expect(msg).toContain('💆')
    expect(msg).toContain('📅')
    expect(msg).toContain('Manicure')
    expect(msg).toContain('Pedicure')
    expect(msg?.endsWith('✍️ Zmienione przez: Klient')).toBe(true)
  })

  it('includes only the service pair when only the service changed', () => {
    const msg = buildBookingUpdateMessage({
      ...baseInput,
      previous: { date: new Date('2026-08-01'), startTime: '10:00', serviceId: 'svc_1', serviceName: 'Manicure' },
      current: { date: new Date('2026-08-01'), startTime: '10:00', serviceId: 'svc_2', serviceName: 'Pedicure' },
    })

    expect(msg).not.toBeNull()
    expect(msg).toContain('💆')
    expect(msg).not.toContain('📅')
    expect(msg?.endsWith('✍️ Zmienione przez: Klient')).toBe(true)
  })

  it('includes only the date/time pair when only the time changed', () => {
    const msg = buildBookingUpdateMessage({
      ...baseInput,
      previous: { date: new Date('2026-08-01'), startTime: '10:00', serviceId: 'svc_1', serviceName: 'Manicure' },
      current: { date: new Date('2026-08-01'), startTime: '11:00', serviceId: 'svc_1', serviceName: 'Manicure' },
    })

    expect(msg).not.toBeNull()
    expect(msg).not.toContain('💆')
    expect(msg).toContain('📅')
    expect(msg?.endsWith('✍️ Zmienione przez: Klient')).toBe(true)
  })

  it('returns null when nothing changed', () => {
    const msg = buildBookingUpdateMessage({
      ...baseInput,
      previous: { date: new Date('2026-08-01'), startTime: '10:00', serviceId: 'svc_1', serviceName: 'Manicure' },
      current: { date: new Date('2026-08-01'), startTime: '10:00', serviceId: 'svc_1', serviceName: 'Manicure' },
    })

    expect(msg).toBeNull()
  })
})
