# Plan: Dynamic Open Graph / Twitter preview card

**Date:** 2026-08-06
**Status:** Implemented — automated steps (1-5) done; manual runtime checklist pending user verification (see "Проверка вручную" below)

## Goal

Sharing any link to this site in a messenger (WhatsApp, Telegram, Messenger, Slack, X) must render a real 1200×630 preview card built from the live `TenantConfig` branding — the tenant logo (or the brand name as text) centred on the tenant's own colour gradient — instead of today's image-less card.

---

## Verified current state (re-read this session — do not re-derive)

| Fact | Evidence |
| --- | --- |
| `generateMetadata()` in `src/app/layout.tsx` (L19–45) sets `openGraph` (type/siteName/url/title/description/locale) and `twitter` (card/title/description) but **no `images` on either**. `metadataBase: new URL(siteUrl)` is set (L26), `siteUrl = process.env.NEXT_PUBLIC_SITE_URL \|\| 'https://somique.beauty'` (L16). `export const dynamic = 'force-dynamic'` (L12). | `src/app/layout.tsx` |
| **No other segment defines `openGraph`/`twitter`.** Only `layout.tsx` has them; the 4 `auth/*` pages + 5 `admin/settings/*` pages set title-only metadata. `mergeMetadata` iterates `for (const key_ in source)`, so a child that omits `openGraph` inherits the parent's resolved value verbatim → **one root-segment image covers every page**. | `node_modules/next/dist/lib/metadata/resolve-metadata.js` L128–153 |
| **A single `opengraph-image.tsx` also fills `twitter:image`** — `postProcessMetadata` copies `openGraph.images` into `twitter.images` whenever twitter has no own truthy `images` key. **No `twitter-image.tsx` is needed.** | same file, L407–423 (`if (!hasTwImages) autoFillProps.images = openGraph.images`) |
| File-convention images merge into the segment's own metadata only when `source.openGraph` has no own `images` key — which is our case. | same file, L107–120 |
| `next@14.2.6`. `next/og` → `next/dist/server/og/image-response`, which lazily `import()`s `index.edge.js` **or `index.node.js`** based on `process.env.NEXT_RUNTIME`. **A Node.js runtime build exists and is the default path — `runtime = 'edge'` is neither required nor wanted here.** | `package.json` L38; `next/dist/server/og/image-response.js` L11–13; `next/dist/compiled/@vercel/og/index.node.js` |
| `index.node.js` `readFileSync`s `noto-sans-v27-latin-regular.ttf`, `yoga.wasm`, `resvg.wasm` from its own directory at module init, and registers the Noto face as the **only** default font (`name: 'sans serif'`, weight 700). `render()` uses `fonts: options.fonts \|\| defaultFonts` — passing a `fonts` option **replaces** the built-in face. Default canvas is already 1200×630. | `index.node.js` L18988–19010, L18768–18778 |
| Glyphs missing from that face trigger a **runtime fetch to `fonts.googleapis.com`** (`loadDynamicAsset` → `loadGoogleFont`, `languageFontMap.unknown = 'Noto+Sans'`), wrapped in try/catch that only `console.error`s. Polish diacritics (ł ą ę ś ż ź ć ń) are outside the bundled `latin` subset, so they depend on that fetch; if egress is blocked the PNG still renders, minus those glyphs. | `index.node.js` L18693–18766 |
| satori accepts `<img>` sources only as **PNG / APNG / JPEG / GIF / SVG** (`Unsupported image type` throw otherwise — WebP and AVIF are explicitly rejected), and an SVG without `viewBox` (or without both `width`+`height`) throws `Failed to parse SVG`. `linear-gradient(...)` in `background` is supported. | `index.node.js` L14891 (`Kl`), L14925–14926, L14904–14909, L14314 / L15150 |
| `/api/upload` accepts `image/{png,jpeg,webp,gif,svg+xml}` ≤4 MB and writes to `path.join(process.cwd(), 'public', 'uploads')`, returning `/uploads/<Date.now()>-<rand>.<ext>`. **There is no shared uploads-path helper** — this is the only place the path is built. | `src/app/api/upload/route.ts` L7–8, L44–50 |
| `getTenantConfig()` calls `unstable_noStore()`, returns the single `TenantConfig` row (auto-seeding `DEFAULT_CONFIG` if absent), and falls back to `DEFAULT_CONFIG` if the DB is unavailable — **it never throws**. `logoUrl`/`darkLogoUrl`/`faviconUrl` are `String?`; palette fields are non-null strings. `DEFAULT_BRAND_NAME = 'Salon'`. | `src/lib/tenant.ts`; `prisma/schema.prisma` L253–303; `src/lib/constants/brand.ts` |
| Tenant-config-dependent dynamic routes' convention is `export const runtime = "nodejs"` + `export const dynamic = 'force-dynamic'` — the latter carries an explicit comment that without it Next freezes the first response forever under `next start` while dev mode hides the bug. | `src/app/api/tenant-config/route.ts` L4–9; `src/app/api/masters/route.ts` L13; 60+ `runtime = "nodejs"` API routes |
| The metadata URL for a dynamic image route is `<segment>/opengraph-image?<contenthash-of-the-source-file>` (no route-group suffix here); the route itself is `/opengraph-image/[[...__metadata_id__]]/route`, so plain `GET /opengraph-image` matches. The hash is derived from the **source file**, never from tenant config. | `next/dist/build/webpack/loaders/next-metadata-image-loader.js` L55–59, L81–89; `next/dist/lib/metadata/get-metadata-route.js` L42–57, L77–81 |
| Next's generated dynamic-image route handler returns our `handler(...)` response **untouched** (no header override), and re-exports every named export of our file (so `runtime`/`dynamic`/`size`/`contentType` all take effect). `ImageResponse` itself defaults to `Cache-Control: public, immutable, no-transform, max-age=31536000` in production, overridable via `options.headers`. | `next-metadata-route-loader.js` L120–156, L39–44; `image-response.js` L36–45 |
| **The `opengraph-image` module is also imported by the metadata layer for every page** (`import { size, alt, contentType, … } from '<file>?__next_metadata_image_meta__'`) — so a throw at its module scope, or in any module it statically imports, breaks metadata generation site-wide, not just the card. | `next-metadata-image-loader.js` L62–77 |
| `sharp@0.35.3` is a real `dependencies` entry, is in Next's built-in `server-external-packages.json`, ships an ESM build with a default export, and is currently **imported nowhere in `src/`** (`src/lib/image-resize.ts` is a browser/Canvas-only helper). | `package.json` L49; `next/dist/lib/server-external-packages.json` L43; `sharp/package.json` L115–131 |
| The runner image runs `npm ci --omit=dev` and only copies `.next/standalone/server.js` + `.next` + `src` + `public` — i.e. it has a **real `node_modules`**, not standalone's traced tree. `next` and `sharp` are prod deps, so `@vercel/og`'s wasm/TTF assets and sharp's native binding are present without any tracing or Dockerfile change. | `Dockerfile` L69–70, L88–98 |
| Uploaded files are readable from disk inside the container (`/app/public/uploads/<file>`, AD-5 volume) even though Next's **static serving** can't see runtime-written files (AD-14) — that is exactly why nginx serves `/uploads/` by `alias`. So `fs.readFile` works where an HTTP self-fetch of `/uploads/...` would be fragile. | `deploy/AGENTS.md` AD-5, AD-14; `deploy/nginx.conf.template` L20–22 |
| `src/middleware.ts` matcher is `["/admin/:path*", "/auth/login", "/profile/:path*"]` — `/opengraph-image` is not intercepted. nginx proxies everything except `/uploads/` to the app. | `src/middleware.ts` L68–70 |
| ESLint flat config does **not** include `eslint-config-next`/`jsx-a11y`, so `<img>` needs no `eslint-disable` (`@next/next/no-img-element` and `alt-text` are not enforced here). `@typescript-eslint` recommended + `react` recommended are on; `no-console` is off. | `eslint.config.js` |
| Vitest: `environment: 'node'`, `@` → `src` alias, `tests/setup/env.ts` auto-loaded. `tests/lib/**` mirrors `src/lib/**`. | `vitest.config.ts`; `tests/AGENTS.md` |

