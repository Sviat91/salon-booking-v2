# Plan: Admin Sidebar Collapse + TopBar (M3 Redesign Part 3, Stage 1)

Full context and rationale: see `/Users/sviat/.claude/plans/playful-humming-harbor.md` (approved plan). This file is the checkbox-tracked implementation summary for the coder agent.

Design source of truth: `Somique Beauty Design System/ui_kits/admin/index.html` (`Sidebar` + `TopBar` functions, lines 93-183) and `colors_and_type.css` (already matches `src/styles/m3-tokens.css` — reuse existing tokens, do not add new ones).

## Steps

- [x] Create `src/components/admin/adminNavItems.ts`: move `NavItem` type + `adminNavItems`/`superadminNavItems`/`masterNavItems` arrays verbatim out of `AdminSidebar.tsx`, plus new `getNavItemsForRole(role?)`, `isNavItemActive(item, pathname)`, `getPageTitle(pathname, role?)` helpers (fallback `"Admin"` if no match).
- [x] Create `src/components/admin/AdminTopBar.tsx`: `"use client"`, no props. Uses `usePathname()` + `useSession()` + `getPageTitle()` for the title. Right side: `Button variant="ghost" size="icon"` with `Search` and `Bell` (lucide-react) — decorative only, no `onClick`, no `disabled`. Then `Avatar`/`AvatarFallback` (`src/components/ui/avatar.tsx`) showing the first-letter initial of `session.user.name ?? session.user.email`. Header: `h-16 shrink-0 items-center justify-between border-b border-border bg-card px-6`.
- [x] Modify `src/app/admin/layout.tsx`: wrap `<main>` in a new `<div className="flex min-h-0 flex-1 flex-col overflow-hidden">` sibling of `<AdminSidebar>`, render `<AdminTopBar />` above `<main>`. Do NOT touch the `max-w-5xl px-6 py-8` inner content wrapper. Stays a Server Component — only new static JSX + one import.
- [x] Modify `src/components/admin/AdminSidebar.tsx`:
  - Import nav data/helpers from `adminNavItems.ts`, delete the local array definitions.
  - Add `const [open, setOpen] = useState(true)`.
  - Add hamburger toggle button in the header (lucide `Menu` icon, calls `setOpen(o => !o)`).
  - Add `NavLink({ item, open })` sub-component (single JSX tree for both states — icon always, label + chevron only when `open`, `title={!open ? item.label : undefined}` for native tooltip when collapsed).
  - **Do not** reuse `isNavItemActive` for "Back to site" (`href="/"`) — every path starts with `/`, so it would show as permanently active. Keep it a separate small block.
  - Apply `open`-conditional show/hide to: brand block (fully hidden when collapsed), Save Settings button (icon + tooltip when collapsed, not hidden), footer user-info box (collapses to just `<ThemeToggle />`), Sign Out (icon + tooltip when collapsed).
  - Outer `<aside>`: `open ? "w-60" : "w-[72px]"`, `transition-[width] duration-200 ease-out`, `overflow-hidden`. Each `NavLink` row: `overflow-hidden whitespace-nowrap`.
- [x] Verify line count of `AdminSidebar.tsx` stays under 500 lines (expected ~250-280). — actual: 197 lines.

## Verification

- [x] `npm run lint` — zero warnings (project's existing baseline, no new errors/warnings). Confirmed identical 775-problem baseline before/after (via `git stash` comparison); no errors in any touched file.
- [x] `rm -rf .next && npm run build` — clean build, Server/Client boundary in `layout.tsx` intact (no `useSession`/`usePathname` leaking into the Server Component).

Manual checks (report as a list for the user — do not attempt browser verification yourself beyond build/lint):
- [ ] Collapse/expand toggle, tooltips, active-item highlighting, "Back to site" never active, Save Settings conditional behavior, footer collapse, Sign Out, TopBar title per route for both SUPERADMIN and MASTER nav sets, avatar initial + fallback, Search/Bell inert, SUPERADMIN 11-item nav scroll at 72px, `<main>` independent scroll (`min-h-0` regression), dark mode token usage.
