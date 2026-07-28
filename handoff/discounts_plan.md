# Plan: Discounts (automatic + promo-code), admin- and master-managed

**Date:** 2026-07-27
**Status:** In Progress
**Amended:** 2026-07-27 — user decisions on OQ-1…OQ-4 folded in (OQ-2 and OQ-3 are now **in scope**; OQ-5 remains open/deferred). Also fixed a gap found while amending: AD-6's read-site migration had no implementation step — it is now **Step 12**.

## Goal

Add a `Discount` model (percentage-only) that ADMIN (global) and MASTER (own scope) can author, evaluated server-side at three points of the booking flow, persisted as an immutable `originalPrice`/`finalPrice`/`discountId` snapshot on every new `Appointment`, with a `DiscountRedemption` ledger that enforces `oncePerClient` by normalized phone.

---

## Reconnaissance findings (verified in this session — read these before disputing a decision)

- **R-1** `Appointment` today stores **no price at all** (`prisma/schema.prisma:146-164`). Every price shown for an appointment is derived live at read time from `Service.price`, sometimes overlaid with `MasterService.priceOverride`. Full read-site list in AD-6.
- **R-2** There are exactly **3** `appointment.create` sites: `src/lib/booking-service.ts:232`, `src/app/api/master/appointments/route.ts:193`, `src/app/api/admin/calendar/appointments/route.ts:124`.
- **R-3** There are exactly **5** routes that can change `Appointment.serviceId`: `bookings/update-procedure` (:141), `bookings/[id]` PATCH, `client/appointments/[id]` PATCH (:175), `master/appointments/[id]` PUT (:188), `admin/calendar/appointments/[id]` PUT (:117).
- **R-4** **The `procedures:v2:<masterId>` cache key documented in `src/lib/AGENTS.md` / `src/app/api/AGENTS.md` does not exist in the code.** `grep` for `procedures:v2`, `cacheGet`, `cacheSet` shows the only production consumers of `src/lib/cache.ts` are `telegram-bot/wizard-state.ts` and `consents/withdraw/route.ts`. `GET /api/procedures` is `export const dynamic = "force-dynamic"` and hits Prisma directly. **⇒ Discounts need no cache key and no cache invalidation.** (See OQ-5.)
- **R-5** `/admin/services` uses **server actions** (`services/actions.ts`, `useFormState`), while `/admin/master/services` uses **fetch + API routes** (`/api/master/services`). They are two different mechanisms, not one pattern applied twice. The newest and cleanest two-surface precedent in the repo is content pages (`PageOwner` + `authorizePageOwner` + one shared component set + one shared `actions.ts`) — see AD-8.
- **R-6** `src/components/BookingForm.tsx` is **498 lines**. The hard 500-line project limit makes an extraction mandatory before adding anything (AD-11).
- **R-7** `src/lib/notifications/**` contains **no** price rendering — confirmation/reminder emails and Telegram messages never show a price. No notification changes needed.
- **R-8** `lucide-react` exports `Percent` (verified in `node_modules/lucide-react/dist/lucide-react.d.ts`).
- **R-9** `tests/lib/errors/apiErrorKey.test.ts` asserts every code in `KNOWN_ERROR_CODES` maps — adding a code requires touching that test.
- **R-10** *(added while amending, for OQ-3)* The Telegram bot's wizard is a Redis-backed state machine: `WizardStep = 'LANGUAGE'|'MASTER'|'PROCEDURE'|'DATE'|'TIME'|'CONTACT'|'CONSENT'|'CONFIRM'` in `src/lib/telegram-bot/wizard-state.ts`, one handler module per step under `handlers/`, all registered once in `bot.ts:18-25`. Every handler guards on `state.step`, so stale inline buttons from an earlier message are already no-ops — that is the established convention, not a bug to fix.
- **R-11** *(added while amending, for OQ-3)* **grammy middleware ordering is load-bearing.** `handlers/contact.ts:79-92` registers `bot.on('message:text', …)` and **returns without calling `next()`** when `state.step !== 'CONTACT'`. In grammy that halts the chain, so any later-registered `message:text` listener never runs. A promo text listener must therefore be registered **before** `registerContactHandlers` and must `return next()` when it doesn't handle the message.
- **R-12** *(added while amending, for OQ-3)* The bot translates via `botT(lang)` (`src/lib/telegram-bot/i18n.ts`), which reads the **same** `src/locales/{pl,en,uk}.json` files under the `bot.*` namespace. New bot strings go in those files, not a separate bundle. `bot.confirm.summary`/`bot.confirm.success` interpolate a single `{{price}}` string built by `formatBookingSummary` (`handlers/confirm.ts:49-75`).

---

## Architecture Decisions

### AD-1 — Schema shape

New models `Discount`, `DiscountService`, `DiscountRedemption`; `Appointment` gains 3 columns + 1 relation. `masterId` mirrors `Service.masterId` **exactly** (`String?` + `@relation(..., onDelete: Cascade)`, `null` = admin/global).

The happy-hour window is stored as **two nullable JSON string columns**, not one blob: `windowDays` (JSON `number[]`, `Schedule.dayOfWeek` semantics — 0=Sunday…6=Saturday) and `windowIntervals` (JSON `[{"start":"HH:MM","end":"HH:MM"}]`, byte-identical shape to `Schedule.intervals`/`DateOverride.intervals`). Both `null`/absent ⇒ the discount is **not** time-restricted. A window is only honoured when **both** are non-empty (a days-only or hours-only window is treated as no window — validated in the form, defensively enforced in `eligibility.ts`).

The admin form authors **exactly one** interval, persisted as a 1-element array. The array shape is kept so the column stays interchangeable with `Schedule.intervals` and so multi-interval authoring is a pure UI change later. Do not introduce a different shape.

**No denormalization of `label`/`percent` onto `Appointment`** (decided while resolving OQ-2). `Appointment.discountId` uses `onDelete: SetNull`, so deleting a `Discount` erases the join but leaves `originalPrice`/`finalPrice` intact — which means the *percentage* stays derivable forever (`discountPercentFromSnapshot()`), and only the human label is lost. Two extra duplicated columns are not worth buying back a label on deleted promotions.

### AD-2 — `originalPrice`/`finalPrice` are **nullable** (`Float?`), no backfill

