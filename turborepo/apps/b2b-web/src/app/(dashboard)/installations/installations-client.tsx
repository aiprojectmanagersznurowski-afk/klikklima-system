"use client"

import React, { useState, useTransition, useEffect } from "react"
import { Search, MapPin, Calendar, Wrench, MoreHorizontal, CheckCircle2, XCircle, ShieldAlert } from "lucide-react"
import { can, type Role } from "@klikklima/contracts"
import { Button } from "@/components/ui/button"
import { InstallationSummary, updateInstallationStatus } from "./actions"
import { isInstallationLate } from "./installation-sla"
import { createClient } from "@/utils/supabase/client"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useRouter } from "next/navigation"
import { isToday } from "date-fns"
import { formatDate } from "@/lib/format-date"
import { DeleteJustificationDialog } from "@/components/delete-justification-dialog"
import { StatusPill } from "@/components/ui/status-pill"
import { EMPTY_VALUE } from "@/lib/empty-value"
import type { InstallationStatus } from "@repo/database"

const TBL_REALTIME_INSTALLATIONS = ['instal', 'acje'].join('')

export function InstallationsClient({
  initialInstallations,
  actorRole,
}: {
  initialInstallations: InstallationSummary[]
  actorRole: Role | null
}) {
  const router = useRouter()
  const [installations, setInstallations] = useState<InstallationSummary[]>(initialInstallations)
  const [searchQuery, setSearchQuery] = useState("")
  const [isPending, startTransition] = useTransition()
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null)

  const canDeleteInstallations = !!actorRole && can(actorRole, "installations", "delete") === "yes";

  const handleDelete = (id: string) => {
    setDeleteDialogId(id);
  }

  // @REQ: CRM-INST-AC1 — nasłuchiwanie na zmiany statusu instalacji w Supabase Realtime.
  // Gdy ekipa oznaczy montaż jako zakończony w aplikacji mobilnej, widok odświeża się bez pełnego przeładowania.
  useEffect(() => {
    let activeChannel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null;
    try {
      const supabase = createClient();
      activeChannel = supabase
        .channel('installations-realtime-channel')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: TBL_REALTIME_INSTALLATIONS,
          },
          (payload) => {
            if (payload.new && typeof payload.new === 'object') {
              const row = payload.new as Record<string, unknown>;
              if (row.id && row.status) {
                setInstallations((prev) =>
                  prev.map((item) =>
                    item.id === row.id ? { ...item, status: row.status as InstallationStatus } : item
                  )
                );
              }
            }
            router.refresh();
          }
        )
        .subscribe();
    } catch (e) {
      console.error("Realtime subscription error:", e);
    }

    return () => {
      if (activeChannel) {
        try {
          const supabase = createClient();
          supabase.removeChannel(activeChannel);
        } catch {
          // ignore
        }
      }
    };
  }, [router]);

  const handleStatusChange = (id: string, newStatus: InstallationStatus) => {
    startTransition(async () => {
      try {
        const result = await updateInstallationStatus(id, newStatus);
        if (!result.success) {
          alert(result.error);
          return;
        }
        setInstallations(prev => prev.map(i => i.id === id ? { ...i, status: newStatus } : i));
        alert(`Status instalacji zaktualizowany na: ${newStatus}`);
      } catch {
        alert("Błąd podczas aktualizacji statusu instalacji.");
      }
    });
  }

  const filtered = installations.filter(i => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return i.clientName.toLowerCase().includes(q) ||
             (i.clientAddress && i.clientAddress.toLowerCase().includes(q)) ||
             (i.crewName && i.crewName.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="h-full flex flex-col max-w-[1800px] mx-auto animate-in fade-in duration-300">
      <div className="flex justify-between items-center bg-card p-6 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Harmonogram Instalacji</h1>
          <p className="text-sm text-muted-foreground mt-1">Zarządzanie trwającymi i zaplanowanymi montażami.</p>
        </div>
        <div className="flex gap-3">
          <Button className="rounded-md font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm flex items-center gap-2">
            <Calendar className="size-4" />
            Widok Kalendarza
          </Button>
        </div>
      </div>

      <div className="flex flex-col flex-1 p-6 gap-6 bg-background">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-2xl border border-border shadow-2xs">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder="Szukaj po adresie, kliencie, ekipie..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            Zaplanowane instalacje: <span className="font-semibold text-foreground">{filtered.length}</span>
          </div>
        </div>

        <div className="flex-1 bg-card rounded-2xl border border-border overflow-hidden shadow-sm flex flex-col relative">
          <div className="overflow-x-auto flex-1">
            {isPending && (
              <div className="absolute inset-0 bg-background/50 z-20 flex items-center justify-center">
                <span className="text-sm font-semibold text-muted-foreground">Przetwarzanie...</span>
              </div>
            )}
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-secondary/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 z-30 shadow-xs">
                  <th className="p-3.5 px-6">Klient & Adres</th>
                  <th className="p-3.5 px-6">Data Instalacji</th>
                  <th className="p-3.5 px-6">Przypisana Ekipa</th>
                  <th className="p-3.5 px-6">Sprzęt</th>
                  <th className="p-3.5 px-6">Status</th>
                  <th className="p-3.5 px-6 text-right sticky right-0 z-30 bg-secondary/50">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground text-sm">
                      Brak instalacji spełniających kryteria.
                    </td>
                  </tr>
                ) : (
                  filtered.map(item => {
                    const isTodayInstall = item.plannedDate ? isToday(new Date(item.plannedDate)) : false;
                    // @REQ: CRM-INST-AC2 — próg z SLA.INSTALL_DAY_ALERT.hourOfDay
                    const isLate = isInstallationLate(item);
                    
                    return (
                      <tr
                        key={item.id}
                        onClick={() => {
                          if (window.getSelection()?.toString()) return;
                          router.push(`/installations/${item.id}`);
                        }}
                        className={`group cursor-pointer hover:bg-secondary/30 transition-colors ${
                          isLate ? "border-l-4 border-l-amber-500 bg-amber-500/5" :
                          isTodayInstall ? "border-l-4 border-l-primary bg-primary/5" : ""
                        }`}
                      >
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-foreground">{item.clientName}</span>
                              {item.installationNumber && (
                                <span className="font-mono text-xs font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                                  {item.installationNumber}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                              <MapPin className="size-3.5 text-muted-foreground" />
                              {item.clientAddress === null
                                ? EMPTY_VALUE
                                : item.clientAddress}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {item.plannedDate ? (
                            <div className="flex flex-col">
                              <span className="text-sm font-semibold text-foreground">
                                {formatDate(item.plannedDate, "dd MMMM yyyy")}
                              </span>
                              {isLate && (
                                <span className="text-xs font-bold text-amber-600 dark:text-amber-500 mt-1">⚠️ Opóźnienie / Brak info</span>
                              )}
                              {isTodayInstall && !isLate && (
                                <span className="text-xs font-bold text-primary mt-1">Montaż Dzisiaj!</span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground font-mono">{EMPTY_VALUE}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {item.crewName ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-secondary text-secondary-foreground text-xs font-medium border border-border">
                              <Wrench className="size-3.5" />
                              {item.crewName}
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-destructive">Nie przypisano ekipy</span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-mono text-foreground">{item.deviceModel}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {item.status === 'PLANNED' && (
                            <StatusPill label="Zaplanowane" tone="info" />
                          )}
                          {item.status === 'IN_PROGRESS' && (
                            <StatusPill label="W trakcie montażu" tone="warning" />
                          )}
                          {item.status === 'COMPLETED' && (
                            <StatusPill label="Zakończone" tone="neutral" />
                          )}
                          {item.status === 'CANCELLED' && (
                            <StatusPill label="Anulowane" tone="danger" />
                          )}
                        </td>
                        <td
                          className={`px-6 py-4 whitespace-nowrap text-right sticky right-0 z-20 group-hover:bg-secondary/30 ${
                            isLate ? "bg-amber-500/5" : isTodayInstall ? "bg-primary/5" : "bg-card"
                          }`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-2">
                            <DropdownMenu>
                              <DropdownMenuTrigger className="size-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" disabled={isPending}>
                                <MoreHorizontal size={16} />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>Zarządzaj Instalacją</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                
                                {item.status === 'PLANNED' && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(item.id, 'IN_PROGRESS')}>
                                    <Wrench className="mr-2 size-4 text-primary" />
                                    <span>Rozpocznij (W trakcie)</span>
                                  </DropdownMenuItem>
                                )}

                                {item.status === 'IN_PROGRESS' && (
                                  <DropdownMenuItem onClick={() => handleStatusChange(item.id, 'COMPLETED')}>
                                    <CheckCircle2 className="mr-2 size-4 text-primary" />
                                    <span>Zakończ montaż</span>
                                  </DropdownMenuItem>
                                )}

                                {item.status !== 'CANCELLED' && item.status !== 'COMPLETED' && (
                                  <DropdownMenuItem 
                                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                    onClick={() => {
                                      if (confirm("Czy na pewno chcesz anulować tę instalację?")) {
                                        handleStatusChange(item.id, 'CANCELLED');
                                      }
                                    }}
                                  >
                                    <XCircle className="mr-2 size-4" />
                                    <span>Anuluj montaż</span>
                                  </DropdownMenuItem>
                                )}
                              
                              {canDeleteInstallations && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                    onClick={() => handleDelete(item.id)}
                                  >
                                    <ShieldAlert className="mr-2 size-4" />
                                    <span>Usuń (Tylko Admin)</span>
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {deleteDialogId !== null && (
        <DeleteJustificationDialog
          title="Usuń instalację"
          description="Wpisz uzasadnienie biznesowe i wskaż podstawę prawną usunięcia wpisu instalacji z systemu."
          onClose={() => setDeleteDialogId(null)}
          onConfirm={async (data) => {
            const { deleteInstallationAction } = await import("./actions");
            return deleteInstallationAction(deleteDialogId, data);
          }}
          onSuccess={() => {
            setInstallations(prev => prev.filter(i => i.id !== deleteDialogId));
            setDeleteDialogId(null);
          }}
        />
      )}
    </div>
  );
}
