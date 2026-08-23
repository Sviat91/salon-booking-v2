# Review: SMS notification channel + admin-editable reminder templates
**Date:** 2026-08-23
**Verdict:** NEEDS CHANGES (one architectural fix required, otherwise clean)

## Critical/Architectural Issues

- [x] `ReminderTemplatesForm.tsx` breaks AD-5's "absent row = default" model: `src/app/admin/settings/reminder-templates/ReminderTemplatesForm.tsx:49-58,111-121` — `loadTemplates()` sets every field's initial `value` to the resolved body from `GET /api/admin/reminder-templates`, which is `stored ?? DEFAULT_REMINDER_BODIES[type][language]` (`route.ts:54`). So a template with no DB row still loads with the **literal default text already in the field**, not empty-with-default-as-`placeholder` as Step 11 specifies. `onSubmit` then builds the PUT payload from `values[fieldName(type, language)] ?? ''` for **every** enabled type×locale combination unconditionally, not just the field(s) actually edited. Since every untouched field already holds non-empty default text, the PUT route's `body.trim()` check never sees an empty string for those fields, so it `upsert`s a real `NotificationTemplate` row for them too (only a truly-blank body triggers the delete branch). Net effect: the first Save an admin performs — even to tweak one locale — permanently persists literal default text into the DB for every other enabled type×locale as well, defeating AD-5's entire point (the table should stay empty for anything never customized, so a future change to `DEFAULT_REMINDER_BODIES` propagates automatically to un-customized salons).

  **Fixed:** `loadTemplates()` now only sets `values[fieldName(...)]` when `!row.isDefault`, leaving default rows unset so the field stays blank with the default shown only via the `Textarea`'s `placeholder`.

  **Fix (already scoped, no new architecture needed):** in `loadTemplates()`, only populate `values[fieldName(row.type, row.language)]` when `!row.isDefault` (i.e. a real custom row exists). Leave the field key absent/undefined for default rows — the `Textarea`'s existing `placeholder={DEFAULT_REMINDER_BODIES[type][lang]}` already renders the default as a hint exactly per Step 11. No change needed to `onSubmit` or the PUT route: an untouched field's value stays `undefined ?? ''` (blank) → the existing delete-on-blank branch is a no-op since no row exists yet → correct. A field the admin actually types into gets real text → upserted. "Reset to default" already sets the field to `''` via `field.onChange('')`, which now behaves consistently with the same blank-means-default-restored path.

## Minor/Syntax Issues

- [ ] `src/app/api/admin/reminder-templates/route.ts:36-38,65-67` — the 401 guards use raw `NextResponse` instead of `handleApiError`/`ErrorResponses`, even though Step 9 says this new route "follows the current convention." The `try/catch` bodies do correctly use `handleApiError`; only the auth-check branch differs. Low impact — matches the sibling `sms-settings/route.ts`'s existing pattern for the same guard. Not routed for a fix; noted for awareness only.

## Passed Checks

