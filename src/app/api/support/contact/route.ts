import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getLogger } from '../../../../lib/logger'
import { rateLimit } from '../../../../lib/cache'
import { notifyContactForm } from '../../../../lib/notifications'
import { validateTurnstileForAPI } from '../../../../lib/turnstile'

export const runtime = 'nodejs'

const log = getLogger({ module: 'api.support.contact' })

const BodySchema = z.object({
  name: z.string().trim().min(2, 'Imię i nazwisko musi mieć co najmniej 2 znaki').max(240),
  email: z.string().trim().email('Nieprawidłowy adres e-mail').max(180),
  subject: z.string().trim().min(1, 'Wybierz temat wiadomości').max(200),
  message: z.string().trim().min(10, 'Wiadomość musi mieć co najmniej 10 znaków').max(5000),
  requestId: z.string().trim().max(64).optional(),
  turnstileToken: z.string().nullish(),
})

function maskEmailForLog(email: string): string {
  const [local, domain] = email.split('@')
  if (!domain) return 'invalid-email'
  const maskedLocal = local.length > 2 ? `${local[0]}***${local.slice(-1)}` : '***'
  return `${maskedLocal}@${domain}`
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.ip || '0.0.0.0'

  let body: z.infer<typeof BodySchema>
  try {
    body = BodySchema.parse(await req.json())
  } catch (err) {
    log.warn({ err, ip }, 'Invalid contact form payload')
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

  const { email, subject, requestId } = body
  const finalRequestId = requestId || `contact-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`

  const rateKey = `rate:support-contact:${ip}`
  const rate = await rateLimit(rateKey, 3, 15 * 60)
  if (!rate.allowed) {
    log.warn({ ip, email: maskEmailForLog(email) }, 'Contact form rate limited')
    return NextResponse.json({
      error: 'Zbyt wiele wiadomości. Spróbuj ponownie za 15 minut.',
      code: 'RATE_LIMITED',
    }, { status: 429 })
  }

  const turnstileResult = await validateTurnstileForAPI(body.turnstileToken, ip, { requireToken: false })
  if (!turnstileResult.success) {
    log.warn({ ip, email: maskEmailForLog(email) }, 'Contact form Turnstile rejected')
    return NextResponse.json(turnstileResult.errorResponse, { status: turnstileResult.status })
  }

  log.info({
    requestId: finalRequestId,
    subject: subject.trim(),
    email: maskEmailForLog(email),
  }, 'Contact form received')

  notifyContactForm({
    senderName: body.name,
    senderEmail: body.email,
    subject: body.subject,
    message: body.message,
  }).catch(console.error)

  return NextResponse.json({
    status: 'success',
    message: 'Wiadomość została wysłana pomyślnie. Odpowiemy w ciągu 72 godzin.',
    requestId: finalRequestId,
  }, { status: 200 })
}
