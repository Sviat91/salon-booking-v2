# Plan: Admin Appointment — Master-scoped Services + Per-entry Service Selection

**Date:** 2026-07-21
**Status:** Implemented — pending manual verification

## Goal
Make the admin/master calendar appointment modal (`src/app/admin/master/calendar/AppointmentModal.tsx`) filter the service dropdown to only the services the selected master actually offers (clearing a now-invalid service on master change, in both CREATE and EDIT), and let a booking SERIES carry a different service per entry instead of one service shared across the whole series.

## Supersession note (read first)
Completing this plan **supersedes Group 3** of `handoff/admin-appointment-scheduling-fixes_plan.md` ("Admin can reassign the master when editing"). This plan folds in Group 3's only code change (Step 3.1: unlock the master `<Select>` for admin edit) AND overrides Group 3's explicit "do not remap services in this round" note — the user has since required master-scoped service filtering. Once this plan is implemented, mark Group 3 (Steps 3.1 & 3.2) of `admin-appointment-scheduling-fixes_plan.md` as **superseded/completed by this plan**; the orchestrator must NOT execute Group 3 separately.

Explicitly **out of scope** (do not touch): Group 2 (server-side double-booking guard), Group 4 (styled delete confirmation), Group 5 (notification-settings copy) of `admin-appointment-scheduling-fixes_plan.md`; anything from `handoff/admin-appointment-datetime-picker-fixes_plan.md` (date/time pickers are done); the `Service`/`MasterService`/`MasterProfile` schema (no migrations). No per-entry MASTER selection and no per-entry CLIENT selection — only per-entry SERVICE.

---

## Root Cause / Context (verified against current code)

### Issue A — services are not scoped to the master
- The modal fetches `${apiPrefix}/services` ONCE on mount (`AppointmentModal.tsx` init `useEffect`, lines 70-99) into a single unfiltered `services` state, used by one shared service `<Select>` (lines 248-262). It never refetches when the master changes.
- `apiPrefix` is `/api/master` (MASTER view, `isAdminView=false`) or `/api/admin/calendar` (admin view, `isAdminView=true`) — see `ModernCalendar.tsx` (`apiPrefix` default line 41, passed to the modal line 295).
- `GET /api/admin/calendar/services` does `prisma.service.findMany()` with **no `where`** (line 14-16) — every service, unscoped.
- `GET /api/master/services` returns `Service.findMany({ where: { OR: [{ masterId: null }, { masterId: session.user.id }] } })` (lines 17-25) — global + services this master **created**, which is the wrong relationship.
- **Ground truth for "does master X offer service Y":** `Service.masterId` (schema line 73) only tracks who CREATED a service. The real master↔service relationship is the `MasterService` join (schema lines 84-97: `masterProfileId`, `serviceId`, `priceOverride`; `MasterProfile.userId` is unique, line 49). The correct lookup already exists in `GET /api/procedures?masterId=xxx` (`src/app/api/procedures/route.ts` lines 38-87): find `MasterProfile` by `userId`, read `MasterService` rows (with `service` included); if none exist, fall back to `Service.findMany({ where: { OR: [{ masterId: null }, { masterId }] } })`.
- **Sole GET consumers verified:** both `GET /api/admin/calendar/services` and `GET /api/master/services` are called ONLY by the modal (via `${apiPrefix}/services`). The master-services management page (`src/app/admin/master/services/page.tsx`) loads its list via Prisma directly (server component, `prisma.service.findMany`), NOT via the GET endpoint. So changing the GET filtering is safe for both endpoints.

### Issue B — one service is shared across the whole series
- `Entry = { id, date, startTime, duration }` (`AppointmentModal.tsx` line 28); the form has ONE `serviceId`/`customServiceName` (lines 44-45) shared by every entry.
- `handleSave` (lines 101-135) builds one payload: `entries.map(e => ({ date, startTime, duration }))` plus a single top-level `serviceId`/`serviceName` (lines 105-107).
- Both POST routes resolve ONE `finalServiceId` **before** the per-entry loop and reuse it for every appointment: admin `src/app/api/admin/calendar/appointments/route.ts` lines 103-110 (loop 112-134); master `src/app/api/master/appointments/route.ts` lines 162-177 (loop 180-204). The custom-service branch creates ONE `Service` row for the whole request (admin line 106-108 using `parsed.entries[0].duration`; master line 168-175).
- The duration auto-fill `useEffect` (lines 174-182, keyed on `[serviceId, services]`) pushes the selected service's duration onto **all** entries at once.
- EDIT mode never has >1 entry (the "add date (series)" button is gated by `mode !== "edit"`, line 337) and always goes through the PUT routes (`.../appointments/[id]`), which read only `entries[0]` and a single top-level `serviceId`/`serviceName` (admin `[id]/route.ts` lines 70-117; master `[id]/route.ts` lines 140-184). So per-entry service is a **CREATE-mode + POST-route** concern only; the PUT routes and edit-mode entry UI stay untouched.

