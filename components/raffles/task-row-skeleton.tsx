import { Skeleton } from "@/components/ui/skeleton";

export function TaskRowSkeleton() {
  return (
    <div className="card-soft flex w-full items-center gap-3 rounded-[28px] border border-border bg-card px-4 py-3">
      <Skeleton className="h-11 w-11 shrink-0 rounded-full" />
      <span className="block min-w-0 flex-1">
        <Skeleton className="h-4 w-28 rounded-full" />
        <Skeleton className="mt-2 h-2.5 w-20 rounded-full" />
      </span>
      <Skeleton className="h-6 w-16 shrink-0 rounded-full" />
    </div>
  );
}
