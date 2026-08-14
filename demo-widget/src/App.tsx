import { AppProvider, useAppNavigation } from './context/AppContext'
import Footer from './components/Footer'
import HomePage from './pages/HomePage'
import BookingPage from './pages/BookingPage'
import PrivacyPage from './pages/PrivacyPage'
import TermsPage from './pages/TermsPage'
import SupportPage from './pages/SupportPage'

// Ported from the real root layout.tsx shell: min-h-screen flex column with
// the page content flexing to fill and Footer pinned at the bottom.
function Shell() {
  const { view } = useAppNavigation()

  let page
  switch (view.name) {
    case 'home':
      page = <HomePage />
      break
    case 'booking':
      page = <BookingPage />
      break
    case 'privacy':
      page = <PrivacyPage />
      break
    case 'terms':
      page = <TermsPage />
      break
    case 'support':
      page = <SupportPage />
      break
  }

  return (
    <div className="min-h-screen flex flex-col text-foreground">
      <div className="flex-1 w-full mx-auto flex flex-col">{page}</div>
      <Footer />
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  )
}
