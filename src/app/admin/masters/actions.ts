"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import bcrypt from "bcryptjs"
import prisma from "@/lib/prisma"
import { encrypt, decrypt } from "@/lib/encryption"
import { auth } from "@/auth"
import { getServerT } from "@/lib/i18n-server"

// Avatar/logo paths are relative: "/uploads/filename.jpg" — not absolute URLs
const pathOrEmpty = z.string().optional().default("")

function buildCreateMasterSchema(t: (key: string) => string) {
  return z.object({
    name:          z.string().min(1, t('admin.masters.nameRequired')).max(100),
    email:         z.string().email(t('admin.masters.invalidEmail')),
    bio:           z.string().max(500).optional(),
    avatarUrl:     pathOrEmpty,
    showOnHomepage:z.coerce.boolean().default(true),
    color:         z.string().regex(/^#[0-9A-Fa-f]{6}$/, t('admin.masters.invalidHex')).default("#166534"),
  })
}

function buildUpdateMasterSchema(t: (key: string) => string) {
  return z.object({
    name:          z.string().min(1, t('admin.masters.nameRequired')).max(100),
    bio:           z.string().max(500).optional(),
    avatarUrl:     pathOrEmpty,
    showOnHomepage:z.coerce.boolean().default(true),
    color:         z.string().regex(/^#[0-9A-Fa-f]{6}$/, t('admin.masters.invalidHex')).default("#166534"),
  })
}

export type MasterFormState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  success?: boolean
  generatedPassword?: string
}

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
  const t = getServerT()
  const session = await auth()
  if (!session?.user || !["SUPERADMIN", "ADMIN"].includes(session.user.role ?? "")) {
    return { error: t('errors.UNAUTHORIZED') }
  }

  const raw = {
    name:           formData.get("name"),
    email:          formData.get("email"),
    bio:            formData.get("bio") || undefined,
    avatarUrl:      formData.get("avatarUrl") || "",
    showOnHomepage: formData.get("showOnHomepage") === "on" || formData.get("showOnHomepage") === "true",
    color:          formData.get("color") || "#166534",
  }

  const parsed = buildCreateMasterSchema(t).safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  const existing = await prisma.user.findFirst({ where: { email: parsed.data.email } })
  if (existing) {
    return { fieldErrors: { email: [t('admin.masters.emailAlreadyRegistered')] } }
  }

  const plainPassword = generatePassword()
  const hashedPassword = await bcrypt.hash(plainPassword, 10)

  try {
    await prisma.user.create({
      data: {
        name:  parsed.data.name,
        email: parsed.data.email,
        password: hashedPassword,
        passwordEncrypted: encrypt(plainPassword),
        role: "MASTER",
        masterProfile: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          create: {
            bio:           parsed.data.bio ?? null,
            avatarUrl:     parsed.data.avatarUrl || null,
            showOnHomepage:parsed.data.showOnHomepage,
            color:         parsed.data.color,
          } as any,
        },
      },
    })
    revalidatePath("/admin/masters")
    revalidatePath("/")
    return { success: true, generatedPassword: plainPassword }
  } catch {
    return { error: t('admin.masters.createError') }
  }
}

export async function updateMaster(
  id: string,
  _prev: MasterFormState,
  formData: FormData
): Promise<MasterFormState> {
  const t = getServerT()
  const session = await auth()
  if (!session?.user || !["SUPERADMIN", "ADMIN"].includes(session.user.role ?? "")) {
    return { error: t('errors.UNAUTHORIZED') }
  }

  const raw = {
    name:           formData.get("name"),
    bio:            formData.get("bio") || undefined,
    avatarUrl:      formData.get("avatarUrl") || "",
    showOnHomepage: formData.get("showOnHomepage") === "on" || formData.get("showOnHomepage") === "true",
    color:          formData.get("color") || "#166534",
  }

  const parsed = buildUpdateMasterSchema(t).safeParse(raw)
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            create: {
              bio:           parsed.data.bio ?? null,
              avatarUrl:     parsed.data.avatarUrl || null,
              showOnHomepage:parsed.data.showOnHomepage,
              color:         parsed.data.color,
            } as any,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            update: {
              bio:           parsed.data.bio ?? null,
              avatarUrl:     parsed.data.avatarUrl || null,
              showOnHomepage:parsed.data.showOnHomepage,
              color:         parsed.data.color,
            } as any,
          },
        },
      },
    })
    revalidatePath("/admin/masters")
    revalidatePath("/")
    return { success: true }
  } catch {
    return { error: t('admin.masters.updateError') }
  }
}

export async function deleteMaster(id: string): Promise<void> {
  const t = getServerT()
  const session = await auth()
  if (!session?.user || !["SUPERADMIN", "ADMIN"].includes(session.user.role ?? "")) {
    throw new Error(t('errors.UNAUTHORIZED'))
  }

  await prisma.user.delete({ where: { id } })
  revalidatePath("/admin/masters")
  revalidatePath("/")
}

export async function resetMasterPassword(
  id: string,
  newPassword?: string
): Promise<{ success: boolean; newPassword?: string; error?: string }> {
  const t = getServerT()
  const session = await auth()
  if (!session?.user || !["SUPERADMIN", "ADMIN"].includes(session.user.role ?? "")) {
    return { success: false, error: t('errors.UNAUTHORIZED') }
  }

  try {
    const passwordToSet = newPassword || generatePassword()
    const hashedPassword = await bcrypt.hash(passwordToSet, 10)

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword, passwordEncrypted: encrypt(passwordToSet) },
    })

    return { success: true, newPassword: passwordToSet }
  } catch {
    return { success: false, error: t('admin.masters.resetPasswordError') }
  }
}

export async function getMasterPassword(
  masterId: string
): Promise<{ password?: string; error?: string }> {
  const t = getServerT()
  const session = await auth()
  if (!session?.user || !["SUPERADMIN", "ADMIN"].includes(session.user.role ?? "")) {
    return { error: t('errors.UNAUTHORIZED') }
  }
  const user = await prisma.user.findUnique({
    where: { id: masterId },
    select: { passwordEncrypted: true },
  })
  if (!user) return { error: t('admin.masters.masterNotFound') }
  if (!user.passwordEncrypted) {
    return { error: t('admin.masters.noStoredPassword') }
  }
  const password = decrypt(user.passwordEncrypted)
  if (!password) return { error: t('admin.masters.decryptFailed') }
  return { password }
}
