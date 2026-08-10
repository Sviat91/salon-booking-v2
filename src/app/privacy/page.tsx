import { getTenantConfig } from '@/lib/tenant'
import LegalDocumentView from '@/components/legal/LegalDocumentView'
import LegalPageHeader from '@/components/legal/LegalPageHeader'

export default async function PrivacyPage() {
  const config = await getTenantConfig()

  // Use legal address for official docs, fall back to salon address
  const legalAddress = config.salonLegalAddress || [config.salonAddress, config.salonCity].filter(Boolean).join(', ')

  return (
    <main className="relative flex-1 flex flex-col w-full max-w-full box-border overflow-x-hidden">
      <LegalPageHeader />
      <div className="container mx-auto max-w-4xl px-3 sm:px-6 pt-4 pb-8 space-y-4">
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
