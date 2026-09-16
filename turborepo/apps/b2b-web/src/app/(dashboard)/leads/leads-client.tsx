"use client";

import React, { useState, useEffect } from "react";
import { Search, Calendar, ExternalLink, UserPlus, Check, ChevronLeft, ChevronRight, MoreHorizontal, ArrowRight, RotateCcw, AlertTriangle , ShieldAlert, Archive, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusPill, type StatusPillTone } from "@/components/ui/status-pill";
import { LeadStatus } from "@repo/database";
import { formatDate } from "@/lib/format-date";
import { shortId } from "@/lib/format-id";
import { formatLeadStatus } from "@/lib/format-status";
import { EMPTY_VALUE } from "@/lib/empty-value";
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
import { advanceLeadStatus , deleteLeadAction } from "./actions";
import type { getAuditors, GetLeadsResult } from "./actions";
import { rollbackLogisticsOrder } from "../logistics/actions";
import { ReturnToFunnelDialog } from "./return-to-funnel-dialog";
import { ArchiveLostDialog } from "./archive-lost-dialog";
import { AssignCrewDialog } from "./assign-crew-dialog";
import { can, type Role } from "@klikklima/contracts";
import { DeleteJustificationDialog } from "@/components/delete-justification-dialog";
import { ReasonJustificationDialog } from "@/components/reason-justification-dialog";
import { getCompactPageNumbers, PAGE_ELLIPSIS } from "../customers/pagination-state";

/**
 * SEC-LEADS-LIST-SCALARS: wyprowadzone bezpośrednio z rzeczywistego zwracanego typu
 * `getLeads()` (leads/actions.ts), wzorem `AuditorPoolEntry` niżej — zarówno skalary
 * leada (zawężone do sześciu pól), jak i cztery relacje (zawężone wcześniej przez
 * SEC-LEADS-LIST-MINIMIZE) pochodzą z jednego źródła prawdy. Dopisanie pola do
 * `select` w `getLeads()` propaguje się tu automatycznie — nie utrzymujemy drugiej,
 * ręcznej kopii kształtu.
 */
type Lead = Extract<GetLeadsResult, { leads: unknown }>["leads"][number];

/**
 * SEC-ASSIGNMENT-POOL-MINIMIZE (AC6): wyprowadzone bezpośrednio z prawdziwego
 * zwracanego typu `getAuditors()` (leads/actions.ts), tak jak `assign-crew-dialog.tsx`
 * robi to dla `getCrews()`. Zmiana kształtu tam propaguje się tu automatycznie,
 * zamiast wymagać ręcznej aktualizacji dwóch kopii tego samego typu.
 */
type AuditorPoolEntry = Awaited<ReturnType<typeof getAuditors>>[number];

/**
 * Ton statusu leada dla `StatusPill`. Etap "w toku" (audyt/logistyka/montaż w drodze)
 * jest neutralny/informacyjny; etap "oczekuje na kogoś" (ryzyko przekroczenia SLA)
 * jest ostrzegawczy; zimny lead i rollback (problem) są czerwone. Brak zielonego —
 * zakaz §8.7 (kolory SLA tylko czerwony/pomarańczowy, sukces nigdy nie jest zielony).
 */
export const LEAD_STATUS_TONE: Record<LeadStatus, StatusPillTone> = {
  NEW_LEAD: "info",
  AWAITING_AUDIT: "warning",
  AUDIT_COMPLETED: "info",
  AWAITING_CREW_ASSIGNMENT: "warning",
  HARDWARE_IN_WAREHOUSE: "info",
  HARDWARE_IN_TRANSIT: "info",
  AWAITING_INSTALLATION: "warning",
  INSTALLATION_COMPLETED: "neutral",
  QUOTE_REJECTED: "danger",
  ROLLBACK_RESCHEDULING: "danger",
  ARCHIVED_LOST: "neutral",
};

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
    // E4-CREW-ASSIGNMENT-UI: usunięto głupie przejście "Ekipa przydzielona → Logistyka"
    // które nie wybierało ekipy ani nie sprawdzało certyfikatów. Zamiast tego dialog
    // AssignCrewDialog otwiera się z osobnego elementu menu (showE4CrewAction).
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
  // D7 (WO CRM-SAFE-RECORD-ACTIONS): stara ścieżka "Reaktywuj → Nowy lead" usunięta.
  // Kontrakt (T15) prowadzi QUOTE_REJECTED -> AUDIT_COMPLETED przez returnToFunnel(),
  // które wymaga dialogu z decyzją o cenie (implementer-ui, poza zakresem tej zmiany).
  QUOTE_REJECTED: [],
  ROLLBACK_RESCHEDULING: [
    { label: "Powrót do lejka → E4", target: "AWAITING_CREW_ASSIGNMENT" },
  ],
  // ARCHIVED_LOST (T16) jest terminalny — brak akcji kontekstowych (AC4.4).
  ARCHIVED_LOST: [],
};

