"use client"

import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"

/**
 * Renderer Markdown dla przeglądarki dokumentacji projektu w panelu B2B (decyzje Michała,
 * 2026-09-17). Głównym powodem powstania tego ekranu jest czytelne renderowanie tabel GFM
 * (`| a | b |`), więc `remarkGfm` jest wymagany — bez niego `react-markdown` v10 nie
 * rozpoznaje składni tabel wcale. Mapowanie `components` nadaje tabelom i pozostałym
 * elementom style Tailwind zgodne z tokenami design systemu (zero kolorów hex).
 */
export type DocMarkdownProps = {
  content: string
}

/**
 * `react-markdown` v10 podaje każdemu zmapowanemu komponentowi węzeł AST w propsie
 * `node`. Jeśli go nie odrzucić, trafia na element DOM jako atrybut
 * `node="[object Object]"` — niepoprawny HTML i ostrzeżenie Reacta w konsoli na
 * KAŻDYM elemencie dokumentu. Testy statyczne tego nie widzą (sprawdzają treść
 * źródła, nie wynik renderowania), wyszło dopiero przy renderowaniu do HTML.
 */

export function DocMarkdown({ content }: DocMarkdownProps) {
  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="prose-none text-base leading-7 text-foreground">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ className, node, ...props }) => (
              <h1
                className="mb-4 mt-8 text-2xl font-bold tracking-tight text-foreground first:mt-0 sm:text-3xl"
                {...props}
              />
            ),
            h2: ({ className, node, ...props }) => (
              <h2
                className="mb-3 mt-8 border-b border-border pb-2 text-xl font-semibold text-foreground sm:text-2xl"
                {...props}
              />
            ),
            h3: ({ className, node, ...props }) => (
              <h3 className="mb-2 mt-6 text-lg font-semibold text-foreground" {...props} />
            ),
            h4: ({ className, node, ...props }) => (
              <h4
                className="mb-2 mt-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground"
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
            a: ({ className, node, ...props }) => (
              <a
                className="font-medium text-primary underline underline-offset-2 hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-md"
                {...props}
              />
            ),
            strong: ({ className, node, ...props }) => (
              <strong className="font-semibold text-foreground" {...props} />
            ),
            em: ({ className, node, ...props }) => <em className="italic" {...props} />,
            hr: ({ className, node, ...props }) => (
              <hr className="my-8 border-t border-border" {...props} />
            ),
            blockquote: ({ className, node, ...props }) => (
              <blockquote
                className="mb-4 rounded-md border-l-4 border-primary bg-secondary/50 py-2 pl-4 pr-3 text-muted-foreground"
                {...props}
              />
            ),
            // Blok kodu (```) jest już opakowany w ostylowany <pre> — nadanie mu tu
            // stylu kodu INLINE dałoby tło i padding wewnątrz tła i paddingu <pre>.
            // Fenced block poznajemy po klasie `language-*` (z językiem) albo po
            // znaku nowej linii w treści (fenced bez języka).
            code: ({ className, node, children, ...props }) => {
              const isBlock =
                (typeof className === "string" && className.startsWith("language-")) ||
                (typeof children === "string" && children.includes("\n"))
              return (
                <code
                  className={
                    isBlock
                      ? "font-mono text-sm text-foreground"
                      : "rounded-md bg-secondary px-1.5 py-0.5 font-mono text-sm text-foreground"
                  }
                  {...props}
                >
                  {children}
                </code>
              )
            },
            pre: ({ className, node, ...props }) => (
              <pre
                className="mb-4 overflow-x-auto rounded-md border border-border bg-secondary/50 p-4 font-mono text-sm text-foreground"
                {...props}
              />
            ),
            table: ({ className, node, ...props }) => (
              <div className="mb-4 w-full overflow-x-auto rounded-md border border-border">
                <table className="w-full border-collapse text-sm" {...props} />
              </div>
            ),
            thead: ({ className, node, ...props }) => (
              <thead className="bg-secondary/50" {...props} />
            ),
            tbody: ({ className, node, ...props }) => (
              <tbody className="divide-y divide-border" {...props} />
            ),
            tr: ({ className, node, ...props }) => (
              <tr className="even:bg-secondary/20 hover:bg-secondary/30 transition-colors" {...props} />
            ),
            th: ({ className, node, ...props }) => (
              <th
                className="border-b border-border p-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                {...props}
              />
            ),
            td: ({ className, node, ...props }) => (
              <td className="border-b border-border p-3 align-top text-foreground" {...props} />
            ),
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </article>
  )
}
