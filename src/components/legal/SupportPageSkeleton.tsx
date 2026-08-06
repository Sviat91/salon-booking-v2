import { Skeleton } from "@/components/ui/skeleton"

/** Loading placeholder for `/support`, shaped like the contact form + sidebar grid. */
export default function SupportPageSkeleton() {
  return (
    <>
      <div className="mb-6 flex flex-col items-center gap-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-card backdrop-blur-sm rounded-2xl border border-border p-6 space-y-6">
            <Skeleton className="h-6 w-40" />
            <div className="grid md:grid-cols-2 gap-6">
              <Skeleton className="h-12 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
            <Skeleton className="h-12 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-12 w-full rounded-xl" />
          </div>
        </div>
        <div className="space-y-6">
          <div className="bg-card backdrop-blur-sm rounded-2xl border border-border p-5 space-y-3">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
          <div className="bg-card backdrop-blur-sm rounded-2xl border border-border p-5 space-y-3">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        </div>
      </div>
    </>
  )
}
