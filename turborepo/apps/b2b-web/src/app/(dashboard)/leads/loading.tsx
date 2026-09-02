import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="h-full flex flex-col max-w-[1800px] mx-auto">
      <PageHeaderSkeleton
        right={
          <div className="flex gap-4">
            <Skeleton className="h-9 w-56 rounded-md" />
            <Skeleton className="h-9 w-64 rounded-md" />
          </div>
        }
      />
      <div className="flex flex-col flex-1 overflow-hidden bg-card">
        <TableSkeleton columns={7} rows={10} flat />
      </div>
    </div>
  );
}
