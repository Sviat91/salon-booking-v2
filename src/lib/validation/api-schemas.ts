/**
 * Server-side validation schemas using Zod
 * 
 * ⚠️ ВАЖНО: Этот файл импортируется ТОЛЬКО в API routes (серверная сторона).
 * НИКОГДА не импортировать в клиентские компоненты!
 * 
 * Zod добавляет ~40KB в bundle - это приемлемо на сервере, но критично на клиенте.
 */

import { z } from 'zod'

// ============================================
// Booking API Schemas
// ============================================

/**
 * Schema for POST /api/book
 * Creates a new booking
 */
export const bookingApiSchema = z.object({
  startISO: z.string().min(16, 'Invalid start time format'),
  endISO: z.string().min(16, 'Invalid end time format'),
  procedureId: z.string().nullish(),
  masterId: z.string().nullish(),
  name: z.string().min(2, 'Name must be at least 2 characters').max(100, 'Name is too long'),
  phone: z.string().min(5, 'Phone number is too short').max(20, 'Phone number is too long').optional().or(z.literal('')).nullish(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')).nullish(),
  turnstileToken: z.string().nullish(),
  language: z.string().optional(),
  discountCode: z.string().trim().max(64).optional().or(z.literal('')).nullish(),
  consents: z.object({
    dataProcessing: z.boolean(),
    terms: z.boolean(),
    notifications: z.boolean(),
  }).nullish(),
})

export type BookingApiInput = z.infer<typeof bookingApiSchema>

/**
 * Schema for POST /api/discounts/preview
 * Previews the price (and any applicable discount) before booking.
 */
export const discountPreviewApiSchema = z.object({
  masterId:  z.string().min(1),
  serviceId: z.string().min(1),
  startISO:  z.string().min(16).optional().nullable(),
  code:      z.string().trim().max(64).optional().or(z.literal('')).nullish(),
  phone:     z.string().min(5).max(20).optional().or(z.literal('')).nullish(),
})
export type DiscountPreviewApiInput = z.infer<typeof discountPreviewApiSchema>

/**
 * Schema for POST /api/bookings/search
 * Searches for bookings by phone and name
 */
export const searchApiSchema = z.object({
  phone: z.string().min(5, 'Phone number is required'),
  name: z.string().min(2, 'Name is required'),
})

export type SearchApiInput = z.infer<typeof searchApiSchema>

/**
 * Schema for POST /api/bookings/cancel
 * Cancels an existing booking
 */
export const cancelBookingApiSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  firstName: z.string().min(1, 'First name is required'),
  phone: z.string().min(5, 'Phone number is required'),
  email: z.string().optional().or(z.literal('')),
  masterId: z.string().optional(),
})

export type CancelBookingApiInput = z.infer<typeof cancelBookingApiSchema>

/**
 * Schema for POST /api/bookings/update-time
 * Updates booking time
 */
export const updateTimeApiSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  procedureName: z.string().optional(),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional().default(''),
  phone: z.string().min(5, 'Phone number is required'),
  email: z.string().optional().or(z.literal('')),
  price: z.number().optional(),
  newStartISO: z.string().min(16, 'Invalid start time format'),
  newEndISO: z.string().min(16, 'Invalid end time format'),
  masterId: z.string().optional(),
})

export type UpdateTimeApiInput = z.infer<typeof updateTimeApiSchema>

/**
 * Schema for POST /api/bookings/update-procedure
 * Updates booking procedure
 */
export const updateProcedureApiSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().optional().default(''),
  phone: z.string().min(5, 'Phone number is required'),
  email: z.string().optional().or(z.literal('')),
  currentStartISO: z.string().min(16, 'Current start time is required'),
  newProcedureId: z.string().min(1, 'Procedure ID is required'),
  masterId: z.string().optional(),
})

export type UpdateProcedureApiInput = z.infer<typeof updateProcedureApiSchema>

/**
 * Schema for POST /api/bookings/[id]/check-extension
 * Checks if procedure can be extended
 */
export const checkExtensionApiSchema = z.object({
  eventId: z.string().min(1, 'Event ID is required'),
  currentStartISO: z.string().min(16),
  currentEndISO: z.string().min(16),
  newProcedureId: z.string().min(1, 'New procedure ID is required'),
  masterId: z.string().optional(),
})