---

## Architecture Decisions

### AD-1 — `src/app/opengraph-image.tsx` only; no `twitter-image.tsx`, no changes to `layout.tsx`

The root-segment file convention is the whole mechanism: Next merges the generated image into `openGraph.images` (because `layout.tsx` declares no `images`), then auto-fills `twitter.images` from it, then every child segment inherits both because none of them redefine `openGraph`/`twitter`. All three links in that chain are verified above. `layout.tsx` therefore gets **zero diff** — adding `images` there by hand would *suppress* the file-convention merge.

Rejected: a hand-rolled `src/app/api/og/route.tsx` + explicit `images: ['/api/og']` in `layout.tsx` (more code, loses `og:image:width/height`/`type` for free, and duplicates a first-class framework convention); per-master or per-page images via `generateImageMetadata` (out of scope — one `TenantConfig` per deployment, one card).

### AD-2 — Node.js runtime, `force-dynamic`, explicit both

`export const runtime = 'nodejs'` + `export const dynamic = 'force-dynamic'`, matching the tenant-config route convention verbatim. Node is required, not merely acceptable: the card reads the logo off local disk (`fs`) and normalises it with `sharp`, neither of which exists on the edge runtime — and this app is a standalone Docker container behind nginx, never Vercel Edge. `next/og` has a first-class Node build, so nothing is lost. `force-dynamic` is load-bearing twice over: without it Next prerenders the PNG at build time (inside the Docker builder stage, which has no real database — baking a default-branded card into the image forever), and `next start` would then serve that frozen PNG for the life of the container.

