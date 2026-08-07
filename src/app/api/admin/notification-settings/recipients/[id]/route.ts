import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const UpdateSchema = z.object({
  chatId: z.string().trim().min(1).max(64),
  label: z.string().trim().max(64).optional(),
})

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const { id } = params

  try {
    const raw = await req.json()
    const data = UpdateSchema.parse(raw)

    const recipient = await prisma.telegramNotificationRecipient.update({
      where: { id },
      data: { chatId: data.chatId, label: data.label || null },
      select: { id: true, chatId: true, label: true },
    })

    return NextResponse.json(recipient)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message }, { status: 400 })
    }
    console.error('[notification-settings/recipients PATCH] error:', error)
    return NextResponse.json({ error: 'Failed to update recipient' }, { status: 500 })
  }
}

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