/**
 * Schema for PATCH /api/bookings/[id]
 * Combined procedure + time update
 */
export const combinedUpdateApiSchema = z.object({
  newProcedureId: z.string().optional(),
  newStartISO: z.string().min(16).optional(),
  newEndISO: z.string().min(16).optional(),
  masterId: z.string().optional(),
})

export type CombinedUpdateApiInput = z.infer<typeof combinedUpdateApiSchema>

export type CheckExtensionApiInput = z.infer<typeof checkExtensionApiSchema>

// ============================================
// Consent API Schemas (GDPR)
// ============================================

/**
 * Schema for POST /api/consents/check
 * Checks if user has valid consents
 */
export const checkConsentApiSchema = z.object({
  phone: z.string().min(5, 'Phone number is required'),
  name: z.string().min(2, 'Name is required'),
  email: z.string().email().optional().or(z.literal('')),
})

export type CheckConsentApiInput = z.infer<typeof checkConsentApiSchema>

/**
 * Schema for POST /api/consents/withdraw
 * Withdraws user consent (GDPR)
 */
export const withdrawConsentApiSchema = z.object({
  phone: z.string().min(5, 'Phone number is required').optional(),
  name: z.string().min(2, 'Name is required').optional(),
  email: z.string().email().optional().or(z.literal('')),
  consentAcknowledged: z.boolean().optional(),
  turnstileToken: z.string().nullish(),
  requestId: z.string().trim().max(64).optional(),
})

export type WithdrawConsentApiInput = z.infer<typeof withdrawConsentApiSchema>

/**
 * Schema for POST /api/consents/erase
 * Erases user data (GDPR)
 */
export const eraseDataApiSchema = z.object({
  phone: z.string().min(5, 'Phone number is required').optional(),
  name: z.string().min(2, 'Name is required').optional(),
  email: z.string().email().optional().or(z.literal('')),
  consentAcknowledged: z.boolean().optional(),
  turnstileToken: z.string().nullish(),
  requestId: z.string().trim().max(64).optional(),
})

export type EraseDataApiInput = z.infer<typeof eraseDataApiSchema>

/**
 * Schema for POST /api/consents/export
 * Exports user data (GDPR)
 */
export const exportDataApiSchema = z.object({
  phone: z.string().min(5, 'Phone number is required').optional(),
  name: z.string().min(2, 'Name is required').optional(),
  email: z.string().email().optional().or(z.literal('')),
  turnstileToken: z.string().nullish(),
  requestId: z.string().trim().max(64).optional(),
})

export type ExportDataApiInput = z.infer<typeof exportDataApiSchema>

// ============================================
// Contact Form Schemas
// ============================================

/**
 * Schema for POST /api/support/contact
 * Support contact form
 */
export const supportContactApiSchema = z.object({
  name: z.string().min(2, 'Name is required').max(100),
  email: z.string().email('Invalid email format'),
  message: z.string().min(10, 'Message must be at least 10 characters').max(1000, 'Message is too long'),
  turnstileToken: z.string().nullish(),
})

export type SupportContactApiInput = z.infer<typeof supportContactApiSchema>

/**
 * Schema for POST /api/master/contact
 * Contact master form
 */
export const masterContactApiSchema = z.object({
  phone: z.string().min(5, 'Phone number is required'),
  name: z.string().min(2, 'Name is required'),
  eventId: z.string().optional(),
  message: z.string().min(10, 'Message must be at least 10 characters').max(500, 'Message is too long'),
  turnstileToken: z.string().nullish(),
})

export type MasterContactApiInput = z.infer<typeof masterContactApiSchema>

// ============================================
// Password Reset Schemas
// ============================================

/**
 * Schema for POST /api/auth/forgot-password
 * Initiates password reset - sends email with a one-time token link
 */
export const forgotPasswordApiSchema = z.object({
  email: z.string().email('Invalid email format'),
})

export type ForgotPasswordApiInput = z.infer<typeof forgotPasswordApiSchema>

/**
 * Schema for POST /api/auth/reset-password
 * Validates the one-time token and sets a new password
 */
export const resetPasswordApiSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
})

export type ResetPasswordApiInput = z.infer<typeof resetPasswordApiSchema>

