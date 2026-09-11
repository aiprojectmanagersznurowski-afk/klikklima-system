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
  onClick?: (nodeId: string) => void
}

export function SankeyChart({ data, onClick }: SankeyChartProps) {
  const isDark = false

  return (
    <div className="h-[500px] w-full">
      <ResponsiveSankey
        data={data}
        margin={{ top: 20, right: 20, bottom: 20, left: 20 }}
        align="justify"
        colors={{ scheme: 'category10' }}
        nodeOpacity={1}
        nodeHoverOthersOpacity={0.3}
        nodeThickness={18}
        nodeSpacing={24}
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
        nodeBorderRadius={3}
        linkOpacity={0.5}
        linkContract={3}
        enableLinkGradient={true}
        labelPosition="inside"
        labelOrientation="horizontal"
        labelPadding={16}
        labelTextColor={{
            from: 'color',
            modifiers: [
                [
                    'darker',
                    2
                ]
            ]
        }}
        onClick={(node) => {
           if(onClick && 'id' in node) {
             onClick(node.id.toString())
           }
        }}
        theme={{
          text: {
            fill: isDark ? '#e2e8f0' : '#334155',
            fontSize: 12,
            fontWeight: 500
          },
          tooltip: {
            container: {
              background: isDark ? '#1e293b' : '#ffffff',
              color: isDark ? '#e2e8f0' : '#334155',
              fontSize: 13,
              borderRadius: '6px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)'
            }
          }
        }}
      />
    </div>
  )
}
