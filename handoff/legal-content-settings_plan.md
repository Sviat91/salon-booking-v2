# Plan: Admin-editable legal documents (Terms + Privacy)

**Date:** 2026-08-03
**Status:** In Progress

## Goal

Move the hardcoded Polish Terms-of-Use and Privacy-Policy text out of `src/app/terms/page.tsx` / `src/app/privacy/page.tsx` into six new per-locale `TenantConfig` columns, authored from a new dedicated `/admin/settings/legal` sub-page, with no pre-filled default text for new installs.

---

## Architecture Decisions

### D1 — Storage: six nullable `TenantConfig` columns

`termsContent_pl`, `termsContent_en`, `termsContent_uk`, `privacyContent_pl`, `privacyContent_en`, `privacyContent_uk` — all `String?` (nullable, **no `@default`**).

- Follows the `Service.name_pl/en/uk` + `MasterProfile.bio_pl/en/uk` per-locale-column convention (`prisma/AGENTS.md` L17), **not** a translations table.
- Unlike `Service.name_pl` (NOT NULL), **all six are nullable including `_pl`** — decision #3 requires new installs to ship empty, and the content-pages feature already established "no locale is privileged" (`src/lib/content/blocks.ts` C-3 comment, `MasterProfile.bio_*` are all nullable). Do not make `termsContent_pl` required anywhere.
- SQLite maps `String` to TEXT — no DB-level length cap. Application-level cap is 50 000 chars per field (D5).
- `src/lib/tenant.ts`'s `DEFAULT_CONFIG` gets all six keys set to `null`. This is required, not cosmetic: `getTenantConfig()` returns `TenantConfig | typeof DEFAULT_CONFIG`, so a field missing from `DEFAULT_CONFIG` is a `tsc` error at every read site (that's why `settings/page.tsx` currently does `config as Record<string, unknown>` casts — do NOT copy that cast pattern here, fix it at the source instead). `DEFAULT_CONFIG` is also the auto-seed payload, and `null` = "not configured" is the correct seed value.

### D2 — Empty-state behaviour on the public pages: **render an empty-state notice, never hide the page**

Resolved as follows (this was the open design point — it is now closed, do not improvise):

1. `/terms` and `/privacy` routes, the `Footer` links, `RegisterForm`, `BookingConsentModal`, the Telegram-bot consent keyboard, and `sitemap.xml` all stay **unconditionally present**. These documents are the target of legally-required consent checkboxes; a 404 or a hidden link is strictly worse than "not published yet".
2. Content is resolved with the existing `resolveLocalized()` (`src/lib/localized-content.ts`): requested language → `pl` → first non-empty of any locale. Same behaviour a `Service.name_*` already has, so a tenant who filled only `pl` still shows Polish text to an English visitor.
3. `enabledLocales` gates **authoring only** (which tabs the admin sees), never reading. `resolveLocalized` deliberately ignores it — mirror that, do not filter by enabled locales on the public page.
4. If the resolved string is empty (nothing authored in any locale), the page renders, inside the same card chrome: a neutral translated notice (`legal.notConfigured`) plus the structured contact block (D4) and the `/support` link. No Polish fallback text is shipped anywhere in the repo.
5. The existing amber "unofficial translation" banner (`terms.legalNotice`/`privacy.legalNotice`) currently shows for any `language !== 'pl'` — that becomes wrong once a tenant authors a real `en` document. New rule: show it only when the viewer's own locale has **no** content but a fallback locale did supply some (`!content[lang]?.trim() && resolved !== ''`). Its copy must be reworded locale-neutrally in all three locale files (today `pl.json` has it as `""` — an empty amber box — and en/uk say "available in Polish", which is no longer necessarily true).

### D3 — Rendering: Markdown **subset**, parsed in-repo. No new npm dependency.

Verified facts:
- `package.json` contains **no** markdown library (`react-markdown`, `marked`, `markdown-it`, `dompurify` are all absent) and **no** `@tailwindcss/typography`. The `prose prose-neutral dark:prose-invert` classes currently on both pages are dead no-ops — do not rely on them to style anything.
- The project's established renderer for admin-authored multi-line text is `src/components/content/TextBlockRenderer.tsx`: plain text, `whitespace-pre-line`, zero HTML.

