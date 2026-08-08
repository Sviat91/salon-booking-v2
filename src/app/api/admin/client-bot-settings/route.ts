import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { restartClientBot } from '@/lib/telegram-bot/lifecycle'
import { invalidateTenantConfigCache } from '@/lib/tenant'

const PatchSchema = z.object({
  clientBotEnabled: z.boolean().optional(),
  clientBotToken: z.string().trim().max(256).nullable().optional(),
  clientBotUsername: z.string().trim().max(64).nullable().optional(),
  clientBotSiteUrl: z.string().trim().max(512).nullable().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const config = await prisma.tenantConfig.findFirst()

  return NextResponse.json({
    clientBotEnabled: config?.clientBotEnabled ?? false,
    clientBotToken: config?.clientBotToken ?? '',
    clientBotUsername: config?.clientBotUsername ?? '',
    clientBotSiteUrl: config?.clientBotSiteUrl ?? '',
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

    const updateData: Record<string, unknown> = {}
    if (data.clientBotEnabled !== undefined) updateData.clientBotEnabled = data.clientBotEnabled
    if (data.clientBotToken !== undefined) updateData.clientBotToken = data.clientBotToken || null
    if (data.clientBotUsername !== undefined) updateData.clientBotUsername = data.clientBotUsername || null
    if (data.clientBotSiteUrl !== undefined) updateData.clientBotSiteUrl = data.clientBotSiteUrl || null

    if (!existing) {
      await prisma.tenantConfig.create({ data: updateData as Parameters<typeof prisma.tenantConfig.create>[0]['data'] })
    } else {
      await prisma.tenantConfig.update({ where: { id: existing.id }, data: updateData })
    }
    await invalidateTenantConfigCache()

    const lifecycleResult = await restartClientBot()
    if (!lifecycleResult.ok) {
      return NextResponse.json({ error: lifecycleResult.error, code: 'INTERNAL_ERROR' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message, code: 'VALIDATION_ERROR' }, { status: 400 })
    }
    console.error('[client-bot-settings PATCH] error:', error)
    return NextResponse.json({ error: 'Failed to update client bot settings', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
