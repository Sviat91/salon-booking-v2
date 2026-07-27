# Round 2 — Group 2: Strip widget full-bleed — Review

## Verdict: APPROVED

No Critical/Architectural issues. No Minor/Syntax issues.

### Scope/diff check

Only `StripWidget.tsx` was touched. Both wrapper divs (reduced-motion static
branch line 23, animated marquee branch line 42) carry exactly
`relative left-1/2 w-screen -ml-[50vw]` appended to their pre-existing
classes, with no `w-full`/`w-screen` conflict remaining (orchestrator removed
the coder's redundant `w-full` before review). The animation
(`x: ["0%", "-33.33%"]`, duration math), the tripled `content` array, the
inner `motion.div`, and its `px-4` gutter are all byte-for-byte unchanged.
`HomeClient.tsx`, `MasterFooterBlock.tsx`, `[masterId]/page.tsx`, and
`PageRenderer.tsx` confirmed untouched.

### Correctness of the breakout technique — traced all three real contexts

- **Home (`HomeClient.tsx`):** `<main>` has no `max-w`/`overflow-x-hidden` —
  parent already ≈ viewport width, breakout is a safe no-op.
- **Content pages** (`app/pages/[slug]/page.tsx`,
  `app/[masterId]/pages/[slug]/page.tsx`): `<main>` has no
  `overflow-x-hidden` — no clipping risk regardless of the math.
- **Master footer** (`[masterId]/page.tsx`): the one context where `<main>`
  *does* carry `overflow-x-hidden`. Verified this doesn't clip the breakout:
  `<main>` sits directly inside unpadded, unconstrained wrapper divs from
  `layout.tsx`, so `<main>`'s border-box spans the true viewport edge-to-edge.
  Its padding is symmetric, so the nested `mx-auto max-w-5xl` container stays
  centered relative to the full viewport. `left-1/2 -ml-[50vw]` therefore
  resolves to exactly 0–100vw, coinciding with (not exceeding) `<main>`'s own
  clip boundary — no clipping occurs.

Confirmed `src/styles/globals.css` lines 15-31 set `overflow-x: hidden` on
both `html` and `body`, preventing any page-level horizontal scrollbar from
the `100vw` element in all three contexts.

### Not independently re-run by reviewer (no Bash access in that role)

`npx tsc --noEmit` / `npm run lint` — re-run by orchestrator after review,
see below.
