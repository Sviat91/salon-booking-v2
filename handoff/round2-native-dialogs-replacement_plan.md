# Plan: Replace native `confirm()` / `alert()` with styled in-app dialogs and toasts

**Date:** 2026-07-27
**Status:** Complete — all 10 steps implemented and verified

## Goal

Replace all 11 native `window.confirm()` call sites with one shared, themed, i18n-aware `AlertDialog` reached through a global `useConfirm()` hook, and all 7 native `alert()` call sites with `toast.error()` — which first requires mounting sonner's `<Toaster />` (never mounted today, so every existing `toast.*()` call in the app is currently a silent no-op).

## Architecture Decisions

### AD-A — Mounting `<Toaster />` is a prerequisite bug fix, not optional polish

Grep-verified: `src/` contains **19** `toast.success/error(...)` calls across 5 files (`components/admin/EmailSettingsForm.tsx`, `components/admin/SocialSettingsForm.tsx`, `app/admin/settings/notifications/NotificationSettingsForm.tsx`, `app/admin/settings/notifications/TelegramRecipientsField.tsx`, `app/admin/settings/client-bot/ClientBotSettingsForm.tsx`) and **zero** occurrences of `Toaster` anywhere. `sonner@^2.0.7` is a real dependency (`package.json:48`). Without a mounted `<Toaster />`, `toast.*()` pushes to sonner's store and nothing renders. So Step 4/5 fix a live pre-existing bug *and* unblock the `alert()` → toast conversion. Sonner injects its own CSS at import time and guards on `typeof document == 'undefined'` (`node_modules/sonner/dist/index.mjs:2-9`) — **no CSS import is needed and it is SSR-safe.**

### AD-B — `@base-ui/react/alert-dialog` real API surface (read, not guessed)

`node_modules/@base-ui/react/alert-dialog/index.d.ts` does `export * as AlertDialog from "./index.parts.js"`, and `index.parts.d.ts` exports exactly:

`Root` (own `AlertDialogRoot`), `Backdrop`, `Close`, `Description`, `Popup`, `Portal`, `Title`, `Trigger`, `Viewport` (all re-exported from `../dialog/*`), plus `createHandle` / `Handle`.

Import shape mirrors `dialog.tsx`: `import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"`. The `.Props` namespace types survive the re-export (`export { DialogBackdrop as Backdrop }` re-exports value + namespace), so `AlertDialogPrimitive.Backdrop.Props`, `.Popup.Props`, `.Title.Props`, `.Description.Props`, `.Close.Props`, `.Portal.Props`, `.Trigger.Props`, `.Root.Props` all resolve — same as `dialog.tsx` does today.

Semantics that make this the right primitive (from `root/AlertDialogRoot.d.ts:13`): `AlertDialogRootProps` **omits** `modal` and `disablePointerDismissal` from `DialogRootProps`. The alert dialog is therefore always modal and **cannot be dismissed by an outside click** — exactly the "must make an explicit choice" behaviour a destructive confirm needs, and the reason not to reuse `Dialog`. `onOpenChange`, `onOpenChangeComplete`, `actionsRef`, `open`, `defaultOpen`, `children` are all available.

### AD-C — Mirror `dialog.tsx`'s structure, but write the variants in **Tailwind v3** syntax

The project is on **Tailwind v3** (`tailwind.config.ts` + `tailwindcss@^3.4.10` + `tailwindcss-animate`). `src/components/AGENTS.md` (bullet 25) makes this an explicit contract for new `ui/` primitives: *"use base-ui's `data-[open]`/`data-[closed]` arbitrary-attribute variants … not v4-only syntax (`data-open:`, `(--x)`, `outline-hidden`, `**:`)."*

`dialog.tsx`/`sheet.tsx` predate that contract and use v4-only variants (`data-open:animate-in`, `data-ending-style:`, `supports-backdrop-filter:`, `backdrop-blur-xs`) which Tailwind v3 silently drops. `dropdown-menu.tsx:44` is the canonical **working** v3 pattern (`data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95 data-[closed]:animate-out …`).

**Decision:** `alert-dialog.tsx` copies `dialog.tsx`'s component decomposition, `data-slot` naming, `cn()` usage, layout/spacing/color classes **verbatim**, but writes every state variant in `dropdown-menu.tsx`'s v3 form. This is not a fork of the pattern — it is the pattern, spelled correctly for this Tailwind version. **Do not "fix" `dialog.tsx`/`sheet.tsx` as part of this work** (pre-existing, out of scope — mention only).

### AD-D — One global `ConfirmDialogProvider` + `useConfirm()`, not 10 local dialogs

Chosen: a single provider mounted in `src/app/providers.tsx` exposing `confirm(message, options?): Promise<boolean>`, backed by one `AlertDialog` instance driven by a promise-resolver held in a ref.

