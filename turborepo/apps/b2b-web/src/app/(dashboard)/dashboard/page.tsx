import { AlertTriangle, ClipboardList, Hammer, Wrench, Inbox } from "lucide-react"
import { getLeadStageCounts, getDelayedNewLeadsCount } from "../leads/actions"
import { getInstallations } from "../installations/actions"
import { getUpcomingServices } from "../services/actions"
import { formatDate } from "@/lib/format-date"

export const revalidate = 30

/**
 * KPI-DASHBOARD (audyt UI, 2026-09-03): pierwsza wersja panelu startowego. Ograniczony,
 * celowo prosty zestaw kart — dane pochodzą wyłącznie z ISTNIEJĄCYCH funkcji odczytowych
 * (getLeadStageCounts/getDelayedNewLeadsCount w leads/actions.ts, getInstallations,
 * getUpcomingServices), każda z nich sama sprawdza `can()` i zawęża wynik do zakresu roli
 * (`monter:own`/`audytor:own`) — dashboard nie dubluje tej logiki, tylko konsumuje wynik.
 * Konwersja (lead -> montaż) świadomie pominięta: wymaga decyzji człowieka co do
 * mianownika i okna czasowego, nie jest tu zgadywana.
 */
export default async function DashboardPage() {
  const [stageCounts, delayedLeadsCount, installations, services] = await Promise.all([
    getLeadStageCounts(),
    getDelayedNewLeadsCount(),
    getInstallations(),
    getUpcomingServices(),
  ])

  const newLeadsCount = stageCounts["NEW_LEAD"] ?? 0
  const activeInFunnelCount = stageCounts["ALL"] ?? 0

  const upcomingInstallations = installations
    .filter((i) => i.status === "PLANNED" || i.status === "IN_PROGRESS")
    .slice(0, 5)

  const upcomingServices = services
    .filter((s) => s.status !== "COMPLETED" && s.status !== "CANCELLED")
    .slice(0, 5)

  return (
    <div className="h-full flex flex-col max-w-[1800px] mx-auto animate-in fade-in duration-300">
      <div className="flex justify-between items-center bg-card p-6 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">Skrót stanu lejka sprzedaży, instalacji i serwisów.</p>
        </div>
      </div>

      <div className="flex flex-col flex-1 p-6 gap-6 bg-background">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Nowe leady</span>
              <Inbox className="size-5 text-primary" />
            </div>
            <p className="text-3xl font-bold tracking-tight text-foreground mt-3">{newLeadsCount}</p>
            <span className="text-xs text-muted-foreground mt-1">Etap 1 lejka</span>
          </div>

          <div
            className={
              delayedLeadsCount > 0
                ? "bg-destructive/5 border-l-4 border-destructive border-y border-r rounded-2xl p-5 shadow-xs flex flex-col justify-between"
                : "bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col justify-between"
            }
          >
            <div className="flex items-center justify-between">
              <span className={delayedLeadsCount > 0 ? "text-sm font-semibold text-destructive" : "text-sm font-medium text-muted-foreground"}>
                Opóźnione leady (&gt;24h)
              </span>
              <AlertTriangle className={delayedLeadsCount > 0 ? "size-5 text-destructive" : "size-5 text-muted-foreground"} />
            </div>
            <p className={delayedLeadsCount > 0 ? "text-3xl font-bold tracking-tight text-destructive mt-3" : "text-3xl font-bold tracking-tight text-foreground mt-3"}>
              {delayedLeadsCount}
            </p>
            <span className={delayedLeadsCount > 0 ? "text-xs text-destructive/80 font-medium mt-1" : "text-xs text-muted-foreground mt-1"}>
              Nowy lead bez reakcji ponad dobę
            </span>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Aktywne w lejku</span>
              <ClipboardList className="size-5 text-primary" />
            </div>
            <p className="text-3xl font-bold tracking-tight text-foreground mt-3">{activeInFunnelCount}</p>
            <span className="text-xs text-muted-foreground mt-1">Wszystkie etapy i buckety</span>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Nadchodzące instalacje</span>
              <Hammer className="size-5 text-accent" />
            </div>
            <p className="text-3xl font-bold tracking-tight text-foreground mt-3">{upcomingInstallations.length}</p>
            <span className="text-xs text-muted-foreground mt-1">Zaplanowane / w trakcie</span>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Nadchodzące serwisy</span>
              <Wrench className="size-5 text-accent" />
            </div>
            <p className="text-3xl font-bold tracking-tight text-foreground mt-3">{upcomingServices.length}</p>
            <span className="text-xs text-muted-foreground mt-1">Nierozliczone / prognozowane</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
            <h2 className="text-base font-semibold text-foreground mb-3">Najbliższe instalacje</h2>
            {upcomingInstallations.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak zaplanowanych instalacji.</p>
            ) : (
              <ul className="divide-y divide-border">
                {upcomingInstallations.map((inst) => (
                  <li key={inst.id} className="py-2 flex items-center justify-between text-sm">
                    <span className="text-foreground">{inst.clientName}</span>
                    <span className="text-muted-foreground text-xs">
                      {inst.plannedDate ? formatDate(inst.plannedDate, "dd MMM yyyy") : "Brak daty"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 shadow-xs">
            <h2 className="text-base font-semibold text-foreground mb-3">Najbliższe serwisy</h2>
            {upcomingServices.length === 0 ? (
              <p className="text-sm text-muted-foreground">Brak nadchodzących serwisów.</p>
            ) : (
              <ul className="divide-y divide-border">
                {upcomingServices.map((svc) => (
                  <li
                    key={svc.service_id ?? svc.installation_id ?? svc.next_service_date.toISOString()}
                    className="py-2 flex items-center justify-between text-sm"
                  >
                    <span className="text-foreground">{svc.customer_name}</span>
                    <span className="text-muted-foreground text-xs">
                      {svc.date_undetermined ? "Termin niewyznaczony" : formatDate(svc.next_service_date, "dd MMM yyyy")}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
