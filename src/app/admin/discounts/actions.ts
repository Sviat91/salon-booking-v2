"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"
import { auth } from "@/auth"
import prisma from "@/lib/prisma"
import { getServerT } from "@/lib/i18n-server"
import { authorizeDiscountScope, canManageDiscount, listMasterOfferedServiceIds } from "@/lib/discounts/server"
import { normalizeDiscountCode, serializeWindowDays, serializeWindowIntervals, type DiscountOwner } from "@/lib/discounts/shared"

export type DiscountFormState = {
  error?: string
  fieldErrors?: Record<string, string[]>
  success?: boolean
}

function revalidateAll() {
  revalidatePath("/admin/discounts")
  revalidatePath("/admin/master/discounts")
}

function buildDiscountSchema(t: (key: string) => string) {
  return z
    .object({
      label: z.string().trim().min(1, t('admin.discounts.labelRequired')).max(100),
      percent: z.coerce.number().int().min(1).max(100),
      requiresCode: z.boolean(),
      oncePerClient: z.boolean(),
      active: z.boolean(),
      code: z.string().trim().optional(),
      startDateRaw: z.string().optional(),
      endDateRaw: z.string().optional(),
      windowEnabled: z.boolean(),
      windowDays: z.array(z.number().int().min(0).max(6)),
      windowStart: z.string().optional(),
      windowEnd: z.string().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.requiresCode) {
        const normalized = normalizeDiscountCode(data.code)
        if (!normalized || !/^[A-Z0-9-]{1,32}$/.test(normalized)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['code'], message: t('admin.discounts.codeFormat') })
        }
      }
      if (data.startDateRaw && data.endDateRaw) {
        const start = new Date(`${data.startDateRaw}T00:00:00`)
        const end = new Date(`${data.endDateRaw}T23:59:59`)
        if (end < start) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDateRaw'], message: t('admin.discounts.dateRangeInvalid') })
        }
      }
      if (data.windowEnabled) {
        const hasValidRange = Boolean(data.windowStart) && Boolean(data.windowEnd) && data.windowStart! < data.windowEnd!
        if (data.windowDays.length === 0 || !hasValidRange) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['windowEnabled'], message: t('admin.discounts.windowInvalid') })
        }
      }
    })
}

type ParsedDiscountInput = z.infer<ReturnType<typeof buildDiscountSchema>>

const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6]

function parseFormInput(formData: FormData) {
  return {
    label: formData.get('label'),
    percent: formData.get('percent'),
    requiresCode: formData.get('requiresCode') === 'on',
    oncePerClient: formData.get('oncePerClient') === 'on',
    active: formData.get('active') === 'on',
    code: (formData.get('code') as string) || undefined,
    startDateRaw: (formData.get('startDate') as string) || undefined,
    endDateRaw: (formData.get('endDate') as string) || undefined,
    windowEnabled: formData.get('windowEnabled') === 'on',
    windowDays: WEEKDAYS.filter((d) => formData.get(`day_${d}`) === 'on'),
    windowStart: (formData.get('windowStart') as string) || undefined,
    windowEnd: (formData.get('windowEnd') as string) || undefined,
  }
}

/**
 * Radio `scopeMode` = "all" | "selected". When "selected", collect keys
 * matching `service_<id>` (same `parseMasterAssignments` idiom as
 * `services/actions.ts:44-60`).
 */
function parseServiceScope(formData: FormData): { scopeMode: 'all' | 'selected'; serviceIds: string[] } {
  const scopeMode = formData.get('scopeMode') === 'selected' ? 'selected' : 'all'
  const serviceIds: string[] = []
  if (scopeMode === 'selected') {
    for (const [key] of formData.entries()) {
      if (key.startsWith('service_')) serviceIds.push(key.slice('service_'.length))
    }
  }
  return { scopeMode, serviceIds }
}

/**
 * Builds the scalar Discount fields common to create and update. Deliberately
 * never includes `masterId` — `createDiscount` sets it explicitly from the
 * authorized owner, and `updateDiscount` must never allow changing it.
 */
function buildDiscountData(data: ParsedDiscountInput) {
  const code = data.requiresCode ? normalizeDiscountCode(data.code) : null
  const windowDays = data.windowEnabled ? data.windowDays : []
  const windowIntervals =
    data.windowEnabled && data.windowStart && data.windowEnd
      ? [{ start: data.windowStart, end: data.windowEnd }]
      : []

  return {
    label: data.label,
    percent: data.percent,
    requiresCode: data.requiresCode,
    code,
    oncePerClient: data.oncePerClient,
    windowDays: serializeWindowDays(windowDays),
    windowIntervals: serializeWindowIntervals(windowIntervals),
    startDate: data.startDateRaw ? new Date(`${data.startDateRaw}T00:00:00`) : null,
    endDate: data.endDateRaw ? new Date(`${data.endDateRaw}T23:59:59`) : null,
    active: data.active,
  }
}

