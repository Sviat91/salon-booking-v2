import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import { MasterUpdateBotSchema, canManageBot, deleteBot, findBotOwner, updateBot } from '@/lib/notifications/bots-store'

export const runtime = 'nodejs'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'MASTER') {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const bot = await findBotOwner(params.id)
  if (!bot) return NextResponse.json({ error: 'Bot not found', code: 'NOT_FOUND' }, { status: 404 })
  if (!canManageBot(session.user, bot)) {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }

  try {
    // AD-4: scope/masterIds/ownerId are not part of this schema, so a master
    // can never change them through this route.
    const data = MasterUpdateBotSchema.parse(await req.json())
    const result = await updateBot(params.id, data)
    if (!result.ok) {
      return NextResponse.json({ error: result.code, code: result.code }, { status: result.status })
    }
    return NextResponse.json({ bot: result.bot, tokenCheck: result.tokenCheck })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message, code: 'VALIDATION_ERROR' }, { status: 400 })
    }
    console.error('[master notification-bots PATCH] error:', error)
    return NextResponse.json({ error: 'Failed to update bot', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'MASTER') {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const bot = await findBotOwner(params.id)
  if (!bot) return NextResponse.json({ error: 'Bot not found', code: 'NOT_FOUND' }, { status: 404 })
  if (!canManageBot(session.user, bot)) {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }

  try {
    await deleteBot(params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[master notification-bots DELETE] error:', error)
    return NextResponse.json({ error: 'Bot not found', code: 'NOT_FOUND' }, { status: 404 })
  }
}
