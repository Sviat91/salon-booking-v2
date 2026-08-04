# Plan: Admin-configurable theme-toggle icon (client-facing)

**Date:** 2026-08-04
**Status:** In Progress
**Mode:** FULL (Prisma schema change + migration, new admin sub-component, new client-config read path)

## Goal

Let an admin upload custom icons for the client-facing light/dark theme-toggle button (one for light mode, one for dark mode), falling back to today's hardcoded `public/light.png` / `public/dark.png` when unset.

## Scope map (verified by grep, do not re-litigate)

- **In scope:** `src/components/ThemeToggle.tsx` — the client-facing toggle. Rendered at 9 call sites (`layout/Header.tsx`, `home/HomeClient.tsx` ×2, `content/PageRenderer.tsx`, `app/terms`, `app/privacy`, `app/support`, `app/profile`, `app/profile/edit`, `app/[masterId]`), always with **zero props**. All 9 call sites stay untouched.
- **Out of scope:** `src/components/ui/theme-toggle.tsx` (lucide Sun/Moon, used only by `admin/AdminSidebar.tsx`). Do not open it.

## Decisions

### D1 — Column names: `themeToggleIconUrl` / `darkThemeToggleIconUrl`

`TenantConfig` (`prisma/schema.prisma:253-362`) already encodes light/dark asset pairs as *unprefixed light + `dark`-prefixed dark*: `logoUrl`/`darkLogoUrl`, `bgImageUrl`/`darkBgImageUrl`. Follow it exactly:

- `themeToggleIconUrl String?` — icon shown while **light** theme is active (overrides `/light.png`)
- `darkThemeToggleIconUrl String?` — icon shown while **dark** theme is active (overrides `/dark.png`)

Both nullable, no `@default`, placed directly under the existing `darkLogoUrl` line so the branding-asset fields stay grouped. Do **not** use `themeToggleLightIconUrl`/`themeToggleDarkIconUrl` — that inverts the established prefix convention.

### D2 — Independent fallback, **no** light→dark cascade

`LogoDisplay.tsx` cascades (`darkLogoUrl || logoUrl || "/head_logo_night.png"`). The toggle icon deliberately does **not**: each slot falls back to its own static default only.

- light mode → `config.themeToggleIconUrl || "/light.png"`
- dark mode → `config.darkThemeToggleIconUrl || "/dark.png"`

Reason: the two toggle icons are semantically different glyphs (they signal the *action/state*, not a brand mark). Reusing a custom light-mode glyph in dark mode would show the wrong affordance, whereas a logo is the same mark in two colourways. This is a real contract — record it in `src/components/AGENTS.md` (see D9) so nobody "fixes" it into a cascade later.

### D3 — Read path: react-query on the existing `['tenant-config']` key (NOT LogoDisplay's `useEffect`)

`src/components/AGENTS.md` (Work Guidance) is binding here: client components reading branding fields from `/api/tenant-config` use `useQuery({ queryKey: ['tenant-config'], staleTime: 60 * 60 * 1000 })` — canonical implementations are `BrandHeader.tsx:25-29` and `Footer.tsx:13-17`. `LogoDisplay.tsx`'s raw `useEffect` + `fetch` is the outlier, not the convention.

Concrete benefit, not just doc compliance: `BrandHeader` and/or `Footer` render on the same pages as `ThemeToggle`, already on that exact key — so this adds **zero** extra network requests (react-query dedups), whereas a raw `fetch` would add one per page. `QueryClientProvider` wraps the whole client tree (`src/app/providers.tsx:32`, mounted in `src/app/layout.tsx:146`), and all 9 `ThemeToggle` call sites are inside it, so `useQuery` is always safe here.

Each consumer declares its own narrow local type for the shared key (`Footer` → `BrandConfig`, `BrandHeader` → `LogoConfig`); follow suit with a 2-field local type. Do not centralise/unify those types in this pass.

Still **no prop threading**: `ThemeToggle` keeps its zero-prop signature, `Header`/`HomeClient`/`PageRenderer`/page files are not edited.

