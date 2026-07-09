# Plan: Booking flow (`/[masterId]`) M3 Pass — Stage 3

**Date:** 2026-07-09
**Status:** Implemented — automated verification complete; pending manual browser sign-off

## Goal

Bring the client-facing booking flow at `/[masterId]` (master header, calendar, slot
picker, booking form, consent modal, success panels, guest-conversion banner) into the
Somique Beauty / M3 visual language — **visual chrome only, zero change to any booking
logic** — matching the 2-column `BookingPage` mockup the user already chose.

---

## Context (what I found)

### Source of truth (design reference)
- Mockup: `Somique Beauty Design System/ui_kits/client/pages.jsx` → `BookingPage`
  (lines 122-344) + shared tokens/components in
  `Somique Beauty Design System/ui_kits/client/shared.jsx`.
- The **rejected** step-wizard set (`MasterSelector.jsx`, `BookingFlow.jsx`,
  `BookingForm.jsx`, `BookingSuccess.jsx`) is NOT referenced — per prior decision.
- Mockup card signature: `borderRadius:16`, `border:1px solid t.border`,
  `background:t.card`, `boxShadow:t.shadow` (soft `0 1px 3px`), section labels
  `fontSize:14 fontWeight:500 color:t.text`, page title "Book a visit"
  `fontSize:28 fontWeight:400`, master photo `border:3px solid t.priCont`.
- The live app already renders every card through the shared shadcn `Card`
  (`src/components/ui/card.tsx` = `rounded-[--radius] bg-card text-card-foreground
  shadow-sm ring-1 ring-foreground/5`) — already M3, already used by the (shipped)
  admin restyle. **`Card` is NOT edited** (shared primitive, out of scope).

### The live flow is architecturally correct but carries dead/legacy tokens
The page structure already matches the mockup's chosen 2-column layout:
`src/app/[masterId]/page.tsx` uses `lg:grid lg:grid-cols-[auto,auto]` with the
calendar on the left (`lg:order-1`) and service/form on the right (`lg:order-2`),
plus the same floating `absolute top-4 right-4` toggle cluster used on the Stage-1
landing. **`page.tsx` needs no changes** — only its child components do.

The real work is a **token-hygiene pass**: the booking sub-components predate the M3
semantic layer and are littered with the exact dead legacy tokens Stage 1 identified,
plus a few hardcoded `neutral-*` / `bg-neutral-800 text-white` treatments that clash
with M3. Confirmed dead/legacy carriers:
- `text-text` / `dark:text-dark-text`, `dark:text-dark-muted`,
  `dark:border-dark-border`, `dark:bg-dark-card`, `dark:placeholder-dark-muted`
  — these map to the hand-rolled `@layer utilities` block in
  `src/styles/globals.css` (lines 478-487) that reference bare tenant vars
  (`--color-text`, `--color-dark-*`) with **no `--md-*` fallback**, so they render as
  nothing when the tenant hasn't set that field. The M3-correct replacements are the
  semantic tokens (`text-foreground`, `text-muted-foreground`, `border-border`,
  `bg-card`) which carry the full `--color-* → --md-*` fallback chain.
- `dark:text-accent` / `dark:bg-accent` / `dark:checked:bg-accent` layered as
  dark-mode overrides on top of `text-primary` / `bg-primary`. Since `--primary`
  already flips per-theme, these overrides are redundant/inconsistent — dropped.
- One genuine **correctness bug** (not just cosmetic): the consent modal's confirm
  button is `bg-primary … text-white … dark:bg-accent`. In dark mode `--primary`
  becomes light pink (`#FFB2B8`) and its correct on-color is dark (`--primary-foreground`
  = `#3B0017`); `text-white` is wrong there. Fix = `text-primary-foreground`.

