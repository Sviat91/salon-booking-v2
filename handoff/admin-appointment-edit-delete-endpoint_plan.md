# Plan: Add missing PUT/DELETE endpoints for admin appointment editing

**Date:** 2026-07-21
**Status:** Implemented — awaiting manual verification

## Root cause
The admin calendar's `AppointmentModal.tsx` (`handleSave`) sends `PUT ${apiPrefix}/appointments/${id}` when editing (`apiPrefix = "/api/admin/calendar"`), and `ModernCalendar.tsx`'s delete handler sends `DELETE ${apiPrefix}/appointments/${id}`. Neither route exists: `src/app/api/admin/calendar/appointments/` only has `route.ts` (GET list + POST create) — there is no `[id]/route.ts`. Previously the Save button was permanently disabled by the master-prefill bug (just fixed), which masked this: now that Save is clickable, the PUT 404s and the user sees "Не вдалося створити запис".

A working, directly analogous pair of handlers already exists at `src/app/api/master/appointments/[id]/route.ts` (PUT + DELETE + an unrelated PATCH for master-self-cancel — PATCH is not needed here, the admin UI never calls it). This plan mirrors that file's PUT/DELETE logic for the admin surface, swapping the auth/ownership model.

## Steps

- [x] Step 1: Create `src/app/api/admin/calendar/appointments/[id]/route.ts` with `PUT` and `DELETE` handlers (no `PATCH`).
  - `export const runtime = "nodejs"` at the top (matches sibling routes).
  - **Auth (both handlers):** `const session = await auth(); if (!session?.user || (session.user.role !== "SUPERADMIN" && session.user.role !== "ADMIN")) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })` — this is the SAME check already used in `src/app/api/admin/calendar/appointments/route.ts` (the sibling collection route) — copy it verbatim, do NOT use the master route's `role !== "MASTER"` check.
  - **No ownership check** — unlike the master route's `if (appointment.masterId !== session.user.id) return 403`, admin can edit/delete ANY appointment regardless of which master it belongs to. Omit that check entirely.

  - **`PUT` handler** — mirror `src/app/api/master/appointments/[id]/route.ts`'s `PUT` (lines 119-191) with these differences:
    1. Auth as above (no ownership check).
    2. `const { entries, serviceId, serviceName, clientId, clientName, clientPhone, notes, masterId } = data` — read `masterId` too (the admin form's payload includes it — see `AppointmentModal.tsx:112`, `masterId: isAdminView ? formMasterId : undefined`).
    3. **Important correctness fix vs. the master version:** when creating a custom service (`serviceId === "custom" && serviceName`), the master route uses `masterId: session.user.id` for the new `Service` row (correct there, because the master IS the service owner). For the admin route, `session.user.id` is the ADMIN's own user id, NOT a master — using it would attach the new service to a non-master account. Instead use the appointment's actual master: `const finalMasterId = masterId || appointment.masterId` (fall back to the existing appointment's `masterId` if the payload didn't include one), and use `masterId: finalMasterId` when creating the custom `Service`.
    4. In the final `prisma.appointment.update(...)` call, include `masterId: finalMasterId` in the `data` object alongside the existing fields (`date`, `startTime`, `endTime`, `serviceId`, `clientId`, `notes`) — this makes the endpoint correctly persist the master even though the frontend currently keeps that field locked to its original value (the `<Select disabled={mode === "edit"}>` in `AppointmentModal.tsx`), so nothing changes in practice today, but the endpoint is not silently dropping a field the frontend sends.
    5. Keep the rest identical: `entries[0]` destructuring for `date`/`startTime`/`duration`, the `endTime` computation, the custom-client creation block (`clientId === "custom" && clientName`, unchanged — no master-id concern there), the try/catch returning `{ error: "Failed to update appointment" }` with status 500 on failure.
    6. Return `NextResponse.json({ appointment: updated })` on success, matching the master route's response shape.

  - **`DELETE` handler** — mirror `src/app/api/master/appointments/[id]/route.ts`'s `DELETE` (lines 76-113) with these differences:
    1. Auth as above (no ownership check) — skip the `appointment.masterId !== session.user.id` check entirely.
    2. The frontend may append a `?masterId=...` query string (`ModernCalendar.tsx`'s `onDelete`) — this is NOT needed for authorization (admin already has full rights) and can be safely ignored; do not add logic that reads or validates it.
    3. Keep the rest identical: `findUnique` → 404 if missing → `prisma.appointment.delete({ where: { id } })` → `NextResponse.json({ success: true })`, try/catch returning `{ error: "Failed to delete appointment" }` with status 500 on failure.

- [x] Step 2: Run `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`.

## Constraints
- Do NOT touch `src/app/api/master/appointments/[id]/route.ts` or `src/app/api/admin/calendar/appointments/route.ts` (the collection GET/POST) — this plan only ADDS the missing `[id]/route.ts` file.
- Do NOT change the frontend (`AppointmentModal.tsx`, `ModernCalendar.tsx`) — their requests are already correctly shaped for this endpoint; no frontend changes needed.
- Do NOT enable master reassignment in the UI (the `<Select disabled={mode === "edit"}>` stays as-is) — this plan only makes the backend correctly handle a `masterId` field if/when it's present in the payload, it does not add a way for the admin to actually change it via the form. That's a separate, not-yet-requested feature.
- No schema/migration changes.

## Manual verification (user)
1. Restart/refresh the admin calendar.
2. Edit an existing appointment (change date/time or notes) → Save. Should succeed (no more "Не вдалося створити запис").
3. Confirm the appointment updates in the calendar with the new date/time.
4. Try deleting an appointment via the calendar's delete action → should succeed.
5. Re-run the earlier Telegram-reminder cron test now that you can actually move an appointment into the 24h/2h window.
