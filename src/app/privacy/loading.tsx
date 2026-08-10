import LegalPageHeader from '@/components/legal/LegalPageHeader'
import LegalDocumentSkeleton from '@/components/legal/LegalDocumentSkeleton'

export default function Loading() {
  return (
    <main className="relative flex-1 flex flex-col w-full max-w-full box-border overflow-x-hidden">
      <LegalPageHeader />
      <div className="container mx-auto max-w-4xl px-3 sm:px-6 pt-12 pb-8 space-y-4">
        <LegalDocumentSkeleton />
      </div>
    </main>
  )
}
