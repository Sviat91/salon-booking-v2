import LegalPageHeader from '../components/legal/LegalPageHeader'
import LegalDocumentView from '../components/legal/LegalDocumentView'
import { salonContact, termsContent } from '../lib/legalContent'

// Ported from the real src/app/terms/page.tsx.
export default function TermsPage() {
  return (
    <main className="relative flex-1 flex flex-col w-full max-w-full box-border overflow-x-hidden">
      <LegalPageHeader />
      <div className="container mx-auto max-w-4xl px-3 sm:px-6 pt-4 pb-8 space-y-4">
        <LegalDocumentView title="Terms of Service" content={termsContent} contact={salonContact} />
      </div>
    </main>
  )
}
