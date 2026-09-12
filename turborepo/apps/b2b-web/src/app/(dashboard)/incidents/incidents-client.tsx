"use client"

import React, { useTransition, useState, useEffect } from "react"
import { Search, AlertTriangle, MoreHorizontal, Clock, Wrench, ShieldAlert, ImageIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { can, type Role } from "@klikklima/contracts"
import type { IncidentSummary } from "./types"
import { deleteIncidentAction } from "./actions"
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
import { CreateIncidentDialog } from "./create-incident-dialog"
import { ChangeStatusDialog } from "./change-status-dialog"
import { AssignCrewDialog } from "./assign-crew-dialog"

export function IncidentsClient({
  initialIncidents,
  actorRole,
}: {
  initialIncidents: IncidentSummary[]
  actorRole: Role | null
}) {
  const [incidents, setIncidents] = useState<IncidentSummary[]>(initialIncidents)
  const [searchQuery, setSearchQuery] = useState("")
  const [deleteDialogId, setDeleteDialogId] = useState<string | null>(null)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [preselectedClientId, setPreselectedClientId] = useState<string | null>(null)
  const [statusDialogState, setStatusDialogState] = useState<{ id: string; status: string } | null>(null)
  const [crewDialogState, setCrewDialogState] = useState<{ id: string; crewId?: string | null } | null>(null)

  const canDeleteIncidents = !!actorRole && can(actorRole, "incidents", "delete") === "yes";

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const clientId = params.get("clientId")
      if (clientId) {
        setPreselectedClientId(clientId)
        setCreateDialogOpen(true)
      }
    }
  }, [])

  const filtered = incidents.filter(i => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return i.klient_name.toLowerCase().includes(q) || 
             i.numer_zgloszenia?.toLowerCase().includes(q) ||
             i.opis_usterki.toLowerCase().includes(q);
    }
    return true;
  });

  const [, startTransition] = useTransition();
  const handleDelete = (id: string) => {
    setDeleteDialogId(id);
  }

  const handleRefresh = () => {
    window.location.reload()
  }

  return (
    <div className="h-full flex flex-col max-w-[1800px] mx-auto animate-in fade-in duration-300">
      <div className="flex justify-between items-center bg-card p-6 border-b border-border">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Zgłoszenia i Usterki</h1>
          <p className="text-sm text-muted-foreground mt-1">Obsługa incydentów, napraw gwarancyjnych i pogwarancyjnych.</p>
        </div>
        <div className="flex gap-3">
          <Button
            className="rounded-md font-semibold bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-sm flex items-center gap-2"
            onClick={() => setCreateDialogOpen(true)}
          >
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
              if (incident.priorytet === "KRYTYCZNY") {
                priorityColor = "bg-destructive/25 text-destructive border border-destructive/40 font-bold";
              } else if (incident.priorytet === "WYSOKI") {
                priorityColor = "bg-destructive/20 text-destructive border border-destructive/30";
              } else if (incident.priorytet === "ŚREDNI") {
                priorityColor = "bg-amber-500/20 text-amber-600 dark:text-amber-500 border border-amber-500/30";
              }

              return (
                <div key={incident.id} className="flex flex-col bg-card rounded-2xl border border-border overflow-hidden shadow-sm hover:shadow-md transition-shadow relative">
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex justify-between items-start mb-4">
                      <span className={`px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wider ${priorityColor}`}>
                        PRIORYTET: {incident.priorytet}
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="size-8 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors -mt-1 -mr-2">
                          <MoreHorizontal size={16} />
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuLabel>Opcje Zgłoszenia</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setStatusDialogState({ id: incident.id, status: incident.status })}>
                            Zmień Status
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setCrewDialogState({ id: incident.id, crewId: incident.zespol_id })}>
                            Przydziel Brygadę Serwisową
                          </DropdownMenuItem>

                              {canDeleteIncidents && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive focus:bg-destructive/10"
                                    onClick={() => handleDelete(incident.id)}
                                  >
                                    <ShieldAlert className="mr-2 size-4" />
                                    <span>Usuń (Tylko Admin)</span>
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    <h3 className="font-bold text-foreground line-clamp-1">{incident.klient_name}</h3>
                    <p className="text-xs font-mono text-muted-foreground mt-0.5">
                      {incident.numer_zgloszenia || shortId(incident.id)}
                    </p>

                    {incident.sla && (
                      <div className="mt-2.5 flex items-center gap-1.5">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-2xs font-semibold border ${incident.sla.uiBadgeClass}`}>
                          {incident.sla.isBreached && <AlertTriangle className="size-3 shrink-0 text-destructive" />}
                          {incident.sla.isPaused && <Clock className="size-3 shrink-0 text-amber-500" />}
                          <span>Reakcja: {incident.sla.label}</span>
                        </span>
                      </div>
                    )}

                    <div className="mt-4 flex-1">
                      <p className="text-sm text-foreground line-clamp-3 bg-secondary/30 p-3 rounded-lg border border-border/50">
                        {incident.opis_usterki}
                      </p>
                    </div>

                    {incident.zdjecia_url && incident.zdjecia_url.length > 0 && (
                      <div className="mt-3 flex items-center gap-1.5 text-2xs text-muted-foreground bg-secondary/20 px-2.5 py-1 rounded-md border border-border/40">
                        <ImageIcon className="size-3 text-primary" />
                        <span>Załączniki zdjęciowe: {incident.zdjecia_url.length}</span>
                      </div>
                    )}

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

      <CreateIncidentDialog
        isOpen={createDialogOpen}
        onClose={() => {
          setCreateDialogOpen(false)
          setPreselectedClientId(null)
        }}
        onSuccess={() => {
          setCreateDialogOpen(false)
          setPreselectedClientId(null)
          handleRefresh()
        }}
        preselectedClientId={preselectedClientId}
      />

      {statusDialogState && (
        <ChangeStatusDialog
          isOpen={true}
          incidentId={statusDialogState.id}
          currentStatus={statusDialogState.status}
          onClose={() => setStatusDialogState(null)}
          onSuccess={() => {
            setStatusDialogState(null)
            handleRefresh()
          }}
        />
      )}

      {crewDialogState && (
        <AssignCrewDialog
          isOpen={true}
          incidentId={crewDialogState.id}
          currentCrewId={crewDialogState.crewId}
          onClose={() => setCrewDialogState(null)}
          onSuccess={() => {
            setCrewDialogState(null)
            handleRefresh()
          }}
        />
      )}

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