Why, concretely:
- **Boilerplate**: the local-state alternative needs, at each of 10 files, a `pendingTarget` state, an open/close state, ~20 lines of dialog JSX and a split of the handler into "ask" + "actually do it". That is ~250 duplicated lines against ~80 lines written once.
- **Three of the call sites would need real restructuring**, not a mechanical edit: `ServicesClient.tsx`, `MastersClient.tsx` and `PageListClient.tsx` wrap their delete in `useCallback` + `startTransition`, and `MastersClient` also carries a `name` argument used to build the message. Keeping `if (!(await confirm(msg))) return` at the top of the existing handler preserves each handler's shape exactly.
- **Correct z-order / a11y in one place**, and `DbBrowserClient.tsx`'s table has no natural place to host per-row dialog JSX.
- Cost: one React context and one always-mounted (but closed → fully unmounted content) `AlertDialog` at the app root. Negligible.

Concurrency: a second `confirm()` while one is pending resolves the first with `false` and supersedes it. This can only happen programmatically — the open dialog is modal and traps focus.

### AD-E — Hook API

```ts
type ConfirmOptions = {
  title?: string          // default: t('common.confirmTitle')
  confirmLabel?: string   // default: t('common.confirm')
  destructive?: boolean   // default: true
}
type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>
```

- `message` is **already translated by the caller** (`t('admin.masters.deleteConfirm', { name })`), exactly like the argument passed to `window.confirm` today. The dialog owns no translation logic beyond its own static chrome. This keeps the conversion a one-line edit at all 11 sites: `if (!confirm(X)) return` → `if (!(await confirm(X))) return`.
- `options` is a **second, optional** parameter (not a `string | object` union) so there is no `typeof` branch and every current call site passes nothing.
- `destructive` defaults to `true` because all 11 current uses are delete / erase / cancel actions; `destructive: false` exists as the escape hatch and is currently unused.

### AD-F — i18n: reuse `common.*`, add exactly two keys

Verified present in all three locale files (`pl.json`/`en.json`/`uk.json`, `common` block at lines 44-60, identical structure):
`common.cancel` (Anuluj / Cancel / Скасувати) and `common.confirm` (Potwierdź / Confirm / Підтвердити) — **reuse both, invent nothing.**

Two genuinely new keys:
- `common.confirmTitle` — the dialog heading (native `confirm()` had no title; an `AlertDialog` needs one for `aria-labelledby`).
- `common.notifications` — sonner's `containerAriaLabel`, whose library default is the hardcoded English string `"Notifications"`. The project forbids hardcoded user-facing strings, and this one is read aloud by screen readers.

Deliberately **not** added: a close-button label. `<Toaster closeButton>` is left off (toasts auto-dismiss and are swipe-dismissible), which avoids a third key for `closeButtonAriaLabel`.

### AD-G — Mount point: `src/app/providers.tsx`, inside `LanguageProvider`

`src/app/layout.tsx:150` wraps everything (public site **and** `/admin/**`, since `src/app/admin/layout.tsx` is nested inside it) in `<Providers>`. Both new components call `useTranslation()`, so both must sit **inside** `LanguageProvider` (which owns `i18n.changeLanguage`). One mount covers all 18 call sites plus the 19 already-broken `toast.*()` calls.

### AD-H — `z-[100]` for the confirm dialog, not `z-50`

`dialog.tsx`/`sheet.tsx` use `z-50`, but `ViewAppointmentModal.tsx:55` already renders at `z-[60]` and `BulkSettingsModal.tsx:220` at `z-50`. A *global* confirm must never be occluded by whatever is on screen when it is invoked. Deliberate, documented deviation; applies only to `alert-dialog.tsx`.

### AD-I — `whitespace-pre-line` on the description

`admin.gdpr.eraseConfirm` contains a literal `\n\n` (`en.json:283`) which `window.confirm` rendered as a paragraph break. HTML collapses it. The provider therefore renders `<AlertDialogDescription className="whitespace-pre-line">`. Applied at the provider, **not** baked into the primitive.

### AD-J — The regression guard is an ESLint rule, not a Vitest test

`vitest.config.ts` sets `environment: 'node'`; there is no jsdom, no `@testing-library/*` in `devDependencies`, and `src/components/AGENTS.md:34` states there is no component test layer. A React dialog/provider cannot be unit-tested here, and a regex-based source scan cannot work either: the new `await confirm(msg)` is textually indistinguishable from `window.confirm(msg)`.

ESLint's `no-alert` **can** tell them apart — it skips identifiers that resolve to a local binding (`isShadowed`), and `const confirm = useConfirm()` is exactly that. So `'no-alert': 'error'` is added to `eslint.config.js`; it permanently bans `alert`/`confirm`/`prompt` (bare or `window.`-qualified) while leaving the new hook untouched. Grep-verified there are zero other `alert`/`confirm`/`prompt` calls in `scripts/` or `tests/`.

