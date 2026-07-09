# Plan: Client Profile / self-service cabinet M3 Pass — Stage 4

**Date:** 2026-07-09
**Status:** Implementation complete, pending manual browser sign-off

## Goal

Bring the logged-in CLIENT profile/cabinet (`/profile` dashboard + `/profile/edit`
form + the two `src/components/profile/*` widgets) into the Somique Beauty / M3 visual
language — **visual chrome only, zero change to any appointment / profile / GDPR
logic** — matching the `ProfilePage` mockup the user chose.

---

## Context (what I found)

### Source of truth (design reference)
- Mockup: `Somique Beauty Design System/ui_kits/client/pages.jsx` → `ProfilePage`
  (lines 438-522), tokens in `.../client/shared.jsx`.
- Mockup card signature: `borderRadius:16/20`, `border:1px solid t.border`,
  `background:t.card`, soft `boxShadow`, row labels `fontSize:14 fontWeight:500
  color:t.text`, sub-text `color:t.textSub`. Strongest weight anywhere in the mockup
  is **500** (name / row labels) — nothing is `font-bold`.
- Mockup's **distinctive M3 element**: appointment **status pill chips** — a rounded
  `borderRadius:9999` badge with a tinted container background + on-container text
  (`{bg:t.sucCont, color:t.success}` for completed, `{bg:t.errCont, color:t.error}`
  for cancelled). The live app renders status as **bare colored text**. This is the
  one genuine new-visual upgrade in this stage.
- The live pages already render every card through the shared shadcn `Card`
  (`src/components/ui/card.tsx`), which is already M3 and **is NOT edited** (shared
  primitive, locked).

### Scope inventory (4 files) — this stage is ~90% token hygiene, one new visual
| File | Lines | Work |
| --- | --- | --- |
| `src/app/profile/page.tsx` | 354 | Dead-token swaps (16 sites) + `<h1>` weight + **status pill chips** |
| `src/app/profile/edit/page.tsx` | 248 | Dead-token swaps (3 sites) + `<h1>` weight |
| `src/components/profile/LinkBookingsCard.tsx` | 129 | Dead-token swap (1 site) |
| `src/components/profile/EditAppointmentModal.tsx` | 267 | **No changes** — already fully semantic |

All four are far under the 500-line limit; **no step adds new lines** (chip step is a
1:1 tag+class swap of an existing `<div>` → `<span>`), so line counts are unchanged.
Largest touched file stays 354. **No line-count risk.**

### The token-hygiene story is identical to Stage 3
The profile files predate the M3 semantic layer and carry the same dead legacy tokens.
Confirmed against `src/styles/globals.css` lines 480-486: the utilities `.text-text`,
`.text-muted`, `.text-dark-text`, `.text-dark-muted`, `.border-dark-border` resolve to
bare tenant vars (`--color-text`, `--color-muted`, `--color-dark-*`) with **no `--md-*`
fallback** — so they render as unset/inherited when the tenant hasn't set that field.
The M3-correct replacements are the semantic tokens (`text-foreground`,
`text-muted-foreground`, `border-border`) which carry the full `--color-* → --md-*`
fallback chain (globals.css lines 381-463).

Note on `text-muted`: it maps to `--color-muted` (a *text* var), **not** the Tailwind
`muted` surface color — but it has no fallback, so like Stage 3 it is replaced by
`text-muted-foreground` (except inside the status-chip mapping, where the chip *needs*
a surface background → `bg-muted text-muted-foreground`).

### No `text-white`/`bg-neutral` correctness bug here (unlike Stage 3)
Grep across all 4 files: **no** `text-white`, `bg-neutral-*`, `border-neutral-*`,
`text-neutral-*`, or `dark:*-accent` overrides. This stage has no BookingConsentModal-
class contrast bug to fix — it is pure dead-token cleanup + the chip upgrade.

