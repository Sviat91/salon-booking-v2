# Plan: M3 Design System — Part 2 (shadcn/ui components + reusable Select/Textarea/Badge)

**Date:** 2026-07-01
**Status:** Complete

## Post-review fix (orchestrator, not in original plan)

`npm run build` reported success by the coder agent, but independently re-running it with a clean
`.next` cache (`rm -rf .next && npm run build`) failed with a TypeScript "differs only in casing"
error between `card.tsx` and `Card.tsx`. Root cause: the physical file was git-tracked as `Card.tsx`
(capital C, pre-existing before this task) while all 11 import sites across the app use lowercase
`@/components/ui/card`. This worked before only because incremental/cached builds masked it — a cold
build always exposes it. Fixed via `git mv src/components/ui/Card.tsx src/components/ui/card.tsx`
(zero import sites needed changes, all already expected lowercase). Re-verified clean build (73 pages)
and lint (61 pre-existing problems, 0 new) after the rename.

## Scope (confirmed with user)

Restyle existing shadcn/ui primitives to M3, **and** create the missing `Select`/`Textarea`/`Badge`
components, **and** migrate every native `<select>`/`<textarea>`/inline-badge call site to use them.
User explicitly asked for full consistency ("делаем как положено, чтобы везде был единый стиль").

Confirmed available, no new dependency needed: `@base-ui/react` (^1.3.0) already ships a `select`
primitive (`@base-ui/react/select` → `Root/Trigger/Value/Icon/Portal/Positioner/Popup/Item/ItemText/
ItemIndicator/Group/GroupLabel/Label/Separator/ScrollUpArrow/ScrollDownArrow/Arrow/Backdrop`).
`class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react` are already installed and used by
`button.tsx`/`switch.tsx`/`dialog.tsx`. Do not add anything to `package.json`.

## Explicitly out of scope (do not touch)
- `.btn` / `.btn-primary` / `.btn-outline` in `globals.css` — still used by 18 files via raw
  `<button className="btn btn-primary">` (booking flow, profile, GDPR modals). Removing/renaming
  now breaks those pages. Migrating those files to `<Button>` is Part 4 (Client Booking Flow) work.
- `button.tsx` variant **keys** (`default/outline/secondary/ghost/destructive/link`) — 46 call sites
  use `variant="outline"` (21) / `"ghost"` (23) / `"secondary"` (2) / `"destructive"` (2) across the
  app. Restyle the look of each variant, do not rename the keys to `filled/tonal/outlined/text`.
- `dropdown-menu.tsx`, `navigation-menu.tsx`, `avatar.tsx` (including `AvatarBadge` — a corner
  indicator, unrelated to the new chip `Badge`), `theme-toggle.tsx`, `form.tsx`, `label.tsx`,
  `PhoneInput.tsx` — not in the original Part 2 list, defer to Part 3/4/5.
- `checkbox.tsx` stays hand-rolled (`<button role="checkbox">`) — do **not** migrate it to
  `@base-ui/react/checkbox`. That's a primitive-library swap, not a restyle; out of scope.

## New token needed
`m3-tokens.css` has `--md-success` / `--md-success-container` but no `--md-on-success-container`
(needed for readable text on the success badge background). Add one line to the existing `:root`
block (after `--md-success-container`):
```css
--md-on-success-container: #00391D;
```
Do not add a dark-mode override — `--md-success`/`--md-success-container` themselves aren't
overridden in `.dark` either (existing pattern), stay consistent.

---

## Step 1 — `src/components/ui/badge.tsx` (NEW)

CVA-based chip, pill-shaped, matching the two existing ad-hoc implementations it replaces
(`StatusBadge` in `GdprTable.tsx`, `PermBadge` in `AdminsClient.tsx`: both use
`rounded-full px-2 py-0.5 text-xs`).

```tsx
import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        outline: "border border-border bg-transparent text-foreground",
        muted: "bg-muted text-muted-foreground",
        success: "bg-[var(--md-success-container)] text-[var(--md-on-success-container)]",
        warning: "bg-[var(--md-tertiary-container)] text-[var(--md-on-tertiary-container)]",
        destructive: "bg-[var(--md-error-container)] text-[var(--md-on-error-container)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return (
    <span
      data-slot="badge"
      className={cn(badgeVariants({ variant, className }))}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
```

---

## Step 2 — `src/components/ui/textarea.tsx` (NEW)