---

## Architecture Decisions

### AD-A1 — Master-scoped service filtering via the EXISTING admin/master services endpoints (Approach a)
Add master scoping to the two existing authed services GET endpoints, reusing the proven `/api/procedures` lookup logic, and keep the **current `{ services: [...] }` response shape with `duration`** so the modal needs zero field remapping. Chosen over calling `/api/procedures?masterId=` directly because: (1) `/api/procedures` is public/unauthenticated — the admin/master endpoints preserve role auth; (2) `/api/procedures` returns `{ items: [{ ..., duration_min, price_pln }] }`, which would force the modal to remap `items`→`services` and `duration_min`→`duration`; (3) it matches how Group 1 added new authed query capability to the existing admin/master endpoint family (`availability/slots`, `availability/days`).

- **`GET /api/admin/calendar/services`** gains an optional `masterId` query param:
  - `masterId` present and not `"all"` → run the `/api/procedures`-style lookup (find `MasterProfile` by `userId=masterId`; if found, `masterService.findMany({ where: { masterProfileId }, include: { service: true }, orderBy: { service: { name_pl: "asc" } } })`; if `length > 0` return `{ services: masterServices.map(ms => ms.service) }`; else fall back to `Service.findMany({ where: { OR: [{ masterId: null }, { masterId }] }, orderBy: { name_pl: "asc" } })`).
  - `masterId` absent → today's unfiltered `findMany()` (backward-compatible).
- **`GET /api/master/services`**: the master is always `session.user.id`, so no query param is needed — change its default to the same `MasterService` lookup for `session.user.id` with the identical fallback. Safe because the sole GET consumer is the modal, and the fallback (no `MasterService` rows) returns exactly today's global+own-created list. Leave the POST handler in this file untouched.

Return **full `Service` rows** (not the `/api/procedures` `duration_min` mapping) so every item carries `id, name_pl, name_en, name_uk, duration` — matching the modal's `Service` type. Extra fields (`price`, etc.) are harmless.

