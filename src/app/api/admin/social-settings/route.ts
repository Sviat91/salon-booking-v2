import { NextResponse } from "next/server"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { encrypt } from "@/lib/encryption"

export async function GET() {
  const session = await auth()
  if (!session?.user || (session.user.role !== "SUPERADMIN" && session.user.role !== "ADMIN")) {
    return new NextResponse("Unauthorized", { status: 401 })
  }

  const config = await prisma.tenantConfig.findFirst()
  
  return NextResponse.json({
    googleClientId: config?.googleClientId || "",
    googleClientSecret: config?.googleClientSecret ? "••••••••" : "",
    appleClientId: config?.appleClientId || "",
    appleTeamId: config?.appleTeamId || "",
    appleKeyId: config?.appleKeyId || "",
    applePrivateKey: config?.applePrivateKey ? "••••••••" : "",
    telegramBotUsername: config?.telegramBotUsername || "",
    telegramBotToken: config?.telegramBotToken ? "••••••••" : "",
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
    
    // helper inner function so we don't do repetitive logic
    const handleSecret = (newVal: string | undefined, existingVal: string | null) => {
      // If user provided nothing or empty string, clear it out.
      if (!newVal || newVal.trim() === "") return null
      // If it is the mask, retain existing
      if (newVal === "••••••••") return existingVal
      // Otherwise it's a new secret, encrypt and save
      return encrypt(newVal.trim())
    }

    const updateData = {
      googleClientId: data.googleClientId?.trim() || null,
      googleClientSecret: handleSecret(data.googleClientSecret, existing?.googleClientSecret || null),
      
      appleClientId: data.appleClientId?.trim() || null,
      appleTeamId: data.appleTeamId?.trim() || null,
      appleKeyId: data.appleKeyId?.trim() || null,
      applePrivateKey: handleSecret(data.applePrivateKey, existing?.applePrivateKey || null),
      
      telegramBotUsername: data.telegramBotUsername?.trim() || null,
      telegramBotToken: handleSecret(data.telegramBotToken, existing?.telegramBotToken || null),
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
    console.error("[social-settings PATCH] error:", error)
    return NextResponse.json({ error: "Failed to update social settings" }, { status: 500 })
  }
}
