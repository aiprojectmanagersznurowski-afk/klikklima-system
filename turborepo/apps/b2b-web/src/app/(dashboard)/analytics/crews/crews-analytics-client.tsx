"use client"

import { useMemo } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { KpiCard } from "@/components/analytics/kpi-card"
import { ChartCard } from "@/components/analytics/chart-card"
import { AnalyticsTable } from "@/components/analytics/analytics-table"
import { Trophy, Wrench, ShieldAlert, Timer } from "lucide-react"
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area
} from "recharts"
import { format } from "date-fns"
import { pl } from "date-fns/locale"

const CHART_INDIGO = "#6366f1"
const CHART_GREEN = "#10b981"
const CHART_RED = "#ef4444"
const CHART_AMBER = "#f59e0b"

export function CrewsAnalyticsClient({
  crewRankings,
  trendData,
  tableData
}: {
  crewRankings: any[]
  trendData: any[]
  tableData: any[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const filterKey = searchParams.get('filterKey')
  const filterValue = searchParams.get('filterValue')

  // -- KPI --
  const totalInstallations = useMemo(() => trendData.reduce((acc, curr) => acc + curr.total, 0), [trendData])
  const completedInstallations = useMemo(() => trendData.reduce((acc, curr) => acc + curr.completed, 0), [trendData])
  
  const bestCrew = useMemo(() => {
    if (crewRankings.length === 0) return null
    return [...crewRankings].sort((a,b) => b.completed - a.completed)[0]
  }, [crewRankings])

  const totalIncidents = useMemo(() => crewRankings.reduce((acc, curr) => acc + curr.incidents, 0), [crewRankings])

  // Przekształcenia do wykresów
  const formattedTrendData = useMemo(() => trendData.map(d => ({
    ...d,
    monthLabel: format(new Date(d.month), 'LLL yy', { locale: pl })
  })), [trendData])

  // Kalkulacja score wydajnościowego: (completed*10 - rollbacks*5 - incidents*3) / total
  const rankingsWithScore = useMemo(() => {
    return crewRankings.map(crew => {
      const total = crew.total > 0 ? crew.total : 1
      const score = ((crew.completed * 10) - (crew.rollbacks * 5) - (crew.incidents * 3)) / total
      return {
        ...crew,
        score: Number(score.toFixed(2))
      }
    }).sort((a, b) => b.score - a.score)
  }, [crewRankings])

  // -- Handlery --
  const handleFilter = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams)
    params.set('filterKey', key)
    params.set('filterValue', value)
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const handleClearFilter = () => {
    const params = new URLSearchParams(searchParams)
    params.delete('filterKey')
    params.delete('filterValue')
    router.push(`${pathname}?${params.toString()}`, { scroll: false })
  }

  // -- Tabela --
  const filteredTableData = useMemo(() => {
    if (!filterKey || !filterValue) return tableData
    return tableData.filter((row: any) => {
      if (filterKey === 'zespol') return row.zespol?.nazwa === filterValue
      if (filterKey === 'status') return row.status === filterValue
      return true
    })
  }, [tableData, filterKey, filterValue])

  const columns = [
    { header: "Ekipa", accessor: (row: any) => <div className="font-medium">{row.zespol?.nazwa || 'Brak'}</div> },
    { header: "Klient / Miasto", accessor: (row: any) => 
        <div>
           <div>{row.lead?.klient?.imie_i_nazwisko || 'Brak'}</div>
           <div className="text-xs text-muted-foreground">{row.lead?.adres?.ulica_miasto || '-'}</div>
        </div> 
    },
    { header: "Projekt", accessor: (row: any) => <div className="text-muted-foreground text-sm">{row.lead?.project_number || '-'}</div> },
    { header: "Status", accessor: (row: any) => (
      <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
        {row.status}
      </span>
    )},
    { header: "Data Planowana", accessor: (row: any) => row.data_planowana ? format(new Date(row.data_planowana), 'dd.MM.yyyy') : '-' },
    { header: "Zakończenie", accessor: (row: any) => row.data_zakonczenia ? format(new Date(row.data_zakonczenia), 'dd.MM.yyyy') : '-' }
  ]

  return (
    <div className="space-y-6">
      
      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Zakończone Instalacje" value={completedInstallations} description={`z ${totalInstallations} wszystkich zaplanowanych`} icon={<Wrench size={20} />} trend="up" />
        <KpiCard title="Najlepsza Ekipa" value={bestCrew?.nazwa || '-'} description={`${bestCrew?.completed || 0} instalacji`} icon={<Trophy size={20} />} trend="neutral" />
        <KpiCard title="Suma Usterek" value={totalIncidents} icon={<ShieldAlert size={20} />} trend="down" />
        <KpiCard title="Średni Czas" value={bestCrew?.avg_days ? `${bestCrew.avg_days.toFixed(1)} dni` : '-'} description="Najlepsza średnia instalacji" icon={<Timer size={20} />} trend="neutral" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Performance Score */}
        <ChartCard title="Ranking Wydajności" description="Score = (completed×10 - rollbacks×5 - incidents×3) / total">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rankingsWithScore} margin={{ top: 10, right: 0, left: -20, bottom: 20 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
              <XAxis type="number" axisLine={false} tickLine={false} style={{fontSize: 12}} />
              <YAxis dataKey="nazwa" type="category" axisLine={false} tickLine={false} style={{fontSize: 12}} width={100} />
              <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="score" name="Score" fill={CHART_INDIGO} radius={[0, 4, 4, 0]} barSize={24}
                 onClick={(e: any) => { if(e && e.nazwa) handleFilter('zespol', e.nazwa) }} className="cursor-pointer" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Czysty ranking - Completed */}
        <ChartCard title="Zakończone Instalacje">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={crewRankings} margin={{ top: 10, right: 0, left: -20, bottom: 20 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
              <XAxis type="number" axisLine={false} tickLine={false} style={{fontSize: 12}} />
              <YAxis dataKey="nazwa" type="category" axisLine={false} tickLine={false} style={{fontSize: 12}} width={100} />
              <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="completed" name="Instalacje" fill={CHART_GREEN} radius={[0, 4, 4, 0]} barSize={24}
                 onClick={(e: any) => { if(e && e.nazwa) handleFilter('zespol', e.nazwa) }} className="cursor-pointer" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Problemy: Usterki i Rollbacki */}
        <ChartCard title="Usterki i Rollbacki (Incydenty)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={crewRankings} margin={{ top: 10, right: 0, left: -20, bottom: 20 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
              <XAxis type="number" axisLine={false} tickLine={false} style={{fontSize: 12}} />
              <YAxis dataKey="nazwa" type="category" axisLine={false} tickLine={false} style={{fontSize: 12}} width={100} />
              <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="incidents" name="Usterki" stackId="a" fill={CHART_AMBER} radius={[0, 0, 0, 0]} barSize={24} />
              <Bar dataKey="rollbacks" name="Rollbacki" stackId="a" fill={CHART_RED} radius={[0, 4, 4, 0]} barSize={24} 
                 onClick={(e: any) => { if(e && e.nazwa) handleFilter('zespol', e.nazwa) }} className="cursor-pointer" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Trend Miesięczny - AreaChart */}
        <ChartCard title="Trend Instalacji" description="Wykonane per miesiąc">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedTrendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_GREEN} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={CHART_GREEN} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tickMargin={10} style={{fontSize: 12}} />
              <YAxis axisLine={false} tickLine={false} tickMargin={10} style={{fontSize: 12}} />
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Area type="monotone" dataKey="completed" name="Zakończone" stroke={CHART_GREEN} strokeWidth={2} fillOpacity={1} fill="url(#colorCompleted)" activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      <div className="pt-4">
        <h3 className="text-lg font-semibold mb-4">Szczegóły Instalacji</h3>
        <AnalyticsTable 
          data={filteredTableData} 
          columns={columns} 
          filterKey={filterKey}
          filterValue={filterValue}
          onClearFilter={handleClearFilter}
        />
      </div>

    </div>
  )
}
