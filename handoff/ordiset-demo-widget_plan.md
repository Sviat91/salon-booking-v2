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

Still deferred: the "Customize" admin/settings window, real photos (still
gradient+initials placeholders — user will supply these next).

Next: user runs `cd demo-widget && npm run dev` and checks the new pages +
persistent booking flow, then moves to sending real photos, then the
"Customize" admin window.
