# Plan: Never show past dates as available in the admin date picker

**Date:** 2026-07-21
**Status:** In Progress

## Root cause
The admin appointment modal's date calendar (`AppointmentDateSelect.tsx` → `DatePickerDropdown.tsx`) greys out day-off dates using `getAvailableDays()` (`src/lib/availability.ts`). That function loops over every date in the requested range and computes `hasWindow` from the master's schedule/overrides/busy-appointments — but it never checks whether the date itself has already passed. Since the admin picker fetches a whole visible MONTH range via `onVisibleMonthChange` (`startOfMonth`→`endOfMonth`), viewing the current month always includes days before today, and any of those that fall on a normally-working weekday come back `hasWindow: true` — so past dates render as selectable/bookable, which must never happen (you cannot book an appointment in the past).

This has never surfaced before because every EXISTING caller of `getAvailableDays()` (the public `/[masterId]` booking page, the Telegram bot's calendar) only ever queries from today forward — nobody previously asked it about a date range that dips into the past. `getDaySlots()` (the sibling function, used for a single date's TIME slots) already has a "today" concept — it hides past time-of-day slots when `dateISO === todayISO` via `minStartMin` — but this only handles the CURRENT day partially elapsing, not a genuinely past calendar date, and `getAvailableDays()` has no equivalent check at all.

## Fix
- [x] In `src/lib/availability.ts`'s `getAvailableDays()`: compute `todayISO` once at the top, mirroring the exact pattern already used in `getDaySlots()` (`const nowLocal = toZonedTime(new Date(), SCHEDULE_TZ); const todayISO = isoDate(nowLocal)` — `toZonedTime` and `isoDate`/`SCHEDULE_TZ` are already imported in this file). Inside the day loop, for each `date` computed via `isoDate(cursor)`: if `date < todayISO` (plain string comparison is valid for `YYYY-MM-DD`), push `{ date, hasWindow: false }` immediately and `continue` to the next day — skip the day-off/override/busy-range computation entirely for past dates (no need to do that work, and it keeps the change minimal/obviously-correct). Do NOT change `getDaySlots()` — this fix is scoped to `getAvailableDays()` only, since that's the function whose past-date output is actually wrong. `getDaySlots()` is only ever invoked by callers for a date already confirmed non-past by this fix (the admin picker won't let a past date be selected once this ships) or for "today" (already correctly time-filtered).
- [x] Do not touch `getDaySlots()`, the public booking flow, or the Telegram bot — this is a pure correctness fix inside `getAvailableDays()` that is a no-op for every existing caller (they never query past dates today) and only changes behavior for the new admin month-view caller.
- [x] Run `npx vitest run tests/lib/availability.test.ts` — must stay green; if the existing test suite has no coverage for a date range spanning past dates, that's fine, no new test is required for this narrow fix (this is a defensive correctness fix, not new business logic), but if adding one 3-5 line test case is trivial given the existing test file's structure, do so — use judgment based on how the existing tests are written.
- [x] Run the full verification suite: `npx tsc --noEmit`, `npm run lint`, `npx vitest run`, `npm run build`.

## Constraints
- Do NOT touch `getDaySlots()`, `/api/day/[date]/route.ts`, the public `/[masterId]` booking page, or `src/lib/telegram-bot/**` — all unrelated, must stay byte-identical.
- Do NOT touch the admin calendar UI components (`AppointmentDateSelect.tsx`, `DatePickerDropdown.tsx`) — they already correctly consume `getAvailableDays()`'s output; fixing the source data is sufficient, no UI change needed.
- No schema/migration changes.

## Manual verification (user)
1. Open the admin calendar, start a new booking, pick a master.
2. Open the Date picker while viewing the CURRENT month — every date before today should now be greyed out and non-clickable, regardless of whether it falls on that master's normal working day.
3. Today's date and all future working days should still behave exactly as before (greyed only on real day-offs/fully-booked days).
4. Navigate to a PAST month (using the ‹ arrow) — every date in that month should be greyed out (all in the past).
5. Navigate to a FUTURE month — behaves exactly as before (unaffected by this fix).
