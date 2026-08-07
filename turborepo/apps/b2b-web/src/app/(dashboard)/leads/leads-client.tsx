"use client";

import React, { useState, useEffect } from "react";
import { Search, Filter, Calendar, ExternalLink, UserPlus, Check, ChevronLeft, ChevronRight, MoreHorizontal, ArrowRight, RotateCcw, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LeadStatus, leady as Lead, audytorzy as Auditor } from "@repo/database";
import { format } from "date-fns";
import { pl } from "date-fns/locale";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { updateLeadAuditor } from "./[id]/actions";
import { advanceLeadStatus } from "./actions";

type StageFilter = LeadStatus | "ALL";

export const LEAD_STAGES: { id: StageFilter; title: string; short?: string }[] = [
  { id: "ALL", title: "Wszystkie", short: "Wszystkie" },
  { id: "NEW_LEAD", title: "1. Nowy lead", short: "E1" },
  { id: "AWAITING_AUDIT", title: "2. Oczekiwanie na audyt", short: "E2" },
  { id: "AUDIT_COMPLETED", title: "3. Wykonany audyt", short: "E3" },
  { id: "AWAITING_CREW_ASSIGNMENT", title: "4. Oczekuje na ekipę", short: "E4" },
  { id: "HARDWARE_IN_WAREHOUSE", title: "5. Wysyłka (Hurtownia)", short: "E5" },
  { id: "HARDWARE_IN_TRANSIT", title: "6. Wysyłka w drodze", short: "E6" },
  { id: "AWAITING_INSTALLATION", title: "7. Oczekuje instalacji", short: "E7" },
  { id: "INSTALLATION_COMPLETED", title: "8. Instalacja zakończona", short: "E8" },
  { id: "QUOTE_REJECTED", title: "🧊 Zimne leady", short: "ZL" },
  { id: "ROLLBACK_RESCHEDULING", title: "🔄 Rollback", short: "RB" },
];

/** Dozwolone akcje kontekstowe per status */
const CONTEXT_ACTIONS: Record<LeadStatus, { label: string; target: LeadStatus; icon?: string; variant?: "default" | "destructive" }[]> = {
  NEW_LEAD: [],
  AWAITING_AUDIT: [
    { label: "Cofnij do Nowy lead", target: "NEW_LEAD" },
  ],
  AUDIT_COMPLETED: [
    { label: "Klient zaakceptował → Ekipa", target: "AWAITING_CREW_ASSIGNMENT" },
    { label: "Przenieś do Zimnych leadów", target: "QUOTE_REJECTED", variant: "destructive" },
  ],
  AWAITING_CREW_ASSIGNMENT: [
    { label: "Ekipa przydzielona → Logistyka", target: "HARDWARE_IN_WAREHOUSE" },
    { label: "Rollback (Problem)", target: "ROLLBACK_RESCHEDULING", variant: "destructive" },
  ],
  HARDWARE_IN_WAREHOUSE: [
    { label: "Wysłano kurierem → W drodze", target: "HARDWARE_IN_TRANSIT" },
    { label: "Dostawa z ekipą (Bypass) → E7", target: "AWAITING_INSTALLATION" },
    { label: "Rollback (Problem)", target: "ROLLBACK_RESCHEDULING", variant: "destructive" },
  ],
  HARDWARE_IN_TRANSIT: [
    { label: "Paczka dostarczona → E7", target: "AWAITING_INSTALLATION" },
    { label: "Rollback (Problem)", target: "ROLLBACK_RESCHEDULING", variant: "destructive" },
  ],
  AWAITING_INSTALLATION: [
    { label: "Instalacja zakończona ✓", target: "INSTALLATION_COMPLETED" },
    { label: "Rollback (Problem)", target: "ROLLBACK_RESCHEDULING", variant: "destructive" },
  ],
  INSTALLATION_COMPLETED: [],
  QUOTE_REJECTED: [
    { label: "Reaktywuj → Nowy lead", target: "NEW_LEAD" },
  ],
  ROLLBACK_RESCHEDULING: [
    { label: "Powrót do lejka → E4", target: "AWAITING_CREW_ASSIGNMENT" },
  ],
};

