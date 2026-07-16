import StatCardsSkeleton from "@/components/admin/skeletons/StatCardsSkeleton"
import TableSkeleton from "@/components/admin/skeletons/TableSkeleton"
import { Skeleton } from "@/components/ui/skeleton"

export default function AdminDashboardLoading() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <Skeleton className="h-3 w-40" />
        <Skeleton className="mt-2 h-4 w-56" />
      </div>
      <StatCardsSkeleton />
      <TableSkeleton />
    </div>
  )
}
