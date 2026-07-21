# Plan: Admin Appointment Scheduling Fixes

**Date:** 2026-07-21
**Status:** In Progress

## Goal
Make the admin/master calendar's manual appointment create/edit modal respect real availability (salon working hours → specific master's schedule → no double-booking), let an admin reassign a master during edit, replace the native `confirm()` delete dialog (which also fixes a post-delete double-click bug), and correct the stale notification-reminder gating so the client bot counts as a channel.

## Scope note — what was verified vs. what the prompt assumed
Read the real code before planning. Two prompt assumptions turned out to be WRONG and the plan corrects them:
- **Issue 5 is NOT "just a stale copy string."** `NotificationSettingsForm.tsx` genuinely gates the reminder toggles (`disabled={!anyChannelEnabled}`, lines 266 & 283) where `anyChannelEnabled = emailEnabled || telegramEnabled` (line 88) — it has no knowledge of `clientBotEnabled`. The GET route `/api/admin/notification-settings` (lines 15–31) does not even return `clientBotEnabled`. So the fix requires exposing `clientBotEnabled` to the form AND updating the hint — still small, but more than one string.
- **The `confirm()` for delete lives in `ViewAppointmentModal.tsx` (line 42)**, not in `ModernCalendar.tsx`. `ModernCalendar`'s `onDelete` (lines 315–321) only performs the DELETE fetch; the confirmation gate is in the child modal.

Also verified: there is **no `AlertDialog` primitive** in `src/components/ui/` (only a base-ui `Dialog`), and **every** admin delete flow (masters, services, master-services, admins) uses native `confirm()`. There is no reusable styled-confirm component to adopt.

---

## Architecture Decisions

### AD1 — How the admin/master form fetches available slots
Add **two new authenticated endpoints**, one per `apiPrefix` the modal already uses, both thin wrappers over the proven `getDaySlots()` in `src/lib/availability.ts`:
- `GET /api/master/availability/slots?date=YYYY-MM-DD&duration=N&excludeAppointmentId=<optional>` — auth `MASTER`; `masterId = session.user.id` (client never sends it).
- `GET /api/admin/calendar/availability/slots?date=YYYY-MM-DD&duration=N&masterId=<required>&excludeAppointmentId=<optional>` — auth `ADMIN`/`SUPERADMIN`; uses the `masterId` query param.

Both return `{ slots: [{ startISO, endISO }] }` from `getDaySlots(date, duration, 15, masterId, excludeAppointmentId)`.

The modal calls `${apiPrefix}/availability/slots?...` uniformly, matching how it already fetches `${apiPrefix}/services`, `${apiPrefix}/clients`, `${apiPrefix}/masters` (`AppointmentModal.tsx` lines 74–90).

