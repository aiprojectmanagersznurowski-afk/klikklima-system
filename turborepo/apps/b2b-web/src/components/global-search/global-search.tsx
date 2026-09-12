"use client"

import React, { useState, useEffect, useRef, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  Search,
  User,
  FileText,
  AlertTriangle,
  Wrench,
  X,
  CornerDownLeft,
  Loader2,
  Command,
} from "lucide-react"
import { globalSearchAction, type GlobalSearchResult, type SearchResultItem } from "./actions"

export function GlobalSearch() {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<GlobalSearchResult>({
    clients: [],
    leads: [],
    incidents: [],
    installations: [],
    totalCount: 0,
  })
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [isPending, startTransition] = useTransition()
  const inputRef = useRef<HTMLInputElement>(null)

  // Skrót klawiszowy Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setIsOpen((prev) => !prev)
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen])

  // Auto-focus po otwarciu
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    } else {
      setQuery("")
      setResults({ clients: [], leads: [], incidents: [], installations: [], totalCount: 0 })
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Debounced search
  useEffect(() => {
    if (!isOpen || query.trim().length < 2) {
      setResults({ clients: [], leads: [], incidents: [], installations: [], totalCount: 0 })
      return
    }

    const timer = setTimeout(() => {
      startTransition(async () => {
        try {
          const data = await globalSearchAction(query)
          setResults(data)
          setSelectedIndex(0)
        } catch (err) {
          console.error("Global search error:", err)
        }
      })
    }, 200)

    return () => clearTimeout(timer)
  }, [query, isOpen])

  // Płaska lista wyników do nawigacji klawiaturą
  const allItems: (SearchResultItem & { type: string })[] = [
    ...results.clients.map((i) => ({ ...i, type: "client" })),
    ...results.leads.map((i) => ({ ...i, type: "lead" })),
    ...results.incidents.map((i) => ({ ...i, type: "incident" })),
    ...results.installations.map((i) => ({ ...i, type: "installation" })),
  ]

  const handleSelect = (item: SearchResultItem) => {
    setIsOpen(false)
    router.push(item.href)
  }

  const handleKeyDownList = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setSelectedIndex((prev) => (allItems.length > 0 ? (prev + 1) % allItems.length : 0))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setSelectedIndex((prev) => (allItems.length > 0 ? (prev - 1 + allItems.length) % allItems.length : 0))
    } else if (e.key === "Enter" && allItems[selectedIndex]) {
      e.preventDefault()
      handleSelect(allItems[selectedIndex])
    }
  }

  return (
    <>
      {/* Search trigger button in top header */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-between w-full max-w-md px-3.5 py-1.5 text-xs text-muted-foreground bg-secondary/60 hover:bg-secondary border border-border/80 rounded-xl transition-all shadow-2xs group cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <Search className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors" />
          <span className="truncate">Szukaj klienta, projektu (L-...), telefonu...</span>
        </div>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-2xs font-mono font-semibold bg-background border border-border rounded-md text-muted-foreground shadow-2xs">
          <Command className="size-2.5" /> K
        </kbd>
      </button>

      {/* Modal / Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-2xl bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
            onKeyDown={handleKeyDownList}
          >
            {/* Input Bar */}
            <div className="flex items-center px-4 py-3.5 border-b border-border gap-3 bg-card">
              <Search className="size-5 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Wpisz nazwisko, numer telefonu, projekt L-... lub numer usterki..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              {isPending && <Loader2 className="size-4 animate-spin text-muted-foreground shrink-0" />}
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* Results Area */}
            <div className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-border/40">
              {query.trim().length < 2 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  <p>Wpisz co najmniej 2 znaki, aby przeszukać bazę KlikKlima.</p>
                  <div className="flex justify-center gap-3 mt-4 text-2xs text-muted-foreground/80">
                    <span className="px-2 py-1 rounded bg-secondary/50 border border-border">Klienci</span>
                    <span className="px-2 py-1 rounded bg-secondary/50 border border-border">Projekty L-...</span>
                    <span className="px-2 py-1 rounded bg-secondary/50 border border-border">Usterki INC-...</span>
                    <span className="px-2 py-1 rounded bg-secondary/50 border border-border">Instalacje</span>
                  </div>
                </div>
              ) : allItems.length === 0 && !isPending ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  Brak wyników dla zapytania: <span className="font-semibold text-foreground font-mono">{query}</span>
                </div>
              ) : (
                <>
                  {/* Sekcja Klienci */}
                  {results.clients.length > 0 && (
                    <div className="py-2">
                      <div className="px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <User className="size-3 text-primary" /> Klienci ({results.clients.length})
                      </div>
                      <div className="space-y-1 mt-1">
                        {results.clients.map((item) => {
                          const itemIndex = allItems.findIndex((i) => i.id === item.id)
                          const isSelected = selectedIndex === itemIndex
                          return (
                            <div
                              key={item.id}
                              onClick={() => handleSelect(item)}
                              onMouseEnter={() => setSelectedIndex(itemIndex)}
                              className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                                isSelected ? "bg-primary/10 text-primary" : "hover:bg-secondary/60 text-foreground"
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold truncate">{item.title}</p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">{item.subtitle}</p>
                              </div>
                              <span className="px-2 py-0.5 text-2xs font-medium rounded-md bg-secondary border border-border text-foreground shrink-0 ml-2">
                                {item.badge}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sekcja Projekty / Leady */}
                  {results.leads.length > 0 && (
                    <div className="py-2">
                      <div className="px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <FileText className="size-3 text-primary" /> Projekty / Leady ({results.leads.length})
                      </div>
                      <div className="space-y-1 mt-1">
                        {results.leads.map((item) => {
                          const itemIndex = allItems.findIndex((i) => i.id === item.id)
                          const isSelected = selectedIndex === itemIndex
                          return (
                            <div
                              key={item.id}
                              onClick={() => handleSelect(item)}
                              onMouseEnter={() => setSelectedIndex(itemIndex)}
                              className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                                isSelected ? "bg-primary/10 text-primary" : "hover:bg-secondary/60 text-foreground"
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold font-mono truncate">{item.title}</p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">{item.subtitle}</p>
                              </div>
                              <span className="px-2 py-0.5 text-2xs font-medium rounded-md bg-secondary/80 border border-border text-foreground shrink-0 ml-2">
                                {item.badge}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sekcja Usterki */}
                  {results.incidents.length > 0 && (
                    <div className="py-2">
                      <div className="px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <AlertTriangle className="size-3 text-destructive" /> Zgłoszenia i Usterki ({results.incidents.length})
                      </div>
                      <div className="space-y-1 mt-1">
                        {results.incidents.map((item) => {
                          const itemIndex = allItems.findIndex((i) => i.id === item.id)
                          const isSelected = selectedIndex === itemIndex
                          return (
                            <div
                              key={item.id}
                              onClick={() => handleSelect(item)}
                              onMouseEnter={() => setSelectedIndex(itemIndex)}
                              className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                                isSelected ? "bg-primary/10 text-primary" : "hover:bg-secondary/60 text-foreground"
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold font-mono truncate">{item.title}</p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">{item.subtitle}</p>
                              </div>
                              <span
                                className={`px-2 py-0.5 text-2xs font-medium rounded-md border shrink-0 ml-2 ${
                                  item.badgeVariant === "destructive"
                                    ? "bg-destructive/15 text-destructive border-destructive/30 font-bold"
                                    : "bg-secondary text-foreground border-border"
                                }`}
                              >
                                {item.badge}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sekcja Instalacje */}
                  {results.installations.length > 0 && (
                    <div className="py-2">
                      <div className="px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Wrench className="size-3 text-primary" /> Montaże i Instalacje ({results.installations.length})
                      </div>
                      <div className="space-y-1 mt-1">
                        {results.installations.map((item) => {
                          const itemIndex = allItems.findIndex((i) => i.id === item.id)
                          const isSelected = selectedIndex === itemIndex
                          return (
                            <div
                              key={item.id}
                              onClick={() => handleSelect(item)}
                              onMouseEnter={() => setSelectedIndex(itemIndex)}
                              className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                                isSelected ? "bg-primary/10 text-primary" : "hover:bg-secondary/60 text-foreground"
                              }`}
                            >
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold truncate">{item.title}</p>
                                <p className="text-xs text-muted-foreground truncate mt-0.5">{item.subtitle}</p>
                              </div>
                              <span className="px-2 py-0.5 text-2xs font-medium rounded-md bg-secondary border border-border text-foreground shrink-0 ml-2">
                                {item.badge}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer hints */}
            <div className="p-3 border-t border-border bg-secondary/20 flex items-center justify-between text-2xs text-muted-foreground">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-background border border-border">↑</kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-background border border-border">↓</kbd>
                  Nawigacja
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-background border border-border flex items-center gap-0.5">
                    <CornerDownLeft className="size-2.5" />
                  </kbd>
                  Wybierz
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-background border border-border">Esc</kbd>
                  Zamknij
                </span>
              </div>
              <span>{results.totalCount > 0 ? `Znaleziono: ${results.totalCount}` : ""}</span>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