### Status chips — colors already have in-codebase precedent
The chip tints reuse the exact green/red container utilities **already shipped** in
`LinkBookingsCard.tsx` lines 108-110 (`bg-green-50 text-green-700 dark:bg-green-950
dark:text-green-300` / red equivalents). Per the Stage 2/3 ruling, plain Tailwind
status utilities (`green`/`red`/`yellow`) are **valid** — there is no `success` color
in `tailwind.config.ts` (only `destructive`/`muted`/`accent`/`primary`), so status
tints legitimately stay Tailwind palette. No new tokens invented.

### GDPR boundary — the mockup's "Privacy & GDPR" tab is OUT of scope
The mockup `ProfilePage` has a second tab (Export / Delete / Withdraw). **The live
profile does not surface GDPR at all** — GDPR self-service lives on its own page,
`src/app/support/page.tsx` (backed by `/api/consents/*`). This stage does **not** add a
GDPR tab, does **not** touch `/support`, and does **not** wire any erase/export/withdraw
action into `/profile`. GDPR remains a separate page (and any GDPR restyle is a
separate future stage).

### booking-management overlap — NOT a concern
`src/app/profile/page.tsx` imports only `@/components/profile/LinkBookingsCard` and
`@/components/profile/EditAppointmentModal`. It does **not** import from
`src/components/booking-management/**`. The profile's edit/cancel self-service is
implemented inline in `profile/page.tsx` + `EditAppointmentModal.tsx` (a separate
implementation from the deferred `booking-management` module). No boundary is crossed;
`booking-management/**` stays untouched and deferred.

### Mockup structure deliberately NOT adopted (consistent with Stage 3)
- **Sticky nav bar** (Back + toggle) → the app uses the established floating
  `absolute top-4 right-4` toggle cluster + `<BackButton />` (rejected-nav pattern from
  Stage 1). Not reintroduced.
- **Avatar circle + tab bar header** → live keeps its "Hello, {name}!" greeting card
  with Edit Profile + Sign Out actions. Replacing that header/IA (relocating the Edit
  action, dropping the greeting) is a UX change, not a visual chrome change — out of
  scope. Header card is only token-cleaned, not restructured.

### Functional pieces audited — must stay byte-for-byte (NOT touched)
- **`profile/page.tsx` logic**: the `useQuery(['clientProfile'])` fetch + 401 redirect,
  `canModifyLocally` 24h gate, `handleCancelAppointment` (`DELETE
  /api/client/appointments/:id`), `handleEditSaved`, `handleRepeat`, `handleSignOut`
  (`signOut`), `formatDate`, `statusLabel`, `upcomingWithFlags` memo, `showPast` toggle,
  the `actionMessage`/`actionLoadingId` state, and all `t()` calls. Only classNames /
  the status wrapper tag change.
- **`statusColor()` is presentational-only** (returns className strings). Rewriting its
  return values to chip classes is a visual change; the switch keys / call sites stay.
- **`profile/edit/page.tsx` logic**: `updateProfileMutation` (`PATCH
  /api/client/profile`), `changePasswordMutation` (`POST /api/client/change-password`),
  the `newPassword !== confirmNewPassword` guard, both `useMutation` success/error
  handlers, `queryClient.invalidateQueries`, the `useEffect` seed. Untouched.
- **`LinkBookingsCard.tsx` logic**: `linkMutation` (`POST /api/client/link-bookings`),
  the name/phone validation, `invalidateQueries(['clientProfile'])`, the 5s auto-hide.
  Untouched.
- **`EditAppointmentModal.tsx`**: `procedures`/`day-slots` queries, `handleSave` (`PATCH
  /api/client/appointments/:id`), `hasProcedureChanged`/`hasTimeChanged`/`canSave`, the
  seed `useEffect`. **Zero changes** (already 100% semantic tokens).
- **Shared primitives**: `Card`, `Input`, `Label`, `Button`, `Select*`,
  `DatePickerDropdown`, `PhoneInput`, `BackButton`, `ThemeToggle`, `LanguageToggle` are
  used but **not edited** here.

---

## Hard constraints (carried from every prior stage)

