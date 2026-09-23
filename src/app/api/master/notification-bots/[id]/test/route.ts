import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { canManageBot, findBotOwner, testBotToken } from '@/lib/notifications/bots-store'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user?.id || session.user.role !== 'MASTER') {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const bot = await findBotOwner(params.id)
  if (!bot) return NextResponse.json({ error: 'Bot not found', code: 'NOT_FOUND' }, { status: 404 })
  if (!canManageBot(session.user, bot)) {
    return NextResponse.json({ error: 'Forbidden', code: 'FORBIDDEN' }, { status: 403 })
  }

  const body = (await req.json().catch(() => ({}))) as { token?: string }
  const result = await testBotToken(params.id, body.token)
  if (!result.ok) return NextResponse.json({ error: result.code, code: result.code }, { status: result.status })
  return NextResponse.json({ ok: true, username: result.username })
}
