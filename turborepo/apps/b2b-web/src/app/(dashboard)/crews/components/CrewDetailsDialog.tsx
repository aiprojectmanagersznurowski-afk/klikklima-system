"use client"

import React, { useState, useEffect } from "react"
import { 
  Users, 
  MapPin, 
  ShieldCheck, 
  FileCheck, 
  Clock, 
  Phone, 
  Mail, 
  X,
  ExternalLink,
  CheckCircle2,
  Wrench,
  AlertTriangle
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/format-date"
import { formatDisplayId } from "@/lib/format-id"
import { EMPTY_VALUE } from "@/lib/empty-value"
import { getCrewDetailsAction, type CrewDetailsData } from "../actions"
import Link from "next/link"

export function CrewDetailsDialog({
  crewId,
  open,
  onClose,
}: {
  crewId: string | null
  open: boolean
  onClose: () => void
}) {
  const [data, setData] = useState<CrewDetailsData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<"scheduled" | "completed">("scheduled")

  useEffect(() => {
    if (!open || !crewId) {
      setData(null)
      setError(null)
      return
    }

    setLoading(true)
    setError(null)

    getCrewDetailsAction(crewId)
      .then((res) => {
        if (!res.success) {
          setError(res.error)
        } else {
          setData(res.data)
        }
      })
      .catch(() => {
        setError("Wystąpił błąd podczas ładowania danych ekipy monterskiej.")
      })
      .finally(() => {
        setLoading(false)
      })
  }, [open, crewId])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-3xl rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 border-b border-border flex items-start justify-between bg-muted/30">
          <div className="flex items-center gap-4">
            <div className="size-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
              <Users className="size-7 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-bold text-foreground">
                  {data?.crew.nazwa || "Szczegóły Ekipy"}
                </h2>
                {data?.crew.crew_number && (
                  <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                    {data.crew.crew_number}
                  </span>
                )}
                {data?.crew && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      data.crew.aktywny
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-destructive/15 text-destructive border border-destructive/25"
                    }`}
                  >
                    {data.crew.aktywny ? "Aktywna" : "Nieaktywna"}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1.5">
                {data?.crew.koordynator_imie_nazwisko && (
                  <span className="font-medium text-foreground">
                    Koordynator: {data.crew.koordynator_imie_nazwisko}
                  </span>
                )}
                {data?.crew.telefon_kontaktowy && (
                  <span className="flex items-center gap-1">
                    <Phone className="size-3.5" />
                    <span>{data.crew.telefon_kontaktowy}</span>
                  </span>
                )}
                {data?.crew.email && (
                  <span className="flex items-center gap-1">
                    <Mail className="size-3.5" />
                    <span>{data.crew.email}</span>
                  </span>
                )}
                {data?.crew.promien_dzialania_km && (
                  <span className="flex items-center gap-1">
                    <MapPin className="size-3.5" />
                    <span>
                      Obszar: {data.crew.promien_dzialania_km} km
                      {data.crew.kod_pocztowy_bazowy ? ` (Baza: ${data.crew.kod_pocztowy_bazowy})` : ""}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="size-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-20 text-center text-muted-foreground">
              <span className="inline-block size-6 border-2 border-primary border-t-transparent rounded-full animate-spin mb-3"></span>
              <p className="text-sm">Ładowanie profilu i grafiku prac ekipy...</p>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          ) : data ? (
            <>
              {/* Badges / Competencies */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 rounded-xl border border-border bg-background flex items-center gap-3">
                  <ShieldCheck className="size-5 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Certyfikat F-GAZ</p>
                    <p className="text-sm font-semibold text-foreground">
                      {data.crew.certyfikat_fgaz || "Brak"}
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-border bg-background flex items-center gap-3">
                  <FileCheck className="size-5 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Uprawnienia SEP</p>
                    <p className="text-sm font-semibold text-foreground">
                      {data.crew.uprawnienia_sep ? "Tak (1 kV)" : "Brak"}
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl border border-border bg-background flex items-center gap-3">
                  <Wrench className="size-5 text-primary shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground font-medium">Liczba brygad / NIP</p>
                    <p className="text-sm font-semibold text-foreground">
                      Brygady: {data.crew.liczba_brygad || 1} {data.crew.nip ? `• NIP: ${data.crew.nip}` : ""}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tabs for Works */}
              <div>
                <div className="flex border-b border-border mb-4">
                  <button
                    type="button"
                    onClick={() => setActiveTab("scheduled")}
                    className={`pb-2.5 px-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
                      activeTab === "scheduled"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Clock className="size-4" />
                    <span>Zaplanowane prace ({data.scheduledWorks.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab("completed")}
                    className={`pb-2.5 px-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 cursor-pointer ${
                      activeTab === "completed"
                        ? "border-primary text-primary"
                        : "border-transparent text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <CheckCircle2 className="size-4" />
                    <span>Wykonane montaże i naprawy ({data.completedWorks.length})</span>
                  </button>
                </div>

                {activeTab === "scheduled" ? (
                  data.scheduledWorks.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground text-sm bg-muted/20 rounded-xl border border-border/50">
                      Brak zaplanowanych prac przypisanych do tej ekipy.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {data.scheduledWorks.map((work) => (
                        <div
                          key={work.id}
                          className="p-4 rounded-xl border border-border bg-background flex items-center justify-between"
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-foreground">
                                {formatDisplayId(work.business_number, work.id)}
                              </span>
                              {work.project_number && (
                                <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                  {work.project_number}
                                </span>
                              )}
                              <span className="text-sm font-medium text-foreground">
                                • {work.client_name}
                              </span>
                              {work.type === "INCIDENT" && (
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                  <AlertTriangle className="size-3" />
                                  Usterka
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {work.address && <span>{work.address}</span>}
                              {work.client_phone && <span>Tel: {work.client_phone}</span>}
                              {work.details && <span className="italic">{work.details}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-xs font-semibold text-foreground">
                                {work.date ? formatDate(work.date, "dd.MM.yyyy HH:mm") : EMPTY_VALUE}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Status: {work.status}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  data.completedWorks.length === 0 ? (
                    <div className="py-10 text-center text-muted-foreground text-sm bg-muted/20 rounded-xl border border-border/50">
                      Brak zrealizowanych prac w historii tej ekipy.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {data.completedWorks.map((work) => (
                        <div
                          key={work.id}
                          className="p-4 rounded-xl border border-border bg-background flex items-center justify-between"
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-sm text-foreground">
                                {formatDisplayId(work.business_number, work.id)}
                              </span>
                              {work.project_number && (
                                <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted text-muted-foreground">
                                  {work.project_number}
                                </span>
                              )}
                              <span className="text-sm font-medium text-foreground">
                                • {work.client_name}
                              </span>
                              {work.type === "INCIDENT" && (
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                  <AlertTriangle className="size-3" />
                                  Usterka
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              {work.address && <span>{work.address}</span>}
                              {work.details && <span className="italic">{work.details}</span>}
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-xs font-semibold text-foreground">
                                {work.date ? formatDate(work.date, "dd.MM.yyyy") : EMPTY_VALUE}
                              </p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Status: {work.status}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>
            </>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/20 flex justify-end">
          <Button variant="outline" onClick={onClose} className="rounded-xl">
            Zamknij
          </Button>
        </div>
      </div>
    </div>
  )
}