function isUniqueConstraintError(e: unknown): boolean {
  return typeof e === 'object' && e !== null && (e as { code?: string }).code === 'P2002'
}

/**
 * `requestedOwner` is a required leading parameter so a forgotten argument is
 * a `tsc` error, never a silent global write (AD-8 discipline).
 */
export async function createDiscount(
  requestedOwner: DiscountOwner,
  _prev: DiscountFormState,
  formData: FormData
): Promise<DiscountFormState> {
  const t = getServerT()
  const session = await auth()
  const owner = await authorizeDiscountScope(session?.user, requestedOwner)
  if (!owner) return { error: t('errors.UNAUTHORIZED') }

  const parsed = buildDiscountSchema(t).safeParse(parseFormInput(formData))
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }

  const { scopeMode, serviceIds } = parseServiceScope(formData)
  // Server-side re-verification (never trust the client's checkbox list).
  if (owner.ownerType === 'master' && scopeMode === 'selected') {
    const offered = await listMasterOfferedServiceIds(owner.masterId)
    if (!serviceIds.every((id) => offered.has(id))) {
      return { error: t('errors.FORBIDDEN') }
    }
  }

  const data = { ...buildDiscountData(parsed.data), masterId: owner.masterId }

  try {
    await prisma.$transaction(async (tx) => {
      const discount = await tx.discount.create({ data })
      if (scopeMode === 'selected' && serviceIds.length > 0) {
        await tx.discountService.createMany({
          data: serviceIds.map((serviceId) => ({ discountId: discount.id, serviceId })),
        })
      }
    })
    revalidateAll()
    return { success: true }
  } catch (e) {
    if (isUniqueConstraintError(e)) return { fieldErrors: { code: [t('admin.discounts.codeTaken')] } }
    return { error: t('admin.discounts.createError') }
  }
}

/** Row-targeted: authorizes against the row's real owner, never a client-supplied scope. Never allows changing `masterId`. */
export async function updateDiscount(
  id: string,
  _prev: DiscountFormState,
  formData: FormData
): Promise<DiscountFormState> {
  const t = getServerT()
  const session = await auth()
  const existing = await prisma.discount.findUnique({ where: { id } })
  if (!existing || !canManageDiscount(session?.user, existing)) {
    return { error: t('errors.UNAUTHORIZED') }
  }

  const parsed = buildDiscountSchema(t).safeParse(parseFormInput(formData))
  if (!parsed.success) return { fieldErrors: parsed.error.flatten().fieldErrors }

  const { scopeMode, serviceIds } = parseServiceScope(formData)
  if (existing.masterId && scopeMode === 'selected') {
    const offered = await listMasterOfferedServiceIds(existing.masterId)
    if (!serviceIds.every((sid) => offered.has(sid))) {
      return { error: t('errors.FORBIDDEN') }
    }
  }

  const updateData = buildDiscountData(parsed.data)

  try {
    await prisma.$transaction(async (tx) => {
      await tx.discount.update({ where: { id }, data: updateData })
      await tx.discountService.deleteMany({ where: { discountId: id } })
      if (scopeMode === 'selected' && serviceIds.length > 0) {
        await tx.discountService.createMany({
          data: serviceIds.map((serviceId) => ({ discountId: id, serviceId })),
        })
      }
    })
    revalidateAll()
    return { success: true }
  } catch (e) {
    if (isUniqueConstraintError(e)) return { fieldErrors: { code: [t('admin.discounts.codeTaken')] } }
    return { error: t('admin.discounts.updateError') }
  }
}

async function verifyDiscountOwnership(id: string) {
  const t = getServerT()
  const session = await auth()
  const discount = await prisma.discount.findUnique({ where: { id } })
  if (!discount || !canManageDiscount(session?.user, discount)) throw new Error(t('errors.UNAUTHORIZED'))
  return discount
}

export async function deleteDiscount(id: string): Promise<void> {
  await verifyDiscountOwnership(id)
  // DiscountService/DiscountRedemption rows cascade via the FK; Appointment.discountId is SetNull.
  await prisma.discount.delete({ where: { id } })
  revalidateAll()
}

export async function toggleDiscountActive(id: string, active: boolean): Promise<void> {
  await verifyDiscountOwnership(id)
  await prisma.discount.update({ where: { id }, data: { active } })
  revalidateAll()
}
