# App Review — Salon Booking 2.0

**Date:** 2026-07-02
**Reviewer:** Claude Code (static audit)
**Product goal audited against:** universal, per-install salon-booking app (~€100/install, +€10/mo managed hosting). Buyer deploys fast and configures everything through the SUPERADMIN UI.

Every finding marked **CRITICAL** or **HIGH** was confirmed by reading the actual source file, not inferred. Each item cites a concrete file so it can be fixed and tracked individually.

---

## Severity summary

| # | Severity | Area | Finding |
|---|----------|------|---------|
| A1 | 🔴 Critical | Security | IDOR — anyone can modify any appointment by id |
| A2 | 🔴 Critical | Security | Public phone lookup leaks full booking history |
| A3 | 🔴 Critical | Security | `/api/debug-db` is public |
| A4 | 🟠 High | Security | `/api/book` — no rate limit, Turnstile never verified |
| A5 | 🟠 High | Security | Master passwords stored in cleartext |
| A6 | 🟠 High | Security | Encryption key fallback + silent plaintext fallback |
| A7 | 🟠 High | Security | Default SUPERADMIN credentials in seed |
| A8 | 🟡 Medium | Security | Registration allows enumeration + spam |
| A9 | 🟡 Medium | Security | Weak guest phone verification (last 9 digits) |
| A10 | 🟡 Medium | Security | `app.db` + uploads committed to git |
| A11 | 🟡 Low/Med | Security | No security headers |
| A12 | ⚪ Low | Security | GDPR erase/export gated only by phone+name |
| B1 | 🔴 Blocker | Architecture | Hardcoded masters `olga`/`yuliia` |
| B2 | 🟠 High | Architecture | Google Calendar/Sheets keyed by per-master env vars |
| B3 | 🔴 Blocker | Architecture | Uploads written to local filesystem |
| B4 | 🟡 Medium | Architecture | SQLite single-file DB |
| B5 | 🔴 Blocker | Architecture | No packaged deploy path / bootstrap |
| B6 | ⚪ Note | Architecture | "Multi-tenant" is really single-tenant-per-deploy |
| C1–C5 | 🟡 Various | Robustness | See section C |

---

## A. Security Vulnerabilities

### A1 — 🔴 CRITICAL: IDOR on `PATCH /api/bookings/[id]`
**File:** `src/app/api/bookings/[id]/route.ts`
No `auth()` call, no phone/ownership check. Anyone who knows or guesses an appointment `id` can change its procedure or time — `prisma.appointment.update()` runs directly on the raw route param (line ~155). The route only checks that the appointment exists and isn't cancelled.
**Fix:** require a phone-last-digits match against the stored appointment (the same pattern the sibling `/api/bookings/cancel|update-time|update-procedure` routes already use) or a session-ownership check before the update.

### A2 — 🔴 CRITICAL: Data disclosure via `GET /api/client/appointments?phone=`
**File:** `src/app/api/client/appointments/route.ts`
Public, unauthenticated, phone-only lookup. Returns the full booking history for that phone — dates, service names, prices, master name, and notes. No rate limiting, so an attacker can enumerate phone numbers and harvest customer data across all masters.
**Fix:** require an authenticated session, or at minimum add rate limiting plus a verification step. Prefer routing this through the authenticated `/api/client/*` endpoints and removing the public variant.

### A3 — 🔴 CRITICAL: `GET /api/debug-db` is public
**File:** `src/app/api/debug-db/route.ts`
No auth. Returns a real `masterId` plus every `Schedule` and `DateOverride` row. Pure reconnaissance leak — a debug leftover.
**Fix:** delete the endpoint.

### A4 — 🟠 HIGH: `POST /api/book` has no rate limit and never verifies Turnstile
**File:** `src/app/api/book/route.ts`
The booking schema accepts `turnstileToken`, but the handler **never calls `verifyTurnstile` / `validateTurnstileForAPI`**. There is no rate limiting. The handler auto-creates `User` rows for guests and, when no `procedureId` is supplied, even creates a placeholder `Service` named "Консультация". A script can flood the DB with fake bookings, users, and services.
**Fix:** call `validateTurnstileForAPI(body.turnstileToken, ip)` for the guest flow; add Redis rate limiting (the token-bucket helper already exists in the GDPR flow); remove the on-the-fly service creation in favour of a configured default service.

