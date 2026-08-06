# Plan: unified-page-header

## Context

User-reported bug (item 5 of the original 5-item list, discussed with screenshots):
on several pages, header controls (`BackButton`, `LanguageToggle`, `ThemeToggle`) are
`fixed`/`absolute` overlays that don't reserve real layout space and don't coordinate
with each other or the content beneath them — so on narrow viewports they visually
overlap the page title/content. Screenshots showed this on the client profile page
("Moje wizyty"), `/privacy`, `/support`, and the homepage on mobile (language dropdown
overlapping a custom-page tab).

Agreed direction (discussed with the user across several messages this session):
put the controls in one real line, put page content below the line — mirroring the
one place this already works (`[masterId]/page.tsx`). Additionally, since a tenant can
create an unbounded number of custom pages, replace `TopNavLine`'s horizontal
scrolling tab strip with a burger menu, placed immediately next to the Back button
(user's explicit ask: "бургер сразу за кнопкой назад").

## Root cause (verified against current code this session)

Four pages share one broken pattern — `<BackButton />` (`fixed top-6 left-6 z-50`)
plus a separately-`absolute`-positioned `<div className="absolute top-4 right-4 z-20">`
wrapping `LanguageToggle`+`ThemeToggle`, with page content getting only a small
guessed top margin (`mt-8`/`py-8`/`py-6`) that doesn't actually clear either overlay:

- `src/app/profile/page.tsx` (lines 174-179) — collides with the centered `<h1>Moje
  wizyty</h1>`.
- `src/app/privacy/page.tsx` + `src/app/terms/page.tsx` (both delegate their body to
  `src/components/legal/LegalDocumentView.tsx`) — collide with the centered `<h1>`
  there (back button covers its first letters, language dropdown covers mid-title).
- `src/app/support/page.tsx` — same pattern, collides with its own centered `<h1>`.

Homepage mobile (`src/components/home/HomeClient.tsx` lines 88-102): desktop
(`lg:`) correctly composes `LanguageToggle`/`ThemeToggle`/`UserDropdown` through
`TopNavLine`'s `actions` flex slot (real layout space, works). Mobile (`lg:hidden`)
abandons that — renders `TopNavLine` with no `actions`, guessed static `pl-20 pr-20`
padding on the tab row, while separately overlaying `ThemeToggle`
(`absolute top-4 right-4`) and `UserDropdown`+`LanguageToggle` (`absolute top-4
left-4`) on top. The guessed padding doesn't match the real overlay width, so e.g.
the language dropdown overlaps a tab labeled "O salonie".

**The one place that already works**: `src/app/[masterId]/page.tsx` (lines 260-281).
`LanguageToggle`/`ThemeToggle` are composed inside `TopNavLine`'s `actions` slot on
every breakpoint (no mobile-only overlay split), and the content wrapper below has an
explicit `pt-12` with a comment stating this deliberately clears the nav bar above it.
`BackButton` is *still* independently `fixed` there too, though — it happens not to
visibly collide with anything only because nothing else occupies that exact corner on
that specific page.

## Design decision: Back button moves INTO the row too (not just Language/Theme)

The user's own conclusion was "controls in the line, content below the line" — that
includes Back, not just Language/Theme. A `fixed`-positioned Back button floating
independently, disconnected from a burger that's supposed to sit "immediately next to"
it, doesn't compose: `TopNavLine`'s tab content starts well after a large reserved
gap (`pl-28 sm:pl-32` outer + `leadingSpaceClassName="pl-48"` inner — up to ~320px on
`sm:`) that exists purely to keep tab labels clear of an optional admin-configured
corner logo (percentage-positioned, independent absolute element, unrelated to
`TopNavLine`'s own layout). If Back+burger rendered inside that gap they'd start
~320px from the left edge, nowhere near "immediately after Back" in any visual sense;
if Back+burger rendered outside/before that gap (at the true corner) while the gap
itself stayed reserved, there'd be a large dead strip between them and the tabs area.

Resolution — two different components for two genuinely different situations:

1. **Pages with a possible corner logo** (home, master's own page, any custom-page
   view — everywhere `TopNavLine` is used): keep the *existing, tuned*
   `pl-28 sm:pl-32` / `leadingSpaceClassName="pl-48"` reserved gap **completely
   unchanged** (zero risk to the logo feature, which is out of scope here). Render
   Back + burger as the first items *inside* that gap's own element (i.e., exactly
   where tab labels used to start) — adjacent to each other, both still logo-safe.
   `TopNavLine` itself absorbs Back (it doesn't live in the parent route file
   anymore) and gains the burger, replacing the horizontal tab strip entirely.
2. **Pages with no logo at all** (profile, privacy, terms, support — verified via
   direct read: none of these four route files render any logo/`Image`): no reserved
   gap is needed. A new `PageToolbar` component renders Back + Language + Theme as a
   plain **in-flow** flex row (not `fixed`/`absolute` at all) at the top of the page.
   Because it's real in-flow content, page content below it just flows naturally
   after it — there is no clearance value to compute or get wrong, ever, for these
   four pages. This is a stronger fix than copying the master page's
   absolute-position-plus-guessed-padding pattern onto pages that have no logo
   constraint requiring that pattern in the first place.

`src/components/BackButton.tsx` becomes fully superseded by both components above —
its only 7 current call sites (verified by grep this session) are exactly the ones
being changed. Delete it (verify zero remaining references first) per the project's
standing "delete dead code immediately" directive (ROADMAP.md Priority 4).

**Correction (found by the coder during implementation, confirmed by the
orchestrator):** the grep actually shows 8 call sites, not 7 — `src/app/profile/edit/page.tsx`
("Edit Profile" page) was missed in the original investigation. It has the exact
same broken pattern as items 9-12 below (`<BackButton />` + absolute
`LanguageToggle`+`ThemeToggle` div + `mt-8` content wrapper) and needs the exact
same fix. Added as step 12b below — apply identically to steps 9-12.

## New files

### 1. `src/components/PageBackLink.tsx` (new, ~20 lines)

Pure presentational piece, extracted so both `PageToolbar` and `TopNavLine` render an
identical Back control without duplicating markup. Same visual output as today's
`BackButton`, minus the `fixed` wrapper (now a normal flex child):

```tsx
"use client"
import Link from 'next/link'
import { useTranslation } from 'react-i18next'

interface PageBackLinkProps {
  href?: string
}

export default function PageBackLink({ href = '/' }: PageBackLinkProps) {
  const { t } = useTranslation()

  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 px-4 py-2 bg-card rounded-2xl border border-border text-card-foreground hover:brightness-105 transition-all duration-200 shadow-lg text-sm font-medium shrink-0"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
      </svg>
      {t('common.back')}
    </Link>
  )
}
```

(Identical classes/icon/label to current `BackButton.tsx` — only the outer
`<div className="fixed top-6 left-6 z-50">` wrapper is dropped, plus `shrink-0` added
since it now lives inside a flex row that may also contain a burger button.)

### 2. `src/components/PageToolbar.tsx` (new, ~20 lines)

For the four no-logo pages. Real in-flow flex row, no absolute/fixed positioning:

```tsx
"use client"
import PageBackLink from '@/components/PageBackLink'
import LanguageToggle from '@/components/LanguageToggle'
import ThemeToggle from '@/components/ThemeToggle'

interface PageToolbarProps {
  backHref?: string
}

export default function PageToolbar({ backHref = '/' }: PageToolbarProps) {
  return (
    <div className="flex items-center justify-between gap-2">
      <PageBackLink href={backHref} />
      <div className="flex items-center gap-2 shrink-0">
        <LanguageToggle />
        <ThemeToggle />
      </div>
    </div>
  )
}
```

## Modified files

### 3. `src/components/content/TopNavLine.tsx` (currently 118 lines)

- Add `backHref?: string` to `TopNavLineProps` (JSDoc: "if omitted, no Back control is
  rendered — the true homepage has nothing to go back to").
- Replace the `<nav className={cn("min-w-0 flex-1 overflow-x-auto custom-scrollbar",
  leadingSpaceClassName)}>` tab-strip block with a `<div className={cn("flex min-w-0
  flex-1 items-center gap-2", leadingSpaceClassName)}>` containing:
  - `{backHref && <PageBackLink href={backHref} />}`
  - A burger button, rendered only when `tabs.length > 0`:
    ```tsx
    {tabs.length > 0 && (
      <DropdownMenu>
        <DropdownMenuTrigger
          className="inline-flex items-center justify-center rounded-full border border-border bg-card p-2 text-card-foreground shadow-lg hover:brightness-105 transition-all duration-200 shrink-0"
          aria-label={t('common.pagesMenu')}
        >
          <Menu className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {tabs.map((tab) => {
            const active = pathname === tab.href
            return (
              <DropdownMenuItem key={tab.id} render={<Link href={tab.href} />}>
                {tab.title}
                {active && <Check className="h-3.5 w-3.5 ml-auto text-primary" />}
              </DropdownMenuItem>
            )
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    )}
    ```
    (`render={<Link href={tab.href} />}` mirrors the exact base-ui polymorphic
    `render`-prop pattern already used in `src/components/ui/sheet.tsx`'s
    `SheetPrimitive.Close` — verify the prop is accepted on `MenuPrimitive.Item.Props`
    from `@base-ui/react/menu`; if the exact prop name differs, use whatever this
    project's other `DropdownMenuItem` call sites already use for a link-like item —
    grep `DropdownMenuItem` usages under `src/` for a precedent before inventing a new
    pattern.)
  - Needs new imports: `useTranslation` from `react-i18next` (component doesn't
    import it today — check whether it's already imported before adding), `Menu`,
    `Check` from `lucide-react`, `PageBackLink`, and
    `DropdownMenu`/`DropdownMenuTrigger`/`DropdownMenuContent`/`DropdownMenuItem`
    from `@/components/ui/dropdown-menu`.
- Delete the `tabs.map(...)` block that rendered `<Link>` tab pills directly (fully
  replaced by the burger above) — but **keep the `tabs` derivation itself**
  (`const tabs = (data?.pages ?? [])...filter(...)`), it's now consumed by the burger
  instead.
- `actions` slot and the hairline `<div>` at the bottom are untouched.
- Re-verify final line count stays under 500 (expect ~140-150 lines; if it
  meaningfully exceeds that, extract the burger's `DropdownMenu` block into a small
  `src/components/content/PageMenuButton.tsx` — but try inline first, this addition
  is modest).

### 4. `src/components/content/PageRenderer.tsx` (currently 81 lines)

Add `backHref?: string` to `PageRendererProps`, forward it to the `<TopNavLine
masterId={masterId} backHref={backHref} .../>` call. No other change — `PageRenderer`
never rendered `BackButton` itself (that was always done one level up, by the route
file), so nothing to remove here.

### 5. `src/app/pages/[slug]/page.tsx`

Remove `<BackButton />` and its import. Pass `backHref="/"` to `<PageRenderer
blocks={result.blocks} backHref="/" />` (matches today's default-href behavior
exactly).

### 6. `src/app/[masterId]/pages/[slug]/page.tsx`

Remove `<BackButton href={`/${params.masterId}`} />` and its import. Pass
`backHref={`/${params.masterId}`}` to `<PageRenderer blocks={result.blocks}
masterId={params.masterId} backHref={`/${params.masterId}`} />` (matches today's
behavior exactly).

### 7. `src/app/[masterId]/page.tsx`

Remove the standalone `<BackButton />` line (~262) and its import. Add
`backHref="/"` to the existing `<TopNavLine masterId={masterId}
leadingSpaceClassName="pl-48" actions={...} />` call. Everything else (LogoDisplay,
the `pt-12` content-clearance comment/class) is unchanged — `TopNavLine`'s own
absolute wrapper position (`top-2`) and outer `pl-28 sm:pl-32` are untouched, so the
existing `pt-12` clearance reasoning still holds. Visually re-verify per the manual
checklist below since Back+burger inside the row may be marginally taller than a bare
tab link was.

### 8. `src/components/home/HomeClient.tsx`

Desktop branch (`hidden lg:block`, lines 71-86): add `backHref` is **not** passed
(homepage has nothing to go back to — omitting it means `TopNavLine` renders no Back
control, matching today's homepage having no `BackButton` at all). No other change to
this branch.

Mobile branch (lines 88-102): delete all three separately-`absolute`-positioned divs
(`TopNavLine` without actions, the `ThemeToggle` overlay div, the
`UserDropdown`+`LanguageToggle` overlay div) and their guessed `pl-20`/`pr-20`
padding. Replace with the same pattern the desktop branch already uses, just without
the `hidden lg:block` / `lg:hidden` split — i.e. collapse to ONE `TopNavLine` render
that works at every breakpoint:

```tsx
<div className="absolute top-2 left-0 right-0 z-20 pl-28 sm:pl-32">
  <TopNavLine
    leadingSpaceClassName="pl-48"
    actions={
      <>
        <UserDropdown />
        <LanguageToggle />
        <ThemeToggle />
      </>
    }
  />
</div>
```

(This is literally the existing desktop block with `hidden lg:block` removed — the
`nav` element already handles narrow widths via its own `overflow-x-auto`/flex
behavior, and now that tabs are a burger instead of a scrolling strip, there's no
mobile-specific overflow concern left to special-case.) Delete the now-fully-replaced
old mobile-only block entirely. Verify the `top-2 pl-28 sm:pl-32` positioning still
looks right at narrow widths via the manual checklist (this is the exact bug the user
originally reported, so this is the most important item to visually confirm).

### 9-12. `src/app/profile/page.tsx`, `src/app/privacy/page.tsx`, `src/app/terms/page.tsx`, `src/app/support/page.tsx`

Same change in all four:
- Remove the `<BackButton />` line, the `<div className="absolute top-4 right-4
  z-20 flex items-center gap-2"><LanguageToggle /><ThemeToggle /></div>` block, and
  their now-unused imports (`BackButton`, `LanguageToggle`, `ThemeToggle`).
- Add `import PageToolbar from '@/components/PageToolbar'` and render
  `<PageToolbar />` as the first child inside the existing `<main>`, before the
  content wrapper.
- Because `PageToolbar` is real in-flow content (not an overlay), the content
  wrapper's old top offset that existed *solely* to clear the removed overlays is now
  redundant and must shrink to a normal content gap, not stay as a large clearance
  value:
  - `profile/page.tsx`: content div is `<div className="mx-auto w-full max-w-lg mt-8
    space-y-6">` → change `mt-8` to `mt-4` (or remove entirely if `PageToolbar`'s own
    implicit spacing plus `<main>`'s existing `py-4 sm:p-6` already reads correctly —
    decide by visual check, don't leave a guessed large value).
  - `privacy/page.tsx` / `terms/page.tsx`: the `<div className="container mx-auto
    max-w-4xl px-6 py-8">` wrapping `<LegalDocumentView>` — reduce `py-8` to
    something like `pt-4 pb-8` (only the *top* padding was compensating for the old
    overlay; bottom padding is unrelated and should stay).
  - `support/page.tsx`: the `<div className="container mx-auto max-w-6xl px-6
    py-6">` — same idea, reduce only the top side, e.g. `pt-4 pb-6`.
  - In all four cases: wrap `<PageToolbar />` and the content div in a shared
    vertical rhythm (e.g. put both inside one outer `<div className="... space-y-4
    ...">`, or give `PageToolbar` itself a bottom margin like `mb-4`) — pick
    whichever keeps the diff smallest per file; the acceptance criterion is "no
    double-gap, no leftover magic clearance number," not a specific class name.

### 12b. `src/app/profile/edit/page.tsx`

Same change as steps 9-12: remove `<BackButton />`, the absolute
`LanguageToggle`+`ThemeToggle` div, and their now-unused imports. Add
`<PageToolbar />` as the first child inside `<main>`. Content wrapper is
`<div className="mx-auto w-full max-w-lg mt-8 space-y-6">` (identical to
`profile/page.tsx`) — reduce `mt-8` to `mt-4`, matching the choice already made for
`profile/page.tsx` in step 9.

### 13. Delete `src/components/BackButton.tsx`

Only after confirming (via `grep -rn "BackButton" src/`) that every one of steps 5-12
has actually removed its import/usage — zero remaining references before deleting.

## i18n

One new key, `common.pagesMenu` (aria-label for the burger trigger — icon-only
button, no visible label needed). Add to all three locale files at the same nesting
level as the existing `common.back` key (`src/locales/{pl,en,uk}.json`, top-level
`"common"` object, ~line 45-55 in `pl.json`):

- `pl.json`: `"pagesMenu": "Strony"`
- `en.json`: `"pagesMenu": "Pages"`
- `uk.json`: `"pagesMenu": "Сторінки"`

No other new UI text — `PageBackLink` reuses the existing `common.back` key,
`PageToolbar` introduces no new copy.

## Out of scope / explicitly not touched

- Logo positioning/sizing (`logoUrl`, `logoPositionX/Y`, `logoLayer`, etc.) — the
  existing `pl-28 sm:pl-32` / `leadingSpaceClassName="pl-48"` reserved-space values
  are preserved exactly as-is for every `TopNavLine` call site. Do not tune, shrink,
  or "improve" these numbers as part of this task.
- `LanguageToggle.tsx` / `ThemeToggle.tsx` internals — unchanged, only their
  *position* on the page changes (from independent absolute overlay to a flex child).
- Any page not in the list above (e.g. auth pages, admin pages) — not part of this
  bug report, not touched.
- `tests/` — grepped this session: zero existing test files reference `TopNavLine` or
  `BackButton`, so no test updates are required. If the coder finds this has changed,
  stop and report rather than deleting/rewriting a test blind.

## Checklist

- [x] `src/components/PageBackLink.tsx` created, matches `BackButton.tsx`'s exact
      visual output minus the `fixed` wrapper
- [x] `src/components/PageToolbar.tsx` created — real in-flow flex row, no
      `fixed`/`absolute` anywhere in it
- [x] `TopNavLine.tsx`: `backHref` prop added (Back omitted when not provided);
      horizontal tab strip replaced by burger+dropdown (only rendered when
      `tabs.length > 0`); `leadingSpaceClassName`/hairline/`actions` slot unchanged;
      active tab shown with a checkmark in the dropdown
- [x] `PageRenderer.tsx`: `backHref` prop added and forwarded to `TopNavLine`
- [x] `src/app/pages/[slug]/page.tsx`: `BackButton` removed, `backHref="/"` passed
- [x] `src/app/[masterId]/pages/[slug]/page.tsx`: `BackButton` removed, correct
      `backHref` passed
- [x] `src/app/[masterId]/page.tsx`: `BackButton` removed, `backHref="/"` passed to
      `TopNavLine`
- [x] `HomeClient.tsx`: mobile-only overlay branch (3 divs) deleted; single
      `TopNavLine` render works at every breakpoint via `actions`
- [x] `profile/page.tsx`, `privacy/page.tsx`, `terms/page.tsx`, `support/page.tsx`:
      all four use `<PageToolbar />`, no leftover `BackButton`/standalone
      `LanguageToggle`/`ThemeToggle` imports, no doubled top-clearance spacing
- [x] `src/app/profile/edit/page.tsx` (step 12b): `BackButton` removed, absolute
      `LanguageToggle`+`ThemeToggle` div removed, now uses `<PageToolbar />`,
      content wrapper `mt-8` reduced to `mt-4` (matches `profile/page.tsx`)
- [x] `BackButton.tsx` deleted — `grep -rn "BackButton" src/` confirmed zero
      remaining references before deletion
- [x] `common.pagesMenu` added to `pl.json`/`en.json`/`uk.json`
- [x] No other files touched; no new dependencies — verified via `git status`/
      `git diff --name-only`
- [x] Every touched/new file stays under 500 lines — largest is
      `src/app/[masterId]/page.tsx` at 433 lines; `TopNavLine.tsx` came in at 125
      lines (well under the ~140-150 estimate), no burger extraction needed
- [x] `npm run lint` — no new problems vs baseline (the two unused-import errors
      that appear in touched files — `Link` in `HomeClient.tsx`, `Image` in
      `[masterId]/page.tsx` — both pre-exist on `HEAD` and are untouched by this
      diff; confirmed via `git show HEAD:<file>`)
- [x] `npm run test` — 36 files / 345 tests, all passed, no regressions. Also ran
      `npm run i18n:check`: all 1337 keys in sync across pl/en/uk, all referenced
      `t()` keys resolve.

## Manual verification (RU, коротко)

1. Открыть на узком экране (мобильная ширина): главная, страница мастера, любую
   кастомную страницу, профиль ("Мои визиты"), `/privacy`, `/terms`, `/support` —
   нигде "Назад"/язык/тема не должны перекрывать заголовок или вкладки.
2. На главной и на странице мастера — рядом с "Назад" должна быть кнопка-бургер (☰),
   открывающая список кастомных страниц; активная страница отмечена галочкой.
3. На странице без кастомных страниц у салона/мастера — бургер не должен появляться
   вообще (пустой список = кнопки нет).
4. Профиль/`/privacy`/`/terms`/`/support` — бургера НЕТ (у этих страниц нет вкладок),
   только "Назад" + язык + тема в одну строку.
5. Проверить логотип (если он настроен в админке) — он по-прежнему должен красиво
   помещаться, не перекрываясь текстом вкладок/бургером на главной и странице
   мастера.
6. Клик по "Назад" с каждой из этих страниц — должен вести туда же, куда вёл раньше
   (профиль/легал/support → на главную; кастомная страница мастера → на страницу
   этого мастера; кастомная общая страница → на главную).
