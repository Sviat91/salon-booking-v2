import { NextRequest, NextResponse } from 'next/server'
import { notifyBookingReminders } from '@/lib/notifications'

export const runtime = 'nodejs'

/**
 * GET /api/cron/reminders
 * Authorization: Bearer <CRON_SECRET>
 *
 * Intended to be hit every hour by Vercel Cron or an external scheduler.
 * Sends 24h and 2h pre-appointment reminders; skips duplicates via NotificationLog.
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  const authHeader = req.headers.get('authorization')
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (token !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await notifyBookingReminders()

  return NextResponse.json(result)
}
