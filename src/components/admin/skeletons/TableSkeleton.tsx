import { Skeleton } from "@/components/ui/skeleton"

export default function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-[20px] border border-border bg-card shadow-sm overflow-hidden">
      <div className="h-10 bg-muted/50" />
      <div className="divide-y divide-border">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-5 py-4">
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/4" />
            <Skeleton className="h-4 w-1/6" />
            <Skeleton className="ml-auto h-4 w-1/6" />
          </div>
        ))}
      </div>
    </div>
  )
}