- [x] AD-1 timezone fix: `appointmentStartUtc()` in `src/lib/notifications/internal.ts:15-18` uses `fromZonedTime(`${dateStr}T${startTime}:00`, SCHEDULE_TZ)` exactly as specified; the old `.000Z`-suffix construction is fully gone from `reminders.ts` (grepped — only `appointmentStartUtc(appt.date, appt.startTime)` remains).
- [x] Unit tests for the DST fix (`tests/lib/notifications-internal.test.ts:83-93`) match Step 2's exact assertions (12:00Z for August, 13:00Z for January).
- [x] AD-2: `src/lib/notifications/index.ts` is 309 lines, now just re-exports + the four non-reminder dispatcher functions; `reminders.ts` holds the real `notifyBookingReminders()` logic with a proper extraction header comment.
- [x] AD-3 never-throws contract: `getSmsSender`/`sendSms` and both `twilio.ts`/`smsapi.ts` wrap `fetch` in try/catch, return `Error | null`, never throw, pass `signal: AbortSignal.timeout(10_000)`.
- [x] SMSAPI HTTP-200-on-error handled correctly: `smsapi.ts:40-43` parses the JSON body and treats a present `error` field as failure, not just `res.ok`.
- [x] AD-4 secrets: `twilioAccountSid`/`twilioAuthToken`/`smsApiToken` encrypted via `encrypt()`/`decrypt()`; GET route returns only a mask or empty string, never a decrypted secret; no secret appears in any provider `Error` message.
- [x] Prisma schema + migration match the plan exactly, including `@@unique([type, language, channel])`, `DEFAULT_CONFIG` in `tenant.ts` updated with all 7 new fields.
- [x] AD-6 template engine (`renderTemplate`/`validateTemplateBody`/`estimateSmsSegments`/`DEFAULT_REMINDER_BODIES`) matches spec exactly, including the six default bodies verbatim.
- [x] `resolveReminderBody()` in `template-store.ts` correctly implements stored → default → pl-fallback per AD-5.
- [x] AD-7 verified untouched: `BookingForm.tsx`, `BookingConsentModal.tsx`, `consent-service.ts`, `booking-service.ts` have zero SMS/NotificationTemplate references.
- [x] AD-8 verified untouched: `src/app/api/cron/reminders/route.ts` is byte-for-byte the pre-existing shape.
- [x] Cache invalidation: `sms-settings/route.ts` PATCH calls `invalidateTenantConfigCache()`; `reminder-templates/route.ts` correctly omits it (separate table, read fresh per cron run).
- [x] Form-binding footgun avoided: every input in `SmsSettingsSection.tsx` and `ReminderTemplatesForm.tsx` is bound via `FormField`/`Controller` with explicit `value`/`onChange`/`onBlur` — no `register()` anywhere.
- [x] Dedup correctness in `reminders.ts:126-133`: `sms` channel dedup is structured identically to the pre-existing `email`/`telegram_client` checks.
- [x] i18n key parity: `admin.settings.sms.*` and `admin.settings.reminderTemplates.*` blocks are structurally identical across `pl.json`/`en.json`/`uk.json`; `TEMPLATE_UNKNOWN_PLACEHOLDER` present in `KNOWN_ERROR_CODES` and `errors.*` in all three locales.
- [x] File-size constraint: all touched files comfortably under 500 lines (`index.ts` 309, `NotificationSettingsForm.tsx` 423, `ReminderTemplatesForm.tsx` 243).
- [x] DOX pass: all five listed `AGENTS.md` files updated with accurate, specific descriptions.

## Independently Verified (orchestrator, not the coder's self-report)

- `npm run test` → **39 files / 376 tests passed, 0 failures.**
- `npm run i18n:check` → **PASS** — 1388 keys in sync across pl/en/uk, all 1133 referenced `t()` keys resolve.
- `npm run lint` → 79 pre-existing problems (74 errors, 5 warnings), **none in any file this feature touched** — confirmed by cross-checking every flagged file path against this feature's changed-file list; all flagged files are pre-existing unrelated issues (`booking-management/state/useBookingManagementState.ts`, `HomeClient.tsx`, `Header.tsx`, `TurnstileProvider.tsx`, `MasterContext.tsx`, `availability.ts`, `booking-helpers.ts`, `turnstile.ts`, `tailwind.config.ts`, `test-avail.cjs`, `test-db.cjs`).

## Summary

The implementation is faithful to the plan on every high-risk point: timezone fix, secret handling, the SMSAPI HTTP-200-on-error footgun, dedup logic, schema/migration, i18n parity, form-binding, and the DOX pass all check out. One real architectural defect remains: the reminder-template editor pre-fills every field with resolved default text and submits all fields unconditionally on save, silently persisting literal default text as real DB rows across every enabled type×locale on first save — undermining AD-5's "absent row = default, no seeding, defaults propagate automatically" design. The fix is narrow and already scoped (skip populating `values[...]` for `isDefault` rows in `loadTemplates()`) — routed directly to coder, no re-planning needed.
