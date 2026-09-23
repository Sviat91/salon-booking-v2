import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { AdminCreateBotSchema, createBot, listBots } from '@/lib/notifications/bots-store'

export const runtime = 'nodejs'

export async function GET() {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const [config, masters, bots] = await Promise.all([
    prisma.tenantConfig.findFirst({ select: { notifTelegramEnabled: true } }),
    prisma.user.findMany({ where: { role: 'MASTER' }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    listBots({}),
  ])

  return NextResponse.json({
    telegramEnabled: config?.notifTelegramEnabled ?? false,
    masters,
    bots,
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const data = AdminCreateBotSchema.parse(await req.json())
    const result = await createBot(data, { ownerId: null })
    if (!result.ok) {
      return NextResponse.json({ error: result.code, code: result.code }, { status: result.status })
    }
    return NextResponse.json({ bot: result.bot, tokenCheck: result.tokenCheck })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message, code: 'VALIDATION_ERROR' }, { status: 400 })
    }
    console.error('[admin notification-bots POST] error:', error)
    return NextResponse.json({ error: 'Failed to create bot', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
