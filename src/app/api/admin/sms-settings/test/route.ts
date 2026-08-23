import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { sendSms } from '@/lib/notifications/sms'
import { getTenantConfig } from '@/lib/tenant'
import { DEFAULT_BRAND_NAME } from '@/lib/constants/brand'

export const runtime = 'nodejs'

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const { to } = await req.json()
    if (!to) {
      return NextResponse.json({ error: 'Phone number is required' }, { status: 400 })
    }

    const config = await getTenantConfig()
    const brandName = config.brandName || DEFAULT_BRAND_NAME

    const err = await sendSms(to, `${brandName}: test`)
    if (err) {
      return NextResponse.json({ error: err.message }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('[sms-settings TEST] Failed to send test SMS:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send test SMS.' },
      { status: 500 }
    )
  }
}
