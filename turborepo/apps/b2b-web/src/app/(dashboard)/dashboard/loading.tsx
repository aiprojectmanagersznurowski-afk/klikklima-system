import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPageLoading() {
  return (
    <div className="h-full flex flex-col max-w-[1800px] mx-auto animate-in fade-in duration-200">
      <div className="flex justify-between items-center bg-card p-6 border-b border-border">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-7 w-36" />
          <Skeleton className="h-4 w-72" />
        </div>
      </div>

      <div className="flex flex-col flex-1 p-6 gap-6 bg-background">
        {/* 5 KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="size-5 rounded-md" />
              </div>
              <Skeleton className="h-8 w-16 mt-3" />
              <Skeleton className="h-3 w-28 mt-1" />
            </div>
          ))}
        </div>

        {/* 2 Preview sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1">
          <div className="bg-card border border-border rounded-2xl p-6 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="space-y-3 flex-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-3 border border-border/60 rounded-xl flex items-center justify-between">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-5 w-44" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="space-y-3 flex-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-3 border border-border/60 rounded-xl flex items-center justify-between">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
