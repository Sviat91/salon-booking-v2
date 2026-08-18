# Embedding this demo as two windows (client + admin)

This document is for whoever is embedding `demo-widget` into another site
(e.g. as two iframes on a marketing landing page — one showing the client
booking flow, one showing the admin panel). It describes what already
exists in this codebase and how the "admin edits show up live" mechanism
works, so you can decide how to wire it into your own page/framework. It
does **not** prescribe how to build the two-window layout itself — that
depends on your app's stack, which this document doesn't assume anything
about.

## What this app is

A single Vite + React SPA (no backend, no server-side routing). Build with
`npm run build`, output lands in `dist/` as a normal static bundle — deploy
it however you deploy static assets, and load it in an iframe/window like
any other page.

Entry point: `src/main.tsx` → `src/App.tsx`. There is no React Router and
no real URL routing — which screen is shown is controlled entirely by one
in-memory state value (`view`, in `src/context/AppContext.tsx`), a union
type: `{ name: 'home' | 'booking' | 'about' | 'privacy' | 'terms' |
'support' | 'admin', ... }`. `App.tsx`'s `Shell` component reads `view` and
renders either the admin panel (`view.name === 'admin'` → `<AdminApp />`,
full-page chrome, no public header/footer) or one of the public pages
(wrapped in the shared `Footer`).

## Current state: one window, not two

Today there is only one way to reach the admin view: a floating "View admin
demo →" button (`DevSiteAdminSwitch` in `App.tsx`) that calls
`navigateToAdmin()`, flipping the same in-memory `view` state. The app
always **boots into `{ name: 'home' }`** — there is no URL query param or
similar to make a fresh page load start directly on the admin view.

If you want two separate windows/iframes — one pinned to the client side,
one pinned to the admin side — you will need to add your own way to force
the initial `view` (e.g. read a query string when `AppContext`'s `useState`
initializes). That's a small change but it doesn't exist yet.

## The "admin edits show up everywhere live" mechanism

This is the part that matters most for a two-window setup, so it's worth
understanding precisely.

**`src/lib/brandSettings.ts`** — pure functions + types, no React:
- `BrandSettings`: the salon name plus 14 hex color fields (6 light-theme
  fields, 7 dark-theme fields, 1 light-theme background field). These are
  the same fields the real production app's tenant branding config has.
- `DEFAULT_BRAND` / `M3_LIGHT_DEFAULTS` / `M3_DARK_DEFAULTS`: seed/reset
  values.
- `hexToRgbTriplet(hex)`: converts `#RRGGBB` → `"R G B"` (space-separated
  decimal), because the CSS custom properties this app uses are consumed as
  `rgb(var(--x) / <alpha-value>)` in `tailwind.config.ts` (needed for
  Tailwind's opacity-modifier classes like `bg-primary/10` to work).
- `applyThemeColors(settings)`: the actual "make it visible" step. Checks
  whether `<html>` currently has the `.dark` class, then calls
  `document.documentElement.style.setProperty('--foo', ...)` for the
  relevant CSS variables (`--background`, `--foreground`, `--card`,
  `--primary`, `--secondary`, `--muted`, `--accent`, `--border`, `--ring`,
  plus their `-foreground` companions), picking values from either the
  light or dark half of `settings`.
- `getBrandSettings()` / `saveBrandSettings()`: read/write a single
  localStorage key (`ordiset-demo-brand`) holding the whole `BrandSettings`
  object as JSON. This is how settings survive a page reload.

**`src/context/BrandContext.tsx`** — the React layer, mounted exactly once
at the top of the tree (`App.tsx`: `<AppProvider><BrandProvider><Shell
/></BrandProvider></AppProvider>`), so both the client pages and the admin
panel are descendants of the same single `BrandProvider`:
- `brand`: the currently-applied/"saved" settings.
- `draft`: a working copy being edited (starts equal to `brand`).
- `isDirty`: true once `draft` has any unsaved change.
- `updateDraft(patch)`: shallow-merges into `draft`, sets `isDirty = true`.
  This is what every color/name input in Settings calls on change — editing
  a field does **not** apply it yet, it only updates `draft`.
- `saveDraft()`: `brand = draft`, persists via `saveBrandSettings`, clears
  `isDirty`. This is the only moment a change actually takes visual effect.
- A `useEffect` calls `applyThemeColors(brand)` whenever `brand` changes,
  and a `MutationObserver` re-calls it whenever the `.dark` class on
  `<html>` toggles (so switching the light/dark theme toggle re-applies the
  correct half of the palette without needing a save).

**Where the UI lives**: `src/admin/pages/SettingsPage/index.tsx` (the
color/name fields, reading/writing `draft` via `useBrand()`) and
`src/admin/AdminSidebar.tsx` (the "Save changes" button — only rendered
while the Settings section is open, `disabled` unless `isDirty`, calls
`saveDraft()` on click).

**Why edits show up on both client and admin pages automatically**: every
page in this app — public and admin alike — is styled with the same
Tailwind semantic classes (`bg-primary`, `text-foreground`, `bg-card`,
`border-border`, etc.), and `tailwind.config.ts` defines all of those as
reading the same CSS custom properties that `applyThemeColors` writes.
There's no per-page wiring — it's a side effect of everything sharing one
`<html>` element and one Tailwind config. A component doesn't need to know
`BrandContext` exists at all to pick up a color change; it just needs to
use the standard Tailwind class names.

## The one thing to watch out for with two separate windows

Everything above works because it all happens inside **one loaded document
/ one React tree**. `document.documentElement.style.setProperty(...)` only
affects the `<html>` element of the page it runs in, and React Context only
spans one component tree.

If the client view and the admin view end up as two genuinely separate
browser contexts (two `<iframe>`s, two tabs, two independent mounts of this
app), each one has its own `document`, its own `BrandProvider`, its own
`brand`/`draft` state — saving a change in one will **not** automatically
repaint the other in real time. The two are only connected via
`localStorage` (same-origin iframes/tabs share it), so a saved change
written by one window is *available* to the other, but nothing in this
codebase currently listens for it — there's no `window.addEventListener('storage', ...)`
anywhere, so the second window won't notice until it re-reads
`getBrandSettings()` itself (e.g. on its own reload, or if something in
your embedding page triggers a re-check).

Whether the fix is a `storage` event listener, `postMessage` between the
two windows, a shared state layer outside this app, or reloading the second
window after a save — that depends entirely on how your page ends up
structuring the two windows, which is outside what this codebase can tell
you. This note exists so the gap doesn't surprise you.

## Quick component reference

| File | Responsibility |
|---|---|
| `src/App.tsx` | Root shell; mounts `AppProvider`/`BrandProvider` once; switches between public pages and `AdminApp` based on `view.name`. |
| `src/context/AppContext.tsx` | In-memory `view` state (no URL routing) driving which screen is shown. |
| `src/context/BrandContext.tsx` | `brand`/`draft`/`isDirty`/`updateDraft`/`saveDraft` — the live-theming state machine. |
| `src/lib/brandSettings.ts` | Types, defaults, hex→RGB conversion, `applyThemeColors` (writes CSS vars), localStorage persistence. |
| `src/admin/AdminApp.tsx` | Admin panel shell (sidebar + topbar + routed section). |
| `src/admin/AdminSidebar.tsx` | Admin nav; hosts the Save-changes button (Settings section only). |
| `src/admin/pages/SettingsPage/` | Where all editable brand/color fields live. |
| `src/pages/HomePage.tsx` + other `src/pages/*` | Public/client-facing screens — style themselves with the same Tailwind semantic classes, no direct knowledge of `BrandContext` required. |
