import { PageHeaderSkeleton, TableSkeleton } from "@/components/ui/table-skeleton";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardRootLoading() {
  return (
    <div className="h-full flex flex-col max-w-[1800px] mx-auto animate-in fade-in duration-200">
      <PageHeaderSkeleton
        right={
          <div className="flex gap-4">
            <Skeleton className="h-9 w-40 rounded-md" />
          </div>
        }
      />
      <div className="flex flex-col flex-1 p-6 gap-6 bg-background">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col gap-3">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-20" />
              <Skeleton className="h-3 w-36" />
            </div>
          ))}
        </div>
        <div className="flex-1 bg-card rounded-2xl border border-border overflow-hidden shadow-sm">
          <TableSkeleton columns={6} rows={8} flat />
        </div>
      </div>
    </div>
  );
}
