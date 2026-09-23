import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { testBotToken } from '@/lib/notifications/bots-store'

export const runtime = 'nodejs'

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const body = (await req.json().catch(() => ({}))) as { token?: string }
  const result = await testBotToken(params.id, body.token)
  if (!result.ok) return NextResponse.json({ error: result.code, code: result.code }, { status: result.status })
  return NextResponse.json({ ok: true, username: result.username })
}
