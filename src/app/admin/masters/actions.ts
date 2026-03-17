"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"

const CreateMasterSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email"),
  bio: z.string().max(500).optional(),
})

const UpdateMasterSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  bio: z.string().max(500).optional(),
})

export type MasterFormState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  success?: boolean
  generatedPassword?: string
}

/** Generate a readable random password */
function generatePassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789"
  return Array.from({ length: 10 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join("")
}

export async function createMaster(
  _prev: MasterFormState,
  formData: FormData
): Promise<MasterFormState> {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    bio: formData.get("bio") || undefined,
  }

  const parsed = CreateMasterSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  // Check email uniqueness
  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  })
  if (existing) {
    return { fieldErrors: { email: ["This email is already registered"] } }
  }

  const plainPassword = generatePassword()
  const hashedPassword = await bcrypt.hash(plainPassword, 10)

  try {
    await prisma.user.create({
      data: {
        name: parsed.data.name,
        email: parsed.data.email,
        password: hashedPassword,
        role: "MASTER",
        masterProfile: {
          create: {
            bio: parsed.data.bio ?? null,
          },
        },
      },
    })
    revalidatePath("/admin/masters")
    return { success: true, generatedPassword: plainPassword }
  } catch {
    return { error: "Failed to create master. Please try again." }
  }
}

export async function updateMaster(
  id: string,
  _prev: MasterFormState,
  formData: FormData
): Promise<MasterFormState> {
  const raw = {
    name: formData.get("name"),
    bio: formData.get("bio") || undefined,
  }

  const parsed = UpdateMasterSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  try {
    await prisma.user.update({
      where: { id },
      data: {
        name: parsed.data.name,
        masterProfile: {
          upsert: {
            create: { bio: parsed.data.bio ?? null },
            update: { bio: parsed.data.bio ?? null },
          },
        },
      },
    })
    revalidatePath("/admin/masters")
    return { success: true }
  } catch {
    return { error: "Failed to update master. Please try again." }
  }
}

export async function deleteMaster(id: string): Promise<void> {
  await prisma.user.delete({ where: { id } })
  revalidatePath("/admin/masters")
}