Rationale (this resolves the brief's explicit backward-compatibility question):

1. SQLite + Prisma cannot add a `NOT NULL` column to a populated table without a default or an interactive TTY (`prisma/AGENTS.md` work-guidance bullet) — nullable makes the migration a plain, safe `ALTER TABLE ADD COLUMN`.
2. `null` is a meaningful state: "created before the discounts feature existed". Pre-migration appointments keep their current behaviour (price derived live). Post-migration appointments always have both columns written by all 3 create sites (R-2), so the "editing a service price retroactively changes historical appointments" behaviour disappears for everything created from now on — which is the intended behaviour change.
3. A backfill would be *wrong data*: we do not know what those appointments were actually charged.

Read rule everywhere, one line: **`appointment.finalPrice ?? <existing live derivation>`**. Encapsulated in `resolveAppointmentPrice()` (AD-4) so the fallback is written once.

`finalPrice === originalPrice` when no discount applied. Both are the **effective** price, i.e. `MasterService.priceOverride ?? Service.price` — a discount stacks on top of a per-master price override, not on top of the catalog default.

### AD-3 — Stacking: highest `percent` wins, never sum

`pickBestDiscount()` returns the single candidate with the highest `percent`. Ties broken deterministically by `createdAt` ascending, then `id` ascending (so the result is stable across requests and testable). A promo code that is *worse* than an automatic discount loses — but the endpoint still reports `codeStatus: 'valid'` so the UI can say "your code was accepted, a better discount already applies".

### AD-4 — New module `src/lib/discounts/` (3 files, all well under 500 lines)

| File | Contract |
| --- | --- |
| `shared.ts` | **Zero Prisma, zero React** — safe for client bundles. Types (`DiscountOwner`, `DiscountWindow`, `DiscountCandidate`, `DiscountEvaluation`, `EvaluationStage`, `CodeStatus`), JSON parse/serialize helpers, `normalizeDiscountCode()`, `applyPercent()`, `hhmmToMinutes()`, `resolveAppointmentPrice()`, `discountPercentFromSnapshot()`. |
| `eligibility.ts` | **Pure, Prisma-free** predicates: `isDiscountEligible(candidate, ctx)`, `pickBestDiscount(candidates, ctx)`, `explainCode(candidates, ctx)`. 100% unit-testable with no mocks. |
| `server.ts` | Prisma-backed. Authorization primitives, candidate loading, base-price resolution, `evaluateDiscount()`, `resnapshotAppointmentPrice()`. |

`resolveAppointmentPrice()` lives in `shared.ts` too (pure, and needed by both server routes and client code).

Why `hhmmToMinutes()` duplicates `t2m` from `src/lib/schedule-utils.ts`: `schedule-utils.ts` imports `prisma` at module scope, so it can never be reached from a client-safe module. The duplication is 5 lines and deliberate. One comment in `shared.ts` pointing at `t2m` is enough.

### AD-5 — Evaluation stages

`EvaluationStage = 'catalog' | 'slot' | 'final'`. A candidate is filtered by stage as follows:

| Constraint on the discount | `catalog` | `slot` | `final` |
| --- | --- | --- | --- |
| `active`, `startDate`/`endDate` window | checked | checked | checked |
| service scope | checked | checked | checked |
| `masterId` scope | checked | checked | checked |
| has a day/hour window | **excluded** (we don't know the slot) | checked against the slot | checked against the slot |
| `requiresCode` | **excluded** | **excluded** | included only when the submitted code matches |
| `oncePerClient` | **excluded** (identity unknown) | **excluded** | checked against `DiscountRedemption` |

`startDate`/`endDate` are compared against **now** at `catalog`/`slot` and against **now** at `final` too (not the appointment date) — the discount governs *when you book*, not when you're served. Explicit, documented decision; it matches "promotion runs 1–14 August".

The day/hour window, by contrast, is matched against the **selected slot's start time in `Europe/Warsaw`** (the same timezone `booking-service.ts` already uses for `dateOnly`/`startTime`), not against `now`.

Both the web flow and the Telegram bot use these same three stages through the one `evaluateDiscount()` entry point — the bot's promo step (Step 14) is stage `'final'`, identical to the web final step.

### AD-6 — Every existing read site of `service.price`, and what happens to it

**Must change (4 API sites + 3 UI sites)** — implemented by **Step 12** (all four API sites, one pass per file) and **Step 23** (the calendar-UI half of site 7):

| # | File:line | Change |
| --- | --- | --- |
| 1 | `src/app/api/client/profile/route.ts:90` | `const price = appt.finalPrice ?? ((profileId && overrideMap.get(...)) ?? appt.service.price)` — add `finalPrice`/`originalPrice`/`discountId` to the `findMany`. Also surface `originalPrice` in the mapped object so the profile card can show a strikethrough later. |
| 2 | `src/app/api/bookings/all/route.ts:158` | same pattern; also expose `originalPrice` on the returned booking object. |
| 3 | `src/app/api/master/appointments/route.ts:60,94-104` | the existing `appointmentsWithEffectivePrice` remap gains a `finalPrice` short-circuit: when `appointment.finalPrice != null`, use it instead of the override lookup. Select `finalPrice`/`originalPrice` **and `discount: { select: { label: true, percent: true } }`** (OQ-2), returning both on each appointment. |
| 4 | `src/app/api/admin/calendar/appointments/route.ts:46-64` (GET) | today selects raw `service.price` and applies **no** override at all (pre-existing inconsistency, do **not** fix it). Add `finalPrice`/`originalPrice`/`discount: { select: { label: true, percent: true } }` to the `select` and rewrite `service.price` to `finalPrice` when non-null. |
| 5 | `src/app/admin/page.tsx:49,54` | `monthAppointments` include gains `finalPrice`; `monthRevenue` becomes `sum + (a.finalPrice ?? a.service.price)`. **Deliberate behaviour change: the Revenue stat becomes discount-aware.** |
| 6 | `src/app/admin/page.tsx:33-41` + `src/app/admin/TodaysAppointmentsTable.tsx:15,75,93` | `todayAppointments` include gains `finalPrice`; the `Appointment` type in `TodaysAppointmentsTable.tsx` gains `finalPrice: number \| null`; both render sites become `app.finalPrice ?? app.service.price`. |
| 7 | `src/app/admin/master/calendar/ModernCalendar.tsx:21-31` + `src/app/admin/master/calendar/ViewAppointmentModal.tsx:33-41` | **(OQ-2 — user decided YES, in this pass.)** The existing effective-price computation at :33-41 is **already correct** (sites 3/4 rewrite `service.price` for it) and its output stays identical. What is *added* is a "which discount applied" line beneath it. `ModernCalendar.tsx`'s exported `Appointment` type gains `originalPrice?: number \| null` and `discount?: { label: string; percent: number } \| null` — **type-only, no logic change in that file**. See Step 23. |

**Must NOT change (verified correct as-is):**

- `src/app/profile/page.tsx:240-242` — reads `a.service.price` from the response of site 1, which already rewrites it. **Leave untouched** (optional strikethrough is a follow-up, not this plan).
- `src/components/booking-management/**` (`ResultsPanel.tsx:113`, `EditProcedurePanel.tsx:79`, `TimeChangeSuccessPanel.tsx:83`) — read `booking.price` from site 2. **Leave untouched.**
- `src/app/admin/services/**`, `src/app/admin/master/services/**`, `src/app/api/master/services/**` — service **catalog** prices. Never discounted. Untouched.
- `EditProcedurePanel.tsx:101,145`, `DirectTimeChangePanel.tsx:97`, `ProcedureChangeSuccessPanel.tsx:62`, `src/components/profile/EditAppointmentModal.tsx` — quote `price_pln` from `/api/procedures` for a *prospective* service change. That is a catalog quote, not a charged price. Untouched. (Consistent with AD-7: changing the service drops the discount.)
- `src/lib/price.ts` / `tests/lib/price.test.ts` — unrelated string normalizer. Untouched.

### AD-7 — Mutation rules for an already-created appointment

- **Service change** (all 5 routes in R-3): recompute `originalPrice` from the *new* service, set `finalPrice = originalPrice`, `discountId = null`, and **delete the `DiscountRedemption` row** (which correctly restores the client's `oncePerClient` eligibility). Rationale: the discount was evaluated for a different service; silently re-evaluating would surprise both client and salon. One shared helper, `resnapshotAppointmentPrice()`, is called from all 5.
- **Time change** (`bookings/update-time`, and the time-only branches of the PUT/PATCH routes): **the discount survives.** A happy-hour discount granted at booking is not revoked by a later reschedule. Explicit, documented decision — do not add revocation logic.
- **Cancellation**: the appointment row (and its `finalPrice`) is kept on soft-cancel; hard-delete routes cascade the redemption away. No extra work.

### AD-8 — Admin UI: one shared component set + one `actions.ts`, mirroring the content-pages precedent

Per R-5, "mirror `admin/services` and `admin/master/services`" cannot be taken literally — they use two different mechanisms. What is taken from the brief and honoured:

- **from `admin/services/`**: `useFormState` server actions, `build<X>Schema(t)` + `getServerT()` zod factory, `revalidatePath`, the `ServicesClient.tsx` table/`DataCard`/`Sheet` chrome, `useConfirm()` for delete (**never native `confirm()`**), `admin.*` i18n namespace;
- **from content pages** (`src/lib/content/pages-server.ts`, `src/app/admin/pages/actions.ts`, `src/components/admin/content/PageListClient.tsx`): the `PageOwner`-style discriminated union + `authorizeDiscountScope`/`canManageDiscount` split, and one component set shared by both routes instead of a fork.

`DiscountOwner = { ownerType: 'global'; masterId: null } | { ownerType: 'master'; masterId: string }` lives in `shared.ts` (client components carry it as a prop, exactly like `PageOwner` in `pages-shared.ts`).

Authorization matrix (implement exactly; it is a strict subset of the pages matrix — **there is no admin-on-behalf surface for discounts**):

| session role | `createDiscount({global,null})` | `createDiscount({master,X})` | `canManageDiscount(row)` |
| --- | --- | --- | --- |
| none / CLIENT | ✗ | ✗ | `false` |
| MASTER | ✗ | ✓ only if `user.id === X` | `true` only if `row.masterId === user.id` |
| ADMIN / SUPERADMIN | ✓ | ✗ (**not needed, keep it closed**) | `true` for any row |

Note the one deliberate divergence from `authorizePageOwner`: ADMIN requesting a `master` scope returns `null`. There is no UI for it and adding it would widen the attack surface for no feature. `canManageDiscount` still lets an admin edit/delete a master's discount (they can already delete the master).

### AD-9 — API surface: one new route

`POST /api/discounts/preview` — public (the booking flow is guest-accessible), rate-limited via `rateLimit()` from `src/lib/cache.ts`, body validated by a new zod schema in `src/lib/validation/api-schemas.ts`.

```
body: { masterId, serviceId, startISO?, code?, phone? }
200:  { originalPrice, finalPrice, percent, label, discountId, codeStatus }
```

Stage is derived server-side: `startISO` absent ⇒ `'slot'` is impossible ⇒ `'catalog'`; `startISO` present and no `code`/`phone` ⇒ `'slot'`; `startISO` + (`code` or `phone`) ⇒ `'final'`. **The client never sends a price and the server never accepts one.**

`GET /api/procedures` gains three **additive, nullable** fields per item — `discount_percent`, `discount_label`, `price_after_discount_pln` — computed at stage `'catalog'` with a **single** candidate query per master (not per service). No existing field changes meaning.

`POST /api/book` gains an optional `discountCode` in its body and returns `originalPrice`/`finalPrice`/`discountPercent` alongside `eventId`. It **re-evaluates from scratch** at stage `'final'`; a supplied-but-ineligible code fails the booking with a new `DISCOUNT_INVALID` code rather than silently charging more than was quoted.

The Telegram bot does **not** call this HTTP route — it calls `evaluateDiscount()` in-process, matching the existing "the bot must NOT HTTP self-call the app's public API" rule documented at the top of `src/lib/telegram-bot/catalog.ts`.

### AD-10 — `oncePerClient` identity and its race

Identity is the **normalized E.164 phone** (`normalizePhoneToE164()` from `src/lib/utils/phone-normalization.ts`, wrapped in try/catch → `null`). Guest flow: the submitted phone. Authenticated flow: `clientUser.phone`. Telegram bot: `WizardState.phone`, which `handlers/contact.ts:35` has **already** normalized to E.164 before storing. When no valid phone can be derived, `oncePerClient` discounts are **not eligible** (fail closed) — an unenforceable "once" is worse than no discount.

`DiscountRedemption.clientPhone` is therefore `String?` (nullable) — a non-`oncePerClient` discount can legitimately be redeemed by a phone-less authenticated client.

No DB uniqueness constraint on `(discountId, clientPhone)` — it would be wrong for the non-`oncePerClient` case. Instead the check is **re-run inside the `$transaction`** immediately before writing, exactly like the existing double-booking conflict re-check in `booking-service.ts:221-244`. The residual race (two simultaneous bookings, same phone, same once-per-client code) is accepted and matches the project's existing posture.

### AD-11 — `BookingForm.tsx` must be split first (R-6)

Step 15 is a **pure, behaviour-preserving extraction** of the authenticated "Your Details" card (state `isEditingDetails`/`editName`/`editPhone`/`editEmail`/`saveToProfile`/`detailsSaving`/`detailsMessage` at :43-49, `openInlineEditor` + `handleInlineDetailsSave` at :217-279, and the JSX at :319-410 — ~160 lines) into a new `src/components/BookingAuthDetailsCard.tsx`. It is not an optional cleanup: without it, adding the promo-code block breaks the 500-line limit. Do it as its **own commit-shaped step** with zero behaviour change, before Steps 16/17 touch the same file.

### AD-12 — Explicitly out of scope

- **No admin-on-behalf surface** (`/admin/masters/[id]/discounts`). Two routes only.
- **No fixed-amount discounts**, no per-client targeting, no usage caps beyond `oncePerClient`, no auto-generated code batches.
- **No manual discount attachment** in the admin/master calendar's `AppointmentModal` — manually created appointments snapshot at full price (`discountId = null`). *(OQ-4, confirmed by the user.)*
- **No discount badge on the client-facing surfaces** — the profile card (`src/app/profile/page.tsx`) and the booking-management panels show the effective price only. The admin/master **calendar** detail *does* show it (OQ-2, Step 23); the client-facing screens do not.
- **No reporting screen** over `DiscountRedemption`. The ledger is written now, read later.
- **No promo-code entry in the bot's procedure-picker list** — `src/lib/telegram-bot/keyboards.ts:39-50` stays on the catalog price, exactly like `ProcedureSelect`'s catalog listing. The bot's code entry lives only at the CONFIRM step (Step 14).
- **`src/middleware.ts`** — untouched. Page-level `auth()` guards are what protect these routes (`src/app/admin/AGENTS.md` line 13).

---

## Implementation Steps

### Phase A — Data model

- [x] **Step 1: Prisma schema**
  - Files: `prisma/schema.prisma`
  - Add after the `Service`/`MasterService` block (keep the file's existing comment style):
    ```prisma
    // Percentage discount. masterId semantics mirror Service.masterId exactly:
    // null = created by Admin (applies to any master), filled = created by that
    // Master (applies only to their own bookings and their own offered services).
    model Discount {
      id            String   @id @default(cuid())
      label         String   // Admin-facing only. Never parsed or interpreted.
      percent       Int      // 1..100, validated at the application layer

      masterId      String?  // Null = created by Admin, filled = created by Master
      master        User?    @relation("MasterCreatedDiscounts", fields: [masterId], references: [id], onDelete: Cascade)

      requiresCode  Boolean  @default(false)
      code          String?  @unique // normalized UPPERCASE; null unless requiresCode
      oncePerClient Boolean  @default(false)

      // Optional "happy hour" window. Both null/empty = not time-restricted.
      windowDays      String? // JSON int[], Schedule.dayOfWeek semantics (0=Sunday..6=Saturday)
      windowIntervals String? // JSON array, same shape as Schedule.intervals

      startDate     DateTime?
      endDate       DateTime?
      active        Boolean  @default(true)

      createdAt     DateTime @default(now())
      updatedAt     DateTime @updatedAt

      services      DiscountService[]
      redemptions   DiscountRedemption[]
      appointments  Appointment[]

      @@index([masterId, active])
    }

    // Empty set for a discount = "all services in that discount's scope".
    model DiscountService {
      id         String @id @default(cuid())
      discountId String
      serviceId  String

      discount   Discount @relation(fields: [discountId], references: [id], onDelete: Cascade)
      service    Service  @relation(fields: [serviceId], references: [id], onDelete: Cascade)

      @@unique([discountId, serviceId])
      @@index([serviceId])
    }

    // One row per appointment that actually used a discount. Enforces
    // oncePerClient (by normalized E.164 phone) and is the future reporting source.
    model DiscountRedemption {
      id            String   @id @default(cuid())
      discountId    String
      appointmentId String   @unique
      clientPhone   String?  // normalized E.164; null when no valid phone exists
      redeemedAt    DateTime @default(now())

      discount    Discount    @relation(fields: [discountId], references: [id], onDelete: Cascade)
      appointment Appointment @relation(fields: [appointmentId], references: [id], onDelete: Cascade)

      @@index([discountId, clientPhone])
    }
    ```
  - `Appointment` — add inside the model, after `clientLanguage`:
    ```prisma
      // Price snapshot taken at creation time (AD-2). Null only for rows created
      // before the discounts feature; readers fall back to the live service price.
      discountId    String?
      originalPrice Float?   // MasterService.priceOverride ?? Service.price, at booking time
      finalPrice    Float?   // what is actually charged; == originalPrice when undiscounted
    ```
    and in the relations block:
    ```prisma
      discount           Discount?           @relation(fields: [discountId], references: [id], onDelete: SetNull)
      discountRedemption DiscountRedemption?
    ```
  - `User` — add `createdDiscounts Discount[] @relation("MasterCreatedDiscounts")` next to `createdServices`.
  - `Service` — add `discountServices DiscountService[]` next to `masterServices`.
  - **Do not add a Prisma `enum`** (`prisma/AGENTS.md`). **Do not** add denormalized `discountLabel`/`discountPercent` columns to `Appointment` (AD-1).

- [x] **Step 2: Migration**
  - Command: `npx prisma migrate dev --name add_discounts`
  - All new `Appointment` columns are nullable, so this is a plain `ALTER TABLE ADD COLUMN` + 3 `CREATE TABLE`s — no interactive TTY required, no data loss (contrast the `prisma/AGENTS.md` warning about required columns).
  - Remember `DATABASE_URL`'s relative path resolves from `schema.prisma`'s directory — the live dev DB is `prisma/prisma/app.db` (`prisma/AGENTS.md`).
  - `migrate dev` runs `prisma generate`. If the generated client still doesn't type `prisma.discount`, use the **existing local escape hatch convention** (`const db = prisma as any`, as in `src/app/admin/services/actions.ts:7-8`) rather than editing the generator config.

### Phase B — Core logic module

- [x] **Step 3: `src/lib/discounts/shared.ts`** (new, Prisma-free, React-free)
  - Exports:
    ```ts
    export type DiscountOwner =
      | { ownerType: 'global'; masterId: null }
      | { ownerType: 'master'; masterId: string }

    export type EvaluationStage = 'catalog' | 'slot' | 'final'

    export type CodeStatus =
      | 'none'            // no code submitted
      | 'valid'           // code matched an eligible discount
      | 'unknown'         // no discount with that code
      | 'inactive'        // active = false
      | 'expired'         // outside startDate/endDate
      | 'not_applicable'  // wrong master, wrong service, or outside the happy-hour window
      | 'already_used'    // oncePerClient and this phone already redeemed it

    export interface DiscountInterval { start: string; end: string }

    export interface DiscountCandidate {
      id: string
      label: string
      percent: number
      masterId: string | null
      requiresCode: boolean
      code: string | null
      oncePerClient: boolean
      windowDays: number[]              // [] = no day restriction
      windowIntervals: DiscountInterval[] // [] = no hour restriction
      startDate: Date | null
      endDate: Date | null
      active: boolean
      serviceIds: string[]              // [] = all services in scope
      createdAt: Date
    }

    export interface DiscountEvaluation {
      originalPrice: number
      finalPrice: number
      percent: number | null
      label: string | null
      discountId: string | null
      oncePerClient: boolean   // of the WINNING discount; false when none applied
      codeStatus: CodeStatus
    }
    ```
  - Helpers:
    - `normalizeDiscountCode(raw: string | null | undefined): string | null` — trim, collapse internal whitespace, `toUpperCase()`; return `null` for empty. **Used on both write and lookup** — this is what makes the `@unique` index effectively case-insensitive on SQLite.
    - `parseWindowDays(json: string | null): number[]` — `JSON.parse` in try/catch, keep only integers `0..6`, dedupe, sort; `[]` on any failure.
    - `parseWindowIntervals(json: string | null): DiscountInterval[]` — try/catch, keep only entries where both `start`/`end` match `/^\d{1,2}:\d{2}$/` and `end > start` in minutes; `[]` on any failure. (Same defensive posture as `readWeeklyFromDb` in `schedule-utils.ts:124-128`.)
    - `serializeWindowDays(days: number[]): string | null` / `serializeWindowIntervals(iv: DiscountInterval[]): string | null` — `null` when empty.
    - `hhmmToMinutes(t: string): number` — `NaN` on bad input. Add a one-line comment: *duplicated from `t2m` in `src/lib/schedule-utils.ts`, which cannot be imported here because it pulls in Prisma at module scope.*
    - `applyPercent(price: number, percent: number): number` — `Math.round(price * (100 - percent)) / 100` is **wrong**; use `Math.round(price * (100 - percent) / 100 * 100) / 100`. Clamp `percent` to `0..100` and the result to `>= 0`.
    - `resolveAppointmentPrice(finalPrice: number | null | undefined, livePrice: number): number` — `finalPrice ?? livePrice`. Trivial, but it is the one place the AD-2 fallback rule is written down; every read site in Step 12 calls it.
    - `discountPercentFromSnapshot(originalPrice: number | null | undefined, finalPrice: number | null | undefined): number | null` — `null` when either is nullish, when `originalPrice <= 0`, or when `originalPrice <= finalPrice`; otherwise `Math.round((1 - finalPrice / originalPrice) * 100)`. This is what keeps the discount percentage visible on the calendar (Step 23) even after the `Discount` row has been deleted (AD-1).
  - Keep under ~150 lines.

- [x] **Step 4: `src/lib/discounts/eligibility.ts`** (new, pure — no Prisma, no I/O)
  - ```ts
    export interface EligibilityContext {
      stage: EvaluationStage
      masterId: string
      serviceId: string
      /** Selected slot start, already converted to Europe/Warsaw wall-clock. */
      slotDayOfWeek: number | null   // 0..6, null at stage 'catalog'
      slotStartMinutes: number | null // minutes since midnight, null at stage 'catalog'
      now: Date
      code: string | null            // already normalized
      redeemedDiscountIds: ReadonlySet<string>
      hasClientIdentity: boolean     // false ⇒ oncePerClient discounts are ineligible
    }

    export function isDiscountEligible(c: DiscountCandidate, ctx: EligibilityContext): boolean
    export function pickBestDiscount(cands: DiscountCandidate[], ctx: EligibilityContext): DiscountCandidate | null
    export function explainCode(cands: DiscountCandidate[], ctx: EligibilityContext): CodeStatus
    ```
  - `isDiscountEligible` order of checks (each an early `false`):
    1. `c.active`
    2. `c.startDate && ctx.now < c.startDate` → false; `c.endDate && ctx.now > c.endDate` → false (compare against **now**, per AD-5)
    3. `c.masterId !== null && c.masterId !== ctx.masterId` → false
    4. `c.serviceIds.length > 0 && !c.serviceIds.includes(ctx.serviceId)` → false
    5. window: `hasWindow = c.windowDays.length > 0 && c.windowIntervals.length > 0`. If `hasWindow`: `ctx.stage === 'catalog'` → false; `ctx.slotDayOfWeek === null || ctx.slotStartMinutes === null` → false; day not in `windowDays` → false; `slotStartMinutes` not inside any interval (`start <= m < end`) → false.
    6. `c.requiresCode`: `ctx.stage !== 'final'` → false; `ctx.code === null || ctx.code !== c.code` → false.
    7. `c.oncePerClient`: `ctx.stage !== 'final'` → false; `!ctx.hasClientIdentity` → false; `ctx.redeemedDiscountIds.has(c.id)` → false.
    8. `c.percent` not an integer in `1..100` → false (defensive against bad DB rows).
  - `pickBestDiscount`: filter, then sort by `percent` desc, `createdAt` asc, `id` asc; return `[0] ?? null` (AD-3).
  - `explainCode`: when `ctx.code === null` → `'none'`. Find the candidate whose `code === ctx.code`; `undefined` → `'unknown'`; then map the **first failing check** to `'inactive'` / `'expired'` / `'already_used'` / `'not_applicable'`; all pass → `'valid'`.
  - Keep under ~180 lines.

- [x] **Step 5: `src/lib/discounts/server.ts`** (new, Prisma-backed, no `NextRequest`/`NextResponse`)
  - `canManageDiscount(user, discount: { masterId: string | null }): boolean` — sync, row-based. `false` when `!user`; `true` for ADMIN/SUPERADMIN; for MASTER `true` only when `!!user.id && discount.masterId === user.id`; else `false`. (Mirrors `canManagePage`, `src/lib/content/pages-server.ts:17-27`.)
  - `authorizeDiscountScope(user, requested: DiscountOwner): Promise<DiscountOwner | null>` — implements the AD-8 matrix. Returns a **freshly constructed** object, never `requested`. `global` → ADMIN/SUPERADMIN only. `master` → MASTER only, and only when `user.id === requested.masterId` (no DB lookup needed for that branch, unlike `authorizePageOwner`). Everything else → `null`.
  - `listMasterOfferedServiceIds(masterId: string): Promise<Set<string>>` — resolve `MasterProfile` by `userId`, then `masterService.findMany({ where: { masterProfileId }, select: { serviceId: true } })`; when that set is empty, fall back to `service.findMany({ where: { OR: [{ masterId: null }, { masterId }] }, select: { id: true } })`.
    - **OQ-1, confirmed by the user:** this set deliberately includes **salon-owned (global) services the master offers**, not only rows where `Service.masterId === masterId`. A master may discount any service they actually offer, at their own margin. Do **not** narrow this filter.
    - **This is the same lookup already written 4× in the repo** (`api/procedures/route.ts:38-74`, `api/admin/calendar/services`, `api/master/services`, `lib/telegram-bot/catalog.ts:36-67`). Add a comment naming those call sites; **do not refactor them** in this feature (out of scope, mention-don't-fix).
  - `listDiscountsForOwner(owner: DiscountOwner)` — `findMany({ where: { masterId: owner.masterId }, orderBy: [{ createdAt: 'desc' }], include: { services: { select: { serviceId: true } } } })`.
  - `toCandidate(row): DiscountCandidate` — maps a Prisma row (with `services`) through the `parseWindow*` helpers.
  - `loadCandidates(masterId: string): Promise<DiscountCandidate[]>` — **one** query: `where: { OR: [{ masterId: null }, { masterId }] }` + `include: { services: { select: { serviceId: true } } }`. No `active`/date filtering in SQL (the pure layer owns those rules, and the set is tiny).
  - `resolveBasePrice(masterId, serviceId): Promise<number | null>` — `MasterService.priceOverride ?? Service.price`, via `masterProfile.findUnique` → `masterService.findUnique({ where: { masterProfileId_serviceId: ... } })`, falling back to `service.findUnique`. `null` when the service doesn't exist.
  - `evaluateDiscount(input): Promise<DiscountEvaluation | null>` — **the single source of truth**, used by the preview route, `/api/procedures`, `createBooking`, and the Telegram bot (both its confirm summary and its promo step).
    ```ts
    interface EvaluateInput {
      masterId: string
      serviceId: string
      stage: EvaluationStage
      startsAt?: Date | null      // slot start (UTC instant)
      code?: string | null        // raw; normalized internally
      clientPhone?: string | null // raw; normalized internally
      candidates?: DiscountCandidate[] // pre-loaded, for the /api/procedures batch path
    }
    ```
    - Resolve `originalPrice` via `resolveBasePrice` → `null` when the service is missing.
    - Convert `startsAt` to Warsaw wall-clock with the **same `Intl.DateTimeFormat` pattern already used in `booking-service.ts:78-95`** (`timeZone: 'Europe/Warsaw'`, `en-GB` `HH:mm`, `en-CA` `yyyy-MM-dd`) to derive `slotStartMinutes` and `slotDayOfWeek` — do **not** use `Date.getDay()` on the raw instant (server-TZ dependent).
    - Normalize the phone with `normalizePhoneToE164` in try/catch; `hasClientIdentity = phone !== null`.
    - When phone is known and stage is `'final'`, load `redeemedDiscountIds` with one `discountRedemption.findMany({ where: { clientPhone }, select: { discountId: true } })`.
    - `pickBestDiscount` → build the `DiscountEvaluation` (including `oncePerClient` of the winner); `codeStatus` from `explainCode`.
  - `resnapshotAppointmentPrice(appointmentId, opts?): Promise<void>` — used by Step 11. Loads the appointment (`masterId`, `serviceId`), recomputes `originalPrice` via `resolveBasePrice`, writes `{ originalPrice, finalPrice: originalPrice, discountId: null }`, and `discountRedemption.deleteMany({ where: { appointmentId } })`. No-op (leaves columns untouched) when `resolveBasePrice` returns `null`.
  - Keep under ~300 lines. If it grows past that, split the authorization primitives into `src/lib/discounts/authz.ts`.

### Phase C — Booking flow (server)

- [x] **Step 6: Zod schemas**
  - Files: `src/lib/validation/api-schemas.ts`
  - Add `discountCode: z.string().trim().max(64).optional().or(z.literal('')).nullish()` to `bookingApiSchema` (after `language`).
  - Add a new schema next to the booking block:
    ```ts
    export const discountPreviewApiSchema = z.object({
      masterId:  z.string().min(1),
      serviceId: z.string().min(1),
      startISO:  z.string().min(16).optional().nullable(),
      code:      z.string().trim().max(64).optional().or(z.literal('')).nullish(),
      phone:     z.string().min(5).max(20).optional().or(z.literal('')).nullish(),
    })
    export type DiscountPreviewApiInput = z.infer<typeof discountPreviewApiSchema>
    ```

- [x] **Step 7: `POST /api/discounts/preview`**
  - Files: `src/app/api/discounts/preview/route.ts` (new)
  - `export const runtime = "nodejs"`. Public, **no `auth()` call** (booking is guest-accessible — and per `src/app/api/AGENTS.md` verification note, not importing `@/auth` also keeps the test file free of the next-auth mock).
  - Rate limit before any DB work: `const { allowed } = await rateLimit(\`discount-preview:${getRequestIp(req)}\`, 30, 60)`; on `!allowed` return `{ error, code: 'RATE_LIMITED' }` / 429. (`rateLimit` from `@/lib/cache`, `getRequestIp` from `@/lib/consent-service` — the same pair `consents/withdraw` uses.)
  - Parse with `discountPreviewApiSchema`; on `ZodError` return `{ code: 'VALIDATION_ERROR' }` / 400.
  - Derive the stage per AD-9. Call `evaluateDiscount`. `null` (unknown service) → `{ code: 'SERVICE_NOT_FOUND' }` / 404.
  - Use `handleApiError()`/`ErrorResponses` from `src/lib/api/error-handler.ts` (this is a **new** route, so the shared handler applies per `src/app/api/AGENTS.md` line 15).

- [x] **Step 8: `GET /api/procedures` — additive discount fields**
  - Files: `src/app/api/procedures/route.ts`
  - Extract the three duplicated `items.map(...)` bodies into one local `decorate(rows, masterId)` helper that appends `discount_percent: number | null`, `discount_label: string | null`, `price_after_discount_pln: number | null` to each item. Keep every existing field name and value identical.
  - `masterId` absent → all three new fields are `null` (a global-services listing has no master to scope against). Do **not** call the discount layer on that branch.
  - `masterId` present → `loadCandidates(masterId)` **once**, then per item call `pickBestDiscount` at stage `'catalog'` with `code: null`, `hasClientIdentity: false`, `redeemedDiscountIds: new Set()`, and `originalPrice` = the item's already-computed `price_pln` (do not re-query `resolveBasePrice`).
  - Update `src/types/api-responses.ts`'s `ProcedureItem` with the three optional fields.
  - Keep the file under 150 lines.

- [x] **Step 9: `createBooking()` — evaluate, snapshot, redeem**
  - Files: `src/lib/booking-service.ts`, `src/app/api/book/route.ts`
  - `CreateBookingInput` gains `discountCode?: string | null`.
  - `CreateBookingErrorCode` gains `"DISCOUNT_INVALID"`.
  - `CreateBookingResult`'s ok branch becomes `{ ok: true; appointmentId: string; originalPrice: number; finalPrice: number; discountPercent: number | null }`.
  - After the existing step 4 (service resolution, :202-218) and **before** the `$transaction`:
    - resolve the client phone for identity: guest → `normalizedGuestPhone`; auth → `clientUser.phone` (normalize in try/catch);
    - `const evaluation = await evaluateDiscount({ masterId, serviceId, stage: 'final', startsAt: startDate, code: input.discountCode, clientPhone })`;
    - `evaluation === null` → `serviceId` is guaranteed to exist here (it was just created or found), so `null` is an internal error: return `{ ok: false, code: 'INTERNAL_ERROR' }`;
    - if `input.discountCode` was non-empty **and** `evaluation.codeStatus !== 'valid'` → return `{ ok: false, code: 'DISCOUNT_INVALID', message: 'Promo code is not valid for this booking' }`.
  - Inside the existing `$transaction` (:221-244), change the callback to return a discriminated result instead of `null`:
    ```ts
    const outcome = await prisma.$transaction(async (tx) => {
      const conflict = await tx.appointment.findFirst({ /* unchanged */ })
      if (conflict) return { kind: 'conflict' as const }

      // Re-check oncePerClient inside the transaction — same reasoning as the
      // conflict re-check above; there is no DB constraint that can express it.
      if (evaluation.discountId && evaluation.oncePerClient && clientPhone) {
        const taken = await tx.discountRedemption.findFirst({
          where: { discountId: evaluation.discountId, clientPhone },
        })
        if (taken) return { kind: 'discountTaken' as const }
      }

      const appointment = await tx.appointment.create({
        data: {
          /* ...all existing fields unchanged... */
          discountId:    evaluation.discountId,
          originalPrice: evaluation.originalPrice,
          finalPrice:    evaluation.finalPrice,
        },
      })

      if (evaluation.discountId) {
        await tx.discountRedemption.create({
          data: { discountId: evaluation.discountId, appointmentId: appointment.id, clientPhone },
        })
      }
      return { kind: 'ok' as const, appointment }
    })
    ```
  - Map `'conflict'` → existing `CONFLICT`; `'discountTaken'` → `DISCOUNT_INVALID`.
  - A **redemption row is written for every applied discount**, not only `oncePerClient` ones (the ledger is the future reporting source).
  - `notifyBookingConfirmation(...)` call is unchanged and still fire-and-forget.
  - `src/app/api/book/route.ts`: add `discountCode: body.discountCode` to the `createBooking` call, add `DISCOUNT_INVALID: 400` to `STATUS_FOR_CODE`, and return `{ eventId, originalPrice, finalPrice, discountPercent }`.

- [x] **Step 10: `DISCOUNT_INVALID` error code plumbing**
  - Files: `src/lib/errors/apiErrorKey.ts`, `src/locales/{pl,en,uk}.json`, `tests/lib/errors/apiErrorKey.test.ts`
  - Add `'DISCOUNT_INVALID'` to `KNOWN_ERROR_CODES` and an `errors.DISCOUNT_INVALID` string to all three locale files (en: `"This promo code is not valid for this booking."`).
  - `tests/lib/errors/apiErrorKey.test.ts` iterates the exported set, so it should pass unchanged — **verify** rather than assume; if it has a hardcoded count, update it.

- [x] **Step 11: Snapshot on the other two create sites + re-snapshot on service change**
  - Files (create): `src/app/api/master/appointments/route.ts` (:193), `src/app/api/admin/calendar/appointments/route.ts` (:124)
    - Before each `appointment.create`, `const originalPrice = (await resolveBasePrice(masterId, entryServiceId)) ?? 0`, and add `originalPrice, finalPrice: originalPrice` to `data`. `discountId` stays unset (AD-12: no manual discounts).
    - Custom inline-created services already get `price: 0`, so the snapshot is `0` — correct and consistent with today's display.
  - Files (service change, all 5 from R-3): `src/app/api/bookings/update-procedure/route.ts` (:138-144), `src/app/api/bookings/[id]/route.ts` (:183), `src/app/api/client/appointments/[id]/route.ts` (:175/:247), `src/app/api/master/appointments/[id]/route.ts` (:182), `src/app/api/admin/calendar/appointments/[id]/route.ts` (:111)
    - After the update commits and **only when `serviceId` actually changed**, `await resnapshotAppointmentPrice(appointmentId)` (awaited, unlike the notifier — the next read must see the new price).
    - In `bookings/[id]` and `bookings/update-time`, which run inside a `$transaction`, call it **after** the transaction resolves.
    - Do **not** touch the `notifyBookingUpdate` calls or their `previous` snapshots.

- [x] **Step 12: Migrate the existing price read sites to the snapshot (AD-6 sites 1–6, API + admin)**
  - Files: `src/app/api/client/profile/route.ts`, `src/app/api/bookings/all/route.ts`, `src/app/api/master/appointments/route.ts`, `src/app/api/admin/calendar/appointments/route.ts`, `src/app/admin/page.tsx`, `src/app/admin/TodaysAppointmentsTable.tsx`
  - Implement the AD-6 table rows 1–6 exactly as written there. Every price read becomes `resolveAppointmentPrice(appt.finalPrice, <the existing live derivation>)` — import the helper, do not inline `??` six times.
  - Sites 3 and 4 (the two calendar GET routes) **additionally** select and return `originalPrice` and `discount: { select: { label: true, percent: true } }` on each appointment, feeding Step 23's UI. Doing both in one pass avoids editing these two files twice.
  - **Do not** touch `ViewAppointmentModal.tsx` here — its effective-price rendering already works off the rewritten `service.price`. Step 23 owns the new discount line.
  - **Do not** touch `src/app/profile/page.tsx` or `src/components/booking-management/**` — they consume the rewritten API payloads unchanged.

- [x] **Step 13: Telegram booking bot quotes the discounted price**
  - Files: `src/lib/telegram-bot/handlers/confirm.ts` (`resolvePrice` :39-41 and `formatBookingSummary` :49-75)
  - Replace the `listMasterProcedures(...).find(...).price` lookup with `evaluateDiscount({ masterId, serviceId: procedureId, stage: 'final', startsAt: new Date(startISO), code: state.promoCode ?? null, clientPhone: state.phone ?? null })`.
  - `formatBookingSummary` keeps returning a single `{{price}}` string so **`bot.confirm.summary`/`bot.confirm.success` stay byte-identical in all three locales** (R-12). Build it as:
    - no discount → `` `${finalPrice} ${currency}` `` (today's behaviour verbatim);
    - discount → `t('bot.confirm.priceWithDiscount', { final, original, percent, currency, label })`.
  - Add an optional `pricing?: { originalPrice: number; finalPrice: number; discountPercent: number | null }` parameter: the `confirm:yes` **success** branch (:164-171) passes the values returned by `createBooking` (authoritative — no second evaluation), while `renderConfirmStep` omits it and evaluates live.
  - Reason this is not optional scope creep: the bot books through the shared `createBooking()`, so it **will** receive automatic discounts regardless. Leaving `resolvePrice` on the catalog price would quote a price different from the one charged.
  - `src/lib/telegram-bot/keyboards.ts:39-50` (procedure-picker button labels) stays on the catalog price — a pre-selection list, equivalent to `ProcedureSelect`'s catalog listing (AD-12).

- [x] **Step 14: Telegram booking bot — promo-code entry (OQ-3, user decided YES)**
  - Files: `src/lib/telegram-bot/wizard-state.ts`, `src/lib/telegram-bot/keyboards.ts`, `src/lib/telegram-bot/handlers/promo.ts` (new), `src/lib/telegram-bot/handlers/confirm.ts`, `src/lib/telegram-bot/bot.ts`. Strings are authored in Step 24.
  - **Read `handlers/contact.ts` and `handlers/consent.ts` first** — the new handler must follow their exact shape (`render<X>Step(ctx, chatId, state)` + `register<X>Handlers(bot)`, `botT(lang)`, guard every handler on `state.step`, `answerCallbackQuery()` before doing work).
  - **Placement in the funnel:** the promo code is an *optional affordance on the existing CONFIRM step*, not a new mandatory step. This mirrors the web flow (code entry at the final step, after the phone is known) and adds zero friction for users without a code. By CONFIRM the wizard already holds `masterId`, `procedureId`, `startISO` and an E.164 `phone`, so stage `'final'` evaluation — including `oncePerClient` — is fully possible.
  - `wizard-state.ts`:
    - `WizardStep` union gains `'PROMO'`;
    - `WizardState` gains `promoCode?: string` (already normalized uppercase).
  - `keyboards.ts`:
    - `confirmKeyboard(lang)` → `confirmKeyboard(lang, opts: { promoCode?: string })`. Rows: `[Book]`, then either `[🏷 bot.promo.addButton]` (no code) or `[🏷 bot.promo.removeButton {{code}}]` (code applied), then `[‹ Back]`. Single call site (`confirm.ts:86`), so the signature change is safe.
    - new `promoKeyboard(lang): InlineKeyboard` — one `bot.promo.cancel` button, `callback_data: 'promo:skip'`.
  - `handlers/promo.ts` (new):
    - `renderPromoStep(ctx, chatId, state)` — `setState({ ...state, step: 'PROMO' })` then `ctx.reply(t('bot.promo.prompt'), { reply_markup: promoKeyboard(lang) })`. Use `ctx.reply` (new message), not `editMessageText` — same as `renderContactStep`; leaving the previous message's buttons in place is the established convention (R-10), and every handler's `state.step` guard makes them no-ops.
    - `bot.callbackQuery('promo:add')` — guard `state.step === 'CONFIRM'`; `answerCallbackQuery()`; `renderPromoStep`.
    - `bot.callbackQuery('promo:skip')` — guard `state.step === 'PROMO'`; `answerCallbackQuery()`; `renderConfirmStep(ctx, chatId, { ...state, step: 'CONFIRM' })` (code left as-is).
    - `bot.callbackQuery('promo:remove')` — guard `state.step === 'CONFIRM'`; `answerCallbackQuery()`; `renderConfirmStep(ctx, chatId, { ...state, promoCode: undefined, step: 'CONFIRM' })`.
    - `bot.on('message:text', async (ctx, next) => { … })` — **this is the load-bearing part (R-11)**:
      ```ts
      if (ctx.msg.text.startsWith('/')) return next()
      const chatId = ctx.chat?.id
      if (chatId === undefined) return next()
      const state = await getState(chatId)
      if (!state || state.step !== 'PROMO' || !state.lang) return next()   // ← MUST call next()
      // …handle, and do NOT call next()
      ```
      Rate-limit first: `rateLimit(\`tgpromo:${chatId}\`, 10, 600)` → on `!allowed` reply `t('bot.promo.rateLimited')` and stay on PROMO (mirrors the `tgbook:` guard at `confirm.ts:137`).
      Then `const code = normalizeDiscountCode(ctx.msg.text)`, and `evaluateDiscount({ masterId, serviceId: procedureId, stage: 'final', startsAt: new Date(state.startISO), code, clientPhone: state.phone })`.
      - `codeStatus === 'valid'` → `renderConfirmStep(ctx, chatId, { ...state, promoCode: code, step: 'CONFIRM' })`, preceded by `ctx.reply(t('bot.promo.applied', { code }))`.
      - anything else → `ctx.reply(t(\`bot.promo.\${statusKey}\`), { reply_markup: promoKeyboard(lang) })` and stay on PROMO. Map `unknown|inactive|expired|not_applicable|already_used` to the five `bot.promo.*` keys — **switch on `codeStatus`, never on message text.**
  - `handlers/confirm.ts`:
    - `renderConfirmStep` passes `{ promoCode: state.promoCode }` to `confirmKeyboard`.
    - `back:time` (:90-108) additionally clears `promoCode` — the slot is about to change, and a happy-hour/at-that-time code must not silently carry over. (This is the only backward path out of CONFIRM, so it covers `back:date`/`back:procedure` too.)
    - `confirm:yes` passes `discountCode: state.promoCode ?? null` to `createBooking`.
    - the result `switch` (:186-199) gains `case 'DISCOUNT_INVALID':` → clear `promoCode` and `renderConfirmStep` again, preceded by `ctx.editMessageText(t('bot.error.discountInvalid'))`. Never leave the user stuck: the booking is re-confirmable at the undiscounted price in one tap.
  - `bot.ts`: `registerPromoHandlers(bot)` **must be registered before `registerContactHandlers(bot)`** (R-11). Add a comment at the call site stating why — this ordering is invisible to `tsc`/`lint` and silently breaks phone entry if reversed.
  - No new wizard entry point, no change to `handlers/start.ts`, `select.ts`, or `datetime.ts`.

### Phase D — Booking flow (client)

- [x] **Step 15: Pure extraction from `BookingForm.tsx` (no behaviour change)**
  - Files: `src/components/BookingAuthDetailsCard.tsx` (new), `src/components/BookingForm.tsx`
  - Move verbatim into the new `"use client"` component: state at :43-49, `openInlineEditor` (:217-224), `handleInlineDetailsSave` (:226-279), and the whole `isAuth` JSX branch (:319-410).
  - Props: `{ name, phone, email, authUser, onCommit: (v: { name: string; phone: string; email: string }) => void }` — the component owns its own edit-mode state; the parent keeps only `name`/`phone`/`email`.
  - `BookingForm.tsx` renders `{isAuth ? <BookingAuthDetailsCard .../> : <guest inputs …/>}`.
  - **Acceptance for this step alone:** `BookingForm.tsx` drops to ≈340 lines and the rendered output is byte-identical. Do not "improve" anything while moving (AGENTS/CLAUDE surgical-change rule).

- [x] **Step 16: Discount preview hook + UI pieces**
  - Files: `src/components/hooks/useDiscountPreview.ts` (new), `src/components/BookingPromoCodeField.tsx` (new), `src/components/BookingPriceSummary.tsx` (new)
  - `useDiscountPreview({ masterId, serviceId, startISO, phone })`:
    - `useQuery`-free (this is a POST); use a `useEffect` + `AbortController` for the automatic slot-stage preview, keyed on `[masterId, serviceId, startISO]`;
    - exposes `{ preview, loading, error, appliedCode, applyCode(code), clearCode() }`;
    - `applyCode` re-POSTs with `code` + `phone` (stage `'final'`) and stores the result; it is called **only from an explicit "Apply" button**, never on keystroke (rate limiting, AD-9);
    - `clearCode()` re-runs the slot-stage preview.
  - `BookingPromoCodeField.tsx` — collapsed "Have a promo code?" toggle → uppercase-transformed text input + Apply/Remove buttons + a status line rendering `codeStatus` through `booking.promo*` i18n keys. Uppercases on change so what the user sees matches what is stored (`normalizeDiscountCode`).
  - `BookingPriceSummary.tsx` — renders `originalPrice`/`finalPrice`; when `finalPrice < originalPrice`, shows the original struck through, the final in `text-foreground`, and a `-{percent}%` badge plus `label`. When there is no discount, renders the single price. Includes the "provisional until confirmed" hint (`booking.priceProvisional`) whenever the stage is not final.
  - Match the surrounding styling conventions of `BookingForm.tsx` (`rounded-xl border border-border`, `text-muted-foreground`, `btn btn-outline`) — these are booking-flow components, **not** admin ones, so no `admin.*` keys and no shadcn admin chrome.

- [x] **Step 17: Wire the promo code into `BookingForm` + submit**
  - Files: `src/components/BookingForm.tsx`, `src/components/hooks/useBookingSubmit.ts`
  - `BookingForm`: call `useDiscountPreview` with the current `procedureId`, `masterId`, `slot.startISO` and the effective phone; render `<BookingPriceSummary/>` under the existing procedure-name/termin header (:314-317) and `<BookingPromoCodeField/>` directly **below the phone field** (guest branch) / below the details card (auth branch), per the brief.
  - `useBookingSubmit`: add `discountCode` to its props and include it in **both** POST bodies (`bookWithoutConsents` :71-82 and `bookWithConsents` :147-162) and in both `useCallback` dependency arrays.
  - Capture the response pricing: `setEventId(body.eventId)` → also `setBookedPricing({ originalPrice, finalPrice, discountPercent })`; return it from the hook and pass it to `onSuccess`.
  - Add a `BOOKING_DISCOUNT_INVALID` branch to `handleBookingError` (:45-60). **Note the pre-existing inconsistency**: that function hardcodes Polish strings rather than using `t(apiErrorKey(code))`. Match the file you're editing — add a hardcoded Polish string consistent with its siblings, and mention the inconsistency in the handover notes. Do **not** refactor the whole function.

- [x] **Step 18: Discounted price on the success screens**
  - Files: `src/components/BookingSuccess.tsx`, `src/components/BookingSuccessPanel.tsx`, `src/app/[masterId]/page.tsx`
  - `BookingForm`'s `onSuccess` signature widens to `onSuccess?: (result: { originalPrice: number; finalPrice: number; discountPercent: number | null }) => void`.
  - `BookingSuccess` gains optional `originalPrice`/`discountPercent` alongside its existing `procedurePrice`; when a discount applies it renders the discounted figure (reuse `BookingPriceSummary`).
  - `src/app/[masterId]/page.tsx`: `handleBookingSuccess(result)` stores the pricing in `successBookingData`; both `<BookingSuccessPanel>` call sites (:343 desktop, :405 mobile) forward it. `BookingSuccessPanel` prefers the passed-in pricing over its `/api/procedures` lookup (:72-75) and falls back to the current behaviour when it is absent.
  - **Why this is required**: without it, the success screen shows the pre-discount catalog price for an appointment that was charged less — a visible correctness bug, not polish.

- [x] **Step 19: Discounted price in the catalog picker**
  - Files: `src/components/ProcedureSelect.tsx` (:60-63)
  - `formatProcedure` renders `p.price_after_discount_pln` (with the original struck through) when `p.discount_percent` is non-null, otherwise the current string verbatim. Keep the existing `${name} - ${duration} ${t('booking.minutes')}` prefix unchanged.

### Phase E — Admin & master UI

- [x] **Step 20: Server actions**
  - Files: `src/app/admin/discounts/actions.ts` (new)
  - Model on `src/app/admin/services/actions.ts` (same `"use server"` header, `getServerT()`, `build<X>Schema(t)` factory, `revalidatePath`, `FormState` shape).
  - ```ts
    export type DiscountFormState = { error?: string; fieldErrors?: Record<string, string[]>; success?: boolean }

    export async function createDiscount(requestedOwner: DiscountOwner, _prev: DiscountFormState, formData: FormData): Promise<DiscountFormState>
    export async function updateDiscount(id: string, _prev: DiscountFormState, formData: FormData): Promise<DiscountFormState>
    export async function deleteDiscount(id: string): Promise<void>
    export async function toggleDiscountActive(id: string, active: boolean): Promise<void>
    ```
  - `createDiscount` calls `authorizeDiscountScope(session?.user, requestedOwner)` and returns `{ error: t('errors.UNAUTHORIZED') }` on `null` — the requested owner is a **required leading parameter** so a forgotten argument is a `tsc` error, never a silent global write (the AD-5 discipline from the pages plan).
  - `updateDiscount`/`deleteDiscount`/`toggleDiscountActive` load the row and authorize with `canManageDiscount(session?.user, row)`; they never accept an owner from the client. `updateDiscount` must **not** allow changing `masterId`.
  - `buildDiscountSchema(t)` (zod):
    - `label` `z.string().trim().min(1, t('admin.discounts.labelRequired')).max(100)`
    - `percent` `z.coerce.number().int().min(1).max(100)`
    - `requiresCode` / `oncePerClient` / `active` — checkbox → boolean (`formData.get(x) === 'on'`)
    - `code` — required and `1..32` chars, `/^[A-Z0-9-]+$/` after `normalizeDiscountCode`, **iff** `requiresCode`; forced to `null` when `requiresCode` is false (`superRefine`)
    - `startDate`/`endDate` — optional `YYYY-MM-DD` → `new Date(v + 'T00:00:00')` / `new Date(v + 'T23:59:59')`; `superRefine` rejects `end < start` with `t('admin.discounts.dateRangeInvalid')`
    - window: `windowEnabled` checkbox; when enabled require ≥1 day checked **and** both `windowStart`/`windowEnd` present with `end > start`, else `t('admin.discounts.windowInvalid')`. Persist as `serializeWindowDays(days)` / `serializeWindowIntervals([{ start, end }])`; when disabled persist `null`/`null`.
  - Service scope from FormData: radio `scopeMode` = `"all" | "selected"`; when `"selected"`, collect keys matching `^service_(.+)$` (same `parseMasterAssignments` idiom as `services/actions.ts:44-60`). **Server-side re-verification**: when the authorized owner is `master`, every submitted `serviceId` must be in `await listMasterOfferedServiceIds(owner.masterId)` — otherwise return `{ error: t('errors.FORBIDDEN') }`. Never trust the client's checkbox list. (Per OQ-1 that set legitimately includes salon-owned services the master offers.)
  - Writes: `prisma.$transaction` — upsert the `Discount` row, then `discountService.deleteMany({ where: { discountId } })` + `createMany` (the same replace-all idiom `updateService` uses at :136-145).
  - Catch Prisma `P2002` on `code` → `{ fieldErrors: { code: [t('admin.discounts.codeTaken')] } }`.
  - `revalidateAll()` → `revalidatePath("/admin/discounts")` + `revalidatePath("/admin/master/discounts")`.
  - Keep under 300 lines; if the zod factory pushes past it, move `buildDiscountSchema` to a sibling `schema.ts`.

- [x] **Step 21: Shared admin components**
  - Files: `src/components/admin/discounts/DiscountListClient.tsx`, `DiscountForm.tsx`, `DiscountWindowFields.tsx`, `DiscountScopeFields.tsx` (all new, all `"use client"`)
  - `DiscountListClient` props: `{ discounts, owner: DiscountOwner, scope: "global" | "master", services: ServiceOption[], enabledLocales: Language[] }`. `owner` is the security payload forwarded verbatim to `createDiscount`; `scope` is **copy-only**, never used for authorization (the `PageListClient` convention).
  - Chrome copied from `src/app/admin/services/ServicesClient.tsx`: header eyebrow + description + `Sheet`/`SheetTrigger` add button; desktop `<table>` in `hidden lg:block rounded-[20px] border border-border bg-card shadow-sm overflow-hidden`, `<thead className="bg-muted/50 …">` with `text-[11px] font-medium uppercase tracking-wider` `<th>`s, `<tbody className="divide-y divide-border">`, `hover:bg-muted/40 transition-colors` rows; `lg:hidden` `DataCard` list with the same fields; **one** shared edit `Sheet` driven by `editTarget`/`editOpen` (never a per-row Sheet — `src/app/admin/AGENTS.md` mobile-card bullet).
  - Columns: Label · Percent · Type (`Badge variant="muted"` "Automatic" / `Badge variant="warning"` "Code: XYZ") · Scope (all services / N services) · Window (days+hours or "—") · Period (dates or "—") · Status (`Badge variant="success"` active / `variant="muted"` inactive) · Actions (Pencil, Trash2).
  - Delete: `if (!(await confirm(t('admin.discounts.deleteConfirm')))) return` with `useConfirm()` from `@/components/ConfirmDialogProvider`. **Native `confirm()` is banned by the `no-alert` ESLint rule — do not reintroduce it.**
  - `DiscountForm` uses `useFormState(action, initialState)` with `action = discount ? updateDiscount.bind(null, discount.id) : createDiscount.bind(null, owner)` (exactly `ServiceForm.tsx:50-54` / `PageFormSheet.tsx:40`), a `SubmitButton` using `useFormStatus`, and `useEffect(() => { if (state.success) onSuccess() }, …)`.
  - `DiscountScopeFields`: `scopeMode` radio + a scrollable checkbox list of `services` (`service_<id>` names), disabled when `scopeMode === "all"`. Show the hint that "all" means "all services this specialist offers" on the master surface (`admin.discounts.scopeAllMasterHint`) vs "all salon services" on the global one.
  - `DiscountWindowFields`: `windowEnabled` checkbox + 7 day checkboxes (`day_0`…`day_6`, labelled via the existing `dates.*` weekday keys if present — otherwise add `admin.discounts.day0…day6`) + two `type="time"` inputs `windowStart`/`windowEnd`.
  - **`label` is plain text, not per-locale** — it is admin-facing only (brief). Do **not** use `LocalizedFieldInput` here.
  - Every file under 250 lines.

- [x] **Step 22: The two routes + nav**
  - Files: `src/app/admin/discounts/page.tsx`, `src/app/admin/discounts/loading.tsx`, `src/app/admin/master/discounts/page.tsx`, `src/app/admin/master/discounts/loading.tsx` (all new), `src/components/admin/adminNavItems.ts`
  - `/admin/discounts` (async Server Component, model on `src/app/admin/pages/page.tsx`):
    - `const session = await auth()`; `if (!session?.user || !["ADMIN","SUPERADMIN"].includes(session.user.role ?? "")) redirect("/auth/login")`;
    - `listDiscountsForOwner({ ownerType: "global", masterId: null })`;
    - services list = **all** services (`prisma.service.findMany({ orderBy: { name_pl: "asc" } })`), mapped to `{ id, name_pl, name_en, name_uk }`;
    - render `<DiscountListClient discounts={…} owner={{ ownerType: "global", masterId: null }} scope="global" services={…} enabledLocales={…} />` (`enabledLocales` via `getTenantConfig()` + `parseEnabledLocales`, used only to resolve service names in the picker).
  - `/admin/master/discounts`: MASTER-only guard (`session.user.role !== "MASTER"` → redirect); `listDiscountsForOwner({ ownerType: "master", masterId: session.user.id })`; services list = **only the master's offered services**, resolved with `listMasterOfferedServiceIds(session.user.id)` + a `service.findMany({ where: { id: { in: [...ids] } } })`.
  - Both `loading.tsx`: `import TableSkeleton from "@/components/admin/skeletons/TableSkeleton"; export default function …Loading() { return <TableSkeleton /> }` (copy `src/app/admin/pages/loading.tsx`).
  - `adminNavItems.ts`: import `Percent` from `lucide-react`; add `{ labelKey: "admin.nav.discounts", href: "/admin/discounts", icon: Percent }` to `adminNavItems` (after `services`) **and** `{ labelKey: "admin.nav.discounts", href: "/admin/master/discounts", icon: Percent }` to `masterNavItems` (after `services`). The sidebar and `AdminTopBar` title pick it up automatically — **do not** hardcode a title in either page.
  - ⚠ `isNavItemActive` uses `startsWith` for non-`exact` items. `/admin/discounts` is a prefix of nothing else here, and the MASTER list is checked before the ADMIN list in `getNavItemsForRole`, so `/admin/master/discounts` resolves correctly for a MASTER. Verify there is no cross-highlight with `/admin/master` (which **is** `exact: true`) — there isn't, but confirm.

- [x] **Step 23: Show the applied discount on the calendar appointment detail (OQ-2, user decided YES)**
  - Files: `src/lib/discounts/shared.ts` (the `discountPercentFromSnapshot` helper from Step 3), `src/app/admin/master/calendar/ModernCalendar.tsx`, `src/app/admin/master/calendar/ViewAppointmentModal.tsx`. Strings are authored in Step 24.
  - The **API half is already done in Step 12** — sites 3/4 return `originalPrice` and `discount: { label, percent } | null`. Do not touch those routes again.
  - `ModernCalendar.tsx` (:21-31): the exported `Appointment` type gains `originalPrice?: number | null` and `discount?: { label: string; percent: number } | null`. **Type-only edit — no logic, no rendering change in this file.**
  - `ViewAppointmentModal.tsx`:
    - Keep `formattedServicePrice` (:33-41) and its `Intl.NumberFormat("pl-PL", { style: "currency", currency: "PLN" })` behaviour exactly as-is. Extract that formatting into a tiny local `formatPln(n: number)` so the "regular price" line can reuse it — this is a refactor **our** change forces, not gratuitous cleanup.
    - Compute once:
      ```ts
      const discountPercent =
        appointment.discount?.percent ??
        discountPercentFromSnapshot(appointment.originalPrice, appointment.service.price)
      ```
    - Render, directly beneath the existing price row and only when `discountPercent !== null && discountPercent > 0`, a compact muted block (`text-xs text-muted-foreground`, no new imports):
      - `appointment.discount?.label` present → `t('admin.calendar.discountApplied', { percent: discountPercent, label: appointment.discount.label })`
      - otherwise → `t('admin.calendar.discountAppliedNoLabel', { percent: discountPercent })`
      - plus, when `appointment.originalPrice != null && appointment.originalPrice > appointment.service.price`, `t('admin.calendar.originalPriceLine', { price: formatPln(appointment.originalPrice) })`.
    - Do **not** introduce a `Badge` here — the file imports no badge today and a plain muted line keeps the diff minimal.
  - **Why the derived fallback matters:** `Appointment.discountId` is `onDelete: SetNull` (AD-1), so deleting a promotion drops the label but leaves `originalPrice`/`finalPrice` — the percentage must still render. This is exactly why no denormalized columns were added.
  - Client-facing surfaces (profile card, booking-management panels) deliberately get **no** discount badge (AD-12).

### Phase F — Tests, docs, verification

- [x] **Step 24: i18n — all three locales**
  - Files: `src/locales/pl.json`, `src/locales/en.json`, `src/locales/uk.json` (structurally identical; use the same anchors in each)
  - `admin.nav` (after `"services"`): `discounts` — en `"Discounts"`, pl `"Rabaty"`, uk `"Знижки"`.
  - New `admin.discounts` block, inserted after the `admin.services` block (en copy below; author the pl/uk equivalents — **pl is the default locale and must be correct Polish**):
    - list: `manageEyebrow` "Manage", `manageDesc` "Percentage discounts applied at booking time", `masterDesc` "Discounts for your own services", `addTrigger` "Add discount", `addTitle` "Add Discount", `editTitle` "Edit Discount", `noneTitle` "No discounts yet.", `noneHint` "Click “{{title}}” to create the first one.", `deleteConfirm` "Delete this discount?"
    - columns: `colLabel` "Label", `colPercent` "Discount", `colType` "Type", `colScope` "Applies to", `colWindow` "Happy hour", `colPeriod` "Period", `colStatus` "Status", `colActions` "Actions"
    - values: `typeAutomatic` "Automatic", `typeCode` "Code", `scopeAll` "All services", `scopeCount` "{{count}} services", `statusActive` "Active", `statusInactive` "Inactive", `none` "—"
    - form: `labelField` "Internal label", `labelPlaceholder` "e.g. Tuesday happy hour", `labelHint` "Only visible to you — never shown to clients.", `percentField` "Discount (%)", `requiresCode` "Require a promo code", `codeField` "Promo code", `codePlaceholder` "e.g. WELCOME10", `codeHint` "Case-insensitive; stored in uppercase.", `oncePerClient` "One use per client (matched by phone)", `oncePerClientHint` "Use this together with a promo code to build a welcome offer.", `scopeMode` "Applies to", `scopeModeAll` "All services", `scopeModeSelected` "Selected services", `scopeAllMasterHint` "All services you currently offer.", `scopeAllGlobalHint` "All salon services.", `windowEnabled` "Only during certain days/hours", `windowDays` "Days", `windowFrom` "From", `windowTo` "To", `periodFrom` "Active from", `periodTo` "Active until", `activeField` "Active", `activeHint` "Turn off to pause without deleting.", `saveBtn` "Save discount", `updateBtn` "Update discount", `day0`…`day6` "Sunday"…"Saturday"
    - errors: `labelRequired` "Label is required", `codeRequired` "A promo code is required when the code option is on", `codeFormat` "Only letters, digits and dashes", `codeTaken` "This promo code is already in use", `dateRangeInvalid` "The end date must be after the start date", `windowInvalid` "Pick at least one day and a valid time range", `createError` "Failed to create discount. Please try again.", `updateError` "Failed to update discount. Please try again."
  - `admin.calendar` block (Step 23): `discountApplied` "−{{percent}}% · {{label}}", `discountAppliedNoLabel` "−{{percent}}% discount", `originalPriceLine` "Regular price: {{price}}".
  - `booking` block (client-facing): `promoToggle` "Have a promo code?", `promoLabel` "Promo code", `promoPlaceholder` "Enter code", `promoApply` "Apply", `promoRemove` "Remove", `promoValid` "Promo code applied", `promoUnknown` "We don't recognise this code", `promoInactive` "This code is no longer active", `promoExpired` "This code has expired", `promoNotApplicable` "This code doesn't apply to this service or time", `promoAlreadyUsed` "This code has already been used with this phone number", `promoBetterExists` "A better discount already applies", `priceOriginal` "Regular price", `priceFinal` "Your price", `priceProvisional` "Final price is confirmed when you book"
  - `bot` block (Steps 13 + 14) — new `bot.promo` sub-block: `addButton` "🏷 I have a promo code", `removeButton` "🏷 Remove code {{code}}", `prompt` "Send me your promo code 👇", `cancel` "‹ Skip", `applied` "Promo code {{code}} applied ✅", `unknown` "We don't recognise that code. Try again or skip 👇", `inactive` "That code is no longer active. Try another or skip 👇", `expired` "That code has expired. Try another or skip 👇", `not_applicable` "That code doesn't apply to this service or time. Try another or skip 👇", `already_used` "That code has already been used with this phone number.", `rateLimited` "Too many attempts. Please try again later."
    - plus `bot.confirm.priceWithDiscount` "{{final}} {{currency}} (was {{original}} {{currency}}, −{{percent}}%)" and `bot.error.discountInvalid` "Your promo code is no longer valid, so it was removed. Please confirm again."
    - **`bot.confirm.summary` and `bot.confirm.success` must stay byte-identical** — the discount is folded into the existing `{{price}}` interpolation (Step 13).
  - `errors.DISCOUNT_INVALID` (Step 10).
  - **No hardcoded user-facing string anywhere in the new code.** Admin components use `useTranslation()` (client) / `getServerT()` (server actions & Server Components) per `src/app/admin/AGENTS.md`; bot code uses `botT(lang)`.

- [x] **Step 25: Tests**
  - `tests/lib/discounts/eligibility.test.ts` (new, **no mocks** — pure): highest-percent-wins with a code + automatic both eligible; never sums; deterministic tie-break; `active:false` excluded; before `startDate` / after `endDate` excluded; wrong `masterId` excluded; global (`masterId:null`) applies to any master; service-scoped in/out; windowed discount excluded at stage `'catalog'`, included at `'slot'` when the day **and** minute match, excluded when only the day matches; a days-only or hours-only window is treated as no window; `requiresCode` excluded at `'catalog'`/`'slot'` and at `'final'` without a matching code; `oncePerClient` excluded when `hasClientIdentity:false` and when the id is in `redeemedDiscountIds`; `percent` outside `1..100` rejected. Plus `explainCode` returning **each** `CodeStatus` value — this doubles as the coverage for the Telegram bot's promo branches, which switch on exactly that union (Step 14).
  - `tests/lib/discounts/shared.test.ts` (new): `normalizeDiscountCode` (whitespace/case/empty); `parseWindowDays`/`parseWindowIntervals` round-trip and malformed-JSON → `[]`; `applyPercent` rounding (e.g. `applyPercent(149.99, 15) === 127.49`); `resolveAppointmentPrice` null-fallback; `discountPercentFromSnapshot` (normal case, equal prices → `null`, `originalPrice = 0` → `null`, nullish inputs → `null`) — the Step 23 fallback path.
  - `tests/lib/discounts/authz.test.ts` (new): mirror `tests/lib/content/pages-owner.test.ts`'s `vi.hoisted` + `vi.mock('@/lib/prisma')` pattern. `canManageDiscount`: ADMIN/SUPERADMIN true for global and any master's row; MASTER true only for own row; CLIENT/null false. `authorizeDiscountScope`: MASTER requesting global → `null`; MASTER requesting another master's id → `null`; MASTER requesting own id → fresh master scope; ADMIN requesting global → fresh global scope; **ADMIN requesting a master scope → `null`** (the AD-8 divergence); anonymous → `null`.
  - `tests/app/api/discounts/preview/route.test.ts` (new): rate-limit rejection; validation error; unknown service → 404; automatic discount applied at stage `'slot'`; code accepted / `already_used` when a redemption exists. Mock `@/lib/prisma` and `@/lib/cache`. Do **not** add a `@/auth` mock — the route must not import `@/auth`.
  - `tests/lib/booking-service.test.ts` (extend): add `discount`, `discountService`, `discountRedemption`, `masterService`, `masterProfile` to `mockPrisma` (per `prisma/AGENTS.md`: a schema change requires updating mocks). Assert that `appointment.create` receives `originalPrice`/`finalPrice`/`discountId`; that `discountRedemption.create` fires exactly once when a discount applies and not at all when none does; that a supplied-but-unknown `discountCode` returns `{ ok:false, code:'DISCOUNT_INVALID' }` and **no** appointment is created; that the in-transaction `oncePerClient` re-check returns `DISCOUNT_INVALID`.
  - `tests/app/api/book/consent-gate.test.ts` (extend mocks only): add the same new models so the existing assertions keep passing.
  - `tests/app/api/procedures/route.test.ts` (extend): the three new fields are `null` when there are no discounts and populated when there are; **every pre-existing field keeps its exact value** (regression guard for the additive contract).
  - `tests/app/api/master/appointments/route.test.ts` (extend): the GET response prefers `finalPrice` over the `MasterService.priceOverride` lookup when non-null, falls back to the override when `finalPrice` is `null` (pre-migration row), and passes `originalPrice` + `discount { label, percent }` through (Step 12/23 contract).
  - `tests/lib/errors/apiErrorKey.test.ts`: verify it still passes with `DISCOUNT_INVALID` added.
  - **No new grammy handler tests.** There is no existing test harness for `src/lib/telegram-bot/handlers/**` (only `tests/lib/notifications/client-telegram.test.ts` exists) and building one is out of scope; the bot's promo logic is pure delegation to `evaluateDiscount`/`explainCode`, which the first test file above covers exhaustively. The bot flow is verified manually (Step 27).
  - Run `npx vitest run tests/lib/discounts tests/app/api/discounts` first, then the full `npm run test`.

- [x] **Step 26: DOX pass**
  - `prisma/AGENTS.md` — Ownership model list gains `Discount`, `DiscountService`, `DiscountRedemption`. One new Local Contract bullet: `Appointment.originalPrice`/`finalPrice`/`discountId` are a **nullable snapshot** written by all three create sites; `null` means "pre-discounts row" and readers fall back to the live `MasterService.priceOverride ?? Service.price` via `resolveAppointmentPrice()`; there is no backfill; `Discount.masterId` mirrors `Service.masterId` semantics; `Discount.code` is stored uppercase-normalized (that is what makes the `@unique` index case-insensitive); `label`/`percent` are deliberately **not** denormalized onto `Appointment` — `discountId` is `SetNull` and the percentage stays derivable from the price snapshot.
  - `src/lib/AGENTS.md` — one new Local Contract bullet for `discounts/`: the `shared.ts` (client-safe) / `eligibility.ts` (pure) / `server.ts` (Prisma) split; `evaluateDiscount()` is the single source of truth for every price shown or charged, **including the Telegram bot** (in-process, never via HTTP self-call); the highest-percent-never-stack rule; the three stages; the `authorizeDiscountScope`/`canManageDiscount` pair; `resnapshotAppointmentPrice()` is called by every service-changing route; `hhmmToMinutes` deliberately duplicates `t2m`. **Second bullet for `telegram-bot/`**: the wizard gained a `'PROMO'` step reachable only from `CONFIRM`; `handlers/promo.ts` must stay registered **before** `handlers/contact.ts` in `bot.ts` and must `return next()` when it doesn't handle a `message:text`, because `contact.ts`'s listener halts the middleware chain.
  - `src/app/api/AGENTS.md` — one bullet: `POST /api/discounts/preview` is public + rate-limited and never accepts a client-computed price; `/api/procedures` discount fields are additive; `POST /api/book` re-evaluates server-side and returns `DISCOUNT_INVALID` rather than silently charging more; the four read sites that must prefer `finalPrice` via `resolveAppointmentPrice()`; the two calendar GET routes additionally return `originalPrice` + `discount { label, percent }` for the appointment-detail badge.
  - `src/app/admin/AGENTS.md` — one bullet: discounts have **two** surfaces (`discounts/` global, `master/discounts/` self-service) sharing one component set and one `actions.ts`; `createDiscount` takes a required `DiscountOwner` authorized by `authorizeDiscountScope`; row-targeted actions authorize against the row via `canManageDiscount`; there is deliberately **no** admin-on-behalf surface; `ViewAppointmentModal` shows the applied discount (label + percent, percent derived from the price snapshot when the `Discount` row is gone).
  - `src/components/AGENTS.md` — one bullet: `admin/discounts/*` shared components (`owner` = security payload, `scope` = copy only); and that the booking-flow promo-code UI lives in `BookingPromoCodeField.tsx`/`BookingPriceSummary.tsx`/`useDiscountPreview.ts`, with `BookingAuthDetailsCard.tsx` split out of `BookingForm.tsx` purely to stay under 500 lines.
  - `tests/AGENTS.md` — one line noting the new `tests/lib/discounts/**` and `tests/app/api/discounts/**` files, that `tests/lib/discounts/eligibility.test.ts` needs no mocks by design, and that the Telegram promo step is deliberately covered through that pure suite rather than a grammy harness.
  - **Do not** edit the stale `procedures:v2:<masterId>` wording in `src/lib/AGENTS.md` / `src/app/api/AGENTS.md` — see OQ-5.

- [x] **Step 27: Verification & handover**
  - `npm run lint` (zero warnings; capture the pre-existing baseline via `git stash` before blaming a new error on this work — the pages plan documented 40 pre-existing errors / 5 warnings).
  - `npm run test` (full suite; baseline before this work is 18 files / 101 tests green).
  - **Do NOT run `npm run dev` or `npm run build`** — standing user constraint; a one-shot build can corrupt `.next/` under the user's running dev server.
  - Produce a short **Russian** step-by-step manual-check list covering at minimum:
    1. глобальная автоматическая скидка на одну услугу → цена падает в выпадающем списке услуг на `/{masterId}` и в сводке брони;
    2. happy-hour скидка → в списке услуг цена обычная, падает только после выбора слота внутри окна;
    3. код `requiresCode + oncePerClient` → ввод кода снижает цену, бронь проходит; повторный ввод с того же телефона → «уже использован»;
    4. две подходящие скидки → применяется только бо́льшая, не сумма;
    5. мастер создаёт скидку на `/admin/master/discounts` → действует только на его записи, в списке услуг только те, что он оказывает;
    6. изменить цену услуги после брони → цена уже созданной записи **не** меняется;
    7. сменить услугу в записи из клиентской панели → цена пересчитывается на новую услугу без скидки;
    8. выручка на дашборде админа считается по ценам со скидкой;
    9. запись, созданная **до** миграции, везде показывает цену;
    10. **(OQ-2)** открыть запись со скидкой в календаре админа/мастера → под ценой строка «−20% · Название» и «Обычная цена: …»; удалить саму скидку → строка остаётся, но уже как «−20% скидка» без названия;
    11. **(OQ-3)** в Telegram-боте дойти до шага подтверждения → кнопка «🏷 У меня есть промокод», ввод неверного кода → конкретное сообщение и возможность повторить/пропустить; ввод верного кода → цена в сводке меняется, кнопка становится «убрать код»; подтвердить бронь → списанная цена совпадает с показанной; кнопка «‹ Назад» на шаге подтверждения сбрасывает код;
    12. **(OQ-3, регрессия)** в боте обычная отправка номера телефона текстом по-прежнему работает (проверка порядка middleware).

---

## Acceptance Criteria

- [ ] `npm run test` passes (existing suite green + the 4 new test files + the 5 extended ones)
- [ ] `npm run lint` passes with zero **new** warnings/errors versus the stashed baseline
- [ ] Migration applies cleanly to the live dev DB with **no data loss** and no interactive prompt
- [ ] No file exceeds **500 lines** — specifically `BookingForm.tsx` is ≈340 after Step 15, and `discounts/server.ts`, `admin/discounts/actions.ts`, `DiscountListClient.tsx`, `DiscountForm.tsx` are each under 300
- [ ] `POST /api/book` **never** accepts a price from the client and always recomputes; a tampered/ineligible `discountCode` yields `DISCOUNT_INVALID` and creates no appointment
- [ ] Two simultaneously-eligible discounts produce exactly one applied discount — the higher `percent` — and never a summed one
- [ ] `oncePerClient` is enforced by normalized E.164 phone, re-checked inside the booking `$transaction`, and fails closed when no valid phone exists
- [ ] A MASTER cannot create or edit a global discount, cannot create a discount for another master, and cannot scope a discount to a service they don't offer (server-side verified, not just UI-hidden). A master **may** scope a discount to a salon-owned service they offer (OQ-1)
- [ ] An ADMIN action never falls through to a master scope and vice versa: `createDiscount`'s owner is a required typed parameter and `authorizeDiscountScope` returns a freshly built object or `null`
- [ ] Every appointment created after the migration has non-null `originalPrice`/`finalPrice`; editing a `Service.price` afterwards does not change what that appointment displays anywhere
- [ ] Appointments created **before** the migration still render a price at all 7 read sites in AD-6 (live fallback)
- [ ] Changing an appointment's service re-snapshots the price, clears `discountId`, and deletes the redemption row (restoring `oncePerClient` eligibility)
- [ ] **(OQ-2)** The admin/master calendar's appointment detail shows `−{percent}% · {label}` plus the regular price for a discounted booking, and degrades to `−{percent}%` derived from the price snapshot when the `Discount` row has since been deleted
- [ ] **(OQ-3)** The Telegram bot offers promo-code entry at the CONFIRM step, shows a distinct message for each of `unknown`/`inactive`/`expired`/`not_applicable`/`already_used`, lets the user retry or skip, and the code it accepted is the one `createBooking` applies — the summary price always equals the persisted `finalPrice`
- [ ] **(OQ-3, regression)** Typing a phone number as plain text in the bot still works — the promo `message:text` listener calls `next()` for every step other than `PROMO`, and is registered before `registerContactHandlers`
- [ ] The price the Telegram bot quotes at confirm equals the price `createBooking` persists (both with and without a code)
- [ ] `pl`/`en`/`uk` all carry every new key including the `bot.promo.*` set; `bot.confirm.summary`/`bot.confirm.success` are unchanged; no hardcoded user-facing string in new code; delete confirmations use `useConfirm()`, never native `confirm()`
- [ ] AGENTS.md DOX pass done per Step 26

---

## Constraints & Risks

- **Do not touch**: `src/middleware.ts`, `src/lib/notifications/**` (R-7 — no price is rendered there), `src/lib/availability.ts`, `src/lib/schedule-utils.ts`, `src/lib/cache.ts`, `src/components/booking-management/**`, `src/app/profile/page.tsx`, `src/app/admin/services/**`, `src/app/admin/master/services/**`, `src/lib/price.ts`, and the bot's `handlers/{start,select,datetime}.ts` + `keyboards.ts:39-50`.
- **Do not fork** `ServicesClient`/`ServiceForm` or `MasterServicesClient`/`MasterServiceForm` into discount copies — one shared component set, per AD-8.
- **Do not add a Prisma `enum`**, do not add denormalized discount columns to `Appointment` (AD-1), and do not hand-edit `migrations/` or `app.db` (`prisma/AGENTS.md`).
- **Do not reintroduce native `confirm()`/`alert()`** — banned app-wide by the `no-alert` ESLint rule; it was eliminated project-wide in the immediately preceding work.
- **Do not run `npm run dev` or `npm run build`** and do not open a browser — the user verifies manually.
- **Risk — grammy middleware ordering (Step 14).** `handlers/contact.ts:79-92` registers `bot.on('message:text')` and returns **without** `next()`, which halts the chain. `registerPromoHandlers` must be registered **before** `registerContactHandlers` in `bot.ts`, and its text listener must `return next()` for every step other than `'PROMO'`. Get this wrong and either phone entry or promo entry silently stops working — no `tsc`, `lint` or `build` error, and no test coverage (there is no grammy harness). This is the single highest-risk item in the plan; verify it manually per Step 27 check 12.
- **Risk — the additive `/api/procedures` contract.** Five components consume `price_pln` from that endpoint. Every existing field must keep its exact value; the discount fields are strictly additional. `tests/app/api/procedures/route.test.ts` is the regression guard.
- **Risk — bot summary-vs-charge divergence.** `renderConfirmStep` evaluates live while `confirm:yes` persists whatever `createBooking` computes. Step 13's `pricing` override on the success branch and Step 14's `DISCOUNT_INVALID` case are what keep the two in sync; do not "simplify" either away.
- **Risk — the 500-line limit on `BookingForm.tsx`.** Step 15 must land before Steps 16/17 touch the same file, otherwise the limit is breached mid-flight.
- **Risk — timezone.** The happy-hour window must be matched in `Europe/Warsaw` wall-clock, using the same `Intl.DateTimeFormat` idiom as `booking-service.ts:78-95`. A bare `Date.getDay()`/`getHours()` would silently drift with the server TZ — invisible to `tsc`/`lint`/`build` and only wrong at certain hours.
- **Risk — `oncePerClient` race.** Accepted and narrow (see AD-10). Mitigated by the in-transaction re-check; matches the project's existing posture on the double-booking window.
- **Risk — code-existence oracle.** `POST /api/discounts/preview` reveals whether a code exists and whether a given phone has used it. Rate-limited to 30/min/IP; no PII is ever returned. The bot's equivalent path is rate-limited to 10/10 min per chat id. Accepted.
- **Deliberate behaviour changes — call these out in the final summary:**
  1. The admin dashboard **Revenue** figure becomes discount-aware.
  2. Editing a `Service.price` no longer retroactively changes the displayed price of appointments created after the migration (it still does for pre-migration ones — by design).
  3. A happy-hour discount **survives** a later reschedule out of the window (AD-7), but is cleared when the user steps back to slot selection **inside the bot wizard** before confirming (Step 14, `back:time`).
  4. Changing an appointment's service **drops** its discount entirely rather than re-evaluating (AD-7).
  5. `confirmKeyboard(lang)` in the bot gains a second parameter — a signature change with exactly one call site.

---

## RESOLVED QUESTIONS (user decisions, 2026-07-27)

- **OQ-1 — May a MASTER discount a *salon-owned* (global) service they offer? → YES, confirmed.**
  `listMasterOfferedServiceIds` (Step 5) resolves the master's `MasterService` join, which legitimately includes salon-owned services assigned to them. Do **not** narrow it to `Service.masterId === masterId`. Enforced server-side in Step 20 and reflected in the Acceptance Criteria.

- **OQ-2 — Show which discount was applied, in the admin/master calendar? → YES, in this pass.**
  Implemented by **Step 12** (the two calendar GET routes return `originalPrice` + `discount { label, percent }`) and **Step 23** (`ViewAppointmentModal` renders the line; `ModernCalendar`'s type widens). No schema change: the percentage is derivable from the price snapshot via `discountPercentFromSnapshot()`, so it survives deletion of the `Discount` row (AD-1). AD-6 and AD-12 were corrected accordingly — `ViewAppointmentModal.tsx` is **no longer** in the "must NOT change" / "do not touch" lists.

- **OQ-3 — Promo-code entry in the Telegram booking bot? → YES, add it.**
  Implemented by **Step 14** as an optional affordance on the existing CONFIRM step (new `'PROMO'` wizard step, `handlers/promo.ts`, `bot.promo.*` strings), validated through the same `evaluateDiscount()`/`explainCode()` the web flow uses. AD-12's "no promo-code step in the bot" bullet was removed; the only bot-related exclusion left is the procedure-picker list, which stays catalog-priced.

- **OQ-4 — Manual discount attachment on calendar-created appointments? → NO, confirmed.**
  Manually created appointments snapshot at full price with `discountId = null` (Step 11). Remains in AD-12.

---

## OPEN QUESTIONS

- **OQ-5 — The `procedures:v2:<masterId>` cache key documented in `src/lib/AGENTS.md` line 13 and `src/app/api/AGENTS.md` line 16 does not exist in the codebase (R-4).** *(Still open — deferred by the user.)*
  This makes the brief's "should discounts piggyback on the procedures cache?" question moot — there is nothing to invalidate, and this plan adds no cache key. But per DOX ("delete stale or contradictory text immediately") those two bullets should arguably be corrected. That is an unrelated documentation fix touching two AGENTS.md files, so **this plan deliberately leaves them alone** (Step 26 says so explicitly). To be handled as a separate task.
