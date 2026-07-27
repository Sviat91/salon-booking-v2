# Round 2 — Group 3: Fade widget fixes — Review

## Verdict: APPROVED

No Critical/Architectural issues. No Minor/Syntax issues.

### Passed Checks

- `SLOT_COUNT = 5` fixed constant, used unconditionally in both branches — no
  `Math.min` against `photos.length` remains.
- Every tile wrapper uses `aspect-[4/5] w-full`; outer grid containers no
  longer carry `h-40`.
- `<AnimatePresence>` in `FadeSlot` has no `mode="wait"` — defaults to
  `mode="sync"`, giving a true overlapping crossfade.
- Fade transition duration is `1.5`; `CYCLE_MS` is `4500`.
- Reduced-motion branch pads to `SLOT_COUNT` via `i % photos.length`
  indexing, not `.slice(0, slotCount)`.
- Scope respected — only `FadeWidget.tsx` modified.
- Crossfade correctness verified: `key={index}` under `mode="sync"` is the
  standard framer-motion cross-element pattern — outgoing element plays exit
  while incoming plays enter concurrently, both `absolute inset-0` inside a
  `relative overflow-hidden` parent, no layout shift or key-collision risk.
- `photos.length <= 1` interval guard still correct — evaluated against the
  real photo pool, independent of `SLOT_COUNT`.
