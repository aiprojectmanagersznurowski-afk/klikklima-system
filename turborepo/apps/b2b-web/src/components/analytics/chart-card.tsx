"use client"

import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"

interface ChartCardProps {
  title: string
  description?: string
  children: React.ReactNode
  className?: string
  contentClassName?: string
}

export function ChartCard({ title, description, children, className, contentClassName }: ChartCardProps) {
  return (
    <Card className={`shadow-2xs flex flex-col ${className || ''}`}>
      <CardHeader className="pb-2 shrink-0">
        <CardTitle className="text-base font-semibold">{title}</CardTitle>
        {description && <CardDescription className="text-xs">{description}</CardDescription>}
      </CardHeader>
      <CardContent className={`flex-1 min-h-[300px] w-full pt-4 ${contentClassName || ''}`}>
        {children}
      </CardContent>
    </Card>
  )
}
