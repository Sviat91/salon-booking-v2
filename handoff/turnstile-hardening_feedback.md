# Review: Turnstile + rate-limit hardening on booking endpoints
**Date:** 2026-08-01
**Verdict:** APPROVED

## Critical/Architectural Issues
(none)

## Minor/Syntax Issues
(none)

## Passed Checks
- [x] `src/app/api/book/route.ts` — `ip` computed once via `getRequestIp(req)` right after body parse, reused for both the rate-limit check and `validateTurnstileForAPI`, and passed into `createBooking({ ip, ... })` — no duplicate `getRequestIp` call.
- [x] `src/app/api/book/route.ts` — rate limit (`rate:book:${ip}`, 8/15min) runs before `auth()` and before any DB/business work, matching the plan's insertion point.
- [x] `src/app/api/book/route.ts` — Turnstile check (`validateTurnstileForAPI(body.turnstileToken, ip, { requireToken: false })`) is gated by `if (!isAuth)`, so authenticated CLIENT sessions are never asked for a token; `requireToken: false` matches the plan's required fallback behavior.
- [x] `src/app/api/bookings/cancel/route.ts` — `rate:bookings-cancel:${ip}`, 15/15min, inserted right after JSON parse, before the required-fields check.
- [x] `src/app/api/bookings/update-time/route.ts` — `rate:bookings-update-time:${ip}`, 15/15min, same insertion point.
- [x] `src/app/api/bookings/update-procedure/route.ts` — `rate:bookings-update-procedure:${ip}`, 15/15min, same insertion point.
- [x] `src/app/api/bookings/[id]/route.ts` (PATCH) — `rate:bookings-patch:${ip}`, 15/15min, inserted right after JSON parse, before the "at least one change" validation.
- [x] `src/app/api/bookings/[id]/check-extension/route.ts` — `rate:bookings-check-extension:${ip}`, 20/15min, correct key/limit, correct insertion point.
- [x] `src/app/api/bookings/all/route.ts` (GET) — `rate:bookings-all:${ip}`, 20/15min, inserted right after `searchParams` are read, before the required-params check.
- [x] All 7 files return `{ error: "Too many requests. Please try again later.", code: "RATE_LIMITED" }` with status 429 — matches the reference pattern in `src/app/api/consents/erase/route.ts`.
- [x] No ordering/double-counting bugs — in every file the rate-limit check runs before any Prisma query or notification side effect.
- [x] Scope check — no evidence of edits outside the 7 target files; Telegram bot handlers untouched.
- [x] `rateLimit()` fails open when Redis/Upstash isn't configured — consistent with the plan's claim that this won't break existing tests in an environment without Upstash configured.
- [x] Imports are correct and minimal in each file.

## Summary
The implementation is a faithful, surgical match to the plan across all 7 files: correct rate-limit keys, limits, and insertion points; correct guest-only Turnstile gating with `requireToken: false` in `/api/book`; the `ip` variable is computed once and reused; error responses consistently use `{ error, code: "RATE_LIMITED" }` with status 429; and no files outside the 7 (including the Telegram bot) were touched. No critical or minor issues found.
