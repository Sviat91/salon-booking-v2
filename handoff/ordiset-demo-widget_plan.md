# Ordiset demo widget — plan (not started)

## Goal
Build a self-contained, pure-frontend copy of the real Salon Booking UI
inside this repo, verify it works/looks right on localhost like a normal
dev task, then physically move the finished folder into the separate
Ordiset landing-page project and have it embedded as-is (iframe/preview
window) — no AI tool reinterpretation involved at all.

## Why (context)
Two rounds of asking an external AI/no-code tool to recreate the Salon
Booking design from a written brief (`ORDISET_DEMO_WIDGETS_PROMPT.md`,
including a second pass with literal extracted Tailwind classes/CSS tokens)
both failed — inconsistent header per page, off-center content, wrong
calendar styling, demo window not filling its section. Root cause: asking a
tool to *reinterpret* a description of our design instead of just *using*
our design. This plan removes the reinterpretation step entirely by handing
over a finished, already-correct artifact instead of instructions.

Also ruled out: iframing the real production instance directly. User does
not want the demo writing to the real database or depending on the real
backend at all — the widget must be pure frontend, zero DB/API dependency,
so it's physically impossible for a landing-page visitor to affect real
data.

## Architecture
- New folder in this repo — working name `demo-widget/` — a separate
  lightweight app (own build, **no Prisma/DB dependency, no calls to this
  app's `/api/*` routes**).
- Real components copied in from `src/components` (header/nav — `TopNavLine`
  pattern, `Card`, `DayCalendar`, `MasterSelector`, `ProcedureSelect`,
  `Footer`, legal-page layout, plus whichever admin/settings screens back
  the "Customize" window) — copied, not reinvented, so visual fidelity is
  guaranteed by construction.
- All data-fetching (`fetch('/api/...')`) replaced with static mock data:
  masters Marek Zawadzki / Anna Nowak, their service lists (already drafted
  in `ORDISET_DEMO_WIDGETS_PROMPT.md`), "Loom & Blade" branding tokens.
- No real backend mutations. **Local persistence via `localStorage` is
  fine and expected** — e.g. changing a branding color in the "Customize"
  window should visibly stick on reload while building/testing, exactly
  like the original 2026-08-11 plan for the interactive demo.
- Real photos get baked in as static assets once available.
- Verified the normal way: run it locally, click through in an actual
  browser — not judged from a written spec or screenshots.

## Two demo "windows" on the landing page (matches the nav tabs already
visible in the landing page's current build: Overview / Customize / Mobile
/ Booking site / Notifications)
1. **"Booking site"** — Home (master selection) + master booking page.
   Interactive locally: pick service → date → slot, mock/local state only.
2. **"Customize"** — admin/settings-style screens, branding customization.
   Open detail to confirm when work resumes: fully clickable with
   `localStorage`-backed changes (consistent with window 1), vs. a couple
   of static key screens only. Default to the clickable/localStorage
   version unless it turns out to be more effort than it's worth.

## Handoff to the landing-page project (final step, once it looks right)
1. Cut the finished `demo-widget/` folder out of this repo, move it into
   the separate Ordiset landing-page project. Keep a backup copy here too.
2. Tell the landing-page tool/agent to simply **embed this finished folder**
   into the preview/demo window — explicitly not to redesign, restyle, or
   reinterpret anything. This is what removes the failure mode from the
   last two attempts.

## Status
Discussed and agreed 2026-08-13.

**2026-08-14, first pass — built from `ORDISET_DEMO_WIDGETS_PROMPT.md` instead
of the real components. Rejected by the user and rebuilt** (see below) — that
prompt doc was itself a paraphrase written *for an external AI tool*, so
building from it reproduced the exact reinterpretation failure mode this
whole plan exists to avoid, just with the assistant as the "external tool"
instead of a no-code builder. The prompt doc has since been deleted by the
user. Concrete symptoms: no max-width shell (widgets rendered oversized), no
Framer Motion animations anywhere, an invented "Confirm booking" button
standing in for the real "Manage booking" widget, marquee boxed inside the
centered container instead of full-bleed.

