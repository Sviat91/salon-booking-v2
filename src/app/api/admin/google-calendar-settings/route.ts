import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { encrypt } from '@/lib/encryption'
import { invalidateTenantConfigCache } from '@/lib/tenant'
import { parseServiceAccountKey } from '@/lib/google-calendar/config'
import { resetAccessTokenCache } from '@/lib/google-calendar/auth'
import { enqueueBackfillForMaster } from '@/lib/google-calendar/outbox'

export const runtime = 'nodejs'

const PatchSchema = z.object({
  googleCalendarEnabled: z.boolean().optional(),
  serviceAccountKey: z.string().max(8192).optional(),
})

const MASK = '••••••••'

export async function GET() {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const config = await prisma.tenantConfig.findFirst()
  const masters = await prisma.user.findMany({
    where: { role: 'MASTER' },
    select: {
      id: true,
      name: true,
      masterProfile: {
        select: {
          googleCalendarId: true,
          googleSyncStatus: true,
          googleSyncError: true,
          googleSyncedAt: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  })

  return NextResponse.json({
    googleCalendarEnabled: config?.googleCalendarEnabled ?? false,
    serviceAccountEmail: config?.googleServiceAccountEmail ?? '',
    hasKey: Boolean(config?.googleServiceAccountKey),
    masters: masters.map((m) => ({
      id: m.id,
      name: m.name,
      calendarId: m.masterProfile?.googleCalendarId ?? '',
      syncStatus: m.masterProfile?.googleSyncStatus ?? null,
      syncError: m.masterProfile?.googleSyncError ?? null,
      syncedAt: m.masterProfile?.googleSyncedAt?.toISOString() ?? null,
    })),
  })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const raw = await req.json()
    const data = PatchSchema.parse(raw)

    const updateData: Record<string, unknown> = {}
    if (data.googleCalendarEnabled !== undefined) {
      updateData.googleCalendarEnabled = data.googleCalendarEnabled
    }

    if (data.serviceAccountKey !== undefined && data.serviceAccountKey !== MASK) {
      const trimmed = data.serviceAccountKey.trim()
      if (!trimmed) {
        updateData.googleServiceAccountKey = null
        updateData.googleServiceAccountEmail = null
      } else {
        const parsedKey = parseServiceAccountKey(trimmed)
        if (!parsedKey) {
          return NextResponse.json(
            { error: 'Invalid service account key', code: 'GOOGLE_KEY_INVALID' },
            { status: 400 },
          )
        }
        updateData.googleServiceAccountKey = encrypt(trimmed)
        updateData.googleServiceAccountEmail = parsedKey.clientEmail
      }
    }

    const existing = await prisma.tenantConfig.findFirst()
    if (!existing) {
      await prisma.tenantConfig.create({ data: updateData as Parameters<typeof prisma.tenantConfig.create>[0]['data'] })
    } else {
      await prisma.tenantConfig.update({ where: { id: existing.id }, data: updateData })
    }
    await invalidateTenantConfigCache()
    resetAccessTokenCache()

    // Enabling sync (false -> true): push already-connected masters' upcoming appointments.
    if (data.googleCalendarEnabled === true && !existing?.googleCalendarEnabled) {
      void prisma.masterProfile
        .findMany({ where: { googleCalendarId: { not: null } }, select: { userId: true } })
        .then((profiles) => Promise.all(profiles.map((p) => enqueueBackfillForMaster(p.userId))))
        .catch(console.error)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message, code: 'VALIDATION_ERROR' }, { status: 400 })
    }
    console.error('[google-calendar-settings PATCH] error:', error)
    return NextResponse.json({ error: 'Failed to update Google Calendar settings', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
