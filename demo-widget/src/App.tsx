import { AppProvider, useAppNavigation } from './context/AppContext'
import Footer from './components/Footer'
import HomePage from './pages/HomePage'
import BookingPage from './pages/BookingPage'

// Ported from the real root layout.tsx shell: min-h-screen flex column with
// the page content flexing to fill and Footer pinned at the bottom.
function Shell() {
  const { view } = useAppNavigation()

  return (
    <div className="min-h-screen flex flex-col text-foreground">
      <div className="flex-1 w-full mx-auto flex flex-col">{view.name === 'home' ? <HomePage /> : <BookingPage />}</div>
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
