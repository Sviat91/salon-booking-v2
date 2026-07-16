import { Skeleton } from "@/components/ui/skeleton"

export default function MasterScheduleLoading() {
  return (
    <div className="flex flex-col gap-6 h-[calc(100vh-8rem)] min-h-[600px]">
      <div>
        <Skeleton className="h-6 w-64" />
        <Skeleton className="mt-2 h-4 w-80" />
      </div>
      <Skeleton className="flex-1 min-h-[500px] rounded-[20px]" />
    </div>
  )
}
