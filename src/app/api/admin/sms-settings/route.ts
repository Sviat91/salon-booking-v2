import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { encrypt } from '@/lib/encryption'
import { invalidateTenantConfigCache } from '@/lib/tenant'

export const runtime = 'nodejs'

const PatchSchema = z.object({
  notifSmsEnabled: z.boolean().optional(),
  smsProvider: z.enum(['twilio', 'smsapi']).optional(),
  twilioAccountSid: z.string().trim().max(256).nullable().optional(),
  twilioAuthToken: z.string().trim().max(256).nullable().optional(),
  twilioFromNumber: z.string().trim().max(32).nullable().optional(),
  smsApiToken: z.string().trim().max(256).nullable().optional(),
  smsApiSender: z.string().trim().max(32).nullable().optional(),
})

const MASK = '••••••••'

export async function GET() {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const config = await prisma.tenantConfig.findFirst()

  return NextResponse.json({
    notifSmsEnabled: config?.notifSmsEnabled ?? false,
    smsProvider: config?.smsProvider ?? 'twilio',
    twilioAccountSid: config?.twilioAccountSid ? MASK : '',
    twilioAuthToken: config?.twilioAuthToken ? MASK : '',
    twilioFromNumber: config?.twilioFromNumber ?? '',
    smsApiToken: config?.smsApiToken ? MASK : '',
    smsApiSender: config?.smsApiSender ?? '',
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

    const existing = await prisma.tenantConfig.findFirst()

    const resolveSecret = (value: string | null | undefined, existingValue: string | null | undefined) => {
      if (value === undefined) return undefined
      if (value === MASK) return existingValue ?? null
      return value ? encrypt(value) : null
    }

    const updateData: Record<string, unknown> = {}
    if (data.notifSmsEnabled !== undefined) updateData.notifSmsEnabled = data.notifSmsEnabled
    if (data.smsProvider !== undefined) updateData.smsProvider = data.smsProvider

    const twilioAccountSid = resolveSecret(data.twilioAccountSid, existing?.twilioAccountSid)
    if (twilioAccountSid !== undefined) updateData.twilioAccountSid = twilioAccountSid

    const twilioAuthToken = resolveSecret(data.twilioAuthToken, existing?.twilioAuthToken)
    if (twilioAuthToken !== undefined) updateData.twilioAuthToken = twilioAuthToken

    if (data.twilioFromNumber !== undefined) updateData.twilioFromNumber = data.twilioFromNumber || null

    const smsApiToken = resolveSecret(data.smsApiToken, existing?.smsApiToken)
    if (smsApiToken !== undefined) updateData.smsApiToken = smsApiToken

    if (data.smsApiSender !== undefined) updateData.smsApiSender = data.smsApiSender || null

    if (!existing) {
      await prisma.tenantConfig.create({ data: updateData as Parameters<typeof prisma.tenantConfig.create>[0]['data'] })
    } else {
      await prisma.tenantConfig.update({ where: { id: existing.id }, data: updateData })
    }
    await invalidateTenantConfigCache()

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message }, { status: 400 })
    }
    console.error('[sms-settings PATCH] error:', error)
    return NextResponse.json({ error: 'Failed to update SMS settings' }, { status: 500 })
  }
}
