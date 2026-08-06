# Plan: custom-page-entrance-animation

## Context

Item 4 of the user's 5-item list (2026-08-05 session): opening a custom
content page (admin-managed `Page`/`Block` system, rendered via tabs) is a
hard "blink" — content just appears — instead of the smooth entrance the
homepage already has. The back button and page elements should animate in
with a slight stagger.

## Investigation (Explore agent + direct file reads)

- **framer-motion is already a dependency** (`package.json`, `^12.23.22`),
  used extensively. No other animation library exists.
- **Homepage's existing smooth entrance**: `src/components/MasterSelector.tsx`
  — title as `motion.div` (`initial={{opacity:0,y:-20}} animate={{opacity:1,y:0}}`),
  master cards as `motion.button` with per-card stagger
  (`transition={{delay: index * 0.2, type:"spring", stiffness:100}}`), all
  gated by `useReducedMotion()` from `src/hooks/useReducedMotion.ts` (returns
  `true`/`false` from `prefers-reduced-motion`). This is the established
  in-repo idiom to mirror — inline ternaries per motion prop, not the unused
  `getAnimationProps` helper in the same hook file (grepped: zero usages
  anywhere in `src/`, dead code, not to be introduced as a new usage).
- **Custom page render flow (the "blink")**: real Next.js App Router
  navigation (`<Link>` in `TopNavLine.tsx`), landing on one of two server
  components — `src/app/pages/[slug]/page.tsx` (global page) and
  `src/app/[masterId]/pages/[slug]/page.tsx` (master-scoped page). Both are
  structurally identical:
  ```tsx
  <main className="relative flex-1 px-3 py-4 sm:p-6">
    <BackButton href={...} />
    <PageRenderer blocks={result.blocks} masterId={...} />
  </main>
  ```
  Neither route file needs to change — both `BackButton` and `PageRenderer`
  are already `"use client"` components, so the fix is confined to those two.
- **`src/components/content/PageRenderer.tsx`** (current, full file):
  ```tsx
  "use client"
  import BlockRenderer from "./BlockRenderer"
  import TopNavLine from "./TopNavLine"
  import LanguageToggle from "@/components/LanguageToggle"
  import ThemeToggle from "@/components/ThemeToggle"

  export default function PageRenderer({ blocks, masterId }: PageRendererProps) {
    return (
      <>
        <div className="absolute top-2 left-0 right-0 z-20 pl-28 sm:pl-32">
          <TopNavLine masterId={masterId} leadingSpaceClassName="pl-48"
            actions={<><LanguageToggle /><ThemeToggle /></>} />
        </div>
        <div className="mx-auto w-full max-w-5xl px-4 pt-12">
          <div className="flex flex-col gap-8 pt-8 pb-12">
            {blocks.map((block) => (
              <BlockRenderer key={block.id} type={block.type} config={block.config} />
            ))}
          </div>
        </div>
      </>
    )
  }
  ```
  Zero `motion.*` usage anywhere — plain divs, instant appearance. This is
  the actual "blink".
- **`src/components/BackButton.tsx`** (current, full file): plain `Link`
  inside a `fixed top-6 left-6 z-50` div, no motion at all.
- **`src/components/PageTransition.tsx`** exists (wraps children in
  `AnimatePresence` keyed by pathname) but is **not imported anywhere** —
  confirmed dead code (`layout.tsx` renders `{children}` directly). Do not
  wire it in — out of scope, and it doesn't itself animate children (would
  need `motion` children regardless), so it wouldn't reduce the work here.

## Fix

Confined to two files: `src/components/content/PageRenderer.tsx` and
`src/components/BackButton.tsx`. No route files, no new dependencies, no new
i18n keys.

### `BackButton.tsx`

Wrap the existing `<div className="fixed top-6 left-6 z-50">` in `motion.div`
(convert the div itself), simple fade + slide-in from the left (it's
literally positioned top-left):

