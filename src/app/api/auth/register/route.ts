import { NextRequest, NextResponse } from "next/server"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"
import { getRequestIp, saveConsentRecord } from "@/lib/consent-service"
import { rateLimit } from "@/lib/cache"
import { z } from "zod"

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email format"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().min(5, "Invalid phone number").max(30).optional().or(z.literal(""))
    .nullable(),
  consents: z.object({
    dataProcessing: z.boolean().refine((value) => value, {
      message: "Data processing consent is required",
    }),
    terms: z.boolean().refine((value) => value, {
      message: "Terms consent is required",
    }),
    notifications: z.boolean().optional().default(false),
  }),
})

export async function POST(req: NextRequest) {
  try {
    const ip = getRequestIp(req)
    const { allowed } = await rateLimit(`rate:register:${ip}`, 5, 900)
    if (!allowed) {
      return NextResponse.json(
        { error: "Too many requests. Please try again later." },
        { status: 429 }
      )
    }

    const raw = await req.json()
    const parsed = registerSchema.safeParse(raw)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || "Invalid data" },
        { status: 400 }
      )
    }

    const {
      name,
      email,
      password,
      phone,
      consents,
    } = parsed.data

    const normalizedName = name.trim()
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedPhone = phone?.trim() || null

    const existingRegistered = await prisma.user.findFirst({
      where: {
        email: normalizedEmail,
        password: { not: null },
      },
    })

    if (existingRegistered) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 400 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 10)

    const createdUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: normalizedName,
          email: normalizedEmail,
          phone: normalizedPhone,
          password: hashedPassword,
          role: "CLIENT",
          isGuest: false,
        },
      })

      // Auto-link legacy guest bookings by exact name + phone.
      if (normalizedPhone) {
        const candidateGuests = await tx.user.findMany({
          where: {
            isGuest: true,
            name: normalizedName,
            phone: normalizedPhone,
          },
          select: {
            id: true,
            email: true,
          },
        })

        // Additional verifier: if guest email exists, it must match registration email.
        const guestIdsToMerge = candidateGuests
          .filter((guest) => {
            if (!guest.email) return true
            return guest.email.trim().toLowerCase() === normalizedEmail
          })
          .map((guest) => guest.id)

        if (guestIdsToMerge.length > 0) {
          await tx.appointment.updateMany({
            where: { clientId: { in: guestIdsToMerge } },
            data: { clientId: user.id },
          })

          await tx.consentRecord.updateMany({
            where: { userId: { in: guestIdsToMerge } },
            data: { userId: user.id },
          })

          await tx.user.deleteMany({
            where: { id: { in: guestIdsToMerge } },
          })
        }
      }

      await saveConsentRecord(
        {
          userId: user.id,
          // For users without phone we still persist consent linked to userId.
          // Identity fallback is internal and does not affect guest consent checks.
          phone: normalizedPhone || user.id,
          name: normalizedName,
          email: normalizedEmail,
          ip: getRequestIp(req),
          dataProcessing: consents.dataProcessing,
          terms: consents.terms,
          notifications: Boolean(consents.notifications),
        },
        tx
      )

      return user
    })

    return NextResponse.json(
      {
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        role: createdUser.role,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error("Registration error:", error)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