### AD-A2 — Modal fetches services keyed on the master; clears an invalid selection
- Move the services fetch OUT of the mount-only init effect into a **separate effect keyed on `[apiPrefix, isAdminView, formMasterId]`**. In admin view with no master chosen (`isAdminView && !formMasterId`) → `setServices([])` (only the "custom" option is offered; Save is already blocked until a master is chosen). Otherwise fetch `${apiPrefix}/services${formMasterId ? \`?masterId=${formMasterId}\` : ""}` (master view sends no param → the endpoint self-scopes to `session.user.id`). The init effect keeps fetching clients (+ masters when admin) once.
- **One `formMasterId` scopes every entry's service list** — the modal-level `services` state is shared by the top edit block and all create-mode entry pickers (the user asked for per-entry SERVICE only, not per-entry master).
- **Clear-on-change (silent reset to `"custom"`, the existing neutral state) — chosen for the simpler/cleaner UX** over a warning banner (no new copy, no i18n change):
  - CREATE mode: an effect keyed on `[services]` resets any `entry.serviceId` that is a real id not present in the new `services` list back to `serviceId: "custom", customServiceName: ""`.
  - EDIT mode: an effect keyed on `[services, formMasterId]` resets the shared `serviceId` to `"custom"` **only when `formMasterId !== originalMasterId`** (i.e. the admin actually reassigned the master) AND the current service is not offered by the new master. It must NOT fire on initial open, so the appointment's current service is never cleared just because it isn't in the `MasterService` join.
  - EDIT display safety: build a derived `serviceOptions` that, while `formMasterId === originalMasterId`, merges `initialAppointment.service` into the offered list if missing, so the current service always renders (mirrors Group 1's time-slot "safety re-add"). `initialAppointment.service` already includes `id/name_pl/name_en/name_uk/duration` (GET select).

### AD-A3 — Group 3 folded in: unlock master reassignment on admin edit
Change the master `<Select disabled={mode === "edit"}>` (`AppointmentModal.tsx` line 223) to `disabled={mode === "edit" && !isAdminView}`. The whole master block is already wrapped in `{isAdminView && (...)}` (line 217), so a master's own calendar is unaffected. The admin PUT route already persists `masterId` (`[id]/route.ts` line 72, 115) — no backend change for reassignment itself. Changing `formMasterId` re-drives AD-A2's services refetch and (from Group 1, already implemented) the time/date re-fetch.

### AD-B1 — `Entry` gains its own service; service picker moves per-row in CREATE mode only
Extend `Entry` to `{ id, date, startTime, duration, serviceId, customServiceName }`. This is the honest data-shape change the request needs (each series session self-contained: date + time + duration + service). To honor the scope guardrail ("don't touch edit-mode's single-service UI"):
- **CREATE mode:** do NOT render the top shared Service column. Each entry card gains its own service picker (a new line above the existing date/time/duration/delete row). Payload sends per-entry `serviceId`/`serviceName`; POST routes resolve service per entry.
- **EDIT mode:** unchanged — keep the top shared Service column bound to the form-level `serviceId`/`customServiceName`, keep the entry card as-is (date/time/duration/delete only), keep the top-level `serviceId`/`serviceName` payload, keep the PUT routes untouched. (The only edit-mode behavior change is AD-A2's narrowing of the shared list to the master's offered services — that is Issue A, intended.)

Coexisting per-mode service handling (edit=form-level, create=per-entry) is deliberate: it keeps the working edit + PUT path 100% untouched while adding the new capability strictly to the create + POST path.

### AD-B2 — Extract `AppointmentServiceSelect.tsx` (500-line cap)
`AppointmentModal.tsx` is 428 lines today; the new effects, handlers, and per-entry markup would push it past the hard 500-line limit. Extract a small presentational component `src/app/admin/master/calendar/AppointmentServiceSelect.tsx` (Select + conditional custom-name input; props: `services`, `language`, `value`, `onChange`, `customServiceName`, `onCustomServiceNameChange`). Use it in BOTH the edit shared block and each create entry row — it renders identical markup, so edit-mode output stays byte-for-byte the same while the file stays under the cap and the create rows reuse it DRY. Mirrors the existing `AppointmentTimeSelect.tsx` / `AppointmentDateSelect.tsx` extraction pattern.

### AD-B3 — Per-entry custom-service creation in the POST routes
Extend the POST Zod `entries` item to also accept optional `serviceId` and `serviceName`. Move service resolution INSIDE the per-entry loop: for each entry, if `entry.serviceId` is present use it; else require `entry.serviceName` (400 if missing) and create a **separate** custom `Service` row for that entry (`duration: entry.duration`, `price: 0`, `masterId`). Two custom entries → two custom `Service` rows. Keep the top-level `serviceId`/`serviceName` fields in the schema (still sent by edit? no — edit uses PUT; harmless to leave optional) but the POST loop reads per-entry only. Do not alter the PUT routes.

### AD-B4 — Duration auto-fill becomes per-entry
- CREATE mode: selecting a real service for entry N sets ONLY entry N's `duration` (a dedicated `updateEntryService(id, serviceId)` handler that also copies the service's `duration` when a real service is chosen). New entries added via "add date" inherit `entries[0]`'s `serviceId`/`customServiceName`/`duration` (fewer clicks for a same-service series; the user overrides the differing entry) — a minor UX default the coder may simplify to a fresh `"custom"`/60 if cleaner.
- EDIT mode: keep the existing `[serviceId, services]` duration effect (lines 174-182) as-is; with exactly 1 entry it maps onto `entries[0]` exactly as today, and in create mode the form-level `serviceId` never changes so it is a harmless no-op there.

---

## Implementation Steps

### Group A — Master-scoped service filtering (supersedes Group 3)

- [x] **A1: Add optional `masterId` filtering to the admin services endpoint**
  - Files: `src/app/api/admin/calendar/services/route.ts`
  - Details: Import `NextRequest`. Read `masterId` from `new URL(req.url).searchParams`. When present and not `"all"`, replicate the `/api/procedures` lookup (`src/app/api/procedures/route.ts` lines 38-87): `MasterProfile.findUnique({ where: { userId: masterId } })` → if found, `masterService.findMany({ where: { masterProfileId: profile.id }, include: { service: true }, orderBy: { service: { name_pl: "asc" } } })` → if `length > 0` return `{ services: masterServices.map(ms => ms.service) }`; else fall back to `Service.findMany({ where: { OR: [{ masterId: null }, { masterId }] }, orderBy: { name_pl: "asc" } })` → `{ services }`. When `masterId` absent, keep today's unfiltered `findMany()`. Preserve the existing SUPERADMIN/ADMIN auth guard and error handling. Response stays `{ services }` with full `Service` rows (each has `duration`).

