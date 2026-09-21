import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { testMasterCalendar } from '@/lib/google-calendar/connect'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'MASTER') {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { calendarId?: string }
  const result = await testMasterCalendar(session.user.id, body.calendarId)
  if (!result.ok) return NextResponse.json({ error: result.code, code: result.code }, { status: result.status })
  return NextResponse.json({ ok: true })
}