Mirror `input.tsx`'s pattern exactly (same border/bg/focus/disabled/aria-invalid treatment,
`rounded-[--radius]` instead of `rounded-lg` since multi-line fields read better with the softer
12px M3 radius than the pill-ish input radius). Must forward all native props (react-hook-form's
`{...field}` spreads onto it in `SocialSettingsForm.tsx`).

```tsx
import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-16 w-full rounded-[--radius] border border-input bg-transparent px-3 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
```

---

## Step 3 — `src/components/ui/select.tsx` (NEW)

Follow the exact structural pattern already established by `dialog.tsx`/`sheet.tsx` in this repo
(`"use client"`, import the base-ui primitive aliased, thin wrapper functions per part with
`data-slot`, `cn()` for className merging). Export a standard shadcn-style API so call sites read
naturally:

```
Select              → SelectPrimitive.Root
SelectTrigger        → SelectPrimitive.Trigger  (className: h-8 w-full rounded-[--radius] border
                        border-input bg-transparent px-3 text-sm — mirror input.tsx's border/focus/
                        disabled/aria-invalid classes; flex items-center justify-between gap-2)
SelectValue          → SelectPrimitive.Value
SelectIcon           → SelectPrimitive.Icon, render a lucide ChevronDown, size-4, text-muted-foreground
SelectContent         → SelectPrimitive.Portal + SelectPrimitive.Positioner + SelectPrimitive.Popup,
                        className: rounded-[--radius] border border-border bg-popover text-popover-
                        foreground shadow-md p-1 z-50, min-w-[var(--anchor-width)] (base-ui exposes
                        this CSS var on the positioner — check index.d.ts if unsure)
SelectItem           → SelectPrimitive.Item, className: flex items-center gap-2 rounded-[calc(var(--radius)-4px)]
                        px-2 py-1.5 text-sm cursor-pointer outline-none data-highlighted:bg-accent
                        data-highlighted:text-accent-foreground data-disabled:pointer-events-none
                        data-disabled:opacity-50
SelectItemText       → SelectPrimitive.ItemText
SelectItemIndicator  → SelectPrimitive.ItemIndicator, render lucide Check icon size-4
SelectGroup          → SelectPrimitive.Group
SelectLabel          → SelectPrimitive.Label
SelectSeparator      → SelectPrimitive.Separator, className: h-px bg-border my-1
```

Trigger must show the chevron icon (`SelectIcon` wrapping `ChevronDown` from `lucide-react`, same
import already used for `XIcon` in dialog/sheet). Read `node_modules/@base-ui/react/select/index.d.ts`
and `node_modules/@base-ui/react/select/index.parts.d.ts` first to confirm each part's exact prop
names (`Value` render-prop signature, whether `Positioner` needs `sideOffset`, etc.) — do not guess
API shape, the d.ts files are the source of truth. Keep the whole file under 200 lines.

**API contract for call sites** (all 6 existing usages are plain `value`/`onChange(e.target.value)`
controlled native selects — no `multiple`, no native-only features):
```tsx
<Select value={x} onValueChange={setX}>
  <SelectTrigger><SelectValue placeholder="…" /></SelectTrigger>
  <SelectContent>
    <SelectItem value="a"><SelectItemText>Label A</SelectItemText></SelectItem>
  </SelectContent>
</Select>
```

---

## Step 4 — Restyle `src/components/ui/button.tsx`

Keep variant keys and size keys unchanged. Change:
- Base class: `rounded-lg` → `rounded-full` (M3 pill shape).
- Remove the `rounded-[min(var(--radius-md),10px|12px)]` overrides inside `xs`/`sm`/`icon-xs`/
  `icon-sm` size classes (pill radius degrades fine at any height, no override needed).
- `default` variant: `bg-primary text-primary-foreground [a]:hover:bg-primary/80` →
  `bg-primary text-primary-foreground shadow-sm [a]:hover:bg-primary/90` (M3 filled button gets a
  subtle elevation).
- `outline` variant: replace with an M3-outlined-button treatment using the primary color instead of
  generic border/muted:
  `"border-primary/50 bg-transparent text-primary hover:bg-primary/8 aria-expanded:bg-primary/8 dark:border-primary/40 dark:hover:bg-primary/10"`
- Leave `secondary`, `ghost`, `destructive`, `link` variant color logic as-is (already tonal/text
  treatments appropriate for M3) — only shape changes apply to them via the base class.
