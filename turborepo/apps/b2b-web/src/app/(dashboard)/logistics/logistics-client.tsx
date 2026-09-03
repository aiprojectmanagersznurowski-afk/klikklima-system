"use client"

import React, { useState, useTransition } from "react"
import { Package, Truck, AlertCircle, Clock, Search, Filter, RotateCcw, CheckCircle2, ChevronRight, MoreHorizontal, FileText , ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LogisticsLead, shipLogisticsOrder, bypassLogisticsOrder, markAsDelivered, rollbackLogisticsOrder , deleteLogisticsOrderAction } from "./actions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { DeleteJustificationDialog } from "@/components/delete-justification-dialog"

export function LogisticsClient({ initialShipments }: { initialShipments: LogisticsLead[] }) {
  const [shipments, setShipments] = useState<LogisticsLead[]>(initialShipments)
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("ALL")
  const [isPending, startTransition] = useTransition()
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null)

  const handleDelete = (id: string) => {
    setDeleteDialogId(id);
  }


  const handleAction = async (leadId: string, actionName: string, actionFn: () => Promise<unknown>) => {
    startTransition(async () => {
      try {
        // Zabezpieczenie przed UI flickeringiem - zoptymalizowane w UI (optimistic update jeśli trzeba by)
        await actionFn();
        alert(`Akcja "${actionName}" wykonana pomyślnie`);
        // Note: next.js server action z revalidatePath odświeży propsy, ale tu używamy lokalnego stanu, 
        // więc powinniśmy to odświeżyć globalnie, albo od razu usunąć/zaktualizować w state:
        // W prawdziwym środowisku moglibyśmy zaufać Server Components i nie uzywać `useState` 
        // jako jedynego źródła prawdy, lecz tu musimy uaktualnić lokalny stan:
      } catch (e) {
        alert(`Błąd podczas wykonywania akcji "${actionName}"`);
      }
    });
  }

  // Odśwież lokalny stan, kiedy propsy z serwera ulegną zmianie
  React.useEffect(() => {
    setShipments(initialShipments);
  }, [initialShipments]);

  const filteredShipments = shipments.filter(item => {
    if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return item.id.toLowerCase().includes(q) || 
             item.leadId.toLowerCase().includes(q) || 
             item.clientName.toLowerCase().includes(q) || 
             item.deviceModel.toLowerCase().includes(q);
    }
    return true;
  });

  const urgentCount = shipments.filter(s => s.status === 'HARDWARE_IN_WAREHOUSE' && s.daysToInstall !== null && s.daysToInstall < 3).length;
  const warningCount = shipments.filter(s => s.status === 'HARDWARE_IN_WAREHOUSE' && s.daysToInstall !== null && s.daysToInstall >= 3 && s.daysToInstall <= 7).length;
  const rollbackCount = shipments.filter(s => s.status === 'ROLLBACK_RESCHEDULING').length;

  return (
    <div className="h-full flex flex-col max-w-[1800px] mx-auto animate-in fade-in duration-300">
      {/* Top Header */}
      <div className="flex justify-between items-center bg-card p-6 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Logistyka i Magazyn (Rollback Engine)</h1>
          <p className="text-sm text-muted-foreground mt-1">Koordynacja wysyłek urządzeń HVAC i obsługa zwrotów z rygorystycznym SLA.</p>
        </div>
        <div className="flex gap-3">
          <Button className="rounded-md font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm flex items-center gap-2">
            <Package className="size-4" />
            Zleć partię kurierowi
          </Button>
        </div>
      </div>

      <div className="flex flex-col flex-1 p-6 gap-6 bg-background">
        {/* KPI Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Wszystkie aktywne wysyłki</span>
              <Truck className="size-5 text-primary" />
            </div>
            <p className="text-3xl font-bold tracking-tight text-foreground mt-3">{shipments.length}</p>
            <span className="text-xs text-muted-foreground mt-1 font-mono">Baza operacyjna Magazynu</span>
          </div>

          <div className="bg-destructive/5 border-l-4 border-destructive border-y border-r rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-destructive">Pilny montaż (&lt; 3 dni)</span>
              <AlertCircle className="size-5 text-destructive" />
            </div>
            <p className="text-3xl font-bold tracking-tight text-destructive mt-3">{urgentCount}</p>
            <span className="text-xs text-destructive/80 font-medium mt-1">Wymagane natychmiastowe nadanie!</span>
          </div>

          <div className="bg-amber-500/5 border-l-4 border-amber-500 border-y border-r border-border rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold text-amber-600 dark:text-amber-500">Uwaga SLA (3–7 dni)</span>
              <Clock className="size-5 text-amber-600 dark:text-amber-500" />
            </div>
            <p className="text-3xl font-bold tracking-tight text-amber-600 dark:text-amber-500 mt-3">{warningCount}</p>
            <span className="text-xs text-muted-foreground mt-1">Zbliża się okno terminowe wysyłki</span>
          </div>

          <div className="bg-card border border-border rounded-2xl p-5 shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Wycofania (Rollback)</span>
              <RotateCcw className="size-5 text-accent" />
            </div>
            <p className="text-3xl font-bold tracking-tight text-foreground mt-3">{rollbackCount}</p>
            <span className="text-xs text-muted-foreground mt-1 font-mono">Aktywne procedury cofnięcia</span>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-2xl border border-border shadow-2xs">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter size={16} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground font-medium whitespace-nowrap">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border border-border rounded-md px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer shadow-xs font-medium"
            >
              <option value="ALL">Wszystkie statusy</option>
              <option value="HARDWARE_IN_WAREHOUSE">W hurtowni (Do wysyłki)</option>
              <option value="HARDWARE_IN_TRANSIT">W drodze kurierem</option>
              <option value="ROLLBACK_RESCHEDULING">Wycofany / Zwrot (Rollback)</option>
            </select>
          </div>
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder="Szukaj po ID, nazwie klienta, modelu..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-1.5 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
            />
          </div>
        </div>

        {/* Table of Shipments */}
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
                  <th className="p-3.5 px-6">Numer LOG / Lead</th>
                  <th className="p-3.5 px-6">Klient & Adres montażu</th>
                  <th className="p-3.5 px-6">Sprzęt HVAC</th>
                  <th className="p-3.5 px-6">Termin & SLA</th>
                  <th className="p-3.5 px-6">Status Magazynu</th>
                  <th className="p-3.5 px-6 text-right sticky right-0 z-30 bg-secondary/50">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredShipments.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-muted-foreground text-sm">
                      Brak pozycji magazynowych spełniających kryteria.
                    </td>
                  </tr>
                ) : (
                  filteredShipments.map(item => {
                    const isUrgent = item.status === 'HARDWARE_IN_WAREHOUSE' && item.daysToInstall !== null && item.daysToInstall < 3;
                    const isWarning = item.status === 'HARDWARE_IN_WAREHOUSE' && item.daysToInstall !== null && item.daysToInstall >= 3 && item.daysToInstall <= 7;

                    let slaBadge = (
                      <span className="text-xs text-muted-foreground font-mono">
                        {item.installationDate ? `${item.installationDate} (Bezpieczny termin)` : "Brak ustalonego terminu"}
                      </span>
                    );
                    
                    if (item.status === 'ROLLBACK_RESCHEDULING') {
                      slaBadge = <span className="text-xs text-destructive font-semibold">Zasoby zablokowane (Rollback)</span>;
                    } else if (isUrgent) {
                      slaBadge = (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-destructive">
                          <span className="size-2 rounded-full bg-destructive animate-pulse" />
                          Pilny: {item.daysToInstall} dni do montażu!
                        </span>
                      );
                    } else if (isWarning) {
                      slaBadge = (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600 dark:text-amber-500">
                          <span className="size-2 rounded-full bg-amber-500" />
                          SLA: {item.daysToInstall} dni do montażu
                        </span>
                      );
                    }

                    return (
                      <tr
                        key={item.id}
                        className={`group hover:bg-secondary/30 transition-colors ${
                          isUrgent ? "border-l-4 border-l-destructive bg-destructive/5" : isWarning ? "border-l-4 border-l-amber-500 bg-amber-500/5" : ""
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold font-mono tracking-tight text-foreground">{item.id}</span>
                            <span className="text-xs font-mono text-muted-foreground mt-0.5">{item.leadId}</span>
                            {item.trackingNumber && (
                              <span className="text-[11px] font-mono text-primary mt-1 bg-primary/10 px-1.5 py-0.5 rounded w-max">
                                {item.trackingNumber}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col max-w-[220px]">
                            <span className="text-sm font-medium text-foreground truncate" title={item.clientName}>{item.clientName}</span>
                            <span className="text-xs text-muted-foreground mt-0.5 truncate" title={item.address}>{item.address}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-semibold font-mono text-foreground">{item.deviceModel}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm font-mono font-medium text-foreground">{item.installationDate || "Brak"}</span>
                            <div className="mt-1">{slaBadge}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {item.status === 'HARDWARE_IN_WAREHOUSE' && (
                            <span className="rounded-full px-3 py-1 text-xs font-semibold bg-accent/10 text-accent inline-flex items-center gap-1.5 border border-accent/20">
                              <Package className="size-3.5" /> W hurtowni
                            </span>
                          )}
                          {item.status === 'HARDWARE_IN_TRANSIT' && (
                            <span className="rounded-full px-3 py-1 text-xs font-semibold bg-primary/10 text-primary inline-flex items-center gap-1.5 border border-primary/20">
                              <Truck className="size-3.5" /> W drodze kurierem
                            </span>
                          )}
                          {item.status === 'ROLLBACK_RESCHEDULING' && (
                            <span className="rounded-full px-3 py-1 text-xs font-semibold bg-destructive/10 text-destructive inline-flex items-center gap-1.5 border border-destructive/20">
                              <RotateCcw className="size-3.5 animate-spin-slow" /> Rollback / Wycofane
                            </span>
                          )}
                        </td>
                        <td
                          className={`px-6 py-4 whitespace-nowrap text-right sticky right-0 z-20 group-hover:bg-secondary/30 ${
                            isUrgent ? "bg-destructive/5" : isWarning ? "bg-amber-500/5" : "bg-card"
                          }`}
                        >
                          <div className="flex items-center justify-end gap-2">
                            {item.status === 'HARDWARE_IN_WAREHOUSE' && (
                              <Button
                                size="sm"
                                onClick={() => {
                                  const tracking = prompt("Podaj numer listu przewozowego (Tracking ID):", `DPD-${Math.floor(1000000000 + Math.random() * 9000000000)}`);
                                  if (tracking !== null) {
                                    handleAction(item.leadId, "Wysłano kurierem", () => shipLogisticsOrder(item.leadId, tracking));
                                  }
                                }}
                                className="h-8 text-xs font-medium rounded-md bg-primary hover:bg-primary/90 text-primary-foreground"
                                disabled={isPending}
                              >
                                Nadaj przesyłkę
                              </Button>
                            )}

                            {/* Dropdown Akcji */}
                            <DropdownMenu>
                              <DropdownMenuTrigger className="size-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" title="Akcje" disabled={isPending}>
                                <MoreHorizontal size={16} />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuLabel>Akcje Logistyczne</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                
                                {item.status === 'HARDWARE_IN_WAREHOUSE' && (
                                  <DropdownMenuItem onClick={() => handleAction(item.leadId, "Dostawa z ekipą (Bypass)", () => bypassLogisticsOrder(item.leadId))}>
                                    <Truck className="mr-2 size-4 text-primary" />
                                    <span>Dostawa z ekipą (Bypass)</span>
                                  </DropdownMenuItem>
                                )}

                                {item.status === 'HARDWARE_IN_TRANSIT' && (
                                  <DropdownMenuItem onClick={() => handleAction(item.leadId, "Paczka dostarczona", () => markAsDelivered(item.leadId))}>
                                    <CheckCircle2 className="mr-2 size-4 text-green-600" />
                                    <span>Paczka dostarczona</span>
                                  </DropdownMenuItem>
                                )}

                                {item.status !== 'ROLLBACK_RESCHEDULING' && (
                                  <DropdownMenuItem 
                                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                    onClick={() => {
                                      const reason = prompt("Podaj powód Rollbacku (awaria sprzętu, zwrot itp.):", "Problem magazynowy");
                                      if (reason !== null) {
                                        handleAction(item.leadId, "Rollback", () => rollbackLogisticsOrder(item.leadId, reason));
                                      }
                                    }}
                                  >
                                    <RotateCcw className="mr-2 size-4" />
                                    <span>Wycofaj / Rollback</span>
                                  </DropdownMenuItem>
                                )}
                              
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                onClick={() => handleDelete(item.leadId)}
                              >
                                <ShieldAlert className="mr-2 size-4" />
                                <span>Usuń (Tylko Admin)</span>
                              </DropdownMenuItem>
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
          <div className="bg-secondary/30 px-6 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>Rollback Engine v2.4 (Automatyczna blokada stanów buforowych)</span>
            <span className="font-mono">SLA Check: OK</span>
          </div>
        </div>
      </div>

      {deleteDialogId && (
        <DeleteJustificationDialog
          title="Usuń zlecenie logistyczne"
          description="Uwaga! Operacja jest nieodwracalna i zarezerwowana dla Administratora (RODO). Rekord zostanie trwale usunięty."
          onConfirm={(values) => deleteLogisticsOrderAction(deleteDialogId, values)}
          onClose={() => setDeleteDialogId(null)}
          onSuccess={() => {
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
