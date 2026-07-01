# Fix: Select component — invisible highlight + wrong selected-value display

**Date:** 2026-07-01
**Status:** In Progress
**Follow-up to:** `handoff/m3-shadcn-components_plan.md` (Part 2, APPROVED but shipped with 2 live bugs)

## Context

User manually tested the new `Select` component on `/support` and reported:
1. No visible highlight on hover/keyboard-navigate in the dropdown popup.
2. Selected item shows capitalized text in the popup ("Booking") but lowercase in the
   trigger field after selecting it ("booking").

Both were reproduced live with chrome-devtools against the running dev server and traced
to root cause by reading `@base-ui/react/select` source. These are real, confirmed bugs —
not perception issues. They affect **all 6 dropdowns** migrated in Part 2, not just
`/support` (the AppointmentModal Master/Service/Client selects would show raw DB ids
instead of names once a real selection is made — worse than what the user directly
observed).

### Root cause 1 — wrong selected-value text
`@base-ui/react/select`'s `Select.Value` does NOT read the rendered children of the
matching `Select.Item` (unlike Radix). It only resolves a label two ways:
- an `items`/`itemToStringLabel` prop passed to `Select.Root` (not used anywhere in this
  codebase), or
- a render-prop function passed as `Select.Value`'s `children`.

Since neither is wired up anywhere, `Select.Value` falls back to stringifying the raw
`value` prop verbatim. Confirmed live: selecting "Rezerwacja" (value `"booking"`) in
`/support` makes `[data-slot="select-value"]` render the literal text `booking`.

Source: `node_modules/@base-ui/react/utils/resolveValueLabel.js` (`resolveSelectedLabel`
→ `fallback()` → `stringifyAsLabel` → `serializeValue(item)` when no `items`/
`itemToStringLabel` match).

**Fix:** pass a render-prop function as `<SelectValue>{(value) => ...}</SelectValue>`
children at each of the 6 call sites, using data already in scope at that site to map
value → display label.

### Root cause 2 — invisible highlight
`src/components/ui/select.tsx`'s `SelectItem` uses `data-highlighted:bg-accent`. The
Tailwind `--accent` token maps to `--color-primary`, which is a pale background-tint
variable — NOT the same thing as `--color-accent` (the actual brand rose color used for
buttons/links). Confirmed live via `getComputedStyle`:

| Mode | `--accent` | `--popover` (popup bg) | Result |
|---|---|---|---|
| Light | `#FFF0F1` | `#FFF0F1` | **identical — 100% invisible** |
| Dark | `#261E1F` | `#211A1B` | near-identical — imperceptible |

This is a pre-existing token mapping from Part 1 (`--accent` was never meant to be a
visible "hover state" color), but Part 2's `select.tsx` is the first place it's used in a
way that's constantly visible and interacted with, so it must be fixed here.

**Fix:** use the same M3 state-layer pattern already established and reviewer-approved in
`button.tsx`'s `outline` variant (`hover:bg-primary/8 ... dark:hover:bg-primary/10`),
which maps `--primary` → `--color-accent` (the real brand color) — genuinely visible
against the popover background in both themes.

**Do NOT** change the shared `--accent`/`--accent-foreground` CSS variables in
`globals.css` — that would also affect `dropdown-menu.tsx`/`navigation-menu.tsx`, which
are explicitly out of scope for the M3 redesign (per the Part 2 plan). Fix only the
Tailwind classes inside `select.tsx`.

## Explicitly out of scope
- The duplicate-looking options in `/support`'s Subject dropdown ("Booking" appears
  twice, "Other" appears twice). This is a **pre-existing i18n content bug**, unrelated to
  Part 2: `value="cancellation"` and `value="payment"` were already reusing the
  `support.topics.booking`/`support.topics.other` translation keys before this redesign
  (confirmed via `git show HEAD~1`). Not touched — flag to user as a separate, optional
  follow-up (needs a product decision on what those two entries should actually say, not
  a redesign task).
- The missing selected-item checkmark (`SelectItemIndicator` unused) — already logged as
  a non-blocking cosmetic note in the Part 2 review. Not in scope here.

## Step 1: Fix invisible highlight in `src/components/ui/select.tsx`

In `SelectItem` (around line 81), change:
```
data-highlighted:bg-accent data-highlighted:text-accent-foreground
```
to:
```
data-highlighted:bg-primary/10 dark:data-highlighted:bg-primary/15
```
Keep everything else in that className string unchanged. (Dropping
`text-accent-foreground` is safe — `--accent-foreground` already resolves to the same
value as the default text color, so there is no visible change to remove it; do not
invent a replacement.)

- [x] Done

## Step 2: Fix selected-value display — 6 call sites

For each site, replace the self-closing `<SelectValue />` (or `<SelectValue
placeholder="..." />`) with `<SelectValue>{(value) => ...}</SelectValue>`, where the
function returns the exact same text currently shown in that item's
`<SelectItemText>`. The `placeholder` prop becomes irrelevant once children is a
function — fold the "nothing selected" case into the function itself instead.

