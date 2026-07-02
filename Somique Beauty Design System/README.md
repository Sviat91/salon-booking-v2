# Somique Beauty — Design System

## Overview

**Somique Beauty** is a white-label SaaS booking platform for beauty salons. The product is built with Next.js 14 (App Router), Tailwind CSS, Prisma + SQLite, and NextAuth.js. It is live as `somique.beauty` — a Polish-market facial massage / cosmetology studio, but the codebase is multi-tenant and can be rebranded.

### Sources
- **Codebase:** `Sviat91/salon-booking-v2` (GitHub, private repo, branch `master`)
- **Live deployment:** `https://somique.beauty`
- No Figma file was provided.

---

## Products / Surfaces

| Surface | Route | Audience | Notes |
|---------|-------|----------|-------|
| **Client Booking** | `/` and `/[masterId]` | End-clients (mobile-first) | Master selector → service → date/time → booking form |
| **Client Cabinet** | `/profile` | Registered clients | Appointment history, repeat booking, GDPR tools |
| **Admin Panel** | `/admin` | Superadmin (salon owner) | Dashboard, calendar, services, masters, settings |
| **Master Panel** | `/admin/master` | Masters (staff) | Their own appointments, schedule, availability |
| **Auth** | `/auth/*` | All roles | Login, registration |

---

## CONTENT FUNDAMENTALS

### Language & Locale
- Primary deploy is **Polish** (`lang="pl"`). UI strings use `react-i18next`; keys live in `src/locales/`.
- Copy also exists in **Ukrainian** (`uk`) — bilingual audience.
- Meta descriptions: "Zarezerwuj wizytę. Szybka i wygodna rezerwacja online." (Book an appointment. Fast and convenient online booking.)

### Tone of Voice
- **Warm, professional, concise.** The brand serves women booking beauty treatments — copy is inviting but never casual or gimmicky.
- **Second-person, polite form** (`Ty` in Polish, but elevated register — more formal than colloquial).
- No emoji in UI copy. No exclamation marks in core UI strings.
- CTA copy is action-first: "Zarezerwuj" (Book), "Wybierz" (Choose), "Potwierdź" (Confirm).
- Error messages are plain and specific: "Invalid phone number", "Name must be at least 2 characters".
- Section labels use **ALL CAPS + wide letter-spacing** (e.g. "YOUR DETAILS").
- Admin panel uses English ("Dashboard", "Services", "Masters", "Sign Out") — staff-facing, developer-default.

### Naming Conventions
- The brand is: **Somique Beauty** (display name), `somique.beauty` (domain).
- Services are called "procedury" (procedures) in Polish.
- Staff are "masters" (мастери / masters), not "stylists" or "therapists".
- Clients are "clients" — guest booking and registered both.

---

## VISUAL FOUNDATIONS

### Color Palette

| Token | Value | Role |
|-------|-------|------|
| `--color-primary`   | `#FDE5C3` | Warm peach — gradient tint, muted highlights |
| `--color-secondary` | `#FFF6E9` | Creamy ivory — page base background |
| `--color-accent`    | `#FFBBBD` | Soft blush rose — primary CTAs, active states |
| `--color-text`      | `#2B2B2B` | Near-black body text |
| `--color-muted`     | `#6B6B6B` | Medium grey — subtitles, captions |
| `--color-border`    | `#E9E2D6` | Warm beige — dividers, input borders |
| `--color-card`      | `#FFFFFF` | Pure white cards |
| `--color-success`   | `#21A67A` | Teal green — confirmations |
| `--color-error`     | `#D84E4E` | Muted red — errors |
| `--color-dark-bg`   | `#9C6849` | Warm umber — dark mode page |
| `--color-dark-card` | `#2A2A2A` | Charcoal — dark mode cards |
| `--color-dark-border`| `#7A4F35` | Deep brown — dark mode borders / scrollbar |