### AD-3 — Read the logo from disk, normalise through `sharp`, never fetch over HTTP

`TenantConfig.logoUrl` is a `/uploads/<file>` path on a mounted volume in the same container. `fs.readFile` is both simpler and strictly more reliable than a self-fetch: AD-14 in `deploy/AGENTS.md` documents that runtime-uploaded files are invisible to Next's own static serving, so `fetch('http://127.0.0.1:3000/uploads/x.png')` would 404, and going out through the public domain adds DNS/TLS/egress dependencies for a file that is already local.

The bytes then go through `sharp` (lazy `await import('sharp')`) rather than straight into a data URI, for three concrete reasons, each a verified failure otherwise: (1) `/api/upload` accepts **WebP**, which satori rejects outright with `Unsupported image type`; (2) satori throws on an SVG lacking `viewBox`/`width`+`height`, and admins upload arbitrary SVGs; (3) satori needs the display size, and the only dimensions in the DB (`logoWidth`/`logoHeight`, default 200×80) are the *site header* display box, not the file's real aspect ratio — using them would distort logos. `sharp` outputs a PNG plus its true `info.width/height`, which solves all three in ~15 lines. It is already a production dependency present in the runner image, and is in Next's external-packages list so it is never bundled.

The import is **dynamic and inside the try/catch** specifically because this file's module graph is evaluated during metadata generation for every page (verified above): a missing/broken native binding must degrade to the text card, never take the site's `<head>` down.

