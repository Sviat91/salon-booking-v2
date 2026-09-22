# Plan: Google Calendar adopt-on-connect (fix reconnect duplicates)

## Decision (user-confirmed 2026-09-22)
Auto-resolve duplicates only. **No** extra "wipe calendar on disconnect" button/checkbox —
that idea was floated by the user then explicitly dropped as unnecessary complexity.

## Bug
`setMasterCalendarId` (`src/lib/google-calendar/connect.ts`) clears `Appointment.googleEventId`
for the master on disconnect AND on calendar-id change (`clearMasterEventIds`), then
`enqueueBackfillForMaster` blindly re-inserts every future appointment as a NEW Google event.
If the physical Google calendar still has the old events (disconnect never deletes anything from
Google, only local DB bookkeeping), reconnecting the same calendar ID creates duplicates.

## Fix: adopt existing events by marker instead of blind insert
Every site-pushed event already carries `extendedProperties.private.salonAppointmentId`
(`SALON_APPOINTMENT_KEY` in `event-mapping.ts`) — a stable id tied to the appointment, immune to
title/time changes. Before backfilling, list the master's Google calendar once, build a map
`salonAppointmentId -> googleEventId` from events that carry the marker, and for any appointment
that matches, set `googleEventId` directly instead of letting the outbox insert a new event. The
appointment is still enqueued as a normal UPSERT task afterwards either way — for an adopted
appointment this becomes a **PATCH** (reconciles any drift that happened while disconnected) that
`processSyncTask` already does automatically since it reads `appointment.googleEventId` fresh at
drain time (`push.ts:86`); no push-side changes needed at all.

## Scope: `src/lib/google-calendar/outbox.ts` only

- [x] Import `listEvents` from `./client`, `normalizeCalendarId` from `./config` (already imports
      `SYNC_WINDOW_DAYS`, `isGoogleSyncEnabled` from there), `SALON_APPOINTMENT_KEY` from
      `./event-mapping`.
- [x] Add `const MAX_PAGES = 20` (mirrors `pull.ts`'s full-sync page cap).
- [x] Add a private helper:
  ```ts
  async function fetchExistingEventIds(calendarId: string, from: Date, to: Date): Promise<Map<string, string>> {
    const map = new Map<string, string>()
    try {
      let pageToken: string | undefined
      for (let page = 0; page < MAX_PAGES; page++) {
        const res = await listEvents(calendarId, {
          timeMin: from.toISOString(),
          timeMax: to.toISOString(),
          singleEvents: 'true',
          maxResults: '250',
          ...(pageToken ? { pageToken } : {}),
        })
        for (const item of res.items ?? []) {
          if (item.status === 'cancelled') continue
          const id = item.extendedProperties?.private?.[SALON_APPOINTMENT_KEY]
          if (id) map.set(id, item.id)
        }
        pageToken = res.nextPageToken
        if (!pageToken) break
      }
    } catch (err) {
      // Never blocks connect: worst case we fall back to today's insert-everything behavior.
      console.error('[google-calendar outbox] fetchExistingEventIds failed:', err)
    }
    return map
  }
  ```
  Plain instant bounds (no Warsaw-local conversion needed — matching is by exact marker, not by
  date proximity, so the window only needs to comfortably cover the backfill range).
- [x] Modify `enqueueBackfillForMaster`:
  ```ts
  export async function enqueueBackfillForMaster(masterId: string): Promise<{ queued: number }> {
    try {
      const from = todayUtcMidnight()
      const to = new Date(from.getTime() + SYNC_WINDOW_DAYS * 24 * 60 * 60 * 1000)
      const appts = await prisma.appointment.findMany({
        where: { masterId, status: { not: 'CANCELLED' }, date: { gte: from, lte: to } },
        select: { id: true },
      })
      if (appts.length === 0) return { queued: 0 }

      const profile = await prisma.masterProfile.findUnique({
        where: { userId: masterId },
        select: { googleCalendarId: true },
      })
      const calendarId = normalizeCalendarId(profile?.googleCalendarId)
      const existing = calendarId ? await fetchExistingEventIds(calendarId, from, to) : new Map<string, string>()
      for (const a of appts) {
        const eventId = existing.get(a.id)
        if (eventId) await prisma.appointment.update({ where: { id: a.id }, data: { googleEventId: eventId } })
      }

      for (const a of appts) await upsertTask(a.id, masterId)
      kickOutbox()
      return { queued: appts.length }
    } catch (err) {
      console.error('[google-calendar outbox] enqueueBackfillForMaster failed:', err)
      return { queued: 0 }
    }
  }
  ```
  Note: `kickOutbox()` call moved outside the `appts.length > 0` check since we already returned
  early above when empty — keep behavior identical, just don't re-guard.

## Explicitly out of scope
- No "delete salon events from Google on disconnect" button (user decided against it).
- No change to `push.ts`, `pull.ts`, `connect.ts`, or any route handler.
- No change to `clearMasterEventIds` — still runs on disconnect/calendar-change, unchanged.

- [x] `npx tsc --noEmit` clean.
- [x] New/updated test in `tests/lib/google-calendar/outbox.test.ts` (check whether this file
      exists; if not, check the nearest existing outbox test file) covering: (a) an appointment
      whose Google event already exists (mocked `listEvents` returns an item with the matching
      `salonAppointmentId` marker) gets `googleEventId` set directly and still gets a normal
      UPSERT task queued (patches, not re-inserts, on drain); (b) `listEvents` throwing/rejecting
      does not throw out of `enqueueBackfillForMaster` and falls back to today's behavior
      (all appointments queued, none adopted); (c) no `googleCalendarId` on the profile skips the
      Google call entirely (existing behavior, unaffected by the new code path).
- [x] `npx vitest run tests/lib/google-calendar/` green.
- [x] Update `src/lib/AGENTS.md`'s Google Calendar bullet: one sentence noting
      `enqueueBackfillForMaster` now adopts (matches by `salonAppointmentId`) existing Google
      events instead of blindly re-inserting, so disconnect-then-reconnect to the same calendar no
      longer duplicates events.
