// Default brand-name fallback used when no tenant brand name is configured yet.
// Zero imports on purpose: must be safely importable from both server-only
// code (e.g. tenant.ts, which imports Prisma) and client components.
export const DEFAULT_BRAND_NAME = 'Salon'