Rejected: extension/magic-byte allow-listing without sharp (silently drops WebP logos and still can't size anything); committing a resized logo copy at upload time (changes the upload contract and needs a migration for existing rows).

### AD-4 — Layout: gradient from `primaryColor` → `secondaryColor`; logo if set, else brand name

Product decision, not up for re-litigation: `background: linear-gradient(135deg, primaryColor 0%, secondaryColor 100%)` (135° is the tenant's own default gradient angle), with the logo centred, fitted into an 800×340 box; when `logoUrl` is unset **or** unreadable, the brand name renders instead at a size chosen from its length. Never blank, never white-only.

Deliberate narrowings: `darkLogoUrl` is **not** a fallback (a light-on-dark logo would be invisible on this light gradient) and `faviconUrl` is **not** a fallback (16–64 px upscaled is worse than clean text). Small raster logos are upscaled at most 2× (`LOGO_MAX_UPSCALE`) — a crisp small logo beats a blurry stretched one. Nothing else is drawn: no tagline (the Polish description would depend on the Google-Fonts glyph fetch for `ę`), no URL, no decoration.

### AD-5 — Built-in font only; never pass a `fonts` option

`ImageResponse` already ships a Noto Sans face; passing `fonts` *replaces* it (verified `fonts: options.fonts || defaultFonts`), so a custom-font "improvement" would remove the fallback rather than add to it. No font binary is added to the repo. Missing glyphs (Polish diacritics) are fetched from Google Fonts at render time by satori itself and degrade to dropped glyphs — never an error — if egress is blocked. Only weight 700 exists in the built-in face, so `fontWeight` is decorative; do not build a design that depends on multiple weights.

### AD-6 — `Cache-Control: public, max-age=300, s-maxage=300`

`ImageResponse`'s production default is `public, immutable, no-transform, max-age=31536000`, which is wrong for an admin-editable image: the metadata URL's `?<hash>` is a hash of the **source file**, so it does not change when the admin swaps the logo or the palette — an immutable year-long TTL would pin a stale card. 5 minutes keeps "change logo → reshare → see it" true while collapsing crawler bursts (several bots fetch the same URL within seconds of a share). This is not the `s-maxage=86400` used by `robots.txt`/`sitemap.xml`; those are effectively static, this is not.

### AD-7 — Pure helpers in `src/lib/og-image.ts`, thin route file

Colour validation, brand-name truncation, the font-size ladder, and the `/uploads/` path guard are pure and get unit tests (repo precedent: `content/photo-ids.ts`, `discounts/eligibility.ts`); the route file keeps only JSX + config exports. This also keeps the route's static import graph tiny — `node:fs/promises`, `node:path`, and nothing else at module scope. `TenantConfig` colours are admin-typed free text, so they are hex-validated before being interpolated into a CSS string (a malformed value would otherwise reach satori's parser).

---

## Implementation Steps

- [x] **Step 1: New module `src/lib/og-image.ts`** (new file, ~90 lines)
  - Files: `src/lib/og-image.ts`
  - File doc comment must state: helpers for the site-wide OG card; **the OG route's module graph is evaluated during metadata generation for every page, so nothing here may throw at module scope and no helper may throw at all**; no top-level `sharp` import.
  - Exact contents:
    ```ts
    import { readFile } from 'node:fs/promises'
    import path from 'node:path'

    export const OG_SIZE = { width: 1200, height: 630 } as const

    /** Box the logo is fitted into, in OG-canvas pixels. */
    const LOGO_BOX = { width: 800, height: 340 } as const
    /** A crisp small logo beats a blurry stretched one — cap upscaling. */
    const LOGO_MAX_UPSCALE = 2
    const BRAND_MAX_CHARS = 48
    const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/
    /** Only `/uploads/<safe-name>`: no traversal, no subdirs, no absolute URLs. */
    const UPLOAD_URL = /^\/uploads\/[A-Za-z0-9._-]+$/

    /** TenantConfig colours are admin-typed free text and end up inside a CSS string. */
    export function safeColor(value: string | null | undefined, fallback: string): string {
      const trimmed = value?.trim() ?? ''
      return HEX_COLOR.test(trimmed) ? trimmed : fallback
    }

    export function truncateBrandName(name: string | null | undefined, fallback: string): string {
      const trimmed = (name ?? '').trim() || fallback
      return trimmed.length > BRAND_MAX_CHARS ? `${trimmed.slice(0, BRAND_MAX_CHARS - 1)}…` : trimmed
    }

    /** Font-size ladder so a long brand name still fits the 1200×630 canvas. */
    export function brandFontSize(name: string): number {
      if (name.length <= 14) return 104
      if (name.length <= 24) return 80
      if (name.length <= 34) return 64
      return 52
    }

    /** Absolute on-disk path for a `/uploads/...` TenantConfig URL, or null if it isn't one. */
    export function resolveUploadPath(url: string | null | undefined): string | null {
      if (!url || !UPLOAD_URL.test(url)) return null
      return path.join(process.cwd(), 'public', url)
    }

    export type OgLogo = { dataUrl: string; width: number; height: number }

    /**
     * Normalises the uploaded logo to a PNG data URL sized for the OG canvas.
     * Returns null on ANY failure (file deleted, corrupt, WebP/AVIF that satori
     * rejects, sharp native binding unavailable) so the caller falls back to the
     * text card instead of 500-ing the route.
     */
    export async function loadOgLogo(diskPath: string): Promise<OgLogo | null> {
      try {
        const source = await readFile(diskPath)
        // Lazy so a broken sharp install can never break module evaluation —
        // this module is imported while resolving metadata for every page.
        const { default: sharp } = await import('sharp')
        // `density` only affects vector input: rasterise SVG at 300dpi so a
        // small viewBox still yields a crisp bitmap.
        const image = sharp(source, { density: 300 })
        const meta = await image.metadata()
        const intrinsicWidth = meta.width ?? LOGO_BOX.width
        const intrinsicHeight = meta.height ?? LOGO_BOX.height
        const scale = Math.min(
          LOGO_BOX.width / intrinsicWidth,
          LOGO_BOX.height / intrinsicHeight,
          LOGO_MAX_UPSCALE,
        )
        const { data, info } = await image
          .resize({
            width: Math.max(1, Math.round(intrinsicWidth * scale)),
            height: Math.max(1, Math.round(intrinsicHeight * scale)),
            fit: 'inside',
          })
          .png()
          .toBuffer({ resolveWithObject: true })
        return {
          dataUrl: `data:image/png;base64,${data.toString('base64')}`,
          width: info.width,
          height: info.height,
        }
      } catch (err) {
        console.warn('[opengraph-image] logo unavailable, falling back to text card:', err)
        return null
      }
    }
    ```
  - Do **not** add anything else here (no JSX, no `next/og` import, no Prisma, no `@/lib/logger` — pino/env must stay out of the every-page metadata graph).

- [x] **Step 2: New route `src/app/opengraph-image.tsx`** (new file, ~60 lines)
  - Files: `src/app/opengraph-image.tsx`
  - Exact shape:
    ```tsx
    import { ImageResponse } from 'next/og'
    import { getTenantConfig } from '@/lib/tenant'
    import { DEFAULT_BRAND_NAME } from '@/lib/constants/brand'
    import { OG_SIZE, brandFontSize, loadOgLogo, resolveUploadPath, safeColor, truncateBrandName } from '@/lib/og-image'

    // Node.js, not edge: the card reads the uploaded logo off the container's
    // own disk and normalises it with sharp. `next/og` has a real Node build.
    export const runtime = 'nodejs'
    // Same reason as /api/tenant-config: without this, Next prerenders the PNG
    // at build time (the Docker builder stage has no live DB) and `next start`
    // then serves that frozen card forever.
    export const dynamic = 'force-dynamic'
    export const size = OG_SIZE
    export const contentType = 'image/png'

    // Mirror src/lib/tenant.ts's DEFAULT_CONFIG palette for the never-happens case
    // of a non-hex value in the DB.
    const FALLBACK_FROM = '#FFF0F1'
    const FALLBACK_TO = '#FFF8F6'
    const FALLBACK_ACCENT = '#8B4A58'

    export default async function OpengraphImage() {
      const config = await getTenantConfig()
      const from = safeColor(config.primaryColor, FALLBACK_FROM)
      const to = safeColor(config.secondaryColor, FALLBACK_TO)
      const accent = safeColor(config.accentColor, FALLBACK_ACCENT)
      const brandName = truncateBrandName(config.brandName, DEFAULT_BRAND_NAME)

      const logoPath = resolveUploadPath(config.logoUrl)
      const logo = logoPath ? await loadOgLogo(logoPath) : null

      return new ImageResponse(
        (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 80,
              background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)`,
            }}
          >
            {logo ? (
              <img src={logo.dataUrl} width={logo.width} height={logo.height} alt="" />
            ) : (
              <div
                style={{
                  display: 'flex',
                  maxWidth: 1000,
                  fontSize: brandFontSize(brandName),
                  fontWeight: 700,
                  lineHeight: 1.1,
                  letterSpacing: '-0.02em',
                  textAlign: 'center',
                  color: accent,
                }}
              >
                {brandName}
              </div>
            )}
          </div>
        ),
        {
          ...OG_SIZE,
          // ImageResponse defaults to `immutable, max-age=31536000` in production,
          // but the URL's ?<hash> is a hash of THIS FILE, not of TenantConfig — so
          // an immutable card would survive every logo/palette change.
          headers: { 'Cache-Control': 'public, max-age=300, s-maxage=300' },
        },
      )
    }
    ```
  - Hard rules: no `export const alt` (it can only be a static string and cannot reflect `brandName` — `og:image:alt` is optional; explicitly out of scope); **no `fonts` option** (AD-5); no `try/catch` needed around `getTenantConfig()` (it never throws — verified); do not add a second element/tagline.
  - Do **not** create `src/app/twitter-image.tsx` (AD-1) and do **not** touch `src/app/layout.tsx`.

- [x] **Step 3: Tests** — `tests/lib/og-image.test.ts` (new file, ~80 lines)
  - Files: `tests/lib/og-image.test.ts`
  - No `vi.mock` anywhere: the pure helpers have no dependencies, and `loadOgLogo` is exercised against real temp files (which is also the one place we prove `sharp` actually works in this repo).
  - Cases:
    - `safeColor`: `'#fff'`, `'#FFF0F1'`, `'#FFF0F1AA'`, `'  #abc  '` (trimmed) → returned; `'red'`, `'rgb(0,0,0)'`, `'#12'`, `''`, `null`, `undefined`, `'#fff; background: url(x)'` → fallback.
    - `truncateBrandName`: `null`/`''`/`'   '` → fallback; a 48-char name → unchanged; a 60-char name → length 48 and ends with `'…'`.
    - `brandFontSize`: boundaries — 14→104, 15→80, 24→80, 25→64, 34→64, 35→52.
    - `resolveUploadPath`: `'/uploads/1700000000-ab12cd.png'` → ends with `path.join('public', 'uploads', '1700000000-ab12cd.png')` and is absolute; `null`, `''`, `'uploads/a.png'`, `'/uploads/'`, `'/uploads/../../etc/passwd'`, `'/uploads/sub/a.png'`, `'https://evil.test/uploads/a.png'`, `'/public/uploads/a.png'` → `null`.
    - `loadOgLogo`: a path that does not exist → `null` (and the `console.warn` is acceptable noise). A real 1×1 PNG written into `await mkdtemp(path.join(os.tmpdir(), 'og-'))` → returns a `dataUrl` starting `'data:image/png;base64,'` with `width === 2 && height === 2` (asserts the `LOGO_MAX_UPSCALE = 2` clamp). A 1600×400 PNG produced in-test via `sharp({ create: { width: 1600, height: 400, channels: 4, background: '#ff0000' } }).png().toBuffer()` → `width === 800 && height === 200` (asserts the 800×340 box fit). Clean the temp dir in `afterAll`.
  - Run `npx vitest run tests/lib/og-image.test.ts`, then the full `npm run test` — the suite is green today, keep it green, add no skips.

- [x] **Step 4: Verification sweep (read-only, report every result)**
  - `npm run lint` — the two new files must add **zero** new problems (baseline is pre-existing; confirm with `git stash` if unsure). No new `eslint-disable` comment anywhere in this change.
  - `wc -l src/lib/og-image.ts src/app/opengraph-image.tsx tests/lib/og-image.test.ts` — all far under 500.
  - `git diff --name-only` must **not** list `src/app/layout.tsx`, `src/app/api/upload/route.ts`, `src/lib/tenant.ts`, `next.config.mjs`, `Dockerfile`, anything under `deploy/`, `prisma/`, or `src/locales/`.
  - `rg -n "twitter-image|export const alt|runtime = 'edge'|fonts:" src/app/opengraph-image.tsx src/lib/og-image.ts` → must be empty.
  - `rg -n "images" src/app/layout.tsx` → must show no `openGraph.images`/`twitter.images` addition.
  - **Do not run `npm run build` or `npm run dev`** (user keeps a dev server running; a concurrent build corrupts `.next/`). The route cannot be exercised locally by this agent — everything runtime-facing is in the user's manual checklist below.

- [x] **Step 5: DOX pass**
  - `src/app/AGENTS.md` → Local Contracts, one new bullet: `opengraph-image.tsx` is the root-segment metadata file convention producing the single site-wide 1200×630 OG/Twitter card from `TenantConfig` (`runtime = 'nodejs'` + `dynamic = 'force-dynamic'`, same reason as `/api/tenant-config`); `twitter:image` is auto-filled from `openGraph.images` by Next, so there is deliberately **no** `twitter-image.tsx`; `layout.tsx` must never declare `openGraph.images`/`twitter.images` (that suppresses the file-convention merge) and no child segment may declare an `openGraph`/`twitter` key without also carrying `images`, or that page loses the card; the module's static import graph is evaluated while resolving metadata for **every** page, so it must stay import-light and must never throw at module scope.
  - `src/lib/AGENTS.md` → Local Contracts, one bullet: `og-image.ts` holds the OG-card helpers (`OG_SIZE`, `safeColor`, `truncateBrandName`, `brandFontSize`, `resolveUploadPath`, `loadOgLogo`); every function is total (returns a fallback/`null`, never throws) because the module is reachable from every page's metadata; `sharp` is imported **lazily inside** `loadOgLogo` on purpose — a broken native binding must cost only the preview card. It normalises uploads to PNG because satori rejects WebP/AVIF and unparseable SVGs, and because `TenantConfig.logoWidth/logoHeight` are header display dims, not the file's real aspect ratio. `/uploads/` paths are regex-guarded against traversal.
  - `tests/AGENTS.md` → Local Contracts, one dated bullet: `(2026-08-06)` new `tests/lib/og-image.test.ts`, no mocks by design; it is also the only place `sharp`'s native binding is exercised by the suite (a real temp PNG round-trip).
  - Intentionally unchanged, report why: `deploy/AGENTS.md` + `Dockerfile` (the runner already installs real prod `node_modules`, so `@vercel/og`'s wasm/TTF assets and `sharp` are present with no tracing or COPY change — no deploy contract moves); `src/app/api/AGENTS.md` (nothing under `api/` touched); `prisma/AGENTS.md` (no schema change); root `CLAUDE.md` Child DOX Index (no AGENTS.md added/moved).

---

## Acceptance Criteria

- [x] `npm run test` passes including the new `tests/lib/og-image.test.ts`; nothing pre-existing breaks, nothing skipped.
- [x] `npm run lint` adds zero new problems vs. the pre-change baseline; no new `eslint-disable`.
- [x] Exactly three files created — `src/app/opengraph-image.tsx`, `src/lib/og-image.ts`, `tests/lib/og-image.test.ts` — plus the three AGENTS.md edits. **`src/app/layout.tsx` has no diff.**
- [x] The route file exports `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, `size`, `contentType`; it does **not** export `alt`, does not pass `fonts`, and does not use `runtime = 'edge'`.
- [x] `loadOgLogo` returns `null` (never throws) for: missing file and non-image bytes — covered by tests. **Note:** a WebP input does NOT return `null` — see "Deviation" note below; `resolveUploadPath` returns `null` for any traversal/subdir/absolute-URL input — covered by tests.
- [x] Every new file is well under 500 lines.
- [ ] **Runtime (user-verified, see checklist):** page source contains both `og:image` and `twitter:image` pointing at `<site>/opengraph-image?<hash>`; `GET /opengraph-image` returns `200 image/png` ~1200×630 with `Cache-Control: public, max-age=300, s-maxage=300`; the card shows the tenant logo on the brand gradient; deleting the logo file on disk still yields a text card, not a 500; a real WhatsApp/Telegram share renders a preview.

