"use client"

import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { subDays, subMonths, subYears, format } from "date-fns"

type Preset = '7d' | '30d' | '90d' | '1y' | 'all'

export function DateRangeFilter() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const currentPreset = searchParams.get('preset') || '30d'

  const handleValueChange = (value: string | null) => {
    if (!value) return
    const params = new URLSearchParams(searchParams)
    
    let from: Date | null = null
    const to = new Date()

    switch (value) {
      case '7d': from = subDays(to, 7); break;
      case '30d': from = subDays(to, 30); break;
      case '90d': from = subDays(to, 90); break;
      case '1y': from = subYears(to, 1); break;
      case 'all': from = new Date('2020-01-01'); break;
    }

    if (from) {
      params.set('from', format(from, 'yyyy-MM-dd'))
      params.set('to', format(to, 'yyyy-MM-dd'))
    }
    
    params.set('preset', value)
    
    // resetujemy inne filtry
    params.delete('filterKey')
    params.delete('filterValue')

    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-muted-foreground font-medium">Zakres dat:</span>
      <Select value={currentPreset} onValueChange={handleValueChange}>
        <SelectTrigger className="w-[180px] bg-background">
          <SelectValue placeholder="Wybierz zakres" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="7d">Ostatnie 7 dni</SelectItem>
          <SelectItem value="30d">Ostatnie 30 dni</SelectItem>
          <SelectItem value="90d">Ostatnie 90 dni</SelectItem>
          <SelectItem value="1y">Ostatni rok</SelectItem>
          <SelectItem value="all">Cały okres</SelectItem>
        </SelectContent>
      </Select>
    </div>
  )
}