**No new test file. `npm run test` must simply stay green** (nothing under `tests/` imports any touched file).

### AD-K — Explicitly out of scope

- **Do not** convert `ViewAppointmentModal.tsx`'s existing in-component `showDeleteConfirm` state (`:25`) to `useConfirm()` — it is already a styled in-app confirmation, not a native dialog. Only its `alert()` on line 47 changes.
- **Do not** touch `BookingConsentModal.tsx`, `DataErasureModal.tsx`, `ConsentWithdrawalModal.tsx` or any other hand-rolled modal.
- **Do not** retrofit `dialog.tsx` / `sheet.tsx` to v3 variant syntax (pre-existing; AD-C).
- **Do not** change any of the 19 existing `toast.*()` call sites — mounting `<Toaster />` is the whole fix they need.
- **Do not** convert the remaining inline error surfaces (`setError(...)` in `ClientsTable`, `DbBrowserClient`, `PageBlocksEditor`) to toasts. They are not native dialogs.

## Implementation Steps

- [x] **Step 1: i18n keys (all three locale files, same insertion point)**
  - Files: `src/locales/pl.json`, `src/locales/en.json`, `src/locales/uk.json`
  - Details: the `common` block is at lines 44-60 in all three, with identical key order. Insert **immediately after** the existing `"confirm"` line (line 47) in each:
    - `confirmTitle` — pl `"Czy na pewno?"`, en `"Are you sure?"`, uk `"Ви впевнені?"`
    - `notifications` — pl `"Powiadomienia"`, en `"Notifications"`, uk `"Сповіщення"`
  - Do **not** rename, move or remove `common.cancel` / `common.confirm` — both are reused as-is (and `common.cancel` has other consumers).

- [x] **Step 2: New shared primitive `alert-dialog.tsx`**
  - Files: `src/components/ui/alert-dialog.tsx` (new, ~120 lines)
  - Details: `"use client"`, `import { AlertDialog as AlertDialogPrimitive } from "@base-ui/react/alert-dialog"`, `cn` from `@/lib/utils`, `Button` from `@/components/ui/button`. Structure copies `src/components/ui/dialog.tsx` one-for-one, minus the `showCloseButton` X (an alert dialog must be resolved by an explicit choice) and minus `DialogFooter`'s `showCloseButton` prop.
    ```tsx
    function AlertDialog({ ...props }: AlertDialogPrimitive.Root.Props) {
      return <AlertDialogPrimitive.Root data-slot="alert-dialog" {...props} />
    }
    function AlertDialogTrigger({ ...props }: AlertDialogPrimitive.Trigger.Props) { /* data-slot="alert-dialog-trigger" */ }
    function AlertDialogPortal({ ...props }: AlertDialogPrimitive.Portal.Props) { /* data-slot="alert-dialog-portal" */ }
    function AlertDialogClose({ ...props }: AlertDialogPrimitive.Close.Props) { /* data-slot="alert-dialog-close" */ }
    ```
  - `AlertDialogOverlay` — `AlertDialogPrimitive.Backdrop`, `data-slot="alert-dialog-overlay"`, className:
    ```
    fixed inset-0 isolate z-[100] bg-[var(--md-scrim,rgba(0,0,0,0.32))] duration-100 supports-[backdrop-filter]:backdrop-blur-sm data-[open]:animate-in data-[open]:fade-in-0 data-[closed]:animate-out data-[closed]:fade-out-0
    ```
  - `AlertDialogContent({ className, children, ...props }: AlertDialogPrimitive.Popup.Props)` — renders `<AlertDialogPortal><AlertDialogOverlay /><AlertDialogPrimitive.Popup data-slot="alert-dialog-content" …>{children}</…></AlertDialogPortal>`, className:
    ```
    fixed top-1/2 left-1/2 z-[100] grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 gap-4 rounded-xl bg-popover p-4 text-sm text-popover-foreground shadow-lg duration-100 outline-none sm:max-w-sm data-[open]:animate-in data-[open]:fade-in-0 data-[open]:zoom-in-95 data-[closed]:animate-out data-[closed]:fade-out-0 data-[closed]:zoom-out-95
    ```
  - `AlertDialogHeader` / `AlertDialogFooter` — plain `React.ComponentProps<"div">`, classNames copied verbatim from `dialog.tsx:87` and `dialog.tsx:105`:
    - header: `flex flex-col gap-2`
    - footer: `-mx-4 -mb-4 flex flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end`
  - `AlertDialogTitle` (`text-base leading-none font-medium`) and `AlertDialogDescription` (`text-sm text-muted-foreground`) — copied verbatim from `dialog.tsx:120-147` (drop the `*:[a]:*` link rules from the description; confirm messages contain no links).
  - Export `{ AlertDialog, AlertDialogClose, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogOverlay, AlertDialogPortal, AlertDialogTitle, AlertDialogTrigger }`.
  - Add a short header comment recording AD-C (v3 variant syntax) and AD-H (`z-[100]`) so neither reads as an accident.
  - `AlertDialogTrigger` is exported for completeness/parity with `dialog.tsx` but is **not** used by this feature (the provider drives `open` in controlled mode).

