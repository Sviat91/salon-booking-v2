import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import { setMasterCalendarId } from '@/lib/google-calendar/connect'

export const runtime = 'nodejs'

const PutSchema = z.object({ calendarId: z.string().max(256) })

export async function PUT(req: Request, { params }: { params: { masterId: string } }) {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const { calendarId } = PutSchema.parse(await req.json())
    const result = await setMasterCalendarId(params.masterId, calendarId)
    if (!result.ok) {
      return NextResponse.json(
        { error: result.code, code: result.code },
        { status: result.code === 'NOT_FOUND' ? 404 : result.code === 'CALENDAR_ID_IN_USE' ? 409 : 400 },
      )
    }
    return NextResponse.json({ success: true, queued: result.queued })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message, code: 'VALIDATION_ERROR' }, { status: 400 })
    }
    console.error('[admin master google-calendar PUT] error:', error)
    return NextResponse.json({ error: 'Failed to save calendar', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
