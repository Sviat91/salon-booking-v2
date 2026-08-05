# Review: photo-multi-upload-dragdrop
**Date:** 2026-08-05
**Verdict:** APPROVED

## Critical/Architectural Issues
(none)

## Minor/Syntax Issues
(none)

## Passed Checks
- [x] `SortableList.tsx` backward compatibility: `strategy?: SortableStrategy` defaults to `"list"` → `verticalListSortingStrategy`, `"grid"` → `rectSortingStrategy`. Both existing callers (`PageBlocksEditor.tsx`, `PageListClient.tsx`) still call `<SortableList>` with no `strategy` prop and are absent from the changed-file set.
- [x] `FileList` read-before-clear ordering: `Array.from(e.target.files ?? [])` executes before `e.target.value = ""`.
- [x] `type="button"` present on both new buttons (drag handle, delete) in `PhotoListEditor.tsx` — required since the component renders inside real `<form>` elements on two of its four surfaces.
- [x] Stale-closure-safe batch append: `photosRef` synced via `useEffect`, the final `onChange([...photosRef.current, ...urls])` reads the ref, not the closure.
- [x] `reorderPhotosByIds` has all three defensive guards (wrong length, duplicate id, unknown id) — all return `photos` unchanged, no throw, no `undefined` holes possible.
- [x] `derivePhotoIds()` occurrence-suffix logic correctly handles duplicate URLs; the test file exercises a genuine duplicate-URL round-trip through both functions together.
- [x] `src/app/api/upload/route.ts` untouched — one `file` field per POST, same response shape. Multi-file is purely N chunked client requests, no server contract change.
- [x] Concurrency-chunked upload (`UPLOAD_CONCURRENCY = 3`) with `Promise.allSettled` per chunk — one bad file cannot abort sibling uploads.
- [x] Zero new i18n keys — `admin.pages.dragHandleLabel` reused as-is; `git diff --stat src/locales` empty.
- [x] Line budgets: `PhotoListEditor.tsx` 153, `SortableList.tsx` 101, `photo-ids.ts` 34, test file 76 — all well under 500.
- [x] DOX updates (`src/components/AGENTS.md`, `src/lib/AGENTS.md`, `tests/AGENTS.md`) accurately describe the shipped code.
- [x] `PhotoWidgetConfigEditor.tsx`/`PhotoGalleryConfigEditor.tsx` unchanged — `PhotoListEditorProps` contract preserved.
- [x] `move()`/arrow-button code and Chevron imports fully removed.
- [x] Persisted shape untouched — no derived id ever reaches `onChange`'s `string[]` output.
- [x] `npm run lint` (46 problems, unchanged baseline) and the new test file (10/10 passing) independently re-verified by the orchestrator; `git diff --name-only` confirmed scoped to exactly the expected files.

## Summary
Implementation matches the plan precisely across every high-risk item: backward-compatible `strategy` prop, correct `FileList` ordering, `type="button"` on both new buttons, real `photosRef`-based stale-closure fix, all three `reorderPhotosByIds` guards present and correct, duplicate-URL id derivation covered by a genuine round-trip test, `/api/upload` contract fully untouched, proper per-file failure isolation, zero new i18n keys, all files well under budget. No issues found. Remaining acceptance-criteria items are browser-only (multi-select behavior, drag animation, keyboard reordering, nested-DndContext/Sheet behavior) and are covered by the plan's manual verification checklist for the user.
