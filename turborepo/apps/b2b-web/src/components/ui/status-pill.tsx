import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Jedyny dopuszczalny sposób renderowania statusu (leada, instalacji, zgłoszenia serwisowego)
 * w panelu B2B. Zastępuje ręczne <span>/<Badge> z nadpisywanymi kolorami rozsiane po widokach.
 *
 * UWAGA: celowo brak tonu "success"/zielonego — CLAUDE.md tego repo zakazuje zielonych
 * alertów SLA, a status może mieć związek z terminami. Jeśli kontekst naprawdę nie dotyczy
 * czasu/SLA, użyj `neutral`.
 */
export type StatusPillTone = "neutral" | "info" | "warning" | "danger"

const statusPillVariants = cva(
  "inline-flex w-fit shrink-0 items-center justify-center gap-1 whitespace-nowrap rounded-4xl border px-3 py-1 text-xs font-medium transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
  {
    variants: {
      tone: {
        neutral: "border-transparent bg-secondary text-secondary-foreground",
        info: "border-primary/20 bg-primary/10 text-primary",
        warning:
          "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-500",
        danger: "border-destructive/20 bg-destructive/10 text-destructive",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  }
)

interface StatusPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusPillVariants> {
  label: string
}

function StatusPill({ label, tone, className, ...props }: StatusPillProps) {
  return (
    <span
      data-slot="status-pill"
      className={cn(statusPillVariants({ tone, className }))}
      {...props}
    >
      {label}
    </span>
  )
}

export { StatusPill, statusPillVariants }
