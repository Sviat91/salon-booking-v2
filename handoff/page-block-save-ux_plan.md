# Plan: page-block-save-ux

## Context

`src/components/admin/content/PageBlocksEditor.tsx` renders one card per content
block, each with its own "Save block" button plus a page-level "Save all" FAB.

User-reported bug (item 3 of a 5-item list, from the 2026-08-05 session):
- The per-block Save button visually "jumps/shakes" when clicked.
- It stays enabled regardless of whether the block actually has unsaved changes,
  and gives no clear feedback that a save succeeded.

## Root causes (confirmed by reading the file)

1. **Jump/shake**: the button's label text swaps between
   `t('admin.pages.saveBlockBtn')` ("Zapisz blok", pl) and `t('common.saving')`
   ("Zapisywanie...", pl) — different string lengths — so the button resizes
   once on click and again on response, in a very short window, right where
   the user's eye/cursor already is. That reads as a "jump/shake".
2. **Always enabled**: `disabled={savingId === block.id || invalid}` never
   checks whether `block.id` has an entry in `drafts`. The page-level "Save
   all" FAB in the same file already gets this right —
   `disabled={draftCount === 0 || savingAll}` (line 209) — the per-block button
   just never copied that check.
3. **No success feedback**: after a successful save, `drafts[block.id]` is
   deleted and the button simply returns to its disabled look — identical to
   its "no changes since load" look, so there is no way to tell a save just
   happened. Settings (`SettingsForm.tsx`) mirrors this ambiguity fix via a
   persistent (until next edit) inline "Saved" message in `var(--md-success)`.

## Fix

All changes confined to `src/components/admin/content/PageBlocksEditor.tsx`.

1. **Disabled logic** — change the per-block button to:
   ```tsx
   disabled={savingId === block.id || invalid || !(block.id in drafts)}
   ```
   This matches the FAB's already-correct pattern: no draft for this block ⇒
   disabled, exactly like Settings' `isDirty` gate.

2. **Eliminate the width jump** — stop swapping the label text. Keep the label
   constant (`t('admin.pages.saveBlockBtn')`) and instead render a
   **fixed-width icon slot** (`h-3.5 w-3.5`, always present) to the left of the
   label that shows nothing / a spinner / a checkmark depending on state. Because
   the slot is always rendered at the same size, the button's width never
   changes across states — no more double-resize.

3. **Success feedback** — add `justSavedIds: Set<string>` state (mirrors the
   existing `Record<string, string>` pattern already used for `errors`).
   - On successful `handleSave`, add the block's id to the set.
   - On successful `handleSaveAll`, add all `savedIds` to the set (same loop
     that already builds `savedIds`).
   - Clear a block's id from the set the moment it gets a new draft (in
     `handleConfigChange`) — mirrors Settings' "success message clears on next
     edit" behavior, no timer needed.
   - Icon slot renders: `Loader2` (spinning) while `savingId === block.id`,
     else `Check` (static, using the same `var(--md-success)` tone already used
     by `errors[block.id]`'s destructive counterpart — use `text-[var(--md-success)]`
     on the Check icon) while `justSavedIds.has(block.id)`, else nothing.
   - Import `Loader2` and `Check` from `lucide-react` (already a project
     dependency — file already imports other lucide icons).

4. **No other files change.** `admin.pages.saveBlockBtn` / `common.saving` i18n
   keys are reused as-is (no new keys). The "Save all" FAB is already correct
   and is not touched.

## Concrete diff shape

```tsx
// state
const [justSavedIds, setJustSavedIds] = useState<Set<string>>(new Set())

// handleConfigChange: clear "saved" flag the moment the block is edited again
function handleConfigChange(blockId: string, config: BlockConfig) {
  setDrafts((prev) => ({ ...prev, [blockId]: config }))
  setJustSavedIds((prev) => {
    if (!prev.has(blockId)) return prev
    const next = new Set(prev)
    next.delete(blockId)
    return next
  })
}

// handleSave: mark saved on success
async function handleSave(block: BlockRow) {
  ...
  setDrafts((prev) => { ... })
  setJustSavedIds((prev) => new Set(prev).add(block.id))
  router.refresh()
}

// handleSaveAll: mark all successfully-saved ids
...
setJustSavedIds((prev) => {
  const next = new Set(prev)
  savedIds.forEach((id) => next.add(id))
  return next
})

// button
<Button
  size="sm"
  className="self-start gap-1.5"
  disabled={savingId === block.id || invalid || !(block.id in drafts)}
  onClick={() => handleSave(block)}
>
  <span className="flex h-3.5 w-3.5 items-center justify-center shrink-0">
    {savingId === block.id ? (
      <Loader2 className="h-3.5 w-3.5 animate-spin" />
    ) : justSavedIds.has(block.id) ? (
      <Check className="h-3.5 w-3.5 text-[var(--md-success)]" />
    ) : null}
  </span>
  {t('admin.pages.saveBlockBtn')}
</Button>
```

## Checklist

- [x] `disabled` on per-block Save button checks `block.id in drafts`
- [x] Label text no longer swaps between "Save"/"Saving…" strings (fixed width)
- [x] Fixed-width icon slot (`h-3.5 w-3.5`, always rendered) hosts spinner/checkmark
- [x] `justSavedIds` set added, populated on `handleSave` success and
      `handleSaveAll` success (for each block actually saved, not the ones that
      errored)
- [x] `justSavedIds` entry cleared in `handleConfigChange` when that block gets
      a new draft
- [x] `Loader2`, `Check` imported from `lucide-react`
- [x] No other files touched; no new i18n keys; no new dependencies
- [x] File stays under 500 lines
- [x] `npm run lint` — no new problems vs baseline
- [x] `npm run test` — no regressions