**Vibe:** warm, creamy, feminine — peach + blush + ivory. No cold blues or greens. Accent (#FFBBBD) is the only "pop" color; everything else is neutral/warm.

### Typography
- **Font:** `Inter` (Google Fonts) — all weights 300–700. Single font family across all surfaces.
- **Headings:** `font-semibold` (600), tight tracking (`-0.025em`).
- **H1 on booking page:** `text-4xl font-semibold tracking-tight` — large, confident.
- **Body:** `text-base` / `text-sm`, `font-regular` (400), `leading-normal` (1.5).
- **Section labels:** `text-xs font-semibold uppercase tracking-wider text-primary` — used above sections (e.g. "YOUR DETAILS").
- **No serif typeface** anywhere in the current codebase.
- **No monospaced** except in dev tooling (not in product UI).

### Backgrounds
- **Public booking site:** full-page radial gradient — `radial-gradient(1600px 1100px at 20% 0%, #FDE5C3, #FFF6E9)`. The gradient anchor shifts to top-center on tablet/mobile.
- **Admin panel:** solid `--background` (`#FFF6E9` light / `#2B2B2B` dark). No gradient in admin.
- **Cards:** `bg-card` (#FFFFFF) — used on booking panels, master cards.
- No full-bleed photography, no repeating patterns or textures.
- No heavy decorative gradients (bluish-purple style avoided).

### Corner Radii
- `--radius`: `0.625rem` (10px) — default card/panel.
- Buttons: `rounded-full` (pills) for `.btn` public-site style; `rounded-lg` (`--radius`) for admin panel buttons.
- Avatar / master photo: `rounded-full` (circular).
- Inputs: `rounded-xl` (~12px) on booking form; `rounded-lg` in admin.
- Modals: `rounded-xl`.

### Shadows / Elevation
- Minimal shadows — `shadow-sm` on cards (`0 1px 2px rgba(0,0,0,.05)`).
- Hover state on primary CTA: `hover:shadow-lg hover:scale-[1.02]` — slight lift + scale.
- Focus ring: 3-ring outline in `ring/50` (accent tint at 50% opacity).
- No heavy drop shadows. Depth is expressed through background contrast, not shadows.

### Borders
- `1px solid var(--color-border)` (`#E9E2D6`) — warm beige, very subtle.
- In dark mode: `#7A4F35` brown borders.
- Active nav items in admin: no border — uses `bg-primary/10` fill instead.

### Animations
- **Library:** Framer Motion for page transitions and avatar cross-route flight (`layoutId` shared element).
- **Spring physics:** `stiffness: 200, damping: 25` — smooth, not bouncy.
- **Fade-in-up:** `0.5s ease-in-out` — entry animation for booking content.
- **Booking content delay:** `animation: fade-in-up-delayed 1.1s cubic-bezier(0.22, 1, 0.36, 1)` — content waits 45% of duration before appearing.
- **Accordions:** `0.2s ease-out` expand/collapse (tailwindcss-animate).
- **Hover states:** `transition-colors` / `transition-all 0.2s ease`. Buttons: `hover:opacity-0.9` (primary), `hover:bg-muted` (ghost/outline).
- **Press state:** `active:translate-y-px` (1px down-press) on buttons.
- **Theme toggle:** `background-color 0.3s ease` transition on body.
- `prefers-reduced-motion` respected — Framer layoutId disabled when set.

### Hover & Interaction States
- **Primary button:** `hover:opacity-0.9`, `hover:shadow-lg hover:scale-[1.02]`, `active:scale-[0.98]`.
- **Outline button:** `hover:bg-primary/60` (peach tint wash).
- **Ghost/nav links:** `hover:bg-muted hover:text-foreground`.
- **Active nav item (admin):** `bg-primary/10 text-primary` fill.
- **Destructive action:** `hover:bg-destructive/10 hover:text-destructive`.
- **Calendar days:** `hover:bg-primary/20 (light)` / `hover:bg-[#6B4423] (dark)`.
- Disabled: `opacity-50 pointer-events-none`.

### Cards
- White background (`#FFFFFF`), 1px warm beige border, `rounded-lg` (10px), `shadow-sm`.
- In dark mode: `#2A2A2A` background, brown border.
- Booking form card: no explicit border — sits on the gradient background.
- Admin cards: standard card style.
- Master selector cards: avatar `rounded-full` with `ring-2 ring-accent/70`.

### Use of Transparency & Blur
- `bg-primary/5` and `bg-primary/10` used for subtle tinted backgrounds (e.g. "Your Details" panel).
- `ring-accent/70` for avatar ring.
- `border-primary/20` for soft panel borders.
- No `backdrop-blur` in current product — clean, no frosted glass.

### Imagery
- **Warm, intimate tone.** Master profile photos (Olga, Yuliia) are professional headshots with warm skin tones.
- Social preview (`prev.png`) is a warm-toned brand image.
- Logo exists in both light (`head_logo.png`) and dark (`head_logo_night.png`) variants.
- No illustrations, icons-as-images, or decorative SVGs in the product.
- No grain or film effects.

### Layout Rules
- **Admin panel:** fixed 60px header + 240px sidebar. Main content scrolls.
- **Booking flow:** centered single-column, max-width `container` (1400px @ 2xl). On mobile: full-width with `px-4`.
- **Top-right controls** (theme toggle, language, user) absolutely positioned `top-4 right-4` on booking page.
- Footer: minimal, sticks to bottom.

---

## ICONOGRAPHY

Icons are provided entirely by **Lucide React** (`lucide-react` package).

- Style: 2px stroke, rounded caps, clean line icons — no filled variants used.
- Size: `h-4 w-4` (16px) standard; `h-3.5 w-3.5` (14px) for nav chevrons; `h-5 w-5` (20px) for loading spinner.
- Color: inherits from text color (`currentColor`). Active state uses `text-primary` (accent rose).
- No icon font, no SVG sprite, no PNG icons.
- No emoji used as icons anywhere in the product.

**Icons used in admin sidebar:**
`LayoutDashboard`, `Scissors`, `Users`, `Settings`, `LogOut`, `ChevronRight`, `ArrowLeft`, `CalendarDays`, `Mail`, `Key`

For CDN-based icon use in design artifacts, link **Lucide** via:
```html
<script src="https://unpkg.com/lucide@latest/dist/umd/lucide.min.js"></script>
```

---

## Files in This Design System

```
README.md                   ← this file
colors_and_type.css         ← full CSS token library
SKILL.md                    ← agent skill manifest
assets/
  head_logo.png             ← brand logo (light)
  head_logo_night.png       ← brand logo (dark)
  logo.png                  ← icon/favicon logo
  prev.png                  ← social preview image
  photo_master_olga.png     ← master Olga portrait
  photo_master_yuliia.png   ← master Yuliia portrait
preview/
  colors-brand.html         ← brand palette swatches
  colors-semantic.html      ← semantic + dark palette
  colors-feedback.html      ← success/error/muted
  type-scale.html           ← typography scale
  type-labels.html          ← label / caption styles
  spacing-tokens.html       ← spacing & radius tokens
  shadows-elevation.html    ← shadow & elevation system
  components-buttons.html   ← button variants
  components-inputs.html    ← form inputs
  components-cards.html     ← card styles + avatar
  components-badges.html    ← badges + status chips
  brand-logo.html           ← logo variants + usage
  brand-gradient.html       ← background gradient system
ui_kits/
  admin/
    index.html              ← Admin panel prototype
    AdminLayout.jsx
    AdminSidebar.jsx
    DashboardPage.jsx
    CalendarPage.jsx
  client/
    index.html              ← Client booking prototype
    BookingFlow.jsx
    MasterSelector.jsx
    BookingForm.jsx
    BookingSuccess.jsx
```
