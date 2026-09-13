"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { KpiCard } from "@/components/analytics/kpi-card"
import { ChartCard } from "@/components/analytics/chart-card"
import { AnalyticsTable } from "@/components/analytics/analytics-table"
import { SankeyChart, SankeyNode, SankeyLink } from "@/components/analytics/sankey-chart"
import { Users, TrendingUp, TrendingDown, Target } from "lucide-react"
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell
} from "recharts"
import { formatDate } from "@/lib/format-date"
import { formatLeadStatus, getLeadStatusTone, formatLostReason } from "@/lib/format-status"
import { StatusPill } from "@/components/ui/status-pill"

const PIE_COLORS = ['rgb(15, 23, 42)', 'rgb(51, 65, 85)', 'rgb(71, 85, 105)', 'rgb(100, 116, 139)', 'rgb(148, 163, 184)', 'rgb(203, 213, 225)']
const CHART_BLUE = "rgb(59, 130, 246)"
const CHART_INDIGO = "rgb(99, 102, 241)"

function formatShortMoney(amount: number): string {
  if (!amount || isNaN(amount)) return "0 zł"
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toFixed(1)} mln zł`
  }
  if (amount >= 1_000) {
    return `${Math.round(amount / 1_000)} tys. zł`
  }
  return `${Math.round(amount)} zł`
}

export function FunnelClient({
  sankeyData,
  trendData,
  lostReasons,
  conversionRates,
  tableData
}: {
  sankeyData: any[]
  trendData: any[]
  lostReasons: any[]
  conversionRates: any[]
  tableData: any[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [sankeyMode, setSankeyMode] = useState<"both" | "count" | "value">("both")

  const filterKey = searchParams.get('filterKey')
  const filterValue = searchParams.get('filterValue')

  // -- KPI Calculations --
  const totalLeads = useMemo(() => trendData.reduce((acc, curr) => acc + curr.new_leads, 0), [trendData])
  const completedInstalls = useMemo(() => trendData.reduce((acc, curr) => acc + curr.completed, 0), [trendData])
  const conversionRate = totalLeads > 0 ? ((completedInstalls / totalLeads) * 100).toFixed(1) : 0
  
  const formattedTrendData = useMemo(() => trendData.map(d => ({
    ...d,
    monthLabel: formatDate(d.month, 'LLL yy')
  })), [trendData])

  const lostReasonsData = useMemo(() => lostReasons.map(r => ({
    name: formatLostReason(r.lost_reason),
    rawCode: r.lost_reason,
    value: r._count.id
  })).sort((a,b) => b.value - a.value), [lostReasons])

  // Przekształcenie surowych danych w struktury Sankey (ilościową i wartościową)
  const { sankeyCountData, sankeyValueData } = useMemo(() => {
    const getCount = (status: string) => Number(sankeyData.find(s => s.status === status)?._count?.id || 0)
    const getValue = (status: string) => Number(sankeyData.find(s => s.status === status)?.totalValuePln || 0)

    const newL = getCount("NEW_LEAD")
    const awA = getCount("AWAITING_AUDIT")
    const auC = getCount("AUDIT_COMPLETED")
    const qR = getCount("QUOTE_REJECTED")
    const aL = getCount("ARCHIVED_LOST")
    const inC = getCount("INSTALLATION_COMPLETED")

    const inProg = getCount("AWAITING_CREW_ASSIGNMENT") +
                   getCount("HARDWARE_IN_WAREHOUSE") +
                   getCount("HARDWARE_IN_TRANSIT") +
                   getCount("AWAITING_INSTALLATION") +
                   getCount("ROLLBACK_RESCHEDULING")

    const valNewL = getValue("NEW_LEAD")
    const valAwA = getValue("AWAITING_AUDIT")
    const valAuC = getValue("AUDIT_COMPLETED")
    const valQR = getValue("QUOTE_REJECTED")
    const valAL = getValue("ARCHIVED_LOST")
    const valInC = getValue("INSTALLATION_COMPLETED")

    const valInProg = getValue("AWAITING_CREW_ASSIGNMENT") +
                      getValue("HARDWARE_IN_WAREHOUSE") +
                      getValue("HARDWARE_IN_TRANSIT") +
                      getValue("AWAITING_INSTALLATION") +
                      getValue("ROLLBACK_RESCHEDULING")

    // 1. Węzły i linki dla widoku ilościowego (liczba leadów)
    const countNodes: SankeyNode[] = [
      { 
        id: "NEW_LEAD", 
        title: formatLeadStatus("NEW_LEAD"), 
        label: `${formatLeadStatus("NEW_LEAD")} (${newL} szt. • ${formatShortMoney(valNewL)})`,
        count: newL,
        valuePln: valNewL
      },
      { 
        id: "AWAITING_AUDIT", 
        title: formatLeadStatus("AWAITING_AUDIT"), 
        label: `${formatLeadStatus("AWAITING_AUDIT")} (${awA} szt. • ${formatShortMoney(valAwA)})`,
        count: awA,
        valuePln: valAwA
      },
      { 
        id: "AUDIT_COMPLETED", 
        title: formatLeadStatus("AUDIT_COMPLETED"), 
        label: `${formatLeadStatus("AUDIT_COMPLETED")} (${auC} szt. • ${formatShortMoney(valAuC)})`,
        count: auC,
        valuePln: valAuC
      },
      { 
        id: "IN_INSTALLATION", 
        title: "Realizacja montażu", 
        label: `Realizacja montażu (${inProg} szt. • ${formatShortMoney(valInProg)})`,
        count: inProg,
        valuePln: valInProg
      },
      { 
        id: "QUOTE_REJECTED", 
        title: "Wyceny odrzucone", 
        label: `Wyceny odrzucone (${qR} szt. • ${formatShortMoney(valQR)})`,
        count: qR,
        valuePln: valQR
      },
      { 
        id: "ARCHIVED_LOST", 
        title: "Utracone trwale", 
        label: `Utracone trwale (${aL} szt. • ${formatShortMoney(valAL)})`,
        count: aL,
        valuePln: valAL
      },
      { 
        id: "INSTALLATION_COMPLETED", 
        title: formatLeadStatus("INSTALLATION_COMPLETED"), 
        label: `${formatLeadStatus("INSTALLATION_COMPLETED")} (${inC} szt. • ${formatShortMoney(valInC)})`,
        count: inC,
        valuePln: valInC
      }
    ]

    const fromNewToAwA = awA + auC + inProg + inC + qR
    const fromAwAToAuC = auC + inProg + inC + qR
    const fromAuCToInProg = inProg + inC
    const fromInProgToInC = inC
    const fromAuCToqR = qR
    
    const countLinks: SankeyLink[] = []
    if (fromNewToAwA > 0) countLinks.push({ source: "NEW_LEAD", target: "AWAITING_AUDIT", value: fromNewToAwA })
    if (aL > 0) countLinks.push({ source: "NEW_LEAD", target: "ARCHIVED_LOST", value: aL })
    if (fromAwAToAuC > 0) countLinks.push({ source: "AWAITING_AUDIT", target: "AUDIT_COMPLETED", value: fromAwAToAuC })
    if (fromAuCToInProg > 0) countLinks.push({ source: "AUDIT_COMPLETED", target: "IN_INSTALLATION", value: fromAuCToInProg })
    if (fromInProgToInC > 0) countLinks.push({ source: "IN_INSTALLATION", target: "INSTALLATION_COMPLETED", value: fromInProgToInC })
    if (fromAuCToqR > 0) countLinks.push({ source: "AUDIT_COMPLETED", target: "QUOTE_REJECTED", value: fromAuCToqR })

    // 2. Węzły i linki dla widoku wartościowego (kwota wycen w PLN)
    const valueNodes: SankeyNode[] = [
      { 
        id: "NEW_LEAD", 
        title: formatLeadStatus("NEW_LEAD"), 
        label: `${formatLeadStatus("NEW_LEAD")} (${formatShortMoney(valNewL)} • ${newL} szt.)`,
        count: newL,
        valuePln: valNewL
      },
      { 
        id: "AWAITING_AUDIT", 
        title: formatLeadStatus("AWAITING_AUDIT"), 
        label: `${formatLeadStatus("AWAITING_AUDIT")} (${formatShortMoney(valAwA)} • ${awA} szt.)`,
        count: awA,
        valuePln: valAwA
      },
      { 
        id: "AUDIT_COMPLETED", 
        title: formatLeadStatus("AUDIT_COMPLETED"), 
        label: `${formatLeadStatus("AUDIT_COMPLETED")} (${formatShortMoney(valAuC)} • ${auC} szt.)`,
        count: auC,
        valuePln: valAuC
      },
      { 
        id: "IN_INSTALLATION", 
        title: "Realizacja montażu", 
        label: `Realizacja montażu (${formatShortMoney(valInProg)} • ${inProg} szt.)`,
        count: inProg,
        valuePln: valInProg
      },
      { 
        id: "QUOTE_REJECTED", 
        title: "Wyceny odrzucone", 
        label: `Wyceny odrzucone (${formatShortMoney(valQR)} • ${qR} szt.)`,
        count: qR,
        valuePln: valQR
      },
      { 
        id: "ARCHIVED_LOST", 
        title: "Utracone trwale", 
        label: `Utracone trwale (${formatShortMoney(valAL)} • ${aL} szt.)`,
        count: aL,
        valuePln: valAL
      },
      { 
        id: "INSTALLATION_COMPLETED", 
        title: formatLeadStatus("INSTALLATION_COMPLETED"), 
        label: `${formatLeadStatus("INSTALLATION_COMPLETED")} (${formatShortMoney(valInC)} • ${inC} szt.)`,
        count: inC,
        valuePln: valInC
      }
    ]

    const valFromNewToAwA = valAwA + valAuC + valInProg + valInC + valQR
    const valFromAwAToAuC = valAuC + valInProg + valInC + valQR
    const valFromAuCToInProg = valInProg + valInC
    const valFromInProgToInC = valInC
    const valFromAuCToqR = valQR

    const valueLinks: SankeyLink[] = []
    if (valFromNewToAwA > 0) valueLinks.push({ source: "NEW_LEAD", target: "AWAITING_AUDIT", value: Math.round(valFromNewToAwA) })
    if (valAL > 0) valueLinks.push({ source: "NEW_LEAD", target: "ARCHIVED_LOST", value: Math.round(valAL) })
    if (valFromAwAToAuC > 0) valueLinks.push({ source: "AWAITING_AUDIT", target: "AUDIT_COMPLETED", value: Math.round(valFromAwAToAuC) })
    if (valFromAuCToInProg > 0) valueLinks.push({ source: "AUDIT_COMPLETED", target: "IN_INSTALLATION", value: Math.round(valFromAuCToInProg) })
    if (valFromInProgToInC > 0) valueLinks.push({ source: "IN_INSTALLATION", target: "INSTALLATION_COMPLETED", value: Math.round(valFromInProgToInC) })
    if (valFromAuCToqR > 0) valueLinks.push({ source: "AUDIT_COMPLETED", target: "QUOTE_REJECTED", value: Math.round(valFromAuCToqR) })

    // Bezpieczne filtrowanie węzłów — tylko węzły występujące w aktywnych linkach
    const activeCountNodeIds = new Set<string>()
    countLinks.forEach(l => {
      activeCountNodeIds.add(l.source)
      activeCountNodeIds.add(l.target)
    })
    const filteredCountNodes = countNodes.filter(n => activeCountNodeIds.has(n.id))

    const activeValueNodeIds = new Set<string>()
    valueLinks.forEach(l => {
      activeValueNodeIds.add(l.source)
      activeValueNodeIds.add(l.target)
    })
    const filteredValueNodes = valueNodes.filter(n => activeValueNodeIds.has(n.id))

    return {
      sankeyCountData: { nodes: filteredCountNodes, links: countLinks },
      sankeyValueData: { nodes: filteredValueNodes, links: valueLinks }
    }
  }, [sankeyData])

  // -- Event Handlers --
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

  // -- Table columns & filtering --
  const filteredTableData = useMemo(() => {
    if (!filterKey || !filterValue) return tableData
    return tableData.filter((row: any) => {
      if (filterKey === 'status') {
        if (filterValue === 'IN_INSTALLATION') {
          return [
            'AWAITING_CREW_ASSIGNMENT',
            'HARDWARE_IN_WAREHOUSE',
            'HARDWARE_IN_TRANSIT',
            'AWAITING_INSTALLATION',
            'ROLLBACK_RESCHEDULING'
          ].includes(row.status)
        }
        return row.status === filterValue
      }
      if (filterKey === 'lost_reason') return row.lost_reason === filterValue
      if (filterKey === 'month') return formatDate(row.created_at, 'LLL yy') === filterValue
      return true
    })
  }, [tableData, filterKey, filterValue])

  const columns = [
    { header: "Klient", accessor: (row: any) => <div className="font-medium">{row.klient?.imie_i_nazwisko || 'Brak danych'}</div> },
    { header: "Miejscowość", accessor: (row: any) => <div className="text-muted-foreground">{row.adres?.ulica_miasto?.split(',')[1] || row.adres?.ulica_miasto || '-'}</div> },
    { header: "Status", accessor: (row: any) => (
      <StatusPill
        label={formatLeadStatus(row.status)}
        tone={getLeadStatusTone(row.status)}
      />
    )},
    { header: "Wartość", accessor: (row: any) => <div className="font-mono text-right">{row.finalna_wycena_pln ? `${Number(row.finalna_wycena_pln).toLocaleString('pl-PL')} zł` : '-'}</div> },
    { header: "Data utworzenia", accessor: (row: any) => formatDate(row.created_at, 'dd.MM.yyyy') }
  ]

  const sankeyModeSwitcher = (
    <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border border-border">
      <button
        type="button"
        onClick={() => setSankeyMode('both')}
        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
          sankeyMode === 'both'
            ? "bg-background text-foreground shadow-xs font-semibold"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Dwa wykresy (porównanie)
      </button>
      <button
        type="button"
        onClick={() => setSankeyMode('count')}
        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
          sankeyMode === 'count'
            ? "bg-background text-foreground shadow-xs font-semibold"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Ilościowo (szt.)
      </button>
      <button
        type="button"
        onClick={() => setSankeyMode('value')}
        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
          sankeyMode === 'value'
            ? "bg-background text-foreground shadow-xs font-semibold"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Wartościowo (PLN)
      </button>
    </div>
  )

  return (
    <div className="space-y-6">
      
      {/* KPI Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Nowe Leady" value={totalLeads} icon={<Users size={20} />} trend="neutral" />
        <KpiCard title="Zakończone Instalacje" value={completedInstalls} icon={<Target size={20} />} trend="up" />
        <KpiCard title="Wskaźnik Konwersji" value={`${conversionRate}%`} icon={<TrendingUp size={20} />} trend={Number(conversionRate) > 10 ? 'up' : 'down'} />
        <KpiCard title="Utracone szanse" value={lostReasons.reduce((a,b) => a + b._count.id, 0)} icon={<TrendingDown size={20} />} trend="neutral" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Sankey Chart */}
        <ChartCard 
          title="Przepływ Leadów (Wykres Sankey)" 
          description={
            sankeyMode === 'count'
              ? "Wizualizacja ilościowa — grubość ścieżek odpowiada liczbie leadów (sztuki). Kliknij węzeł, aby przefiltrować tabelę."
              : sankeyMode === 'value'
                ? "Wizualizacja wartościowa — grubość ścieżek odpowiada łącznej kwocie wycen (PLN). Kliknij węzeł, aby przefiltrować tabelę."
                : "Zestawienie porównawcze: przepływ wolumenowy (sztuki) vs przepływ finansowy wycen (PLN). Kliknij węzeł, aby przefiltrować tabelę."
          }
          action={sankeyModeSwitcher}
          className={sankeyMode === 'both' ? "lg:col-span-3" : "lg:col-span-2"}
        >
          {sankeyMode === 'both' ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="border border-border rounded-xl p-4 bg-muted/20 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">1. Przepływ wolumenowy (liczba leadów)</span>
                  <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">Ilościowo [szt.]</span>
                </div>
                {sankeyCountData.links.length > 0 ? (
                  <SankeyChart 
                    data={sankeyCountData} 
                    unitLabel="szt."
                    height={460}
                    margin={{ top: 20, right: 140, bottom: 20, left: 140 }}
                    onClick={(id) => handleFilter('status', id)} 
                  />
                ) : (
                  <div className="h-[460px] flex items-center justify-center text-muted-foreground">Brak danych ilościowych</div>
                )}
              </div>
              <div className="border border-border rounded-xl p-4 bg-muted/20 flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold">2. Przepływ finansowy (kwota wycen)</span>
                  <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">Wartościowo [PLN]</span>
                </div>
                {sankeyValueData.links.length > 0 ? (
                  <SankeyChart 
                    data={sankeyValueData} 
                    isCurrency={true}
                    unitLabel="zł"
                    height={460}
                    margin={{ top: 20, right: 140, bottom: 20, left: 140 }}
                    onClick={(id) => handleFilter('status', id)} 
                  />
                ) : (
                  <div className="h-[460px] flex items-center justify-center text-muted-foreground">Brak danych finansowych</div>
                )}
              </div>
            </div>
          ) : sankeyMode === 'count' ? (
            sankeyCountData.links.length > 0 ? (
              <SankeyChart 
                data={sankeyCountData} 
                unitLabel="szt."
                isCurrency={false}
                onClick={(id) => handleFilter('status', id)} 
              />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">Brak danych dla tego okresu</div>
            )
          ) : (
            sankeyValueData.links.length > 0 ? (
              <SankeyChart 
                data={sankeyValueData} 
                unitLabel="zł"
                isCurrency={true}
                onClick={(id) => handleFilter('status', id)} 
              />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">Brak danych dla tego okresu</div>
            )
          )}
        </ChartCard>

        {/* Powody utraty - PieChart */}
        <ChartCard 
          title="Główne powody utraty" 
          description="Zarchiwizowane według przyczyny"
          className={sankeyMode === 'both' ? "lg:col-span-1" : ""}
        >
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={lostReasonsData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                onClick={(data: any) => handleFilter('lost_reason', data.rawCode || data.name)}
                className="cursor-pointer outline-none"
              >
                {lostReasonsData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <RechartsTooltip 
                formatter={(value: any) => [`${value} leadów`, 'Ilość']}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        {/* Trend Miesięczny - AreaChart */}
        <ChartCard 
          title="Trend nowych leadów" 
          description="Ilość leadów per miesiąc" 
          className={sankeyMode === 'both' ? "lg:col-span-2" : "lg:col-span-3"}
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formattedTrendData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              onClick={(e: any) => {
                 if(e && e.activeLabel) handleFilter('month', e.activeLabel)
              }}>
              <defs>
                <linearGradient id="colorLeads" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={CHART_BLUE} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={CHART_BLUE} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="monthLabel" axisLine={false} tickLine={false} tickMargin={10} style={{fontSize: 12}} />
              <YAxis axisLine={false} tickLine={false} tickMargin={10} style={{fontSize: 12}} />
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(226, 232, 240)" />
              <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
              <Area type="monotone" dataKey="new_leads" name="Nowe Leady" stroke={CHART_BLUE} strokeWidth={2} fillOpacity={1} fill="url(#colorLeads)" activeDot={{ r: 6 }} className="cursor-pointer" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>

      <div className="pt-4">
        <h3 className="text-lg font-semibold mb-4">Szczegóły leadów</h3>
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