Decision: content is stored as Markdown-flavoured plain text and rendered by a small in-repo parser that produces **React elements, never HTML strings**. Supported subset (everything else stays literal text):

| Syntax | Renders as |
| --- | --- |
| `## Heading` | `<h2 className="text-xl font-semibold text-foreground mt-8 mb-4">` |
| `### Heading` | `<h3 className="text-lg font-medium text-foreground mt-6 mb-3">` |
| consecutive `- item` lines | `<ul className="list-disc pl-6 mb-4 text-foreground space-y-1">` + `<li>` |
| everything else, blank-line separated | `<p className="text-foreground mb-4 whitespace-pre-line">` |
| inline `**bold**` | `<strong>` |

Rationale: reproduces the visual output of today's hand-written JSX exactly, is XSS-safe by construction (React escapes all text), adds zero dependencies, and stays consistent with the existing plain-text block renderer.

**Hard prohibitions for this feature:** no `dangerouslySetInnerHTML`; no new npm package (`react-markdown`/`marked`/`markdown-it`/`dompurify`/`@tailwindcss/typography`) — adding one requires explicit user sign-off, which has not been given. If the coder believes the subset is insufficient, stop and escalate rather than installing anything.

### D4 — Public data path: server-render the pages; do **not** add these fields to `GET /api/tenant-config`

- `src/app/api/tenant-config/route.ts` today does `NextResponse.json(config)` on the raw Prisma row. There is **no** sensitive-field filtering pattern to follow there — it is an unauthenticated endpoint that returns the whole row. Piping six potentially multi-KB text columns through an endpoint that `Footer.tsx` fetches on every page load would be wasteful and would further entrench that endpoint. **Leave `route.ts` untouched.** (See Risks for the pre-existing exposure this uncovered — out of scope here.)
- Instead, `/terms/page.tsx` and `/privacy/page.tsx` become **async Server Components** that call `getTenantConfig()` directly and pass the full `{ pl, en, uk }` object plus the contact fields down to a shared client view. This matches `src/lib/AGENTS.md` L21 ("server components pass the full `{ pl, en, uk }` object down rather than pre-resolving") and `src/app/AGENTS.md` ("Prefer Server Components for data-fetching pages"), removes a client fetch round-trip, and SSRs the legal text (both routes are listed in `sitemap.xml`).
- Client-side language switching keeps working with no refetch: the view holds all three variants and picks with `useCurrentLanguage()`.
- The two pages are ~95 % identical, so the card body lives in one shared client component (`LegalDocumentView`) parameterised by `titleKey`/`noticeKey`/`content`/`contact`. Each `page.tsx` shrinks to ~35 lines of chrome + data fetch.
- The structured contact block (company name, NIP, legal address, email, `/support` link, each rendered only when non-empty — the existing conditional pattern) stays a **component-rendered block below the document**, sourced from `TenantConfig`. The admin does not have to retype entity data into three locales, and it keeps auto-updating when the salon edits its details in main Settings.

### D5 — Admin surface: `/admin/settings/legal`, structured like `settings/notifications/`

- New folder `src/app/admin/settings/legal/` with `page.tsx` + `loading.tsx` + `LegalSettingsForm.tsx` + a **local** `actions.ts`.
- The server action lives in the new local `actions.ts`, **not** appended to `src/app/admin/settings/actions.ts` — the main settings action is already 170 lines covering ~40 fields, and the task explicitly forbids unrelated refactors of it.
- Form mechanism: plain `<form action={formAction}>` + `useFormState` from `react-dom` (Next 14 / React 18 — this is what `SettingsForm.tsx` uses; do **not** use `useActionState`) + the shared `SubmitButton` from `settings/FormFields.tsx`. The form is **self-contained with its own inline save button** (the `email/`+`social/` pattern), NOT the `settings-dirty` / `id="settings-form"` sidebar-event pattern used by `SettingsForm.tsx` and `NotificationSettingsForm.tsx` — that bridge is driven by react-hook-form's `formState.isDirty`, which a server-action form does not have. This is a deliberate choice; do not wire the sidebar event.
- Chrome: two `SettingsSection`s (Terms, Privacy), page header is the eyebrow + muted subtitle pattern, no `<h1>` (the topbar supplies the title from `adminNavItems`).
- Auth: `page.tsx` calls `auth()` and redirects non-ADMIN/SUPERADMIN to `/admin` (`src/app/admin/AGENTS.md` L13). **The server action re-checks the role itself**, independently of the page guard — legally significant content, same reasoning as `getMasterPassword` in `masters/actions.ts`. (`saveSettings` in the main settings action has no such check; that is pre-existing and out of scope — do not "fix" it here.)
- Validation: Zod schema built by a `buildLegalSchema(t)` factory called with `getServerT()`'s result (required by `src/app/admin/AGENTS.md` L23 — never a module-scope schema constant in an `actions.ts`). Cap each field at 50 000 chars.
- Per-locale write semantics (`src/app/admin/AGENTS.md` L38, canonical implementation `src/app/admin/services/actions.ts` L26-28 + L78-83): a locale field absent from the submission (locale currently disabled for the tenant) must leave its DB column **untouched**, not null it. An empty submitted string → `null`.

