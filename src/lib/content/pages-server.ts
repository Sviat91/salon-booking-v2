/**
 * Server-side (Prisma-backed) data access for the content pages feature.
 * No `"use client"`, no `NextRequest`/`NextResponse` — see `src/lib/AGENTS.md`.
 */
import prisma from '@/lib/prisma'
import { parseBlockSlot, type BlockSlot } from './blocks'
import { parseVisibility, type NavPage, type PageOwner } from './pages-shared'

/**
 * Row-targeted authorization (update/delete/toggle/block actions/reorderBlocks):
 * the row itself carries its real owner, so nothing has to be supplied by the
 * client — the session is authorized *against the row*, never against a
 * client-supplied scope (AD-5). ADMIN/SUPERADMIN may manage any row,
 * including master-owned ones (the deliberate widening this feature adds);
 * MASTER only their own.
 */
export function canManagePage(
  user: { id?: string; role?: string } | null | undefined,
  page: { ownerType: string; masterId: string | null }
): boolean {
  if (!user) return false
  if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') return true
  if (user.role === 'MASTER') {
    return !!user.id && page.ownerType === 'master' && page.masterId === user.id
  }
  return false
}

/**
 * Authorizes a client-*requested* scope for the two actions that have no row
 * to derive a scope from (`createPage`, `reorderPages`) — the requested scope
 * is authorized against the session, never trusted as-is (AD-5). Returns a
 * freshly constructed scope (never the caller's `requested` object) or
 * `null` when the session isn't allowed to act in that scope.
 */
export async function authorizePageOwner(
  user: { id?: string; role?: string } | null | undefined,
  requested: PageOwner
): Promise<PageOwner | null> {
  if (!user) return null

  if (requested.ownerType === 'global') {
    if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') {
      return { ownerType: 'global', masterId: null }
    }
    return null
  }

  // requested.ownerType === 'master'
  if (user.role === 'MASTER') {
    return user.id === requested.masterId
      ? { ownerType: 'master', masterId: requested.masterId }
      : null
  }
  if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') {
    const target = await prisma.user.findUnique({
      where: { id: requested.masterId },
      select: { role: true },
    })
    return target?.role === 'MASTER' ? { ownerType: 'master', masterId: requested.masterId } : null
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
