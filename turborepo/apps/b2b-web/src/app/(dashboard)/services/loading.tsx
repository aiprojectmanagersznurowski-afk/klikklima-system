import { PageHeaderSkeleton, FilterBarSkeleton, TableSkeleton } from "@/components/ui/table-skeleton";

export default function Loading() {
  return (
    <div className="h-full flex flex-col max-w-[1800px] mx-auto">
      <PageHeaderSkeleton />
      <div className="flex flex-col flex-1 p-6 gap-6 bg-background">
        <FilterBarSkeleton />
        <TableSkeleton columns={5} rows={8} />
      </div>
    </div>
  );
}