### A5 — 🟠 HIGH: Master passwords stored in cleartext (`plainPassword`)
**Files:** `prisma/schema.prisma` (`User.plainPassword`), `src/app/admin/masters/actions.ts`, `src/app/admin/masters/MasterForm.tsx`
The generated (or admin-typed) master password is stored in plaintext alongside the bcrypt hash and displayed back in the admin UI. A DB dump exposes directly usable credentials — a security and GDPR liability.
**Fix:** stop persisting `plainPassword`. Return the generated password **once** in the create/reset API response so the admin can copy it, then never store it. Drop the column via migration.

### A6 — 🟠 HIGH: Encryption key fallback + silent plaintext fallback
**File:** `src/lib/encryption.ts`
The AES-256-GCM key derives from `AUTH_SECRET` with a hardcoded fallback: `process.env.AUTH_SECRET || 'fallback-secret-development-only'`. If `AUTH_SECRET` is unset in production, all OAuth/SMTP secrets are encrypted under a **publicly known constant**. Worse, `encrypt()` catches any error and returns the original plaintext, and `decrypt()` returns its input unchanged on failure — so secrets can be silently stored/served in cleartext with no signal. `src/lib/env.ts` doesn't even list `AUTH_SECRET`, so nothing enforces its presence.
**Fix:** fail hard at startup if `AUTH_SECRET` is missing in production; make `encrypt()` throw instead of returning plaintext; add `AUTH_SECRET` as required to the env schema.

### A7 — 🟠 HIGH: Default SUPERADMIN credentials in seed
**File:** `prisma/seed.ts`
Creates `admin@somique.com` / `password123` (SUPERADMIN) and `master@somique.com` / `master123`. If `prisma db seed` runs on a production install, that's a known-credential backdoor into the highest-privilege account.
**Fix:** use the existing interactive `scripts/create-superadmin.ts` for production bootstrap; keep the demo seed dev-only and clearly documented. (This overlaps the "admin bootstrap script" item already tracked in project notes.)

### A8 — 🟡 MEDIUM: Registration allows account enumeration + spam
**File:** `src/app/api/auth/register/route.ts`
No rate limiting; returns a distinct `"User with this email already exists"` 400, which enables email enumeration, and the open endpoint allows mass account/consent-record creation.
**Fix:** add IP rate limiting (the helper is already used in `forgot-password`). The message can stay if the endpoint is throttled.

### A9 — 🟡 MEDIUM: Weak guest verification across `/api/bookings/*`
**Files:** `src/app/api/bookings/cancel`, `.../update-time`, `.../update-procedure`
These verify only the **last 9 digits** of the phone against the stored appointment; `[id]` PATCH (A1) verifies nothing. Collision risk is low but real (two numbers sharing the last 9 digits).
**Fix:** compare the full stored phone. Treat A1 as the priority since it has no check at all.

### A10 — 🟡 MEDIUM: `app.db` and `public/uploads/*` committed to git
`git ls-files` shows a tracked `app.db` (currently empty) plus 18 upload PNGs, despite `.gitignore` containing `*.db`. Any future real data would be committed into history.
**Fix:** `git rm --cached app.db public/uploads/*`, add a `.gitkeep` to preserve the folder, and confirm the ignore rules cover both.

### A11 — 🟡 LOW/MEDIUM: No security headers
**File:** `next.config.mjs`
No `headers()` block — missing CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy.
**Fix:** add a `headers()` config with sane defaults (clickjacking + MIME-sniffing protection at minimum).

### A12 — ⚪ LOW: GDPR self-service erase/export gated only by phone+name+Turnstile
**Files:** `src/app/api/consents/erase`, `.../export`
By design for self-service, but an attacker who knows a victim's name and phone can trigger a data export or erasure. Rate limits + Turnstile reduce abuse volume but don't prove identity.
**Fix:** acceptable as-is for launch, but consider an email-link confirmation for erasure.

---

## B. Architectural Issues (block the "universal / configure-in-UI" goal)

### B1 — 🔴 BLOCKER: Hardcoded masters `olga` / `yuliia`
**Files:** `src/config/masters.ts`, `src/config/masters.server.ts`
Two named masters, their avatars, and a name-by-literal-id mapping are hardcoded. A new salon cannot represent its own staff without editing source. This directly contradicts the "configure everything in the SUPERADMIN UI" promise. Partial DB support already exists (`isValidMasterIdAsync`).
**Fix:** drive masters entirely from the DB (`User` with `role=MASTER` + `MasterProfile`). Remove the hardcoded registry or demote it to a dev-only fallback.