- [x] **A2: Scope the master services endpoint to the session master via `MasterService`**
  - Files: `src/app/api/master/services/route.ts`
  - Details: In the GET only, replace the `Service.findMany({ where: { OR: [...] } })` with the same lookup for `session.user.id`: `MasterProfile.findUnique({ where: { userId: session.user.id } })` → if found, `masterService.findMany({ where: { masterProfileId }, include: { service: true }, orderBy: { service: { name_pl: "asc" } } })` → if `length > 0` return `{ services: masterServices.map(ms => ms.service) }`; else fall back to the current `Service.findMany({ where: { OR: [{ masterId: null }, { masterId: session.user.id }] }, orderBy: { name_pl: "asc" } })`. Keep MASTER auth guard, error handling, and the POST handler untouched.

- [x] **A3: Modal — refetch services per master, unlock admin edit reassignment, clear invalid service**
  - Files: `src/app/admin/master/calendar/AppointmentModal.tsx`
  - Details:
    - Remove `fetch(\`${apiPrefix}/services\`)` from the mount init `useEffect` (lines 73-91); the init effect keeps fetching clients (+ masters when admin) and setting `fetching=false`.
    - Add a services effect keyed on `[apiPrefix, isAdminView, formMasterId]`: if `isAdminView && !formMasterId` → `setServices([])`; else fetch `${apiPrefix}/services${formMasterId ? \`?masterId=${formMasterId}\` : ""}` and `setServices(data.services || [])` (guard with a `cancelled` flag like `AppointmentTimeSelect`).
    - Add `const originalMasterId = initialAppointment ? (initialAppointment.masterId || initialAppointment.master?.id || "") : ""`.
    - Add the EDIT reset effect (keyed on `[services, formMasterId]`, guarded by `mode === "edit"` and `formMasterId !== originalMasterId`): if `serviceId !== "custom"` and `!services.find(s => s.id === serviceId)` → `setServiceId("custom"); setCustomServiceName("")`.
    - Add a derived `serviceOptions` (used only by the edit shared block): when `mode === "edit" && formMasterId === originalMasterId` and `initialAppointment?.service?.id` is missing from `services`, append `initialAppointment.service` (mapped to the `Service` type) so the current service always renders; otherwise `serviceOptions = services`.
    - **Group 3 fold-in:** change the master `<Select>` `disabled={mode === "edit"}` (line 223) → `disabled={mode === "edit" && !isAdminView}`.

### Group B — Per-entry service selection in a series (CREATE mode)

- [x] **B1: Extract `AppointmentServiceSelect` presentational component**
  - Files: `src/app/admin/master/calendar/AppointmentServiceSelect.tsx` (new)
  - Details: Client component mirroring `AppointmentTimeSelect.tsx`. Props: `services: { id: string; name_pl: string; name_en?: string | null; name_uk?: string | null; duration: number }[]`, `language: string`, `value: string`, `onChange: (serviceId: string) => void`, `customServiceName: string`, `onCustomServiceNameChange: (name: string) => void`. Render the exact service `<Select>` currently at `AppointmentModal.tsx` lines 248-262 (custom option + `services.map`, using `resolveLocalized` for names and `(${s.duration}m)`) plus the conditional custom-name `<input>` (lines 265-276). Reuse existing i18n keys (`selectServiceLabel`, `customServiceOption`, `customServiceNameLabel`, `customServiceNamePlaceholder`) — no new keys. Keep well under 500 lines.

