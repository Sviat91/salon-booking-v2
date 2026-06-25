import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const PatchSchema = z.object({
  notifEmailEnabled: z.boolean().optional(),
  notifTelegramEnabled: z.boolean().optional(),
  notifAdminChatId: z.string().trim().max(64).nullable().optional(),
  notifReminder24hEnabled: z.boolean().optional(),
  notifReminder2hEnabled: z.boolean().optional(),
  telegramBotToken: z.string().trim().max(256).nullable().optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const config = await prisma.tenantConfig.findFirst()

  return NextResponse.json({
    notifEmailEnabled: config?.notifEmailEnabled ?? false,
    notifTelegramEnabled: config?.notifTelegramEnabled ?? false,
    notifAdminChatId: config?.notifAdminChatId ?? '',
    notifReminder24hEnabled: config?.notifReminder24hEnabled ?? false,
    notifReminder2hEnabled: config?.notifReminder2hEnabled ?? false,
    telegramBotToken: config?.telegramBotToken ?? '',
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
    if (data.notifEmailEnabled !== undefined) updateData.notifEmailEnabled = data.notifEmailEnabled
    if (data.notifTelegramEnabled !== undefined) updateData.notifTelegramEnabled = data.notifTelegramEnabled
    if (data.notifAdminChatId !== undefined) updateData.notifAdminChatId = data.notifAdminChatId || null
    if (data.notifReminder24hEnabled !== undefined) updateData.notifReminder24hEnabled = data.notifReminder24hEnabled
    if (data.notifReminder2hEnabled !== undefined) updateData.notifReminder2hEnabled = data.notifReminder2hEnabled
    if (data.telegramBotToken !== undefined) updateData.telegramBotToken = data.telegramBotToken || null

    if (!existing) {
      await prisma.tenantConfig.create({ data: updateData as Parameters<typeof prisma.tenantConfig.create>[0]['data'] })
    } else {
      await prisma.tenantConfig.update({ where: { id: existing.id }, data: updateData })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message }, { status: 400 })
    }
    console.error('[notification-settings PATCH] error:', error)
    return NextResponse.json({ error: 'Failed to update notification settings' }, { status: 500 })
  }
}
