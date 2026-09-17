"use client"

import React, { useState } from "react"
import Link from "next/link"
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Info,
  ShieldAlert,
} from "lucide-react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import { Button } from "../../../components/ui/button"
import { MermaidDiagram } from "./mermaid-diagram"

export type DocMarkdownProps = {
  content: string
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore clipboard error
    }
  }

  const cleanLang = language.trim().toLowerCase() || "tekst"

  return (
    <div className="my-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border bg-secondary/40 px-4 py-2">
        <span className="font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {cleanLang}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={handleCopy}
          className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          {copied ? (
            <>
              <Check className="size-3.5 text-primary" />
              <span>Skopiowano</span>
            </>
          ) : (
            <>
              <Copy className="size-3.5" />
              <span>Kopiuj</span>
            </>
          )}
        </Button>
      </div>
      <pre className="overflow-x-auto bg-secondary/15 p-4 font-mono text-xs leading-relaxed text-foreground sm:text-sm">
        <code>{code}</code>
      </pre>
    </div>
  )
}

type AlertConfig = {
  label: string
  icon: typeof Info
  borderClass: string
  bgClass: string
  textClass: string
}

const ALERT_CONFIGS: Record<string, AlertConfig> = {
  NOTE: {
    label: "Informacja",
    icon: Info,
    borderClass: "border-primary",
    bgClass: "bg-primary/5",
    textClass: "text-primary",
  },
  TIP: {
    label: "Wskazówka",
    icon: CheckCircle2,
    borderClass: "border-accent",
    bgClass: "bg-accent/5",
    textClass: "text-accent",
  },
  IMPORTANT: {
    label: "Ważne",
    icon: AlertCircle,
    borderClass: "border-primary",
    bgClass: "bg-primary/10",
    textClass: "text-primary",
  },
  WARNING: {
    label: "Ostrzeżenie",
    icon: AlertTriangle,
    borderClass: "border-amber-500",
    bgClass: "bg-amber-500/10",
    textClass: "text-amber-500",
  },
  CAUTION: {
    label: "Ostrożnie",
    icon: ShieldAlert,
    borderClass: "border-destructive",
    bgClass: "bg-destructive/10",
    textClass: "text-destructive",
  },
}

function CalloutAlert({
  alertType,
  children,
}: {
  alertType: string
  children: React.ReactNode
}) {
  const config = ALERT_CONFIGS[alertType] || ALERT_CONFIGS.NOTE
  const Icon = config.icon

  return (
    <div
      className={`my-6 rounded-2xl border-l-4 ${config.borderClass} ${config.bgClass} p-4 shadow-sm sm:p-5`}
    >
      <div className="mb-2 flex items-center gap-2">
        <Icon className={`size-4 ${config.textClass}`} />
        <span className={`text-xs font-bold uppercase tracking-wider ${config.textClass}`}>
          {config.label}
        </span>
      </div>
      <div className="text-sm leading-relaxed text-foreground [&>p:last-child]:mb-0">
        {children}
      </div>
    </div>
  )
}

function parseAlertFromChildren(children: React.ReactNode): {
  type: string
  content: React.ReactNode
} | null {
  if (!children) return null
  const arr = React.Children.toArray(children)
  if (arr.length === 0) return null
  const first = arr[0]

  if (React.isValidElement(first) && first.type === "p") {
    const pChildren = React.Children.toArray(
      (first.props as { children?: React.ReactNode }).children,
    )
    if (typeof pChildren[0] === "string") {
      const match = pChildren[0].match(
        /^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(\n)?(.*)/i,
      )
      if (match) {
        const type = match[1].toUpperCase()
        const remainder = match[3]
        const remainingPChildren = remainder
          ? [remainder, ...pChildren.slice(1)]
          : pChildren.slice(1)

        const modifiedP = React.cloneElement(first, {}, ...remainingPChildren)
        return {
          type,
          content: [modifiedP, ...arr.slice(1)],
        }
      }
    }
  }

  return null
}

