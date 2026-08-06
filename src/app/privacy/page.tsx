import { getTenantConfig } from '@/lib/tenant'
import LegalDocumentView from '@/components/legal/LegalDocumentView'
import PageToolbar from '@/components/PageToolbar'

export default async function PrivacyPage() {
  const config = await getTenantConfig()

  // Use legal address for official docs, fall back to salon address
  const legalAddress = config.salonLegalAddress || [config.salonAddress, config.salonCity].filter(Boolean).join(', ')

  return (
    <main className="flex-1 relative">
      <div className="container mx-auto max-w-4xl px-6 pt-4 pb-8 space-y-4">
        <PageToolbar />
        <LegalDocumentView
          titleKey="privacy.title"
          noticeKey="privacy.legalNotice"
          content={{ pl: config.privacyContent_pl, en: config.privacyContent_en, uk: config.privacyContent_uk }}
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