- Size paddings: bump `default` `px-2.5` → `px-3.5`, `lg` `px-2.5` → `px-4`, `sm` `px-2.5` → `px-3`
  (pill buttons need slightly more horizontal breathing room than rectangular ones; kept modest to
  avoid layout regressions in dense admin tables — flag this as a visual-check item afterward).

---

## Step 5 — Restyle `src/components/ui/input.tsx`

Change `rounded-lg` → `rounded-[--radius]` in the className string. Nothing else changes (colors,
focus ring, disabled/aria-invalid states already correct from the Part 1 semantic-alias chain).

---

## Step 6 — Restyle `src/components/ui/card.tsx`

`CardBase` className: change `rounded-xl` → `rounded-[--radius]` (both occurrences — the card itself
and the two `*:[img:first-child]:rounded-t-xl` / `*:[img:last-child]:rounded-b-xl` selectors, keep
those as `rounded-t-xl`/`rounded-b-xl` only if `--radius` (0.75rem/12px) ≈ `rounded-xl` (12px) — they
already match numerically, so this is a no-op there, just align the base div for clarity). Replace
`ring-1 ring-foreground/10` with a softer M3 elevation: `shadow-sm ring-1 ring-foreground/5`.
`CardHeader`/`CardFooter` `rounded-t-xl`/`rounded-b-xl` → `rounded-t-[--radius]`/`rounded-b-[--radius]`
to stay consistent with the parent radius change.

---

## Step 7 — Restyle `src/components/ui/dialog.tsx` and `src/components/ui/sheet.tsx`

- `DialogOverlay`/`SheetOverlay`: change `bg-black/10` → `bg-[var(--md-scrim,rgba(0,0,0,0.32))]`. Note
  `--md-scrim` does not exist in `m3-tokens.css` yet — this is a genuinely missing token per the
  original Part 2 note, so also append `--md-scrim: rgba(60, 45, 46, 0.32);` to `:root` in
  `m3-tokens.css` (using the warm-rose on-surface hue at 32% opacity, standard M3 scrim treatment).
  No `.dark` override needed (scrim is a fixed dark overlay in both themes).
- `DialogContent`: `rounded-xl` is already correct per the original note ("rounded-xl modals") — leave
  radius as-is, but replace `ring-1 ring-foreground/10` with `shadow-lg` (M3 dialogs use elevation,
  not a ring border).