### D4 — Render custom icons with a plain `<img>`, keep `next/image` for the defaults

`/api/upload` accepts `image/svg+xml` (`route.ts:7`, added earlier today), and `next/image`'s optimizer refuses SVG while `dangerouslyAllowSVG` is off — `next.config.mjs`'s `images` block has no such flag and, per `handoff/favicon-upload-fixes_plan.md` D2, it must stay off. So an admin-uploaded SVG toggle icon rendered through `<Image>` would break at request time (invisible to `tsc`/`lint`).

Branch on "is a custom URL set":

- custom set → `<img src={customIcon} alt={label} width={48} height={48} className="h-12 w-12 object-contain" />`
- otherwise → today's `<Image src={isDark ? '/dark.png' : '/light.png'} ... width={48} height={48} className="h-12 w-12" />`, byte-for-byte unchanged

Keeps the default path optimized (no perf regression for the 100% case), supports SVG/PNG/WebP uploads, and matches the plain-`<img>`-for-uploaded-assets pattern already applied to `FormFields.tsx` and `LogoEditor.tsx`. CSP `img-src 'self'` (`next.config.mjs:32`) already covers `/uploads/*`. ESLint has no `@next/next/no-img-element` rule (`eslint.config.js` doesn't load the Next plugin) and `layout/Header.tsx:27` already ships a plain `<img>` — no lint risk.

Rejected alternative: restricting the toggle-icon `accept` to raster only. The `accept` attribute is a picker hint, not enforcement, and the shared upload endpoint takes SVG regardless — the `<img>` branch is the robust fix.

### D5 — No loading state, no flash

`config` is `undefined` until the query resolves, which naturally yields the static default — i.e. exactly today's first paint. When a custom icon exists it swaps in on resolve, inside the same 48×48 box (no CLS). Do **not** add a skeleton/spinner/null-render while loading: `ThemeToggle` is a persistent header control and would visibly disappear on every page load.

### D6 — Admin UI: new `ThemeToggleIconsSection.tsx`, rendered inside the existing Brand section

Placement recommendation (per the brief, and it holds): keep it on the **main settings page**, in the existing `admin.settings.general.brandSectionTitle` `SettingsSection`, immediately **after** the Favicon field and after `<LogoEditor>` — it's branding, it's two fields, it does not justify a new tab like `settings/legal/` did.

But it cannot be written inline: `SettingsForm.tsx` is **483** lines and `LogoEditor.tsx` is **483** lines; either would blow the 500-line limit. So:

- New file `src/app/admin/settings/ThemeToggleIconsSection.tsx` (`"use client"`, ~90 lines), self-contained: owns its two URL states, upload/uploading/error states, and renders its own hidden inputs. This is the established pattern for settings sub-sections (`LanguagesSection.tsx`, `HomepageWidgetSection.tsx`, `BackgroundSection.tsx` all render form fields inside the parent `<form id="settings-form">` from a child component).
- Props: `themeToggleIconUrl: string | null`, `darkThemeToggleIconUrl: string | null` (initial values), `onChange: () => void` (marks the parent form dirty — same contract as `LanguagesSection`).
- `SettingsForm.tsx` grows by ~8 lines only (1 import + 2 type fields + a 5-line render block) → ~491 lines, still under the limit. Do **not** inline the fields into `SettingsForm` or bolt them onto `LogoEditor`.

### D7 — Reuse `ImageUploadField`, plus one optional `previewTone` prop

Render both fields with `ImageUploadField` from `./FormFields` (already: hidden input wiring, plain-`<img>` preview, remove button, `accept="image/png,image/jpeg,image/webp,image/svg+xml"`, uploading/error UI). One state per field is enough — pass `preview={url || null}` and `fieldValue={url}` from the same string state (`SettingsForm` keeps two parallel states for the favicon; don't copy that redundancy).

`ImageUploadField`'s preview tile is light (`bg-muted/30`), so a light-coloured dark-mode icon would be near-invisible in its preview. Add **one** optional prop, default-off, mirroring `LogoEditor`'s existing dark tile:

```
previewTone?: "light" | "dark"   // default "light"
```

`"dark"` swaps the filled tile to `bg-zinc-800` and the empty tile to `border-zinc-600 bg-zinc-900 text-zinc-400` (copy the class strings from `LogoEditor.tsx:329` and `:340`). The favicon call site passes nothing and is byte-identical in behaviour. No other change to `FormFields.tsx`.

### D8 — Upload handling: local helper, 512px cap, skip resize for SVG

Inside `ThemeToggleIconsSection`, replicate `SettingsForm.tsx:160-185`'s `uploadFile` shape:

```
const processedFile = file.type !== "image/svg+xml" ? await resizeImageIfNeeded(file, 512) : file
```

then `POST /api/upload` with `FormData`, map a non-OK `{ code }` through `t(apiErrorKey(json.code))` (never a raw `error` string — admin AGENTS.md i18n rule), fall back to `t('admin.masters.uploadFailed')`.

512px matches the favicon cap and is far above the 48px render size. SVGs skip the canvas resizer entirely (rasterising a vector defeats the upload).

The ~20 lines of duplication with `SettingsForm.uploadFile` / `LogoEditor.uploadImage` is **deliberate and matches the existing codebase style** (both of those are already per-component copies). Do **not** extract a shared upload util in this pass — that touches two files reviewed earlier today for unrelated reasons.

### D9 — DOX pass

- **`src/components/AGENTS.md`** — must be updated. Its Work Guidance currently ends with "Never hardcode a fallback brand asset (image or name) — an absent `TenantConfig` value means render nothing". `ThemeToggle` now deliberately violates that for `/light.png` / `/dark.png`, so an explicit carve-out is required or a future agent will delete the fallback and leave an empty button. Add one Local Contracts bullet covering: the two new fields, the no-cascade rule (D2), the plain-`<img>`-for-custom / `<Image>`-for-default split (D4), and that the static PNGs are permanent defaults (not "unmigrated brand assets").
- **`prisma/AGENTS.md`** — leave unchanged; two plain nullable asset columns add no new data contract (the rendering contract lives in the components doc). State this explicitly at closeout.
- **`src/app/admin/AGENTS.md`** — leave unchanged; `ThemeToggleIconsSection` is a plain instance of the already-documented settings-sub-section pattern. State this explicitly at closeout.

## Implementation Steps

- [x] **Step 1 — Schema + migration.** `prisma/schema.prisma`: add `themeToggleIconUrl String?` and `darkThemeToggleIconUrl String?` to `TenantConfig`, immediately after `darkLogoUrl` (line ~283), with a one-line comment noting they override `public/light.png` / `public/dark.png` on the client-facing toggle. Then run `npx prisma migrate dev --name add_theme_toggle_icons` (two nullable TEXT `ADD COLUMN`s — no data loss, no interactive-TTY problem; it regenerates the Prisma client too). Never hand-edit `migrations/` or `app.db`.
- [x] **Step 2 — `src/lib/tenant.ts`.** Add `themeToggleIconUrl: null,` and `darkThemeToggleIconUrl: null,` to `DEFAULT_CONFIG`, next to `logoUrl`/`faviconUrl`/`darkLogoUrl` (lines 23-25). Required, not cosmetic: `getTenantConfig()`'s DB-unavailable catch path returns this object, and `admin/settings/page.tsx` spreads it into `SettingsForm`'s typed prop — omitting them is a `tsc` error at Step 6.
- [x] **Step 3 — `src/components/ThemeToggle.tsx`.** Add `import { useQuery } from '@tanstack/react-query'` (in `package.json:27`) and a local `type ThemeToggleConfig = { themeToggleIconUrl: string | null; darkThemeToggleIconUrl: string | null }`. Add the D3 `useQuery` call (`queryKey: ['tenant-config']`, `queryFn: () => fetch('/api/tenant-config').then(r => r.json() as Promise<ThemeToggleConfig>)`, `staleTime: 60 * 60 * 1000`). Hoist the existing label expression into `const label = isDark ? t('theme.switchToLight') : t('theme.switchToDark')` and reuse it for both `aria-label` and `alt`. Compute `const customIcon = isDark ? config?.darkThemeToggleIconUrl : config?.themeToggleIconUrl` and apply D4's two-branch render. Everything else in the file (`isDark` state, `useEffect` sync, `toggleTheme`, `localStorage`, button classes) stays exactly as-is. Zero props, zero call-site edits.
- [x] **Step 4 — `src/app/admin/settings/FormFields.tsx`.** `ImageUploadField`: add optional `previewTone?: "light" | "dark"` (default `"light"`) per D7, applied only to the two preview-tile class strings. No other edits to this file; the favicon call site must keep working unchanged with no new prop.
- [x] **Step 5 — New `src/app/admin/settings/ThemeToggleIconsSection.tsx`.** `"use client"`. Props per D6. Imports: `useState`, `useTranslation`, `Label` (`@/components/ui/label`), `ImageUploadField` (`./FormFields`), `resizeImageIfNeeded` (`@/lib/image-resize`), `apiErrorKey` (`@/lib/errors/apiErrorKey`). Render an `<h3 className="text-base font-semibold">` + muted `<p>` heading pair copying `LogoEditor.tsx:265-270`'s markup, then two `ImageUploadField`s:
  - light: `fieldName="themeToggleIconUrl"`, `label={t('admin.settings.general.themeToggleIconLabel')}`, `hint={t('admin.settings.general.themeToggleIconHint')}`, default `previewTone`
  - dark: `fieldName="darkThemeToggleIconUrl"`, `label={t('admin.settings.general.darkThemeToggleIconLabel')}`, `hint={t('admin.settings.general.darkThemeToggleIconHint')}`, `previewTone="dark"`
  Each `onUpload` runs the D8 helper then `onChange()`; each `onRemove` sets its URL state to `""` and calls `onChange()`. Keep the file well under 500 lines (~90 expected).
- [x] **Step 6 — `src/app/admin/settings/SettingsForm.tsx`.** Add `themeToggleIconUrl: string | null` and `darkThemeToggleIconUrl: string | null` to the local `TenantConfig` type (near `faviconUrl`, line ~43); import and render `<ThemeToggleIconsSection themeToggleIconUrl={config.themeToggleIconUrl} darkThemeToggleIconUrl={config.darkThemeToggleIconUrl} onChange={() => setIsDirty(true)} />` directly after the existing `<ImageUploadField ... fieldName="faviconUrl" ...>` block, still inside the Brand `SettingsSection`. Nothing else in this file changes. Verify the file is still under 500 lines afterwards.
- [x] **Step 7 — `src/app/admin/settings/page.tsx`.** Add `themeToggleIconUrl: c.themeToggleIconUrl as string | null ?? null,` and `darkThemeToggleIconUrl: c.darkThemeToggleIconUrl as string | null ?? null,` to the `fullConfig` object, matching the surrounding defensive style (e.g. the `homepageWidgetBlock` line).
- [x] **Step 8 — `src/app/admin/settings/actions.ts` (persistence).** Three edits mirroring `faviconUrl` exactly: (a) in `buildSettingsSchema`, `themeToggleIconUrl: z.string().optional().default("")` and `darkThemeToggleIconUrl: z.string().optional().default("")` next to `faviconUrl` (line ~15); (b) in `raw`, `themeToggleIconUrl: formData.get("themeToggleIconUrl") || ""` and the dark twin (line ~79); (c) in the `data` object, `themeToggleIconUrl: parsed.data.themeToggleIconUrl || null` and the dark twin (line ~140) so an empty string persists as `NULL`, which is what restores the built-in default. Note: `data` is spread straight into `prisma.tenantConfig.update` — Step 1's migration **must** be applied before this code runs, or every settings save throws.
- [x] **Step 9 — i18n (all three locales).** Insert 6 keys into `admin.settings.general` in `src/locales/{en,pl,uk}.json`, right after `faviconHint` (line 591 in each — identical position/order in all three so the files stay diff-comparable):
  - `themeToggleIconsTitle` — EN "Theme Toggle Icon" / PL "Ikona przełącznika motywu" / UK "Іконка перемикача теми"
  - `themeToggleIconsDesc` — EN "Custom icons for the light/dark switch on client-facing pages. Optional — the built-in icons are used when empty." / PL "Własne ikony przełącznika jasny/ciemny na stronach dla klientów. Opcjonalne — puste pole oznacza ikony wbudowane." / UK "Власні іконки перемикача світла/темна на клієнтських сторінках. Необовʼязково — порожнє поле означає вбудовані іконки."
  - `themeToggleIconLabel` — EN "Toggle Icon (Light Theme)" / PL "Ikona przełącznika (motyw jasny)" / UK "Іконка перемикача (світла тема)"
  - `themeToggleIconHint` — EN "Shown while the light theme is active. PNG, WebP or SVG, max 4 MB. Leave empty for the built-in icon." / PL "Wyświetlana, gdy aktywny jest motyw jasny. PNG, WebP lub SVG, maks. 4 MB. Pozostaw puste, aby użyć ikony wbudowanej." / UK "Показується, коли активна світла тема. PNG, WebP або SVG, макс. 4 МБ. Залиште порожнім для вбудованої іконки."
  - `darkThemeToggleIconLabel` — EN "Toggle Icon (Dark Theme)" / PL "Ikona przełącznika (motyw ciemny)" / UK "Іконка перемикача (темна тема)"
  - `darkThemeToggleIconHint` — EN "Shown while the dark theme is active. Leave empty for the built-in icon." / PL "Wyświetlana, gdy aktywny jest motyw ciemny. Pozostaw puste, aby użyć ikony wbudowanej." / UK "Показується, коли активна темна тема. Залиште порожнім для вбудованої іконки."
- [x] **Step 10 — DOX pass.** Update `src/components/AGENTS.md` per D9. Leave `prisma/AGENTS.md` and `src/app/admin/AGENTS.md` unchanged and say so in the closeout report.
- [x] **Step 11 — Verification.** Run `npm run lint`, `npx tsc --noEmit`, `npm run test`, `npm run i18n:check`. All must be clean apart from issues already present on `master` before this work (note any such pre-existing failure explicitly instead of "fixing" it). **Do NOT run `npm run dev` or `npm run build`** — the user has a dev server running and a build can corrupt `.next/`.
- [x] **Step 12 — Tests.** No new automated tests. There is no component test layer (`src/components/AGENTS.md` Verification: "No dedicated component test layer today"), no new API route, and no `tests/**` file mocks `TenantConfig` (grep-confirmed: zero `tenantConfig` references under `tests/`). Confirm the existing suite still passes (Step 11) rather than inventing a test harness for this.

## Acceptance Criteria

- [ ] Migration `add_theme_toggle_icons` exists under `prisma/migrations/` and adds exactly two nullable TEXT columns to `TenantConfig`; `schema.prisma` matches.
- [ ] With both fields unset (fresh install / after "remove"), the client toggle renders `/light.png` and `/dark.png` exactly as before — same `next/image` element, same 48×48 box, same `aria-label`.
- [ ] Uploading a light-theme icon in Admin → Settings → Brand and saving makes it appear on the client toggle in light mode; dark mode still shows `/dark.png` (no cascade, D2).
- [ ] Same for the dark-theme icon in dark mode, independently.
- [ ] Removing an uploaded icon and saving persists `NULL` and restores the built-in default.
- [ ] An uploaded **SVG** icon renders correctly both in the admin preview and on the client toggle (no broken image, no Next optimizer error) — D4.
- [ ] A large raster upload (e.g. 3000×3000 PNG) is downscaled client-side to ≤512px before hitting `/api/upload`; an SVG is uploaded untouched.
- [ ] `ThemeToggle` still takes zero props; none of its 9 call sites, nor `Header.tsx`/`HomeClient.tsx`/`PageRenderer.tsx`, are modified.
- [ ] `src/components/ui/theme-toggle.tsx` and the admin sidebar toggle are untouched and visually unchanged.
- [ ] `public/light.png` and `public/dark.png` still exist and are still referenced.
- [ ] Every touched file is under 500 lines (`SettingsForm.tsx` ≤ ~491, `FormFields.tsx`, `ThemeToggleIconsSection.tsx`).
- [ ] `npm run lint`, `npx tsc --noEmit`, `npm run test`, `npm run i18n:check` all clean (pre-existing `master` failures called out, not silently absorbed).
- [ ] `src/components/AGENTS.md` updated per D9; unchanged docs justified in the closeout report.

## Constraints & Risks

- **Must not touch:** `src/components/ui/theme-toggle.tsx`; `src/lib/image-resize.ts` (reused verbatim); `src/app/api/upload/route.ts` (already accepts SVG + 4 MB cap + ADMIN/MASTER/SUPERADMIN auth — no change needed); `next.config.mjs` (**never** add `dangerouslyAllowSVG`); `public/light.png`, `public/dark.png`; all 9 `ThemeToggle` call sites; `LogoEditor.tsx`; `LogoDisplay.tsx`.
- **Ordering risk:** Step 8's `saveSettings` spreads validated data straight into `prisma.tenantConfig.update()`. If the schema key exists in Zod but not in the DB, *every* settings save fails at runtime (invisible to `tsc`). Step 1's migration must land first.
- **Type-union risk:** skipping Step 2 (`DEFAULT_CONFIG`) makes `getTenantConfig()`'s return union lack the new fields, breaking `admin/settings/page.tsx` → `SettingsForm` typing. It is a required step, not a nicety.
- **i18n gate:** `npm run i18n:check` fails the build-check if any of the 6 keys is missing from any of pl/en/uk, or if a `t('…')` reference doesn't resolve in all three. All six keys must exist in all three files.
- **Shared-component blast radius:** `ImageUploadField` currently has exactly one other call site (favicon). The new `previewTone` prop must default to today's behaviour so that site is untouched.
- **Shared query key:** `['tenant-config']` is already used by `BrandHeader`/`Footer` with different local TS types. Adding a third narrow type is intended; do not "unify" them or change the key/`staleTime`, and do not touch `['tenant-config-contact']` consumers.
- **No dev server / no build.** `npx prisma migrate dev` is fine (short-lived); `npm run dev` and `npm run build` are not.
- **Pre-existing, not in scope:** `/api/tenant-config` returns the full `TenantConfig` row (including SMTP/OAuth secret columns) to any client. Long-standing behaviour that every branding consumer already relies on — flagged here for visibility only; do not attempt to narrow the endpoint in this pass, it would break `BrandHeader`, `Footer`, `LogoDisplay`, `BookingSuccess*`, and `support/page.tsx` at once.

## Out of scope

- Admin sidebar theme toggle (lucide icons) — stays hardcoded.
- Any refactor of the three duplicated upload helpers (`SettingsForm.uploadFile`, `LogoEditor.uploadImage`, and the new one) into a shared util.
- Migrating `LogoDisplay.tsx` from `useEffect`+`fetch` to react-query.
- Icon sizing/position/animation controls — only the image source is configurable.
- A separate settings tab for these fields (D6: they live in the existing Brand section).

## Ручная проверка (для пользователя, после реализации)

1. Админка → Настройки → Бренд: под «Favicon» появился блок «Ikona przełącznika motywu» с двумя загрузчиками (светлая/тёмная).
2. Загрузить PNG в «светлую», сохранить → на главной в светлой теме иконка переключателя сменилась, в тёмной осталась старая.
3. Загрузить SVG в «тёмную», сохранить → в тёмной теме иконка сменилась, превью в админке не сломано.
4. Нажать крестик на превью, сохранить → вернулись стандартные `/light.png` и `/dark.png`.
5. Проверить переключатель на страницах: `/`, `/[masterId]`, `/terms`, `/privacy`, `/support`, `/profile`.
6. Переключатель темы в админ-панели (боковое меню) не изменился.
