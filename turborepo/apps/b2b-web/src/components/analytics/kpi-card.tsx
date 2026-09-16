"use client"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

interface KpiCardProps {
  title: string
  value: string | number
  description?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
  icon?: React.ReactNode
}

export function KpiCard({ title, value, description, trend, trendValue, icon }: KpiCardProps) {
  return (
    <Card className="shadow-2xs">
      <CardContent className="p-6 flex flex-col justify-between h-full gap-4">
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          {icon && (
            <div className="p-2 bg-primary/10 rounded-md text-primary shrink-0">
              {icon}
            </div>
          )}
        </div>
        <div>
          <h3 className="text-2xl font-bold tracking-tight">{value}</h3>
          {(description || trendValue) && (
            <div className="flex items-center gap-2 mt-1">
              {trendValue && (
                <span className={cn(
                  "text-xs font-semibold px-1.5 py-0.5 rounded-full flex items-center",
                  trend === 'up' ? "bg-emerald-100 text-emerald-700" :
                  trend === 'down' ? "bg-rose-100 text-rose-700" :
                  "bg-slate-100 text-slate-700"
                )}>
                  {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'} {trendValue}
                </span>
              )}
              {description && (
                <p className="text-xs text-muted-foreground">{description}</p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