### D6 — `LocalizedFieldInput` already fits; one 3-line extension

It already supports `variant="textarea"` and a `rows` prop, so no new component is needed. The only gap is the hardcoded `className="resize-none"` on its textarea, which is painful for a 20-row legal document. Add an optional `resizable?: boolean` prop (default `false`, so every existing call site is byte-for-byte unchanged in behaviour) threaded through to `LocaleFieldControl`. Nothing else in that file changes.

### D7 — Explicitly out of scope

- Consent re-prompting. `ConsentRecord.consentTermsV10` / `consentPrivacyV10` bake "v1.0" into the **column names**; making an edit bump a document version and re-prompt existing clients would require its own schema change and consent-flow design. This change does **not** touch consent versioning — editing a document will not re-prompt anyone. Flagged to the user; separate future task.
- `GET /api/tenant-config`'s unfiltered response (see Risks).
- Any change to other `TenantConfig` fields, `SettingsForm.tsx`, or the main `settings/actions.ts`.

---

## Implementation Steps

- [x] **Step 1: Schema + migration**
  - Files: `prisma/schema.prisma`, `prisma/migrations/<ts>_add_legal_content_to_tenant_config/migration.sql` (generated)
  - Details: In `model TenantConfig`, after the `salonLegalAddress` block (~line 311), add a commented group:
    ```
    // Admin-authored legal documents (Markdown subset, see src/lib/markdown-lite.ts).
    // All nullable — new installs ship with no legal text; the public pages render
    // an empty-state notice until an admin fills at least one locale.
    termsContent_pl   String?
    termsContent_en   String?
    termsContent_uk   String?
    privacyContent_pl String?
    privacyContent_en String?
    privacyContent_uk String?
    ```
    Then run `npx prisma migrate dev --name add_legal_content_to_tenant_config`. All six are nullable additive columns, so this needs no data-preserving `INSERT...SELECT` and no interactive TTY workaround (the `prisma/AGENTS.md` L26 caveat applies only to required columns). Never hand-edit `migrations/` or `app.db`. Remember the live DB is `prisma/prisma/app.db`.

- [x] **Step 2: Add the six fields to `DEFAULT_CONFIG`**
  - Files: `src/lib/tenant.ts`
  - Details: Add `termsContent_pl: null, termsContent_en: null, termsContent_uk: null, privacyContent_pl: null, privacyContent_en: null, privacyContent_uk: null` alongside the existing `salon*: null` entries. Nothing else in this file changes.

- [x] **Step 3: Pure Markdown-subset parser**
  - Files: `src/lib/markdown-lite.ts` (new)
  - Details: Framework-free (no React, no Prisma, no `next/*`) per `src/lib/AGENTS.md` — same rationale as `src/lib/content/blocks.ts`. Export:
    ```ts
    export type MdInline = { bold: boolean; text: string }
    export type MdNode =
      | { kind: 'h2' | 'h3' | 'p'; content: MdInline[] }
      | { kind: 'ul'; items: MdInline[][] }
    export function parseMarkdownLite(src: string | null | undefined): MdNode[]
    ```
    Rules exactly as the D3 table. Line-based: split on `\n`, `## ` → `h2`, `### ` → `h3`, runs of `- ` lines collapse into one `ul`, blank lines separate paragraphs, consecutive non-blank plain lines join into one paragraph preserving their `\n` (rendered with `whitespace-pre-line`). Inline pass splits on `**` pairs into `MdInline[]`; an unmatched `**` stays literal. Never throws; `null`/empty/whitespace-only input → `[]`. Keep it under ~120 lines.