- [x] **B2: Modal — `Entry` gains service; per-entry UI in create mode; per-entry duration**
  - Files: `src/app/admin/master/calendar/AppointmentModal.tsx`
  - Details:
    - Extend `Entry` (line 28) to `{ id, date, startTime, duration, serviceId, customServiceName }`. Initialize both new fields in the `entries` state initializer (lines 53-68): edit → `serviceId: initialAppointment.service?.id || "custom"`, `customServiceName: ""`; create → `serviceId: "custom"`, `customServiceName: ""`.
    - Gate the top shared Service column (lines 240-277) with `mode === "edit"` and render it via `<AppointmentServiceSelect services={serviceOptions} language={language} value={serviceId} onChange={setServiceId} customServiceName={customServiceName} onCustomServiceNameChange={setCustomServiceName} />`. In create mode this column is not rendered (the top grid then shows only the Client column — leave layout minimal).
    - In each entry card (lines 346-395), when `mode !== "edit"`, add a service line ABOVE the date/time/duration/delete row: `<AppointmentServiceSelect services={services} language={language} value={ent.serviceId} onChange={(v) => updateEntryService(ent.id, v)} customServiceName={ent.customServiceName} onCustomServiceNameChange={(v) => updateEntry(ent.id, 'customServiceName', v)} />`. Keep the existing date/time/duration/delete row unchanged (edit-mode entry card stays byte-identical).
    - Add `updateEntryService(id, serviceId)`: sets `serviceId`, and when `serviceId !== "custom"` and the service is found in `services`, also sets that entry's `duration` to the service's `duration` (per-entry duration auto-fill, AD-B4).
    - Add the CREATE reset effect (keyed on `[services]`, guarded by `mode !== "edit"`): map entries, resetting any `e.serviceId !== "custom"` not present in `services` to `serviceId: "custom", customServiceName: ""`.
    - Update `addEntry` (lines 137-144) to inherit `entries[0]`'s `serviceId`/`customServiceName`/`duration` for the new entry.
    - Leave the existing `[serviceId, services]` duration effect (lines 174-182) as-is (edit-only effect in practice).

- [x] **B3: Modal — `handleSave` payload + `isValid` per mode**
  - Files: `src/app/admin/master/calendar/AppointmentModal.tsx`
  - Details:
    - In `handleSave` (lines 104-113): for CREATE, map each entry to `{ date, startTime, duration, serviceId: e.serviceId !== "custom" ? e.serviceId : undefined, serviceName: e.serviceId === "custom" ? e.customServiceName : undefined }` and DROP the top-level `serviceId`/`serviceName`. For EDIT, keep today's shape exactly (`entries.map(e => ({ date, startTime, duration }))` + top-level `serviceId`/`serviceName` from the form-level state). Branch on `mode === "edit"`. Client fields, `notes`, `masterId` unchanged.
    - In `isValid` (lines 184-190): replace the single `serviceId === "custom" && !customServiceName` check with a per-mode check — EDIT: unchanged (`serviceId === "custom" && !customServiceName` → false); CREATE: `entries.some(e => e.serviceId === "custom" && !e.customServiceName)` → false. Keep the existing date/startTime/duration and master checks.

- [x] **B4: Admin POST route — resolve service per entry**
  - Files: `src/app/api/admin/calendar/appointments/route.ts`
  - Details: Extend the `entries` Zod item (lines 9-13) with `serviceId: z.string().optional()`, `serviceName: z.string().optional()`. Remove the single pre-loop `finalServiceId` block (lines 103-110). Inside the loop (lines 113-132), resolve per entry: `let entryServiceId = entry.serviceId; if (!entryServiceId) { if (!entry.serviceName) return 400 "Service Name is required"; const custom = await prisma.service.create({ data: { name_pl: entry.serviceName, duration: entry.duration, price: 0, masterId } }); entryServiceId = custom.id }` then `serviceId: entryServiceId` in the `appointment.create`. Leave client resolution, `masterId` guard, endTime math, and response untouched.

- [x] **B5: Master POST route — resolve service per entry**
  - Files: `src/app/api/master/appointments/route.ts`
  - Details: Same as B4 against this file: extend the `entries` Zod item (lines 10-14) with optional `serviceId`/`serviceName`; remove the pre-loop `finalServiceId` block (lines 162-177); resolve service per entry inside the loop (lines 182-203) using `masterId = session.user.id` for the on-the-fly custom `Service` row. Leave client resolution, endTime math, and response untouched.

### Group C — DOX + verification

- [x] **C1: DOX pass**
  - Files: `src/app/api/AGENTS.md`, `src/app/admin/AGENTS.md`
  - Details: In `src/app/api/AGENTS.md`, note that `GET /api/admin/calendar/services` accepts an optional `masterId` and `GET /api/master/services` scopes to the session master, both via the `MasterService` join with a global+own-created fallback (same logic as `/api/procedures`); note that the calendar POST routes now resolve a service per `entries[]` item (per-entry custom `Service` creation). In `src/app/admin/AGENTS.md`, extend the calendar-modal guidance: the service dropdown is master-scoped (clears an invalid selection on master change, in create and edit; admin edit can reassign the master), and CREATE-mode series carry a per-entry service via the new `AppointmentServiceSelect.tsx`. Keep edits concise; no new Child DOX Index entries (additive files in existing folders).

