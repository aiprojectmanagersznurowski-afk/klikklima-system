"use client"

import { useEffect, useId, useState } from "react"
import { AlertCircle, Check, Code, Copy, Loader2, Workflow } from "lucide-react"
import { Button } from "../../../components/ui/button"

export type MermaidDiagramProps = {
  chart: string
}

export function MermaidDiagram({ chart }: MermaidDiagramProps) {
  const [svg, setSvg] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showCode, setShowCode] = useState(false)
  const [copied, setCopied] = useState(false)

  const rawId = useId()
  const cleanId = rawId.replace(/[^a-zA-Z0-9]/g, "")

  useEffect(() => {
    let isMounted = true
    setIsLoading(true)
    setError(null)

    async function renderChart() {
      try {
        const mermaid = (await import("mermaid")).default
        const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark")

        mermaid.initialize({
          startOnLoad: false,
          securityLevel: "loose",
          theme: isDark ? "dark" : "neutral",
          fontFamily: "inherit",
          logLevel: "error",
        })

        const elementId = `mermaid-${cleanId}-${Math.random().toString(36).slice(2, 7)}`
        const { svg: renderedSvg } = await mermaid.render(elementId, chart.trim())

        const leftover = document.getElementById(`d${elementId}`)
        if (leftover) leftover.remove()

        if (isMounted) {
          setSvg(renderedSvg)
          setIsLoading(false)
        }
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : "Nie udało się wyrenderować diagramu Mermaid.")
          setIsLoading(false)
        }
      }
    }

    renderChart()

    return () => {
      isMounted = false
    }
  }, [chart, cleanId])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(chart.trim())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  return (
    <div className="my-8 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      {/* Pasek górny diagramu */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border bg-secondary/40 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Workflow className="size-4" />
          </div>
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Diagram Mermaid
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={handleCopy}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {copied ? (
              <>
                <Check className="size-3.5 text-primary" />
                <span>Skopiowano</span>
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                <span>Kopiuj kod</span>
              </>
            )}
          </Button>

          <Button
            type="button"
            variant={showCode ? "secondary" : "ghost"}
            size="xs"
            onClick={() => setShowCode(!showCode)}
            className="text-xs"
          >
            <Code className="size-3.5" />
            <span>{showCode ? "Pokaż diagram" : "Pokaż kod"}</span>
          </Button>
        </div>
      </div>

      {/* Treść diagramu */}
      <div className="p-4 sm:p-6">
        {showCode ? (
          <pre className="overflow-x-auto rounded-xl border border-border bg-secondary/30 p-4 font-mono text-xs leading-relaxed text-foreground">
            <code>{chart.trim()}</code>
          </pre>
        ) : isLoading ? (
          <div className="flex min-h-[160px] flex-col items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="size-5 animate-spin text-primary" />
            <span className="text-xs">Renderowanie diagramu...</span>
          </div>
        ) : error ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
            <pre className="overflow-x-auto rounded-xl border border-border bg-secondary/30 p-4 font-mono text-xs text-foreground">
              <code>{chart.trim()}</code>
            </pre>
          </div>
        ) : (
          <div
            className="flex w-full justify-center overflow-x-auto py-2 [&_svg]:max-w-full [&_svg]:h-auto"
            dangerouslySetInnerHTML={{ __html: svg || "" }}
          />
        )}
      </div>
    </div>
  )
}
