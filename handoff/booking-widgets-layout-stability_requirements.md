# Requirements: stabilize booking-page widget sizing (layout jitter fix)

## Reported by user (2026-09-22)
On the client-facing booking page (`/[masterId]`), widgets visibly resize/jitter during normal
use: reported specifically around the procedure-selection widget while procedures are loading,
and around the "manage my booking" panel (`BookingManagement`) as it cycles through its search
flow. User's words (informal voice dictation, translated): "widgets are floating/moving around,
the box narrows then widens." Confirmed NOT a dev-cache artifact — persists after a clean
`rm -rf .next && npm run dev` restart. User suspects the widgets simply have no fixed size and
wants them stabilized for both mobile and desktop.

## Root cause found by the orchestrator (verify, don't just trust)
`BookingManagement.tsx` renders `PanelRenderer.tsx`, which switches between ~19 panel components
(`SearchPanel`, `LoadingPanel`, `ResultsPanel`, `EditSelectionPanel`, `EditDatetimePanel`,
`ConfirmTimeChangePanel`, `ConfirmCancelPanel`, `NoResultsPanel`, `ErrorFallbackPanel`,
`DirectTimeChangePanel`, `TimeChangeSuccessPanel`, `TimeChangeErrorPanel`, `CancelSuccessPanel`,
`CancelErrorPanel`, `EditProcedurePanel`, `ProcedureChangeSuccessPanel`,
`ProcedureChangeErrorPanel`, `ContactMasterPanel`, `ContactMasterSuccessPanel`) depending on
`state.state` — each with a wildly different natural content height (`LoadingPanel` = 3 skeleton
rows of `h-16` + a text line; `SearchPanel` = a compact name+phone form; `ResultsPanel` = a
variable-length list of found bookings, unbounded). The wrapping container in
`BookingManagement.tsx` (around line 219-224) applies
`transition-all duration-200 ease-out` to the panel wrapper on every state change (open/close AND
every panel switch inside `PanelRenderer`), which animates height across these very different
content shapes — that's the visible "shrink then grow" jitter.

`ProcedureSelect.tsx` is a single-row dropdown button; investigate whether its closed-state text
(`whitespace-normal break-words` on a selected long procedure name) can wrap to two lines where
the loading/placeholder state was one line, causing a secondary height jump — confirm or rule
this out empirically rather than assuming.

## Prior related attempt — DO NOT blindly repeat
ROADMAP.md, session 2026-07-28: an earlier attempt to fix a related jitter (same widgets,
triggered by language switching) used a `min-height` + layout-animation approach. The user tested
it live and **reverted it as unsuccessful**. No further technical detail on the failure mode is
recorded. Do not restore that reverted approach — if `min-height` is part of the new solution, it
must be a genuinely different, better-reasoned design (e.g. sized correctly per breakpoint, or
combined with removing the height animation itself), not a retry of the same thing.

## Orchestrator's hypothesis (for planner to validate or reject)
A fixed universal height cannot work well here — `ResultsPanel` is inherently unbounded (a client
can have any number of bookings) and `SearchPanel`/`LoadingPanel` are much shorter; forcing one
fixed height either truncates tall content or wastes visible space on short content. The more
promising direction may be to stop *animating* the height transition between these structurally
different panels (keep only a content fade, snap the container size instantly) rather than trying
to find one "correct" fixed size — animating a height swing across dramatically different content
shapes is arguably what makes it *look* jittery in the first place, independent of whether a
min-height floor exists. A small min-height may still help only for the tightest transitions
(e.g. the initial open, or loading↔results) to avoid a jarring near-zero-height flash. **This is
a hypothesis, not a mandate — the planner should investigate and decide the actual approach.**

## Constraints
- Must work correctly on both mobile (`<lg`) and desktop (`lg:` breakpoint) — this page has
  distinct mobile/desktop layouts (`lg:order-1`/`lg:order-2` column reordering in
  `src/app/[masterId]/page.tsx`).
- Files affected are on the highest-traffic, most business-critical page in the app (the actual
  client booking flow) — changes here carry above-average regression risk. Scope changes
  narrowly; do not restructure `PanelRenderer`'s state machine or `useBookingManagementState`
  logic, only the container/sizing/transition behavior around it.
- `src/components/booking-management/AGENTS.md` and `src/components/AGENTS.md` govern this
  subtree — read them before planning.
- Respect the existing file-size cap (500 lines); none of the touched files are currently close
  to it, but don't let a fix balloon `BookingManagement.tsx` (currently 297 lines) unnecessarily.
- No new dependencies without checking `package.json` first.

## Explicitly out of scope
- The admin-side calendar/settings pages — already checked, not the source of this report.
- Any change to booking business logic (search/edit/cancel flows) — sizing/animation only.

## Deliverable
`handoff/booking-widgets-layout-stability_plan.md` with a decomposed, checkbox-based plan for the
coder, including how it will be manually verified (this can't be unit-tested meaningfully — it's
a visual/CSS behavior; the plan should state what the user should check live: opening/closing the
panel, running a search that hits each of `results`/`not-found`, switching between panels on both
a narrow and a wide viewport).
