import MarkdownLite from './MarkdownLite'
import { useAppNavigation } from '../../context/AppContext'

interface LegalDocumentContact {
  companyName: string
  nip: string
  legalAddress: string
  email: string
}

interface LegalDocumentViewProps {
  title: string
  content: string
  contact: LegalDocumentContact
}

// Ported from the real LegalDocumentView.tsx. The real version resolves
// admin-authored content per-locale with a fallback-locale notice — this
// demo is single-language and content is always present, so that branch is
// dropped; the card body/contact block markup is otherwise identical.
export default function LegalDocumentView({ title, content, contact }: LegalDocumentViewProps) {
  const { navigateToSupport } = useAppNavigation()

  return (
    <>
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-foreground mb-2">{title}</h1>
      </div>

      <div className="bg-card backdrop-blur-sm rounded-2xl border border-border p-8">
        <MarkdownLite source={content} />

        <div className="bg-muted/30 rounded-lg p-6 mt-8">
          <h3 className="font-medium text-foreground mb-3">{contact.companyName}</h3>
          <div className="space-y-2 text-foreground">
            <p>
              <strong>Adres:</strong> {contact.legalAddress}
            </p>
            <p>
              <strong>Email:</strong> {contact.email}
            </p>
            <p>
              <strong>NIP:</strong> {contact.nip}
            </p>
            <p>
              <strong>Strona wsparcia:</strong>{' '}
              <button onClick={navigateToSupport} className="text-primary hover:text-primary/80">
                Centrum pomocy
              </button>
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
