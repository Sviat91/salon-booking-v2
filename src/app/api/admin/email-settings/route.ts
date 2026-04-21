import { NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"

export async function GET() {
  const session = await auth()
  if (!session?.user || (session.user.role !== "SUPERADMIN" && session.user.role !== "ADMIN")) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const config = await prisma.tenantConfig.findFirst()
  
  return NextResponse.json({
    smtpHost: config?.smtpHost || "",
    smtpPort: config?.smtpPort || 587,
    smtpUser: config?.smtpUser || "",
    smtpPass: config?.smtpPass || "",
    smtpFrom: config?.smtpFrom || "",
    smtpSecure: config?.smtpSecure || false
  })
}

export async function PATCH(req: Request) {
  const session = await auth()
  if (!session?.user || (session.user.role !== "SUPERADMIN" && session.user.role !== "ADMIN")) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  try {
    const data = await req.json()
    
    const existing = await prisma.tenantConfig.findFirst()
    
    const updateData = {
      smtpHost: data.smtpHost || null,
      smtpPort: data.smtpPort ? parseInt(data.smtpPort, 10) : 587,
      smtpUser: data.smtpUser || null,
      smtpPass: data.smtpPass || null,
      smtpFrom: data.smtpFrom || null,
      smtpSecure: data.smtpSecure || false
    }

    if (!existing) {
      await prisma.tenantConfig.create({ data: updateData })
    } else {
      await prisma.tenantConfig.update({
        where: { id: existing.id },
        data: updateData
      })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error("[email-settings PATCH] error:", error)
    return NextResponse.json({ error: "Failed to update email settings" }, { status: 500 })
  }
}
