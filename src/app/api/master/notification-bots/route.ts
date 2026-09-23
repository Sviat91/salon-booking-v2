import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'
import { MasterCreateBotSchema, createBot, listBots } from '@/lib/notifications/bots-store'

export const runtime = 'nodejs'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'MASTER') {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const [config, bots] = await Promise.all([
    prisma.tenantConfig.findFirst({ select: { notifTelegramEnabled: true } }),
    listBots({ ownerId: session.user.id }),
  ])

  return NextResponse.json({
    telegramEnabled: config?.notifTelegramEnabled ?? false,
    masters: [],
    bots,
  })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'MASTER') {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const data = MasterCreateBotSchema.parse(await req.json())
    // AD-4: scope/masterIds/ownerId are always forced server-side, never
    // accepted from the client, regardless of what the body contains.
    const result = await createBot(
      { ...data, scope: 'SELECTED', masterIds: [session.user.id] },
      { ownerId: session.user.id }
    )
    if (!result.ok) {
      return NextResponse.json({ error: result.code, code: result.code }, { status: result.status })
    }
    return NextResponse.json({ bot: result.bot, tokenCheck: result.tokenCheck })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message, code: 'VALIDATION_ERROR' }, { status: 400 })
    }
    console.error('[master notification-bots POST] error:', error)
    return NextResponse.json({ error: 'Failed to create bot', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