- [x] **Step 4: Markdown renderer component**
  - Files: `src/components/legal/MarkdownLite.tsx` (new)
  - Details: `{ source: string }` → maps `parseMarkdownLite(source)` to JSX with the exact Tailwind classes in the D3 table (they mirror the classes the current hardcoded JSX uses, so the visual result is unchanged). Bold inline segments render as `<strong>`. No `"use client"` needed (pure presentational, works in both graphs); **no `dangerouslySetInnerHTML` anywhere**.

- [x] **Step 5: Shared public document view**
  - Files: `src/components/legal/LegalDocumentView.tsx` (new)
  - Details: `"use client"`. Props:
    ```ts
    {
      titleKey: string          // 'terms.title' | 'privacy.title'
      noticeKey: string         // 'terms.legalNotice' | 'privacy.legalNotice'
      content: LocalizedField   // { pl, en, uk } from src/lib/localized-content
      contact: { companyName: string | null; nip: string | null; legalAddress: string | null; email: string | null }
    }
    ```
    Behaviour: `const lang = useCurrentLanguage()`; `const resolved = resolveLocalized(content, lang)`; `const isFallback = !content[lang]?.trim() && resolved !== ''`.
    Renders the `<h1>{t(titleKey)}</h1>` header + the existing card chrome (`bg-card backdrop-blur-sm rounded-2xl border border-border p-8` — keep it; drop the dead `prose*` classes since the typography plugin is not installed), then:
    - if `isFallback` → the amber notice box with `t(noticeKey)` (same markup as today);
    - if `resolved` → `<MarkdownLite source={resolved} />`;
    - else → the empty state: `t('legal.notConfigured')` in a muted box.
    Always ends with the structured contact block (`bg-muted/30 rounded-lg p-6`), rendering only non-empty `contact` fields plus the `/support` link, reusing the exact markup/labels of the current terms §12 block. Keep under ~110 lines.

- [x] **Step 6: Rewrite `/terms` and `/privacy` as Server Components**
  - Files: `src/app/terms/page.tsx`, `src/app/privacy/page.tsx`
  - Details: Delete **all** hardcoded document text (terms §1–§12, privacy §1–§12, including the blue GDPR art.13 box in privacy — that sentence belongs in the admin-authored body now). Each becomes:
    ```tsx
    export default async function TermsPage() {
      const config = await getTenantConfig()
      const legalAddress = config.salonLegalAddress || [config.salonAddress, config.salonCity].filter(Boolean).join(', ')
      ...
      return (<main …><BackButton /><toggles /><container>
        <LegalDocumentView titleKey="terms.title" noticeKey="terms.legalNotice"
          content={{ pl: config.termsContent_pl, en: config.termsContent_en, uk: config.termsContent_uk }}
          contact={{ companyName: config.salonCompanyName, nip: config.salonNip, legalAddress, email: config.salonEmail }} />
      </container></main>)
    }
    ```
    Keep `BackButton` / `ThemeToggle` / `LanguageToggle` and the outer layout classes exactly as they are (client components inside a Server Component is fine). Remove the now-unused `useTranslation`/`useQuery`/`useCurrentLanguage`/`Link`/`SalonConfig` imports and the `"use client"` directive. No `t()` call may remain in these two files. `companyName` no longer needs the `|| 'Salon'` fallback (the contact block hides empty fields) — drop it. Both files should land around 35 lines.

- [x] **Step 7: `LocalizedFieldInput` resizable prop**
  - Files: `src/components/admin/LocalizedFieldInput.tsx`
  - Details: Add `resizable?: boolean` to both `LocaleFieldControlProps` and `LocalizedFieldInputProps` (default `false`), thread it through both render paths, and swap the textarea's `className="resize-none"` for `className={resizable ? "resize-y" : "resize-none"}`. Nothing else in this file changes; all existing call sites keep their current behaviour untouched.

