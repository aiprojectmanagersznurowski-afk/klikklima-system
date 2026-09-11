"use client"

import { useMemo } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { KpiCard } from "@/components/analytics/kpi-card"
import { ChartCard } from "@/components/analytics/chart-card"
import { AnalyticsTable } from "@/components/analytics/analytics-table"
import { Briefcase, Target, CheckCircle2, XCircle } from "lucide-react"
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from "recharts"
import { format } from "date-fns"

const CHART_INDIGO = "#6366f1"
const CHART_GREEN = "#10b981"
const CHART_RED = "#ef4444"
const CHART_BLUE = "#3b82f6"

export function AuditorsAnalyticsClient({
  auditorRankings,
  tableData
}: {
  auditorRankings: any[]
  tableData: any[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const filterKey = searchParams.get('filterKey')
  const filterValue = searchParams.get('filterValue')

  // -- KPI --
  const totalAudits = useMemo(() => auditorRankings.reduce((acc, curr) => acc + curr.total_leads, 0), [auditorRankings])
  const completedInstalls = useMemo(() => auditorRankings.reduce((acc, curr) => acc + curr.completed, 0), [auditorRankings])
  const lostInstalls = useMemo(() => auditorRankings.reduce((acc, curr) => acc + curr.lost, 0), [auditorRankings])
  
  const totalValue = useMemo(() => auditorRankings.reduce((acc, curr) => acc + curr.total_value_pln, 0), [auditorRankings])
  
  const bestAuditorByValue = useMemo(() => {
    if (auditorRankings.length === 0) return null
    return [...auditorRankings].sort((a,b) => b.total_value_pln - a.total_value_pln)[0]
  }, [auditorRankings])

  const chartDataWithConversion = useMemo(() => {
    return auditorRankings.map(a => ({
      ...a,
      conversion: a.total_leads > 0 ? ((a.completed / a.total_leads) * 100).toFixed(1) : 0
    }))
  }, [auditorRankings])

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
      if (filterKey === 'audytor') return row.audytor?.imie_i_nazwisko === filterValue
      if (filterKey === 'status') return row.status === filterValue
      return true
    })
  }, [tableData, filterKey, filterValue])

  const columns = [
    { header: "Audytor", accessor: (row: any) => <div className="font-medium">{row.audytor?.imie_i_nazwisko || 'Nieprzypisany'}</div> },
    { header: "Klient / Miasto", accessor: (row: any) => 
        <div>
           <div>{row.klient?.imie_i_nazwisko || 'Brak'}</div>
           <div className="text-xs text-muted-foreground">{row.adres?.ulica_miasto || '-'}</div>
        </div> 
    },
    { header: "Status", accessor: (row: any) => (
      <span className="inline-flex items-center rounded-md bg-secondary px-2 py-1 text-xs font-medium text-secondary-foreground">
        {row.status}
      </span>
    )},
    { header: "Projekt", accessor: (row: any) => <div className="text-muted-foreground text-sm">{row.project_number || '-'}</div> },
    { header: "Wartość (PLN)", accessor: (row: any) => <div className="font-mono text-right">{row.finalna_wycena_pln ? `${Number(row.finalna_wycena_pln).toLocaleString('pl-PL')} zł` : '-'}</div> },
    { header: "Data utworzenia", accessor: (row: any) => row.created_at ? format(new Date(row.created_at), 'dd.MM.yyyy') : '-' }
  ]

  return (
    <div className="space-y-6">
      
      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Przypisane Audyty" value={totalAudits} description={`Z czego ${completedInstalls} zakończonych`} icon={<Briefcase size={20} />} trend="neutral" />
        <KpiCard title="Wygenerowana Sprzedaż" value={`${(totalValue / 1000).toFixed(1)}k PLN`} description="Zakończone instalacje" icon={<Target size={20} />} trend="up" />
        <KpiCard title="Lider Sprzedaży" value={bestAuditorByValue?.imie_i_nazwisko || '-'} description={`${((bestAuditorByValue?.total_value_pln || 0) / 1000).toFixed(1)}k PLN wygenerowane`} icon={<CheckCircle2 size={20} />} trend="neutral" />
        <KpiCard title="Zgubione Leady" value={lostInstalls} icon={<XCircle size={20} />} trend="down" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Wygenerowana wartość sprzedaży */}
        <ChartCard title="Ranking wg Wartości Sprzedaży (Zakończone instalacje)">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartDataWithConversion} margin={{ top: 10, right: 0, left: 10, bottom: 20 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
              <XAxis type="number" axisLine={false} tickLine={false} style={{fontSize: 12}} />
              <YAxis dataKey="imie_i_nazwisko" type="category" axisLine={false} tickLine={false} style={{fontSize: 12}} width={120} />
              <RechartsTooltip formatter={(value: any) => [`${value.toLocaleString('pl-PL')} zł`, 'Wartość']} cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Bar dataKey="total_value_pln" name="Sprzedaż PLN" fill={CHART_INDIGO} radius={[0, 4, 4, 0]} barSize={24}
                 onClick={(e) => { if(e && e.imie_i_nazwisko) handleFilter('audytor', e.imie_i_nazwisko) }} className="cursor-pointer" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Leady przypisane vs zakończone vs zagubione (Stack) */}
        <ChartCard title="Leady: Zakończone vs Utracone vs Aktywne">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={auditorRankings} margin={{ top: 10, right: 0, left: 10, bottom: 20 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#e2e8f0" />
              <XAxis type="number" axisLine={false} tickLine={false} style={{fontSize: 12}} />
              <YAxis dataKey="imie_i_nazwisko" type="category" axisLine={false} tickLine={false} style={{fontSize: 12}} width={120} />
              <RechartsTooltip cursor={{fill: '#f1f5f9'}} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
              <Bar dataKey="completed" name="Zakończone" stackId="a" fill={CHART_GREEN} barSize={24} />
              <Bar dataKey="active_now" name="W Trakcie" stackId="a" fill={CHART_BLUE} barSize={24} />
              <Bar dataKey="lost" name="Utracone" stackId="a" fill={CHART_RED} radius={[0, 4, 4, 0]} barSize={24} 
                 onClick={(e) => { if(e && e.imie_i_nazwisko) handleFilter('audytor', e.imie_i_nazwisko) }} className="cursor-pointer" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      <div className="pt-4">
        <h3 className="text-lg font-semibold mb-4">Szczegóły przypisanych leadów</h3>
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