- [x] **Never touch profile / self-service logic.** No edits to any appointment
      cancel/reschedule mutation, `LinkBookingsCard`'s account-linking, the profile
      `PATCH` / change-password submissions, session/401 guards, or the `canModify` 24h
      gate. Visual-only.
- [x] **GDPR stays separate.** Do NOT add a GDPR tab/section to `/profile`; do NOT touch
      `src/app/support/page.tsx` or `/api/consents/*`.
- [x] **`src/components/booking-management/**` — DO NOT EDIT / DO NOT IMPORT** (deferred
      module). Verify empty diff.
- [x] **`EditAppointmentModal.tsx` — no changes** (already semantic). Verify empty diff.
- [x] **Shared primitives locked** — `src/components/ui/card.tsx`, `input.tsx`,
      `button.tsx`, `label.tsx`, `select.tsx`, `PhoneInput.tsx`, `ThemeToggle.tsx`,
      `LanguageToggle.tsx`, `MasterSelector.tsx`. Verify empty diff.
- [x] **Semantic tokens only.** Use `text-foreground`, `text-muted-foreground`,
      `border-border`, `bg-muted`, and valid Tailwind status utilities
      (`green`/`yellow`/`red`) for chips/messages. Introduce **no** hardcoded hex and
      **none** of the dead tokens (`text-text`, `text-muted`, `dark:text-dark-text`,
      `dark:text-dark-muted`, `dark:border-dark-border`, `dark:bg-dark-card`,
      `dark:placeholder-dark-muted`, `dark:*-accent`).
- [x] **All files stay ≤ 500 lines** (largest is 354). Every edit is an in-place
      className/tag swap — add **zero** new lines.
- [x] **No new npm dependencies / no new imports.**

---

## Implementation Steps

> All snippets below are literal `className` (or tag) before → after. Change **only**
> the strings/tags named; leave every handler, `t()` call, query, prop and ref as-is.

