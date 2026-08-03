import { getTenantConfig } from '@/lib/tenant'
import LegalDocumentView from '@/components/legal/LegalDocumentView'
import BackButton from '../../components/BackButton'
import ThemeToggle from '../../components/ThemeToggle'
import LanguageToggle from '../../components/LanguageToggle'

export default async function TermsPage() {
  const config = await getTenantConfig()

  // Use legal address for official docs, fall back to salon address
  const legalAddress = config.salonLegalAddress || [config.salonAddress, config.salonCity].filter(Boolean).join(', ')

  return (
    <main className="flex-1 relative">
      <BackButton />
      {/* Theme and Language toggles - same position as main page */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
        <LanguageToggle />
        <ThemeToggle />
      </div>
      <div className="container mx-auto max-w-4xl px-6 py-8">
        <LegalDocumentView
          titleKey="terms.title"
          noticeKey="terms.legalNotice"
          content={{ pl: config.termsContent_pl, en: config.termsContent_en, uk: config.termsContent_uk }}
          contact={{
            companyName: config.salonCompanyName,
            nip: config.salonNip,
            legalAddress,
            email: config.salonEmail,
          }}
        />
      </div>
    </main>
  )
}
