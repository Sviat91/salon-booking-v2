import { useAppNavigation } from '../context/AppContext'
import { useBrand } from '../context/BrandContext'

export default function Footer() {
  const { navigateToPrivacy, navigateToTerms, navigateToSupport } = useAppNavigation()
  const { brand } = useBrand()

  return (
    <footer className="py-3">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <div className="text-sm text-neutral-500 dark:text-dark-muted">
            <button onClick={navigateToPrivacy} className="hover:text-primary transition-colors">
              Privacy Policy
            </button>
            <span className="mx-2">•</span>
            <button onClick={navigateToTerms} className="hover:text-primary transition-colors">
              Terms of Service
            </button>
            <span className="mx-2">•</span>
            <button onClick={navigateToSupport} className="hover:text-primary transition-colors">
              Help Center
            </button>
            <span className="mx-4">|</span>
            <span>© {new Date().getFullYear()} {brand.name}. All rights reserved.</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
