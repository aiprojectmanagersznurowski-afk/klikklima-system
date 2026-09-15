import { Suspense } from "react"
import { getCrewRankings, getCrewInstallationsForTable, getInstallationTrend } from "../actions"
import { CrewsAnalyticsClient } from "./crews-analytics-client"
import { subDays, parseISO } from "date-fns"

export default async function CrewsAnalyticsPage(props: {
  searchParams: Promise<{ from?: string; to?: string; preset?: string }>
}) {
  const searchParams = await props.searchParams
  const endDate = searchParams.to ? parseISO(searchParams.to) : new Date()
  const startDate = searchParams.from ? parseISO(searchParams.from) : subDays(endDate, 30)

  const [crewRankings, trendData, tableData] = await Promise.all([
    getCrewRankings(startDate, endDate),
    getInstallationTrend(startDate, endDate),
    getCrewInstallationsForTable(startDate, endDate)
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col">
        <h2 className="text-xl font-bold">Montaże & Ekipy</h2>
        <p className="text-sm text-muted-foreground">Analiza wydajności i rankingi zespołów monterskich</p>
      </div>

      <Suspense fallback={<div className="h-96 animate-pulse bg-muted rounded-xl"></div>}>
        <CrewsAnalyticsClient 
          crewRankings={crewRankings}
          trendData={trendData}
          tableData={tableData}
        />
      </Suspense>
    </div>
  )
}
