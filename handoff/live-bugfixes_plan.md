# Plan: Live bugfixes found during Telegram bot manual testing

Two unrelated bugs found by the user while manually testing Group 1-3 of the Telegram bot. Root causes already diagnosed by the orchestrator — this is a mechanical fix pass, no architectural decisions needed.

## Bug 1 — Client bot doesn't start on cold server boot

**Root cause:** `instrumentation.ts` lives at the project root (`/instrumentation.ts`), but this project uses a `src/` directory for all app code (`src/app`, `src/lib`, etc.). Per Next.js's file-system conventions, when a project uses `src/`, the `instrumentation.ts` file must live at `src/instrumentation.ts`, not the project root — otherwise Next.js silently does not register it as the instrumentation hook. This means `register()` never runs on `next dev`/`next start` boot, so `startClientBot()` never fires automatically even when `TenantConfig.clientBotEnabled` is true. The bot only starts when the Settings page's PATCH route directly calls `restartClientBot()` on save — an unrelated code path that works because it's a plain function call, not dependent on Next's instrumentation discovery.

- [x] Move `/instrumentation.ts` to `/src/instrumentation.ts` (git mv, preserve content as-is — no logic change needed).
- [x] Update the file's top-of-file doc comment if it references the old root location.
- [x] Confirm `next.config.mjs`'s `experimental.instrumentationHook: true` still applies (it's not path-dependent, no change needed there).
- [x] Run `npx tsc --noEmit` and `npm run build` to confirm the moved file still compiles and Next.js's build output logs show the instrumentation hook being picked up (check build output for any instrumentation-related lines/errors).

**Manual verification (user):** stop the dev server completely, start it fresh (`npm run dev`), do NOT touch Settings, send `/start` to the bot (assuming it was already enabled+configured from a prior session) — it should respond immediately without needing to re-save Settings.

## Bug 2 — Booking calendar shows stale availability after admin schedule changes

**Root cause:** Not a server-side cache issue (`src/lib/availability.ts` and `GET /api/availability` do zero caching — always read live from the DB). It's client-side: `src/app/providers.tsx` sets a global React Query `defaultOptions.queries.staleTime: 10 * 60 * 1000` (10 minutes), and `src/components/DayCalendar.tsx`'s `useQuery` for `['availability', ...]` redundantly re-specifies the same 10-minute staleTime. Within that window, navigating back to a page with the same query key serves the cached (stale) result instead of refetching, so a newly-added schedule day doesn't appear until the 10 minutes elapse or a hard reload happens.

User's explicit direction: the DB is co-located on the same server, there's no meaningful request-volume concern for this app's scale, so prefer always-fresh data over a staleness window.

- [x] In `src/app/providers.tsx`, change `defaultOptions.queries.staleTime` from `10 * 60 * 1000` to `0`. Leave `gcTime` (30 min) untouched — that only controls how long unused/inactive query results are kept in memory for instant-paint-on-remount, it does not cause stale data to be *displayed* as current (React Query still refetches on mount when `staleTime` is 0, it just uses the cached value as an instant placeholder while the background refetch runs — no loading-spinner flash).
- [x] In `src/components/DayCalendar.tsx`, remove the now-redundant explicit `staleTime: 10 * 60 * 1000` from its `useQuery` call (it would just duplicate the new global default of `0` — dead configuration, remove it rather than leave a misleading stale-looking value).
- [x] Grep the codebase for any other `useQuery` call that explicitly sets its own `staleTime` (there may be others besides `DayCalendar.tsx`) — do NOT change those unless they're also just redundantly re-stating the old global 10-minute default; if any query has an intentionally *different* staleTime for a specific reason, leave it alone and note it in the report.
- [x] Run `npx tsc --noEmit`, `npm run lint`, and `npx vitest run` to confirm nothing depends on the old staleTime behavior.

**Manual verification (user):** on the admin calendar, add a new working day/schedule for a master. Without waiting, navigate to that master's public booking page (or back to it from elsewhere) — the newly available day should appear immediately, no reload needed.

## Bug 2 (continued) — Next.js's own Client-side Router Cache is a separate layer, still stale after the React Query fix

**Root cause:** the previous fix (`staleTime: 0` in React Query) only addresses the *data* layer. Next.js App Router has its own, entirely separate *navigation* cache — the Client-side Router Cache — that reuses a previously-rendered route segment (including its live client-component tree and React state/hooks, e.g. `DayCalendar`'s mounted React Query subscription) for a period after leaving it, instead of a fresh mount. Default retention: 30s for `<Link>` without explicit `prefetch`, 5 minutes for `<Link prefetch={true}>` (viewport-triggered auto-prefetch also applies). `src/components/BackButton.tsx` uses a plain `<Link href="/">`, and the master-selection links on the homepage likely also use `<Link>` — navigating away from `/[masterId]` and back within that window reuses the cached client tree, so `DayCalendar`'s query observer is never unsubscribed/remounted and never refetches, regardless of `staleTime`. This explains exactly the reported symptom: a hard reload (F5) bypasses this cache entirely and shows fresh data; in-app navigation does not.

User's direction (same as Bug 2 above) applies here too: prefer always-fresh navigation over any retention window.

- [x] In `next.config.mjs`, add `staleTimes: { dynamic: 0, static: 0 }` under the existing `experimental` block (alongside `instrumentationHook: true` and `serverComponentsExternalPackages`) — this is Next 14.2's officially documented, supported config option to disable the Client-side Router Cache's retention window entirely, for both dynamic and static route segments.
- [x] Do not touch `BackButton.tsx` or any `<Link>` usage — the `staleTimes` config is the correct single point of control, no need to hunt down/change individual `prefetch` props across the app.
- [x] Run `npx tsc --noEmit`, `npm run lint`, `npm run build` to confirm the config change is valid and doesn't break the build.

**Manual verification (user):** on the admin calendar, add a new working day for a master. Navigate via normal in-app links (not F5) — e.g. Back button to homepage, then into that master's booking page again (or however the user normally navigates) — the new day should now appear without needing a hard reload.

## Constraints
- Surgical fixes only — no refactors, no unrelated cleanup, no new abstractions.
- Do not touch any Telegram bot Group 4/5 content — these are unrelated live bugs found during manual testing, not part of the bot plan.
- Files must stay under 500 lines (neither touched file is near that limit; no risk here).
- Do NOT run `npm run dev` or any long-running server — the user tests manually.
