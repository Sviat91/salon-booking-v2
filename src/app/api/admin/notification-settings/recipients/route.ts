import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import prisma from '@/lib/prisma'
import { z } from 'zod'

const CreateSchema = z.object({
  chatId: z.string().trim().min(1).max(64),
  label: z.string().trim().max(64).optional(),
})

export async function GET() {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const recipients = await prisma.telegramNotificationRecipient.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, chatId: true, label: true },
  })

  return NextResponse.json({ recipients })
}

export async function POST(req: Request) {
  const session = await auth()
  if (!session?.user || (session.user.role !== 'SUPERADMIN' && session.user.role !== 'ADMIN')) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  try {
    const raw = await req.json()
    const data = CreateSchema.parse(raw)

    const recipient = await prisma.telegramNotificationRecipient.create({
      data: { chatId: data.chatId, label: data.label || null },
      select: { id: true, chatId: true, label: true },
    })

    return NextResponse.json(recipient)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: error.errors[0]?.message }, { status: 400 })
    }
    console.error('[notification-settings/recipients POST] error:', error)
    return NextResponse.json({ error: 'Failed to add recipient' }, { status: 500 })
  }
}
