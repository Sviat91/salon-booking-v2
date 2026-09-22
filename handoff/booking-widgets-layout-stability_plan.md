# Plan: stabilize booking-page widget sizing (layout jitter fix)

**Date:** 2026-09-22
**Status:** In Progress

## Goal

Stop the `/[masterId]` booking page's two widget columns from resizing/shifting when widget
content changes (procedures finishing loading, `BookingManagement` switching panels, slots
appearing, language switch), without changing mobile layout or any booking logic.

## Architecture Decisions

### The orchestrator's hypothesis was partly wrong — corrected root cause

**Rejected:** "`transition-all duration-200 ease-out` on the `BookingManagement` panel wrapper
animates height between panels."
`BookingManagement.tsx:219-222` toggles between `opacity-100 mt-2` (open) and
`max-h-0 opacity-0 overflow-hidden` (closed). Nothing ever sets an explicit height, so between
panel switches the computed height is `auto → auto`, and on open/close `max-height` goes
`0px → none`. **Neither `auto` nor `none` is interpolatable**, so the browser never runs a height
transition at all — the only properties `transition-all` actually animates here are `opacity` and
`margin-top`. Height changes are already instantaneous snaps. Removing/narrowing that transition
would therefore change nothing about the reported jitter. Do **not** spend the change budget there.

**Accepted (real root cause):** `src/app/[masterId]/page.tsx:284` lays the desktop page out as

```
lg:grid lg:grid-cols-[auto,auto] lg:items-start lg:justify-center lg:gap-6
```

Both tracks are `auto`, i.e. **sized from their content's intrinsic (max-content) width**, and the
grid is `justify-center`, i.e. the tracks do not stretch to fill the container. So every time the
widest text inside either column changes, both tracks are re-measured, the total grid width
changes, and — because the whole thing is centred — *both* columns visibly move horizontally.
Everything in the bug report is one instance of this:

- **Procedure widget "while procedures are loading"** — `ProcedureSelect.tsx:102-120` renders the
  closed dropdown as `max-h-0 ... overflow-hidden`, which clips **vertically only**; the `<li>`
  items are still laid out and still contribute their max-content width. While the query is in
  flight `items` is `[]` and the closed button shows the short `common.loading` string; when the
  query resolves, a list of long `"<name> - <min> min / <price> zł"` rows appears and the column's
  intrinsic width jumps (up to the `max-w-sm` = 24rem cap). That is the reported "narrows, then
  widens", and it happens with **no height change at all** — which is why the previous
  height-based fix could never have worked.
- **`BookingManagement` cycling panels** — `LoadingPanel.tsx` is 3 × `h-16` skeleton `div`s (zero
  intrinsic width) plus one short line; `ResultsPanel.tsx` renders localized procedure names, a
  `"Znaleziono rezerwacje dla <name>, tel <phone>"` line and full `EEEE, d MMMM` dates. Panel
  switch ⇒ max-content swing ⇒ track width swing.
- **Slots appearing** in the left column (`SlotsList.tsx` empty → `grid-cols-2` of time buttons)
  moves the left track, which shifts the right column sideways too.
- **Language switch** (the 2026-07-28 ROADMAP report, same widgets) changes text length in every
  one of those places — the purest possible trigger for a max-content-driven layout.

Two independent corroborations that this page is already known to be width-unstable:
`DayCalendar.tsx:228` carries the comment *"table-fixed + explicit column widths = constant 7×40px
grid regardless of locale text length"* — a previous developer patched exactly this failure mode
**inside** the calendar, but not the `auto` grid tracks above it; and the reverted 2026-07-28
attempt targeted height/layout-animation, i.e. the wrong axis, which explains why the user found
it unsuccessful.

### Chosen fix

Give the two desktop tracks a **definite** width, so no descendant's text can influence layout:
`lg:grid-cols-[24rem_24rem]`.

- `24rem` is not a new invented number: it is `max-w-sm`, the cap the page author already declared
  on **both** column wrappers (`src/app/[masterId]/page.tsx:295` and `:366`). Today the columns
  merely fail to reach it when their content happens to be narrower. `tailwind.config.ts` does not
  override `maxWidth`, so `max-w-sm` = 24rem = 384px exactly.
- The widest thing in the left column is the day grid: 7 × 40px = 280px + the card's `sm:px-4`
  (32px) = 312px < 384px, so nothing can overflow; `DayPicker`'s `w-full table-fixed` simply
  distributes the slack, which is **already how the calendar renders on mobile today** (a 390px
  phone gives that column ~366px). So desktop starts rendering the calendar the way the user
  already sees it on a phone — no new visual state is introduced.
