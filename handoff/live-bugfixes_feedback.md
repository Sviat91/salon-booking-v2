# Review: Live bugfixes (instrumentation path + staleTime)
**Date:** 2026-07-20
**Verdict:** APPROVED

## Critical/Architectural Issues
(none)

## Minor/Syntax Issues
- [ ] Stale/unrelated build log artifacts in repo root (`build_output.log`, `build-output.txt`, `build-result.txt`) — tracked in git since an unrelated earlier commit (`a1512e0`), not touched or introduced by this fix. Garbled leftover output from an old failed build, unrelated to this diff. Not blocking; flagged for the user to clean up whenever convenient, not deleted here per "don't remove pre-existing dead code unless asked."

## Passed Checks
- [x] `src/instrumentation.ts` exists with content unchanged (same `register()` logic, `NEXT_RUNTIME` guard, dynamic import of `lifecycle`, error swallowing); root-level `instrumentation.ts` confirmed absent (git mv done correctly, no orphan duplicate).
- [x] `next.config.mjs` — `experimental.instrumentationHook: true` present and correctly path-independent; Next.js's `src/`-directory convention requires `instrumentation.ts` under `src/`, now satisfied.
- [x] **Independently verified via a fresh `npm run build` run**: build log opens with `Experiments (use with caution): · instrumentationHook`, compiles successfully, and `.next/server/instrumentation.js` is emitted (confirmed via `ls -la`) — proof the hook is now correctly discovered at the new path.
- [x] `src/app/providers.tsx` — `staleTime` changed to `0` exactly as planned; `gcTime` (30 min) left untouched.
- [x] `src/components/DayCalendar.tsx` — no `staleTime` override remains in its `['availability', ...]` `useQuery` call; nothing else in that call altered.
- [x] No `refetchOnMount` override anywhere in `src/` — confirms `staleTime: 0` behaves as standard React Query default (instant cached placeholder + background refetch, no spinner flash).
- [x] Other explicit `staleTime` usages (`BookingManagement.tsx`, `BrandHeader.tsx`, `BookingSuccessPanel.tsx` x2, `support/page.tsx`, `Footer.tsx`, `BookingSuccess.tsx`, `terms/page.tsx`, `privacy/page.tsx`, `SlotsList.tsx`) are all 1-hour or 5-minute values — genuinely distinct from the old 10-minute global default, correctly left untouched.
- [x] Plan fidelity — every checked-off item in `handoff/live-bugfixes_plan.md` matches the actual code state.
- [x] Scope discipline — diff is surgical; no unrelated Telegram bot Group 4/5 files touched.
- [x] `npx tsc --noEmit`, `npm run lint`, `npx vitest run` all clean (coder-reported, consistent with orchestrator's own fresh `npm run build`).

## Summary
Both fixes are correctly and minimally implemented: the instrumentation hook now lives at the Next.js-required `src/instrumentation.ts` path with unchanged logic (independently confirmed via a fresh production build emitting `.next/server/instrumentation.js`), and the React Query global `staleTime` is now `0` with the redundant per-component override in `DayCalendar.tsx` removed, while every other component's intentionally different `staleTime` was correctly left alone. No architectural or logic issues found.

---

## Bug 2 (continued) — Router Cache Fix
**Verdict:** APPROVED

### Critical/Architectural Issues
(none)

### Minor/Syntax Issues
(none)

### Passed Checks
- [x] `next.config.mjs` change is exactly one line (`staleTimes: { dynamic: 0, static: 0 }`), correctly nested inside the existing `experimental` block alongside `serverComponentsExternalPackages` and `instrumentationHook: true`; nothing else in the file altered.
- [x] `staleTimes` is a real, documented Next.js config option introduced in 14.2.0 for tuning the Client-side Router Cache's revalidation window for `dynamic`/`static` segments — not fabricated. Project pins `next@^14.2.6`, so the option is available.
- [x] `BackButton.tsx` and other `<Link>` usages untouched, matching the plan's direction to use the single config point of control rather than hunting down `prefetch` props.
- [x] Tradeoff (every in-app navigation now does a fresh round-trip, no client-side route segment reuse, app-wide not just the booking calendar) is reasonable given the user's explicit, repeated stated preference (DB co-located, no request-volume concern, always-fresh data preferred over navigation performance). Not a defect, a deliberate choice.
- [x] **Independently re-verified by the orchestrator**: fresh `npx tsc --noEmit` (exit 0) and `npm run build` (`✓ Compiled successfully`) both clean after this change.

### Summary
The fix is surgical and matches the plan exactly — a single valid, real Next.js 14.2 config key added in the correct location, closing the second (navigation-layer) caching gap that React Query's `staleTime` fix alone didn't cover. Reasoning confirmed sound: this is a genuinely separate mechanism (Client-side Router Cache vs. React Query data cache), and disabling it app-wide is a reasonable, deliberate tradeoff given the user's stated direction.