export function DocMarkdown({ content }: DocMarkdownProps) {
  return (
    <article className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Przycisk powrotu na samej górze dokumentu */}
      <div className="mb-8">
        <Link href="/dokumentacja">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2.5 gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Wstecz
          </Button>
        </Link>
      </div>

      <div className="prose-none text-base leading-7 text-foreground">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ className, node, ...props }) => (
              <h1
                className="mb-6 mt-10 border-b border-border pb-3 text-2xl font-bold tracking-tight text-foreground first:mt-0 sm:text-3xl"
                {...props}
              />
            ),
            h2: ({ className, node, ...props }) => (
              <h2
                className="mb-4 mt-10 border-b border-border/60 pb-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
                {...props}
              />
            ),
            h3: ({ className, node, ...props }) => (
              <h3
                className="mb-3 mt-8 text-lg font-semibold tracking-tight text-foreground sm:text-xl"
                {...props}
              />
            ),
            h4: ({ className, node, ...props }) => (
              <h4
                className="mb-2 mt-6 text-sm font-semibold uppercase tracking-wider text-muted-foreground"
                {...props}
              />
            ),
            p: ({ className, node, ...props }) => (
              <p className="mb-4 text-base leading-7 text-foreground" {...props} />
            ),
            ul: ({ className, node, ...props }) => (
              <ul className="mb-4 ml-6 list-disc space-y-1.5 text-foreground" {...props} />
            ),
            ol: ({ className, node, ...props }) => (
              <ol className="mb-4 ml-6 list-decimal space-y-1.5 text-foreground" {...props} />
            ),
            li: ({ className, node, ...props }) => <li className="leading-7" {...props} />,
            a: ({ className, node, href, children, ...props }) => {
              const isExternal =
                typeof href === "string" &&
                (href.startsWith("http://") || href.startsWith("https://"))

              if (isExternal) {
                return (
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 rounded-sm font-medium text-primary underline underline-offset-2 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                    {...props}
                  >
                    <span>{children}</span>
                    <ExternalLink className="size-3 shrink-0 opacity-70" />
                  </a>
                )
              }

              // Wewnętrzny link do dokumentacji: jeśli wskazuje na plik .md, normalizuj do /dokumentacja
              let targetHref = href || "#"
              if (typeof href === "string" && href.endsWith(".md")) {
                targetHref = "/dokumentacja"
              }

              return (
                <Link
                  href={targetHref}
                  className="rounded-sm font-medium text-primary underline underline-offset-2 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                >
                  {children}
                </Link>
              )
            },
            strong: ({ className, node, ...props }) => (
              <strong className="font-semibold text-foreground" {...props} />
            ),
            em: ({ className, node, ...props }) => <em className="italic" {...props} />,
            hr: ({ className, node, ...props }) => (
              <hr className="my-10 border-t border-border" {...props} />
            ),
            blockquote: ({ className, node, children, ...props }) => {
              const alert = parseAlertFromChildren(children)
              if (alert) {
                return <CalloutAlert alertType={alert.type}>{alert.content}</CalloutAlert>
              }

              return (
                <blockquote
                  className="my-6 rounded-r-2xl border-l-4 border-primary/40 bg-secondary/30 py-3.5 pl-5 pr-4 italic text-muted-foreground"
                  {...props}
                >
                  {children}
                </blockquote>
              )
            },
            pre: ({ children }) => <>{children}</>,
            code: ({ className, node, children, ...props }) => {
              const raw = String(children || "")

              // Wykrywanie bloków Mermaid — zarówno jawnych ```mermaid, jak i diagramów flowchart/sequence/state
              const isMermaid =
                (typeof className === "string" &&
                  (className.includes("mermaid") || className === "language-mermaid")) ||
                raw.trim().startsWith("flowchart ") ||
                raw.trim().startsWith("sequenceDiagram") ||
                raw.trim().startsWith("stateDiagram") ||
                raw.trim().startsWith("erDiagram") ||
                raw.trim().startsWith("classDiagram")

              if (isMermaid) {
                return <MermaidDiagram chart={raw} />
              }

              const isBlock =
                (typeof className === "string" && className.startsWith("language-")) ||
                raw.includes("\n")

              if (isBlock) {
                const lang =
                  (typeof className === "string" &&
                    className.replace("language-", "")) ||
                  "kod"
                return <CodeBlock language={lang} code={raw} />
              }

              return (
                <code
                  className="rounded-md bg-secondary/80 px-1.5 py-0.5 font-mono text-sm font-medium text-foreground"
                  {...props}
                >
                  {children}
                </code>
              )
            },
            table: ({ className, node, ...props }) => (
              <div className="my-8 w-full overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
                <table className="w-full border-collapse text-sm" {...props} />
              </div>
            ),
            thead: ({ className, node, ...props }) => (
              <thead className="border-b border-border bg-secondary/60" {...props} />
            ),
            tbody: ({ className, node, ...props }) => (
              <tbody className="divide-y divide-border/60" {...props} />
            ),
            tr: ({ className, node, ...props }) => (
              <tr
                className="transition-colors hover:bg-secondary/30 even:bg-secondary/15"
                {...props}
              />
            ),
            th: ({ className, node, ...props }) => (
              <th
                className="border-b border-border p-3.5 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                {...props}
              />
            ),
            td: ({ className, node, ...props }) => (
              <td
                className="border-b border-border/50 p-3.5 align-top text-foreground leading-relaxed"
                {...props}
              />
            ),
            img: ({ className, node, src, alt, ...props }) => (
              <span className="my-8 block overflow-hidden rounded-2xl border border-border bg-card p-3 shadow-sm">
                <img
                  src={src}
                  alt={alt}
                  className="mx-auto max-h-[600px] w-auto rounded-xl object-contain"
                  loading="lazy"
                  {...props}
                />
                {alt && (
                  <span className="mt-2.5 block text-center text-xs font-medium text-muted-foreground">
                    {alt}
                  </span>
                )}
              </span>
            ),
            input: ({ className, node, type, ...props }) => {
              if (type === "checkbox") {
                return (
                  <input
                    type="checkbox"
                    disabled
                    className="mr-2 size-4 rounded border-border text-primary focus:ring-primary align-middle"
                    {...props}
                  />
                )
              }
              return <input type={type} className={className} {...props} />
            },
          }}
        >
          {content}
        </ReactMarkdown>
      </div>

      {/* Przycisk powrotu na dole dokumentu */}
      <div className="mt-14 border-t border-border pt-6">
        <Link href="/dokumentacja">
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2.5 gap-2 text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-4" />
            Wstecz do listy dokumentów
          </Button>
        </Link>
      </div>
    </article>
  )
}