- The right column is already effectively pinned at 384px whenever procedures/results are loaded,
  so its "after" state is its current widest state.
- Grid total = 24 + 24 + 1.5 (gap) rem = 792px, comfortably inside `max-w-5xl` minus `sm:p-6` at
  the 1024px `lg` breakpoint. `lg:justify-center` keeps it centred, now at a constant width.

This is **not** the reverted approach: no `min-height`, no layout animation, no framer-motion
`layout`, and it targets width (the axis the user actually described) rather than height.

### Deliberately NOT doing

- Not touching `PanelRenderer`'s state machine, `useBookingManagementState`, or any panel's markup
  or logic.
- Not adding a universal fixed/min height to the panel container — `ResultsPanel` is unbounded
  (already capped at `max-h-[35rem]` + scroll by `BookingManagement.tsx:224`), so one fixed height
  would either clip or waste space, and a static `min-height` is the shape the user already
  rejected once.
- Not removing the `transition-all` on the panel wrapper — per the analysis above it does not
  animate height; it only fades the panel in/out on open/close, which is wanted.
- Vertical (height) stabilization is deferred to **Stage 2 below, conditional on the user still
  reporting vertical jumping after Stage 1** — Stage 1 alone is expected to resolve the report.

### Risk posture

Stage 1 is a single class change, entirely behind `lg:`. Mobile (`<lg`) markup is byte-identical
and its layout is already width-stable (`w-full max-w-sm mx-auto` in normal block flow, no grid),
so mobile regression risk is structurally zero.

## Implementation Steps

### Stage 1 — desktop track determinism (required)

- [x] Step 1: Replace the content-sized desktop grid tracks with fixed ones
  - Files: `src/app/[masterId]/page.tsx` (line 284, the `motion.div` className)
  - Details: change `lg:grid-cols-[auto,auto]` → `lg:grid-cols-[24rem_24rem]`. Leave every other
    class on that element untouched (`mt-4 space-y-6 lg:grid lg:items-start lg:justify-center
    lg:gap-6 lg:space-y-0`), and leave the framer-motion `initial`/`animate`/`transition` props
    alone. Tailwind v3 arbitrary-value syntax: underscore = space (comma also works, but use the
    underscore form).
  - Do **not** remove `w-full max-w-sm mx-auto` from either column wrapper (lines 295 and 366) —
    those still drive the mobile layout.
  - Add a short comment above the `motion.div` in the existing bilingual comment style of this
    file, e.g.: *"Fixed 24rem tracks (= the `max-w-sm` both columns already declare). `auto` tracks
    were sized from content max-content width, so any text-length change (procedures loading,
    panel switch, slots appearing, language switch) resized both columns and slid the centred grid
    sideways."*

- [x] Step 2: Verify the two secondary suspects, change nothing unless the check fails
  - Files: `src/components/ProcedureSelect.tsx` (read-only unless a defect is found)
  - Details: after Step 1, re-check in the browser that (a) the procedure card no longer changes
    width between the `common.loading` state and the loaded state, and (b) the closed-state button
    text going from one line (`booking.selectService`) to two lines (a long selected
    `"<name> - <min> min / <price> zł"`, `whitespace-normal break-words`) only ever happens at the
    moment the user picks a service — i.e. it is direct feedback to a click, not spontaneous
    jitter. If (b) holds, **leave `ProcedureSelect.tsx` unchanged** and say so in the handoff; do
    not add a two-line `min-h` (it would permanently waste a line of vertical space on the
    placeholder state). If a real spontaneous 1↔2 line flip is observed (e.g. on language switch
    with a selected service), report it — do not fix it ad hoc in this stage.
  - **Result (static analysis — no dev server per standing rule, so no live browser check was
    possible):** (a) confirmed by code reading. `ProcedureSelect.tsx` has no width of its own; its
    outer wrapper is `w-full max-w-sm mx-auto` (page.tsx:295), and `w-full` now resolves against
    the page's fixed `24rem` grid track instead of a content-sized `auto` track, so neither the
    `isLoading` → loaded transition nor any other content change inside `ProcedureSelect` can move
    the column width anymore — text can only wrap (`whitespace-normal break-words`), not widen the
    track. (b) **not confirmed — a real spontaneous flip exists and was left unfixed per the plan's
    instruction.** `formatProcedure()` (line 64-79) calls `resolveLocalized(...)` and
    `t('booking.minutes')`, both of which depend on `language` from `useCurrentLanguage()`. If a
    service is already selected and the user switches UI language, the closed button's text
    re-renders with a different-language name/unit string of different length **without any click**
    — this can spontaneously flip the button between one and two lines. This matches exactly the
    "real defect" case the plan calls out; left unfixed, not addressed in this stage.