---

## Verification (automated)
```
npx tsc --noEmit
npm run lint            # touched files must be individually clean (repo has ~40 pre-existing errors in unrelated files; verify each changed file with: npx eslint <file>)
npm run i18n:check      # no new keys expected — confirm nothing broke
npx vitest run
npm run build
```
No new i18n keys are added (silent reset + reused service-picker keys). `tests/lib/availability.test.ts` is unaffected (no `availability.ts` change).

## Manual verification (user — test live in the browser)
Do these as an ADMIN unless noted.

**Issue A — master-scoped services**
1. Open the admin calendar, click an empty slot for a NEW booking. Before choosing a master, the Service dropdown offers only "custom service" (no master's services yet).
2. Pick a master who has a specific set of assigned services. The Service dropdown now lists ONLY that master's offered services (plus "custom service"). Switch to a different master — the list changes to the new master's services.
3. Pick master A, choose one of A's services, then switch to master B who does NOT offer it — the service selection clears back to "custom service" on its own (no error popup).
4. Open an EXISTING appointment → Edit. The master dropdown is now editable. Its current service is shown and you can Save unchanged. Reassign it to a different master: the service list narrows to the new master's services; if the old service isn't offered there it clears to "custom" and you must re-pick. Save — the appointment now belongs to the new master with a valid service.
5. Log in as a MASTER, open your own calendar → new/edit appointment: there is no master dropdown, and the Service dropdown lists only the services assigned to you.

**Issue B — per-entry service in a series**
6. As admin (master chosen) start a NEW booking. Each date row now has its OWN service picker. Click "+ Add date (series)" to add a second row.
7. Give row 1 one service (e.g. a consultation) and row 2 a different service (e.g. the procedure). Selecting a real service auto-fills THAT row's duration only (the other row's duration is unchanged). Type a custom service name in a third row.
8. Save. Verify in the calendar that each created appointment carries its OWN service (row 1 = consultation, row 2 = procedure, row 3 = the custom-named service) — not one shared service across all three. The custom-named row created its own service entry.
9. Confirm the whole series still shares ONE client and ONE master (only the service varies per row).

## Acceptance Criteria
- [x] `npx tsc --noEmit`, `npm run i18n:check`, `npx vitest run`, `npm run build` all pass; every file touched by this plan is individually lint-clean (`npx eslint <file>`).
- [x] Service dropdown lists only the selected master's `MasterService`-offered services (with global+own-created fallback) in both create and edit; an invalid service clears to "custom" on master change; the edit-mode current service is never cleared on open.
- [x] Admin can reassign the master when editing; a master's own calendar cannot (Group 3 superseded/completed here).
- [x] A CREATE-mode series can assign a different service (real or custom) per entry; each entry's duration auto-fills independently; the backend creates a separate custom `Service` per custom entry; one client + one master for the whole series.
- [x] EDIT mode UI, the top-level edit payload, and the PUT routes are unchanged (except the intended narrowing of the edit service list to the master's offered services).
- [x] Files stay under 500 lines (`AppointmentServiceSelect.tsx` extracted); no library imported that isn't in `package.json`; `AppointmentTimeSelect`/`AppointmentDateSelect`/shared pickers untouched.
- [x] DOX pass done (`src/app/api/AGENTS.md`, `src/app/admin/AGENTS.md`).
- [x] Group 3 of `admin-appointment-scheduling-fixes_plan.md` marked superseded/completed by this plan.

## Constraints & Risks
- **No schema/migration changes** — reuse `MasterService`/`Service`/`MasterProfile` exactly as `/api/procedures` does.
- **Do NOT** call the public `/api/procedures` from the modal, alter `/api/procedures`, or touch the public booking flow or the client Telegram bot.
- **Do NOT** touch the PUT routes (`.../appointments/[id]`), the edit-mode entry card, Group 2/4/5, or the date/time picker work — all out of scope.
- **Both services GET endpoints are the modal's only GET consumers** (management page uses Prisma directly) — the filtering change is safe; keep the `{ services }` shape and full `Service` rows so the modal needs no remapping.
- **Timezone/availability logic** is untouched — this plan only changes which services are listed and how service maps to each appointment row; duration still feeds the already-implemented slot/day fetches per entry.
- **Edit-mode current-service safety:** always keep `initialAppointment.service` selectable while the master is unchanged (AD-A2), so opening an appointment whose service isn't in the master's `MasterService` join does not wrongly clear it.
