/**
 * SMS channel entrypoint. Two BYO providers (Twilio, SMSAPI.pl) behind one
 * closure-based sender. Public functions never throw — errors are returned
 * as `Error | null`, matching the notifications/ module contract.
 */

import { decrypt } from '@/lib/encryption'
import { normalizePhoneToE164 } from '@/lib/utils/phone-normalization'
import { getTenantConfig } from '@/lib/tenant'
import { sendTwilioSms } from './twilio'
import { sendSmsApiSms } from './smsapi'

export type SmsSender = (to: string, text: string) => Promise<Error | null>

/** Structural type over the seven SMS-related TenantConfig fields — satisfied by both a Prisma row and DEFAULT_CONFIG. */
export interface SmsConfigSource {
  notifSmsEnabled: boolean
  smsProvider: string
  twilioAccountSid: string | null
  twilioAuthToken: string | null
  twilioFromNumber: string | null
  smsApiToken: string | null
  smsApiSender: string | null
}

export function isSmsConfigured(config: SmsConfigSource): boolean {
  if (!config.notifSmsEnabled) return false
  if (config.smsProvider === 'twilio') {
    return !!config.twilioAccountSid && !!config.twilioAuthToken && !!config.twilioFromNumber
  }
  if (config.smsProvider === 'smsapi') {
    return !!config.smsApiToken && !!config.smsApiSender
  }
  return false
}

/**
 * Builds a sender closure once per cron run, decrypting credentials a single
 * time instead of per appointment. Returns null when SMS is disabled or the
 * selected provider's required fields are missing.
 */
export function getSmsSender(config: SmsConfigSource): SmsSender | null {
  if (!isSmsConfigured(config)) return null

  if (config.smsProvider === 'twilio') {
    const accountSid = decrypt(config.twilioAccountSid)!
    const authToken = decrypt(config.twilioAuthToken)!
    const from = config.twilioFromNumber!
    return async (to, text) => {
      let normalizedTo: string
      try {
        normalizedTo = normalizePhoneToE164(to)
      } catch {
        return new Error('INVALID_PHONE')
      }
      return sendTwilioSms({ accountSid, authToken, from, to: normalizedTo, text })
    }
  }

  if (config.smsProvider === 'smsapi') {
    const token = decrypt(config.smsApiToken)!
    const from = config.smsApiSender!
    return async (to, text) => {
      let normalizedTo: string
      try {
        normalizedTo = normalizePhoneToE164(to)
      } catch {
        return new Error('INVALID_PHONE')
      }
      return sendSmsApiSms({ token, from, to: normalizedTo, text })
    }
  }

  return null
}

/**
 * Convenience wrapper that loads TenantConfig itself. Only the admin
 * test-send route uses this; the cron path uses `getSmsSender` directly.
 */
export async function sendSms(to: string, text: string): Promise<Error | null> {
  const config = await getTenantConfig()
  const sender = getSmsSender(config)
  if (!sender) return new Error('SMS_NOT_CONFIGURED')
  return sender(to, text)
}