- [x] Step 3: Lint + existing test suite
  - Details: run `npm run lint` (zero warnings tolerance) and `npm run test`. Expect both to be
    unaffected — this change is CSS-class-only.
  - **Do NOT run `npm run dev` or `npm run build`** (standing user rule: a one-shot build can
    corrupt `.next/` under the user's concurrently running dev server). This overrides the
    "`npm run build` after layout changes" line in `src/app/AGENTS.md` for this task.
  - **Result:** `npm run lint` → 79 problems (74 errors, 5 warnings), identical count before
    (confirmed via `git stash`) and after this change — all pre-existing, none in
    `[masterId]/page.tsx` introduced by this edit (that file's one pre-existing error, `'Image' is
    defined but never used`, was already there). `npm run test` → 51 test files / 550 tests, all
    passed. Neither `npm run dev` nor `npm run build` was run.

- [x] Step 4: Tests
  - Details: no new automated test. This is pure CSS/layout behavior with no component test layer
    in the repo (`src/components/AGENTS.md` → Verification: "manual browser verification for UI
    changes"). State this explicitly in the handoff rather than adding a token test.
  - **Result:** confirmed — no test added, per plan.

- [x] Step 5: DOX pass for Stage 1
  - Files: `src/app/AGENTS.md`
  - Details: add one bullet under **Local Contracts** recording the durable rule, e.g.:
    *"`[masterId]/page.tsx`'s desktop two-column grid uses fixed `lg:grid-cols-[24rem_24rem]`
    tracks (= the `max-w-sm` both column wrappers declare), never `auto` — `auto` tracks are sized
    from content max-content width, so procedures loading, a `BookingManagement` panel switch,
    slots appearing or a language switch re-measured both tracks and slid the centred grid
    sideways (2026-07-28 and 2026-09-22 jitter reports). Mobile keeps `w-full max-w-sm mx-auto`
    block flow, which is already width-stable."*
  - No other AGENTS.md changes for Stage 1 (nothing under `src/components/` is touched). Report
    that explicitly.

- [ ] Step 6: **STOP — user checkpoint.** Do not start Stage 2. Hand back with the Manual
  Verification checklist below and wait for the user's live verdict.

### Stage 2 — loading-state height floor (ONLY if the user reports remaining vertical jumping)

Gate: start this only if, after Stage 1 is verified live, the user still reports the box
growing/shrinking **vertically** during the search → loading → results cycle. If Stage 1 resolved
the complaint, delete this stage from the plan as not needed.

- [ ] Step 7: Add a measured, loading-only height floor hook
  - Files: new `src/components/booking-management/hooks/usePanelHeightFloor.ts`
  - Details: `src/components/booking-management/AGENTS.md` forbids growing `BookingManagement.tsx`
    (297 lines) — the logic goes in a new hook file, matching the existing `hooks/use*.ts` naming.
    Shape: `usePanelHeightFloor(state: ManagementState, ref: RefObject<HTMLElement>): number |
    undefined`. It records `ref.current.offsetHeight` after every render in a **non**-`loading`
    state into a `useRef`, and when `state === 'loading'` returns that recorded value; returns
    `undefined` in every other state so all other panels keep their natural height. Use
    `useEffect` (not `useLayoutEffect` — this file is SSR-rendered and the repo has no
    isomorphic-layout-effect helper); a one-frame settle is acceptable here.
  - This is deliberately different from the reverted static `min-height`: it is dynamic, applies to
    exactly one transient state, and never reserves space for a panel the user is actually reading.

- [ ] Step 8: Wire it into the panel container (3 lines max)
  - Files: `src/components/booking-management/BookingManagement.tsx`
  - Details: add a `useRef<HTMLDivElement>` on the **inner** container (line 224, the one with
    `max-h-[35rem] overflow-y-auto`), call the hook, and apply `style={{ minHeight: floor }}` to
    that same element. Do not restructure the wrapper at line 219, do not touch its className, do
    not add any new transition.

- [ ] Step 9: Stage 2 lint + DOX
  - Details: `npm run lint` + `npm run test` (same build/dev prohibition as Step 3). Add the new
    hook to `src/components/booking-management/AGENTS.md` **Local Contracts** (one bullet: what it
    does, that it only applies in the `loading` state, and that a static panel-wide `min-height`
    was rejected in 2026-07-28 and must not be reintroduced).

- [ ] Step 10: **STOP — user checkpoint.** Hand back for live verification.

## Acceptance Criteria

- [ ] `npm run lint` passes with zero warnings; `npm run test` is green (unchanged).
- [ ] `npm run build` / `npm run dev` were **not** run.
- [ ] Stage 1 touches exactly one line of markup in `src/app/[masterId]/page.tsx` plus a comment
      (and `src/app/AGENTS.md` for the DOX pass). No changes to `PanelRenderer.tsx`,
      `useBookingManagementState.ts`, any panel component, or any booking/search/cancel logic.
- [ ] Below `lg`, the rendered class strings are unchanged — mobile layout is provably untouched.
- [ ] On desktop, neither column changes width and the grid does not slide horizontally when:
      procedures finish loading, a service is selected, the management panel opens/closes, panels
      switch (search → loading → results / not-found → contact-master → …), slots load, or the UI
      language is switched.
- [ ] No `min-height`, no layout animation, and no framer-motion `layout` prop was added in
      Stage 1 (the 2026-07-28 reverted approach is not recreated).
- [ ] The calendar card, now rendered at the full 24rem on desktop, looks correct (day circles
      stay 40px and centred, header arrows still at the edges, no clipping by the card's
      `overflow-hidden`).

## Manual Verification (чеклист для пользователя — проверить вживую)

Перед проверкой перезапусти dev-сервер (изменился только CSS-класс, но перезапуск исключит
кеш-артефакты). Проверяй на `/[masterId]`.

**Десктоп (окно шире 1024px) — главное:**

1. Открой страницу и смотри на обе колонки в момент загрузки процедур: виджет услуги больше не
   должен дёргаться в ширину, когда список подгрузился.
2. Выбери услугу с самым длинным названием — колонка не должна менять ширину (текст может перейти
   на вторую строку в кнопке — это нормально, это ответ на твой клик).
3. Открой «Zarządzanie rezerwacją» → закрой → снова открой: ширина обеих колонок не меняется,
   страница не «съезжает» вбок.
4. Сделай поиск, который **находит** брони (имя + телефон реальной брони): search → загрузка →
   результаты. Ширина колонок постоянна на всех трёх шагах.
5. Сделай поиск, который **ничего не находит** (случайные имя/телефон): экран «не найдено» — тоже
   без изменения ширины.
6. Пройди по панелям: результаты → выбрать бронь → «Zmień» → выбор времени/процедуры → назад →
   «Skontaktuj się» → назад. Колонки стоят на месте.
7. Выбери дату в календаре и дождись появления слотов — левая колонка не должна расширяться и
   толкать правую.
8. Переключи язык (PL → EN → UK) на разных экранах панели — вот это главный старый баг, вёрстка
   должна стоять намертво.
9. Посмотри на календарь: он стал чуть шире (как на телефоне). Скажи, нормально ли выглядит —
   если слишком «разъехался», это одна цифра (`24rem` → например `22rem` для левой колонки), правим
   за минуту.

**Мобильный (узкое окно / телефон):**

10. Всё то же самое (пункты 1-8) — тут ничего не должно было измениться вообще. Если что-то
    поехало — значит правка задела не тот брейкпоинт, откатываем.
11. Проверь высоту: панель по-прежнему может прыгать по высоте при смене экранов (search →
    загрузка → результаты). Скажи, мешает ли это — если да, делаем Stage 2 (отдельная правка,
    динамический пол высоты только на время загрузки).

## Constraints & Risks

- **Do not touch** `PanelRenderer.tsx`, `state/useBookingManagementState.ts`,
  `hooks/useBookingMutations.ts`, `hooks/useBookingHandlers.ts`, `api/bookingManagementApi.ts`, or
  any panel component's logic — this is the live client booking flow.
- **Do not** restore the 2026-07-28 approach (static `min-height` + layout animation): ROADMAP
  records the user testing and reverting it.
- **Do not** run `npm run dev` or `npm run build` (standing user rule — can corrupt `.next/` under
  the user's running dev server). `npm run lint` and `npm run test` only.
- No new dependencies; nothing in this plan needs one (framer-motion is present but intentionally
  unused for this fix).
- File-size cap 500 lines: `BookingManagement.tsx` (297) and `PanelRenderer.tsx` (423) must not
  grow — Stage 2's logic therefore lives in a new hook file.
- Tuning knob, not a redesign: if the user dislikes the wider desktop calendar, the only change is
  the left track value in the same single class (e.g. `lg:grid-cols-[22rem_24rem]`); the left
  wrapper's `max-w-sm` simply stops binding and nothing overflows (7×40px day grid + 32px card
  padding = 312px still fits).
- Out of scope: admin calendar/settings pages; any booking business logic; the homepage. Note for
  later, do not act on it now: `lg:grid-cols-[auto,...]` appears **only** on this page (verified by
  grep across `src/`), so there is no sibling page to fix.