### Deviation note (found during implementation, not silently fixed)

This Acceptance Criteria bullet's claim that `loadOgLogo` returns `null` for "a WebP input" contradicts AD-3, which explicitly designs `loadOgLogo` to convert WebP to PNG via `sharp` *specifically because* satori/`next/og` rejects WebP outright — i.e. `loadOgLogo` succeeding on WebP (converting it to a PNG data URL) is the intended fix, not a bug. `sharp` can decode WebP natively, so `readFile` + `sharp(...).metadata()` + `.png().toBuffer()` all succeed for a WebP source; the point at which raw WebP actually gets rejected is downstream in satori's `<img>` renderer inside `ImageResponse`, which `loadOgLogo` itself never touches. Step 3's own exact test-case list (line 262 as originally written) never asked for a WebP case either — this only surfaced from the Acceptance Criteria bullet. Added a WebP test that asserts the correct (AD-3) behavior — `loadOgLogo` returns a non-null PNG result for WebP input — with an inline comment explaining why, rather than weakening `loadOgLogo` to reject WebP (which would undo AD-3's whole reason for using `sharp`). Also added the "non-image bytes → null" case, which was in the Acceptance Criteria but not in Step 3's list, since it cost nothing and is true today. **(2026-08-06 fix)** The test's original title, `'returns null for a WebP input (rejected by satori downstream)'`, contradicted its own `expect(result).not.toBeNull()` assertion — flagged by code review. Retitled to `"succeeds for a WebP input — sharp decodes it; satori's rejection happens downstream in ImageResponse, not in loadOgLogo"`; assertion and inline comment unchanged. Re-ran `npx vitest run tests/lib/og-image.test.ts` — 36/36 pass.

