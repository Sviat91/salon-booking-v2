import TopNavLine from '../TopNavLine'
import ThemeToggle from '../ThemeToggle'
import LanguageToggle from '../LanguageToggle'
import { useAppNavigation, useAboutTab } from '../../context/AppContext'

// Ported from the real LegalPageHeader.tsx — shared by /privacy, /terms,
// /support. In normal document flow (not absolute), no logo.
export default function LegalPageHeader() {
  const { navigateHome } = useAppNavigation()
  const tabs = useAboutTab()
  return (
    <div className="pt-2 pl-3 lg:pl-28 xl:pl-32">
      <TopNavLine
        onBack={navigateHome}
        leadingSpaceClassName="pl-48"
        actions={
          <>
            <LanguageToggle />
            <ThemeToggle />
          </>
        }
        tabs={tabs}
      />
    </div>
  )
}
