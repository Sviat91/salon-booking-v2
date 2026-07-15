import { describe, it, expect, beforeEach, vi } from 'vitest'
import { canModifyBooking } from '@/lib/booking-helpers'

describe('booking-helpers', () => {
  describe('canModifyBooking', () => {
    beforeEach(() => {
      // Mock current time: 2025-10-03T08:00:00Z
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2025-10-03T08:00:00Z'))
    })

    it('should allow modification more than 24 hours before', () => {
      const startTime = new Date('2025-10-05T10:00:00Z') // 2+ days ahead
      expect(canModifyBooking(startTime).canModify).toBe(true)
    })

    it('should allow modification exactly 25 hours before', () => {
      const startTime = new Date('2025-10-04T09:00:00Z') // exactly 25 hours
      expect(canModifyBooking(startTime).canModify).toBe(true)
    })

    it('should deny modification less than 24 hours before', () => {
      const startTime = new Date('2025-10-04T07:00:00Z') // 23 hours ahead
      expect(canModifyBooking(startTime).canModify).toBe(false)
    })

    it('should allow modification exactly 24 hours before', () => {
      const startTime = new Date('2025-10-04T08:00:00Z') // exactly 24 hours
      // Current implementation uses a strict `< 24` comparison, so the exact
      // 24h boundary itself is still allowed (only < 24h is denied).
      expect(canModifyBooking(startTime).canModify).toBe(true)
    })

    it('should deny modification for past bookings', () => {
      const startTime = new Date('2025-10-02T10:00:00Z') // in the past
      expect(canModifyBooking(startTime).canModify).toBe(false)
    })

    it('should handle invalid date format', () => {
      const startTime = new Date('invalid-date')
      // hoursUntilAppointment is NaN for an invalid Date; the explicit
      // Number.isFinite guard denies modification instead of falling through.
      expect(canModifyBooking(startTime).canModify).toBe(false)
    })

    it('should handle a NaN date value', () => {
      const startTime = new Date(NaN)
      expect(canModifyBooking(startTime).canModify).toBe(false)
    })
  })
})
