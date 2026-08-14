import TopNavLine from '../components/TopNavLine'
import ThemeToggle from '../components/ThemeToggle'
import MasterSelector from '../components/MasterSelector'
import PhotoStrip from '../components/PhotoStrip'
import LogoDisplay from '../components/LogoDisplay'
import { useAboutTab } from '../context/AppContext'

// Ported from the real HomeClient.tsx. The homepage widget-block slot is
// DB-configured and unset in this demo (its default real-world state is to
// render nothing), so it's omitted rather than faked. LanguageToggle is
// likewise omitted — the real component returns null outright for a
// single-language tenant, which this demo is.
export default function HomePage() {
  const tabs = useAboutTab()

  return (
    <main className="flex-1 flex flex-col relative pb-4">
      <div className="absolute top-2 left-0 right-0 z-20 pl-3 lg:pl-28 xl:pl-32">
        <TopNavLine leadingSpaceClassName="pl-48" actions={<ThemeToggle />} tabs={tabs} />
      </div>

      <LogoDisplay />

      {/* Mobile logo — real HomeClient.tsx shows a separate centered logo
          block below `lg`. */}
      <div className="block lg:hidden pt-24 pb-2 px-4 text-center">
        <img src="/logo.png" alt="Loom & Blade" width={160} height={64} className="h-auto max-w-[160px] sm:max-w-[180px] mx-auto" />
      </div>

      <div className="flex justify-center px-4 pt-8 lg:pt-24">
        <MasterSelector />
      </div>

      {/* `mt-auto` (real HomeClient.tsx's own choice) pushes this to the
          bottom of the flex column, leaving a big empty gap on a short
          master grid — user flagged it sits too low, wants it right under
          the cards instead, so a demo-specific deviation from the source. */}
      <div className="w-full">
        <PhotoStrip />
      </div>
    </main>
  )
}