### Which off-palette utilities are OK to keep (precedent from Stage 2)
Per the auth-m3 plan's established ruling, plain Tailwind status utilities
(`text-red-500`, `text-red-600 dark:text-red-400`, `text-green-600`,
`text-emerald-700 dark:text-emerald-400`, the `bg-red-50 … border-red-200 …`
error box) are **valid utilities, not the banned dead tokens** — they stay. There is
no Tailwind `success` color mapped in `tailwind.config.ts` (only `destructive`,
`muted`, `accent`, `primary`, …), so the "thank you" green legitimately stays
`text-emerald-*`. Only the dead `dark-*` / bare-`text`/`muted` legacy tokens and
hardcoded `neutral-*`/`bg-neutral-800` chrome are swapped.

### The shared `.btn` / `.btn-primary` / `.btn-outline` convention stays
Defined in `globals.css` (lines 104-127), used by **20 files** across booking,
profile, GDPR and support. Slot buttons (`SlotsList`), the booking submit button,
and the guest-banner CTAs all use it. Redefining the app-wide button system is out of
scope for a per-page visual pass — these `.btn` usages are **kept as-is**. The one
place we *introduce* `.btn` is swapping the jarring `bg-neutral-800 text-white`
success close buttons for `btn btn-outline w-full`, which both fixes the off-palette
color and matches the mockup's outlined "Back to home" pill.

### BookingForm.tsx and the 500-line limit — SAFE
`BookingForm.tsx` is **496 lines** (project hard limit 500). Every change in this plan
is an **in-place edit of an existing `className` string** — no JSX added, no lines
inserted. The file stays at 496. This is called out explicitly per step so the coder
does not restructure or grow it. (If any future request needs *added* markup here, it
must be an extraction, not inline growth — but this stage adds nothing.)

### Functional pieces audited — must stay byte-for-byte (NOT touched)
- **`src/app/[masterId]/page.tsx`** — all booking state (procId/date/selectedSlot),
  autoscroll effects, master validation `fetch('/api/masters')`, React Query
  invalidations, the `motion.div` entrance animation, the 2-col grid. Already
  M3-structured; **no changes**.
- **`src/app/[masterId]/layout.tsx`** — the `const config = await getTenantConfig()`
  is pre-existing (currently unused) dead code; per "don't remove pre-existing dead
  code", leave it. **No changes.**
- **`BrandHeader.tsx` cross-route animation** — the `motion.div` `layoutId=
  master-photo-${masterPhotoId}` and its `{ type:"spring", stiffness:200, damping:25,
  duration:1.2 }` transition are coupled to `MasterSelector.tsx`'s flying-photo
  animation. **Do NOT touch the `motion.div`, its `layoutId`, `transition`, `onClick`,
  or the `ring-2 ring-accent/70` wrapper.** Only the plain `<h1>` className changes.
- **Turnstile IS present here** (unlike the auth pages): `BookingForm.tsx`
  `siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY`, the script-injection
  `useEffect` (106-139), the `bookingState`-driven show/hide effect (141-147), and the
  `tsRef` render div (463-467). **Preserve all of it**; the `tsRef` div's
  `className="rounded-xl"` stays.
- **Booking submission / availability** — `useBookingSubmit` hook, `ProcedureSelect`
  query, `DayCalendar`'s `/api/availability` query + windowing math, `SlotsList`'s
  `/api/day/[date]` query, `BookingForm`'s `/api/client/profile` PATCH, the
  `checkConsentAndProceed` / `bookWithConsents` flow. **Logic untouched.**
- **GDPR consent** — `BookingConsentModal.tsx` is a controlled presentational
  component: all consent state lives in `BookingForm` (`dataProcessingConsent`,
  `termsConsent`, `notificationsConsent` + `on*Change`), the `canConfirm =
  dataProcessingConsent && termsConsent && !loading` gate, the `t('consent.*')` copy,
  the required-vs-optional split, and the `<Link href="/terms">` / `/privacy` links
  are all preserved. Only classNames change.
- **`src/lib/availability.ts`** — pure backend logic, not a UI file; confirmed no UI
  file in scope inlines/duplicates it. Not touched.

### Explicitly deferred (dead tokens, but out of this stage's scope — see bottom)
- `src/components/ui/PhoneInput.tsx` — shared primitive (also used by register/profile
  forms) carrying dead `dark:*` tokens; a shared-primitive cleanup, not booking-page
  specific.
