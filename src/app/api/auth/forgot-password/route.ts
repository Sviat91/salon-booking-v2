import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { rateLimit } from '@/lib/cache'
import { sendPasswordResetEmail } from '@/lib/email'
import { validateTurnstileForAPI } from '@/lib/turnstile'

// Inline schema — simple enough to avoid cross-import overhead
const schema = z.object({
  email: z.string().email('Invalid email format'),
  turnstileToken: z.string().nullish(),
})

// Helper: extract client IP from Next.js request headers
function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

export async function POST(req: NextRequest) {
  try {
    // ── Rate limit: 3 requests per 15 minutes per IP ──────────────────────
    const ip = getIp(req)
    const { allowed } = await rateLimit(`forgot-pw:${ip}`, 3, 15 * 60)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    // ── Validate input ─────────────────────────────────────────────────────
    const raw = await req.json()
    const parsed = schema.safeParse(raw)
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message ?? 'Invalid data' },
        { status: 400 }
      )
    }

    const turnstileResult = await validateTurnstileForAPI(parsed.data.turnstileToken, ip, { requireToken: false })
    if (!turnstileResult.success) {
      return NextResponse.json(turnstileResult.errorResponse, { status: turnstileResult.status })
    }

    const email = parsed.data.email.trim().toLowerCase()

    // ── ALWAYS return 200 regardless of whether email exists ───────────────
    // This prevents email enumeration attacks — attacker cannot tell if
    // an address is registered by observing the response.
    const successResponse = NextResponse.json(
      { message: "If this email is registered, you'll receive a reset link shortly." },
      { status: 200 }
    )

    // ── Look up registered (non-guest) user with a password ───────────────
    // Case-insensitive via SQL LOWER() (2026-08-07 fix, same root cause as
    // src/auth.ts's authorize()): master/admin accounts created outside the
    // registration form aren't normalized to lowercase on creation, so
    // comparing only the lowercased input against the raw stored `email`
    // could miss a match. Look up the id case-insensitively, then re-fetch
    // typed via Prisma for the rest of this function.
    const idMatches = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM User WHERE LOWER(email) = ${email} AND isGuest = 0 AND password IS NOT NULL LIMIT 1
    `
    const user = idMatches[0]
      ? await prisma.user.findUnique({ where: { id: idMatches[0].id }, select: { id: true, email: true } })
      : null

    if (!user || !user.email) {
      // Email not found — return success anyway (anti-enumeration)
      return successResponse
    }

    // ── Delete any existing tokens for this user (prevent stale links) ────
    await prisma.passwordResetToken.deleteMany({
      where: { userId: user.id },
    })

    // ── Create a new one-time token (crypto UUID — no external deps) ───────
    const token = crypto.randomUUID()
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour from now

    await prisma.passwordResetToken.create({
      data: { userId: user.id, token, expiresAt },
    })

    // ── Build reset URL and send email ────────────────────────────────────
    const baseUrl =
      process.env.NEXTAUTH_URL ??
      process.env.AUTH_URL ??
      'http://localhost:3000'

    const resetUrl = `${baseUrl}/auth/reset-password?token=${token}`

    // Fire-and-forget: do not await — response is already determined above.
    // If SMTP is not configured, sendPasswordResetEmail() logs to console
    // and returns silently without throwing.
    sendPasswordResetEmail(user.email, resetUrl).catch((err) => {
      console.error('[forgot-password] Failed to send reset email:', err)
    })

    return successResponse
  } catch (error) {
    console.error('[forgot-password] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
