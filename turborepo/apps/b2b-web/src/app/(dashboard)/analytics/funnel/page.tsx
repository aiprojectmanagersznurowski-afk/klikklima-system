import { Suspense } from "react"
import { getFunnelSankeyData, getFunnelTrend, getLostReasons, getConversionRates, getFunnelLeadsForTable } from "../actions"
import { FunnelClient } from "./funnel-client"
import { subDays, parseISO } from "date-fns"

export default async function FunnelPage(props: {
  searchParams: Promise<{ from?: string; to?: string; preset?: string }>
}) {
  const searchParams = await props.searchParams
  const endDate = searchParams.to ? parseISO(searchParams.to) : new Date()
  const startDate = searchParams.from ? parseISO(searchParams.from) : subDays(endDate, 30)

  // Fetching all data in parallel
  const [sankeyData, trendData, lostReasons, conversionRates, tableData] = await Promise.all([
    getFunnelSankeyData(startDate, endDate),
    getFunnelTrend(startDate, endDate),
    getLostReasons(startDate, endDate),
    getConversionRates(startDate, endDate),
    getFunnelLeadsForTable(startDate, endDate)
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col">
        <h2 className="text-xl font-bold">Lejek Sprzedaży</h2>
        <p className="text-sm text-muted-foreground">Analiza przepływu i konwersji leadów w czasie</p>
      </div>

      <Suspense fallback={<div className="h-96 animate-pulse bg-muted rounded-xl"></div>}>
        <FunnelClient 
          sankeyData={sankeyData}
          trendData={trendData}
          lostReasons={lostReasons}
          conversionRates={conversionRates}
          tableData={tableData}
        />
      </Suspense>
    </div>
  )
}