- `src/components/booking-management/**` — self-contained module with its own
  AGENTS.md, its own Turnstile gating, and two files already near 500 lines.
- The `.rdp-*` react-day-picker overrides in `globals.css` (hardcoded `#737373`,
  `#f5f5f5`, `#6B4423`) — shared, functional stylesheet.

---

## Hard constraints (carried from project-wide rules)

- [x] **Never touch booking logic.** No edits to availability fetching, slot-selection
      state, `POST /api/book` submission (`useBookingSubmit`), Google Calendar/Sheet
      sync, Turnstile verification, or GDPR consent logic. Visual-only.
- [x] **`BrandHeader.tsx` `motion.div` is frozen** — `layoutId`, the spring
      `transition`, `onClick`, and the `ring-2 ring-accent/70` wrapper stay
      byte-identical (cross-route coupling with `MasterSelector.tsx`). Only the `<h1>`
      className changes.
- [x] **`MasterSelector.tsx` — DO NOT EDIT** (locked; matching side of the coupling).
      Verify `git diff --stat -- src/components/MasterSelector.tsx` → empty.
- [x] **`ThemeToggle.tsx` — DO NOT EDIT** (hard-locked). Verify empty diff.
- [x] **`LanguageToggle.tsx` — DO NOT EDIT** (already done in Stage 1). Verify empty diff.
- [x] **`src/components/ui/card.tsx` — DO NOT EDIT** (shared primitive, already M3,
      used by shipped admin restyle). Verify empty diff.
- [x] **Semantic tokens only.** Use only `text-foreground`, `text-muted-foreground`,
      `bg-card`, `border-border`, `text-primary`/`bg-primary`/`text-primary-foreground`,
      `hover:bg-muted`, `hover:border-muted-foreground`, `bg-accent`/`ring-accent`
      (accent is a real config token, keep where already used). Introduce **no**
      hardcoded hex and **none** of the dead legacy tokens (`text-text`, `dark-text`,
      `dark-muted`, `dark-border`, `dark-card`, `placeholder-dark-muted`).
- [x] **`BookingForm.tsx` stays ≤ 500 lines** (it is 496). All edits are in-place
      className swaps — add **zero** new lines.
- [x] **No new npm dependencies / no new imports.** className edits on existing markup only.

---

## Implementation Steps

> All snippets below are literal `className` before → after. Change **only** the
> strings named; leave every other attribute, handler, `t()` call, `motion` prop, query
> and ref exactly as-is.

- [x] **Step 1 — `src/components/BrandHeader.tsx`** (light-weight M3 page title)
  - File: `src/components/BrandHeader.tsx`
  - Line 70-72, the `<h1>` (NOT the `motion.div` above it):
    - before: `` className={`text-4xl font-semibold tracking-tight${logoClickable ? ' cursor-pointer' : ''}`} ``
    - after:  `` className={`text-3xl font-normal tracking-tight${logoClickable ? ' cursor-pointer' : ''}`} ``
    - (`text-3xl` ≈ 30px matches mockup `fontSize:28`; `font-normal` = 400 matches
      mockup `fontWeight:400` and the Stage-2 light-heading signature. `tracking-tight`
      and the `cursor-pointer` toggle stay.)
  - **Do NOT touch** the `motion.div` (lines 25-45): `layoutId`, `transition`,
    `onClick`, `ring-2 ring-accent/70`, the `<Image>`; nor the mobile logo block.
  - Documented fallback (avoid re-litigating): if the user wants the title kept large,
    `text-4xl font-normal` (weight change only) is the pre-approved softer variant.

