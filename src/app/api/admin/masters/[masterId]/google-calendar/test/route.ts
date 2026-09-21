import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { testMasterCalendar } from '@/lib/google-calendar/connect'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: { masterId: string } }) {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { calendarId?: string }
  const result = await testMasterCalendar(params.masterId, body.calendarId)
  if (!result.ok) return NextResponse.json({ error: result.code, code: result.code }, { status: result.status })
  return NextResponse.json({ ok: true })
}
