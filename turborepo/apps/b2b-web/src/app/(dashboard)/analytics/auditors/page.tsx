import { Suspense } from "react"
import { getAuditorRankings, getAuditorLeadsForTable } from "../actions"
import { AuditorsAnalyticsClient } from "./auditors-analytics-client"
import { subDays, parseISO } from "date-fns"

export default async function AuditorsAnalyticsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; preset?: string }
}) {
  const endDate = searchParams.to ? parseISO(searchParams.to) : new Date()
  const startDate = searchParams.from ? parseISO(searchParams.from) : subDays(endDate, 30)

  const [auditorRankings, tableData] = await Promise.all([
    getAuditorRankings(startDate, endDate),
    getAuditorLeadsForTable(startDate, endDate)
  ])

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col">
        <h2 className="text-xl font-bold">Audyty & Audytorzy</h2>
        <p className="text-sm text-muted-foreground">Wydajność sprzedaży, konwersja do instalacji i wartość (PLN)</p>
      </div>

      <Suspense fallback={<div className="h-96 animate-pulse bg-muted rounded-xl"></div>}>
        <AuditorsAnalyticsClient 
          auditorRankings={auditorRankings}
          tableData={tableData}
        />
      </Suspense>
    </div>
  )
}
