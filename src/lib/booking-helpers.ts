import prisma from './prisma'
import { getDaySlots } from './availability'
import { getLogger } from './logger'
import { normalizePhoneDigitsOnly } from './utils/phone-normalization'
import { normalizeTextWithCyrillicConversion } from './utils/string-normalization'

const logger = getLogger({ module: 'booking-helpers' })

/**
 * Helper functions for booking management operations
 * Shared between search, modification, and availability APIs
 */

/**
 * Normalize strings for comparison - handles cyrillic/latin conversion
 * @deprecated Use normalizeTextWithCyrillicConversion from utils/string-normalization instead
 */
export function normalizeString(str: string): string {
  return normalizeTextWithCyrillicConversion(str)
}

/**
 * Normalize phone number for matching (remove all non-digits)
 * @deprecated Use normalizePhoneDigitsOnly from utils/phone-normalization instead
 */
export function normalizePhone(phone: string): string {
  return normalizePhoneDigitsOnly(phone)
}

/**
 * User access criteria for booking verification
 */
export interface UserAccessCriteria {
  firstName: string
  lastName: string
  phone: string
  email?: string
}

/**
 * Booking modification result
 */
export interface BookingModificationCheck {
  canModify: boolean
  reason?: string
  hoursRemaining?: number
}

/**
 * Check if booking can be modified based on 24-hour rule
 */
export function canModifyBooking(startTime: Date): BookingModificationCheck {
  const now = new Date()
  const timeDiff = startTime.getTime() - now.getTime()
  const hoursUntilAppointment = timeDiff / (1000 * 60 * 60)
  
  if (hoursUntilAppointment < 24) {
    return {
      canModify: false,
      reason: `Cannot modify booking less than 24 hours before appointment`,
      hoursRemaining: Math.max(0, hoursUntilAppointment)
    }
  }
  
  return { 
    canModify: true,
    hoursRemaining: hoursUntilAppointment
  }
}

/**
 * Time slot with availability status
 */
export interface TimeSlot {
  startISO: string
  endISO: string
  available: boolean
}

/**
 * Get available time slots for a specific date range, excluding a current booking
 * Uses the same schedule logic as normal booking (getDaySlots from availability.ts)
 */
export async function getAvailableSlotsForRebooking(options: {
  dateFrom: string // ISO date string like "2024-01-15"
  dateTo: string   // ISO date string like "2024-01-30"
  procedureDurationMin: number
  excludeBooking?: {
    startTime: Date
    endTime: Date
  }
  maxSlots?: number // Limit results for performance
  masterId?: string
  procedureCategory?: string | null
}): Promise<TimeSlot[]> {
  const { dateFrom, dateTo, procedureDurationMin, excludeBooking, maxSlots = 50 } = options
  
  const allSlots: TimeSlot[] = []
  const fromDate = new Date(dateFrom + 'T00:00:00')
  const toDate = new Date(dateTo + 'T23:59:59')
  
  // Iterate through each day in the range
  let currentDate = new Date(fromDate)
  while (currentDate <= toDate && allSlots.length < maxSlots) {
    const dateISO = currentDate.toISOString().split('T')[0] // YYYY-MM-DD
    
    try {
      // Use existing getDaySlots function to get available slots for this day
      const dayResult = await getDaySlots(
            dateISO,
            procedureDurationMin,
            15,
            options.masterId
          )
      const daySlots = dayResult.slots || []
      
      // Convert to TimeSlot format and filter out excluded booking
      for (const slot of daySlots) {
        let available = true
        
        // If we have a current booking to exclude, check if this slot overlaps
        if (excludeBooking) {
          const slotStart = new Date(slot.startISO)
          const slotEnd = new Date(slot.endISO)
          const bookingStart = excludeBooking.startTime
          const bookingEnd = excludeBooking.endTime
          
          // Check if slot overlaps with the booking we want to exclude
          const overlaps = slotStart < bookingEnd && slotEnd > bookingStart
          if (overlaps) {
            // This slot is currently occupied by the booking we're trying to reschedule
            // Mark as available since we can move the booking here
            available = true
          }
        }
        
        if (available && allSlots.length < maxSlots) {
          allSlots.push({
            startISO: slot.startISO,
            endISO: slot.endISO,
            available: true
          })
        }
      }
    } catch (error) {
      // Skip days that fail (holidays, etc.)
      logger.warn({ dateISO, error }, `Failed to get slots for ${dateISO}`)
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1)
  }
  
  return allSlots
}

/**
 * Get procedure duration by ID from the DB.
 */
export async function getProcedureDuration(procedureId?: string): Promise<number> {
  try {
    if (procedureId) {
      const service = await prisma.service.findUnique({
        where: { id: procedureId },
        select: { duration: true },
      })
      return service?.duration || 60
    }
    
    // If no specific procedure, use minimum duration across all services
    const services = await prisma.service.findMany({
      select: { duration: true },
    })
    if (services.length > 0) {
      return Math.min(...services.map((s: { duration: number }) => s.duration || 60))
    }
    
    return 60 // Fallback default
  } catch (error) {
    logger.warn({ error }, 'Failed to get procedure duration')
    return 60 // Fallback default
  }
}

/**
 * Common error responses for booking APIs
 */
export const BookingErrors = {
  BOOKING_NOT_FOUND: {
    error: 'Booking not found',
    code: 'BOOKING_NOT_FOUND'
  },
  ACCESS_DENIED: {
    error: 'Access denied - booking not found or you do not have permission',
    code: 'ACCESS_DENIED'
  },
  TOO_LATE_TO_MODIFY: {
    error: 'Cannot modify booking less than 24 hours before appointment',
    code: 'TOO_LATE_TO_MODIFY'
  },
  TOO_LATE_TO_CANCEL: {
    error: 'Cannot cancel booking less than 24 hours before appointment',
    code: 'TOO_LATE_TO_CANCEL'
  },
  INVALID_BOOKING_DATA: {
    error: 'Invalid booking data',
    code: 'INVALID_BOOKING_DATA'
  },
  TIME_CONFLICT: {
    error: 'New time slot is not available',
    code: 'TIME_CONFLICT'
  },
  PROCEDURE_NOT_FOUND: {
    error: 'Procedure not found',
    code: 'PROCEDURE_NOT_FOUND'
  }
} as const