- [x] **Step 2 — `src/components/DayCalendar.tsx`** (nav buttons, month label, weekday
      headers, loading — semantic tokens)
  - File: `src/components/DayCalendar.tsx`
  - Line 163 `buttonBase`:
    - before: `"flex h-8 w-8 items-center justify-center rounded-full border border-neutral-300 dark:border-dark-muted text-sm font-medium text-neutral-700 dark:text-dark-text transition-all duration-200 hover:bg-neutral-100 dark:hover:bg-dark-muted hover:border-neutral-400 dark:hover:border-dark-text hover:scale-110 hover:shadow-lg disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:scale-100 disabled:hover:shadow-none"`
    - after:  `"flex h-8 w-8 items-center justify-center rounded-full border border-border text-sm font-medium text-foreground transition-all duration-200 hover:bg-muted hover:border-muted-foreground hover:scale-110 hover:shadow-lg disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:scale-100 disabled:hover:shadow-none"`
  - Line 185 month label:
    - before: `"inline-block text-base font-medium text-neutral-800 dark:text-dark-text"`
    - after:  `"inline-block text-base font-medium text-foreground"`
  - Line 231 `head_cell` (inside `classNames`):
    - before: `'w-10 text-center font-normal text-xs text-neutral-400 dark:text-dark-muted overflow-hidden'`
    - after:  `'w-10 text-center font-normal text-xs text-muted-foreground overflow-hidden'`
  - Line 246 loading spinner:
    - before: `"h-10 w-10 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-500 dark:border-dark-muted dark:border-t-dark-text"`
    - after:  `"h-10 w-10 animate-spin rounded-full border-2 border-muted border-t-primary"`
  - Line 247 loading text:
    - before: `"mt-3 text-sm font-medium text-neutral-600 dark:text-dark-text"`
    - after:  `"mt-3 text-sm font-medium text-muted-foreground"`
  - **Keep** the `modifiersClassNames`/`classNames` `bg-accent/40 … hover:bg-accent/60
    … focus-visible:ring-accent/60` (accent is a real semantic token). **Keep** all
    query/windowing logic. Do **not** touch the `.rdp-*` overrides in `globals.css`.

- [x] **Step 3 — `src/components/SlotsList.tsx`** (helper text + panel + loading — semantic)
  - File: `src/components/SlotsList.tsx`
  - Line 42: `"text-sm text-neutral-500 dark:text-dark-muted"` → `"text-sm text-muted-foreground"`
  - Line 43: `"text-sm text-neutral-500 dark:text-dark-muted"` → `"text-sm text-muted-foreground"`
  - Line 45 panel wrapper — drop only the trailing dead token:
    - before: `` `relative rounded-2xl border border-border bg-card text-card-foreground p-4 dark:border-dark-border ${ready ? 'max-h-[24rem]' : ''}` ``
    - after:  `` `relative rounded-2xl border border-border bg-card text-card-foreground p-4 ${ready ? 'max-h-[24rem]' : ''}` ``
  - Line 50 spinner: `"h-9 w-9 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-500"` → `"h-9 w-9 animate-spin rounded-full border-2 border-muted border-t-primary"`
  - Line 51: `"mt-3 text-sm font-medium text-neutral-600 dark:text-dark-text"` → `"mt-3 text-sm font-medium text-muted-foreground"`
  - Line 56: `"text-sm text-neutral-500 dark:text-dark-muted"` → `"text-sm text-muted-foreground"`
  - **Keep** line 54 `text-red-600 dark:text-red-400` (valid error utility) and the
    slot buttons' `'btn btn-primary'`/`'btn btn-outline'` (shared convention).

- [x] **Step 4 — `src/components/BookingForm.tsx`** (in-place token swaps only; file
      stays at 496 lines — add NO new lines)
  - File: `src/components/BookingForm.tsx`
  - Line 312: `"text-neutral-700 dark:text-dark-muted"` → `"text-muted-foreground"`
  - Line 313: `"font-medium text-text dark:text-dark-text mb-0.5"` → `"font-medium text-foreground mb-0.5"`
  - Line 347 (auth edit-name input) — drop the two dead trailing tokens:
    - before: `"w-full rounded-xl border border-border bg-transparent px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary dark:border-dark-border dark:placeholder-dark-muted"`
    - after:  `"w-full rounded-xl border border-border bg-transparent px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"`
  - Line 360 (auth edit-email input): same drop of `dark:border-dark-border dark:placeholder-dark-muted`.
  - Line 413 (guest name input): drop `dark:border-dark-border dark:placeholder-dark-muted`
    only — keep the `${nameError ? 'border-red-500' : 'border-border'}` conditional.
  - Line 449 (guest email input): drop `dark:border-dark-border dark:placeholder-dark-muted`
    only — keep the `${emailError ? 'border-red-500' : 'border-border'}` conditional.
  - **Keep** everything else: `bg-primary/5 dark:bg-primary/10 border-primary/20`
    (318), `text-green-600`/`text-red-500`/`text-red-600 dark:text-red-400` status
    strings, the `btn btn-primary`/`btn btn-outline` buttons, PhoneInput usage, and
    **all** Turnstile code. **Add no lines** — only edit the strings above.

