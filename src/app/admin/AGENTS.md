# AGENTS.md — src/app/admin

## Purpose

Salon management dashboard. Two role-scoped surfaces share this tree: full management for `ADMIN`/`SUPERADMIN` (masters, services, all schedules, all appointments, database/GDPR tools, tenant settings), and a restricted self-service view for `MASTER` under `admin/master/` (own schedule, own overrides, own appointments).

## Ownership

Dashboard page composition and role-gated views. Data mutations go through `src/app/api/admin/**` and `src/app/api/master/**`; this folder only renders and calls those endpoints.

## Local Contracts

- Every page here is a Server Component that calls `auth()` and redirects to `/auth/login` if `session.user.role` doesn't match what the page requires — `admin/master/*` pages check for `"MASTER"` specifically, top-level `admin/*` pages check for `"ADMIN"`/`"SUPERADMIN"`. `src/middleware.ts` provides a first-pass guard, but pages must not skip their own check.
- Fine-grained ADMIN permissions (client data view/edit/delete, GDPR view/withdraw/erase) come from `src/lib/admin-permissions.ts` — gate UI affordances (buttons, tabs) on the parsed permission object, not on role alone.
- `settings/` (email, notifications, social, OAuth/SMTP credentials) writes to the single `TenantConfig` row — encrypted fields (OAuth secrets, SMTP password) must pass through `src/lib/encryption.ts` before persisting; never render decrypted secrets back into the page.
- `database/gdpr/` triggers erasure/withdrawal flows — these are irreversible for the affected user; confirm-before-submit UX must not be removed.

## Work Guidance

- Reuse `AdminSidebar` (`src/components/admin/AdminSidebar.tsx`) for navigation; don't hand-build a second sidebar for a new section. Nav items (label/href/icon/role) live in `src/components/admin/adminNavItems.ts` — add a new route there and both the sidebar and `AdminTopBar`'s page title pick it up automatically; don't hardcode a title in the page itself.
- `src/app/admin/layout.tsx` renders `AdminSidebar` + `AdminTopBar` around `{children}`; the sidebar collapses (240px⇄72px) via its own local state, `AdminTopBar` needs no props and no wiring from individual pages.
- Keep page files under 500 lines — split list/detail/form pieces into `src/components/admin/` or co-located client components as this folder already does (e.g. `admin/master/AppointmentsList.tsx`).
- Dashboard stat cards use `src/components/admin/StatCard.tsx` (`tone: "primary" | "secondary" | "tertiary" | "surface-high"`, mapped to the raw `--md-*-container` vars, not the tenant-customizable `bg-primary`/`bg-accent`/etc). Appointment status pills use the shared `src/components/admin/AppointmentStatusBadge.tsx` everywhere a status is rendered (`admin/page.tsx`'s `TodaysAppointmentsTable` and `admin/master/AppointmentsList.tsx`) — don't hand-roll a new status→color mapping.

## Verification

- Manually verify role gating after auth changes: log in as `MASTER` and confirm `admin/*` (non-`master/`) routes redirect; log in as `ADMIN` without a permission and confirm the corresponding action is hidden/blocked.
