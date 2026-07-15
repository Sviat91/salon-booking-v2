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
      const booking = {
        start: { dateTime: '2025-10-05T10:00:00Z' }, // 2+ days ahead
      }

      expect(canModifyBooking(booking as any)).toBe(true)
    })

    it('should allow modification exactly 25 hours before', () => {
      const booking = {
        start: { dateTime: '2025-10-04T09:00:00Z' }, // exactly 25 hours
      }

      expect(canModifyBooking(booking as any)).toBe(true)
    })

    it('should deny modification less than 24 hours before', () => {
      const booking = {
        start: { dateTime: '2025-10-04T07:00:00Z' }, // 23 hours ahead
      }

      expect(canModifyBooking(booking as any)).toBe(false)
    })

    it('should deny modification exactly 24 hours before', () => {
      const booking = {
        start: { dateTime: '2025-10-04T08:00:00Z' }, // exactly 24 hours
      }

      // Depending on implementation: strict > or >=
      // Adjust expectation based on actual implementation
      expect(canModifyBooking(booking as any)).toBe(false)
    })

    it('should deny modification for past bookings', () => {
      const booking = {
        start: { dateTime: '2025-10-02T10:00:00Z' }, // in the past
      }

      expect(canModifyBooking(booking as any)).toBe(false)
    })

    it('should handle invalid date format', () => {
      const booking = {
        start: { dateTime: 'invalid-date' },
      }

      expect(canModifyBooking(booking as any)).toBe(false)
    })

    it('should handle missing start time', () => {
      const booking = {
        start: undefined,
      }

      expect(canModifyBooking(booking as any)).toBe(false)
    })
  })
})