export function LeadsClient({
  initialLeads,
  auditors,
  totalPages,
  currentPage,
  initialStatus,
  stageCounts,
  actorRole,
}: {
  initialLeads: Lead[];
  auditors: AuditorPoolEntry[];
  totalPages: number;
  currentPage: number;
  initialStatus: StageFilter;
  stageCounts: Record<string, number>;
  actorRole: Role | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition()
  // Przypadek brzegowy #4 (WO CRM-SAFE-RECORD-ACTIONS): akcje destrukcyjne/cofające
  // ukryte w UI dla ról bez uprawnienia — serwer i tak odrzuca, to tylko warstwa UX.
  const canUpdateLeads = !!actorRole && can(actorRole, "leads", "update") === "yes";
  const canDeleteLeads = !!actorRole && can(actorRole, "leads", "delete") === "yes";

  const [returnDialogLeadId, setReturnDialogLeadId] = useState<string | null>(null);
  const [archiveDialogLeadId, setArchiveDialogLeadId] = useState<string | null>(null);
  const [assignCrewDialogLeadId, setAssignCrewDialogLeadId] = useState<string | null>(null);
  const [deleteDialogLeadId, setDeleteDialogLeadId] = useState<string | null>(null);
  const [rollbackDialogLeadId, setRollbackDialogLeadId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    setDeleteDialogLeadId(id);
  };
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
      const clientName = (lead.klient?.imie_i_nazwisko || "").toLowerCase();
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
          status: newStatus,
          audytor: auditors.find(a => a.id === auditorId) || null
        };
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
        return { ...l, status: targetStatus };
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
                <tr className="bg-secondary/50 border-b border-border text-xs font-semibold text-muted-foreground uppercase tracking-wider sticky top-0 z-30 shadow-xs">
                  <th className="p-3 px-6">ID & Data wpłynięcia</th>
                  <th className="p-3 px-6">Klient & Adres</th>
                  {isShowingAll && <th className="p-3 px-6">Etap</th>}
                  <th className="p-3 px-6 text-right">Kwota estymowana</th>
                  <th className="p-3 px-6">Audytor</th>
                  <th className="p-3 px-6">Termin audytu</th>
                  <th className="p-3 px-6">Ekipa montażowa</th>
                  <th className="p-3 px-6 text-right sticky right-0 z-30 bg-secondary/50">Akcje</th>
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
                    const clientName = lead.klient?.imie_i_nazwisko || EMPTY_VALUE;
                    const fullAddress = lead.adres?.ulica_miasto || EMPTY_VALUE;
                    const dateFormatted = formatDate(lead.created_at, "d MMM yyyy, HH:mm");
                    const auditDate = lead.data_rezerwacji ? formatDate(lead.data_rezerwacji, "d MMM yyyy, HH:mm") : null;
                    const estimatedQuote = lead.estymowana_wycena || EMPTY_VALUE;
                    const auditor = lead.audytor;
                    const teamName = lead.instalacje?.[0]?.zespol?.nazwa || EMPTY_VALUE;

                    const isNewLead = lead.status === "NEW_LEAD";
                    const hoursSinceCreation = (new Date().getTime() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60);
                    const isDelayed = isNewLead && hoursSinceCreation > 24;

                    const actions = lead.status ? CONTEXT_ACTIONS[lead.status as LeadStatus] || [] : [];

                    const rowBg = isDelayed
                      ? "bg-destructive/10 group-hover:bg-destructive/15"
                      : "bg-card group-hover:bg-secondary/30";

                    return (
                      <tr
                        key={lead.id}
                        onClick={() => {
                          // MAJOR fix (reviewer): jeżeli użytkownik ma zaznaczony tekst
                          // (np. próbował przeciągnięciem myszki zaznaczyć e-mail/numer leada),
                          // nie traktujemy tego jako intencji nawigacji do szczegółów.
                          if (window.getSelection()?.toString()) return;
                          router.push(`/leads/${lead.id}`);
                        }}
                        className={`group cursor-pointer hover:bg-secondary/30 transition-colors ${isDelayed ? "bg-destructive/10 hover:bg-destructive/15" : ""}`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold font-mono tracking-tight text-foreground">{shortId(lead.id)}</span>
                            <span className="text-xs font-mono text-muted-foreground mt-0.5">{dateFormatted}</span>
                            {isDelayed && <span className="text-xs text-destructive font-semibold mt-1">Opóźniony (&gt;24h)</span>}
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
                            <StatusPill
                              label={LEAD_STAGES.find(s => s.id === lead.status)?.short || EMPTY_VALUE}
                              title={formatLeadStatus(lead.status)}
                              tone={lead.status ? LEAD_STATUS_TONE[lead.status as LeadStatus] : "neutral"}
                            />
                          </td>
                        )}
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <span className="text-sm font-semibold text-foreground tabular-nums">{estimatedQuote}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              className={`h-8 px-2 flex items-center justify-center gap-2 rounded-md text-sm transition-colors focus:outline-none ${auditor ? "hover:bg-secondary text-foreground border border-transparent font-medium" : "text-primary border border-primary/20 bg-primary/5 hover:bg-primary/10 font-medium"}`}
                            >
                              {auditor ? (
                                <>
                                  <div className="size-5 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-xs shrink-0">
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
                                  onClick={() => handleAssignAuditor(lead.id, a.id)}
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
                                    onClick={() => handleAssignAuditor(lead.id, null)}
                                    className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
                                  >
                                    Odznacz audytora
                                  </DropdownMenuItem>
                                </>
                              )}

                              {canDeleteLeads && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                    onClick={() => handleDelete(lead.id)}
                                  >
                                    <ShieldAlert className="mr-2 size-4" />
                                    <span>Usuń (Tylko Admin)</span>
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
                            <span className="text-xs text-muted-foreground/60">{EMPTY_VALUE}</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-muted-foreground">{teamName}</span>
                        </td>
                        <td
                          className={`px-6 py-4 whitespace-nowrap text-right sticky right-0 z-20 transition-colors ${rowBg}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <Link href={`/leads/${lead.id}`} onClick={(e) => e.stopPropagation()}>
                              <Button variant="ghost" size="icon" className="size-8 text-muted-foreground hover:text-primary" title="Otwórz szczegóły" aria-label="Otwórz szczegóły leada">
                                <ExternalLink size={16} />
                              </Button>
                            </Link>

                            {(() => {
                              const isColdLead = lead.status === "QUOTE_REJECTED";
                              const showColdActions = isColdLead && canUpdateLeads;
                              const isE4 = lead.status === "AWAITING_CREW_ASSIGNMENT";
                              const showE4CrewAction = isE4 && canUpdateLeads;
                              const showMenu = actions.length > 0 || showColdActions || showE4CrewAction || canDeleteLeads;
                              if (!showMenu) return null;
                              return (
                                <DropdownMenu>
                                  <DropdownMenuTrigger className="size-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors" title="Akcje">
                                      <MoreHorizontal size={16} />
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end" className="w-64">
                                    {actions.length > 0 && (
                                      <>
                                        <DropdownMenuLabel>Zmień etap</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        {actions.map((action) => (
                                          <DropdownMenuItem
                                            key={action.target}
                                            onClick={() =>
                                              action.target === "ROLLBACK_RESCHEDULING"
                                                ? setRollbackDialogLeadId(lead.id)
                                                : handleAdvanceStatus(lead.id, action.target)
                                            }
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
                                      </>
                                    )}

                                    {showE4CrewAction && (
                                      <>
                                        <DropdownMenuLabel>Przydział ekipy (E4)</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          className="cursor-pointer flex items-center gap-2"
                                          onClick={() => setAssignCrewDialogLeadId(lead.id)}
                                        >
                                          <Wrench size={14} className="shrink-0" />
                                          Przypisz ekipę monterską
                                        </DropdownMenuItem>
                                      </>
                                    )}

                                    {showColdActions && (
                                      <>
                                        <DropdownMenuLabel>Zimny lead</DropdownMenuLabel>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          className="cursor-pointer flex items-center gap-2"
                                          onClick={() => setReturnDialogLeadId(lead.id)}
                                        >
                                          <RotateCcw size={14} className="shrink-0" />
                                          Zwróć do obiegu
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          className="cursor-pointer flex items-center gap-2 text-destructive focus:text-destructive focus:bg-destructive/10"
                                          onClick={() => setArchiveDialogLeadId(lead.id)}
                                        >
                                          <Archive size={14} className="shrink-0" />
                                          Archiwizuj (Lost)
                                        </DropdownMenuItem>
                                      </>
                                    )}

                                    {canDeleteLeads && (
                                      <>
                                        <DropdownMenuSeparator />
                                        <DropdownMenuItem
                                          className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                          onClick={() => handleDelete(lead.id)}
                                        >
                                          <ShieldAlert className="mr-2 size-4" />
                                          <span>Usuń (Tylko Admin)</span>
                                        </DropdownMenuItem>
                                      </>
                                    )}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              );
                            })()}
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
               {getCompactPageNumbers(currentPage, totalPages).map((entry, idx) =>
                 entry === PAGE_ELLIPSIS ? (
                   <span
                     key={`ellipsis-${idx}`}
                     className="w-8 h-8 flex items-center justify-center text-sm text-muted-foreground select-none"
                     aria-hidden="true"
                   >
                     …
                   </span>
                 ) : (
                   <button
                     key={entry}
                     onClick={() => startTransition(() => router.push(buildPageUrl(initialStatus, entry)))}
                     aria-current={entry === currentPage ? "page" : undefined}
                     className={`w-8 h-8 flex items-center justify-center rounded-md text-sm transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${entry === currentPage ? 'bg-primary text-primary-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:bg-secondary'}`}
                   >
                     {entry}
                   </button>
                 )
               )}
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

      {returnDialogLeadId && (
        <ReturnToFunnelDialog
          leadId={returnDialogLeadId}
          quotedAt={leads.find((l) => l.id === returnDialogLeadId)?.quoted_at ?? null}
          open={!!returnDialogLeadId}
          onOpenChange={(next) => {
            if (!next) setReturnDialogLeadId(null);
          }}
          onSuccess={() => {
            setReturnDialogLeadId(null);
            startTransition(() => router.refresh());
          }}
        />
      )}

      {archiveDialogLeadId && (
        <ArchiveLostDialog
          leadId={archiveDialogLeadId}
          open={!!archiveDialogLeadId}
          onOpenChange={(next) => {
            if (!next) setArchiveDialogLeadId(null);
          }}
          onSuccess={() => {
            setArchiveDialogLeadId(null);
            startTransition(() => router.refresh());
          }}
        />
      )}

      {deleteDialogLeadId && (
        <DeleteJustificationDialog
          title="Usuń leada"
          description={
            <>
              Uwaga! Operacja jest nieodwracalna i zarezerwowana dla Administratora (RODO). Rekord zostanie trwale usunięty.
            </>
          }
          onConfirm={(values) => deleteLeadAction(deleteDialogLeadId, values)}
          onClose={() => setDeleteDialogLeadId(null)}
          onSuccess={() => {
            window.location.reload();
          }}
        />
      )}

      {rollbackDialogLeadId && (() => {
        const leadId = rollbackDialogLeadId;
        return (
          <ReasonJustificationDialog
            title="Rollback (Problem)"
            description={
              <>
                Lead zostanie cofnięty do etapu Rollback, slot ekipy zostanie zwolniony, a SLA logistyki wstrzymane. Podaj uzasadnienie.
              </>
            }
            confirmLabel="Cofnij (Rollback)"
            pendingLabel="Cofanie..."
            onConfirm={(reason) => rollbackLogisticsOrder(leadId, reason)}
            onClose={() => setRollbackDialogLeadId(null)}
            onSuccess={() => {
              setRollbackDialogLeadId(null);
              startTransition(() => router.refresh());
            }}
          />
        );
      })()}

      {assignCrewDialogLeadId && (
        <AssignCrewDialog
          leadId={assignCrewDialogLeadId}
          installationDate={
            leads.find((l) => l.id === assignCrewDialogLeadId)?.data_rezerwacji
              ? new Date(leads.find((l) => l.id === assignCrewDialogLeadId)!.data_rezerwacji!)
              : null
          }
          open={!!assignCrewDialogLeadId}
          onOpenChange={(next) => {
            if (!next) setAssignCrewDialogLeadId(null);
          }}
          onSuccess={() => {
            setAssignCrewDialogLeadId(null);
            startTransition(() => router.refresh());
          }}
        />
      )}
    </div>
  );
}