- `DialogFooter`: `rounded-b-xl` stays (matches DialogContent's rounded-xl).
- `SheetContent`: no radius change needed (sheets are edge-anchored, M3 keeps them square on the
  screen-edge side) — only bump `shadow-lg` if not already present (it isn't; add it).

---

## Step 8 — Restyle `src/components/ui/checkbox.tsx`

Keep the existing hand-rolled `<button role="checkbox">` implementation and props contract exactly.
Only change the className: `rounded` (4px default) → `rounded-[4px]` explicit (M3 checkbox uses a
2px corner radius at 18px size — 4px reads closer to M3's proportions than Tailwind's default
`rounded` at this size, keep as literal since there's no smaller radius token to reference), and add
a hover state layer: append `hover:bg-primary/8` to the unchecked branch and
`hover:bg-primary/90` to the checked branch of the ternary.

---

## Step 9 — Restyle `src/components/ui/switch.tsx`

Already uses `bg-input`/`data-checked:bg-primary`/`rounded-full` — this is already M3-compliant.
No changes needed. (Leave the file untouched — do not edit just to "improve" it.)

---

## Step 10 — Migrate native `<select>` call sites (6 total) to the new `Select`

For each, replace the native `<select value onChange>...<option>` block with the new
`<Select value onValueChange={...}>` API from Step 3. Preserve all existing business logic
(disabled states, conditional options, translation calls) — only the JSX tag and event-handler
signature change (`onChange={(e) => setX(e.target.value)}` → `onValueChange={setX}`, since base-ui's
`onValueChange` already hands back the string value directly).

1. `src/app/admin/master/calendar/AppointmentModal.tsx:193` — Master select
2. `src/app/admin/master/calendar/AppointmentModal.tsx:215` — Service select
3. `src/app/admin/master/calendar/AppointmentModal.tsx:248` — Existing Client select
4. `src/app/admin/master/calendar/ModernCalendar.tsx:199` — time-step select (5/10/15/30/60 min)
5. `src/app/support/page.tsx:238` — Subject select
6. `src/components/profile/EditAppointmentModal.tsx:166` — Service select

---

## Step 11 — Migrate native `<textarea>` call sites (5 total) to the new `Textarea`

Swap the tag for `<Textarea ...same props.../>`, drop the hand-written className (the new component
already applies the right one) unless a call site needs an extra utility class (e.g. `min-h-[120px]`
or `font-mono` in `SocialSettingsForm.tsx` — keep those as an additional `className` passed through,
merged via `cn()`).

1. `src/app/admin/master/calendar/AppointmentModal.tsx:348`
2. `src/app/admin/masters/MasterForm.tsx:216`
3. `src/app/support/page.tsx:258`
4. `src/components/admin/SocialSettingsForm.tsx:227` — keep `font-mono min-h-[120px]` via `className`
5. `src/components/booking-management/ContactMasterPanel.tsx:145`

---

## Step 12 — Migrate inline badge components to the new `Badge`

- `src/app/admin/database/gdpr/GdprTable.tsx` — `StatusBadge`: keep the function (it maps `status` →
  variant), but have it render `<Badge variant="success">Active</Badge>` /
  `<Badge variant="warning">Withdrawn</Badge>` / `<Badge variant="muted">Erased</Badge>` instead of
  the hand-written `<span className="...">`.
- `src/app/admin/admins/AdminsClient.tsx` — `PermBadge`: render
  `<Badge variant={granted ? "success" : "muted"}>{label}</Badge>`.

Do not touch `AvatarBadge` in `avatar.tsx` (different concept, out of scope — see above).

---

## Step 13 — Verify

- `npm run build` — must succeed, same page count as before (73 pages).
- `npm run lint` — zero new warnings/errors (repo has zero-warning tolerance).
- Line-count check: every touched file stays ≤ 500 lines (`button.tsx`, `input.tsx`, `card.tsx`,
  `dialog.tsx`, `sheet.tsx`, `checkbox.tsx`, `switch.tsx` are all currently well under; new
  `select.tsx`/`textarea.tsx`/`badge.tsx` must also stay under 500).
- Grep confirms zero remaining `<select` / `<textarea` tags in the 11 migrated files, and zero
  remaining hand-written badge `<span className="rounded-full ...">` in the 2 migrated files.

## Acceptance Criteria
- [x] `npm run build` succeeds, 73 pages
- [x] `npm run lint` — zero new warnings
- [x] `select.tsx`, `textarea.tsx`, `badge.tsx` created, each ≤ 500 lines
- [x] `button.tsx`, `input.tsx`, `card.tsx`, `dialog.tsx`, `sheet.tsx`, `checkbox.tsx` restyled per
      steps above; `switch.tsx` untouched
- [x] All 6 native `<select>` call sites migrated, all 5 native `<textarea>` call sites migrated
- [x] `StatusBadge` and `PermBadge` render via the new `Badge` component
- [x] `AvatarBadge`, `.btn-primary`/`.btn-outline`, button variant keys, `dropdown-menu.tsx`,
      `navigation-menu.tsx` untouched
- [x] `--md-on-success-container` and `--md-scrim` added to `m3-tokens.css`, nothing else added
- [x] No out-of-scope files touched

## Files to change
1. `src/styles/m3-tokens.css` — add 2 tokens (`--md-on-success-container`, `--md-scrim`)
2. `src/components/ui/badge.tsx` — NEW
3. `src/components/ui/textarea.tsx` — NEW
4. `src/components/ui/select.tsx` — NEW
5. `src/components/ui/button.tsx` — restyle
6. `src/components/ui/input.tsx` — restyle
7. `src/components/ui/card.tsx` — restyle
8. `src/components/ui/dialog.tsx` — restyle
9. `src/components/ui/sheet.tsx` — restyle
10. `src/components/ui/checkbox.tsx` — restyle
11. `src/app/admin/master/calendar/AppointmentModal.tsx` — migrate 3 selects + 1 textarea
12. `src/app/admin/master/calendar/ModernCalendar.tsx` — migrate 1 select
13. `src/app/support/page.tsx` — migrate 1 select + 1 textarea
14. `src/components/profile/EditAppointmentModal.tsx` — migrate 1 select
15. `src/app/admin/masters/MasterForm.tsx` — migrate 1 textarea
16. `src/components/admin/SocialSettingsForm.tsx` — migrate 1 textarea
17. `src/components/booking-management/ContactMasterPanel.tsx` — migrate 1 textarea
18. `src/app/admin/database/gdpr/GdprTable.tsx` — migrate `StatusBadge`
19. `src/app/admin/admins/AdminsClient.tsx` — migrate `PermBadge`