**2026-08-14, second pass — rebuilt by literally reading and porting the
real `.tsx` source files** (`src/app/page.tsx`, `src/app/[masterId]/page.tsx`,
`src/app/layout.tsx`, `BrandHeader`, `TopNavLine`, `PageBackLink`,
`MasterSelector`, `DayCalendar`, `ProcedureSelect`, `SlotsList`,
`TodayPromoCard`, `MasterFooterBlock`, `Footer`, `ThemeToggle`,
`booking-management/{BookingManagement,SearchPanel,NoResultsPanel}`,
`BookingForm`, `BookingSuccessPanel`, `ui/card.tsx`, `lib/utils.ts`
(`cn`), `hooks/useReducedMotion.ts`, plus the `.rdp-*`/`.btn*`/marquee CSS
from `globals.css`). Same file names as the real app, same Tailwind classes,
same Framer Motion transitions, same `react-day-picker` calendar — added as
real dependencies (`framer-motion`, `react-day-picker`, `date-fns`,
`lucide-react`, `clsx`, `tailwind-merge`, matching the main app's versions).
`npm install` + `npm run build` verified clean (0 TS errors). Dev server
**not** started by the assistant — user runs it.

Infra shims (Next.js/backend pieces with no equivalent in a static Vite app):
`next/image`→`img`, `next/link`/`useRouter`→a local `AppContext` (selected
master + view state), `@tanstack/react-query`→static mock data returned
synchronously, `react-i18next`→a `t()` function with real English copy
copied verbatim from `src/locales/en.json`. `LanguageToggle` is intentionally
**absent** — the real component returns `null` for a single-language tenant,
which this demo is, so omitting it is the faithful behavior, not a cut corner.

**Deliberate, bounded simplifications (backend-dependent pieces with nothing
to connect to, not stylistic shortcuts):**
- `BookingForm`: name+phone fields + submit only. Real form also has
  Turnstile captcha, auth pre-fill, a GDPR consent-modal step, and a
  promo-code/discount-preview field — all require a real backend.
- `BookingManagement`: the real widget backs a ~20-component state machine
  (cancel/reschedule/contact-master flows) against real booking records.
  Ported the Card, the closed/open toggle, `SearchPanel`, and
  `NoResultsPanel` verbatim — every search honestly resolves to "no bookings
  found" (there are none), rather than fabricating fake results.
- Autoscroll-into-view choreography (refs scrolling the page as each booking
  step completes) dropped — scroll behavior, not visual styling.
- `DayCalendar`/`SlotsList` availability is mocked (weekdays open, fixed slot
  times) instead of fetched, using the same `react-day-picker` component and
  classNames as the real one.

Per-master content is still demonstrated via `MasterFooterBlock` (ported
wrapper/timing): Marek's page shows the bio+achievements text block, Anna's
shows a review-strip block (`ReviewStrip.tsx`, built on `MarqueeTrack.tsx` —
itself ported from the real `StripWidget.tsx`, full-bleed trick and
repeat-count math included) — same Page/Block-per-master architecture the
real app uses, not a one-off invention.

**2026-08-14, third pass — approved by the user** ("наконец-то, это именно
то, что я хотел"). Follow-ups done in the same pass:
- Theme-toggle icon shrunk 48px → 36px (still within the real component's own
  32–64px clamp).
- Bookings now persist to `localStorage` (`lib/localBookings.ts`) instead of
  living only in component state — same local-persistence pattern as the
  theme toggle. `BookingForm` writes a real record on submit.
- `BookingManagement`'s search is now real, not a stub: it searches those
  localStorage records (name substring + last-6-digits phone match). Added
  a ported `ResultsPanel.tsx` (static booking cards — no change/cancel
  actions, same reasoning as the no-backend note above) for when a search
  actually finds the booking you just made.
- Built the three real footer-linked pages, ported from the real
  `LegalPageHeader`/`LegalDocumentView`/`MarkdownLite`/`lib/markdown-lite.ts`
  (framework-free, copied verbatim) plus a simplified `support/page.tsx`:
  **Privacy Policy**, **Terms of Service** (mock Loom & Blade legal copy —
  content itself is inherently tenant-authored, so this is drafted, not
  ported, unlike every structural/styling piece), **Help Center** (contact
  form, local mock-submit success state, no Turnstile; GDPR "Quick Actions"
  buttons are visually present but inert — their real modals need a real
  account). Footer links now actually navigate instead of being inert.
- **Not built**: "About Us" — in the real app this isn't a fixed route, it's
  an admin-configured `/pages/[slug]` content page + `TopNavLine` tab (only
  exists if a tenant creates one). Skipped rather than guessed at; flag if
  it should be added as a demo content page too.

**2026-08-14, fourth pass — dark-by-default + real assets baked in.**
- `index.html` now sets the `dark` class before React mounts unless the
  visitor explicitly saved `'light'` (ported the real layout.tsx's blocking
  inline-script pattern, but the no-preference fallback is dark, not system
  preference — deliberate for a dark-branded demo, not a real tenant).
- Real assets dropped into `demo-widget/public/`: `logo.png` (Loom & Blade
  wordmark), `marek.png`/`anna.png` (master headshots), `favicon.png` (LB
  monogram, wired as the page favicon).
- `MasterSelector` and `BrandHeader` now render the real headshots instead of
  the initial-on-gradient placeholder (falls back to the initial if
  `master.avatar` is null — kept for future masters without a photo yet).
- New `LogoDisplay.tsx`, ported from the real component but simplified: the
  real one reads admin-configurable position/size/layer from `TenantConfig`
  (draggable in the "Customize" window, not built yet) with separate
  light/dark assets. This demo has one asset and uses the real component's
  own defaults (0%/0% corner position, 200×80, desktop-only) — into the
  corner space `TopNavLine` already reserves. Home page also gets the real
  mobile centered-logo block; the booking page (matching the real
  `[masterId]/page.tsx`) only gets the desktop corner one.
- Marquee photos (Home's `PhotoStrip`, Anna's `ReviewStrip`) are still
  placeholders — no salon-interior/work photos or review-avatar images sent
  yet.

**2026-08-14, fifth pass — theme-toggle icons.** User sent `Light.png`/
`Dark.png` (barber-pole artwork, unlit/lit) → `public/light.png`,
`public/dark.png`. `ThemeToggle.tsx` swapped from the placeholder sun/moon
SVGs to these, wired exactly where the real component's own fallback path
already points (`/light.png/dark.png` when no custom icon uploaded) — no new
logic needed, just supplying the assets the real code already expected.

**2026-08-14, sixth pass — theme icon 2x + real content wired in.**
- Theme icon adjusted twice more: first 3x (108px, user request) shifted the
  nav hairline down; user flagged it as overkill, reverted to 2x (72px) with
  no extra button padding, keeping the original `pt-*` clearance values
  untouched on Home/Booking — no layout side effects this time.
- Home's `PhotoStrip` marquee wired with 6 real salon-floor photos
  (`public/strip/home-1..6.png`); tile wrapper dropped its CSS border since
  each photo already has one baked in.
- Anna's `ReviewStrip` swapped from hand-built QuoteCard/GoogleReviewCard/
  MapCard components to 6 real review-card screenshots (Google, TripAdvisor,
  Instagram DM, SMS, etc. — `public/strip/anna-1..6.png`), same treatment.
- Marquee position fix: removed `mt-auto` (a literal port from the real
  `HomeClient.tsx`) since on a short master grid it pushed the strip to the
  very bottom of the viewport with a big empty gap — demo-specific deviation.
- Master-card captions on Home reverted to the short role/title (`master.title`)
  — an earlier pass had switched this to the full bio paragraph reasoning it
  matched real `getMasterBio` behavior; user confirmed that was wrong for
  this spot, full bio stays on the booking page only.
- **Real bug found and fixed: the booking page needed to scroll, calendar
  looked oversized.** Root cause: `react-day-picker` v9 (what's actually
  installed, matching the real app's own `^9.5.0`) renamed its CSS classes
  from what `globals.css`'s ported `.rdp-*` overrides assumed — in v9
  `.rdp-day` is just the grid cell, the clickable circle is a separate
  `.rdp-day_button` element, and old `classNames` prop keys (`table`,
  `head_cell`, `cell`) aren't real v9 keys (TypeScript still accepted them
  silently via a `DeprecatedUI` type-compat shim, but nothing at runtime
  reads them). Net effect: the calendar was rendering at react-day-picker's
  own *default* size/colors (44px cells, default blue accent) instead of the
  app's design, plus the reserved caption height wasn't fully collapsing —
  both inflating page height enough to force a scrollbar. Rewrote
  `DayCalendar.tsx`'s `classNames`/`modifiersClassNames` and `index.css`'s
  `.rdp-*` block against the actual v9 class names (verified directly against
  the installed package's type defs, not assumed from the ported file).

**2026-08-14, seventh pass — "About Us" page.**
- Added the real per-page nav-tab mechanism to `TopNavLine.tsx` (`tabs` prop,
  active-underline styling ported verbatim) — real component collapses tabs
  into a Radix dropdown below `lg` for an arbitrary page count; this demo
  only ever has one page ("About Us"), so that dropdown wasn't ported —
  showing the single tab inline at every breakpoint instead. Wired the tab
  into Home, Booking, and the legal pages (`LegalPageHeader`), matching real
  `TopNavLine` usage everywhere.
- New `AboutPage.tsx`, ported from the real `src/app/pages/[slug]/page.tsx`
  + `PageRenderer.tsx` (nav bar placement, staggered fade-in). Real content
  pages route through a generic `BlockRenderer`/Page-Block DB system; this
  demo has exactly one fixed page, so the intro paragraph + gallery render
  directly rather than through that indirection — nothing dynamic to route
  between. `PhotoGalleryRenderer.tsx` + `Lightbox.tsx` ported verbatim
  (grid + click-to-enlarge, swipeable). 6 real interior photos in
  `public/about/interior-1..6.png`. Copy text is the real intro paragraph
  from the reference (`demo.ordiset.com/pages/o-salonie`).
- **Found and fixed a real bug in the process**: running a build to verify
  this surfaced that the *main Salon Booking app's* `tsconfig.json` had no
  exclude entry for `demo-widget/` — Next.js's typecheck was pulling in this
  folder's `.tsx` files against demo-widget's own separate `node_modules`
  (different `csstype`, etc.), which broke the **main app's production
  build** (`npm run build` from repo root failed with a type conflict).
  Added `"demo-widget"` to the root `tsconfig.json`'s `exclude` array — one
  line, confirmed the main app builds clean again afterward. Unrelated to
  the Ordiset work itself, but real and worth knowing: verify next session
  whether this was already breaking CI/deploys before now.

Still deferred: the "Customize" admin/settings window.

Next: user checks the About Us page, the calendar height fix, and the
marquee content, then moves to the "Customize" admin window.
