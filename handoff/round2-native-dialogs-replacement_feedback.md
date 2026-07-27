# Review: round2-native-dialogs-replacement
**Date:** 2026-07-27
**Verdict:** APPROVED

## Critical/Architectural Issues
(none)

## Minor/Syntax Issues
(none)

## The critical check — all 11 `confirm()` conversion sites, quoted verbatim

1. `src/app/admin/database/clients/ClientsTable.tsx:94` — `if (!(await confirm(t('admin.database.deleteConfirm', { name: name ?? t('admin.database.thisClient') })))) return`
2. `src/app/admin/database/gdpr/GdprTable.tsx:62` — `if (!(await confirm(t('admin.gdpr.withdrawConfirm', { name })))) return`
3. `src/app/admin/database/gdpr/GdprTable.tsx:70-71` — `if (!(await confirm(t('admin.gdpr.eraseConfirm', { name })))) return`
4. `src/app/admin/admins/AdminsClient.tsx:49` — `if (!(await confirm(t('admin.admins.deleteConfirm', { name: name ?? t('admin.admins.thisAdmin') })))) return`
5. `src/app/admin/master/AppointmentsList.tsx:33` — `if (!(await confirm(t('admin.appointments.confirmCancel')))) return`
6. `src/app/admin/master/services/MasterServicesClient.tsx:56` — `if (!(await confirm(t('admin.services.deleteCustomConfirm')))) return`
7. `src/app/admin/masters/MastersClient.tsx:55-56` — `if (!(await confirm(t('admin.masters.deleteConfirm', { name: name ?? t('admin.masters.thisMaster') })))) return`
8. `src/app/admin/db-browser/DbBrowserClient.tsx:71` — `if (!(await confirm(t('admin.database.deleteRowConfirm', { id, table: selectedTable })))) return`
9. `src/app/admin/services/ServicesClient.tsx:55` — `if (!(await confirm(t('admin.services.deleteConfirm')))) return`
10. `src/components/admin/content/PageListClient.tsx:72` — `if (!(await confirm(t('admin.pages.deletePageConfirm')))) return`
11. `src/components/admin/content/PageBlocksEditor.tsx:67` — `if (!(await confirm(t('admin.pages.deleteBlockConfirm')))) return`

Every single site has `await` present AND the extra parenthesis pair. No unconditional-fire regression anywhere.

## All other checks passed

1. `MastersClient.tsx`/`ServicesClient.tsx`/`PageListClient.tsx` handlers all `async`, dep arrays include `confirm`.
2. `alert-dialog.tsx` — zero v4-only syntax matches; uses `data-[open]:`, `data-[closed]:`, `supports-[backdrop-filter]:` throughout.
3. Uses `AlertDialogPrimitive.Root` (non-dismissible by outside click, by type design).
4. `ConfirmDialogProvider.tsx`: resolver held in a ref, correctly resolves a superseded prior request with `false`, no double-resolve path.
5. No `t()` wrapping applied to the caller's already-translated message.
6. `AppToaster.tsx` — SSR-safe, starts `isDark=false`, syncs in `useEffect` via `MutationObserver`.
7. `providers.tsx` — both new providers mounted inside `LanguageProvider`.
8. All 7 `alert()`→`toast.error()` sites byte-identical message expressions.
9. `AppointmentModal.tsx` is exactly 498 lines.
10. `eslint.config.js` has `'no-alert': 'error'`, correctly scoped.
11. `dialog.tsx`/`sheet.tsx`/`ViewAppointmentModal.tsx`'s `showDeleteConfirm` state untouched.
12. i18n — only `common.confirmTitle`/`common.notifications` added, present in all three locales at identical position; `common.cancel`/`common.confirm` reused.

No stray `window.confirm(`, `window.alert(`, or bare `alert(` calls remain anywhere in `src/`. DOX updates present and accurate across all three AGENTS.md files.
