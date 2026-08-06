import { Skeleton } from "@/components/ui/skeleton"

/** Loading placeholder for `/privacy` and `/terms`, shaped like `LegalDocumentView`. */
export default function LegalDocumentSkeleton() {
  return (
    <>
      <div className="mb-6 flex justify-center">
        <Skeleton className="h-8 w-64" />
      </div>
      <div className="bg-card backdrop-blur-sm rounded-2xl border border-border p-8 space-y-3">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="rounded-lg p-6 mt-8 space-y-2">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </div>
    </>
  )
}
