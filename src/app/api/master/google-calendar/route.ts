import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { setMasterCalendarId } from '@/lib/google-calendar/connect'

export const runtime = 'nodejs'

const PutSchema = z.object({ calendarId: z.string().max(256) })

export async function GET() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'MASTER') {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const [config, profile] = await Promise.all([
    prisma.tenantConfig.findFirst({
      select: { googleCalendarEnabled: true, googleServiceAccountKey: true, googleServiceAccountEmail: true },
    }),
    prisma.masterProfile.findUnique({
      where: { userId: session.user.id },
      select: { googleCalendarId: true, googleSyncStatus: true, googleSyncError: true, googleSyncedAt: true },
    }),
  ])

  return NextResponse.json({
    // The email is not a secret (the master shares her calendar with it); the key is never returned.
    serviceAccountEmail: config?.googleServiceAccountEmail ?? '',
    enabled: Boolean(config?.googleCalendarEnabled && config?.googleServiceAccountKey),
    calendarId: profile?.googleCalendarId ?? '',
    syncStatus: profile?.googleSyncStatus ?? null,
    syncError: profile?.googleSyncError ?? null,
    syncedAt: profile?.googleSyncedAt?.toISOString() ?? null,
  })
}

export async function PUT(req: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'MASTER') {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const { calendarId } = PutSchema.parse(await req.json())
    const result = await setMasterCalendarId(session.user.id, calendarId)
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
    console.error('[master google-calendar PUT] error:', error)
    return NextResponse.json({ error: 'Failed to save calendar', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