- [x] **Step 3: `ConfirmDialogProvider` + `useConfirm()`**
  - Files: `src/components/ConfirmDialogProvider.tsx` (new, ~90 lines)
  - Placement rationale (state it in the file's doc comment): `src/contexts/` holds framework-state-only providers that render no DOM (`LanguageContext.tsx`, `MasterContext.tsx`); this one renders a portalled dialog and imports `ui/` primitives, so it belongs under `src/components/`.
  - Details:
    ```tsx
    "use client"
    import * as React from "react"
    import { useTranslation } from "react-i18next"
    import {
      AlertDialog, AlertDialogClose, AlertDialogContent, AlertDialogDescription,
      AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
    } from "@/components/ui/alert-dialog"
    import { Button } from "@/components/ui/button"

    export type ConfirmOptions = {
      /** Dialog heading. Defaults to `common.confirmTitle`. */
      title?: string
      /** Label of the confirming button. Defaults to `common.confirm`. */
      confirmLabel?: string
      /** Confirming button uses the `destructive` variant. Defaults to `true` —
       *  every current call site is a delete/erase/cancel action. */
      destructive?: boolean
    }
    /** Async drop-in for `window.confirm`. `message` must already be translated. */
    export type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>

    const ConfirmContext = React.createContext<ConfirmFn | null>(null)
    type PendingRequest = { message: string; options: ConfirmOptions }

    export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
      const { t } = useTranslation()
      const [open, setOpen] = React.useState(false)
      const [request, setRequest] = React.useState<PendingRequest | null>(null)
      const resolverRef = React.useRef<((value: boolean) => void) | null>(null)

      const confirm = React.useCallback<ConfirmFn>(
        (message, options = {}) =>
          new Promise<boolean>((resolve) => {
            resolverRef.current?.(false) // a new request supersedes an unanswered one
            resolverRef.current = resolve
            setRequest({ message, options })
            setOpen(true)
          }),
        []
      )

      const settle = React.useCallback((result: boolean) => {
        const resolve = resolverRef.current
        resolverRef.current = null
        setOpen(false)
        resolve?.(result)
      }, [])

      return (
        <ConfirmContext.Provider value={confirm}>
          {children}
          <AlertDialog
            open={open}
            onOpenChange={(next) => { if (!next) settle(false) }}
            // keep the message mounted through the close animation
            onOpenChangeComplete={(next) => { if (!next) setRequest(null) }}
          >
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{request?.options.title ?? t('common.confirmTitle')}</AlertDialogTitle>
                <AlertDialogDescription className="whitespace-pre-line">
                  {request?.message}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogClose render={<Button variant="outline" />}>
                  {t('common.cancel')}
                </AlertDialogClose>
                <Button
                  variant={request?.options.destructive === false ? "default" : "destructive"}
                  onClick={() => settle(true)}
                >
                  {request?.options.confirmLabel ?? t('common.confirm')}
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </ConfirmContext.Provider>
      )
    }

    export function useConfirm(): ConfirmFn {
      const confirm = React.useContext(ConfirmContext)
      if (!confirm) throw new Error("useConfirm must be used within a ConfirmDialogProvider")
      return confirm
    }
    ```
  - Load-bearing details, do not simplify away:
    - The resolver lives in a **ref**, never in state — resolving inside a `setState` updater would be an impure updater and would double-fire under StrictMode.
    - `open` and `request` are **two** pieces of state: clearing `request` in `settle()` would blank the title/message mid-exit-animation.
    - Cancel is `AlertDialogClose` (not a bare `onClick`) — base-ui requires a `Close` inside a modal `Popup` so touch screen readers can escape it; its close fires `onOpenChange(false)` → `settle(false)`.
    - The confirm button is DOM-ordered **after** cancel, so base-ui's default `initialFocus` lands on Cancel — the safe default for a destructive prompt.

- [x] **Step 4: `AppToaster`**
  - Files: `src/components/AppToaster.tsx` (new, ~35 lines)
  - Details:
    ```tsx
    "use client"
    import { useEffect, useState } from "react"
    import { useTranslation } from "react-i18next"
    import { Toaster } from "sonner"

    /**
     * The app's single sonner mount. Without it every `toast.*()` call is a silent no-op.
     * Theme follows the manual `.dark` class on <html> (ThemeToggle.tsx / ui/theme-toggle.tsx
     * both toggle it and persist to localStorage) — sonner's `theme="system"` reads
     * matchMedia and would ignore that override, so we watch the class instead.
     */
    export default function AppToaster() {
      const { t } = useTranslation()
      // Start light so the first client render matches SSR; sync after hydration.
      const [isDark, setIsDark] = useState(false)

      useEffect(() => {
        const el = document.documentElement
        const sync = () => setIsDark(el.classList.contains('dark'))
        sync()
        const obs = new MutationObserver(sync)
        obs.observe(el, { attributes: true, attributeFilter: ['class'] })
        return () => obs.disconnect()
      }, [])

      return (
        <Toaster
          theme={isDark ? 'dark' : 'light'}
          position="top-right"
          richColors
          containerAriaLabel={t('common.notifications')}
        />
      )
    }
    ```
  - The `MutationObserver` block mirrors `src/app/admin/settings/HomepagePreview.tsx:56-61` exactly (same `attributeFilter: ['class']`, same cleanup), with an added initial `sync()` so the observer covers hydration too.
  - Props verified against `node_modules/sonner/dist/index.d.ts:97-118`: `theme?: 'light'|'dark'|'system'`, `position`, `richColors`, `containerAriaLabel` all exist.
  - `richColors` gives error toasts a red palette in both themes — the visual replacement for a blocking `alert()`. Do **not** add `closeButton` (see AD-F).

- [x] **Step 5: Mount both at the app root**
  - Files: `src/app/providers.tsx`
  - Details: add `import AppToaster from '@/components/AppToaster'` and `import { ConfirmDialogProvider } from '@/components/ConfirmDialogProvider'`, then change the returned tree (lines 27-41) to:
    ```tsx
    <ErrorBoundary>
      <SessionProvider>
        <QueryClientProvider client={clientRef.current}>
          <LanguageProvider enabledLocales={enabledLocales}>
            <ConfirmDialogProvider>
              <MasterProvider>
                <LayoutGroup>
                  {children}
                </LayoutGroup>
              </MasterProvider>
            </ConfirmDialogProvider>
            <AppToaster />
          </LanguageProvider>
        </QueryClientProvider>
      </SessionProvider>
    </ErrorBoundary>
    ```
  - Both must be **inside** `LanguageProvider` (they call `useTranslation()`). Nothing else in the file changes.

- [x] **Step 6: Convert the 11 `confirm()` call sites (10 files)**
  - Uniform recipe per file: add `import { useConfirm } from "@/components/ConfirmDialogProvider"` to the import block, add `const confirm = useConfirm()` immediately after the existing `const { t } = useTranslation()` line, and rewrite the guard. Nothing else in any of these files changes.
  - [x] `src/app/admin/database/clients/ClientsTable.tsx` — handler already `async function handleDelete(id: string, name: string | null)` (line 91).
    - `:92` `if (!confirm(t('admin.database.deleteConfirm', { name: name ?? t('admin.database.thisClient') }))) return`
    - → `if (!(await confirm(t('admin.database.deleteConfirm', { name: name ?? t('admin.database.thisClient') })))) return`
  - [x] `src/app/admin/database/gdpr/GdprTable.tsx` — **two** handlers, one `const confirm = useConfirm()`. Both already `async function` (lines 59, 67).
    - `:60` → `if (!(await confirm(t('admin.gdpr.withdrawConfirm', { name })))) return`
    - `:68-69` → `if (!(await confirm(t('admin.gdpr.eraseConfirm', { name })))) return` (keep the existing two-line wrap or collapse to one — either is fine; the `\n\n` in the message renders correctly thanks to AD-I)
    - `src/app/admin/AGENTS.md:17` mandates confirm-before-submit here — it is preserved, not removed.
  - [x] `src/app/admin/admins/AdminsClient.tsx` — already `async function handleDelete(id, name)` (line 46).
    - `:47` → `if (!(await confirm(t('admin.admins.deleteConfirm', { name: name ?? t('admin.admins.thisAdmin') })))) return`
  - [x] `src/app/admin/master/AppointmentsList.tsx` — already `const handleCancel = async (id: string) => {` (line 29).
    - `:30` → `if (!(await confirm(t('admin.appointments.confirmCancel')))) return`
  - [x] `src/app/admin/master/services/MasterServicesClient.tsx` — already `const handleDelete = async (id: string) => {` (line 52).
    - `:53` → `if (!(await confirm(t('admin.services.deleteCustomConfirm')))) return`
  - [x] `src/app/admin/masters/MastersClient.tsx` — **must become async.** Currently `const handleDelete = useCallback((id: string, name: string | null) => {` (line 52).
    - → `const handleDelete = useCallback(async (id: string, name: string | null) => {`
    - `:53-54` → `if (!(await confirm(t('admin.masters.deleteConfirm', { name: name ?? t('admin.masters.thisMaster') })))) return`
    - dep array `[t]` → `[t, confirm]` (`confirm` is `useCallback`-stable, so this does not churn).
    - `startTransition(() => { deleteMaster(id) })` stays untouched (calling it after an `await` is valid).
  - [x] `src/app/admin/db-browser/DbBrowserClient.tsx` — already `async function handleDelete(id: unknown)` (line 67).
    - `:69` → `if (!(await confirm(t('admin.database.deleteRowConfirm', { id, table: selectedTable })))) return`
  - [x] `src/app/admin/services/ServicesClient.tsx` — **must become async.** Currently `const handleDelete = useCallback((id: string) => {` (line 52).
    - → `const handleDelete = useCallback(async (id: string) => {`
    - `:53` → `if (!(await confirm(t('admin.services.deleteConfirm')))) return`
    - dep array `[t]` → `[t, confirm]`.
  - [x] `src/components/admin/content/PageListClient.tsx` — **must become async.** Currently `const handleDelete = useCallback((id: string) => {` (line 69).
    - → `const handleDelete = useCallback(async (id: string) => {`
    - `:70` → `if (!(await confirm(t('admin.pages.deletePageConfirm')))) return`
    - dep array `[t]` → `[t, confirm]`. Leave `handleToggle` / `handleReorder` alone.
  - [x] `src/components/admin/content/PageBlocksEditor.tsx` — already `async function handleDelete(blockId: string)` (line 64).
    - `:65` → `if (!(await confirm(t('admin.pages.deleteBlockConfirm')))) return`
  - The `onClick={() => handleDelete(...)}` call sites need **no** change: they already ignore the returned promise, and several handlers (`handleWithdraw`, `handleErase`, `handleCancel`) were already `async` before this work. Type-aware `no-floating-promises` is not enabled (`eslint.config.js` uses `tseslint.configs.recommended`, not the type-checked preset), so this introduces no lint error.

- [x] **Step 7: Convert the 7 `alert()` call sites (5 files)**
  - Uniform recipe: add `import { toast } from "sonner"` to the import block (matching the existing style of the file — double quotes in these five), swap `alert(` → `toast.error(`. **Message expressions stay byte-identical.**
  - [x] `src/app/admin/master/AppointmentsList.tsx:43` — `alert(error.message)` → `toast.error(error.message)` (this file also gets the Step 6 edit; one import block, two changes)
  - [x] `src/app/admin/master/services/MasterServicesClient.tsx:63` — `alert(t('admin.services.errorPrefix', { message: e.message }))` → `toast.error(...)` (also a Step 6 file)
  - [x] `src/app/admin/master/calendar/AppointmentModal.tsx:196` — `alert(err.message)` → `toast.error(err.message)`
  - [x] `src/app/admin/master/calendar/ViewAppointmentModal.tsx:47` — `alert(t('admin.calendar.deleteAppointmentFailed'))` → `toast.error(...)`. Leave the `showDeleteConfirm` state and its inline confirmation UI alone (AD-K).
  - [x] `src/app/admin/master/calendar/BulkSettingsModal.tsx` — three sites, one import:
    - `:200` `toast.error(t('admin.calendar.bulk.selectDateAlert'))`
    - `:204` `toast.error(t('admin.calendar.bulk.selectMasterAlert'))`
    - `:213` `toast.error(t('admin.calendar.bulk.saveErrorPrefix', { message: e.message }))`
    - `:200`/`:204` are validation blocks rather than thrown errors; `toast.error` is still the right channel — they block the save and must read as failures. Do not split into `toast.warning`.
  - No locale key is added, renamed or reworded in this step.

- [x] **Step 8: Permanent guard — ESLint `no-alert`**
  - Files: `eslint.config.js`
  - Details: add one line to the existing shared `rules` block (after `'no-empty'`, line 45):
    ```js
    // Native browser dialogs are banned app-wide: use `useConfirm()`
    // (src/components/ConfirmDialogProvider.tsx) and `toast.*()` from sonner.
    'no-alert': 'error',
    ```
  - This bans bare and `window.`-qualified `alert`/`confirm`/`prompt`. It does **not** flag `const confirm = useConfirm()` call sites: ESLint's `no-alert` skips identifiers that resolve to a local definition (`isShadowed`). Grep-verified there are no other `alert`/`confirm`/`prompt` calls anywhere in `src/`, `scripts/` or `tests/`, so the rule starts clean.
  - Verify with `npx eslint . --format unix | grep no-alert` → must print nothing. **If it flags any of the new `confirm(...)` sites, the hook binding is missing at that site — fix the call site, do not relax the rule.**

- [x] **Step 9: DOX pass**
  - Files: `src/components/AGENTS.md`, `src/app/AGENTS.md`, `src/app/admin/AGENTS.md`
  - Details (concise bullets, no duplication across the three):
    - `src/components/AGENTS.md` → one new Local Contract bullet: `ui/alert-dialog.tsx` is the destructive-confirmation primitive (base-ui `alert-dialog`, always modal, no outside-click dismissal, `z-[100]`), driven by `ConfirmDialogProvider.tsx`'s `useConfirm(): (message, options?) => Promise<boolean>` — callers pass an already-translated message; the dialog owns only `common.confirmTitle`/`common.cancel`/`common.confirm`. Second bullet: `AppToaster.tsx` is the app's single sonner `<Toaster />` mount (rendered from `src/app/providers.tsx`); without it every `toast.*()` is a silent no-op, and its theme follows the manual `.dark` class via `MutationObserver`, never `theme="system"`. Also extend the existing Tailwind-v3 bullet (line 25) to name `ui/alert-dialog.tsx` alongside `ui/dropdown-menu.tsx`.
    - `src/app/AGENTS.md` → one new Local Contract bullet: `providers.tsx` is the single app-wide client provider stack (`ErrorBoundary` → `SessionProvider` → `QueryClientProvider` → `LanguageProvider` → `ConfirmDialogProvider` → `MasterProvider` → `LayoutGroup`, plus `AppToaster`); anything needing `useTranslation()` must be mounted inside `LanguageProvider`.
    - `src/app/admin/AGENTS.md` → one new Work Guidance bullet: destructive actions use `await useConfirm()(t('…'))` and error paths use `toast.error(t('…'))` — native `alert`/`confirm`/`prompt` are banned by the `no-alert` ESLint rule. Reinforce (don't rewrite) the existing bullet 17 that GDPR erase/withdraw must keep a confirmation step.
    - `tests/AGENTS.md`, `src/lib/AGENTS.md`, `prisma/AGENTS.md`, `handoff/AGENTS.md`: **intentionally unchanged** — no test file, no lib module, no schema, no handoff-convention change. Report this explicitly at closeout.

- [x] **Step 10: Verification & handover notes**
  - Run, in this order:
    1. `npx tsc --noEmit` — must be clean for every touched file. Watch for `AlertDialogPrimitive.*.Props` resolution and the `Promise<boolean>` narrowing at the 11 call sites.
    2. `npm run lint` — the repo has a **pre-existing** non-zero baseline (~40 errors / ~5 warnings under `--max-warnings=0`). Capture the baseline first (`git stash && npm run lint > /tmp/lint-before.txt 2>&1; git stash pop`) and diff, exactly as the group6 plan did. Requirement: **no new error or warning in any touched or new file**.
    3. `npx eslint . --format unix | grep no-alert` — must print nothing (Step 8).
    4. `npm run test` — must stay green (nothing under `tests/` imports a touched file).
    5. `npm run i18n:check` — must report `[PASS]` for all three locales *and* for referenced-key coverage. This is the check that catches a `common.confirmTitle` / `common.notifications` added to only one or two files.
  - **Do NOT run `npm run dev` or `npm run build`** (standing user constraint — a one-shot build can corrupt `.next/` under the user's running dev server). Advise a dev-server restart before the manual pass, since `src/app/providers.tsx` changed.
  - Produce the manual-check list for the user (short, step-by-step, in Russian), covering at minimum:
    - Delete a service / master / admin / page / block / client / GDPR record / DB-browser row → a styled dialog appears (not the browser's), Escape and Cancel abort with nothing deleted, Confirm deletes.
    - GDPR "erase" dialog still renders its two paragraphs on separate lines.
    - Toggle dark mode with a toast on screen → the toast repaints to the dark palette.
    - Trigger a failure (e.g. Bulk Settings → Save with no date selected) → a red toast in the top-right, page stays interactive.
    - Admin → Settings → Email/Notifications/Social/Client-bot: **Save now shows a success toast** where previously nothing appeared (the AD-A side-effect fix).
    - Confirm dialog is readable and its buttons reachable on a narrow (mobile) viewport.

## Acceptance Criteria

- [x] `npx tsc --noEmit` clean
- [x] `npm run lint` shows **no new** error/warning versus the captured pre-existing baseline
- [x] `npx eslint . --format unix | grep no-alert` prints nothing
- [x] `npm run test` green (unchanged suite)
- [x] `npm run i18n:check` passes: pl/en/uk parity **and** referenced-key coverage
- [x] Zero `alert(`, `confirm(`, `prompt(`, `window.alert/confirm/prompt` calls resolving to browser globals remain anywhere in `src/`
- [x] All 11 former `confirm()` sites go through `useConfirm()`; the returned promise is `await`ed and a `false` result still short-circuits the handler (nothing is deleted on cancel)
- [x] All 7 former `alert()` sites call `toast.error(...)` with the **same message expression** as before
- [x] `<Toaster />` is mounted exactly once, app-wide, and the 19 pre-existing `toast.*()` calls in `src/app/admin/settings/**` + `src/components/admin/*SettingsForm.tsx` now render
- [x] Confirm dialog cannot be dismissed by an outside click; Escape and Cancel both resolve `false`
- [x] Toaster theme follows the manual `.dark` toggle (not `matchMedia`)
- [x] Only two new i18n keys (`common.confirmTitle`, `common.notifications`), present in all three files; `common.cancel`/`common.confirm` reused, not duplicated
- [x] No user-facing string is hardcoded in `alert-dialog.tsx`, `ConfirmDialogProvider.tsx` or `AppToaster.tsx`
- [x] `alert-dialog.tsx` uses Tailwind **v3** variant syntax (`data-[open]:` / `data-[closed]:` / `supports-[backdrop-filter]:`) per `src/components/AGENTS.md`
- [x] No file exceeds 500 lines (largest touched: `AppointmentModal.tsx` 497 → 498)
- [x] `dialog.tsx`, `sheet.tsx`, `ViewAppointmentModal.tsx`'s existing `showDeleteConfirm` flow, and all 19 existing `toast.*()` call sites are unmodified
- [x] AGENTS.md DOX pass done per Step 9, with unchanged docs reported and justified

## Constraints & Risks

- **`AppointmentModal.tsx` is 497 lines.** The only edit is `+1` import line and an in-place `alert(` → `toast.error(` swap → **498**. Do not add anything else to that file. If a second line becomes necessary, stop and flag it rather than silently crossing 500.
- **Do not touch** `prisma/`, `src/middleware.ts`, `src/auth*.ts`, any API route, or any server action. This work is purely presentational.
- **Do not modify** `src/components/ui/dialog.tsx` or `sheet.tsx`. Their v4-only variant classes are a known pre-existing issue (AD-C) — mention in the summary, don't fix.
- **Do not remove any confirmation step.** `src/app/admin/AGENTS.md:17` makes confirm-before-submit mandatory for GDPR erase/withdraw. Every one of the 11 sites must still block on an explicit user choice — swapping the mechanism must not become "just delete it".
- **Do not translate inside the dialog.** The message is the caller's already-translated string; adding a `t()` on it would double-translate and break the interpolated `{{name}}`/`{{id}}`/`{{table}}` values.
- **Risk — silently swallowed cancel.** The single highest-value review check: `if (!confirm(x)) return` → `if (!(await confirm(x))) return`. Dropping the `await` makes the expression a truthy Promise, so `!promise` is always `false` and **every destructive action fires unconditionally**. `tsc` does *not* catch this (`!Promise<boolean>` is legal). Reviewer must eyeball all 11 lines for the `await` and the extra parenthesis pair.
- **Risk — the three `useCallback` handlers** (`ServicesClient`, `MastersClient`, `PageListClient`) must actually become `async`; forgetting one yields `await` in a non-async function → a `tsc` error, which is the safe failure mode. Their dep arrays gain `confirm`.
- **Risk — hydration mismatch on the Toaster.** `AppToaster` must initialise `isDark` to `false` and sync in `useEffect` (the `ThemeToggle.tsx` / `LanguageContext.tsx` convention). Do **not** copy `HomepagePreview.tsx:43`'s lazy `useState(() => typeof document !== 'undefined' && …)` initialiser — that pattern is fine for a client-only subtree but would diverge from SSR at the app root.
- **Risk — mount ordering.** Both new components call `useTranslation()`; mounting either outside `LanguageProvider` yields raw key strings. Verified: `src/app/layout.tsx:150` puts `<Providers>` above both the public tree and `src/app/admin/layout.tsx`, so one mount covers all 18 call sites.
- **Risk — z-index.** `ViewAppointmentModal.tsx` renders at `z-[60]`. The confirm dialog's `z-[100]` (AD-H) is deliberate; lowering it to `z-50` for "consistency" would let a future in-modal confirm render underneath its own caller.
- **Accepted cost:** `sonner` (~5 KB gz) and the confirm provider now load on public booking pages too, not just `/admin`. Justified by a single mount point and by the 19 existing broken `toast.*()` calls; splitting into an admin-only mount would leave the public tree unable to toast and duplicate the provider tree.
- **Never** start the dev server or run `npm run build`; leave browser verification to the user, and tell them to restart their dev server first (`src/app/providers.tsx` changed).
