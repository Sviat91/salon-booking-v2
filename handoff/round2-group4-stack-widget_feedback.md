# Round 2 — Group 4: Stack widget rewrite — Review

## Verdict: APPROVED

No Critical/Architectural issues. No Minor/Syntax issues.

### Passed Checks

- `getGroupSize`/`CANDIDATE_GROUP_SIZES`/`MAX_STACKS_PER_ROW` match plan
  exactly and drive `groups` computation.
- `Stack` collapsed branch: single-button pile, `MAX_PILE_VISIBLE` cap,
  unchanged `ROTATIONS` transform math.
- `Stack` expanded branch: JSX matches plan verbatim (z-30 overlay,
  `onCollapse`, `stopPropagation`, max-width/overflow).
- Parent state wiring: single `expandedGroup` index auto-collapses the
  previous stack; `Lightbox` gets the full `photos` array + correct global
  index.
- Row layout has no `justify-center` (avoids the flexbox center+overflow
  clipping quirk).
- `photos.length === 0` early return preserved.
- 1-2 photo edge cases produce sane, non-empty, non-infinite grouping; large
  counts (1000+) correctly fall through to the `Math.ceil` fallback,
  producing exactly 6 groups.
- z-30 stacking-context claim verified architecturally sound — sibling
  `Stack` wrappers have no `z-index`/`transform`/`opacity` to trap the
  overlay in an isolated stacking context.
- stopPropagation click-to-collapse UX works as intended (background/gap
  clicks collapse, photo clicks don't).
- `PhotoWidgetRenderer.tsx` usage of `StackWidget` unaffected.
- Orchestrator confirmed via `git status --porcelain`: only
  `StackWidget.tsx` modified — full scope containment verified.
