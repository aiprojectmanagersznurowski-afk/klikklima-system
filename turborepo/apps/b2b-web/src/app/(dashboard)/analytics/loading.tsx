import { Skeleton } from "@/components/ui/skeleton";
import { TableSkeleton } from "@/components/ui/table-skeleton";

export default function AnalyticsLoading() {
  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-200">
      {/* Title skeleton */}
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>

      {/* 4 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card border border-border rounded-xl p-5 shadow-xs flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="size-5 rounded-md" />
            </div>
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-36" />
          </div>
        ))}
      </div>

      {/* Charts Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card border border-border rounded-xl p-6 shadow-xs flex flex-col gap-4">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-[280px] w-full rounded-lg" />
        </div>
        <div className="bg-card border border-border rounded-xl p-6 shadow-xs flex flex-col gap-4">
          <Skeleton className="h-5 w-44" />
          <Skeleton className="h-[280px] w-full rounded-lg" />
        </div>
      </div>

      {/* Table Skeleton */}
      <div className="bg-card border border-border rounded-xl p-6 shadow-xs flex flex-col gap-4">
        <Skeleton className="h-5 w-36" />
        <TableSkeleton columns={5} rows={6} flat />
      </div>
    </div>
  );
}
