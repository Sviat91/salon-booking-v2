# AGENTS.md — src/app/api

## Purpose

All backend HTTP endpoints (Next.js Route Handlers). Grouped by domain: `admin/` (ADMIN/SUPERADMIN-only management), `master/` (MASTER-only own-data endpoints), `client/` (authenticated client self-service), `consents/` (public GDPR flow), plus top-level booking endpoints (`book`, `bookings`, `availability`, `day`, `procedures`, `masters`).

## Ownership

Request parsing, auth/role checks, and response shaping. Business logic (availability calculation, booking creation, consent evaluation, notifications) must stay in `src/lib/` — route handlers call into it, they don't reimplement it.

## Local Contracts

- Auth checks use `auth()` from `src/auth.ts` inside the handler (no middleware-based API protection) — check `session.user.role` explicitly per handler. `admin/` routes require `ADMIN`/`SUPERADMIN`; fine-grained admin permissions (`clients`, `gdpr` view/edit/delete) go through `src/lib/admin-permissions.ts`, never hand-rolled.
- Validate request bodies with schemas from `src/lib/validation/api-schemas.ts` (Zod) — don't inline ad-hoc validation.
- Errors: prefer `handleApiError()` / `ErrorResponses` from `src/lib/api/error-handler.ts` and `error-responses.ts` for consistent status codes, logging, and Sentry reporting. Some older routes (e.g. `book/route.ts`) still return `NextResponse.json` manually — match the file you're editing, but use the shared handler for new routes.
- Mutations to procedures or schedule data must invalidate both cache layers per `src/lib/cache.ts` (`procedures:v2:<masterId>`, `availability:<masterId>:<dates>`) — see [../../lib/AGENTS.md](../../lib/AGENTS.md).
- `cron/reminders` is invoked by an external scheduler, not a user — don't add session-based auth to it; check its existing token/secret guard before changing.
- Booking mutation routes (`book`, `bookings/update-time`, `bookings/[id]`) wrap their conflict re-check + write in a single `prisma.$transaction` to close the double-booking race window — there is no DB-level uniqueness constraint (an overlapping-range conflict check can't be expressed as a unique index). Guest/client ownership verification across all booking routes (`cancel`, `update-time`, `update-procedure`, `bookings/[id]`, `bookings/all`) is full-E.164 phone comparison via `phonesMatchE164()`, not last-9-digits.
- `bookings/[id]/check-extension`'s `can_shift_back` result includes both `reason` (a Polish dev-diagnostic string) and `reasonCode` (`'NEXT_BOOKING_CONFLICT' | 'OUTSIDE_WORKING_HOURS'`) — the client (`EditProcedurePanel.tsx`) switches on `reasonCode` for i18n, never on `reason`. Add new codes to this union (both here and in `src/components/booking-management/types.ts`'s `ExtensionCheckResult`) rather than reintroducing string-matching on `reason`.
- `master/availability/{slots,days}` and `admin/calendar/availability/{slots,days}` are thin authed wrappers over `src/lib/availability.ts`'s `getDaySlots()`/`getAvailableDays()`, used by the admin/master calendar's manual appointment form (`AppointmentTimeSelect.tsx`/`AppointmentDateSelect.tsx`) — auth `MASTER` (own `session.user.id`) or `ADMIN`/`SUPERADMIN` (required `masterId` query param) respectively; each route validates its date param(s) and returns an empty result (`{ slots: [] }`/`{ days: [] }`) on error rather than a 500.
- `GET /api/admin/calendar/services` accepts an optional `masterId` query param and `GET /api/master/services` always scopes to the session master (no param) — both resolve the master's actually-offered services via the `MasterService` join (`MasterProfile.findUnique` by `userId` → `masterService.findMany` with `include: { service: true }`), falling back to `Service.findMany({ where: { OR: [{ masterId: null }, { masterId }] } })` when no `MasterService` rows exist. Same lookup pattern as `GET /api/procedures?masterId=`, but authed and returning full `{ services: Service[] }` (not `/api/procedures`'s public `{ items }` shape). Used by the admin/master calendar's `AppointmentModal.tsx` to filter the service dropdown per selected master. The admin/master calendar POST routes (`admin/calendar/appointments`, `master/appointments`) resolve a service per `entries[]` item instead of once per request — each entry may carry its own `serviceId` or `serviceName` (creating a separate custom `Service` row per custom entry); the PUT routes (`.../appointments/[id]`) are unchanged and still resolve one top-level service.
- `admin/notification-settings/recipients/route.ts` (`GET`/`POST`) and `admin/notification-settings/recipients/[id]/route.ts` (`DELETE`) are the CRUD endpoints for the `TelegramNotificationRecipient` list (ADMIN/SUPERADMIN-gated like the sibling `admin/notification-settings/route.ts`), replacing the old single `TenantConfig.notifAdminChatId` field.
- Appointment create/cancel/update routes across `admin/calendar/appointments`, `master/appointments`, `client/appointments`, and the top-level `bookings/*` endpoints (including `bookings/update-procedure`, which now also notifies on a service-only change) all fire a `src/lib/notifications/index.ts` notifier (`notifyBookingConfirmation`/`notifyBookingCancellation`/`notifyBookingUpdate`) fire-and-forget (`.catch(console.error)`, never awaited) after their own DB write, each passing a required `actor: 'client' | 'master' | 'admin'` matching the route's auth gate — hard-delete cancellation routes must fetch/pass the appointment snapshot *before* deleting it. Update routes (`admin/calendar/appointments/[id]` PUT, `master/appointments/[id]` PUT, `client/appointments/[id]` PATCH, `bookings/[id]` PATCH, `bookings/update-time`, `bookings/update-procedure`) fire `notifyBookingUpdate` **unconditionally** after the write commits, passing the pre-update snapshot (`{ date, startTime, serviceId, serviceName }`, service name from `name_pl`) as `previous` — the notifier itself diffs against the fresh post-update state and no-ops if nothing actually changed. See [../../lib/AGENTS.md](../../lib/AGENTS.md) for the notifier contract.

## Work Guidance

- One `route.ts` per endpoint, HTTP-method-named exports (`GET`, `POST`, etc.) — do not add non-standard exports.
- `export const runtime = "nodejs"` where the handler needs Node APIs (Prisma, bcrypt) not available on the edge runtime.

## Verification

- `npm run test` — route-level tests live in `tests/app/api/` mirroring this tree, see [../../../tests/AGENTS.md](../../../tests/AGENTS.md).
- Any route handler that imports `@/auth` needs `vi.mock('@/auth', () => ({ auth: vi.fn().mockResolvedValue(null) }))` in its test file (targets the guest path) — otherwise Vitest's `node` environment fails to resolve next-auth's internal `next/server` import.
- `npm run lint` (zero warnings).
