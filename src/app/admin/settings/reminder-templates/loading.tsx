import FormSkeleton from "@/components/admin/skeletons/FormSkeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function ReminderTemplatesLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
      <FormSkeleton />
    </div>
  )
}