- [x] **Step 5 — `src/components/BookingConsentModal.tsx`** (chrome + `text-white`
      dark-mode correctness fix; preserve all consent logic/copy/links)
  - File: `src/components/BookingConsentModal.tsx`
  - Line 39: `"text-lg font-medium mb-4 dark:text-dark-text"` → `"text-lg font-medium mb-4 text-foreground"`
  - Line 43: `"text-sm text-neutral-600 dark:text-dark-muted"` → `"text-sm text-muted-foreground"`
  - Line 44: `` <strong className="text-text dark:text-dark-text"> `` → `` <strong className="text-foreground"> ``
  - Lines 58, 75, 92 (the three checkboxes, identical string):
    - before: `"mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-2 focus:ring-primary dark:border-dark-border dark:bg-dark-card dark:checked:bg-accent"`
    - after:  `"mt-1 h-4 w-4 rounded border-border text-primary focus:ring-2 focus:ring-primary"`
  - Lines 60, 77, 94 (label spans): `"text-sm text-neutral-700 dark:text-dark-muted flex-1"` → `"text-sm text-muted-foreground flex-1"`
  - Lines 62, 79 (terms/privacy links): `"text-primary hover:underline dark:text-accent"` → `"text-primary hover:underline"` (keep the `<Link href="/terms">` / `/privacy` and their `t()` labels)
  - Line 120 confirm button (correctness fix — `text-white` is wrong in dark):
    - before: `"flex-1 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-white transition-all hover:bg-primary/90 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed dark:bg-accent dark:hover:bg-accent/90 flex items-center justify-center gap-2"`
    - after:  `"flex-1 rounded-lg bg-primary px-4 py-3 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"`
  - **Keep**: line 65/82 `text-red-500` asterisks, the error box (101-102) reds, the
    Back button (112, already `border-border bg-card text-card-foreground hover:bg-muted`),
    the `canConfirm` gate, all `on*Change` handlers, and the spinner markup.

- [x] **Step 6 — `src/components/BookingSuccess.tsx`** (chrome + close button)
  - File: `src/components/BookingSuccess.tsx`
  - Line 40: `"text-lg font-medium mb-3 dark:text-dark-text"` → `"text-lg font-medium mb-3 text-foreground"`
  - Lines 43, 46, 50 (service/date/price rows, identical): `"text-sm text-neutral-600 dark:text-dark-muted"` → `"text-sm text-muted-foreground"`
  - Line 58 (address block wrapper): `"text-sm text-neutral-600 dark:text-dark-muted"` → `"text-sm text-muted-foreground"`
  - Line 59: `` <strong className="text-text dark:text-dark-text"> `` → `` <strong className="text-foreground"> ``
  - Line 74 (guest-banner title): `"text-sm font-semibold text-foreground dark:text-dark-text mb-0.5"` → `"text-sm font-semibold text-foreground mb-0.5"`
  - Line 77 (guest-banner desc): `"text-xs text-neutral-500 dark:text-dark-muted mb-3 leading-relaxed"` → `"text-xs text-muted-foreground mb-3 leading-relaxed"`
  - Line 99-104 close button (swap off-palette neutral-800 for outlined M3 pill):
    - before: `"w-full rounded-lg bg-neutral-800 px-4 py-3 text-sm font-medium text-white transition-all duration-200 hover:bg-neutral-900 hover:shadow-md dark:bg-neutral-700 dark:hover:bg-neutral-600"`
    - after:  `"btn btn-outline w-full"`
  - **Keep**: line 67 `text-emerald-700 dark:text-emerald-400` "thank you"; line 57
    `border-border/70 bg-card/60` address card; line 70 `border-primary/25 bg-primary/5
    dark:bg-primary/10` guest block; the `btn btn-primary`/`btn btn-outline` CTA links;
    the tenant-config query.

