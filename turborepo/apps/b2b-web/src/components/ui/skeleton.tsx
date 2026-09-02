import { cn } from "@/lib/utils";

/**
 * Prymityw szkieletu ładowania (shadcn/ui standard).
 * Używa wyłącznie tokenu `bg-secondary` (P2-4, AUDYT-B2B-2026-09-02) —
 * zero hardkodowanych kolorów, animacja przez natywne `animate-pulse` Tailwind.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-pulse rounded-md bg-secondary", className)}
      {...props}
    />
  );
}

export { Skeleton };
