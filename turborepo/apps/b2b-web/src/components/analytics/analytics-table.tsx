"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { X, Filter } from "lucide-react"
import { formatAnyStatus } from "@/lib/format-status"

interface Column<T> {
  header: string
  accessor: (item: T) => React.ReactNode
}

interface AnalyticsTableProps<T> {
  data: T[]
  columns: Column<T>[]
  filterKey?: string | null
  filterValue?: string | null
  onClearFilter?: () => void
  emptyMessage?: string
}

export function AnalyticsTable<T>({ 
  data, 
  columns, 
  filterKey, 
  filterValue, 
  onClearFilter,
  emptyMessage = "Brak danych dla wybranego zakresu"
}: AnalyticsTableProps<T>) {
  
  return (
    <div className="space-y-4">
      {filterKey && filterValue && onClearFilter && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-primary font-medium">
            <Filter className="size-4" />
            <span>Filtrowanie: {formatAnyStatus(filterValue)}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={onClearFilter} className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground">
            <X className="size-3 mr-1" /> Wyczyść filtr
          </Button>
        </div>
      )}
      
      <div className="border rounded-md bg-card overflow-hidden">
        <Table>
          <TableHeader className="bg-secondary/50 border-b border-border">
            <TableRow>
              {columns.map((col, i) => (
                <TableHead key={i} className="text-xs uppercase font-semibold text-muted-foreground tracking-wider">{col.header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((item, i) => (
                <TableRow key={i}>
                  {columns.map((col, j) => (
                    <TableCell key={j}>{col.accessor(item)}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
