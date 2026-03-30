import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET() {
  const master = await prisma.user.findFirst({ where: { role: 'MASTER' } })
  const schedules = await prisma.schedule.findMany()
  const overrides = await prisma.dateOverride.findMany()

  return NextResponse.json({
    masterId: master?.id,
    schedules,
    overrides
  })
}