## Round 2 — fix whole-page flicker on save (user found after round 1)

User confirmed round 1 fixed the button jump, but reported the *entire block's
content* (and, as a reflow side-effect, surrounding page elements) visibly
flickers on save: e.g. reordered photos briefly snap back to their pre-save
order, then snap forward to the saved order.

### Root cause

`handleSave` (and `handleSaveAll`) delete `drafts[block.id]` the instant the
save succeeds (`:65-69`), before `router.refresh()` has resolved. Once the
draft is gone, `configFor()` (`:41-43`) falls back to
`parseBlockConfig(block.type, block.config)` — but `block.config` still comes
from the **stale** `localBlocks`/`blocks` prop, since `router.refresh()`'s new
server payload hasn't landed yet. So for one render (and the visible gap until
the refresh resolves), the block renders its *pre-save* config, then snaps to
the *post-save* config once fresh props flow through the
`useEffect(() => setLocalBlocks(blocks), [blocks])` on `:39`. That revert-then-
correct is the flicker — for a photo-reorder save it's visibly obvious (order
flips twice); for other blocks it manifests as the same underlying reflow,
which is what reads as "the whole page jerked" (image height changes during
that reflow can shift everything below/around it).

`handleReorder` (`:85-91`) already avoids exactly this trap for block
*ordering*: it updates `localBlocks` optimistically with the known-good new
order immediately, then fires the server call and `router.refresh()` in the
background — the visible UI never depends on the refresh round-trip. Apply the
same pattern to block *config* saves.

### Fix

Still confined to `src/components/admin/content/PageBlocksEditor.tsx`.

In `handleSave`, once `updateBlockConfig` succeeds, update `localBlocks` so
that block's `.config` field reflects exactly what was just persisted
(`JSON.stringify(config)` — already computed at the top of the function) —
*before* or alongside clearing the draft, so `configFor()` never has a frame
where it falls back to stale data:

```tsx
async function handleSave(block: BlockRow) {
  const config = configFor(block)
  setSavingId(block.id)
  setErrors((prev) => ({ ...prev, [block.id]: "" }))
  const result = await updateBlockConfig(block.id, JSON.stringify(config))
  setSavingId(null)
  if (result.error) {
    setErrors((prev) => ({ ...prev, [block.id]: result.error! }))
    return
  }
  const savedConfig = JSON.stringify(config)
  setLocalBlocks((prev) => prev.map((b) => (b.id === block.id ? { ...b, config: savedConfig } : b)))
  setDrafts((prev) => {
    const next = { ...prev }
    delete next[block.id]
    return next
  })
  setJustSavedIds((prev) => new Set(prev).add(block.id))
  router.refresh()
}
```

Same idea in `handleSaveAll`, applied per successfully-saved id inside the
loop (each `config` in `entries` is already the exact object that was sent):

```tsx
async function handleSaveAll() {
  const entries = Object.entries(drafts)
  if (entries.length === 0) return
  setSavingAll(true)
  const nextErrors: Record<string, string> = {}
  const savedConfigs: Record<string, string> = {}
  for (const [blockId, config] of entries) {
    const block = localBlocks.find((b) => b.id === blockId)
    if (block && isTextInvalid(block, config)) {
      nextErrors[blockId] = t('admin.pages.textRequiredAnyLocale')
      continue
    }
    const result = await updateBlockConfig(blockId, JSON.stringify(config))
    if (result.error) {
      nextErrors[blockId] = result.error
    } else {
      nextErrors[blockId] = ""
      savedConfigs[blockId] = JSON.stringify(config)
    }
  }
  setErrors((prev) => ({ ...prev, ...nextErrors }))
  setLocalBlocks((prev) => prev.map((b) => (b.id in savedConfigs ? { ...b, config: savedConfigs[b.id] } : b)))
  setDrafts((prev) => {
    const next = { ...prev }
    Object.keys(savedConfigs).forEach((id) => delete next[id])
    return next
  })
  setJustSavedIds((prev) => {
    const next = new Set(prev)
    Object.keys(savedConfigs).forEach((id) => next.add(id))
    return next
  })
  setSavingAll(false)
  router.refresh()
}
```

(`savedIds` array is replaced by `savedConfigs` record so both the drafts-
clearing and the `localBlocks` update can key off the same successfully-saved
set — `Object.keys(savedConfigs)` replaces every prior use of `savedIds`.)

`router.refresh()` stays in both functions (still needed so other server-
rendered parts of the page — e.g. anything reading page/block data outside
this component — eventually catch up), but the visible UI no longer depends on
it resolving: `localBlocks` already holds the correct post-save value the
instant the save succeeds, so when the refreshed `blocks` prop does land, its
content is identical to what's already on screen and the `useEffect` on `:39`
re-render is a no-op visually.

### Round 2 checklist

- [x] `handleSave` updates `localBlocks` with the exact saved config
      (`JSON.stringify(config)`) before/alongside clearing the draft — no
      frame where `configFor()` can fall back to stale `block.config`
- [x] `handleSaveAll` does the same per successfully-saved block, keyed by a
      `savedConfigs: Record<string,string>` (replacing the old `savedIds`
      array wherever it was used for the same purpose)
- [x] `router.refresh()` still called in both (unchanged — kept for
      revalidation, no longer load-bearing for visible UI correctness)
- [x] Manually reason through: no case where `localBlocks` and `drafts` can
      disagree about a block's displayed config after this change
- [x] No other files touched; no new deps; no new i18n keys
- [x] File stays under 500 lines
- [x] `npm run lint` — no new problems vs baseline
- [x] `npm run test` — no regressions