### B2 — 🟠 HIGH: Google Calendar/Sheets keyed by per-master env vars
Env vars such as `GOOGLE_CALENDAR_ID_YULIIA` / `GOOGLE_SHEET_ID_YULIIA` plus a single global service-account JSON. Not configurable per-master in the UI, and coupled to the hardcoded ids from B1.
**Fix:** store each master's calendar/sheet id on `MasterProfile`, editable in the admin UI. Make the Google Sheets exception-rule integration optional (most buyers won't use it).

### B3 — 🔴 BLOCKER: Uploads written to local filesystem
**File:** `src/app/api/upload/route.ts`
Uses `fs.writeFile` into `public/uploads`. On Vercel/serverless the filesystem is ephemeral and largely read-only, so uploaded logos/backgrounds **fail to write or disappear on redeploy**. This breaks the core "configure your branding in the UI" feature on the most likely hosting target.
**Fix:** use object storage (Vercel Blob / Cloudflare R2 / S3) for the managed tier, or explicitly require a persistent-disk VPS for self-hosting. Decide before selling.

### B4 — 🟡 MEDIUM: SQLite / libSQL single-file DB
Fine for one small salon per deployment, but no concurrent-write scaling, manual backups, and file-based (compounds B3 on serverless).
**Fix:** for the "you deploy + support" tier, point the libSQL adapter at hosted Turso so the same code gets a durable remote DB; document a backup routine.

### B5 — 🔴 BLOCKER: No packaged deploy path despite "fast deploy" being the pitch
No `Dockerfile`, no `output: 'standalone'` in `next.config.mjs`, no install script. Every sale is a manual sequence: set env, run migrations, seed, create superadmin, wire Google creds.
**Fix:** add a `Dockerfile` + `output: 'standalone'` and a one-command bootstrap (`prisma migrate deploy` → create-superadmin → seed a `TenantConfig`). This packaged installer **is** the product you're selling for €100.

### B6 — ⚪ NOTE: "Multi-tenant" is single-tenant-per-deploy
A single `TenantConfig` row drives each deployment. That matches the business model (1 install = 1 salon), but the `CLAUDE.md` "multi-tenant" wording is misleading. State the model explicitly so expectations (yours and buyers') are aligned.

---

## C. Robustness / Correctness (secondary)

- **C1** — `POST /api/book` auto-creates a placeholder service named **"Консультация"** (hardcoded Russian) in a Polish-default, "universal" app, polluting the `Service` table. Replace with a configured default service; never invent rows on the fly. (`src/app/api/book/route.ts`)
- **C2** — Double-booking race: conflict checks in `/api/book` and `/api/bookings/[id]` are `findFirst`-then-`create/update` with no DB uniqueness on `(masterId, date, startTime)`. Low probability but real under concurrency. Add a unique index or wrap in a transaction with a re-check.
- **C3** — `getTenantConfig()` calls `noStore()` on every render (`src/lib/tenant.ts`), so every page hits the DB for config. A cache wrapper already exists (`src/lib/cache.ts`); cache the config and invalidate it when settings are saved.
- **C4** — i18n inconsistency: hardcoded Polish error strings in `bookings/[id]` and a Russian placeholder in `book`. For a universal product, route all user-facing strings through i18next.
- **C5** — `src/lib/env.ts` doesn't require `AUTH_SECRET` or `DATABASE_URL`, so the app can boot misconfigured (ties directly to A6). Make them required.

---

## D. Pre-Launch Deploy Blocker Checklist ("hard to launch" risks)

1. **`AUTH_SECRET` must be set** — otherwise encryption uses a public constant (A6). Not enforced today.
2. **Upload storage must be persistent** (B3) — otherwise logos/backgrounds vanish.
3. **First-run bootstrap** — run migrations, create a real SUPERADMIN (not the seed default), seed a `TenantConfig` (B5, A7).
4. **Google service account + per-master calendar/sheet ids** required, or booking sync silently degrades (B2).
5. **Turnstile keys** recommended (A4), or the public booking endpoint invites spam.

---

## Recommended remediation order

1. **Immediately (security):** A3 (delete debug-db), A1 (IDOR), A2 (disclosure), A4 (rate-limit + Turnstile on `/book`), A7 (seed creds), A10 (untrack `app.db`).
2. **Before selling (product viability):** B3 (upload storage), B1 + B2 (dynamic masters + Google config), B5 (packaged deploy + bootstrap), A5 (`plainPassword`), A6 (`AUTH_SECRET` enforcement).
3. **Polish:** A8, A11, C1–C5.