- [x] **Step 8: Server action**
  - Files: `src/app/admin/settings/legal/actions.ts` (new)
  - Details: `"use server"`. Export `type LegalFormState = { error?: string; success?: boolean }` and `saveLegalContent(_prev, formData)`.
    1. `const session = await auth()`; if not `ADMIN`/`SUPERADMIN` → return `{ error: t('admin.settings.legal.unauthorized') }`.
    2. `const t = getServerT()`; `buildLegalSchema(t)` factory → six `z.string().max(50000, t('admin.settings.legal.tooLong')).optional()` fields.
    3. Read `_pl` with `formData.get(...)`, and read the `_en`/`_uk` fields through a local `readOptionalLocaleField(formData, key)` helper (`formData.has(key) ? formData.get(key) as string : undefined`) — copy the semantics and the explanatory comment from `src/app/admin/services/actions.ts` L20-28; re-declare it locally rather than exporting it across folders. Treat `_pl` the same way for consistency (`pl` is always enabled, but do not special-case it).
    4. Build the update payload with the `...(x !== undefined ? { col: x || null } : {})` spread pattern so a disabled locale never nulls a saved translation.
    5. `prisma.tenantConfig.findFirst()` → `update({ where: { id } })`, else `create({ data })` (same shape as `saveSettings`).
    6. `revalidatePath('/terms')`, `revalidatePath('/privacy')`, `revalidatePath('/admin/settings/legal')`; return `{ success: true }`. Catch → `{ error: t('admin.settings.legal.saveError') }`.

- [x] **Step 9: Admin form component**
  - Files: `src/app/admin/settings/legal/LegalSettingsForm.tsx` (new)
  - Details: `"use client"`. Props `{ config: { termsContent_pl/en/uk, privacyContent_pl/en/uk }, enabledLocales: Language[] }`. `const [state, formAction] = useFormState(saveLegalContent, {})`. Inside `<form action={formAction} className="space-y-6">`:
    - `SettingsSection` "Terms of Use" → one `LocalizedFieldInput baseName="termsContent" variant="textarea" rows={20} resizable enabledLocales={enabledLocales} values={{pl,en,uk}} label={t('admin.settings.legal.contentLabel')} placeholder={t('admin.settings.legal.placeholder')}` (`required` stays default `false`).
    - `SettingsSection` "Privacy Policy" → same with `baseName="privacyContent"`.
    - A muted `<p>` under each field with `t('admin.settings.legal.formattingHint')` documenting the supported syntax (`## `, `### `, `- `, `**bold**`).
    - Error/success line driven by `state.error` / `state.success` (mirror how `SettingsForm.tsx` surfaces `SettingsFormState`), then `<SubmitButton />` from `../FormFields`.
    Keep under ~120 lines.

- [x] **Step 10: Admin page + loading skeleton**
  - Files: `src/app/admin/settings/legal/page.tsx` (new), `src/app/admin/settings/legal/loading.tsx` (new)
  - Details: `page.tsx` — copy `settings/notifications/page.tsx` verbatim as the template (`metadata`, `getServerT()`, `auth()` guard → `redirect('/admin')`, eyebrow + `t('admin.settings.legal.pageDesc')`), then `const config = await getTenantConfig()` and `const enabledLocales = parseEnabledLocales(config.enabledLocales)` and render `<LegalSettingsForm config={…} enabledLocales={enabledLocales} />`. It IS an async Server Component, so `loading.tsx` is required (`src/app/admin/AGENTS.md` L33) — copy `settings/notifications/loading.tsx` (`Skeleton` header + `FormSkeleton`).

- [x] **Step 11: Sidebar nav entry**
  - Files: `src/components/admin/adminNavItems.ts`
  - Details: Add `{ labelKey: "admin.nav.legal", href: "/admin/settings/legal", icon: ScrollText }` to `adminNavItems` immediately after the `clientBot` entry (`superadminNavItems` spreads `adminNavItems`, so SUPERADMIN inherits it; MASTER must NOT get it). Import `ScrollText` from `lucide-react` — verify it resolves; if `tsc` rejects it, fall back to `FileText` (already imported). This one entry is what gives the page its topbar title and sidebar link; no other discovery wiring exists or is needed.