- [x] **Step 7 — `src/components/BookingSuccessPanel.tsx`** (same treatment as Step 6,
      no guest banner in this variant)
  - File: `src/components/BookingSuccessPanel.tsx`
  - Line 62: `"text-lg font-medium mb-3 dark:text-dark-text"` → `"text-lg font-medium mb-3 text-foreground"`
  - Lines 65, 68, 72 (service/date/price rows): `"text-sm text-neutral-600 dark:text-dark-muted"` → `"text-sm text-muted-foreground"`
  - Line 80 (address block wrapper): `"text-sm text-neutral-600 dark:text-dark-muted"` → `"text-sm text-muted-foreground"`
  - Line 81: `` <strong className="text-text dark:text-dark-text"> `` → `` <strong className="text-foreground"> ``
  - Line 91-97 close button:
    - before: `"w-full rounded-lg bg-neutral-800 px-4 py-3 text-sm font-medium text-white transition-all duration-200 hover:bg-neutral-900 hover:shadow-md dark:bg-neutral-700 dark:hover:bg-neutral-600"`
    - after:  `"btn btn-outline w-full"`
  - **Keep**: line 89 `text-emerald-700 dark:text-emerald-400`; line 79
    `border-border/70 bg-card/60`; both React Query calls.

- [x] **Step 8 — `src/components/GuestConversionBanner.tsx`** (drop redundant `dark:*`)
  - File: `src/components/GuestConversionBanner.tsx`
  - Line 30: `"rounded-2xl border border-primary/25 bg-card dark:bg-dark-card p-5 shadow-sm"` → `"rounded-2xl border border-primary/25 bg-card p-5 shadow-sm"`
  - Line 40: `"text-sm font-semibold text-foreground dark:text-dark-text leading-snug"` → `"text-sm font-semibold text-foreground leading-snug"`
  - Line 43: `"text-xs text-neutral-500 dark:text-dark-muted mt-0.5 leading-relaxed"` → `"text-xs text-muted-foreground mt-0.5 leading-relaxed"`
  - **Keep** the `AnimatePresence`/`motion` entrance animation, the `shouldRender`
    guest gate, and the `btn btn-primary`/`btn btn-outline` CTA links.

- [x] **Step 9 — No test changes.** These are className-only visual edits with no
      component test layer (`src/components/AGENTS.md`: UI verified manually + indirectly
      via `tests/app/api/**`). Do not add tests; the existing suite is the regression guard.

---

## Acceptance Criteria

- [x] The "Book a visit" page title renders light-weight (`font-normal`) at
      `text-3xl`, matching the mockup and the Stage-2 auth heading treatment.
- [x] No file in scope contains `text-text`, `dark:text-dark-text`, `dark:text-dark-muted`,
      `dark:border-dark-border`, `dark:bg-dark-card`, `dark:placeholder-dark-muted`,
      `dark:text-accent`, `dark:bg-accent`, `dark:checked:bg-accent`,
      `bg-neutral-800`/`bg-neutral-700`, or `border-neutral-*`/`text-neutral-*` after
      this stage (replaced by semantic tokens). Valid status utilities
      (`text-red-*`, `text-green-600`, `text-emerald-*`, the red error box) may remain.
- [x] Success-panel close buttons render as outlined M3 pills (`btn btn-outline`), not
      the dark-gray `neutral-800` block.
- [x] Consent confirm button uses `text-primary-foreground` (correct in dark mode) and
      no longer forces `dark:bg-accent`.
