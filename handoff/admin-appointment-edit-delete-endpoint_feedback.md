# Review: admin-appointment-edit-delete-endpoint
**Date:** 2026-07-21
**Verdict:** APPROVED

## Critical/Architectural Issues
None found.

## Minor/Syntax Issues
None found.

## Passed Checks
- [x] **Auth (both PUT and DELETE)**: Uses `session.user.role !== "SUPERADMIN" && session.user.role !== "ADMIN"` → 401, byte-for-byte matching the sibling collection route (`src/app/api/admin/calendar/appointments/route.ts`), not the master route's `role !== "MASTER"` check.
- [x] **No ownership check**: Neither handler contains the master route's `appointment.masterId !== session.user.id` → 403 check. Admin can act on any appointment.
- [x] **masterId-for-custom-service fix**: `const finalMasterId = masterId || appointment.masterId` computed from the request payload with correct fallback to the existing appointment's master, used when creating the custom `Service` — correctly avoids using the admin's own `session.user.id`.
- [x] **Final `appointment.update`**: Includes `masterId: finalMasterId` alongside `date`, `startTime`, `endTime`, `serviceId`, `clientId`, `notes`.
- [x] **DELETE handler**: Ignores query params entirely, does `findUnique` → 404 if missing → `delete` → `{ success: true }`, matching the master route's DELETE pattern minus the ownership check.
- [x] **No PATCH handler** added — file only exports `DELETE` and `PUT`.
- [x] **Untouched files**: `src/app/api/master/appointments/[id]/route.ts` and the collection route `src/app/api/admin/calendar/appointments/route.ts` unmodified; no frontend files touched.
- [x] **Response shapes**: PUT returns `{ appointment: updated }`, DELETE returns `{ success: true }` — matches master route shapes and what frontend consumers expect.
- [x] `export const runtime = "nodejs"` present.
- [x] **General correctness**: `entries[0]` destructuring, `endTime` computation, custom-client creation block identical to the working master-route pattern with no unsafe deviations. Try/catch mirrors master route's error handling.

## Summary
The implementation faithfully mirrors the master route's PUT/DELETE business logic while correctly swapping in the admin-appropriate auth check and omitting the ownership check as intended. The critical correctness fix — deriving `finalMasterId` from the payload with a fallback to the existing appointment's `masterId`, rather than using the admin's own `session.user.id` for the custom-service `masterId` field — was implemented exactly as specified and used consistently. No unrelated files modified. No issues found; approved as-is.