export function LeadsClient({ 
  initialLeads, 
  auditors,
  totalPages,
  currentPage,
  initialStatus,
  stageCounts
}: { 
  initialLeads: Lead[]; 
  auditors: Auditor[];
  totalPages: number;
  currentPage: number;
  initialStatus: StageFilter;
  stageCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [leads, setLeads] = useState(initialLeads);

  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  const isShowingAll = initialStatus === "ALL";

  const filteredLeads = leads.filter(lead => {
    // When showing all, don't filter by status
    if (!isShowingAll && lead.status !== initialStatus) return false;
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const clientName = ((lead as any).klient?.imie_i_nazwisko || "").toLowerCase();
      const id = lead.id.toLowerCase();
      if (!clientName.includes(q) && !id.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => {
    if (a.data_rezerwacji && b.data_rezerwacji) {
      return new Date(a.data_rezerwacji).getTime() - new Date(b.data_rezerwacji).getTime();
    } else if (a.data_rezerwacji) {
      return -1;
    } else if (b.data_rezerwacji) {
      return 1;
    }
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  const handleAssignAuditor = async (leadId: string, auditorId: string | null) => {
    const previousLeads = [...leads];
    setLeads(current => current.map(l => {
      if (l.id === leadId) {
        let newStatus = l.status;
        if (auditorId && l.status === "NEW_LEAD") {
          newStatus = "AWAITING_AUDIT";
        } else if (!auditorId && l.status === "AWAITING_AUDIT") {
          newStatus = "NEW_LEAD";
        }
        
        return {
          ...l,
          audytor_id: auditorId,
          status: newStatus,
          audytor: auditors.find(a => a.id === auditorId) || null
        } as Lead;
      }
      return l;
    }));

    const res = await updateLeadAuditor(leadId, auditorId);
    if (!res.success) {
      alert("Błąd podczas przypisywania audytora: " + res.error);
      setLeads(previousLeads);
    } else {
      startTransition(() => {
        router.refresh();
      });
    }
  };

  const handleAdvanceStatus = async (leadId: string, targetStatus: LeadStatus) => {
    // Optimistic UI: Update the lead status locally
    const previousLeads = [...leads];
    setLeads(current => current.map(l => {
      if (l.id === leadId) {
        return { ...l, status: targetStatus } as Lead;
      }
      return l;
    }));

    const res = await advanceLeadStatus(leadId, targetStatus);
    if (!res.success) {
      alert("Błąd: " + res.error);
      setLeads(previousLeads);
    } else {
      startTransition(() => {
        router.refresh();
      });
    }
  };

  const buildPageUrl = (status: StageFilter, page?: number) => {
    const params = new URLSearchParams();
    params.set("status", status);
    if (page && page > 1) params.set("page", String(page));
    return `?${params.toString()}`;
  };

  return (
    <div className="h-full flex flex-col max-w-[1800px] mx-auto animate-in fade-in duration-300">
      <div className="flex justify-between items-center bg-card p-6 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Leady</h1>
          <p className="text-sm text-muted-foreground mt-1">Zarządzaj zapytaniami ofertowymi i przypisuj audytorów.</p>
        </div>
        <div className="flex gap-4">
          <div className="flex items-center gap-2">
            <Filter size={16} className="text-muted-foreground" />
            <span className="text-sm text-muted-foreground font-medium whitespace-nowrap">Etap lejka:</span>
            <select
              className="text-sm border border-border rounded-md px-3 py-2 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary cursor-pointer shadow-xs disabled:opacity-50"
              value={initialStatus}
              onChange={(e) => startTransition(() => router.push(buildPageUrl(e.target.value as StageFilter)))}
              disabled={isPending}
            >
              {LEAD_STAGES.map(stage => (
                <option key={stage.id} value={stage.id}>
                  {stage.title} ({stageCounts[stage.id] || 0})
                </option>
              ))}
            </select>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input 
              type="text" 
              placeholder="Szukaj klienta..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary w-64 shadow-xs"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-col flex-1 overflow-hidden bg-card">
        {/* Tabela Leadów */}
        <div className="flex-1 overflow-auto relative">
          {isPending && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm z-10 flex items-center justify-center">
              <div className="flex flex-col items-center text-primary">
                <svg className="animate-spin size-8 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span className="text-sm font-medium">Ładowanie...</span>
              </div>
            </div>
          )}
          <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-secondary/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 z-10 shadow-xs">
                  <th className="p-3 px-6">ID & Data wpłynięcia</th>
                  <th className="p-3 px-6">Klient & Adres</th>
                  {isShowingAll && <th className="p-3 px-6">Etap</th>}
                  <th className="p-3 px-6">Kwota estymowana</th>
                  <th className="p-3 px-6">Audytor</th>
                  <th className="p-3 px-6">Termin audytu</th>
                  <th className="p-3 px-6">Ekipa montażowa</th>
                  <th className="p-3 px-6 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={isShowingAll ? 8 : 7} className="px-6 py-12 text-center text-muted-foreground">
                      Brak leadów w tym etapie.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map(lead => {
                    const clientName = (lead as any).klient?.imie_i_nazwisko || "Brak danych klienta";
                    const fullAddress = (lead as any).adres?.ulica_miasto || "Brak miasta";
                    const dateFormatted = format(new Date(lead.created_at), "d MMM yyyy, HH:mm", { locale: pl });
                    const auditDate = lead.data_rezerwacji ? format(new Date(lead.data_rezerwacji), "d MMM yyyy, HH:mm", { locale: pl }) : null;
                    const estimatedQuote = lead.estymowana_wycena || "Brak";
                    const auditor = (lead as any).audytor;
                    const teamName = (lead as any).instalacje?.[0]?.zespol?.nazwa || "Brak";

                    const isNewLead = lead.status === "NEW_LEAD";
                    const hoursSinceCreation = (new Date().getTime() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60);
                    const isDelayed = isNewLead && hoursSinceCreation > 24;

                    const actions = lead.status ? CONTEXT_ACTIONS[lead.status as LeadStatus] || [] : [];

                    return (
                      <tr key={lead.id} className={`hover:bg-secondary/30 transition-colors ${isDelayed ? "bg-destructive/10 hover:bg-destructive/15" : ""}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold font-mono tracking-tight text-foreground">#{lead.id.substring(0, 8)}</span>
                            <span className="text-xs font-mono text-muted-foreground mt-0.5">{dateFormatted}</span>
                            {isDelayed && <span className="text-[10px] text-destructive font-semibold mt-1">Opóźniony (&gt;24h)</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col max-w-[200px]">
                            <span className="text-sm font-medium text-foreground truncate" title={clientName}>{clientName}</span>
                            <span className="text-xs text-muted-foreground mt-0.5 truncate" title={fullAddress}>{fullAddress}</span>
                          </div>
                        </td>
                        {isShowingAll && (
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20">
                              {LEAD_STAGES.find(s => s.id === lead.status)?.short || "—"}
                            </span>
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-semibold text-foreground">{estimatedQuote}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <DropdownMenu>
                            <DropdownMenuTrigger 
                              className={`h-8 px-2 flex items-center justify-center gap-2 rounded-md text-sm transition-colors focus:outline-none ${auditor ? "hover:bg-secondary text-foreground border border-transparent font-medium" : "text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 font-medium"}`}
                            >
                              {auditor ? (
                                <>
                                  <div className="size-5 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-[10px] shrink-0">
                                    {auditor.imie_i_nazwisko.charAt(0)}
                                  </div>
                                  <span className="truncate max-w-[120px]">{auditor.imie_i_nazwisko}</span>
                                </>
                              ) : (
                                <>
                                  <UserPlus size={14} />
                                  Przypisz
                                </>
                              )}
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-56 max-h-[300px] overflow-y-auto">
                              <DropdownMenuLabel>Wybierz audytora</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              {auditors.map(a => (
                                <DropdownMenuItem 
                                  key={a.id} 
                                  onSelect={() => handleAssignAuditor(lead.id, a.id)}
                                  className="flex items-center justify-between cursor-pointer"
                                >
                                  <span>{a.imie_i_nazwisko}</span>
                                  {auditor?.id === a.id && <Check size={14} className="text-primary" />}
                                </DropdownMenuItem>
                              ))}
                              {auditors.length === 0 && (
                                <div className="text-xs text-muted-foreground p-2 italic text-center">Brak audytorów</div>
                              )}
                              {auditor && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onSelect={() => handleAssignAuditor(lead.id, null)}
                                    className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                                  >
                                    Odznacz audytora
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {auditDate ? (
                            <div className="flex items-center gap-1.5 text-xs font-mono text-muted-foreground">
                              <Calendar size={14} className="text-primary shrink-0" />
                              <span>{auditDate}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/60">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-muted-foreground">{teamName}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/leads/${lead.id}`} target="_blank" rel="noopener noreferrer">
                              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-primary" title="Otwórz szczegóły">
                                <ExternalLink size={16} />
                              </Button>
                            </Link>
                            
                            {actions.length > 0 && (
                              <DropdownMenu>
                                <DropdownMenuTrigger className="size-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" title="Akcje">
                                    <MoreHorizontal size={16} />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-64">
                                  <DropdownMenuLabel>Zmień etap</DropdownMenuLabel>
                                  <DropdownMenuSeparator />
                                  {actions.map((action) => (
                                    <DropdownMenuItem
                                      key={action.target}
                                      onSelect={() => handleAdvanceStatus(lead.id, action.target)}
                                      className={`cursor-pointer flex items-center gap-2 ${
                                        action.variant === "destructive" 
                                          ? "text-destructive focus:text-destructive focus:bg-destructive/10" 
                                          : ""
                                      }`}
                                    >
                                      {action.variant === "destructive" ? (
                                        <AlertTriangle size={14} className="shrink-0" />
                                      ) : action.target === "NEW_LEAD" || action.target === "AWAITING_CREW_ASSIGNMENT" ? (
                                        <RotateCcw size={14} className="shrink-0" />
                                      ) : (
                                        <ArrowRight size={14} className="shrink-0" />
                                      )}
                                      {action.label}
                                    </DropdownMenuItem>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center justify-center px-6 py-4 border-t border-border gap-2 bg-card">
            <button
              disabled={currentPage <= 1 || isPending}
              onClick={() => startTransition(() => router.push(buildPageUrl(initialStatus, currentPage - 1)))}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={16} />
            </button>
            
            <div className="flex gap-1">
               {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                 <button
                   key={p}
                   onClick={() => startTransition(() => router.push(buildPageUrl(initialStatus, p)))}
                   className={`w-8 h-8 flex items-center justify-center rounded-md text-sm transition-colors ${p === currentPage ? 'bg-primary text-primary-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:bg-secondary'}`}
                 >
                   {p}
                 </button>
               ))}
            </div>

            <button
              disabled={currentPage >= totalPages || isPending}
              onClick={() => startTransition(() => router.push(buildPageUrl(initialStatus, currentPage + 1)))}
              className="p-1.5 rounded-md text-muted-foreground hover:bg-secondary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight size={16} />
            </button>
            <span className="text-xs text-muted-foreground ml-2 font-medium">
              Strona {currentPage} z {totalPages}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
