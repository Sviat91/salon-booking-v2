import TopNavLine from '../components/TopNavLine'
import ThemeToggle from '../components/ThemeToggle'
import MasterSelector from '../components/MasterSelector'
import PhotoStrip from '../components/PhotoStrip'

// Ported from the real HomeClient.tsx. Logo display and the homepage
// widget-block slot are both DB-configured and unset in this demo (their
// default real-world state is to render nothing), so they're omitted rather
// than faked. LanguageToggle is likewise omitted — the real component
// returns null outright for a single-language tenant, which this demo is.
export default function HomePage() {
  return (
    <main className="flex-1 flex flex-col relative pb-4">
      <div className="absolute top-2 left-0 right-0 z-20 pl-3 lg:pl-28 xl:pl-32">
        <TopNavLine leadingSpaceClassName="pl-48" actions={<ThemeToggle />} />
      </div>

      <div className="flex justify-center px-4 pt-8 lg:pt-24">
        <MasterSelector />
      </div>

      <div className="mt-auto pt-12 w-full">
        <PhotoStrip />
      </div>
    </main>
  )
}
