"use client"

import { useState, useRef, useEffect } from 'react'
import { Bot, Send, User, Sparkles, AlertCircle, Copy, Check, BookOpen, Layers } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card } from '@/components/ui/card'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn } from '@/lib/utils'
import { MermaidDiagram } from '../dokumentacja/mermaid-diagram'
import { askAiAssistantAction } from './actions'

type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Array<{
    file: string
    header: string
    category: string
    similarity: number
  }>
}

const SUGGESTED_PROMPTS = [
  "Co zawiera montaż standardowy w KlikKlima?",
  "Jakie są koszyki usług i modele rozliczeniowe?",
  "Narysuj diagram etapów lejka sprzedażowego",
  "Jakie są progi SLA dla zgłoszeń usterkowych?"
]

function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy text: ', err)
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md hover:bg-muted/70 transition-colors text-muted-foreground hover:text-foreground cursor-pointer border border-border/40",
        className
      )}
      title="Kopiuj zawartość"
    >
      {copied ? (
        <>
          <Check className="size-3 text-emerald-500" />
          <span className="text-emerald-500 font-medium">Skopiowano</span>
        </>
      ) : (
        <>
          <Copy className="size-3" />
          <span>Kopiuj</span>
        </>
      )}
    </button>
  )
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'initial',
      role: 'assistant',
      content: 'Cześć! Jestem Twoim Asystentem AI w systemie KlikKlima. Posiadam bezpośredni dostęp do bazy wiedzy w PostgreSQL (`pgvector`), w tym kontraktów SLA, maszyny stanów lejka, modeli rozliczeniowych i definicji montażu standardowego. \n\nW czym mogę Ci pomóc?'
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return

    const userText = textToSend.trim()
    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: userText
    }

    const assistantId = `assistant-${Date.now()}`
    const emptyAssistantMessage: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: ''
    }

    const updatedHistory = [...messages, userMessage]
    setMessages([...updatedHistory, emptyAssistantMessage])
    setInput('')
    setIsLoading(true)
    setError(null)

    try {
      const result = await askAiAssistantAction(
        updatedHistory.map(m => ({
          role: m.role,
          content: m.content
        }))
      )

      if (!result.success) {
        setError(result.error || 'Wystąpił błąd podczas generowania odpowiedzi.')
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantId
              ? { ...msg, content: `⚠️ **Błąd:** ${result.error || 'Nie udało się wygenerować odpowiedzi.'}` }
              : msg
          )
        )
      } else {
        setMessages(prev =>
          prev.map(msg =>
            msg.id === assistantId ? { ...msg, content: result.content, sources: result.sources } : msg
          )
        )
      }
    } catch (err: any) {
      console.error('Chat error:', err)
      setError(err?.message || 'Wystąpił nieoczekiwany błąd podczas pobierania odpowiedzi.')
      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantId && msg.content === ''
            ? { ...msg, content: 'Przepraszam, wystąpił problem podczas komunikacji z modelem AI. Upewnij się, że klucz GOOGLE_GENERATIVE_AI_API_KEY jest poprawny.' }
            : msg
        )
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] p-4 md:p-6 bg-secondary/15">
      {/* Nagłówek czatu */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center size-10 rounded-xl bg-gradient-to-tr from-primary to-primary/80 shadow-sm text-primary-foreground">
            <Sparkles className="size-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">Asystent AI</h1>
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                Gemini 3.6 Flash
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                pgvector RAG
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Inteligentny asystent bazy wiedzy, procedur montażowych i kontraktów KlikKlima.
            </p>
          </div>
        </div>
      </div>

      {/* Główny obszar wiadomości */}
      <Card className="flex flex-col flex-1 overflow-hidden border border-border/60 shadow-xs bg-background">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {messages.map(m => (
            <div
              key={m.id}
              className={cn(
                "flex gap-3.5 max-w-[92%] md:max-w-[85%]",
                m.role === 'user' ? "ml-auto flex-row-reverse" : ""
              )}
            >
              {/* Awatar */}
              <div
                className={cn(
                  "flex items-center justify-center size-8 rounded-full shrink-0 shadow-xs ring-2",
                  m.role === 'user'
                    ? "bg-primary text-primary-foreground ring-primary/20"
                    : "bg-gradient-to-br from-primary/90 to-primary text-primary-foreground ring-primary/20"
                )}
              >
                {m.role === 'user' ? <User className="size-4" /> : <Bot className="size-4" />}
              </div>

              {/* Dymek wiadomości */}
              <div
                className={cn(
                  "relative rounded-2xl shadow-xs overflow-hidden transition-all",
                  m.role === 'user'
                    ? "px-4 py-3 bg-primary text-primary-foreground rounded-tr-xs text-sm"
                    : "px-5 py-4 bg-card text-card-foreground rounded-tl-xs border border-border/60 group"
                )}
              >
                {m.role === 'user' ? (
                  <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                ) : (
                  <div>
                    {/* Belka narzędziowa odpowiedzi asystenta */}
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-border/40 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1.5 font-medium text-foreground/80 text-[11px]">
                        <Bot className="size-3.5 text-primary" />
                        <span>KlikKlima AI</span>
                      </span>
                      {m.content && <CopyButton text={m.content} />}
                    </div>

                    {/* Treść Markdown z dedykowanymi komponentami estetycznymi */}
                    <div className="text-sm">
                      <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                          h1: ({ children }) => (
                            <h1 className="text-base md:text-lg font-bold text-foreground mt-4 mb-2 pb-1 border-b border-border/50 flex items-center gap-2">
                              {children}
                            </h1>
                          ),
                          h2: ({ children }) => (
                            <h2 className="text-sm md:text-base font-semibold text-foreground mt-3.5 mb-1.5 flex items-center gap-1.5">
                              <span className="inline-block w-1.5 h-3.5 rounded-full bg-primary" />
                              {children}
                            </h2>
                          ),
                          h3: ({ children }) => (
                            <h3 className="text-sm font-semibold text-foreground/95 mt-3 mb-1">
                              {children}
                            </h3>
                          ),
                          p: ({ children }) => (
                            <p className="leading-relaxed text-sm my-2 text-foreground/90">
                              {children}
                            </p>
                          ),
                          ul: ({ children }) => (
                            <ul className="list-disc pl-5 space-y-1.5 my-2.5 text-sm text-foreground/90">
                              {children}
                            </ul>
                          ),
                          ol: ({ children }) => (
                            <ol className="list-decimal pl-5 space-y-1.5 my-2.5 text-sm text-foreground/90">
                              {children}
                            </ol>
                          ),
                          li: ({ children }) => (
                            <li className="leading-relaxed pl-1">{children}</li>
                          ),
                          blockquote: ({ children }) => (
                            <blockquote className="border-l-3 border-primary/70 bg-primary/5 pl-3.5 py-2 my-2.5 rounded-r-lg text-sm italic text-foreground/80">
                              {children}
                            </blockquote>
                          ),
                          table: ({ children }) => (
                            <div className="overflow-x-auto my-3.5 rounded-xl border border-border/60 shadow-2xs bg-card">
                              <table className="w-full text-left text-xs border-collapse">
                                {children}
                              </table>
                            </div>
                          ),
                          thead: ({ children }) => (
                            <thead className="bg-muted/70 text-muted-foreground uppercase text-[10px] font-semibold tracking-wider border-b border-border/60">
                              {children}
                            </thead>
                          ),
                          tbody: ({ children }) => (
                            <tbody className="divide-y divide-border/30">
                              {children}
                            </tbody>
                          ),
                          tr: ({ children }) => (
                            <tr className="hover:bg-muted/20 transition-colors">
                              {children}
                            </tr>
                          ),
                          th: ({ children }) => (
                            <th className="px-3 py-2 font-semibold text-foreground">
                              {children}
                            </th>
                          ),
                          td: ({ children }) => (
                            <td className="px-3 py-2 text-foreground/90 leading-relaxed">
                              {children}
                            </td>
                          ),
                          hr: () => <hr className="my-3.5 border-border/40" />,
                          strong: ({ children }) => (
                            <strong className="font-semibold text-foreground">
                              {children}
                            </strong>
                          ),
                          code: ({ className, children, ...props }) => {
                            const raw = String(children || '').trim()
                            const isMermaid =
                              (typeof className === 'string' &&
                                (className.includes('mermaid') || className === 'language-mermaid')) ||
                              raw.startsWith('flowchart ') ||
                              raw.startsWith('sequenceDiagram') ||
                              raw.startsWith('stateDiagram') ||
                              raw.startsWith('erDiagram') ||
                              raw.startsWith('classDiagram')

                            if (isMermaid) {
                              return (
                                <div className="my-3.5 rounded-xl border border-border/60 bg-muted/20 p-3 shadow-2xs overflow-hidden">
                                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-2 pb-1.5 border-b border-border/40">
                                    <Sparkles className="size-3.5 text-primary" />
                                    <span>Diagram procesowy</span>
                                  </div>
                                  <MermaidDiagram chart={raw} />
                                </div>
                              )
                            }

                            if (raw.includes('\n')) {
                              return (
                                <div className="my-3 rounded-xl border border-border/60 bg-secondary/40 overflow-hidden text-xs">
                                  <div className="flex items-center justify-between px-3 py-1.5 bg-muted/40 border-b border-border/40 text-[11px] font-mono text-muted-foreground">
                                    <span>kod źródłowy</span>
                                    <CopyButton text={raw} />
                                  </div>
                                  <pre className="p-3 overflow-x-auto font-mono text-[12px] leading-relaxed text-foreground">
                                    <code>{raw}</code>
                                  </pre>
                                </div>
                              )
                            }

                            return (
                              <code className="px-1.5 py-0.5 rounded-md bg-secondary text-primary font-mono text-[12px] border border-border/40 font-medium">
                                {children}
                              </code>
                            )
                          }
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    </div>

                    {/* Sekcja źródeł RAG */}
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-border/40 text-xs text-muted-foreground space-y-2">
                        <div className="font-semibold flex items-center gap-1.5 text-foreground/80 text-[11px]">
                          <BookOpen className="size-3.5 text-primary" />
                          <span>Wykorzystane źródła z bazy wiedzy (pgvector):</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {m.sources.map((s, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-secondary/80 hover:bg-secondary text-secondary-foreground border border-border/50 text-[11px] transition-colors"
                              title={`Sekcja: ${s.header}`}
                            >
                              <span className="font-medium">{s.file}</span>
                              <span className="text-[10px] px-1 rounded-sm bg-primary/10 text-primary font-semibold">
                                {Math.round(s.similarity * 100)}%
                              </span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Animacja oczekiwania */}
          {isLoading && messages[messages.length - 1]?.content === '' && (
            <div className="flex gap-3.5 max-w-[85%]">
              <div className="flex items-center justify-center size-8 rounded-full shrink-0 shadow-xs bg-gradient-to-br from-primary/90 to-primary text-primary-foreground ring-2 ring-primary/20">
                <Bot className="size-4 animate-spin" />
              </div>
              <div className="px-5 py-4 rounded-2xl rounded-tl-xs shadow-xs text-sm bg-card text-muted-foreground border border-border/60 flex items-center gap-2.5">
                <Sparkles className="size-4 animate-pulse text-primary" />
                <span className="text-foreground/90 font-medium text-xs">Przeszukuję bazę wektorową i generuję odpowiedź...</span>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2.5 text-destructive bg-destructive/10 p-3.5 rounded-xl text-xs max-w-xl border border-destructive/20">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Dolna belka z sugestiami i polem wprowadzania */}
        <div className="p-4 bg-card border-t border-border/50 space-y-3">
          {/* Sugerowane pytania (widoczne szczególnie na początku) */}
          {messages.length <= 2 && !isLoading && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar text-xs">
              <span className="text-muted-foreground shrink-0 text-[11px] font-medium flex items-center gap-1">
                <Layers className="size-3" />
                Sugerowane:
              </span>
              {SUGGESTED_PROMPTS.map((prompt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => sendMessage(prompt)}
                  className="whitespace-nowrap px-3 py-1 rounded-full border border-border/60 bg-background hover:bg-secondary hover:border-primary/40 text-muted-foreground hover:text-foreground transition-all text-xs cursor-pointer shadow-2xs"
                >
                  {prompt}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2.5 max-w-4xl mx-auto">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Zadaj pytanie dotyczące procedur, cennika, SLA lub poproś o diagram..."
              className="flex-1 shadow-2xs rounded-xl h-11 bg-background"
              disabled={isLoading}
            />
            <Button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="h-11 px-5 rounded-xl shadow-xs gap-2 shrink-0 cursor-pointer font-medium"
            >
              <Send className="size-4" />
              <span className="hidden sm:inline">Wyślij</span>
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}
