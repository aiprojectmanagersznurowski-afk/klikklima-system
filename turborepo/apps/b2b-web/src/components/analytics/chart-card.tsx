"use client"

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

interface ChartCardProps {
  title: string
  description?: string
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
  contentClassName?: string
}

export function ChartCard({ title, description, action, children, className, contentClassName }: ChartCardProps) {
  return (
    <Card className={`shadow-2xs flex flex-col ${className || ''}`}>
      <CardHeader className="pb-2 shrink-0 flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-base font-semibold">{title}</CardTitle>
          {description && <CardDescription className="text-xs mt-1">{description}</CardDescription>}
        </div>
        {action && <div className="shrink-0">{action}</div>}
      </CardHeader>
      <CardContent className={`flex-1 min-h-[300px] w-full pt-4 ${contentClassName || ''}`}>
        {children}
      </CardContent>
    </Card>
  )
}
