import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { id } = params

  try {
    await prisma.telegramNotificationRecipient.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[notification-settings/recipients DELETE] error:', error)
    return NextResponse.json({ error: 'Recipient not found' }, { status: 404 })
  }
}
