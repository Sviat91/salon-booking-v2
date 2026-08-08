# Plan: cache `getTenantConfig()` to fix site-wide slow-page-load-under-load

## Root cause (confirmed by reading code)

`getTenantConfig()` (`src/lib/tenant.ts`) does `prisma.tenantConfig.findFirst()`
on every single call with zero caching. It's imported and awaited from
`src/app/layout.tsx` — the ROOT layout wrapping every route — plus `page.tsx`,
`opengraph-image.tsx`, `terms/page.tsx`, `privacy/page.tsx`,
`[masterId]/layout.tsx`, and ~15 admin pages/actions. That means every
concurrent request to *any* page does its own uncached DB round-trip for the
same singleton row. Confirmed via an `autocannon -c 20 -d 20` load test
against the live test domain: `/` (goes through this path) had p99 ~9.5s,
~4 req/sec, while `/api/procedures` (already Redis-cached) had p99 ~1.7s,
~35 req/sec under identical load.

The `noStore()` call at the top of `getTenantConfig()` is unrelated to this
fix (it only affects Next.js's static-vs-dynamic rendering decision for the
calling route) — do not touch it, do not remove it.

## Fix

### 1. `src/lib/tenant.ts`
- Import `cacheGet`, `cacheSet`, `cacheDel` from `@/lib/cache` (same module
  already used for procedures/availability caching elsewhere in the repo).
- Define a module-level constant `const TENANT_CONFIG_CACHE_KEY = 'tenant:config'`
  and `const TENANT_CONFIG_CACHE_TTL_SEC = 30`.
- In `getTenantConfig()`, right after `noStore()`, try
  `const cached = await cacheGet<typeof DEFAULT_CONFIG>(TENANT_CONFIG_CACHE_KEY)`
  — if truthy, `return cached` immediately (skip the DB call entirely).
- On a cache miss, keep the existing try/catch body exactly as-is (findFirst
  → auto-seed create → catch-fallback to `DEFAULT_CONFIG`), but before each
  `return` of a real DB row (both the `if (config)` branch and the
  auto-seeded `newConfig` branch), call
  `await cacheSet(TENANT_CONFIG_CACHE_KEY, config, TENANT_CONFIG_CACHE_TTL_SEC)`
  (or `newConfig`) before returning it. Do NOT cache the `DEFAULT_CONFIG`
  fallback in the `catch` block — that path means the DB was unavailable,
  caching a fallback would paper over a real outage for 30s.
- Export a new function:
  ```ts
  export async function invalidateTenantConfigCache() {
    await cacheDel(TENANT_CONFIG_CACHE_KEY)
  }
  ```
  This is the only thing the 6 write call sites below need to import and
  call — they must not construct the cache key string themselves.

### 2. Call `invalidateTenantConfigCache()` after every successful TenantConfig write

All 6 files already `import prisma from "@/lib/prisma"` — add
`import { invalidateTenantConfigCache } from "@/lib/tenant"` to each, and
call `await invalidateTenantConfigCache()` immediately after the awaited
`prisma.tenantConfig.update(...)` call succeeds (same statement position/
scope, right after the existing `await prisma.tenantConfig.update(...)` line
— not inside a try/catch that could skip it, not before the write, not
inside an `if` branch that might not run on every successful save):

- `src/app/admin/settings/actions.ts:165`
- `src/app/admin/settings/legal/actions.ts:74`
- `src/app/api/admin/notification-settings/route.ts:53`
- `src/app/api/admin/social-settings/route.ts:62`
- `src/app/api/admin/email-settings/route.ts:47`
- `src/app/api/admin/client-bot-settings/route.ts:51`

Read each file's surrounding function fully before editing — some of these
`update` calls are inside conditional branches (`if (existing) { update }
else { create }`-style patterns per the `where: { id: existing.id }` pattern
seen in the grep) — make sure invalidation fires after BOTH the create path
and the update path if both exist in a given file, not just the update
branch. Check each file individually rather than assuming they're identical.

## Out of scope
- Do not change `noStore()`.
- Do not add caching to any other model/route.
- Do not change the TTL/cache design of the existing `procedures`/
  `availability` caches.
- Do not change the shape of what `getTenantConfig()` returns (still the
  same object shape either way, cached or not) — no caller outside
  `tenant.ts` needs to change.

## Tests

Add `tests/lib/tenant.test.ts` (no existing test file for this module):
mock `@/lib/cache` (`cacheGet`/`cacheSet`/`cacheDel`) and `@/lib/prisma`
(`tenantConfig.findFirst`/`create`), covering:
- cache hit: `cacheGet` returns a config → `prisma.tenantConfig.findFirst`
  is never called, the cached value is returned as-is.
- cache miss + DB has a row: `findFirst` is called, `cacheSet` is called
  with the DB row and the 30s TTL, the DB row is returned.
- cache miss + DB has no row (auto-seed path): `findFirst` returns null,
  `create` is called, `cacheSet` is called with the newly-created row, the
  new row is returned.
- DB throws (both `findFirst` and any subsequent call reject): `cacheSet` is
  NOT called, `DEFAULT_CONFIG`-shaped object is returned (match on a couple
  of representative fields, not the whole object).
- `invalidateTenantConfigCache()` calls `cacheDel('tenant:config')` exactly.

## Verify
- `npx vitest run tests/lib/tenant.test.ts` passes.
- `npm run lint` clean on all touched files.
- `npx tsc --noEmit` clean.
- Grep to confirm no other file constructs the raw string `'tenant:config'`
  itself (should only exist inside `tenant.ts`).
