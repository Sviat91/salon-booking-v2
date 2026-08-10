import LegalPageHeader from '@/components/legal/LegalPageHeader'
import SupportPageSkeleton from '@/components/legal/SupportPageSkeleton'

export default function Loading() {
  return (
    <main className="relative flex-1 flex flex-col w-full max-w-full box-border overflow-x-hidden">
      <LegalPageHeader />
      <div className="container mx-auto max-w-6xl px-3 sm:px-6 pt-12 pb-6">
        <SupportPageSkeleton />
      </div>
    </main>
  )
}