- [x] **Step 1 — `src/app/profile/page.tsx`: status pill chips** (the M3 upgrade)
  - File: `src/app/profile/page.tsx`
  - Rewrite the five `statusColor` return values (lines 94-98) from text-color classes
    to chip (background + on-color) classes — reusing the shipped LinkBookingsCard tints:
    - L94 `CONFIRMED`: `"text-green-600 dark:text-green-400"` → `"bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300"`
    - L95 `PENDING`: `"text-yellow-600 dark:text-yellow-400"` → `"bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300"`
    - L96 `CANCELLED`: `"text-red-500 dark:text-red-400 line-through"` → `"bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"` (the chip conveys the state; `line-through` is dropped)
    - L97 `COMPLETED`: `"text-muted dark:text-dark-muted"` → `"bg-muted text-muted-foreground"`
    - L98 `default`: `"text-text dark:text-dark-text"` → `"bg-muted text-muted-foreground"`
  - Convert the two status render sites from a text `<div>` to a chip `<span>`
    (tag + class swap only, **no new lines**):
    - Upcoming, lines 232-234:
      - before: `` <div className={`text-xs font-medium ${statusColor(a.status)}`}> `` … `` </div> ``
      - after:  `` <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusColor(a.status)}`}> `` … `` </span> ``
    - Past, lines 314-316: identical before → after swap.
  - **Keep** `statusLabel()` and all switch keys exactly as-is.

- [x] **Step 2 — `src/app/profile/page.tsx`: dead-token hygiene + `<h1>` weight**
  - File: `src/app/profile/page.tsx`
  - L178 (page title): `"text-2xl font-bold text-text dark:text-dark-text text-center"` → `"text-2xl font-semibold text-foreground text-center"`
    (weight softened `bold`→`semibold` toward the mockup's ≤500 signature; documented
    softer alternative if the user wants it lighter: `text-2xl font-normal`.)
  - L195: `"text-lg font-medium text-text dark:text-dark-text"` → `"text-lg font-medium text-foreground"`
  - L198: `"text-sm text-muted dark:text-dark-muted mt-1 space-y-1"` → `"text-sm text-muted-foreground mt-1 space-y-1"`
  - L204: `"flex gap-2 pt-2 border-t border-border dark:border-dark-border"` → `"flex gap-2 pt-2 border-t border-border"` (drop dead override only)
  - L216: `"text-lg font-semibold text-text dark:text-dark-text"` → `"text-lg font-semibold text-foreground"`
  - L223: `"font-medium text-text dark:text-dark-text"` → `"font-medium text-foreground"`
  - L226: `"text-sm text-muted dark:text-dark-muted"` → `"text-sm text-muted-foreground"`
  - L229: `"text-sm text-muted dark:text-dark-muted"` → `"text-sm text-muted-foreground"`
  - L237: `"text-sm font-medium text-text dark:text-dark-text whitespace-nowrap ml-3"` → `"text-sm font-medium text-foreground whitespace-nowrap ml-3"`
  - L280: `"text-lg font-semibold text-text dark:text-dark-text group-hover:opacity-80 transition-opacity"` → `"text-lg font-semibold text-foreground group-hover:opacity-80 transition-opacity"`
  - L305: `"font-medium text-text dark:text-dark-text opacity-70"` → `"font-medium text-foreground opacity-70"`
  - L308: `"text-sm text-muted dark:text-dark-muted"` → `"text-sm text-muted-foreground"`
  - L311: `"text-sm text-muted dark:text-dark-muted"` → `"text-sm text-muted-foreground"`
  - L334: `"text-muted dark:text-dark-muted mb-4"` → `"text-muted-foreground mb-4"`
  - **Keep**: the `actionMessage` box greens/reds (L185-186), the Sign Out button reds
    (L208 `text-red-500 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20`), the
    Cancel button reds (L256), the already-correct `text-muted-foreground` at L265/L293,
    every `.btn`/`.btn-outline`/`.btn-primary`, the `Card` usages, the loading spinner
    (`text-primary`), and all logic/handlers.

- [x] **Step 3 — `src/app/profile/edit/page.tsx`: dead-token hygiene + `<h1>` weight**
  - File: `src/app/profile/edit/page.tsx`
  - L136 (page title): `"text-2xl font-bold text-text dark:text-dark-text text-center"` → `"text-2xl font-semibold text-foreground text-center"`
  - L142 (section h2): `"text-lg font-semibold text-text dark:text-dark-text mb-4"` → `"text-lg font-semibold text-foreground mb-4"`
  - L192 (section h2): `"text-lg font-semibold text-text dark:text-dark-text mb-4"` → `"text-lg font-semibold text-foreground mb-4"`
  - **Keep**: `Input`/`Label`/`Button` shadcn primitives and their `h-11 border-input
    bg-background` classes (already semantic), `PhoneInput`, the message greens/reds
    (L179, L235), and both mutations/handlers.

- [x] **Step 4 — `src/components/profile/LinkBookingsCard.tsx`: dead-token hygiene (1 site)**
  - File: `src/components/profile/LinkBookingsCard.tsx`
  - L69 (card h2): `"text-lg font-semibold text-text dark:text-dark-text mb-2 flex items-center gap-2"` → `"text-lg font-semibold text-foreground mb-2 flex items-center gap-2"`
  - **Keep**: the inline `<svg>` `text-primary` icon, the description `text-muted-foreground`
    (L76), the `Input`/`PhoneInput`/`Button`, the message box greens/reds (L108-110), and
    the entire `linkMutation` flow.

- [x] **Step 5 — `src/components/profile/EditAppointmentModal.tsx`: NO CHANGES**
  - Already 100% semantic (`text-foreground`, `text-muted-foreground`, `border-border`,
    `bg-card`, `hover:bg-muted`, `bg-primary/10 text-primary`, `text-red-500` error).
    Verify `git diff` for this file is **empty**. Do not touch.

- [x] **Step 6 — No test changes.** These are className/tag-only visual edits with no
      component test layer (`src/components/AGENTS.md`: UI verified manually + indirectly
      via `tests/app/api/**`). Do not add tests; the existing suite is the regression guard.

---

## Acceptance Criteria

- [x] Appointment status renders as M3 **pill chips** (rounded, tinted container bg +
      on-color text) in both the upcoming and past lists, in light and dark theme.
- [x] Page-title `<h1>`s render `font-semibold` (not `font-bold`), matching the mockup's
      lighter weight.
- [x] No file in scope contains `text-text`, `text-muted` (bare), `dark:text-dark-text`,
      `dark:text-dark-muted`, `dark:border-dark-border`, `dark:bg-dark-card`,
      `dark:placeholder-dark-muted`, or `dark:*-accent` after this stage. Valid status
      utilities (`green`/`yellow`/`red` for chips + message boxes + red action buttons)
      remain.
- [x] `EditAppointmentModal.tsx`, `booking-management/**`, `/support`, and all shared
      primitives (`Card`, `Input`, `Button`, `Label`, `Select`, `PhoneInput`,
      `ThemeToggle`, `LanguageToggle`) show empty `git diff`.
- [x] All 4 in-scope files still ≤ 500 lines (expected unchanged: 354 / 248 / 129 / 267).
- [x] No new hardcoded hex, no new dead tokens, no new dependencies/imports.
- [x] `npx tsc --noEmit` clean (no new errors vs baseline); `npm run lint` and
      `npm run test` show no new failures vs the `git stash` baseline on `master`.
- [ ] Manual browser sign-off (per stage protocol): light + dark theme — profile loads,
      header/greeting card, upcoming list with status chips + Edit/Cancel (edit modal
      opens + saves, cancel works), collapsible past list + Book-again, empty state,
      LinkBookingsCard submit, and `/profile/edit` (profile update + password change) all
      render correctly and every flow still works end-to-end.

---

## Explicitly out of scope this stage

- **The mockup's "Privacy & GDPR" tab** — GDPR self-service is a separate page
  (`src/app/support/page.tsx` + `/api/consents/*`); not surfaced in `/profile`.
- **The mockup's sticky nav / avatar circle / tab bar** — app keeps the floating toggle
  cluster + `<BackButton />` and the greeting-card header IA (Stage-1/3 precedent). No
  restructure.
- **`src/components/profile/EditAppointmentModal.tsx`** — already fully semantic; no
  changes.
- **`src/components/booking-management/**`** — self-contained deferred module; not
  imported by profile, not touched.
- **`src/components/ui/PhoneInput.tsx`** — shared primitive (register/profile/edit/link
  all use it); its dead `dark:*` tokens are a separate shared-primitive cleanup, flagged
  for a dedicated follow-up (same deferral as Stage 3).
- **Shared shadcn primitives** (`Card`, `Input`, `Button`, `Label`, `Select`) and
  `ThemeToggle`/`LanguageToggle`/`MasterSelector` — locked / already M3.
- **`.btn*` / `.rdp-*` definitions in `src/styles/globals.css`** — shared, app-wide
  stylesheet; not this pass.

---

## Verification (coder must run before marking done)

- [x] `git diff --stat -- src/components/profile/EditAppointmentModal.tsx src/components/ui/card.tsx src/components/ui/input.tsx src/components/ui/button.tsx src/components/ui/PhoneInput.tsx src/components/ThemeToggle.tsx src/components/LanguageToggle.tsx src/app/support/page.tsx` → all empty.
- [x] `git diff --stat -- src/components/booking-management/` → empty.
- [x] `grep -RnE 'text-text|text-muted[^-]|dark:text-dark-(text|muted)|dark:border-dark-border|dark:bg-dark-card|dark:placeholder-dark-muted|dark:(text|bg|checked:bg)-accent' src/app/profile/page.tsx src/app/profile/edit/page.tsx src/components/profile/LinkBookingsCard.tsx src/components/profile/EditAppointmentModal.tsx` → no matches.
- [x] `wc -l src/app/profile/page.tsx src/app/profile/edit/page.tsx src/components/profile/LinkBookingsCard.tsx` → 354 / 248 / 129 (unchanged; all ≤ 500).
- [x] `npx tsc --noEmit` → no new errors.
- [x] `npm run lint` → compare error/warning count against `git stash` baseline on `master`; no new issues from the edited files.
- [x] `npm run test` → compare failure count against `git stash` baseline; no regressions.
- [ ] Manual browser sign-off (user, per stage protocol) — see Acceptance Criteria.

---

## Revision 2 — "Past" section restructure (user feedback after browser sign-off)

**User feedback (screenshots attached, paraphrased):** the Past section doesn't read as a
collapsible list — each past appointment renders as its own full-width bordered `Card`,
identical in weight to the Upcoming cards, so expanding "Past" just dumps more big cards onto
the page rather than looking like a nested list under a clearly-collapsible header. Ask: wrap
the whole Past section in a single card (like the existing `LinkBookingsCard`'s one-card
treatment), keep the header+chevron toggle inside that card, and render each past appointment
as a compact row inside it — service name, date, and a "Book again" button. No need for a
separate bordered card per past item, no specialist line, no status chip on the compact rows
(the mockup-standard chip stays on Upcoming; past items are deliberately lighter-weight).

### Scope: `src/app/profile/page.tsx` only — the Past block (current lines 274-330)

- [x] Wrap the entire Past section in a single `<Card>` (same primitive used everywhere else
  in this file, e.g. `Card className="!px-4 !py-4"`), replacing the current bare `<div
  className="space-y-3">` wrapper.
- [x] Move the existing toggle `<button>` (header `<h2>{t("profile.past","Past")}</h2>` +
  chevron `<svg>`) inside that `<Card>`, unchanged in its own markup/logic — only its parent
  container changes from a bare `div` to the `Card`.
- [x] Replace the expanded content's per-item `<Card key={a.id} className="!px-4 !py-3">` (and
  everything inside it) with a compact row, and wrap the whole list in a `divide-y
  divide-border` container instead of `space-y-3` stacked cards:
  ```
  {showPast && (
    <div className="mt-3 divide-y divide-border animate-fade-in-up">
      {past.map((a) => (
        <div key={a.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
          <div className="min-w-0">
            <div className="font-medium text-foreground truncate">{a.service.name}</div>
            <div className="text-sm text-muted-foreground">{formatDate(a.date)}</div>
          </div>
          <button
            onClick={() => handleRepeat(a.master.id)}
            className="btn btn-outline text-xs !px-3 !py-1.5 whitespace-nowrap shrink-0"
          >
            {t("profile.repeat", "Book again")}
          </button>
        </div>
      ))}
    </div>
  )}
  ```
- [x] Dropped from the compact row (deliberately, per user ask for a minimal list): the
  `startTime`-`endTime` range, the `Specialist:` line, and the `statusColor`/`statusLabel`
  chip. `formatDate`, `handleRepeat`, `statusColor`, and `statusLabel` themselves are NOT
  removed from the file (still used by the Upcoming section) — only their use on this specific
  row is dropped.
- [x] Everything else in the file — `showPast` state, the toggle button's own className/chevron
  rotation logic, `handleRepeat`, the Upcoming section, the greeting card, `LinkBookingsCard`,
  `EditAppointmentModal` — untouched.
- [x] No new lines beyond what this restructure needs; this is a net-neutral-to-smaller change
  (removing 2 lines of markup per past item, adding a `divide-y` wrapper) — confirm
  `src/app/profile/page.tsx` stays ≤ 500 lines (was 354). **Actual: 342 lines.**

### Verification
- [x] `git diff -- src/app/profile/page.tsx` touches only the Past block (lines ~274-330
  region) — Upcoming section, greeting card, and everything below `LinkBookingsCard` unchanged.
- [x] `npx tsc --noEmit` clean.
- [x] `npm run lint` / `npm run test` — no new failures vs `git stash` baseline.
- [ ] Manual browser sign-off: Past header still toggles open/closed with working chevron
  rotation, past items render as a compact single-card list (not separate bordered cards),
  "Book again" still navigates to `/{masterId}`, light + dark theme both look correct.
