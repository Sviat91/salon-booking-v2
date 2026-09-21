# Plan: Google Calendar two-way sync

**Date:** 2026-09-21
**Status:** In Progress — Stage 1 approved by the user 2026-09-21; Stage 2 NOT yet approved (stop after Stage 1 for manual verification)

> **User decisions (2026-09-21):** Assumption 1 → **option 1** (a Google-side time change notifies only the salon's Telegram recipients via the existing `notifyBookingUpdate()`; the client is NOT notified — user will think about a client-facing "appointment moved" feature separately, out of scope). Assumption 2 (scheduler ships in Stage 1, push-only) accepted. All other assumptions accepted as written. Implement **Stage 1 only**, then stop.
**Source brief:** `handoff/google-calendar-sync_requirements.md` (all "Locked decisions" honoured unless listed under "Assumptions to confirm" below)

## Goal

Give every master an offline-readable copy of her schedule by pushing site appointments into her own Google Calendar (Stage 1) and pulling her Google-side edits back into the site (Stage 2), using one salon-wide Google service account.

---

## Assumptions to confirm

Read this section before starting. Items marked **[BLOCKING]** change what gets built if the user disagrees.

1. **[BLOCKING] "The client is notified like any time change" is not what the code does today.**
   The brief (locked decision 4) says a Google-side time move should "send the usual change notification ... client is notified like any time change". Verified: `notifyBookingUpdate()` (`src/lib/notifications/index.ts:210`) returns immediately unless `notifTelegramEnabled && telegramBotToken`, and only broadcasts to the **salon's** Telegram recipients. It sends the client **nothing** — no email, no SMS, no client Telegram. `src/lib/AGENTS.md` confirms this is deliberate.
   **This plan implements "the same as any other time change" literally** = salon Telegram only, via the existing `notifyBookingUpdate()`. Adding a *new* client-facing "your appointment moved" message is a separate feature and is **out of scope**. If the user actually wants the client emailed when the master drags an event in Google, that is a new notification type and needs its own plan.

2. **[BLOCKING] The scheduler ships in Stage 1, not Stage 2.**
   The brief puts the scheduler in Stage 2. But Stage 1 requires "failure handling/retry so a Google outage never breaks booking", and retry needs a timer. Stage 1 therefore ships `src/lib/google-calendar/scheduler.ts` running **push-only** (drains the outbox). Stage 2 adds the pull pass to the *same* file. No rewrite, both stages independently shippable.

3. **No new npm dependency.** Neither `googleapis` nor `google-auth-library` is added. A service-account access token is a RS256-signed JWT exchanged at `https://oauth2.googleapis.com/token` — Node's built-in `node:crypto` (`createSign('RSA-SHA256')`) signs it in ~15 lines, and the five Calendar REST endpoints we need are plain `fetch` calls. This matches the house style already used for Twilio, SMSAPI.pl and Telegram (`src/lib/notifications/sms/*`, `telegram.ts`) and avoids a ~100 MB transitive dependency graph for 5 endpoints. **Verify during Step 1.2** that `crypto.createSign('RSA-SHA256').sign(pem)` accepts the PKCS#8 `-----BEGIN PRIVATE KEY-----` PEM that Google ships in the JSON key (it does; it is a standard PKCS#8 RSA key).

4. **Central mutation hook = explicit `enqueueAppointmentSync(...)` calls, not a Prisma `$extends` client extension.** Three reasons, all verified in-repo:
   - Five mutation sites run inside `prisma.$transaction` (`booking-service.ts:247`, `bookings/[id]:195`, `bookings/update-time:174`, `client/link-bookings:54`, `auth/register:119`). A `$extends` query hook fires **inside** the transaction; doing I/O or an extra write there widens the double-booking race window the repo deliberately closed.
   - Two sites use `updateMany` (`client/link-bookings`, `auth/register`), which returns a count, not rows — an extension cannot know which appointments changed.
   - Stage 2's pull path **must not** re-enqueue a push for a change that came *from* Google. With explicit calls, "don't call it" is the loop guard and it is visible in the diff. With `$extends` it would need a magic context flag.
   An explicit call is one line per site and `tsc` cannot catch a missed one — mitigated by the exhaustive site list in Step 1.9 and a manual grep verification command.

5. **Failure strategy = outbox table (`CalendarSyncTask`), not best-effort + reconcile.** A reconcile pass would have to diff every future appointment against Google on a schedule (expensive, quota-hungry, and needs the same mapping code anyway). The outbox is one table, one drain function, and gives "a Google outage never breaks booking" for free: the request only writes a local row.

6. **Echo suppression is state comparison, not etag/`updated` bookkeeping.** On pull, an event carrying our `extendedProperties.private.salonAppointmentId` is compared against the appointment's *current* `date`/`startTime`/`endTime`. Equal → no-op (that is our own echo). Different → apply. This is self-correcting and needs no extra columns. Consequence: **`Appointment` gets only `googleEventId`**, no `googleEtag`/`googleUpdatedAt`.
   Edge case handled explicitly: if a master **duplicates** a site event in Google, the copy carries the same `salonAppointmentId` but a different event id. Rule: marker present **AND** `appointment.googleEventId === event.id` → site event; marker present but id mismatch → treat as a **foreign event** (external block). It will then surface as a conflict, which is honest.

7. **Conflict display is computed client-side; only conflict *notification* dedup is persisted.** No `hasConflict` column. `ModernCalendar` computes overlaps over the entries it already fetched (covers appointment↔appointment, appointment↔external, external↔external in one pass, zero new props to the four views). Notification dedup uses `ExternalCalendarBlock.conflictNotifiedAt`, cleared whenever the block's times change.

8. **`Appointment.date` semantics.** Existing rows store `new Date("YYYY-MM-DD")` = UTC midnight, with `startTime`/`endTime` as Warsaw wall-clock strings (confirmed in `booking-service.ts:95-98` and `notifications/internal.ts`'s `appointmentStartUtc`). `ExternalCalendarBlock` **must use the identical convention** so `fetchBusyRanges()` and the calendar views need no special casing.

9. **Google incremental-sync parameter rules are handled defensively, not assumed.** Google rejects `syncToken` combined with `timeMin`/`timeMax`/`q`/`orderBy`, and the exact carry-over semantics of an initial windowed request are not worth gambling on. The implementation therefore: (a) full sync uses `timeMin`/`timeMax`; (b) incremental sync sends **only** `syncToken` + `singleEvents=true` + `showDeleted=true` + `maxResults`; (c) **any** 400/410 from a `syncToken` request clears the token and falls back to a full sync on the next tick; (d) the importer filters to the future window itself regardless of what the feed returns, so a feed containing history is harmless.

10. **Single-replica assumption.** Each salon is one container (`deploy/`), so the in-process scheduler needs no distributed lock. A future multi-replica deploy would poll N times — documented as a known limit in `src/lib/AGENTS.md`, not solved here.

11. **Google event text is Polish and hardcoded, not i18n.** Event description labels ("Telefon:", "Usługa:", ...) follow the existing repo rule that **salon-facing** copy stays `DEFAULT_LANGUAGE`/hardcoded Polish (`src/lib/AGENTS.md`, `actorLabel`, `buildBookingUpdateMessage`). Only **site UI** text gets pl/en/uk keys. This is deliberate, not an i18n-parity violation.

12. **GDPR erasure scrub = re-push, not delete.** `eraseConsentData()` anonymises the `User` row (`name: "Deleted User"`, `phone: null`). Re-pushing every appointment of those users that has a `googleEventId` (past **and** future) rewrites the Google event with the anonymised text. We never created events for appointments without a `googleEventId`, so this is complete coverage.

13. **Risk accepted: a missed `enqueue` call site is silent.** No type error, no test failure — the event just never appears in Google. Mitigated by the grep verification in each stage and by the manual checklist.

14. **Not built (explicitly out of scope, per "keep v1 minimal"):** deleting a Google-origin event from the site UI; applying Google-side title/description edits back onto a site event (brief's ORCHESTRATOR DEFAULT, kept); per-master service accounts; the service account creating/sharing calendars itself (brief's possible Stage 3); per-master Telegram bots.

---

## Architecture Decisions

| Decision | Choice | Why |
|---|---|---|
| Google auth | Hand-rolled JWT-bearer via `node:crypto` + `fetch` | No dependency; matches `sms/twilio.ts` style |
| Credential storage | `TenantConfig.googleServiceAccountKey` encrypted via `src/lib/encryption.ts`; `googleServiceAccountEmail` plaintext | Key is a secret, SA email is not (masters must be told whom to share with) |
| Per-master opt-in | `MasterProfile.googleCalendarId` (plaintext) | Not a secret; clearing it = disconnect |
| Push trigger | Explicit `enqueueAppointmentSync()` at 15 mutation sites | See Assumption 4 |
| Push delivery | `CalendarSyncTask` outbox + in-process drain with exponential backoff | See Assumption 5 |
| Pull | 60 s incremental `syncToken` poll per connected master | Brief's locked decision 8 |
| Echo suppression | State comparison | See Assumption 6 |
| Foreign events | New `ExternalCalendarBlock` table, `Appointment`-compatible `date`/`startTime`/`endTime` | `Appointment` requires `clientId`+`serviceId`; matching shape keeps availability + rendering trivial |
| Availability integration | Single union inside `fetchBusyRanges()` (`src/lib/schedule-utils.ts`) | One change covers `getDaySlots`, `getAvailableDays`, and `check-extension` |
| Booking conflict checks | Explicit overlap query at the 5 sites that actually re-check (`booking-service.ts` ×2, `client/appointments/[id]`, `bookings/[id]`, `bookings/update-time`) | Verified: admin/master manual-create routes do **no** overlap check at all — they rely on the availability-aware time picker, which `fetchBusyRanges` already covers |
| Timezone | `SCHEDULE_TZ` from `src/lib/schedule-utils.ts` everywhere, via `date-fns-tz` | Brief's locked decision 9; one swap point for the Ukraine launch |
| Scheduler | `globalThis`-keyed singleton interval started from `src/instrumentation.ts` | Mirrors `telegram-bot/lifecycle.ts`; HMR-safe; never throws |

### New module layout (all files budgeted < 500 lines)

```
src/lib/google-calendar/
  config.ts         # pure: parseServiceAccountKey, normalizeCalendarId, isGoogleSyncEnabled   (~90)
  auth.ts           # SA key decrypt, JWT mint, access-token cache                             (~130)
  client.ts         # REST wrapper + GoogleApiError                                            (~170)
  event-mapping.ts  # pure: appointment -> Google event body                                   (~130)  [S1]
  outbox.ts         # enqueue* / drainOutbox / kickOutbox                                      (~190)  [S1]
  push.ts           # processSyncTask (insert/patch/delete)                                    (~160)  [S1]
  scheduler.ts      # singleton tick loop                                                      (~140)  [S1, extended S2]
  import-mapping.ts # pure: Google event -> block rows, classification, time compare           (~160)  [S2]
  pull.ts           # pullMasterCalendar: list -> classify -> apply                            (~230)  [S2]
  blocks.ts         # ExternalCalendarBlock query helpers for availability/calendar reads       (~80)  [S2]
  conflicts.ts      # pure overlap finder + never-throw conflict notifier                      (~120)  [S2]
```

---

# Stage 1 — Connection + push (site → Google)

Ships on its own: a master sees every site booking in her Google Calendar app, offline. Nothing is read back yet.

## Implementation Steps — Stage 1

### 1.1 Schema + migration

- [x] **Step 1.1** Add fields/model to `prisma/schema.prisma`, then generate the migration.
  - Files: `prisma/schema.prisma`, `prisma/migrations/<ts>_google_calendar_push/migration.sql`
  - `model TenantConfig` — add after the SMS block:
    ```prisma
    // Google Calendar sync — one service account per salon instance.
    // googleServiceAccountKey is the full JSON key, encrypted via src/lib/encryption.ts.
    // googleServiceAccountEmail is NOT a secret: masters must share their calendar with it.
    googleCalendarEnabled     Boolean @default(false)
    googleServiceAccountKey   String?  // encrypted
    googleServiceAccountEmail String?  // plaintext, extracted from the key at save time
    ```
  - `model MasterProfile` — add after `footerBlock`:
    ```prisma
    googleCalendarId String?   // empty/null = not connected
    googleSyncToken  String?   // null = do a full sync on the next tick
    googleSyncStatus String?   // "ok" | "error" | null (never connected)
    googleSyncError  String?
    googleSyncedAt   DateTime?
    ```
  - `model Appointment` — add after `clientLanguage`:
    ```prisma
    googleEventId String?  // id of the mirrored Google event; null = never pushed
    ```
  - New model (no FK to `Appointment` — the row must survive a hard delete):
    ```prisma
    // Outbox for site -> Google Calendar pushes. One row per appointment max:
    // an UPSERT followed by a DELETE overwrites (DELETE wins), and a DELETE can
    // never be followed by an UPSERT because the appointment is gone.
    model CalendarSyncTask {
      id            String   @id @default(cuid())
      appointmentId String   @unique
      masterId      String
      operation     String   // "UPSERT" | "DELETE"
      googleEventId String?  // required for DELETE (captured before the row was deleted)
      calendarId    String?  // snapshot, so a later disconnect doesn't orphan the delete
      attempts      Int      @default(0)
      nextAttemptAt DateTime @default(now())
      lastError     String?
      createdAt     DateTime @default(now())
      updatedAt     DateTime @updatedAt

      @@index([nextAttemptAt])
    }
    ```
  - All additions are nullable or defaulted → the migration is additive and safe on existing instance data (required: `deploy/docker-entrypoint.sh` runs `prisma migrate deploy` on start).
  - Generate per `prisma/AGENTS.md`: `npx prisma migrate dev --name google_calendar_push`. If the shell is non-interactive, use the documented `prisma migrate diff --from-migrations ... --script` fallback.

### 1.2 Google auth + REST client (no new dependency)

- [x] **Step 1.2** Create `src/lib/google-calendar/config.ts` — **pure, zero Prisma, zero React** (unit-testable with no mocks).
  - `export interface ServiceAccountKey { clientEmail: string; privateKey: string }`
  - `export function parseServiceAccountKey(json: string): ServiceAccountKey | null` — `JSON.parse` in a try/catch; require `type === 'service_account'`, non-empty `client_email`, and a `private_key` containing `BEGIN PRIVATE KEY`; return `null` otherwise. Never throws, never logs the key.
  - `export function normalizeCalendarId(raw: string | null | undefined): string | null` — trim, lowercase, return `null` for empty; accept only `/^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+$/` (covers `...@group.calendar.google.com` and a bare gmail address) **or** the literal `primary`. Return `null` for anything else.
  - `export function isGoogleSyncEnabled(config: { googleCalendarEnabled?: boolean | null; googleServiceAccountKey?: string | null }): boolean` — both truthy.
  - `export const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar'`
  - `export const SYNC_WINDOW_DAYS = 400` (how far forward we push/import).

- [x] **Step 1.3** Create `src/lib/google-calendar/auth.ts`.
  - `async function loadServiceAccount(): Promise<ServiceAccountKey | null>` — `getTenantConfig()` → `isGoogleSyncEnabled` → `decrypt(config.googleServiceAccountKey)` → `parseServiceAccountKey`. Returns `null` (never throws) when disabled/unconfigured/corrupt.
  - `export async function getAccessToken(): Promise<string | null>`:
    - Module-level cache `{ token: string; expiresAt: number; clientEmail: string }`. Reuse while `Date.now() < expiresAt - 60_000` **and** `clientEmail` matches the current key (so an admin key change invalidates it).
    - Build JWT: header `{ alg: 'RS256', typ: 'JWT' }`, claims `{ iss: clientEmail, scope: GOOGLE_CALENDAR_SCOPE, aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 }`, base64url-encode both, sign with `crypto.createSign('RSA-SHA256').update(signingInput).sign(privateKey)` → base64url.
    - `POST https://oauth2.googleapis.com/token` with `application/x-www-form-urlencoded` body `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=<jwt>`, `AbortSignal.timeout(10_000)` (same 10 s rule as `sms/twilio.ts`).
    - On non-2xx or a network error: log `[google-calendar auth]` + the HTTP status **only** (never the body, never the key) and return `null`.
  - `export async function getServiceAccountEmail(): Promise<string | null>` — reads `TenantConfig.googleServiceAccountEmail` (plaintext column; do not re-decrypt the key for this).
  - `export function resetAccessTokenCache(): void` — called by the settings PATCH route after a key change.

- [x] **Step 1.4** Create `src/lib/google-calendar/client.ts`.
  - `export class GoogleApiError extends Error { constructor(public status: number, public reason: string, message: string) }` — `reason` from the first `error.errors[0].reason` in the JSON body, else `''`.
  - `export function isRetryable(err: unknown): boolean` — `true` for status `429`, `500`, `502`, `503`, `504`, and for non-`GoogleApiError` (network) failures; `false` for `400`, `401`, `403`, `404`, `410`.
  - Private `async function call<T>(method, path, { query?, body? }): Promise<T>` — prefixes `https://www.googleapis.com/calendar/v3`, adds `Authorization: Bearer <getAccessToken()>` (throws `GoogleApiError(401,'no_token', ...)` when the token is null), `AbortSignal.timeout(15_000)`, parses JSON, throws `GoogleApiError` on non-2xx. `DELETE` returning 204 with an empty body must not attempt `res.json()`.
  - Exports, each `calendarId` URL-encoded with `encodeURIComponent`:
    - `getCalendar(calendarId): Promise<{ id: string; summary?: string; timeZone?: string }>` — `GET /calendars/{id}`
    - `insertEvent(calendarId, body): Promise<{ id: string }>` — `POST /calendars/{id}/events`
    - `patchEvent(calendarId, eventId, body): Promise<{ id: string }>` — `PATCH /calendars/{id}/events/{eventId}`
    - `deleteEvent(calendarId, eventId): Promise<void>` — `DELETE`; **swallow 404/410** (already gone = success)
    - `listEvents(calendarId, params): Promise<{ items: GoogleEvent[]; nextPageToken?: string; nextSyncToken?: string }>` — `GET /calendars/{id}/events`
  - `export interface GoogleEvent { id: string; status?: string; summary?: string; description?: string; transparency?: string; start?: { dateTime?: string; date?: string; timeZone?: string }; end?: { ... }; extendedProperties?: { private?: Record<string, string> } }`
  - Never log a request/response body.

### 1.3 Event mapping (pure)

- [x] **Step 1.5** Create `src/lib/google-calendar/event-mapping.ts` — **pure**: imports only `date-fns-tz`, `SCHEDULE_TZ`, `resolveLocalized`, `DEFAULT_LANGUAGE`. No Prisma, no `fetch`.
  - `export const SALON_EVENT_MARKER = 'salonSync'` / `export const SALON_APPOINTMENT_KEY = 'salonAppointmentId'`
  - `export function toGoogleDateTime(date: Date, hhmm: string): string` — build `` `${formatInTimeZone(date, 'UTC', 'yyyy-MM-dd')}T${hhmm}:00` ``, `fromZonedTime(..., SCHEDULE_TZ)`, then `formatInTimeZone(utc, SCHEDULE_TZ, "yyyy-MM-dd'T'HH:mm:ssXXX")`. (`Appointment.date` is UTC midnight — read the calendar date in UTC, then interpret the wall-clock in `SCHEDULE_TZ`, exactly like `notifications/internal.ts`'s `appointmentStartUtc`.) **Do not** build the instant from a raw `` `${d}T${t}:00.000Z` `` string.
  - ```ts
    export interface EventSourceAppointment {
      id: string
      date: Date
      startTime: string
      endTime: string
      status: string
      notes: string | null
      finalPrice: number | null
      client: { name: string | null; phone: string | null }
      master: { name: string | null }
      service: { name_pl: string; name_en: string | null; name_uk: string | null }
    }
    ```
  - `export function buildEventSummary(a: EventSourceAppointment): string` → `` `${a.client.name?.trim() || 'Klient'} — ${resolveLocalized({pl,en,uk}, DEFAULT_LANGUAGE)}` `` (em dash, matching the site calendar's two-line label).
  - `export function buildEventDescription(a, brandName: string): string` — newline-joined, skipping empty values, hardcoded Polish (see Assumption 11):
    `Telefon: <phone>` · `Usługa: <service pl>` · `Cena: <finalPrice> zł` (omit when null or 0) · `Mistrz: <master name>` · `Status: <status>` · `Notatka: <notes>` · `` · `Utworzono przez <brandName>. Zmiana godziny w tym kalendarzu zostanie przeniesiona na stronę.`
  - `export function appointmentToEventBody(a, brandName): Record<string, unknown>` — `{ summary, description, start: { dateTime: toGoogleDateTime(a.date, a.startTime), timeZone: SCHEDULE_TZ }, end: {...endTime...}, extendedProperties: { private: { [SALON_APPOINTMENT_KEY]: a.id, [SALON_EVENT_MARKER]: 'v1' } } }`

### 1.4 Outbox + push worker

- [x] **Step 1.6** Create `src/lib/google-calendar/outbox.ts`. **Every exported function is `async`, returns `void`/a result object, and never throws** (same contract as `src/lib/notifications/`).
  - `export async function enqueueAppointmentSync(appointmentId: string): Promise<void>` — no-op if `!isGoogleSyncEnabled(await getTenantConfig())`. Reads `{ masterId }` from the appointment; if missing, returns. `prisma.calendarSyncTask.upsert({ where: { appointmentId }, create: { appointmentId, masterId, operation: 'UPSERT' }, update: { operation: 'UPSERT', attempts: 0, nextAttemptAt: new Date(), lastError: null } })`. Then `kickOutbox()`.
  - `export async function enqueueAppointmentDelete(input: { appointmentId: string; masterId: string; googleEventId: string | null }): Promise<void>` — no-op when `!googleEventId` or sync disabled. Resolves `calendarId` from `MasterProfile.googleCalendarId` via `userId: masterId`. `upsert` with `operation: 'DELETE'` (DELETE always wins over a pending UPSERT). Then `kickOutbox()`.
  - `export async function enqueueSyncForUsers(userIds: string[]): Promise<void>` — no-op if empty or disabled. Finds every appointment where `clientId in userIds` **and** (`googleEventId != null` **or** `date >= todayUtcMidnight`); enqueues an UPSERT for each (cap 500). Used by GDPR erasure and the two guest-account-linking routes.
  - `export async function enqueueBackfillForMaster(masterId: string): Promise<{ queued: number }>` — every appointment of that master with `status != 'CANCELLED'` and `date >= todayUtcMidnight` and `date <= today + SYNC_WINDOW_DAYS`; UPSERT each.
  - `export async function clearMasterEventIds(masterId: string): Promise<void>` — `appointment.updateMany({ where: { masterId }, data: { googleEventId: null } })`. Called when the calendar ID changes or is cleared, so a reconnect re-inserts instead of patching a stale id in the wrong calendar.
  - `export async function drainOutbox(limit = 25): Promise<{ processed: number; failed: number }>` — module-level `let draining = false` guard (returns `{0,0}` while another drain is in flight). Loads `nextAttemptAt <= now`, `orderBy: { nextAttemptAt: 'asc' }`, `take: limit`. For each, `await processSyncTask(task)` (from `push.ts`) **sequentially**:
    - success → `calendarSyncTask.delete`
    - failure → `attempts + 1`; when `attempts >= 8`, delete the task and write `lastError` to `MasterProfile.googleSyncError` + `googleSyncStatus: 'error'`; otherwise `nextAttemptAt = now + min(30s * 2^attempts, 30min)` and store `lastError` (truncated to 300 chars).
  - `export function kickOutbox(): void` — if not already scheduled, `setTimeout(() => { void drainOutbox() }, 250)` with the handle `.unref?.()`. Never awaited by a request handler.

- [x] **Step 1.7** Create `src/lib/google-calendar/push.ts`.
  - `export async function processSyncTask(task: CalendarSyncTask): Promise<{ ok: true } | { ok: false; retryable: boolean; error: string }>`
  - `DELETE`: resolve `calendarId` (task snapshot ?? master's current); if neither or no `googleEventId` → `{ ok: true }`. Call `deleteEvent`; 404/410 already swallowed by the client.
  - `UPSERT`:
    1. Load the appointment with `client: { select: { name, phone } }`, `master: { select: { name } }`, `service: { select: { name_pl, name_en, name_uk } }`. Missing → `{ ok: true }`.
    2. Resolve the master's `googleCalendarId` via `masterProfile.findUnique({ where: { userId: task.masterId } })` → `normalizeCalendarId`. Null → `{ ok: true }` (disconnected).
    3. `status.startsWith('CANCELLED')` → if `googleEventId`, `deleteEvent` then `appointment.update({ googleEventId: null })`; `{ ok: true }`.
    4. Skip history: `date < todayUtcMidnight && !googleEventId` → `{ ok: true }`.
    5. `body = appointmentToEventBody(appointment, (await getTenantConfig()).brandName ?? DEFAULT_BRAND_NAME)` (`DEFAULT_BRAND_NAME` from `src/lib/constants/brand.ts`).
    6. `googleEventId` set → `patchEvent`; on `GoogleApiError` with status 404/410 → clear `googleEventId` and fall through to insert. Otherwise `insertEvent` → persist `googleEventId`.
    7. On success also set `MasterProfile.googleSyncStatus = 'ok'`, `googleSyncError = null`, `googleSyncedAt = new Date()`.
  - Catch everything; map to `{ ok: false, retryable: isRetryable(err), error: describe(err) }`. `retryable === false` → the caller (`drainOutbox`) jumps `attempts` straight to 8 so it is dropped after one try, recording the error on the master.

### 1.5 Scheduler + boot

- [x] **Step 1.8** Create `src/lib/google-calendar/scheduler.ts`.
  - HMR-safe singleton: `const KEY = Symbol.for('salon.googleCalendarScheduler')` stored on `globalThis`, holding `{ timer: NodeJS.Timeout | null }`. `startCalendarScheduler()` returns immediately if `timer` is already set.
  - `export function startCalendarScheduler(): void` — `setInterval(tick, 30_000)`, `.unref?.()`, plus one `setTimeout(tick, 5_000)` warm-up.
  - `async function tick(): Promise<void>` — wrapped in try/catch that only `console.error`s; Stage 1 body is `await drainOutbox()`.
  - `export function stopCalendarScheduler(): void` — clears and nulls the timer.
- [x] **Step 1.9** Wire boot in `src/instrumentation.ts`.
  - Inside the **existing** `if (process.env.NEXT_RUNTIME === 'nodejs') { ... }` block (do not add a second `if`, do not convert it to an early return — see the comment already in that file), add a second try/catch:
    ```ts
    try {
      const { startCalendarScheduler } = await import('@/lib/google-calendar/scheduler')
      startCalendarScheduler()
    } catch (err) {
      console.error('[instrumentation] failed to start calendar scheduler:', err)
    }
    ```

### 1.6 Wire every appointment mutation

- [x] **Step 1.10** Add `enqueueAppointmentSync(...)` / `enqueueAppointmentDelete(...)` at **all 15 sites**. Every call is fire-and-forget in the existing style: `enqueueAppointmentSync(id).catch(console.error)` — never `await`ed, always **after** the write/transaction has committed.

  | # | File | Line (current) | Call |
  |---|---|---|---|
  | 1 | `src/lib/booking-service.ts` | after `const created = outcome.appointment` (L299) | `enqueueAppointmentSync(created.id)` |
  | 2 | `src/app/api/admin/calendar/appointments/route.ts` | after `createdAppointments.push(appt)` (L158) | `enqueueAppointmentSync(appt.id)` |
  | 3 | `src/app/api/master/appointments/route.ts` | after the `prisma.appointment.create` (L200) | `enqueueAppointmentSync(appt.id)` |
  | 4 | `src/app/api/admin/calendar/appointments/[id]/route.ts` PUT | after L112 update | `enqueueAppointmentSync(updated.id)` |
  | 5 | `src/app/api/admin/calendar/appointments/[id]/route.ts` DELETE | after L37 delete | `enqueueAppointmentDelete({ appointmentId, masterId, googleEventId })` — add `googleEventId: true` + `masterId: true` to the pre-delete `select` that already feeds `notifyBookingCancellation` |
  | 6 | `src/app/api/master/appointments/[id]/route.ts` PUT | after L55 update | `enqueueAppointmentSync(updated.id)` |
  | 7 | `src/app/api/master/appointments/[id]/route.ts` DELETE | after L109 delete | `enqueueAppointmentDelete({...})`, same pre-delete select extension |
  | 8 | `src/app/api/master/appointments/[id]/route.ts` PATCH/2nd PUT | after L183 update | `enqueueAppointmentSync(updated.id)` |
  | 9 | `src/app/api/client/appointments/[id]/route.ts` | after L182 update | `enqueueAppointmentSync(...)` |
  | 10 | `src/app/api/client/appointments/[id]/route.ts` | after L254 update | `enqueueAppointmentSync(updated.id)` |
  | 11 | `src/app/api/bookings/cancel/route.ts` | after L116 update | `enqueueAppointmentSync(updated.id)` (push sees `CANCELLED` and deletes the event) |
  | 12 | `src/app/api/bookings/update-time/route.ts` | **after** the `$transaction` resolves (post-L174) | `enqueueAppointmentSync(eventId)` |
  | 13 | `src/app/api/bookings/update-procedure/route.ts` | after L150 update | `enqueueAppointmentSync(...)` |
  | 14 | `src/app/api/bookings/[id]/route.ts` PATCH | **after** the `$transaction` resolves (post-L195) | `enqueueAppointmentSync(appointmentId)` |
  | 15 | `src/lib/discounts/server.ts` `resnapshotAppointmentPrice` | after L290 update | `enqueueAppointmentSync(appointmentId)` (price line in the description) |

  Plus the two **guest-account linking** paths, which change the client identity on many appointments at once:
  - `src/app/api/client/link-bookings/route.ts` — after the `$transaction` (post-L54): `enqueueSyncForUsers([<the target user id>])`
  - `src/app/api/auth/register/route.ts` — after the `$transaction` (post-L119): `enqueueSyncForUsers([<new user id>])`

- [x] **Step 1.11** GDPR erasure scrub. In `src/lib/consent-service.ts`, immediately after the `eraseConsentData` `$transaction` resolves and **before** the return, add:
  ```ts
  if (uniqueUserIds.length > 0) {
    void enqueueSyncForUsers(uniqueUserIds)
  }
  ```
  `enqueueSyncForUsers` must never throw (it is called under Prisma-mocked tests where `prisma.calendarSyncTask` may be undefined) — wrap its whole body in try/catch. After this change, run `npx vitest run tests/app/api/consents/` and add `calendarSyncTask: { upsert: vi.fn() }` / `appointment: { findMany: vi.fn().mockResolvedValue([]) }` to those files' prisma mocks if anything goes red (`prisma/AGENTS.md` rule: a schema change requires updating the mocks).

### 1.7 API routes

- [x] **Step 1.12** `src/app/api/admin/google-calendar-settings/route.ts` (ADMIN/SUPERADMIN, `export const runtime = 'nodejs'`). Mirrors `admin/client-bot-settings/route.ts` + the masking rule from `admin/sms-settings/route.ts`.
  - `GET` → `{ googleCalendarEnabled, serviceAccountEmail, hasKey: boolean, masters: [{ id, name, calendarId, syncStatus, syncError, syncedAt }] }`. **Never** returns the key — only `hasKey`. `masters` = every `User` with `role: 'MASTER'` joined to its `MasterProfile`.
  - `PATCH { googleCalendarEnabled?: boolean; serviceAccountKey?: string }` (Zod, `serviceAccountKey` max 8192):
    - A submitted `"••••••••"` means "keep existing" (SMS-settings convention).
    - Otherwise `parseServiceAccountKey`; `null` → `400 { code: 'GOOGLE_KEY_INVALID' }`.
    - Store `encrypt(rawJson)` in `googleServiceAccountKey` and the parsed `clientEmail` **plaintext** in `googleServiceAccountEmail`.
    - An empty string clears both fields.
    - Then `invalidateTenantConfigCache()` (mandatory per `src/lib/AGENTS.md`) and `resetAccessTokenCache()`.
- [x] **Step 1.13** `src/app/api/admin/google-calendar-settings/test/route.ts` — `POST {}` → `getAccessToken()`; null → `400 { code: 'GOOGLE_KEY_INVALID' }`; else `200 { ok: true, serviceAccountEmail }`. Mirrors `admin/email-settings/test`.
- [x] **Step 1.14** `src/app/api/admin/masters/[masterId]/google-calendar/route.ts` (ADMIN/SUPERADMIN):
  - `PUT { calendarId: string }` → shared handler (below) for `masterId` from the path.
  - `POST` (path `.../test`, separate `test/route.ts`) → `getCalendar(calendarId)`; map `GoogleApiError` 404 → `{ code: 'GOOGLE_CALENDAR_NOT_FOUND' }`, 403 → `{ code: 'GOOGLE_NO_ACCESS' }`, anything else → `{ code: 'GOOGLE_API_ERROR' }`.
- [x] **Step 1.15** `src/app/api/master/google-calendar/route.ts` (role `MASTER`, always `session.user.id`, **never** a `masterId` param):
  - `GET` → `{ serviceAccountEmail, enabled, calendarId, syncStatus, syncError, syncedAt }` — the SA **email** is returned (not a secret; she needs it to share her calendar). The key is never exposed here.
  - `PUT { calendarId }` → shared handler.
  - `src/app/api/master/google-calendar/test/route.ts` → `POST`, same mapping as 1.14.
- [x] **Step 1.16** Shared connect handler, `src/lib/google-calendar/connect.ts` (keeps the two routes thin and identical):
  ```ts
  export async function setMasterCalendarId(masterId: string, rawCalendarId: string):
    Promise<{ ok: true; queued: number } | { ok: false; code: 'VALIDATION_ERROR' | 'NOT_FOUND' }>
  ```
  - Empty input → clear `googleCalendarId`/`googleSyncToken`/`googleSyncStatus`/`googleSyncError`, `clearMasterEventIds(masterId)`, return `{ ok: true, queued: 0 }` (disconnect).
  - `normalizeCalendarId` → `null` → `{ ok: false, code: 'VALIDATION_ERROR' }`.
  - Unchanged value → return `{ ok: true, queued: 0 }` (no re-backfill).
  - Changed → write the new id, null out `googleSyncToken`/`googleSyncError`, set `googleSyncStatus: null`, `clearMasterEventIds(masterId)`, then `enqueueBackfillForMaster(masterId)` and return its count.
- [x] **Step 1.17** Add to `KNOWN_ERROR_CODES` in `src/lib/errors/apiErrorKey.ts`: `'GOOGLE_KEY_INVALID'`, `'GOOGLE_CALENDAR_NOT_FOUND'`, `'GOOGLE_NO_ACCESS'`, `'GOOGLE_API_ERROR'`. Add the matching `errors.*` entries to all three locale files (Step 1.21).

### 1.8 UI

- [x] **Step 1.18** Admin settings page. Copy the structure of `src/app/admin/settings/client-bot/`:
  - `src/app/admin/settings/google-calendar/page.tsx` — `async` Server Component, `auth()` + ADMIN/SUPERADMIN redirect to `/admin`, eyebrow `t('admin.settings.configurationEyebrow')` + `t('admin.settings.googleCalendar.pageDesc')`, renders the form. (~35 lines)
  - `src/app/admin/settings/google-calendar/loading.tsx` — `FormSkeleton` (the page is `async`). (~10 lines)
  - `src/app/admin/settings/google-calendar/GoogleCalendarSettingsForm.tsx` — `"use client"`, react-hook-form + zodResolver, `<form id="settings-form">` + the `settings-dirty` `CustomEvent` wiring (copy verbatim from `ClientBotSettingsForm.tsx`), `FormSkeleton` while loading with **no translated text** (hydration rule already documented in that file). Two `SettingsSection`s:
    1. **Service account** — `googleCalendarEnabled` `ToggleRow`, a `<Textarea rows={5}>`-style key field bound via `FormField`/`Controller` (**never** `register()` — see `src/app/admin/AGENTS.md`), placeholder `"••••••••"` when `hasKey`, a read-only SA email row with a copy-to-clipboard button, and a "Test connection" button hitting `/api/admin/google-calendar-settings/test`.
    2. **Masters** — one `MasterCalendarField` per master (Step 1.20).
    Plus `GoogleCalendarInstructions.tsx` rendered as the first child of section 1. `handleSubmit` **must** be given an `onInvalid` callback (documented repo rule). (~230 lines)
  - `src/app/admin/settings/google-calendar/GoogleCalendarInstructions.tsx` — display-only, mirrors `notifications/SmsInstructions.tsx` markup exactly (three closed-by-default native `<details>`, no outer `Card`): "Google Cloud setup", "Sharing a calendar with the service account", "Troubleshooting". Touches no form state. (~110 lines)
- [x] **Step 1.19** Master panel page:
  - `src/app/admin/master/google-calendar/page.tsx` — `async` Server Component, `auth()` + `role !== 'MASTER'` redirect. (~30 lines)
  - `src/app/admin/master/google-calendar/loading.tsx` — `FormSkeleton`. (~10 lines)
  - `src/app/admin/master/google-calendar/MasterGoogleCalendarClient.tsx` — `"use client"`; fetches `GET /api/master/google-calendar`; shows a read-only SA email + copy button, a short "share your calendar with this address, permission = *Make changes to events*" instruction block, the `MasterCalendarField`, and the status badge. When the tenant has no key configured, shows a muted "not configured by the salon yet" notice and hides the input. (~150 lines)
- [x] **Step 1.20** Shared component `src/components/admin/google-calendar/MasterCalendarField.tsx` — `"use client"`, props `{ masterName?: string; initialCalendarId: string; syncStatus: string | null; syncError: string | null; syncedAt: string | null; saveUrl: string; testUrl: string; onSaved?: () => void }`. Renders: label + `Input` + Save + Test + Disconnect buttons + a `Badge variant="success"|"warning"|"muted"` status pill + a truncated last-error line. Errors render via `t(apiErrorKey(code))`, success/failure via `toast` (never `alert`). Used by both pages so the two surfaces can never drift. (~150 lines)
- [x] **Step 1.21** Navigation: in `src/components/admin/adminNavItems.ts` add `{ labelKey: 'admin.nav.googleCalendar', href: '/admin/settings/google-calendar', icon: CalendarCheck }` to `adminNavItems` (after `clientBot`) and `{ labelKey: 'admin.nav.googleCalendar', href: '/admin/master/google-calendar', icon: CalendarCheck }` to `masterNavItems` (last). Import `CalendarCheck` from `lucide-react`. Never hardcode a page title in the page itself — the topbar derives it from this file.

### 1.9 i18n

- [x] **Step 1.22** Add these keys to **all three** of `src/locales/pl.json`, `src/locales/en.json`, `src/locales/uk.json` (pl is the canonical source text; en/uk are real translations, not copies).
  - `admin.nav.googleCalendar`
  - `errors.GOOGLE_KEY_INVALID`, `errors.GOOGLE_CALENDAR_NOT_FOUND`, `errors.GOOGLE_NO_ACCESS`, `errors.GOOGLE_API_ERROR`
  - Under `admin.settings.googleCalendar`:
    `pageDesc`, `masterPageDesc`, `accountSectionTitle`, `accountSectionDesc`, `enableLabel`, `enableDesc`,
    `keyLabel`, `keyPlaceholder`, `keyDesc`, `keyConfiguredHint`, `keyClearHint`,
    `serviceAccountEmailLabel`, `serviceAccountEmailDesc`, `serviceAccountEmailEmpty`, `copyEmailBtn`, `copiedToast`,
    `testKeyBtn`, `testingBtn`, `testKeySuccess`,
    `mastersSectionTitle`, `mastersSectionDesc`,
    `calendarIdLabel`, `calendarIdPlaceholder`, `calendarIdDesc`,
    `saveBtn`, `testCalendarBtn`, `testCalendarSuccess`, `disconnectBtn`, `disconnectConfirm`,
    `statusNotConnected`, `statusOk`, `statusError`, `lastSyncedAt`, `backfillQueued`,
    `notConfiguredNotice`, `loadFailed`, `saveFailed`, `saveSuccess`,
    `instructionsTitle`, `instructionsGcpSummary`, `instructionsGcpBody`, `instructionsShareSummary`, `instructionsShareBody`, `instructionsTroubleshootSummary`, `instructionsTroubleshootBody`
  - `backfillQueued` interpolates `{{count}}`; `lastSyncedAt` interpolates `{{time}}`.
  - Any `<code>`-containing hint uses `<Trans i18nKey=... components={{ code: <code /> }} />`, matching `ClientBotSettingsForm.tsx`.

### 1.10 Tests

- [x] **Step 1.23** `tests/lib/google-calendar/config.test.ts` — **no mocks by design** (module is pure). Cover: valid SA JSON → `{ clientEmail, privateKey }`; missing `type`/`client_email`/`private_key` → `null`; malformed JSON → `null` (does not throw); `normalizeCalendarId` accepts `abc@group.calendar.google.com`, `user@gmail.com`, `primary`, trims + lowercases, rejects `''`, `'  '`, `'not an id'`, `'<script>'`, `null`; `isGoogleSyncEnabled` truth table.
- [x] **Step 1.24** `tests/lib/google-calendar/event-mapping.test.ts` — **no mocks by design**. Cover:
  - `toGoogleDateTime(new Date('2026-01-15T00:00:00.000Z'), '10:00')` → `'2026-01-15T10:00:00+01:00'` (CET)
  - `toGoogleDateTime(new Date('2026-07-15T00:00:00.000Z'), '10:00')` → `'2026-07-15T10:00:00+02:00'` (CEST) — the DST assertion
  - `buildEventSummary` → `'Anna — Masaż twarzy'`; null client name → `'Klient — ...'`
  - `buildEventDescription` omits null phone / null price / null notes; always ends with the brand line
  - `appointmentToEventBody` sets both `extendedProperties.private` keys and `timeZone: 'Europe/Warsaw'` on start **and** end
- [x] **Step 1.25** Re-run the pre-existing suites that touch `Appointment`/`ConsentRecord` and extend their `vi.mock('@/lib/prisma')` objects with `calendarSyncTask` where they go red: `tests/lib/booking-service.test.ts`, `tests/app/api/book/consent-gate.test.ts`, `tests/app/api/consents/*.test.ts`, `tests/app/api/master/appointments/route.test.ts`, `tests/app/api/client/appointments/route.test.ts`, `tests/api/routes.test.ts`.

### 1.11 DOX closeout (Stage 1)

- [x] **Step 1.26** Update the owning docs. Delete stale text, do not append history.
  - `CLAUDE.md` (root) — line 59 currently says *"There is no Google Calendar integration — bookings live entirely in the DB."* Replace with a one-sentence description of the push path + the fact that the DB remains the source of truth. Add `src/lib/google-calendar/` to the **Key Files** table.
  - `src/lib/AGENTS.md` — new `google-calendar/` bullet in **Local Contracts**: module split, never-throw contract, the outbox/`enqueueAppointmentSync` rule ("every new appointment mutation must call it — `tsc` will not catch a miss"), no-new-dependency rationale, the single-replica scheduler limit, and the "push is Polish/`DEFAULT_LANGUAGE`, like every other salon-facing message" rule.
  - `src/app/api/AGENTS.md` — bullet for `admin/google-calendar-settings` (+`/test`), `admin/masters/[masterId]/google-calendar` (+`/test`), `master/google-calendar` (+`/test`): masking rule, `invalidateTenantConfigCache()` requirement, SA-email-is-not-a-secret rule, and that both PUT surfaces go through `setMasterCalendarId()`.
  - `src/app/admin/AGENTS.md` — bullet for the new `settings/google-calendar/` page (shared-sidebar `settings-dirty` form, `SmsInstructions`-style `<details>` panel) and `master/google-calendar/`, plus the shared `MasterCalendarField` component.
  - `src/components/AGENTS.md` — index the new `admin/google-calendar/` folder.
  - `prisma/AGENTS.md` — add `CalendarSyncTask` to the **Ownership** model list; a Local Contract bullet describing the one-row-per-appointment/DELETE-wins rule, `Appointment.googleEventId` semantics, the `MasterProfile.google*` fields, and that `TenantConfig.googleServiceAccountKey` is encrypted while `googleServiceAccountEmail` is deliberately plaintext.
  - `tests/AGENTS.md` — dated bullet for the two new no-mocks test files + the prisma-mock extensions.
  - Report any doc intentionally left unchanged and why.

## Verification — Stage 1

```bash
cd /Users/sviat/Salon_Booking_2.0
npx tsc --noEmit
npx vitest run tests/lib/google-calendar/
npx vitest run                      # full suite must stay green vs. baseline
npm run i18n:check
npx eslint src/lib/google-calendar src/app/admin/settings/google-calendar src/app/admin/master/google-calendar src/app/api/admin/google-calendar-settings src/app/api/master/google-calendar src/components/admin/google-calendar
# every mutation site is wired (expect 17 hits: 15 + 2 enqueueSyncForUsers):
rg -n "enqueueAppointmentSync|enqueueAppointmentDelete|enqueueSyncForUsers" src --glob '!src/lib/google-calendar/**'
# 500-line cap on every touched/created file:
find src/lib/google-calendar src/app/admin/settings/google-calendar src/app/admin/master/google-calendar src/components/admin/google-calendar -name '*.ts*' | xargs wc -l | sort -n
```

Do **not** run `npm run dev` or `npm run build`. Repo-wide `npm run lint` is red at baseline — only "no new errors in touched files" is required.

## Manual checklist — Stage 1 (for the user)

**A. Google Cloud side (once per salon, ~10 min)**
1. Open https://console.cloud.google.com → create a new project (e.g. "Salon Calendar Sync").
2. **APIs & Services → Library** → search "Google Calendar API" → **Enable**.
3. **APIs & Services → Credentials → Create credentials → Service account**. Name it, Create, skip the two optional role/access steps, Done.
4. Click the new service account → **Keys** tab → **Add key → Create new key → JSON** → a `.json` file downloads.
5. Copy the service account's email address from the **Details** tab (looks like `salon-sync@my-project.iam.gserviceaccount.com`).

**B. Salon admin panel**
6. Log in as ADMIN/SUPERADMIN → sidebar → **Google Calendar**.
7. Open the downloaded `.json` in a text editor, copy its **entire** contents, paste into the "Service account key" field.
8. Turn the **Enable** toggle on → **Save Settings**.
9. The "Service account email" row must now show the same address as step 5 (this proves the key parsed). Press **Test connection** → expect a green toast.
10. Reload the page: the key field must show `••••••••` and **never** the real key. (If you can read the key after reload, stop and report it — that is a security bug.)

**C. Connect one master (do this for one master first, not all)**
11. In Google Calendar (web) as the master: left sidebar → the calendar → ⋮ → **Settings and sharing** → **Share with specific people** → **Add people** → paste the service account email → permission **"Make changes to events"** → Send.
12. On the same settings page scroll to **Integrate calendar** → copy **Calendar ID**.
13. Back in the salon admin panel → the master's row in the "Masters" section → paste the Calendar ID → **Save** → **Test** → expect a green toast. A red "no access" means step 11 was not done or the permission is only "See all event details".
14. A toast should report how many existing future appointments were queued.

**D. Verify push**
15. Wait ~30 seconds, then open that master's Google Calendar. Every **future** booking should now be there. Past bookings must **not** appear.
16. Open one event: the title must read `<client name> — <procedure>`; the description must contain the phone, service, price, master and the brand line.
17. In the salon admin calendar, **move** that appointment to another time → wait ~30 s → the Google event moves too.
18. Change the appointment's **procedure** → wait ~30 s → the Google event's title and description update.
19. **Delete** (or cancel) the appointment on the site → wait ~30 s → the Google event disappears.
20. Create a **new** booking through the public booking page → wait ~30 s → it appears in Google.

**E. Failure safety (important)**
21. In the admin panel, replace the master's Calendar ID with garbage (e.g. `nonsense`) → Save → it must be **rejected** with a validation error, not saved.
22. Put a valid-looking but non-shared calendar ID in → Save → Test → expect a "no access" error, and confirm **the site still lets you create a booking normally** (Google failures must never block booking).
23. Restore the correct Calendar ID.
24. Log in as the **master** → her sidebar → **Google Calendar** → she must see the service account email and her own Calendar ID, and be able to change/clear it. She must **not** see the service account key anywhere.
25. Log in as the master and confirm `/admin/settings/google-calendar` (the admin page) redirects her away.

---

# Stage 2 — Pull (Google → site)

Ships on its own, on top of Stage 1. Depends on Stage 1's `auth.ts`/`client.ts`/`scheduler.ts`/`config.ts`.

## Implementation Steps — Stage 2

### 2.1 Schema + migration

- [ ] **Step 2.1** Add `ExternalCalendarBlock` to `prisma/schema.prisma` and migrate (`npx prisma migrate dev --name external_calendar_blocks`).
  ```prisma
  // A Google Calendar event created directly in Google (not by this site).
  // Read-only mirror: blocks availability and renders in the calendar, but has
  // no client, no service, no price, no reminders and no GDPR linkage.
  // date/startTime/endTime deliberately use the exact same convention as
  // Appointment (date = UTC midnight of the Warsaw-local day, times = "HH:MM"
  // Warsaw wall clock) so fetchBusyRanges() and the calendar views need no
  // special casing. A multi-day event produces one row per local day.
  model ExternalCalendarBlock {
    id               String   @id @default(cuid())
    masterId         String
    googleCalendarId String
    googleEventId    String
    title            String?  // raw Google summary; null -> localized fallback at display time
    description      String?  // raw Google description; null -> localized fallback at display time
    date             DateTime
    startTime        String
    endTime          String
    allDay           Boolean  @default(false)
    conflictNotifiedAt DateTime?

    createdAt DateTime @default(now())
    updatedAt DateTime @updatedAt

    master User @relation("MasterExternalBlocks", fields: [masterId], references: [id], onDelete: Cascade)

    @@unique([masterId, googleEventId, date])
    @@index([masterId, date])
  }
  ```
  Add the back-relation on `User`: `externalBlocks ExternalCalendarBlock[] @relation("MasterExternalBlocks")`.
  **Never store translated fallback text** — `title`/`description` hold the raw Google values or `null`.

### 2.2 Import mapping (pure)

- [ ] **Step 2.2** Create `src/lib/google-calendar/import-mapping.ts` — **pure**: `date-fns`, `date-fns-tz`, `SCHEDULE_TZ` only. No Prisma, no `fetch`.
  - `export const MAX_BLOCK_DAYS = 14` — a multi-day event longer than this imports only its first 14 days (guard against a year-long "Vacation" event flooding the table).
  - `export interface BlockRow { date: Date; startTime: string; endTime: string; allDay: boolean }`
  - `export function googleEventToBlocks(event: GoogleEvent): BlockRow[]`
    - All-day (`start.date` set): Google's `end.date` is **exclusive** → emit one row per day in `[start.date, end.date)`, `startTime: '00:00'`, `endTime: '23:59'`, `allDay: true`. A single-day all-day event = 1 row.
    - Timed: convert `start.dateTime`/`end.dateTime` with `formatInTimeZone(new Date(x), SCHEDULE_TZ, 'yyyy-MM-dd')` + `'HH:mm'`. Same local day → 1 row. Crossing midnight → first day `start..'23:59'`, full middle days `'00:00'..'23:59'`, last day `'00:00'..end` (skip the last row entirely when `end === '00:00'`).
    - `date` is built as `new Date(\`${localDateStr}T00:00:00.000Z\`)` (UTC midnight — matches `Appointment.date`).
    - Return `[]` for a missing/unparseable start or end, and truncate at `MAX_BLOCK_DAYS`.
  - `export function classifyEvent(event: GoogleEvent, lookupAppointmentEventId: (appointmentId: string) => string | null | undefined): { kind: 'site'; appointmentId: string } | { kind: 'foreign' } | { kind: 'ignore' }`
    - `status === 'cancelled'` is handled by the caller before this (it needs the deletion branch) — `classifyEvent` returns `'ignore'` for `transparency === 'transparent'` (free/busy = free).
    - Marker present **and** `lookupAppointmentEventId(id) === event.id` → `'site'`; marker present but mismatched → `'foreign'` (a duplicated event, see Assumption 6).
  - `export function eventTimesMatch(event: GoogleEvent, appt: { date: Date; startTime: string; endTime: string }): boolean` — compares the event's Warsaw-local date/start/end to the appointment's; **this is the echo suppressor**.
  - `export function isWithinSyncWindow(row: BlockRow, todayUtcMidnight: Date, windowDays: number): boolean`

### 2.3 Pull engine

- [ ] **Step 2.3** Create `src/lib/google-calendar/blocks.ts` (thin Prisma helpers, so `pull.ts` and `availability` share one query shape):
  - `export async function getExternalRangesForDay(masterId: string, dateISO: string): Promise<Range[]>` — reads blocks for that day, maps `{ start: t2m(startTime), end: t2m(endTime) }`, filters invalid.
  - `export async function hasExternalOverlap(masterId: string, date: Date, startTime: string, endTime: string): Promise<boolean>` — `findFirst({ where: { masterId, date, startTime: { lt: endTime }, endTime: { gt: startTime } } })`, same overlap predicate the appointment checks already use.
  - `export async function listExternalBlocks(masterId: string | null, from: Date, to: Date)` — for the calendar GET routes; `masterId: null` = all masters (admin "all" view). Includes `master: { select: { id, name, masterProfile: { select: { color } } } }`.
- [ ] **Step 2.4** Create `src/lib/google-calendar/pull.ts`.
  - `export async function pullMasterCalendar(masterId: string): Promise<{ ok: boolean; error?: string }>` — never throws.
    1. Load `MasterProfile` by `userId: masterId`; bail if no `googleCalendarId` or sync disabled.
    2. **Incremental** when `googleSyncToken` is set: `listEvents(calendarId, { syncToken, singleEvents: 'true', showDeleted: 'true', maxResults: '250' })`. On `GoogleApiError` with status 410 **or** 400 → null the token and return `{ ok: true }` (next tick does a full sync — Assumption 9).
       **Full** otherwise: `{ timeMin: todayWarsawStart.toISOString(), timeMax: (+SYNC_WINDOW_DAYS days).toISOString(), singleEvents: 'true', showDeleted: 'true', maxResults: '250' }`.
    3. Page through `nextPageToken` (hard cap 20 pages) accumulating `items`; keep `nextSyncToken` from the final page.
    4. For each item, in order, with per-event try/catch so one bad event cannot abort the tick:
       - `status === 'cancelled'`:
         - a site event (its `salonAppointmentId` resolves to an appointment whose `googleEventId === item.id`) and that appointment is not already `CANCELLED` → **cancel through the existing path**: `prisma.appointment.update({ status: 'CANCELLED', googleEventId: null })` after loading the `CancellationAppointment` snapshot, then `notifyBookingCancellation(snapshot, 'google').catch(console.error)`. **Do not** enqueue a push (loop guard).
         - otherwise → `externalCalendarBlock.deleteMany({ where: { masterId, googleEventId: item.id } })`.
       - `transparency === 'transparent'` → `deleteMany` any existing blocks for that event id, then skip.
       - site event with `eventTimesMatch(...)` → **no-op** (this is our own echo).
       - site event with different times → recompute `{ date, startTime, endTime }` from the event (first `BlockRow` only; a site event is always single-day — if `googleEventToBlocks` returns ≠ 1 row or an all-day row, skip it and record `googleSyncError` instead of corrupting the appointment). Load the `previous` snapshot `{ date, startTime, serviceId, serviceName: service.name_pl }`, `prisma.appointment.update(...)`, then `notifyBookingUpdate(id, previous, 'google').catch(console.error)`. **No push enqueue.** Then run conflict detection (Step 2.5) for that appointment.
       - foreign event → `googleEventToBlocks` → filter by `isWithinSyncWindow` → `upsert` one row per day on `@@unique([masterId, googleEventId, date])` with `title: item.summary ?? null`, `description: item.description ?? null`; **delete** any stale rows for that `googleEventId` whose `date` is no longer in the produced set; reset `conflictNotifiedAt` to `null` on any row whose `startTime`/`endTime` changed. Then run conflict detection for the new/changed rows.
    5. Persist `googleSyncToken = nextSyncToken ?? null`, `googleSyncedAt = new Date()`, `googleSyncStatus = 'ok'`, `googleSyncError = null`. On a thrown error: `googleSyncStatus = 'error'`, `googleSyncError = <300 chars>`, leave the token untouched (except in the 400/410 branch).
- [ ] **Step 2.5** Create `src/lib/google-calendar/conflicts.ts`.
  - **Pure** part (unit-tested, no Prisma): `export interface TimeEntry { id: string; kind: 'appointment' | 'external'; date: string; startTime: string; endTime: string; label: string }` and `export function findOverlaps(entries: TimeEntry[]): Array<[TimeEntry, TimeEntry]>` — same-day pairs where `a.start < b.end && a.end > b.start`, each pair emitted once.
  - Prisma part: `export async function detectAndNotifyConflicts(masterId: string, date: Date, blockId?: string): Promise<void>` — never throws. Loads that master's non-cancelled appointments + external blocks for `date`, runs `findOverlaps`, and for each pair that involves `blockId` (or the just-moved appointment) whose block has `conflictNotifiedAt === null`, calls `notifyCalendarConflict(...)` and stamps `conflictNotifiedAt = new Date()`.
- [ ] **Step 2.6** Create `src/lib/notifications/calendar-conflict.ts` (lives with the other notifiers, honours their **never-throw** contract):
  - `export async function notifyCalendarConflict(input: { masterName: string; dateLabel: string; first: { label: string; time: string }; second: { label: string; time: string } }): Promise<void>`
  - Telegram: `getTenantConfig()` → requires `notifTelegramEnabled && telegramBotToken` → `getTelegramRecipients()` → `broadcastTelegram(...)` with a hardcoded Polish HTML body naming the master, the date, and both entries with their times (same style as `notifyBookingCancellation`).
  - Email: when `notifEmailEnabled` and SMTP is configured, send the same text to `smtpFrom`/`salonEmail` via `sendEmail` from `src/lib/email.ts`.
  - `logNotification({ type: 'CALENDAR_CONFLICT', channel: 'telegram' | 'email', appointmentId: null, status })`. Add `CALENDAR_CONFLICT` to the `NotificationLog.type` comment in `prisma/schema.prisma` (comment only — no migration, the column is a plain `String`, exactly as `NotificationTemplate.channel` was widened).
- [ ] **Step 2.7** Add `'google'` to `BookingActor` in `src/lib/notifications/internal.ts`:
  ```ts
  export type BookingActor = 'client' | 'master' | 'admin' | 'google'
  ```
  and add `case 'google': return 'Kalendarz Google'` to `actorLabel`'s switch. Update `tests/lib/notifications-internal.test.ts` if it enumerates the union.

### 2.4 Availability + booking conflict integration

- [ ] **Step 2.8** `src/lib/schedule-utils.ts` — inside `fetchBusyRanges()`, after building the appointment ranges, union in `await getExternalRangesForDay(masterId, dateISO)` and return the combined array. This is the **only** change needed for `getDaySlots`, `getAvailableDays`, and `bookings/[id]/check-extension` — do not duplicate the logic anywhere else.
  - Import must be a plain module import (`@/lib/google-calendar/blocks`), which imports only `@/lib/prisma` + `schedule-utils`'s `t2m` — check there is no import cycle; if `blocks.ts` needs `t2m`, inline the 3-line parse in `blocks.ts` instead of importing back.
  - `tests/lib/availability.test.ts` already mocks `fetchBusyRanges` wholesale, so it is unaffected.
- [ ] **Step 2.9** Add an external-block overlap check to the **5 sites that actually re-check for conflicts** (verified: the admin/master manual-create and manual-edit routes perform no overlap check at all and are intentionally left alone — they are gated by the availability-aware time picker, which Step 2.8 already covers):
  1. `src/lib/booking-service.ts` L119 pre-check — after the `existingAppointment` check, `if (await hasExternalOverlap(masterId, new Date(dateOnly), startTime, endTime)) return { ok: false, code: 'CONFLICT', ... }`
  2. `src/lib/booking-service.ts` L248 in-transaction re-check — same call **before** `tx.appointment.create` (uses `prisma`, not `tx`; `ExternalCalendarBlock` is written only by the scheduler, so a cross-client read here is acceptable and keeps the transaction short)
  3. `src/app/api/client/appointments/[id]/route.ts` L143
  4. `src/app/api/bookings/[id]/route.ts` L185
  5. `src/app/api/bookings/update-time/route.ts` L165
  Each returns the route's **existing** conflict response shape/code — do not invent a new error code.

### 2.5 Scheduler pull pass

- [ ] **Step 2.10** Extend `src/lib/google-calendar/scheduler.ts`'s `tick()`:
  - After `drainOutbox()`, if sync is enabled: select up to **3** connected masters (`googleCalendarId != null`) whose `googleSyncedAt` is null or older than 55 s, ordered `googleSyncedAt asc nulls first`, and `await pullMasterCalendar(id)` for each sequentially.
  - Keep the 30 s interval; the 55 s staleness filter plus 3-per-tick gives the brief's "roughly every 60 s per master" with natural staggering and bounded per-tick cost.
  - Per-master try/catch so one broken calendar never stops the others. The whole `tick` stays wrapped in the existing never-throw try/catch.

### 2.6 Calendar rendering

- [ ] **Step 2.11** Widen the shared type in `src/app/admin/master/calendar/ModernCalendar.tsx`:
  ```ts
  export type Appointment = {
    ...existing...
    isExternal?: boolean
    externalTitle?: string | null
    externalDescription?: string | null
    allDay?: boolean
    hasConflict?: boolean          // computed client-side, never from the API
  }
  ```
- [ ] **Step 2.12** Return external blocks from the two calendar GET routes, shaped as `Appointment` objects so the four views need no new props:
  - `src/app/api/admin/calendar/appointments/route.ts` GET and `src/app/api/master/appointments/route.ts` GET.
  - Call `listExternalBlocks(...)` for the same `from`/`to` (and `masterId` filter) and append to the returned `appointments` array, each mapped to:
    `{ id: \`ext:${block.id}\`, date: block.date, startTime, endTime, status: 'EXTERNAL', notes: null, isExternal: true, externalTitle, externalDescription, allDay, service: { id: '', name_pl: '', name_en: null, name_uk: null, duration: <minutes between start/end>, price: 0 }, client: { id: '', name: null, phone: null, email: null }, master: { id, name, masterProfile: { color } }, finalPrice: null, originalPrice: null, discount: null }`
  - The `id` prefix `ext:` guarantees it can never collide with a cuid and makes the read-only branch obvious in a debugger.
- [ ] **Step 2.13** Add to `src/app/admin/master/calendar/calendar-utils.ts` (pure, no React — keeps it unit-testable and stops the 12 render sites from drifting):
  ```ts
  export function externalSummaryLine(description: string | null | undefined): string | null
  // first non-empty line, trimmed, truncated to 80 chars with a trailing '…'; null when empty
  export function entryPrimaryLabel(a: Appointment, clientFallback: string, t: (k: string) => string): string
  // isExternal ? (title?.trim() || t('admin.calendar.external.titleFallback')) : (a.client.name || clientFallback)
  export function entrySecondaryLabel(a: Appointment, language: Language, t: (k: string) => string): string
  // isExternal ? (externalSummaryLine(desc) ?? t('admin.calendar.external.descriptionFallback'))
  //            : resolveLocalized({ pl: a.service.name_pl, en: a.service.name_en, uk: a.service.name_uk }, language)
  export function markConflicts(entries: Appointment[]): Appointment[]
  // groups by master id + date, flags every entry involved in an overlapping pair with hasConflict: true
  ```
- [ ] **Step 2.14** Replace the 12 inline label expressions with the two helpers. **These are one-for-one expression swaps — no net line growth.** Each file keeps its own existing client-fallback key as the `clientFallback` argument:
  | File | Lines | `clientFallback` arg |
  |---|---|---|
  | `WeekMobileGroup.tsx` | 37 | `t('admin.calendar.clientFallback')` |
  | `AgendaView.tsx` | 91, 92 | `t('admin.calendar.clientFallback')` |
  | `MonthView.tsx` | 194 | `t('admin.calendar.clientFallback')` |
  | `DayView.tsx` | 298, 304, 342, 348 | `t('admin.appointments.unknownClient')` |
  | `WeekView.tsx` | 322, 325, 326, 369, 371 | `t('admin.calendar.clientFallback')` |
  Remove the now-unused `resolveLocalized` import from any file where it becomes orphaned (repo rule: clean up orphans **your** change created, nothing else).
  **`WeekView.tsx` is at 498 lines — after this step it must still be ≤ 498.** Verify with `wc -l`. If it grows, extract the appointment-block JSX into a sibling component rather than exceeding the cap.
- [ ] **Step 2.15** Conflict marking + read-only modal in `ModernCalendar.tsx`:
  - In `fetchData`, set `appointments` to the API array as-is; add `const entries = useMemo(() => markConflicts(appointments), [appointments])` and pass `entries` (not `appointments`) to `MonthView`/`WeekView`/`DayView`/`AgendaView`. **No new props.**
  - `onAppointmentClick` → when `a.isExternal`, set a new `viewingExternal` state instead of `viewingAppointment`; render `<ViewExternalBlockModal .../>`.
  - Add a red conflict ring at each block render (`MonthView` 194-area, `WeekView` 322/369-area, `DayView` 298/342-area, `AgendaView` 91-area, `WeekMobileGroup` 37-area): append `${a.hasConflict ? ' ring-2 ring-[var(--md-error)]' : ''}` to the existing className template — an appended ternary inside an existing string, **not** a new line.
- [ ] **Step 2.16** New `src/app/admin/master/calendar/ViewExternalBlockModal.tsx` — `"use client"`, same chrome as `ViewAppointmentModal.tsx` (fixed overlay, `max-w-lg` card, header with an icon + close button) but read-only: header title `t('admin.calendar.external.modalTitle')`, a "from Google Calendar" source line, date + time (or `t('admin.calendar.external.allDayLabel')` when `allDay`), the raw title (or its fallback), the **full** raw description in a `whitespace-pre-wrap` block (or its fallback), and a muted note `t('admin.calendar.external.readOnlyNote')`. **No Edit / Copy / Delete buttons, no price, no client, no status pill.** (~110 lines)

### 2.7 i18n (Stage 2)

- [ ] **Step 2.17** Add to all three locale files under `admin.calendar.external`:
  `titleFallback` (pl: *"Wydarzenie z Google Calendar"*, en: *"Google Calendar event"*, uk: *"Подія з Google Календаря"*),
  `descriptionFallback` (pl: *"Dodane przez Google Calendar"*, en: *"Added via Google Calendar"*, uk: *"Додано через Google Календар"*),
  `sourceLabel`, `modalTitle`, `readOnlyNote`, `allDayLabel`, `conflictBadge`, `conflictTooltip`.

### 2.8 Tests (Stage 2)

- [ ] **Step 2.18** `tests/lib/google-calendar/import-mapping.test.ts` — **no mocks by design**. Cover:
  - single-day all-day event (`start.date='2026-05-01'`, `end.date='2026-05-02'`) → exactly 1 row, `allDay: true`, `00:00`–`23:59`
  - 3-day all-day event → 3 rows (exclusive end respected, not 4)
  - timed event 09:00–10:30 → 1 row with those Warsaw times
  - timed event crossing midnight (22:00 → 01:00 next day) → 2 rows (`22:00`–`23:59`, `00:00`–`01:00`)
  - timed event ending exactly at `00:00` next day → 1 row, no empty trailing row
  - a 60-day event → truncated to `MAX_BLOCK_DAYS` rows
  - DST: an event on 2026-03-29 and one on 2026-10-25 map to the expected local times
  - `classifyEvent`: marker + matching event id → `site`; marker + mismatched id → `foreign`; no marker → `foreign`; `transparency: 'transparent'` → `ignore`
  - `eventTimesMatch`: identical → `true`; 15-minute shift → `false`; same wall-clock across a DST boundary → correct
- [ ] **Step 2.19** `tests/lib/google-calendar/conflicts.test.ts` — **no mocks by design**. `findOverlaps`: no overlap when `a.end === b.start` (touching is not overlapping); overlap detected; each pair emitted once; different dates never pair; 3 mutually overlapping entries → 3 pairs.
- [ ] **Step 2.20** Extend `tests/app/admin/master/calendar/calendar-utils.test.ts` (the existing no-mocks file) with `externalSummaryLine` (multi-line pick-first, whitespace-only → `null`, >80 chars truncated with `…`), `entryPrimaryLabel`/`entrySecondaryLabel` (both branches, both fallbacks), and `markConflicts`.
- [ ] **Step 2.21** Extend the prisma mocks in `tests/lib/booking-service.test.ts`, `tests/app/api/book/consent-gate.test.ts`, `tests/app/api/master/appointments/route.test.ts`, `tests/app/api/client/appointments/route.test.ts`, `tests/api/routes.test.ts` with `externalCalendarBlock: { findFirst: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]) }` (Step 2.9 adds a query to those paths).

### 2.9 DOX closeout (Stage 2)

- [ ] **Step 2.22**
  - `CLAUDE.md` (root) — extend the Booking System section: two-way sync, external blocks affect availability, DB is still the source of truth.
  - `src/lib/AGENTS.md` — extend the `google-calendar/` bullet with the pull half (echo suppression = state comparison; 400/410 → full re-sync; the **no-push-enqueue-from-pull loop guard**); update the `availability.ts` bullet to say the single source of truth for busy ranges is `fetchBusyRanges()`, which now unions `Appointment` **and** `ExternalCalendarBlock`; add the `notifications/calendar-conflict.ts` never-throw bullet and the widened `BookingActor` (`'google'` → `'Kalendarz Google'`).
  - `src/app/api/AGENTS.md` — the two calendar GET routes now also return `isExternal` synthetic entries; the 5 conflict-checking routes also check `hasExternalOverlap`.
  - `src/app/admin/AGENTS.md` — calendar bullet: external blocks render through `entryPrimaryLabel`/`entrySecondaryLabel` in `calendar-utils.ts` (never inline), conflicts are computed client-side via `markConflicts` and marked with `ring-2 ring-[var(--md-error)]`, `ViewExternalBlockModal` is read-only by design, and fallback text is resolved at display time in the viewer's language (never stored).
  - `prisma/AGENTS.md` — add `ExternalCalendarBlock` to the **Ownership** model list + a Local Contract bullet: the `Appointment`-identical date/time convention, one row per local day, `@@unique([masterId, googleEventId, date])`, raw-nullable title/description, and that `NotificationLog.type` gained `CALENDAR_CONFLICT` without a migration.
  - `tests/AGENTS.md` — dated bullet for the three new/extended no-mocks files + the `externalCalendarBlock` mock additions.

## Verification — Stage 2

```bash
cd /Users/sviat/Salon_Booking_2.0
npx tsc --noEmit
npx vitest run tests/lib/google-calendar/ tests/app/admin/master/calendar/
npx vitest run
npm run i18n:check
npx eslint src/lib/google-calendar src/lib/notifications/calendar-conflict.ts src/app/admin/master/calendar src/lib/schedule-utils.ts
# the 500-line cap, especially WeekView:
wc -l src/app/admin/master/calendar/*.tsx src/lib/google-calendar/*.ts | sort -n
# the pull path must never enqueue a push (expect ZERO hits):
rg -n "enqueueAppointmentSync|enqueueAppointmentDelete" src/lib/google-calendar/pull.ts
# external blocks must enter availability in exactly one place (expect ONE hit):
rg -n "getExternalRangesForDay" src
```

## Manual checklist — Stage 2 (for the user)

Do this with **one** connected master, on a test day.

**A. Foreign event → external block**
1. In Google Calendar (the master's), create a **future** event tomorrow 14:00–15:00, title `Anna masaż`, description first line `Telefon 600 000 000` + a second line.
2. Wait up to ~90 s. Refresh the admin calendar → the block appears at 14:00–15:00, first line `Anna masaż`, second line `Telefon 600 000 000`.
3. Click it → a read-only panel opens showing the time, title, full description and "from Google Calendar". There must be **no** Edit / Copy / Delete buttons and **no** price.
4. Open the public booking page for that master, tomorrow → 14:00–15:00 must **not** be offered as a free slot.
5. In Google, **move** that event to 16:00 → wait ~90 s → it moves on the site and 14:00 becomes bookable again.
6. In Google, **delete** it → wait ~90 s → it disappears from the site and the slot is free.

**B. Fallbacks and language**
7. In Google create a future event with **no title and no description** → it must show the localized fallbacks ("Google Calendar event" / "Added via Google Calendar").
8. Switch the admin UI language (pl → en → uk) → those two fallback lines must change language. The *real* title/description of a normal event must **not** be translated.

**C. All-day and multi-day**
9. Create an **all-day** event tomorrow → the whole working day must be blocked on the booking page, and the calendar shows it for that day.
10. Create a **3-day** all-day event → it must appear on exactly 3 days, not 4.

**D. Site event moved/deleted in Google**
11. Pick an existing site booking that is already mirrored into Google. In **Google**, drag it to a different hour.
12. Wait ~90 s → the site calendar shows the new time, and the salon Telegram gets an "appointment updated" message ending with "Zmienione przez: Kalendarz Google".
13. *Expected and correct:* the client receives nothing. (See Assumption 1 — that is how every other time change already behaves. Tell me if you want the client emailed; that is a separate feature.)
14. In **Google**, delete a site-made event → wait ~90 s → the appointment is CANCELLED on the site and the salon Telegram gets a cancellation message attributed to Kalendarz Google.
15. *Expected:* editing a site event's **title or text** in Google changes **nothing** on the site (client name and procedure come from the client/service records — see Assumption 14).

**E. Conflicts**
16. In Google, create a foreign event that **overlaps** an existing site booking.
17. Wait ~90 s → both entries stay (nothing is deleted or moved), both get a red outline in the site calendar, and the salon Telegram gets **one** conflict message naming the master, both entries and both times.
18. Wait another 5 minutes → **no repeat** message for the same conflict.

**F. Stability**
19. Put a deliberately broken Calendar ID on a second master → confirm the first master keeps syncing normally and the site never errors.
20. Disconnect a master (clear her Calendar ID) → wait ~90 s → her external blocks stop updating and no new site bookings appear in her Google Calendar. Existing Google events are left in place (by design — the salon does not wipe her calendar).
21. Reconnect her → her future appointments are re-pushed.

---

## Acceptance Criteria

- [ ] `npx tsc --noEmit` clean
- [ ] `npx vitest run` — no new failures vs. the pre-change baseline; all new test files green
- [ ] `npm run i18n:check` — PASS (pl/en/uk parity, every referenced key resolves)
- [ ] No **new** eslint errors in touched files (repo-wide `npm run lint` is red at baseline)
- [ ] Every created/modified file is **< 500 lines**; `WeekView.tsx` ≤ 498
- [ ] No new npm dependency (`package.json` unchanged)
- [ ] The service-account **private key** is never returned by any API route, never rendered in any page, and never written to a log — verified by reading the settings page after a reload (shows `••••••••`)
- [ ] The service-account **email** IS visible to ADMIN/SUPERADMIN and to a MASTER on her own panel
- [ ] A MASTER can set/clear only **her own** calendar ID; the admin settings page redirects her
- [ ] A Google outage, an invalid key, a revoked share, or a deleted calendar never blocks or fails a booking, a cancellation, a reschedule, or server boot
- [ ] Stage 1 is shippable and useful with Stage 2 unbuilt
- [ ] Stage 2's pull path contains **zero** push enqueues (loop guard verified by grep)
- [ ] External blocks never produce reminders, client notifications, price/revenue figures, or GDPR client linkage
- [ ] Only future events are imported; history is never imported and never pushed
- [ ] DOX pass done for both stages; the root `CLAUDE.md` "no Google Calendar integration" sentence is gone

## Constraints & Risks

**Must not be touched**
- The `prisma.$transaction` conflict re-check blocks in `book`/`bookings/update-time`/`bookings/[id]` — add the external-block check **alongside** them, never replace or restructure them.
- `src/lib/notifications/`'s never-throw contract; `notifyBooking*` call sites stay fire-and-forget and un-awaited.
- The `settings-dirty` event name / `form id="settings-form"` / `detail` shape — invisible to `tsc`/`lint` if broken.
- `availableSlotColor`/`dayOffColor` must stay literal hex strings (never `var(...)`).
- `src/instrumentation.ts`'s single `if (process.env.NEXT_RUNTIME === 'nodejs')` block structure — an early return breaks the edge-runtime build.
- Any pre-existing dead code noticed along the way: mention it, do not delete it.

**Critical dependencies**
- `AUTH_SECRET` must be set — `src/lib/encryption.ts` throws at import if empty.
- `experimental.instrumentationHook` in `next.config.mjs` (already enabled for the Telegram bot).
- Migrations must be additive: `deploy/docker-entrypoint.sh` runs `prisma migrate deploy` on container start against live salon data.
- `SCHEDULE_TZ` is the **only** timezone source; a per-tenant timezone is a separate backlog item and must stay a one-place swap.

**Risks**
- *A missed `enqueue` call site is silent.* Mitigation: the exhaustive table in Step 1.10 + the grep in the Stage 1 verification block + manual check D.
- *Google's `syncToken` parameter compatibility rules.* Mitigation: Assumption 9 — any 400/410 degrades to a full sync, and the importer re-filters the window itself.
- *A very long or heavily recurring Google event could flood `ExternalCalendarBlock`.* Mitigation: `MAX_BLOCK_DAYS = 14`, `SYNC_WINDOW_DAYS = 400`, 250 items/page with a 20-page cap.
- *Prisma-mocked tests will break when new models are queried on existing paths.* Mitigation: Steps 1.25 and 2.21 name the exact files.
- *Multi-replica deployments would poll N×.* Accepted and documented, not solved.
- *Two masters sharing one Google calendar* would each import the other's events as foreign blocks. Not guarded in v1 — worth a line in the admin instructions panel ("one calendar per master").

---

# Stage 1 status and verification results (2026-09-21)

**Status: Stage 1 COMPLETE (Steps 1.1-1.26 all checked). Stage 2 not started.**

## Deviations / judgement calls (all minimal, none architectural)
- Migration hand-written at `prisma/migrations/20260921120000_google_calendar_push/migration.sql` (additive `ALTER TABLE ADD COLUMN` + `CREATE TABLE CalendarSyncTask`). `prisma migrate diff --from-migrations ... --to-schema-datamodel` (shadow DB in scratchpad) reports an empty diff, so it matches `schema.prisma`. It was NOT applied to the real dev database; run `npx prisma migrate dev` (or `migrate deploy`) yourself.
- `src/lib/tenant.ts` `DEFAULT_CONFIG` gained the three `google*` TenantConfig fields (needed so `getTenantConfig()`'s union return type exposes them to `tsc`).
- Test routes (`.../test`) accept an optional `{ calendarId }` body and fall back to the master's saved id; the shared logic lives in `connect.ts` as `testMasterCalendar()` (plan only named `setMasterCalendarId`).
- Step 1.10's table mislabels a few rows; the real sites found by grep: `master/appointments/[id]` has 3 (PATCH cancel, DELETE, PUT), `client/appointments/[id]` 2 (PATCH, DELETE-as-cancel), `admin/calendar/appointments/[id]` 2 (PUT, DELETE). All wired. The `rg` count is 18 call lines (16 appointment sites + 2 `enqueueSyncForUsers` in link-bookings/register) + 1 GDPR call in `consent-service.ts`.
- `consent-service.ts` is now exactly 500 lines (one-line `if` used to stay at the cap).
- `tests/app/api/auth/register.route.test.ts` now mocks `@/lib/google-calendar/outbox` (no test was red, this only silences a logged never-throw error).

## Known gaps (not in plan, flagged for the orchestrator)
1. `admin/calendar/appointments/[id]` PUT can change `masterId`: the Google event stays in the OLD master's calendar (task is keyed to the new master, patch 404s -> inserts a new event; old event orphaned).
2. Cascade deletes (deleting a client/master `User` deletes their `Appointment` rows) do not enqueue `enqueueAppointmentDelete`; those Google events would be orphaned.

## Verification results
- `npx prisma validate` / `npx prisma generate`: OK.
- `npx tsc --noEmit`: clean (no output).
- `npx vitest run tests/lib/google-calendar/`: 2 files, 22 tests passed.
- `npx vitest run` (full): 41 files, 404 tests passed, 0 failures.
- `npm run i18n:check`: PASS (1148 keys, 3 locales in sync).
- `npx eslint` on all new/touched files (incl. the `[masterId]` route files): no errors, no warnings.
- Mutation-site grep: every `appointment.(create|update|delete|updateMany)` in `src` (17 hits) is followed by an enqueue; confirmed by `rg`.
- Line cap: largest new file `GoogleCalendarSettingsForm.tsx` 304 lines; `consent-service.ts` 500.
