import { getTenantConfig } from '@/lib/tenant'
import LegalDocumentView from '@/components/legal/LegalDocumentView'
import LegalPageHeader from '@/components/legal/LegalPageHeader'

export default async function TermsPage() {
  const config = await getTenantConfig()

  // Use legal address for official docs, fall back to salon address
  const legalAddress = config.salonLegalAddress || [config.salonAddress, config.salonCity].filter(Boolean).join(', ')

  return (
    <main className="px-3 py-4 sm:p-6 relative flex-1 flex flex-col w-full max-w-full box-border overflow-x-hidden">
      <LegalPageHeader />
      <div className="container mx-auto max-w-4xl px-0 pt-4 pb-8 space-y-4">
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
