"use client"

import React, { useTransition,  useState } from "react"
import { Search, AlertTriangle, MoreHorizontal, Clock, Wrench , ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import { IncidentSummary , deleteIncidentAction } from "./actions"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { formatDate } from "@/lib/format-date"
import { DeleteJustificationDialog } from "@/components/delete-justification-dialog"
import { shortId } from "@/lib/format-id"

export function IncidentsClient({ initialIncidents }: { initialIncidents: IncidentSummary[] }) {
  const [incidents] = useState<IncidentSummary[]>(initialIncidents)
  const [searchQuery, setSearchQuery] = useState("")
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null)

  const filtered = incidents.filter(i => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return i.klient_name.toLowerCase().includes(q) || 
             i.numer_zgloszenia?.toLowerCase().includes(q) ||
             i.opis_usterki.toLowerCase().includes(q);
    }
    return true;
  });

  const [isPending, startTransition] = useTransition();
  const handleDelete = (id: string) => {
    setDeleteDialogId(id);
  }

  return (
    <div className="h-full flex flex-col max-w-[1800px] mx-auto animate-in fade-in duration-300">
      <div className="flex justify-between items-center bg-card p-6 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Zgłoszenia i Usterki</h1>
          <p className="text-sm text-muted-foreground mt-1">Obsługa incydentów, napraw gwarancyjnych i pogwarancyjnych.</p>
        </div>
        <div className="flex gap-3">
          <Button className="rounded-md font-semibold bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-sm flex items-center gap-2" onClick={() => alert("Dodawanie w Fazie 2")}>
            <AlertTriangle className="size-4" />
            Zgłoś Usterkę (Manualnie)
          </Button>
        </div>
      </div>

      <div className="flex flex-col flex-1 p-6 gap-6 bg-background">
        <div className="flex flex-col sm:flex-row gap-4 items-center justify-between bg-card p-4 rounded-2xl border border-border shadow-2xs">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
            <input
              type="text"
              placeholder="Szukaj po numerze, kliencie, opisie..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-border rounded-md bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
            />
          </div>
          <div className="text-sm text-muted-foreground">
            Aktywne zgłoszenia: <span className="font-semibold text-foreground">{filtered.length}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filtered.length === 0 ? (
            <div className="col-span-full py-12 text-center text-muted-foreground text-sm bg-card rounded-2xl border border-border">
              Brak zgłoszeń w systemie.
            </div>
          ) : (
            filtered.map((incident) => {
              
              let priorityColor = "bg-secondary text-foreground";
              if (incident.priorytet === "WYSOKI") {
                priorityColor = "bg-destructive/20 text-destructive border border-destructive/30";
              } else if (incident.priorytet === "ŚREDNI") {
                priorityColor = "bg-amber-500/20 text-amber-600 dark:text-amber-500 border border-amber-500/30";
              }

              return (
                <div key={incident.id} className="flex flex-col bg-card rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow relative">
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${priorityColor}`}>
                        PRIORYTET: {incident.priorytet}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="size-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors -mt-1 -mr-2">
                          <MoreHorizontal size={16} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Opcje Zgłoszenia</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => alert("W Fazie 2")}>Zmień Status</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => alert("W Fazie 2")}>Przydziel Brygadę Serwisową</DropdownMenuItem>
                        
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                onClick={() => handleDelete(incident.id)}
                              >
                                <ShieldAlert className="mr-2 size-4" />
                                <span>Usuń (Tylko Admin)</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    <h3 className="font-bold text-foreground line-clamp-1">{incident.klient_name}</h3>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">
                      {incident.numer_zgloszenia || shortId(incident.id)}
                    </p>

                    <div className="mt-4 flex-1">
                      <p className="text-sm text-foreground line-clamp-3 bg-secondary/30 p-3 rounded-lg border border-border/50">
                        {incident.opis_usterki}
                      </p>
                    </div>

                    <div className="mt-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs">
                        <Clock className="size-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Zgłoszono: <span className="font-medium text-foreground">{formatDate(incident.created_at, "dd.MM.yyyy HH:mm")}</span></span>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <Wrench className="size-3.5 text-muted-foreground" />
                        <span className="text-muted-foreground">Serwisant: {incident.zespol_name ? <span className="font-medium text-foreground">{incident.zespol_name}</span> : <span className="text-amber-600 dark:text-amber-500 font-medium">Brak przydziału</span>}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-secondary/50 border-t border-border px-5 py-3 flex justify-between items-center">
                    <div className="text-xs font-semibold text-muted-foreground">
                      Status:
                    </div>
                    <span className="px-2 py-1 bg-background border border-border rounded text-xs font-bold text-foreground">
                      {incident.status}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {deleteDialogId && (
        <DeleteJustificationDialog
          title="Usuń zgłoszenie"
          description="Uwaga! Operacja jest nieodwracalna i zarezerwowana dla Administratora (RODO). Rekord zostanie trwale usunięty."
          onConfirm={(values) => deleteIncidentAction(deleteDialogId, values)}
          onClose={() => setDeleteDialogId(null)}
          onSuccess={() => {
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}
