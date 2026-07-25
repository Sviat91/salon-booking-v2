/**
 * Server-side (Prisma-backed) data access for the content pages feature.
 * No `"use client"`, no `NextRequest`/`NextResponse` — see `src/lib/AGENTS.md`.
 */
import prisma from '@/lib/prisma'
import { parseBlockSlot, type BlockSlot } from './blocks'
import { parseVisibility, type NavPage } from './pages-shared'

export type PageOwner =
  | { ownerType: 'global'; masterId: null }
  | { ownerType: 'master'; masterId: string }

/**
 * Derives the owner scope a session's role is allowed to manage — never
 * trust an owner scope supplied by the client (AD-5). Returns `null` for any
 * role that isn't ADMIN/SUPERADMIN/MASTER.
 */
export function resolvePageOwner(
  user: { id?: string; role?: string } | null | undefined
): PageOwner | null {
  if (!user) return null
  if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') {
    return { ownerType: 'global', masterId: null }
  }
  if (user.role === 'MASTER' && user.id) {
    return { ownerType: 'master', masterId: user.id }
  }
  return null
}

/**
 * SQLite treats NULLs as distinct, so the `@@unique([ownerType, masterId, slug])`
 * constraint does not prevent two `ownerType='global'` rows from sharing a slug
 * (AD-3) — this is the real uniqueness guard, called on every create.
 */
export async function generateUniqueSlug(
  base: string,
  ownerType: string,
  masterId: string | null
): Promise<string> {
  const existing = await prisma.page.findMany({
    where: { ownerType, masterId },
    select: { slug: true },
  })
  const taken = new Set(existing.map((p) => p.slug))
  if (!taken.has(base)) return base
  let i = 2
  while (taken.has(`${base}-${i}`)) i++
  return `${base}-${i}`
}

/**
 * Pages eligible for the top nav line: global pages visible on the requested
 * surface (`home` when `masterId` is omitted, `booking` when given), followed
 * by that master's own enabled pages when `masterId` is given.
 */
export async function getNavPages(masterId?: string): Promise<NavPage[]> {
  const globalPages = await prisma.page.findMany({
    where: { ownerType: 'global', enabled: true },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  })
  const target = masterId ? 'booking' : 'home'
  const globalNav: NavPage[] = globalPages
    .filter((p) => parseVisibility(p.visibility).includes(target))
    .map((p) => ({
      id: p.id,
      slug: p.slug,
      href: `/pages/${p.slug}`,
      title_pl: p.title_pl,
      title_en: p.title_en,
      title_uk: p.title_uk,
    }))

  if (!masterId) return globalNav

  const masterPages = await prisma.page.findMany({
    where: { ownerType: 'master', masterId, enabled: true },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  })
  const masterNav: NavPage[] = masterPages.map((p) => ({
    id: p.id,
    slug: p.slug,
    href: `/${masterId}/pages/${p.slug}`,
    title_pl: p.title_pl,
    title_en: p.title_en,
    title_uk: p.title_uk,
  }))

  return [...globalNav, ...masterNav]
}

/** Public page read: `null` when missing OR disabled. */
export async function getPageWithBlocks(args: {
  ownerType: 'global' | 'master'
  masterId?: string | null
  slug: string
}) {
  const page = await prisma.page.findFirst({
    where: {
      ownerType: args.ownerType,
      masterId: args.ownerType === 'master' ? args.masterId ?? null : null,
      slug: args.slug,
    },
  })
  if (!page || !page.enabled) return null

  const blocks = await prisma.block.findMany({
    where: { pageId: page.id },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  })

  return { page, blocks }
}

/** Pages + their blocks for the admin/master content-management screens. */
export async function listPagesForOwner(owner: PageOwner) {
  return prisma.page.findMany({
    where: { ownerType: owner.ownerType, masterId: owner.masterId },
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
    include: {
      blocks: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
    },
  })
}

export async function getMasterFooterSlot(masterId: string): Promise<BlockSlot | null> {
  const profile = await prisma.masterProfile.findUnique({
    where: { userId: masterId },
    select: { footerBlock: true },
  })
  return parseBlockSlot(profile?.footerBlock ?? null)
}
