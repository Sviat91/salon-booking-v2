import FormSkeleton from "@/components/admin/skeletons/FormSkeleton"
import TableSkeleton from "@/components/admin/skeletons/TableSkeleton"

export default function MasterPagesLoading() {
  return (
    <div className="flex flex-col gap-8">
      <FormSkeleton />
      <TableSkeleton />
    </div>
  )
}