---

## Constraints & Risks

**Must not be touched**
- `src/app/layout.tsx` — adding `openGraph.images` or `twitter.images` there *breaks* AD-1's merge. Zero diff.
- `src/app/api/upload/route.ts` (no new validation, no resizing at upload time), `src/lib/tenant.ts`, `prisma/**` (no schema change — nothing new is stored), `next.config.mjs`, `Dockerfile`, `deploy/**`, `src/locales/**` (nothing user-visible in-app is added, so no i18n keys).
- `src/lib/image-resize.ts` — browser/Canvas-only, unrelated; do not "unify" it with the server-side logo path.

**Do not run**
- `npm run dev`, any long-running server, or `npm run build` (concurrent build corrupts the user's `.next/`). No browser automation.

**Risks**
1. **A module-scope throw in this route file breaks every page's `<head>`, not just the card** — Next imports the module's named exports while resolving metadata for all pages. This is why `sharp` is a lazy import inside a try/catch and why no I/O happens at module scope. Any later "cleanup" that hoists `import sharp from 'sharp'` to the top of `og-image.ts` re-arms this; keep the comment.
2. **`sharp`'s native binding has never actually run in this deployment** (nothing in `src/` imports it today; it exists only because standalone mode used to want it). If it fails to load in the Alpine runner, every card silently degrades to the text variant — visible only via the `console.warn` in the container logs. Step 3's temp-file test proves it works on the dev machine; the container is proven by manual check 3.
3. **Google-Fonts dependency for non-ASCII brand names.** The built-in face is Noto Sans *latin*; satori fetches the missing glyphs from `fonts.googleapis.com` at render time. Blocked egress ⇒ those glyphs are dropped from the text card (no error). Only affects the no-logo path. Do not "fix" it by passing `fonts` — that removes the built-in face entirely.
4. **Messenger-side caching is outside our control.** Telegram/WhatsApp cache previews per URL for a long time, and the metadata URL's `?<hash>` is a hash of the source file, so a logo change does not mint a new URL. Expect to need Telegram's `@WebpageBot` (or a throwaway `?x=1` query) to see a change immediately; this is not a bug, and it is the reason for the 5-minute `Cache-Control` rather than a longer TTL.
5. **`NEXT_PUBLIC_SITE_URL` must be correct at build time** (`metadataBase`), or `og:image` resolves to the wrong host and no crawler can fetch it. `install.sh` already passes it as a Docker build arg (AD-13) — pre-existing dependency, but a wrong value now visibly breaks previews instead of only canonical URLs.
6. **Render cost.** Each uncached crawl rasterises 1200×630 through resvg+satori plus a sharp pass (order of 100–400 ms, single-threaded). Crawler volume makes this irrelevant, but do not link this route from app UI or make it a hot path.
7. **Cheap-looking card when `logoUrl` is unset and the palette is the pale default** (`#FFF0F1` → `#FFF8F6` is nearly white with a rose brand name in `accentColor`). That is the tenant's actual identity, and it is a valid, readable card — do not "improve" it with invented colours. If the user dislikes it, the follow-up is a palette/preset decision, not a code fix.

---

## Проверка вручную (RU, коротко)

1. Перезапустить контейнер/сервер (новый роут появляется только после сборки). Открыть главную → «Просмотр кода страницы» → должны быть **обе** строки: `<meta property="og:image" content="https://<домен>/opengraph-image?...">` и `<meta name="twitter:image" ...>` с тем же адресом, плюс `og:image:width` = 1200 и `og:image:height` = 630.
2. Открыть `https://<домен>/opengraph-image` прямо в браузере — должна показаться картинка 1200×630: логотип по центру на градиенте ваших цветов. Не 404 и не белый лист.
3. `docker compose logs app --tail=50` сразу после шага 2 — не должно быть строки `[opengraph-image] logo unavailable`. Если она есть, логотип не прочитался (или не работает `sharp`), и карточка ушла в текстовый вариант.
4. Кинуть ссылку на сайт себе в WhatsApp и в Telegram (в «Избранное») — должна появиться карточка с картинкой. Если Telegram показывает старый вариант без картинки — это его кэш: отправить адрес сайта боту `@WebpageBot` и повторить.
5. Проверить текстовый вариант: в админке `/admin/settings` временно убрать логотип → перезагрузить `https://<домен>/opengraph-image` (можно добавить `?1` к адресу, чтобы обойти кэш браузера) → должно быть крупное название салона на том же градиенте, **не** пустая картинка. Затем вернуть логотип.
6. Сменить цвета (primary/secondary) в настройках → через ~5 минут (или с `?2` в адресе) фон карточки должен стать новым.
7. Если у салона длинное название (30+ символов) или буквы `ł ą ę ś ż ź ć ń` — проверить шаг 5 именно с ним: текст должен переноситься и умещаться, буквы не должны превращаться в пустые квадраты.