**Why not reuse `GET /api/day/[date]`?** It is unauthenticated (public booking), derives duration only from a `procedureId` (can't take an arbitrary custom duration), and has no `excludeAppointmentId` or per-master admin scoping. The bot calls `getDaySlots()` in-process because it *is* server-side; the modal is a client component and needs an HTTP hop, so a dedicated authed route per role is the clean parallel.

### AD2 — "Exclude self" when editing
`fetchBusyRanges(masterId, dateISO, excludeId?)` in `src/lib/schedule-utils.ts` (lines 168–194) **already** supports excluding an appointment id, but `getDaySlots()` does not thread it through. Add an optional trailing `excludeAppointmentId?: string` param to `getDaySlots()` and forward it to `fetchBusyRanges()`. Adding it as the **last optional param** leaves all existing callers (bot `handlers/datetime.ts:130`, `/api/day/[date]/route.ts:44`, tests) unchanged.

Result: in edit mode the appointment being edited is removed from its own conflict set, so its current slot is offered again. Because the exclusion is duration-aware, if the admin *extends* the duration so it would now overlap a neighbour, that longer slot correctly disappears (real conflict), while an unchanged appointment always remains saveable.

**Safety re-add (edge case only):** legacy appointments whose `startTime` is not aligned to the 15-min grid would not reappear in the computed list. In edit mode, if `date` and `duration` are unchanged from the original AND the original `startTime` is missing from the fetched options, prepend the original `startTime` so the admin can always keep the current time. (For 15-min-aligned data this branch never fires.)

### AD3 — Master-change re-fetch / re-validation
Slot options are a function of `(effectiveMasterId, entry.date, entry.duration, excludeAppointmentId)`. Extract a small `AppointmentTimeSelect` component (new file, keeps `AppointmentModal.tsx` under the 500-line cap) that owns its own fetch effect keyed on those inputs. When the admin changes the master (or date/duration), the effect re-fetches; if the currently-selected `startTime` is not present in the new option set, the component reports it invalid and the parent clears that entry's `startTime` (forcing a re-pick). Save stays disabled until every entry has a valid selected time.

### AD4 — Enable master reassignment on admin edit (Issue 4)
Change the specialist `<Select disabled={mode === "edit"}>` (`AppointmentModal.tsx` line 202) to `disabled={mode === "edit" && !isAdminView}`. The whole master block is already wrapped in `{isAdminView && (...)}` (line 196), so the master's own non-admin calendar (`isAdminView=false`) is unaffected — the field still does not render there. The admin PUT route `/api/admin/calendar/appointments/[id]` already accepts and persists `masterId` (lines 70–72, 115) — **no backend change for reassignment itself.** Changing master re-drives AD3's re-fetch automatically.

### AD5 — Server-side double-booking guard (defense-in-depth) — RECOMMENDED, isolated as Group 2
The frontend will only *offer* free slots, but the calendar polls every 15s (`ModernCalendar.tsx:151`), so two admins (or admin + bot) can still race into the same slot; none of the four write routes currently check for overlap. **Decision: add a minimal overlap guard** to the four write paths (admin POST/PUT, master POST/PUT) using the already-exported `fetchBusyRanges()` + `overlapsWithBusy()` (`schedule-utils.ts:105`), returning HTTP 409 with `code: "SLOT_CONFLICT"`. It is placed in its own group so the user can review/veto it in isolation.

**Deliberately NOT enforced server-side:** whether a slot falls inside the master's working hours. Double-booking is genuine data corruption (two clients, one master, one moment) and must be blocked; booking *outside* posted hours is a legitimate admin override the user may want, so the server stays permissive there while the UI simply doesn't surface those times.

### AD6 — Styled delete confirmation (Issues 2 & 3)
No `AlertDialog` exists and the `calendar/` folder convention is hand-rolled fixed-overlay modals (`AppointmentModal`, `ViewAppointmentModal`). A nested base-ui `Dialog` would render at `z-50`, *behind* `ViewAppointmentModal`'s `z-[60]` overlay. So add a **local confirmation overlay inside `ViewAppointmentModal`** (state-driven, `z-[70]`), styled with the same tokens as the existing modals (Button, `bg-background`, etc.). This removes the blocking synchronous `confirm()` without inventing a broad new shared primitive and without z-index conflicts.

**Issue 3 (post-delete double-click) reasoning:** the synchronous native `confirm()` blocks the event loop and the browser routinely "eats" the next pointer gesture after such a modal dismisses; that swallowed first click is the reported regression. Replacing `confirm()` with the async, state-driven overlay is expected to fix Issue 3 for free. Group 4 includes an explicit verification step; if the double-click persists after the swap, the fallback is to audit focus/overlay teardown (`onClose` leaving focus on a removed node, or the 15s `fetchData` poll transiently remounting an overlay) — but do not add speculative fixes unless the symptom actually survives.

---

## Implementation Steps

### Group 1 — Availability-aware time selection in the manual booking form (Issue 1, frontend + shared logic)
Independently verifiable: in the create/edit modal you can no longer pick a time outside the selected master's real free windows; day-off dates and already-booked/overlapping times are not offered; editing keeps the appointment's own current time selectable.

- [x] **Step 1.1: Thread `excludeAppointmentId` through `getDaySlots()`**
  - Files: `src/lib/availability.ts`
  - Details: Add optional trailing param `excludeAppointmentId?: string` to `getDaySlots` (signature at line 109). Pass it to the `fetchBusyRanges(masterId, dateISO, excludeAppointmentId)` call (line 151). No other change to the function. Do NOT touch `getAvailableDays`. Confirm the 3 existing callers still compile (they omit the new arg).

- [x] **Step 1.2: New master slots endpoint**
  - Files: `src/app/api/master/availability/slots/route.ts` (new)
  - Details: `export const runtime = "nodejs"`. `GET`: `auth()`; require `session.user.role === "MASTER"` (401 otherwise). Read `date`, `duration`, `excludeAppointmentId` from query. Validate `date` matches `^\d{4}-\d{2}-\d{2}$` (400 otherwise) and `duration` is a positive integer (fallback/clamp to a sane min like 5). Return `NextResponse.json(await getDaySlots(date, duration, 15, session.user.id, excludeAppointmentId || undefined))`. Mirror error handling of `/api/day/[date]/route.ts` (return `{ slots: [] }` on catch).

- [x] **Step 1.3: New admin slots endpoint**
  - Files: `src/app/api/admin/calendar/availability/slots/route.ts` (new)
  - Details: Same as 1.2 but auth `SUPERADMIN`/`ADMIN`, and `masterId` comes from the query (required; 400 if missing or `"all"`). Return `getDaySlots(date, duration, 15, masterId, excludeAppointmentId || undefined)`.

- [x] **Step 1.4: Extract `AppointmentTimeSelect` component**
  - Files: `src/app/admin/master/calendar/AppointmentTimeSelect.tsx` (new)
  - Details: Client component. Props: `apiPrefix: string`, `isAdminView: boolean`, `masterId: string` (effective form master; `""` when none chosen), `date: string`, `durationMin: number`, `value: string`, `onChange: (time: string) => void`, `onOptionsResolved?: (times: string[]) => void`, `excludeAppointmentId?: string`, `workingHourStart: number`, `workingHourEnd: number`.
    - Effect keyed on `[apiPrefix, isAdminView, masterId, date, durationMin, excludeAppointmentId]`:
      - If `isAdminView && !masterId` → do not fetch; options = `[]`; render disabled with placeholder text `t('admin.calendar.selectMasterFirstHint')`.
      - Else fetch `${apiPrefix}/availability/slots?date=${date}&duration=${durationMin}${masterId ? `&masterId=${masterId}` : ""}${excludeAppointmentId ? `&excludeAppointmentId=${excludeAppointmentId}` : ""}`. Map `slots` → `HH:mm` via `s.startISO.slice(11, 16)` (the ISO already carries the Warsaw offset, so the slice is the local wall-clock time — same trick the bot uses). Dedupe/sort.
    - Render a `Select` (from `@/components/ui/select`, the component the modal already uses) listing the option times; if `value` is set but not in options, still show it but visually mark it stale (and call `onChange("")` is NOT done here — the parent decides; instead call `onOptionsResolved(times)` so the parent can clear invalid values — see 1.5).
    - Empty options (master chosen, real fetch, nothing free) → render disabled with `t('admin.calendar.noAvailableTimes')`.
    - Show a small spinner/`t('common.loading')` state while fetching.
  - Keep this file focused and well under 500 lines.

- [x] **Step 1.5: Rewrite the time field + wire validation in `AppointmentModal`**
  - Files: `src/app/admin/master/calendar/AppointmentModal.tsx`
  - Details:
    - Add props `workingHourStart?: number` (default 8) and `workingHourEnd?: number` (default 21) to `AppointmentModalProps` (lines 15–24) and the destructure (line 30).
    - Replace the per-entry `TimePickerDropdown` (lines 333–340) with `AppointmentTimeSelect`, passing: `apiPrefix`, `isAdminView`, `masterId={formMasterId}`, `date={ent.date}`, `durationMin={ent.duration}`, `value={ent.startTime}`, `onChange={(v) => updateEntry(ent.id, 'startTime', v)}`, `excludeAppointmentId={mode === "edit" ? initialAppointment?.id : undefined}`, `workingHourStart`, `workingHourEnd`, and an `onOptionsResolved` that clears the entry's `startTime` (set to `""`) if the current value is not among the resolved options — EXCEPT preserve it in edit mode when `date` & `duration` equal the original (AD2 safety re-add). Keep the shared `TimePickerDropdown` component untouched (other consumers rely on it).
    - Leave the `duration` `<input type="number">` (lines 341–350) as-is — custom services still need arbitrary durations; duration now feeds slot computation via the effect key.
    - Update `isValid()` (lines 163–169) so a blank `startTime` (cleared because invalid / not yet re-picked) blocks Save. (`entries.some(e => !e.startTime)` already covers this once we clear invalid values.)
    - In `handleSave`'s error path, if the response status is 409, show `t('admin.calendar.slotConflictError')` instead of the generic message (line 124–126 / 129). Keep the existing `alert(...)` mechanism for now (out of scope to redesign).

- [x] **Step 1.6: Pass working hours from `ModernCalendar` into the modal**
  - Files: `src/app/admin/master/calendar/ModernCalendar.tsx`
  - Details: In the `<AppointmentModal .../>` render (lines 290–301) add `workingHourStart={workingHourStart}` and `workingHourEnd={workingHourEnd}` (these are already props of `ModernCalendar`, lines 39–40 / 74–75).

- [x] **Step 1.7: Add i18n keys (all 3 locales)**
  - Files: `src/locales/en.json`, `src/locales/pl.json`, `src/locales/uk.json`
  - Details: Under `admin.calendar` add: `selectMasterFirstHint`, `noAvailableTimes`, `slotConflictError`, and a start-time placeholder key `startTimePlaceholder` (used by the Select trigger). Provide correct pl/en/uk translations. Run `npm run i18n:check`.

**Group 1 verification:**
```
npx tsc --noEmit
npm run lint
npm run i18n:check
npx vitest run tests/lib/availability.test.ts
```
(The availability test suite must stay green — Step 1.1 is additive.)

**Group 1 manual verification (for the admin, in the browser):**
1. Open the admin calendar, click a slot to start a new booking. Before choosing a master, the Start Time field is disabled and prompts you to pick a master.
2. Pick a master who has a day off on some date; set that date — the Start Time shows "no available times."
3. Pick a normal working date — Start Time only lists that master's free times; times overlapping an existing appointment are absent.
4. Change the Duration to a long value — start times that no longer fit before the next booking disappear.
5. Open an existing appointment → Edit. Its current time is still selectable and you can Save without changing anything. Move it 15 min and Save — it moves; the old time frees up.
6. Repeat 1–5 on a MASTER's own calendar login (no master dropdown) — times still restrict to that master's schedule.

---

### Group 2 — Server-side double-booking guard (Issue 1 defense-in-depth) — RECOMMENDED, user may defer
Independently verifiable: even if the UI is stale, the server refuses to create/update an appointment that overlaps another for the same master, returning 409.

- [ ] **Step 2.1: Guard the admin write routes**
  - Files: `src/app/api/admin/calendar/appointments/route.ts` (POST, lines 70–142), `src/app/api/admin/calendar/appointments/[id]/route.ts` (PUT, lines 50–124)
  - Details: Import `fetchBusyRanges`, `overlapsWithBusy`, `t2m` from `@/lib/schedule-utils`. For each entry: compute `startMin = t2m(startTime)`, `endMin = startMin + duration`; `const busy = await fetchBusyRanges(finalMasterId, date, /* PUT: */ id /* POST: undefined */)`; if `overlapsWithBusy(busy, startMin, endMin)` → `return NextResponse.json({ error: "Slot conflict", code: "SLOT_CONFLICT" }, { status: 409 })` BEFORE creating/updating. In PUT, pass the appointment's own `id` as the exclude so re-saving/shifting the same appointment is allowed. Do NOT alter the DELETE handler or any other existing logic.

- [ ] **Step 2.2: Guard the master write routes**
  - Files: `src/app/api/master/appointments/route.ts` (POST, lines 115–215), `src/app/api/master/appointments/[id]/route.ts` (PUT, lines 119–191)
  - Details: Same guard using `session.user.id` as the master; PUT excludes its own `id`. Leave PATCH (cancel) and DELETE untouched.

**Group 2 verification:**
```
npx tsc --noEmit
npm run lint
npx vitest run
```

**Group 2 manual verification:**
1. Open the same master's calendar in two browser tabs. In tab A create an appointment at 12:00. Without letting tab B refresh, in tab B try to create/move an appointment overlapping 12:00 for the same master — saving fails with a "time no longer available" message.
2. Edit an existing appointment and save it unchanged — it saves (its own slot is excluded, not treated as a conflict).

---

### Group 3 — Admin can reassign the master when editing (Issue 4)

**SUPERSEDED/COMPLETED by `handoff/admin-appointment-master-service-fixes_plan.md`** — that plan's Step A3 (AD-A3) folds in this group's only code change (unlocking the master `<Select>` for admin edit) and additionally overrides the "do not remap services in this round" note below with master-scoped service filtering. Do not execute Steps 3.1/3.2 separately; they are done via the other plan.

Independently verifiable: an ADMIN editing an appointment can switch its assigned master; the time field re-validates against the new master; a master's own calendar still cannot change master.

- [ ] **Step 3.1: Unlock the specialist select for admin edit**
  - Files: `src/app/admin/master/calendar/AppointmentModal.tsx`
  - Details: Change line 202 `disabled={mode === "edit"}` → `disabled={mode === "edit" && !isAdminView}`. No other change — the master block is already gated by `isAdminView` (line 196), so `isAdminView=false` calendars are unaffected.

- [ ] **Step 3.2: Confirm re-validation wiring (should already work from Group 1)**
  - Files: `src/app/admin/master/calendar/AppointmentModal.tsx`
  - Details: Verify that changing `formMasterId` re-drives `AppointmentTimeSelect`'s fetch effect (`masterId` is in its dependency key) and that an now-invalid `startTime` is cleared via `onOptionsResolved` (Step 1.5). No new state needed. If the pre-fill service `useEffect` (lines 154–161) fights the cleared time, ensure order is: master change → refetch → clear invalid time. Document any adjustment inline.
  - Note: reassigning keeps the existing `serviceId` even though custom services are master-scoped in the DB; this is acceptable (service is a display label). Do not attempt to remap services in this round.

**Group 3 verification:**
```
npx tsc --noEmit
npm run lint
```

**Group 3 manual verification:**
1. As an admin, open an existing appointment → Edit. The master dropdown is now editable.
2. Switch to a different master. The Start Time list refreshes to the NEW master's free times; if the old time isn't free for the new master it is cleared and you must re-pick. Save — the appointment now belongs to the new master (verify it appears under that master in the calendar).
3. Log in as a MASTER, edit one of your own appointments — there is no master dropdown at all (unchanged).

---

### Group 4 — Styled delete confirmation + post-delete double-click fix (Issues 2 & 3)
Independently verifiable: deleting an appointment shows the app's own styled confirmation (no browser popup), and after deleting, the very next single click on another appointment/button registers immediately.

- [x] **Step 4.1: Replace `confirm()` with a local styled overlay**
  - Files: `src/app/admin/master/calendar/ViewAppointmentModal.tsx`
  - Details: Add state `const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)`. Change the Delete button (lines 129–136) to open the confirm overlay instead of calling `handleDelete` directly. Rewrite `handleDelete` (lines 41–50): remove the `if (!confirm(...)) return` line (line 42); keep the `setIsDeleting(true)` → `await onDelete(...)` → error path. Render a conditional confirm overlay (`fixed inset-0 z-[70]` so it sits above this modal's `z-[60]`) with a small `bg-background` card: title `t('admin.calendar.deleteConfirmTitle')`, body `t('admin.calendar.deleteAppointmentConfirm')` (existing key), and two buttons — `variant="outline"` Cancel (`t('common.cancel')`, closes the overlay) and `variant="destructive"` Confirm (`t('admin.calendar.deleteBtn')` / `t('admin.calendar.deletingBtn')` while deleting) that calls `handleDelete`. Reuse the existing `Button` component and match the styling of this file's other buttons. Keep the existing failure `alert` (line 47) or convert to inline text — keep minimal.

- [x] **Step 4.2: Add the confirm-title i18n key (all 3 locales)**
  - Files: `src/locales/en.json`, `src/locales/pl.json`, `src/locales/uk.json`
  - Details: Add `admin.calendar.deleteConfirmTitle` (e.g. EN "Delete appointment?", PL/UK equivalents). Reuse existing `deleteAppointmentConfirm`, `deleteBtn`, `deletingBtn`, `common.cancel`. Run `npm run i18n:check`.

- [x] **Step 4.3: Verify Issue 3 is resolved by the swap**
  - Files: (verification only — `ViewAppointmentModal.tsx`, `ModernCalendar.tsx`)
  - Details: After 4.1, confirm manually that the post-delete double-click is gone (see manual steps). Only if it persists: audit `ModernCalendar.tsx`'s `onDelete`/close flow (lines 298–321) and the modal teardown for a lingering overlay or focus stuck on a removed node; fix that specific cause. Do not add speculative changes if the symptom is already gone.
  - Code-review outcome: `ModernCalendar.tsx`'s `onDelete` (lines 315–321) calls `setViewingAppointment(null)` on success, which unmounts `ViewAppointmentModal` (and the new confirm overlay) in a single state update — no lingering overlay/focus-trap node remains, since there is no synchronous blocking call left in the flow. This matches AD6's expectation; the fix should resolve Issue 3. Final confirmation still needs the user's manual click-test (browser interaction, not verifiable by static code review alone).

**Group 4 verification:**
```
npx tsc --noEmit
npm run lint
npm run i18n:check
```

**Group 4 manual verification:**
1. Open an appointment → Delete. A styled in-app confirmation appears (not the grey browser popup), matching the app theme. Cancel dismisses it; Confirm deletes.
2. Immediately after a delete completes, click another appointment (or any button) exactly once — it opens/reacts on the first click, with no need to click twice.

---

### Group 5 — Reminder gating counts the client bot (Issue 5)
Independently verifiable: with ONLY the client Telegram bot enabled (email + admin-Telegram both off), the reminder toggles are enabled and the hint no longer implies you must turn on email/admin-Telegram.

- [ ] **Step 5.1: Return `clientBotEnabled` from the notification-settings GET**
  - Files: `src/app/api/admin/notification-settings/route.ts`
  - Details: In `GET` (lines 15–31) add `clientBotEnabled: config?.clientBotEnabled ?? false` to the JSON response. Do NOT add it to the `PatchSchema`/PATCH (it is owned by the client-bot settings screen; this form only reads it). Leave PATCH untouched.

- [ ] **Step 5.2: Factor the client bot into the gate + fix the hint**
  - Files: `src/app/admin/settings/notifications/NotificationSettingsForm.tsx`
  - Details: Add `const [clientBotEnabled, setClientBotEnabled] = React.useState(false)`. In the `load()` effect (lines 96–121) read `notifData.clientBotEnabled` and `setClientBotEnabled(Boolean(notifData.clientBotEnabled))`. Change line 88 to `const anyChannelEnabled = emailEnabled || telegramEnabled || clientBotEnabled`. This automatically un-gates the toggles (lines 266, 283) and hides the hint (line 250) when only the client bot is on. Keep `clientBotEnabled` OUT of the form values so it doesn't affect dirty-state/submit.

- [ ] **Step 5.3: Update the hint copy (all 3 locales)**
  - Files: `src/locales/en.json`, `src/locales/pl.json`, `src/locales/uk.json` (key `admin.settings.notifications.enableChannelHint`, line 661 in each)
  - Details: Reword so it lists the client booking bot as an unlocking channel too (e.g. EN: "Enable at least one channel above — email, admin Telegram, or the client booking bot — to activate reminders."). Keep PL/UK consistent. Run `npm run i18n:check`.
  - Note: the backend guard already treats `clientBotEnabled` as valid (`src/lib/notifications/index.ts:177`) — no notifications-lib change needed.

**Group 5 verification:**
```
npx tsc --noEmit
npm run lint
npm run i18n:check
```

**Group 5 manual verification:**
1. In Settings, enable the client booking bot (client-bot settings screen) and turn OFF email + admin Telegram.
2. Open Notifications settings: the 24h/2h reminder toggles are now switchable, and the "enable a channel" hint is gone (or, if shown elsewhere, now mentions the client bot).
3. Turn everything off — the toggles disable again and the hint reappears with the corrected wording.

---

## Final full-suite verification (after all groups)
```
npx tsc --noEmit
npm run lint
npm run i18n:check
npx vitest run
npm run build
```

## Acceptance Criteria
- [ ] All tests pass (`npx vitest run`); `tests/lib/availability.test.ts` stays green after the `getDaySlots` signature change.
- [ ] `npx tsc --noEmit`, `npm run lint` (zero warnings), `npm run i18n:check`, and `npm run build` all pass.
- [ ] Follows project conventions: files stay under 500 lines (new `AppointmentTimeSelect.tsx` extracted for this reason); no library imported that isn't already in `package.json`; shared `TimePickerDropdown`/`DatePickerDropdown` left untouched for their other consumers.
- [ ] Manual booking form only offers times inside the selected master's real free windows (working hours → schedule/overrides → no overlap); editing keeps the appointment's own slot selectable.
- [ ] Admin can reassign the master on an existing appointment; a master's own calendar cannot.
- [ ] Delete uses a styled in-app confirmation; no native `confirm()`; no post-delete double-click.
- [ ] Reminder toggles/hint treat the client bot as a valid channel.
- [ ] DOX pass: update the nearest owning `AGENTS.md` files for any new routes/components (`src/app/api/AGENTS.md`, `src/app/admin/AGENTS.md`, `src/lib/AGENTS.md` as applicable) and refresh affected Child DOX Indexes.

## Constraints & Risks
- **Do not touch** the client Telegram bot's own date/time picker (`src/lib/telegram-bot/**`) — it already uses `getAvailableDays()`/`getDaySlots()` correctly. Step 1.1 only *adds* an optional param it doesn't pass.
- **Do not touch** the public booking flow (`/api/availability`, `/api/day/[date]`, `/api/book`, `/[masterId]`) — reference only.
- **Do not** modify the shared `TimePickerDropdown`/`DatePickerDropdown` behavior; both are used by many other calendar components (WeekView, DayView, BulkSettingsModal, EditAppointmentModal, etc.).
- **Group 2 is a decision point:** it edits backend write routes flagged as sensitive. It is recommended (prevents genuine double-booking races the 15s poll can't) and isolated so the user can defer it after review. It deliberately does not block out-of-hours admin overrides.
- **No schema/migration changes** are anticipated. `TenantConfig.workingHourStart/End` (schema lines 195–196) and `clientBotEnabled` (line 267) already exist; the admin calendar page currently hardcodes `workingHourStart={8}`/`workingHourEnd={21}` — leaving that as-is is fine (out of scope). If any step surfaces a real need for a migration, STOP and flag it as an open question rather than adding one.
- **Timezone:** slot `startISO` values carry the Warsaw offset; `slice(11,16)` yields the local wall-clock `HH:mm` that matches how `Appointment.startTime` is stored — do not re-convert through the browser's local timezone.
- **Concurrency caveat:** without Group 2, a stale frontend can still race into a taken slot; note this to the user if Group 2 is deferred.
