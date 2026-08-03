import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getLogger } from '../../../../lib/logger'
import { rateLimit } from '../../../../lib/cache'
import { notifyContactForm } from '../../../../lib/notifications'
import { validateTurnstileForAPI } from '../../../../lib/turnstile'

export const runtime = 'nodejs'

const log = getLogger({ module: 'api.master.contact' })

const BodySchema = z.object({
  fullName: z.string().trim().min(2, 'Imię i nazwisko musi mieć co najmniej 2 znaki').max(240),
  phone: z.string().trim().min(9, 'Numer telefonu musi mieć co najmniej 9 cyfr').max(20),
  email: z.string().trim().email('Nieprawidłowy adres e-mail').max(180).optional().or(z.literal('')),
  message: z.string().trim().min(10, 'Wiadomość musi mieć co najmniej 10 znaków').max(5000),
  masterId: z.string().optional(),
  requestId: z.string().trim().max(64).optional(),
  turnstileToken: z.string().nullish(),
})

function maskPhoneForLog(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return '***'
  return `${digits.slice(0, 2)}***${digits.slice(-2)}`
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.ip || '0.0.0.0'

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch (err) {
    log.warn({ err, ip }, 'Invalid master contact form payload')
    if (err instanceof z.ZodError) {
      const firstError = err.errors[0]
      return NextResponse.json({
        error: firstError.message,
        code: 'VALIDATION_ERROR',
        field: firstError.path.join('.'),
      }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid payload', code: 'INVALID_PAYLOAD' }, { status: 400 })
  }

  const { phone, masterId, requestId } = body
  const finalRequestId = requestId || `master-contact-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

  const rateKey = `rate:master-contact:${ip}`
  const rate = await rateLimit(rateKey, 3, 15 * 60)
  if (!rate.allowed) {
    log.warn({ ip, phone: maskPhoneForLog(phone) }, 'Master contact form rate limited')
    return NextResponse.json({
      error: 'Zbyt wiele wiadomości. Spróbuj ponownie za 15 minut.',
      code: 'RATE_LIMITED',
    }, { status: 429 })
  }

  const turnstileResult = await validateTurnstileForAPI(body.turnstileToken, ip, { requireToken: false })
  if (!turnstileResult.success) {
    log.warn({ ip, phone: maskPhoneForLog(phone) }, 'Master contact form Turnstile rejected')
    return NextResponse.json(turnstileResult.errorResponse, { status: turnstileResult.status })
  }

  log.info({
    requestId: finalRequestId,
    phone: maskPhoneForLog(phone),
    masterId,
  }, 'Master contact form received')

  notifyContactForm({
    senderName: body.fullName,
    senderEmail: body.email || undefined,
    subject: masterId ? `Master contact (master: ${masterId})` : 'Master contact form',
    message: body.message,
  }).catch(console.error)

  return NextResponse.json({
    status: 'success',
    message: 'Wiadomość została wysłana pomyślnie. Mistrz skontaktuje się z Tobą wkrótce.',
    requestId: finalRequestId,
  }, { status: 200 })
}