```tsx
"use client"
import Link from 'next/link'
import { motion } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useReducedMotion } from '@/hooks/useReducedMotion'

export default function BackButton({ href = '/' }: BackButtonProps) {
  const { t } = useTranslation()
  const prefersReducedMotion = useReducedMotion()

  return (
    <motion.div
      initial={prefersReducedMotion ? {} : { opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.4, ease: "easeOut" }}
      className="fixed top-6 left-6 z-50"
    >
      <Link href={href} className="...(unchanged)...">
        ...(unchanged svg + text)...
      </Link>
    </motion.div>
  )
}
```

### `PageRenderer.tsx`

1. Import `motion` from `framer-motion` and `useReducedMotion` from
   `@/hooks/useReducedMotion`.
2. Nav line wrapper div → `motion.div`, fade + slide down (mirrors
   `MasterSelector`'s title):
   ```tsx
   initial={prefersReducedMotion ? {} : { opacity: 0, y: -20 }}
   animate={{ opacity: 1, y: 0 }}
   transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.5, ease: "easeOut" }}
   ```
   (keep the existing `className="absolute top-2 left-0 right-0 z-20 pl-28 sm:pl-32"` unchanged — `y` transform doesn't conflict with `top`/absolute positioning.)
3. Blocks container → stagger via framer-motion **variants** (not per-index
   inline delays like `MasterSelector` — a page can have many blocks, and
   unbounded `index * 0.2` delay would make a long page take seconds to fully
   appear). Convert the inner `<div className="flex flex-col gap-8 pt-8 pb-12">`
   to a `motion.div` with `variants`/`initial="hidden"`/`animate="visible"`,
   and wrap each `<BlockRenderer>` in a `motion.div` with `variants={itemVariants}`
   (move the `key={block.id}` to this new wrapper):
   ```tsx
   const containerVariants = {
     hidden: {},
     visible: {
       transition: prefersReducedMotion ? { duration: 0 } : { staggerChildren: 0.08, delayChildren: 0.15 },
     },
   }
   const itemVariants = {
     hidden: prefersReducedMotion ? {} : { opacity: 0, y: 20 },
     visible: {
       opacity: 1, y: 0,
       transition: prefersReducedMotion ? { duration: 0 } : { duration: 0.4, ease: "easeOut" },
     },
   }
   ```
   ```tsx
   <motion.div
     className="flex flex-col gap-8 pt-8 pb-12"
     variants={containerVariants}
     initial="hidden"
     animate="visible"
   >
     {blocks.map((block) => (
       <motion.div key={block.id} variants={itemVariants}>
         <BlockRenderer type={block.type} config={block.config} />
       </motion.div>
     ))}
   </motion.div>
   ```
4. `delayChildren: 0.15` gives a slight cascade after the nav line starts
   appearing, without a hard sequential wait — matches "back button and page
   elements should animate in with slight stagger."

## Checklist

- [x] `BackButton.tsx`: wrapped in `motion.div`, fade+slide from left, gated
      by `useReducedMotion()`
- [x] `PageRenderer.tsx`: nav line wrapper animates in (fade+slide down)
- [x] `PageRenderer.tsx`: blocks container uses stagger variants (not
      unbounded per-index delay), each block wrapped in a `motion.div` with
      `itemVariants`, `key` moved to the wrapper
- [x] All motion gated by `useReducedMotion()` — zero-duration/no-offset
      when the user prefers reduced motion (mirrors `MasterSelector`'s
      pattern exactly)
- [x] No route files touched (`src/app/pages/[slug]/page.tsx`,
      `src/app/[masterId]/pages/[slug]/page.tsx` unchanged)
- [x] `PageTransition.tsx` not touched/wired in — explicitly out of scope
- [x] `getAnimationProps` helper not newly used — stay consistent with the
      established inline-ternary idiom
- [x] No new dependencies, no new i18n keys
- [x] Both files stay under 500 lines
- [x] `npm run lint` — no new problems vs baseline
- [x] `npm run test` — no regressions