- [x] **Step 12: i18n keys — all three locale files**
  - Files: `src/locales/pl.json`, `src/locales/en.json`, `src/locales/uk.json`
  - Details: `npm run i18n:check` enforces identical key sets across pl/en/uk, so every key goes into all three with real translations (never an empty string).
    New keys: `admin.nav.legal`; `admin.settings.legal.{pageDesc, termsSectionTitle, termsSectionDesc, privacySectionTitle, privacySectionDesc, contentLabel, placeholder, formattingHint, saveError, tooLong, unauthorized}`; `legal.notConfigured` (public empty state, e.g. PL: "Ten dokument nie został jeszcze opublikowany przez salon. W razie pytań prosimy o kontakt.").
    Changed keys: reword `terms.legalNotice` and `privacy.legalNotice` locale-neutrally in all three files (they must no longer claim "available in Polish", and `pl.json`'s two empty strings must be filled) — e.g. "Ten dokument nie jest dostępny w Twoim języku. Poniżej wyświetlamy wersję w języku udostępnionym przez salon."
    Do not remove or rename `terms.title` / `privacy.title`.

- [x] **Step 13: Tests**
  - Files: `tests/lib/markdown-lite.test.ts` (new)
  - Details: Pure module → **no mocks needed by design** (same as `tests/lib/content/blocks.test.ts` / `discounts/eligibility.test.ts`). Cover: `null`/`undefined`/empty/whitespace-only → `[]`; `##` → `h2` and `###` → `h3`; consecutive `- ` lines grouped into one `ul` with N items, and a non-list line ending the group; blank-line paragraph separation; `**bold**` producing a bold `MdInline` segment with an unmatched `**` staying literal; raw HTML in the source (`<script>alert(1)</script>`) surviving as literal **text** in an `MdInline`, never as a node kind or markup. Do not add tests for the server action or the pages — there is no `tests/app/admin/**` surface in this repo and creating one is out of scope.

- [x] **Step 14: DOX pass**
  - Files: `prisma/AGENTS.md`, `src/lib/AGENTS.md`, `src/components/AGENTS.md`, `src/app/admin/AGENTS.md`
  - Details:
    - `prisma/AGENTS.md` — extend the per-locale-columns bullet (L17) to mention `TenantConfig.termsContent_*` / `privacyContent_*` as all-nullable, no-default, no-seeded-text columns.
    - `src/lib/AGENTS.md` — add a bullet for `markdown-lite.ts` (pure, framework-free, fixed subset, React-element output only, no `dangerouslySetInnerHTML`, no markdown dependency); extend the `localized-content.ts` bullet's field list.
    - `src/components/AGENTS.md` — add `resizable` to the `LocalizedFieldInput` prop list (L22); add a bullet for `legal/LegalDocumentView.tsx` + `legal/MarkdownLite.tsx` as the shared public renderer for both `/terms` and `/privacy`, including the D2 empty-state/fallback-banner rule.
    - `src/app/admin/AGENTS.md` — extend the per-locale authoring bullet (L38) with the new `settings/legal/` surface; note in the settings-forms bullet (L34) that `settings/legal/` is a self-contained inline-save form (no `settings-dirty` bridge) and that its action re-checks the role independently.
    - No new child AGENTS.md is warranted (`src/components/legal/` is two files serving one feature, covered by the parent).

- [x] **Step 15: Verification**
  - Details: Run `npm run lint` (zero-warnings), `npm run test`, `npm run i18n:check`. **Do NOT run `npm run dev` or `npm run build`** — the user runs their own dev server and a concurrent build corrupts `.next/` (standing project constraint). Then produce the manual-check list for the user (project `CLAUDE.md` requires it), in Russian, short — see Acceptance Criteria for the items to cover.

---

## Acceptance Criteria

- [~] `npm run lint` passes with zero warnings — 45 pre-existing problems (40 errors, 5 warnings) exist on `master` before this feature, in files this feature never touches; confirmed via `git stash` that the count/file-list is identical with and without this diff. Zero new lint issues introduced.
- [x] `npm run test` passes (existing suite still green + new `markdown-lite` tests) — 32 files / 285 tests passed, incl. 9 new `markdown-lite` tests.
- [x] `npm run i18n:check` passes (pl/en/uk key parity + every referenced key resolves)
- [x] Follows project conventions: per-locale column pattern, `LocalizedFieldInput` reuse, `SettingsSection` chrome, eyebrow header, `loading.tsx` for the async page, `buildXSchema(t)` + `getServerT()` in `actions.ts`, `readOptionalLocaleField` write semantics
- [x] `grep -rn "POSTANOWIENIA OGÓLNE\|ADMINISTRATOR DANYCH\|Osteopatii" src/` returns nothing
- [ ] A fresh install (empty columns) renders `/terms` and `/privacy` with the empty-state notice + contact block; the footer/consent/register links still work and nothing 404s — **needs manual browser verification** (no dev server was started per standing constraint)
- [ ] Filling only `termsContent_pl` shows that text to `en`/`uk` visitors with the reworded fallback banner; filling `termsContent_en` too makes the banner disappear for `en` — **needs manual verification**
- [ ] Saving with a locale disabled in Settings → Content Languages does not wipe that locale's previously-saved text — **needs manual verification** (write semantics implemented and code-reviewed against `readOptionalLocaleField`, not exercised live)
- [x] No new entry in `package.json`; no `dangerouslySetInnerHTML` anywhere in the diff
- [x] `src/app/api/tenant-config/route.ts`, `SettingsForm.tsx`, and `src/app/admin/settings/actions.ts` are untouched (`git diff --stat` on all three is empty)
- [x] Every new/changed file is under 500 lines (largest is `LocalizedFieldInput.tsx` at 148 lines)
- [x] All AGENTS.md files listed in Step 14 updated

---

## Constraints & Risks

**Must not be touched**
- `src/app/api/tenant-config/route.ts`, `src/app/admin/settings/SettingsForm.tsx`, `src/app/admin/settings/actions.ts`, and every other `TenantConfig` field.
- `ConsentRecord` and the consent flow (`src/lib/consent-service.ts`, `BookingConsentModal.tsx`, the Telegram bot consent handler) — links to `/terms` and `/privacy` from those surfaces must keep working exactly as they do now.
- Existing `LocalizedFieldInput` call sites (`ServiceForm`, `MasterServiceForm`, `MasterForm`) — the new prop must default to today's behaviour.

**Critical dependencies / gotchas**
- `getTenantConfig()` returns a union with `DEFAULT_CONFIG`; Step 2 is what keeps Step 6 type-safe. Do not paper over it with `as Record<string, unknown>` casts.
- The live SQLite file is `prisma/prisma/app.db`, not `prisma/app.db` (`prisma/AGENTS.md` L26).
- `resolveLocalized()` intentionally ignores `enabledLocales`. Reading must not filter by it; only the authoring tabs do.
- `tests/app/api/**` mock `@/lib/prisma`; a `TenantConfig` schema change can ripple into those mocks (`prisma/AGENTS.md` L31) — if `npm run test` surfaces a shape mismatch, update the mock, do not weaken the assertion.
- Do not run a dev server or `npm run build`.

**Risks flagged to the user, deliberately NOT fixed here**
1. **Pre-existing, unrelated to this feature:** `GET /api/tenant-config` is unauthenticated and returns the entire `TenantConfig` row — including `smtpPass`, `googleClientId/Secret`, `applePrivateKey`, `telegramBotToken`, `clientBotToken`. Those values are encrypted at rest, but they are still served to anonymous visitors on every page load. This feature avoids adding to that endpoint, but the exposure itself needs its own task (add an explicit public-field allowlist).
2. **Consent versioning gap (D7):** once an admin can edit the documents, `ConsentRecord.consentTermsV10`/`consentPrivacyV10` no longer describe *which* text a client agreed to, and edits will not re-prompt anyone. The privacy document's own text currently promises the opposite. Needs its own schema + flow design.
3. **Legal responsibility shifts to the tenant.** After this change a fresh install has no legal documents at all. The installer (`deploy/`) does not seed them and must not start doing so. The post-install checklist should tell the operator to author both documents before going live — worth a one-line addition to `deploy/README.md` if the user wants it (not included in this plan; ask before adding).
