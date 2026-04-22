import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { z } from "zod"

export const runtime = "nodejs"

const bulkSchema = z.object({
  dates: z.array(z.string()),
  isDayOff: z.boolean(),
  intervals: z.array(z.object({
    start: z.string(),
    end: z.string(),
  })),
  masterId: z.string().optional(),
  masterIds: z.array(z.string()).optional()
})

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user || (session.user.role !== "SUPERADMIN" && session.user.role !== "ADMIN")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = await req.json()
    const parsed = bulkSchema.parse(body)

    let targetMasterIds: string[] = []
    
    if (parsed.masterIds && parsed.masterIds.length > 0) {
      targetMasterIds = parsed.masterIds
    } else if (parsed.masterId) {
      targetMasterIds = [parsed.masterId]
    } else {
       return NextResponse.json({ error: "No master targeted" }, { status: 400 })
    }

    const resultsCount = await prisma.$transaction(async (tx) => {
      let count = 0
      for (const tMasterId of targetMasterIds) {
        const profile = await tx.masterProfile.findUnique({ where: { userId: tMasterId } })
        if (!profile) continue

        for (const dateStr of parsed.dates) {
          const date = new Date(dateStr)
          
          await tx.scheduleOverride.upsert({
            where: {
              masterProfileId_date: {
                masterProfileId: profile.id,
                date: date
              }
            },
            update: {
              isDayOff: parsed.isDayOff,
              intervals: JSON.stringify(parsed.intervals)
            },
            create: {
              masterProfileId: profile.id,
              date: date,
              isDayOff: parsed.isDayOff,
              intervals: JSON.stringify(parsed.intervals)
            }
          })
          count++
        }
      }
      return count
    })

    return NextResponse.json({ success: true, count: resultsCount })
  } catch (error: any) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "Invalid data" }, { status: 400 })
    console.error("Error bulk save:", error)
    return NextResponse.json({ error: "Failed to save overrides" }, { status: 500 })
  }
}
