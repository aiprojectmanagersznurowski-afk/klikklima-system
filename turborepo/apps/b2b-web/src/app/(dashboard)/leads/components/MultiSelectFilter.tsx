"use client"

import React, { useState } from "react"
import { Check, ChevronDown, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface MultiSelectOption {
  id: string
  label: string
}

export function MultiSelectFilter({
  title,
  icon,
  options,
  selectedIds,
  onSelectionChange,
  unassignedLabel,
}: {
  title: string
  icon?: React.ReactNode
  options: MultiSelectOption[]
  selectedIds: string[]
  onSelectionChange: (selectedIds: string[]) => void
  unassignedLabel?: string
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")

  const allOptionIds = options.map((o) => o.id)
  if (unassignedLabel) {
    allOptionIds.push("__unassigned__")
  }

  const toggleOption = (id: string) => {
    if (selectedIds.includes(id)) {
      onSelectionChange(selectedIds.filter((item) => item !== id))
    } else {
      onSelectionChange([...selectedIds, id])
    }
  }

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation()
    onSelectionChange([])
  }

  const selectAll = () => {
    onSelectionChange(allOptionIds)
  }

  const filteredOptions = options.filter((o) =>
    o.label.toLowerCase().includes(search.toLowerCase())
  )

  const isFiltered = selectedIds.length > 0

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer outline-none shadow-2xs",
            isFiltered
              ? "bg-primary/10 border-primary/30 text-primary hover:bg-primary/15"
              : "bg-background border-border text-muted-foreground hover:text-foreground hover:bg-secondary/60"
          )}
        >
          {icon && <span className="shrink-0">{icon}</span>}
          <span>{title}</span>
          {isFiltered && (
            <span className="px-1.5 py-0.2 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {selectedIds.length}
            </span>
          )}
          {isFiltered ? (
            <span
              onClick={clearAll}
              className="p-0.5 rounded-full hover:bg-primary/20 text-primary cursor-pointer ml-0.5"
              title="Wyczyść filtr"
            >
              <X className="size-3" />
            </span>
          ) : (
            <ChevronDown className="size-3.5 opacity-60 ml-0.5" />
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="start" className="w-64 p-2 z-50 bg-card border border-border shadow-xl rounded-xl">
        <div className="flex items-center justify-between px-2 py-1.5 border-b border-border mb-1.5">
          <span className="text-xs font-semibold text-foreground">{title}</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer"
            >
              Wszystkie
            </button>
            <span className="text-muted-foreground/40">•</span>
            <button
              type="button"
              onClick={() => onSelectionChange([])}
              className="text-[11px] text-muted-foreground hover:text-destructive transition-colors cursor-pointer"
            >
              Wyczyść
            </button>
          </div>
        </div>

        {options.length > 5 && (
          <div className="px-1 mb-2">
            <input
              type="text"
              placeholder="Filtruj listę..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-2 py-1 text-xs border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
        )}

        <div className="max-h-56 overflow-y-auto space-y-0.5 pr-0.5">
          {unassignedLabel && (!search || unassignedLabel.toLowerCase().includes(search.toLowerCase())) && (
            <div
              onClick={() => toggleOption("__unassigned__")}
              className={cn(
                "flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer select-none transition-colors",
                selectedIds.includes("__unassigned__")
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted text-foreground"
              )}
            >
              <div
                className={cn(
                  "size-3.5 rounded border flex items-center justify-center transition-colors shrink-0",
                  selectedIds.includes("__unassigned__")
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/40 bg-background"
                )}
              >
                {selectedIds.includes("__unassigned__") && <Check className="size-2.5 stroke-[3]" />}
              </div>
              <span className="italic text-muted-foreground">{unassignedLabel}</span>
            </div>
          )}

          {filteredOptions.length === 0 && !unassignedLabel ? (
            <div className="py-3 text-center text-xs text-muted-foreground">Brak wyników.</div>
          ) : (
            filteredOptions.map((opt) => {
              const isSelected = selectedIds.includes(opt.id)
              return (
                <div
                  key={opt.id}
                  onClick={() => toggleOption(opt.id)}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer select-none transition-colors",
                    isSelected
                      ? "bg-primary/10 text-primary font-medium"
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  <div
                    className={cn(
                      "size-3.5 rounded border flex items-center justify-center transition-colors shrink-0",
                      isSelected
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-muted-foreground/40 bg-background"
                    )}
                  >
                    {isSelected && <Check className="size-2.5 stroke-[3]" />}
                  </div>
                  <span className="truncate" title={opt.label}>
                    {opt.label}
                  </span>
                </div>
              )
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
