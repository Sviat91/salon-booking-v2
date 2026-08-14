import LegalPageHeader from '../components/legal/LegalPageHeader'
import LegalDocumentView from '../components/legal/LegalDocumentView'
import { salonContact, privacyContent } from '../lib/legalContent'

// Ported from the real src/app/privacy/page.tsx.
export default function PrivacyPage() {
  return (
    <main className="relative flex-1 flex flex-col w-full max-w-full box-border overflow-x-hidden">
      <LegalPageHeader />
      <div className="container mx-auto max-w-4xl px-3 sm:px-6 pt-4 pb-8 space-y-4">
        <LegalDocumentView title="Privacy Policy" content={privacyContent} contact={salonContact} />
      </div>
    </main>
  )
}
