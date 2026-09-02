import { PageHeaderSkeleton, FilterBarSkeleton, TableSkeleton } from "@/components/ui/table-skeleton";

export default function Loading() {
  return (
    <div className="h-full flex flex-col max-w-[1800px] mx-auto">
      <PageHeaderSkeleton withAction />
      <div className="flex flex-col flex-1 p-6 gap-6 bg-background">
        <FilterBarSkeleton />
        <TableSkeleton columns={6} rows={10} />
      </div>
    </div>
  );
}
