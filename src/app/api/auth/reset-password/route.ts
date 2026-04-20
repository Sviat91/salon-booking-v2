import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import prisma from '@/lib/prisma'
import { rateLimit } from '@/lib/cache'

// Inline schema
const schema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
})

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

export async function POST(req: NextRequest) {
  try {
    // ── Rate limit: 10 attempts per 15 minutes per IP ─────────────────────
    // Slightly more generous than forgot-password since the user may be on
    // a fresh page load and retry a couple of times.
    const ip = getIp(req)
    const { allowed } = await rateLimit(`reset-pw:${ip}`, 10, 15 * 60)
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

    const { token, newPassword } = parsed.data

    // ── Look up token ──────────────────────────────────────────────────────
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      select: { id: true, userId: true, expiresAt: true },
    })

    // Token not found
    if (!resetToken) {
      return NextResponse.json(
        { error: 'invalid_token', message: 'This link is invalid or has already been used.' },
        { status: 400 }
      )
    }

    // Token expired
    if (new Date() > resetToken.expiresAt) {
      // Clean up the expired token
      await prisma.passwordResetToken.delete({ where: { id: resetToken.id } })
      return NextResponse.json(
        { error: 'token_expired', message: 'This link has expired. Please request a new one.' },
        { status: 400 }
      )
    }

    // ── Hash new password and update user ──────────────────────────────────
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    await prisma.$transaction([
      // Update user password
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { password: hashedPassword },
      }),
      // Delete ALL tokens for this user (one-time use; clean up any duplicates)
      prisma.passwordResetToken.deleteMany({
        where: { userId: resetToken.userId },
      }),
    ])

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    console.error('[reset-password] Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
