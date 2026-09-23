import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { z } from 'zod'
import { AdminUpdateBotSchema, deleteBot, updateBot } from '@/lib/notifications/bots-store'

export const runtime = 'nodejs'

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const data = AdminUpdateBotSchema.parse(await req.json())
    const result = await updateBot(params.id, data)
    if (!result.ok) {
      return NextResponse.json({ error: result.code, code: result.code }, { status: result.status })
    }
    return NextResponse.json({ bot: result.bot, tokenCheck: result.tokenCheck })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message, code: 'VALIDATION_ERROR' }, { status: 400 })
    }
    console.error('[admin notification-bots PATCH] error:', error)
    return NextResponse.json({ error: 'Failed to update bot', code: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    await deleteBot(params.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[admin notification-bots DELETE] error:', error)
    return NextResponse.json({ error: 'Bot not found', code: 'NOT_FOUND' }, { status: 404 })
  }
}
