import { redirect } from "next/navigation"
import { getCurrentActorRole } from "@/utils/supabase/server"
import { DateRangeFilter } from "@/components/analytics/date-range-filter"
import { ShieldAlert } from "lucide-react"

export default async function AnalyticsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const role = await getCurrentActorRole()
  
  if (role !== 'admin' && role !== 'dyspozytor') {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] text-center p-6">
        <ShieldAlert className="size-16 text-destructive mb-4 opacity-80" />
        <h2 className="text-2xl font-bold mb-2">Brak uprawnień</h2>
        <p className="text-muted-foreground mb-6 max-w-md">
          Moduł analityczny jest dostępny wyłącznie dla ról z poziomem dostępu "Admin" lub "Dyspozytor". 
          Jeśli uważasz, że powinieneś mieć dostęp, skontaktuj się z administratorem systemu.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-slate-50/50 dark:bg-background">
      {/* Pasek narzędzi analityki */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6 border-b bg-card">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analityka Systemu</h1>
          <p className="text-muted-foreground text-sm mt-1">Przegląd efektywności i kluczowych wskaźników wydajności</p>
        </div>
        
        {/* Globalny filtr zakresu dat */}
        <div className="shrink-0 bg-background rounded-md border p-1 shadow-2xs">
          <DateRangeFilter />
        </div>
      </div>
      
      {/* Treść konkretnego dashboardu */}
      <div className="flex-1 p-6 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