- [x] `BookingForm.tsx` is still ≤ 500 lines (expected: exactly 496, unchanged count).
- [x] `BrandHeader.tsx` `motion.div` (`layoutId`, spring `transition`, `ring-2
      ring-accent/70`) is byte-identical — the homepage → booking flying-photo
      animation still runs.
- [x] `MasterSelector.tsx`, `ThemeToggle.tsx`, `LanguageToggle.tsx`, `ui/card.tsx`,
      `page.tsx`, `layout.tsx` all show empty `git diff`.
- [x] No new hardcoded hex, no new dead tokens, no new dependencies/imports.
- [x] `npx tsc --noEmit` clean (no new errors vs baseline); `npm run lint` and
      `npm run test` show no new failures vs the `git stash` baseline on `master`.
- [ ] Manual browser sign-off (per stage protocol): light + dark theme — service
      select, calendar day pick, slot pick, guest + authed booking form, GDPR consent
      modal, Turnstile widget (if configured), success panel, and guest-conversion
      banner all render correctly and every flow still works end-to-end.

---

## Explicitly out of scope this stage

- **`src/app/[masterId]/page.tsx`** — already M3-structured (correct 2-col layout +
  toggle cluster); no dead tokens. Untouched.
- **`src/app/[masterId]/layout.tsx`** — pre-existing unused `config` left as-is.
- **`src/components/ui/card.tsx`** — shared, already-M3 primitive used by shipped admin.
- **`src/components/ProcedureSelect.tsx`**, **`BackButton.tsx`**, **`LogoDisplay.tsx`**
  — already use semantic tokens (`border-border`, `bg-card`, `text-card-foreground`,
  `focus:ring-accent`, `text-muted-foreground`); no dead tokens, no changes.
- **`src/components/ui/PhoneInput.tsx`** — shared primitive (register/profile also use
  it); its dead `dark:*` tokens are a separate shared-primitive cleanup, not a
  booking-page change. Flagged for a dedicated follow-up.
- **`src/components/booking-management/**`** — self-contained module (own AGENTS.md,
  own Turnstile gating, `BookingManagement.tsx`/`PanelRenderer.tsx` near 500 lines).
  A separate stage; the mockup's "Manage booking" panel is deferred with it.
- **`.rdp-*` overrides in `src/styles/globals.css`** and the `.btn*` definitions —
  shared, functional stylesheet; app-wide, not this pass.
- **`MasterSelector.tsx`, `ThemeToggle.tsx`, `LanguageToggle.tsx`** — locked / already
  handled in Stage 1.
- **Adopting the mockup's sticky top nav bar** — the app deliberately uses the floating
  toggle cluster instead (rejected pattern from Stage 1); not reintroduced.

---

## Verification (coder must run before marking done)

- [x] `git diff --stat -- src/components/MasterSelector.tsx src/components/ThemeToggle.tsx src/components/LanguageToggle.tsx src/components/ui/card.tsx src/app/[masterId]/page.tsx src/app/[masterId]/layout.tsx` → all empty.
- [x] `git diff -- src/components/BrandHeader.tsx` → shows ONLY the `<h1>` class change; the `motion.div` block is untouched.
- [x] `wc -l src/components/BookingForm.tsx` → still `496` (≤ 500).
- [x] `grep -RnE 'dark:text-dark-(text|muted)|dark:border-dark-border|dark:bg-dark-card|dark:placeholder-dark-muted|text-text|dark:(text|bg|checked:bg)-accent|bg-neutral-800|bg-neutral-700|border-neutral-|text-neutral-' src/components/BrandHeader.tsx src/components/DayCalendar.tsx src/components/SlotsList.tsx src/components/BookingForm.tsx src/components/BookingConsentModal.tsx src/components/BookingSuccess.tsx src/components/BookingSuccessPanel.tsx src/components/GuestConversionBanner.tsx` → no matches.
- [x] `npx tsc --noEmit` → no new errors.
- [x] `npm run lint` → compare error/warning count against `git stash` baseline on `master`; no new issues from the 8 edited files.
- [x] `npm run test` → compare failure count against `git stash` baseline; no regressions.
- [ ] Manual browser sign-off (user, per stage protocol) — see Acceptance Criteria.
