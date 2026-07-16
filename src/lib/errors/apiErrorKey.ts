/**
 * Maps an API error `code` (from `{ error, code }` route responses) to an i18n
 * translation key under the `errors.*` namespace (see `src/locales/{pl,en,uk}.json`).
 *
 * Pure function, no React/i18next dependency — safe to call from non-React modules
 * (e.g. `bookingManagementApi.ts`). Callers render the result with `t()`.
 */
export const KNOWN_ERROR_CODES = new Set([
  'VALIDATION_ERROR',
  'INVALID_PAYLOAD',
  'RATE_LIMITED',
  'TOO_MANY_REQUESTS',
  'TOO_LATE_TO_MODIFY',
  'TOO_LATE_TO_CANCEL',
  'CONFLICT',
  'MISSING_MASTER',
  'INVALID_PHONE',
  'CONSENT_REQUIRED',
  'UNAUTHORIZED',
  'INTERNAL_ERROR',
  'DATA_NOT_FOUND',
  'CONSENT_ACK_REQUIRED',
  'ALREADY_ERASED',
  'ALREADY_PROCESSING',
  'INVALID_NAME',
  'BAD_REQUEST',
  'MISSING_PARAMS',
  'BOOKING_NOT_FOUND',
  'ALREADY_CANCELLED',
  'VERIFICATION_FAILED',
  'SERVICE_NOT_FOUND',
  'INVALID_TIME',
  'INVALID_DATE',
  'SMTP_NOT_CONFIGURED',
  'NOT_FOUND',
  'FORBIDDEN',
  'INVALID_FILE_TYPE',
  'FILE_TOO_LARGE',
  'NO_PASSWORD_SET',
  'INVALID_CURRENT_PASSWORD',
  'EMAIL_ALREADY_IN_USE',
])

export function apiErrorKey(code?: string): string {
  if (code && KNOWN_ERROR_CODES.has(code)) {
    return `errors.${code}`
  }
  return 'errors.generic'
}
