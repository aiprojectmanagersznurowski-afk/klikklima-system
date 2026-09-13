"use client"

import dynamic from "next/dynamic"

// Nivo Sankey must be rendered only on the client side
const ResponsiveSankey = dynamic(
  () => import("@nivo/sankey").then((mod) => mod.ResponsiveSankey),
  { ssr: false, loading: () => <div className="h-full w-full flex items-center justify-center text-muted-foreground animate-pulse">Ładowanie wykresu...</div> }
)

export interface SankeyNode {
  id: string
  label?: string
  title?: string
  count?: number
  valuePln?: number
  nodeColor?: string
}

export interface SankeyLink {
  source: string
  target: string
  value: number
}

interface SankeyChartProps {
  data: {
    nodes: SankeyNode[]
    links: SankeyLink[]
  }
  unitLabel?: string
  isCurrency?: boolean
  height?: number
  margin?: { top: number; right: number; bottom: number; left: number }
  onClick?: (nodeId: string) => void
}

export function SankeyChart({ 
  data, 
  unitLabel = "szt.", 
  isCurrency = false,
  height = 520,
  margin = { top: 20, right: 180, bottom: 20, left: 180 },
  onClick 
}: SankeyChartProps) {
  const formatVal = (val: number) => {
    if (isCurrency) {
      return `${Math.round(val).toLocaleString("pl-PL")} zł`
    }
    return `${val} ${unitLabel}`
  }

  return (
    <div style={{ height: `${height}px` }} className="w-full">
      <ResponsiveSankey
        data={data}
        margin={margin}
        align="justify"
        colors={{ scheme: 'category10' }}
        nodeOpacity={1}
        nodeHoverOthersOpacity={0.3}
        nodeThickness={20}
        nodeSpacing={26}
        nodeBorderWidth={0}
        nodeBorderColor={{
            from: 'color',
            modifiers: [
                [
                    'darker',
                    0.8
                ]
            ]
        }}
        nodeBorderRadius={4}
        linkOpacity={0.5}
        linkContract={3}
        enableLinkGradient={true}
        label={(node: any) => (node.label || node.id)}
        labelPosition="outside"
        labelOrientation="horizontal"
        labelPadding={12}
        labelTextColor={{
            from: 'color',
            modifiers: [
                [
                    'darker',
                    2
                ]
            ]
        }}
        nodeTooltip={({ node }: any) => {
          const count = node.count !== undefined ? node.count : (isCurrency ? undefined : node.value)
          const valPln = node.valuePln !== undefined ? node.valuePln : (isCurrency ? node.value : undefined)
          const avgPln = count && count > 0 && valPln ? Math.round(valPln / count) : null

          return (
            <div className="bg-popover text-popover-foreground p-3 rounded-lg shadow-lg border border-border text-xs space-y-1.5 min-w-[220px]">
              <div className="font-semibold text-sm border-b border-border pb-1">
                {node.title || node.label || node.id}
              </div>
              {count !== undefined && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Liczba leadów:</span>
                  <span className="font-mono font-medium">{count} szt.</span>
                </div>
              )}
              {valPln !== undefined && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Kwota wycen:</span>
                  <span className="font-mono font-semibold text-primary">
                    {Math.round(valPln).toLocaleString("pl-PL")} zł
                  </span>
                </div>
              )}
              {avgPln !== null && (
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Średnia na lead:</span>
                  <span className="font-mono text-muted-foreground">
                    {avgPln.toLocaleString("pl-PL")} zł/szt.
                  </span>
                </div>
              )}
              <div className="text-[10px] text-muted-foreground pt-1 border-t border-border">
                Kliknij węzeł, aby przefiltrować tabelę
              </div>
            </div>
          )
        }}
        linkTooltip={({ link }: any) => (
          <div className="bg-popover text-popover-foreground p-2.5 rounded-lg shadow-md border border-border text-xs space-y-1">
            <div className="font-medium text-muted-foreground">
              {link.source.title || link.source.label || link.source.id} → {link.target.title || link.target.label || link.target.id}
            </div>
            <div className="font-mono font-semibold text-sm text-foreground">
              Przepływ: {formatVal(link.value)}
            </div>
          </div>
        )}
        onClick={(node) => {
           if(onClick && 'id' in node) {
             onClick(node.id.toString())
           }
        }}
        theme={{
          text: {
            fill: "currentColor",
            fontSize: 12,
            fontWeight: 500
          },
          tooltip: {
            container: {
              background: "var(--card)",
              color: "var(--card-foreground)",
              fontSize: 13,
              borderRadius: "6px",
              boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)"
            }
          }
        }}
      />
    </div>
  )
}
