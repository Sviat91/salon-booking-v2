# Plan: Priority 1 security fixes (ROADMAP.md items 1, 2, 3)

Source: `ROADMAP.md` 🔴 Приоритет 1. Item 4 (Turnstile on `/api/book`) is explicitly deferred by the user — do not touch `/api/book`.

## Context (already verified by orchestrator — do not re-derive, just implement)

- **Item 1**: `src/app/api/debug-db/route.ts` is a fully public `GET` handler with zero auth that dumps a real master's ID + all schedules/overrides. Confirmed zero importers/callers anywhere (it's a standalone debug route, not linked from any UI).
- **Item 2**: `PATCH /api/bookings/[id]` has no ownership check at all — anyone who learns an `eventId` can change its time/procedure. Sibling routes (`src/app/api/bookings/update-time/route.ts`, `update-procedure/route.ts`, `cancel/route.ts`) all verify ownership via "phone, last 9 digits must match the appointment's client phone" before mutating. This route must adopt the exact same pattern.
- **Item 3**: `GET /api/client/appointments?phone=` (the base `route.ts`, NOT the `[id]/route.ts` sibling) is fully public, requires only an exact phone match (no name check, no rate limit) and dumps a client's entire appointment history. Verified via repo-wide grep: **zero callers anywhere in the frontend**. Its functionality is fully superseded by the session-authenticated `GET /api/client/profile` (used by `src/app/profile/page.tsx`) and `src/app/api/client/appointments/[id]/route.ts` (session-authenticated PATCH/DELETE, already correct — do not touch that file). This is dead code and a live PII leak simultaneously — delete it rather than patch it.

## Steps

- [x] **Step 1 — delete `src/app/api/debug-db/route.ts`.**
      Verify first with `grep -rn "debug-db" src` that nothing references it (should be empty/only the route file itself). Delete the file (and the now-empty `src/app/api/debug-db/` directory if `debug-db` contains only this one file).

- [x] **Step 2 — delete `src/app/api/client/appointments/route.ts`.**
      Verify first with `grep -rn "api/client/appointments'" src`, `grep -rn "api/client/appointments\`" src`, and `grep -rn "fetch(\"/api/client/appointments\"" src` (and similar variants) that nothing outside this file itself calls the base collection route (no `?phone=` query usage anywhere). Do **not** touch `src/app/api/client/appointments/[id]/route.ts` — that's a separate, already-secure, actively-used file (session auth, `PATCH`/`DELETE`). Delete only the base `route.ts`.

- [x] **Step 3 — add ownership verification to `src/app/api/bookings/[id]/route.ts`.**
      Mirror the exact pattern already in `src/app/api/bookings/update-time/route.ts` (read it for reference — phone digit extraction at its top, ownership check right after the `ALREADY_CANCELLED` check). Specifically, in `src/app/api/bookings/[id]/route.ts`:
      1. Add `phone?: string` to the request body type.
      2. In the initial required-params check (`if (!newProcedureId && !newStartISO)`), also require `phone`: return 400 `{ error: "phone is required", code: "MISSING_PARAMS" }` if `phone` is missing. Validate it has at least 9 digits after stripping non-digits (`phone.replace(/\D/g, "")`), same 400 pattern as `update-time.ts` (`code: "INVALID_PHONE"`) if not.
      3. In the `prisma.appointment.findUnique` call, add `client: { select: { phone: true } }` to the `include` (alongside the existing `service: { select: { name: true } }`).
      4. Immediately after the existing `ALREADY_CANCELLED` check (before building `updateData`), add the ownership check: compare `appointment.client.phone` (last 9 digits) against the request's `phone` (last 9 digits), exactly as in `update-time.ts`. On mismatch, return 403 `{ error: "Weryfikacja nie powiodła się. Sprawdź poprawność danych.", code: "VERIFICATION_FAILED" }`.
      Do **not** add a 24h-before-appointment guard — that's a separate, un-requested business rule some sibling routes have; out of scope here, keep this change strictly to the ownership check.

- [x] **Step 4 — update the only caller of `PATCH /api/bookings/[id]`.**
      File: `src/components/booking-management/api/bookingManagementApi.ts`, function `updateBooking` (~line 125-167). It currently sends `{ newProcedureId?, newStartISO?, newEndISO?, masterId? }` with a comment claiming `// NO USER DATA - user already validated during search / We trust the eventId and only send changes` — that assumption is exactly the vulnerability being fixed in Step 3, so update the comment too (don't leave it contradicting the new behavior). Add `phone: booking.phone` to the request body, the same way `updateProcedure`/`updateTime`/`cancelBooking` in this same file already do (grep this file for `phone: booking.phone` to see the existing pattern used 3 times already — replicate it a 4th time here).

## Verification (run after all 4 steps, report actual output)

- `npx tsc --noEmit` — must be clean.
- `npm run build` — must succeed.
- `grep -rn "debug-db\|config/masters" src` — should return nothing (confirms Step 1 fully clean, and re-confirms no stale references from the earlier cleanup).
- Manually re-read the final `src/app/api/bookings/[id]/route.ts` and confirm the ownership check sits between the CANCELLED check and the update-building logic, matching `update-time.ts`'s control flow.

## Out of scope (do not do)

- `/api/book` Turnstile/rate-limit (item 4) — explicitly deferred by the user.
- Any change to `src/app/api/client/appointments/[id]/route.ts`.
- Adding a 24h guard to `PATCH /api/bookings/[id]`.
- Anything from ROADMAP.md Priority 2+.
