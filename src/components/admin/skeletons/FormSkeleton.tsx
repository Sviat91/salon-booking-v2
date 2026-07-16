import { Skeleton } from "@/components/ui/skeleton"

export default function FormSkeleton() {
  return (
    <section className="bg-card border border-border rounded-[20px] shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-border bg-muted/40">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="flex flex-col gap-6 p-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="grid gap-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-8 w-full max-w-sm" />
          </div>
        ))}
      </div>
    </section>
  )
}
