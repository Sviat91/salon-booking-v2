"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import prisma from "@/lib/prisma"

const ServiceSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  duration: z.coerce.number().int().min(5, "Minimum 5 minutes").max(480),
  price: z.coerce.number().min(0, "Price must be positive"),
})

export type ServiceFormState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  success?: boolean
}

export async function createService(
  _prev: ServiceFormState,
  formData: FormData
): Promise<ServiceFormState> {
  const raw = {
    name: formData.get("name"),
    duration: formData.get("duration"),
    price: formData.get("price"),
  }

  const parsed = ServiceSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  try {
    await prisma.service.create({ data: parsed.data })
    revalidatePath("/admin/services")
    return { success: true }
  } catch {
    return { error: "Failed to create service. Please try again." }
  }
}

export async function updateService(
  id: string,
  _prev: ServiceFormState,
  formData: FormData
): Promise<ServiceFormState> {
  const raw = {
    name: formData.get("name"),
    duration: formData.get("duration"),
    price: formData.get("price"),
  }

  const parsed = ServiceSchema.safeParse(raw)
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors }
  }

  try {
    await prisma.service.update({ where: { id }, data: parsed.data })
    revalidatePath("/admin/services")
    return { success: true }
  } catch {
    return { error: "Failed to update service. Please try again." }
  }
}

export async function deleteService(id: string): Promise<void> {
  await prisma.service.delete({ where: { id } })
  revalidatePath("/admin/services")
}
