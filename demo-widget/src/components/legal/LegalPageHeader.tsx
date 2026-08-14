import TopNavLine from '../TopNavLine'
import ThemeToggle from '../ThemeToggle'
import { useAppNavigation } from '../../context/AppContext'

// Ported from the real LegalPageHeader.tsx — shared by /privacy, /terms,
// /support. In normal document flow (not absolute), no logo.
export default function LegalPageHeader() {
  const { navigateHome } = useAppNavigation()
  return (
    <div className="pt-2 pl-3 lg:pl-28 xl:pl-32">
      <TopNavLine onBack={navigateHome} leadingSpaceClassName="pl-48" actions={<ThemeToggle />} />
    </div>
  )
}
