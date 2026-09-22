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
import { shortId, formatDisplayId } from "@/lib/format-id"
import { CreateIncidentDialog } from "./create-incident-dialog"
import { ChangeStatusDialog } from "./change-status-dialog"
import { AssignCrewDialog } from "./assign-crew-dialog"
import { formatIncidentStatus, getIncidentStatusTone } from "@/lib/format-status"
import { StatusPill } from "@/components/ui/status-pill"

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

        <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-xs">
          <table className="w-full text-left border-collapse text-sm">
            <thead className="bg-muted/50 border-b border-border text-xs uppercase tracking-wider text-muted-foreground font-semibold">
              <tr>
                <th className="px-5 py-3.5">ID / Projekt</th>
                <th className="px-5 py-3.5">Klient</th>
                <th className="px-5 py-3.5">Opis Usterki</th>
                <th className="px-5 py-3.5">Priorytet</th>
                <th className="px-5 py-3.5">SLA Reakcji</th>
                <th className="px-5 py-3.5">Status</th>
                <th className="px-5 py-3.5">Brygada Serwisowa</th>
                <th className="px-5 py-3.5">Zgłoszono</th>
                <th className="px-5 py-3.5 text-right">Akcje</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-muted-foreground text-sm">
                    Brak zgłoszeń w systemie spełniających kryteria.
                  </td>
                </tr>
              ) : (
                filtered.map((incident) => {
                  let priorityBadge = "bg-secondary text-foreground";
                  if (incident.priorytet === "KRYTYCZNY") {
                    priorityBadge = "bg-destructive/20 text-destructive border border-destructive/40 font-bold";
                  } else if (incident.priorytet === "WYSOKI") {
                    priorityBadge = "bg-destructive/15 text-destructive border border-destructive/30 font-semibold";
                  } else if (incident.priorytet === "ŚREDNI") {
                    priorityBadge = "bg-amber-500/20 text-amber-600 dark:text-amber-500 border border-amber-500/30";
                  } else {
                    priorityBadge = "bg-muted text-muted-foreground border border-border/50";
                  }

                  const displayId = formatDisplayId(incident.numer_zgloszenia, incident.id);

                  return (
                    <tr 
                      key={incident.id} 
                      className="hover:bg-muted/30 transition-colors group"
                    >
                      {/* ID / Powiązana instalacja */}
                      <td className="px-5 py-4 whitespace-nowrap align-top">
                        <div className="flex flex-col">
                          <span className="font-mono font-bold text-sm text-foreground">
                            {displayId}
                          </span>
                          {incident.instalacja_model && (
                            <span className="text-xs font-mono text-muted-foreground mt-0.5">
                              {incident.instalacja_model}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Klient */}
                      <td className="px-5 py-4 whitespace-nowrap align-top">
                        <div className="flex flex-col max-w-[200px]">
                          {incident.klient_id ? (
                            <a
                              href={`/customers/${incident.klient_id}`}
                              className="font-semibold text-foreground hover:text-primary hover:underline transition-colors truncate"
                            >
                              {incident.klient_name}
                            </a>
                          ) : (
                            <span className="font-semibold text-foreground truncate">{incident.klient_name}</span>
                          )}
                          {incident.klient_telefon && (
                            <span className="text-xs text-muted-foreground mt-0.5 font-mono">
                              {incident.klient_telefon}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Opis usterki */}
                      <td className="px-5 py-4 align-top">
                        <div className="max-w-[320px]">
                          <p className="text-xs text-foreground line-clamp-2 leading-relaxed">
                            {incident.opis_usterki}
                          </p>
                          {incident.zdjecia_url && incident.zdjecia_url.length > 0 && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground mt-1 bg-secondary/60 px-2 py-0.5 rounded border border-border/50">
                              <ImageIcon className="size-3 text-primary" />
                              <span>Zdjęcia: {incident.zdjecia_url.length}</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Priorytet */}
                      <td className="px-5 py-4 whitespace-nowrap align-top">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs uppercase tracking-wider font-medium ${priorityBadge}`}>
                          {incident.priorytet}
                        </span>
                      </td>

                      {/* SLA */}
                      <td className="px-5 py-4 whitespace-nowrap align-top">
                        {incident.sla ? (
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold border ${incident.sla.uiBadgeClass}`}>
                            {incident.sla.isBreached && <AlertTriangle className="size-3 shrink-0 text-destructive" />}
                            {incident.sla.isPaused && <Clock className="size-3 shrink-0 text-amber-500" />}
                            <span>{incident.sla.label}</span>
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground font-mono">-</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4 whitespace-nowrap align-top">
                        <StatusPill
                          label={formatIncidentStatus(incident.status)}
                          tone={getIncidentStatusTone(incident.status)}
                        />
                      </td>

                      {/* Brygada */}
                      <td className="px-5 py-4 whitespace-nowrap align-top">
                        {incident.zespol_name ? (
                          <div className="flex items-center gap-1.5 text-xs text-foreground font-medium">
                            <Wrench className="size-3.5 text-primary shrink-0" />
                            <span>{incident.zespol_name}</span>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setCrewDialogState({ id: incident.id, crewId: incident.zespol_id })}
                            className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-500 hover:underline font-medium cursor-pointer"
                          >
                            <Wrench className="size-3 shrink-0" />
                            <span>Przydziel brygadę</span>
                          </button>
                        )}
                      </td>

                      {/* Data zgłoszenia */}
                      <td className="px-5 py-4 whitespace-nowrap align-top text-xs text-muted-foreground">
                        {formatDate(incident.created_at, "dd.MM.yyyy HH:mm")}
                      </td>

                      {/* Akcje */}
                      <td className="px-5 py-4 whitespace-nowrap align-top text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger className="size-8 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer">
                            <MoreHorizontal size={16} />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
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
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
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
