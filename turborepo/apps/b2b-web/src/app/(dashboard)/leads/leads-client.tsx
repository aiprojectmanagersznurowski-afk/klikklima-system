"use client";

import React, { useState, useEffect } from "react";
import { Search, Filter, Calendar, Edit, ExternalLink, UserPlus, Check } from "lucide-react";
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

export const KANBAN_STAGES: { id: LeadStatus; title: string }[] = [
  { id: "NEW_LEAD", title: "Nowy lead - przypisz audytora" },
  { id: "AUDITOR_ASSIGNED", title: "Audytor Przypisany - oczekuje wyceny" },
  { id: "AUDIT_COMPLETED", title: "Wykonany audyt" },
  { id: "QUOTE_ACCEPTED", title: "Wycena zaakcept." },
  { id: "PAID", title: "Opłacono - Przypisz zespół" },
  { id: "AWAITING_INSTALLATION", title: "Oczekuje na ekipę / Przed Instalacją" },
  { id: "HARDWARE_SHIPPED", title: "Wysyłka" },
  { id: "HARDWARE_DELIVERED", title: "Dostarczony" },
  { id: "INSTALLATION_IN_PROGRESS", title: "Instalacja w trakcie" },
  { id: "INSTALLATION_COMPLETED", title: "Zakończona" },
];

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
  initialStatus: LeadStatus;
  stageCounts: Record<string, number>;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [leads, setLeads] = useState(initialLeads);

  useEffect(() => {
    setLeads(initialLeads);
  }, [initialLeads]);

  const filteredLeads = leads.filter(lead => {
    if (lead.status !== initialStatus) return false;
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const clientName = ((lead as any).klient?.imie + " " + (lead as any).klient?.nazwisko).toLowerCase();
      const id = lead.id.toLowerCase();
      if (!clientName.includes(q) && !id.includes(q)) return false;
    }
    return true;
  }).sort((a, b) => {
    // Sort by audit date (data_rezerwacji) ascending, if no audit date then by created_at descending
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
        return {
          ...l,
          audytor_id: auditorId,
          status: auditorId ? "AUDITOR_ASSIGNED" : "NEW_LEAD",
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

  return (
    <div className="h-full flex flex-col max-w-[1800px] mx-auto animate-in fade-in duration-300">
      <div className="flex justify-between items-center bg-white p-6 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Leady</h1>
          <p className="text-sm text-gray-500 mt-1">Zarządzaj zapytaniami ofertowymi i przypisuj audytorów.</p>
        </div>
        <div className="flex gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" 
              placeholder="Szukaj klienta..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent w-64 shadow-sm"
            />
          </div>
          <Button variant="outline" className="gap-2 bg-white"><Filter size={16}/> Filtruj</Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden bg-white">
        {/* Sidebar z Etapami */}
        <div className="w-[320px] border-r border-gray-200 bg-gray-50/50 flex flex-col overflow-y-auto shrink-0">
          <div className="p-4 font-semibold text-xs text-gray-500 uppercase tracking-wider">Etapy Lejka</div>
          <nav className="flex-1 px-3 space-y-1 pb-4">
            {KANBAN_STAGES.map(stage => {
              const count = stageCounts[stage.id] || 0;
              const isSelected = initialStatus === stage.id;
              
              return (
                <button
                  key={stage.id}
                  onClick={() => router.push(`?status=${stage.id}`)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    isSelected 
                      ? "bg-blue-50 text-blue-700" 
                      : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                  }`}
                >
                  <span className="truncate pr-2 text-left">{stage.title}</span>
                  <span className={`py-0.5 px-2 rounded-full text-xs ${
                    isSelected ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-600"
                  }`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tabela Leadów */}
        <div className="flex-1 overflow-auto">
          <div className="min-w-max">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                  <th className="px-6 py-4">ID & Data wpłynięcia</th>
                  <th className="px-6 py-4">Klient & Adres</th>
                  <th className="px-6 py-4">Kwota estymowana</th>
                  <th className="px-6 py-4">Audytor</th>
                  <th className="px-6 py-4">Termin audytu</th>
                  <th className="px-6 py-4">Ekipa montażowa</th>
                  <th className="px-6 py-4 text-right">Akcje</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredLeads.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                      Brak leadów w tym etapie.
                    </td>
                  </tr>
                ) : (
                  filteredLeads.map(lead => {
                    const clientName = (lead as any).klient ? `${(lead as any).klient.imie} ${(lead as any).klient.nazwisko}` : "Brak danych klienta";
                    const fullAddress = (lead as any).adres?.ulica_miasto || "Brak miasta";
                    const dateFormatted = format(new Date(lead.created_at), "d MMM yyyy, HH:mm", { locale: pl });
                    const auditDate = lead.data_rezerwacji ? format(new Date(lead.data_rezerwacji), "d MMM yyyy, HH:mm", { locale: pl }) : null;
                    const estimatedQuote = lead.estymowana_wycena || "Brak";
                    const auditor = (lead as any).audytor;
                    const teamName = (lead as any).instalacje?.[0]?.zespol?.nazwa || "Brak";

                    const isNewLead = lead.status === "NEW_LEAD";
                    const hoursSinceCreation = (new Date().getTime() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60);
                    const isDelayed = isNewLead && hoursSinceCreation > 24;

                    return (
                      <tr key={lead.id} className={`hover:bg-gray-50 transition-colors ${isDelayed ? "bg-red-50/30" : ""}`}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex flex-col">
                            <span className="text-sm font-medium text-gray-900">#{lead.id.substring(0, 8)}</span>
                            <span className="text-xs text-gray-500 mt-0.5">{dateFormatted}</span>
                            {isDelayed && <span className="text-[10px] text-red-600 font-semibold mt-1">Opóźniony (&gt;24h)</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col max-w-[200px]">
                            <span className="text-sm font-medium text-gray-900 truncate" title={clientName}>{clientName}</span>
                            <span className="text-xs text-gray-500 mt-0.5 truncate" title={fullAddress}>{fullAddress}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm font-semibold text-gray-900">{estimatedQuote}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <DropdownMenu>
                            <DropdownMenuTrigger 
                              className={`h-8 px-2 flex items-center justify-center gap-2 rounded-md text-sm transition-colors focus:outline-none ${auditor ? "hover:bg-blue-50 text-gray-900 border border-transparent" : "text-blue-600 border border-blue-200 bg-blue-50/50 hover:bg-blue-100"}`}
                            >
                              {auditor ? (
                                <>
                                  <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-[10px] shrink-0">
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
                                  {auditor?.id === a.id && <Check size={14} className="text-blue-600" />}
                                </DropdownMenuItem>
                              ))}
                              {auditors.length === 0 && (
                                <div className="text-xs text-gray-500 p-2 italic text-center">Brak audytorów</div>
                              )}
                              {auditor && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem 
                                    onSelect={() => handleAssignAuditor(lead.id, null)}
                                    className="text-red-600 focus:text-red-700 focus:bg-red-50 cursor-pointer"
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
                            <div className="flex items-center gap-1.5 text-xs text-gray-600">
                              <Calendar size={14} className="text-indigo-500" />
                              {auditDate}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-sm text-gray-600">{teamName}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Link href={`/leads/${lead.id}`}>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-500 hover:text-blue-600" title="Otwórz szczegóły">
                                <ExternalLink size={16} />
                              </Button>
                            </Link>
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
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200">
            <div className="text-sm text-gray-500">
              Strona <span className="font-medium text-gray-900">{currentPage}</span> z <span className="font-medium text-gray-900">{totalPages}</span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => router.push(`?status=${initialStatus}&page=${currentPage - 1}`)}
              >
                Poprzednia
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => router.push(`?status=${initialStatus}&page=${currentPage + 1}`)}
              >
                Następna
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
