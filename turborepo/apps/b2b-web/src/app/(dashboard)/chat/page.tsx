"use client"

import { useState, useRef, useEffect } from 'react'
import { Bot, Send, User, Sparkles, AlertCircle } from 'lucide-react'
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
}

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'initial',
      role: 'assistant',
      content: 'Cześć! Jestem Twoim Asystentem AI w systemie KlikKlima. Mam dostęp do repozytorium (m.in. kontraktów, procedur i definicji montażu). W czym mogę Ci pomóc?'
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userText = input.trim()
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

      setMessages(prev =>
        prev.map(msg =>
          msg.id === assistantId ? { ...msg, content: result.content } : msg
        )
      )
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

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] p-6 bg-secondary/20">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex items-center justify-center size-10 rounded-xl bg-primary shadow-sm text-primary-foreground">
          <Sparkles className="size-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Asystent AI (BETA)</h1>
          <p className="text-sm text-muted-foreground">
            Oparty na Gemini 1.5 Pro. Odpowiada w oparciu o repozytorium i potrafi rysować diagramy procesowe.
          </p>
        </div>
      </div>

      <Card className="flex flex-col flex-1 overflow-hidden border-border/50 shadow-sm bg-background">
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6">
          {messages.map(m => (
            <div
              key={m.id}
              className={cn(
                "flex gap-4 max-w-[85%]",
                m.role === 'user' ? "ml-auto flex-row-reverse" : ""
              )}
            >
              <div
                className={cn(
                  "flex items-center justify-center size-8 rounded-full shrink-0 shadow-sm",
                  m.role === 'user' ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground"
                )}
              >
                {m.role === 'user' ? <User className="size-4" /> : <Bot className="size-4" />}
              </div>
              <div
                className={cn(
                  "px-4 py-3 rounded-2xl shadow-sm text-sm overflow-hidden",
                  m.role === 'user'
                    ? "bg-primary text-primary-foreground rounded-tr-none"
                    : "bg-muted text-foreground rounded-tl-none border border-border/50"
                )}
              >
                {m.role === 'user' ? (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown
                      remarkPlugins={[remarkGfm]}
                      components={{
                        pre: ({ children }) => <>{children}</>,
                        code: ({ className, children, ...props }) => {
                          const raw = String(children || '')
                          const isMermaid =
                            (typeof className === 'string' &&
                              (className.includes('mermaid') || className === 'language-mermaid')) ||
                            raw.trim().startsWith('flowchart ') ||
                            raw.trim().startsWith('sequenceDiagram') ||
                            raw.trim().startsWith('stateDiagram') ||
                            raw.trim().startsWith('erDiagram') ||
                            raw.trim().startsWith('classDiagram')

                          if (isMermaid) {
                            return <MermaidDiagram chart={raw} />
                          }

                          return (
                            <code className={className} {...props}>
                              {children}
                            </code>
                          )
                        }
                      }}
                    >
                      {m.content}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.content === '' && (
            <div className="flex gap-4 max-w-[85%]">
              <div className="flex items-center justify-center size-8 rounded-full shrink-0 shadow-sm bg-secondary text-secondary-foreground">
                <Bot className="size-4" />
              </div>
              <div className="px-4 py-3 rounded-2xl shadow-sm text-sm bg-muted text-muted-foreground rounded-tl-none border border-border/50 flex items-center gap-2">
                <Sparkles className="size-4 animate-pulse text-primary" /> Analizuję dokumentację KlikKlima...
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-destructive bg-destructive/10 p-3 rounded-lg text-sm max-w-xl">
              <AlertCircle className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="p-4 bg-background border-t border-border/50">
          <form onSubmit={handleSubmit} className="flex gap-3 max-w-4xl mx-auto">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Zadaj pytanie dotyczące procedur, lejka lub narysuj diagram..."
              className="flex-1 shadow-sm"
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading || !input.trim()} className="shrink-0 shadow-sm gap-2">
              <Send className="size-4" />
              <span className="hidden sm:inline">Wyślij</span>
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}
