import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { getAccessToken, getServiceAccountEmail } from '@/lib/google-calendar/auth'

export const runtime = 'nodejs'

export async function POST() {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  let token: string | null
  try {
    token = await getAccessToken()
  } catch {
    return NextResponse.json({ error: 'Google token endpoint unavailable', code: 'GOOGLE_API_ERROR' }, { status: 502 })
  }
  if (!token) {
    return NextResponse.json({ error: 'Could not obtain a Google access token', code: 'GOOGLE_KEY_INVALID' }, { status: 400 })
  }
  return NextResponse.json({ ok: true, serviceAccountEmail: await getServiceAccountEmail() })
}