### 2a. `src/app/support/page.tsx` (~line 240-257)
Add a plain object above the `<Select>` (inside the component, after `t` is available):
```tsx
const subjectLabels: Record<string, string> = {
  '': t('form.selectTopic'),
  booking: t('support.topics.booking'),
  cancellation: t('support.topics.booking'),
  payment: t('support.topics.other'),
  technical: t('support.topics.technical'),
  privacy: t('support.topics.privacy'),
  other: t('support.topics.other'),
}
```
Change:
```tsx
<SelectTrigger className="h-auto w-full rounded-xl px-4 py-3">
  <SelectValue />
</SelectTrigger>
```
to:
```tsx
<SelectTrigger className="h-auto w-full rounded-xl px-4 py-3">
  <SelectValue>{(v: string) => subjectLabels[v] ?? v}</SelectValue>
</SelectTrigger>
```
- [x] Done

### 2b. `src/app/admin/master/calendar/ModernCalendar.tsx` (~line 199-208, time-step select)
`step` is a `number` state (`useState(15)`), always defined — no empty case needed.
Change:
```tsx
<SelectTrigger className="h-auto w-auto bg-transparent hover:bg-muted px-3 py-1.5 text-sm font-medium shadow-sm">
  <SelectValue />
</SelectTrigger>
```
to:
```tsx
<SelectTrigger className="h-auto w-auto bg-transparent hover:bg-muted px-3 py-1.5 text-sm font-medium shadow-sm">
  <SelectValue>{(v: string) => `${v} min`}</SelectValue>
</SelectTrigger>
```
- [x] Done

### 2c. `src/app/admin/master/calendar/AppointmentModal.tsx` — Master select (~line 195-207)
`masters: {id: string, name: string}[]` is already in scope.
Change:
```tsx
<SelectTrigger className="h-10">
  <SelectValue placeholder="-- Choose Master --" />
</SelectTrigger>
```
to:
```tsx
<SelectTrigger className="h-10">
  <SelectValue>
    {(v: string) => v ? (masters.find(m => m.id === v)?.name ?? v) : "-- Choose Master --"}
  </SelectValue>
</SelectTrigger>
```
- [x] Done

### 2d. `src/app/admin/master/calendar/AppointmentModal.tsx` — Service select (~line 221-224)
`services: Service[]` (`{id, name, duration}`) already in scope. `"custom"` is the
explicit non-DB sentinel value.
Change:
```tsx
<SelectTrigger className="h-10">
  <SelectValue />
</SelectTrigger>
```
(the one inside the Service column, right after `<Select value={serviceId}
onValueChange={...}>`) to:
```tsx
<SelectTrigger className="h-10">
  <SelectValue>
    {(v: string) => {
      if (v === "custom") return "-- Custom Service --"
      const s = services.find(sv => sv.id === v)
      return s ? `${s.name} (${s.duration}m)` : v
    }}
  </SelectValue>
</SelectTrigger>
```
- [x] Done

### 2e. `src/app/admin/master/calendar/AppointmentModal.tsx` — Client select (~line 254-257)
`clients: Client[]` (`{id, name: string|null, phone: string|null}`) already in scope.
Change the `<SelectTrigger>` inside `<Select value={clientId} onValueChange={...}>` from:
```tsx
<SelectTrigger className="h-10">
  <SelectValue />
</SelectTrigger>
```
to:
```tsx
<SelectTrigger className="h-10">
  <SelectValue>
    {(v: string) => {
      if (v === "custom") return "-- New Client / Guest --"
      const c = clients.find(cl => cl.id === v)
      return c ? `${c.name ?? ''}${c.phone ? ` (${c.phone})` : ''}` : v
    }}
  </SelectValue>
</SelectTrigger>
```
- [x] Done

### 2f. `src/components/profile/EditAppointmentModal.tsx` — Procedure select (~line 174-176)
`proceduresData?.items` (array of objects with `.id` and `.name_pl`) already in scope
(used a few lines below in the `.map()`).
Change:
```tsx
<SelectTrigger>
  <SelectValue />
</SelectTrigger>
```
to:
```tsx
<SelectTrigger>
  <SelectValue>
    {(v: string) => proceduresData?.items?.find((p: any) => p.id === v)?.name_pl ?? v}
  </SelectValue>
</SelectTrigger>
```
Match the existing type used for `procedure` in the `.map()` just below (check whether
it's typed or `any` and stay consistent — do not introduce a new interface for this).
- [x] Done

## Step 3: Verify
- [x] `npm run build` — must succeed, same page count as before (73 pages)
- [x] `npm run lint` — must match existing baseline (61 problems, 0 new)
- [?] Manually re-check (or describe how to check) that selecting an option in each of the
      6 dropdowns now shows the correct label text in the closed trigger, not a raw id/value
- [?] Manually re-check that hovering/arrow-keying over dropdown options now shows a
      visible highlight in both light and dark theme

## Acceptance Criteria
- [x] `select.tsx` `SelectItem` highlight uses `bg-primary/10` / `dark:bg-primary/15`, not `bg-accent`
- [x] All 6 `<SelectValue />` call sites now use a render-prop function, none show raw ids/values after selection
- [x] No other files touched
- [x] Build + lint verified by orchestrator with a clean `.next` cache (per the casing-bug lesson from Part 2 — do not trust a warm-cache build)

## Files to change
- `src/components/ui/select.tsx`
- `src/app/support/page.tsx`
- `src/app/admin/master/calendar/ModernCalendar.tsx`
- `src/app/admin/master/calendar/AppointmentModal.tsx`
- `src/components/profile/EditAppointmentModal.tsx`
