"use client"

import React, { useState } from "react"
import { CheckCircle2, Clock, PauseCircle, AlertCircle, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { updateIncidentStatusAction } from "./actions"

const STATUS_OPTIONS = [
  { value: "NOWE", label: "Nowe (Oczekuje na weryfikację)", desc: "Zgłoszenie zarejestrowane, brak podjętych działań" },
  { value: "W_TRAKCIE", label: "W trakcie realizacji", desc: "Serwisant podjął zlecenie lub jest w trakcie diagnozy" },
  { value: "OCZEKUJE_NA_CZESCI", label: "Oczekuje na części (SLA wstrzymane)", desc: "Wymaga zamówienia podzespołów u producenta" },
  { value: "ZAKONCZONE", label: "Zakończone / Naprawione", desc: "Usterka usunięta, protokół podpisany (wyśle N18)" },
  { value: "ANULOWANE", label: "Anulowane", desc: "Zgłoszenie bezpodstawne lub odrzucone" },
] as const

export function ChangeStatusDialog({
  isOpen,
  incidentId,
  currentStatus,
  onClose,
  onSuccess,
}: {
  isOpen: boolean
  incidentId: string | null
  currentStatus: string
  onClose: () => void
  onSuccess: () => void
}) {
  const [selectedStatus, setSelectedStatus] = useState<string>(currentStatus)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen || !incidentId) return null

  const handleSave = async () => {
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await updateIncidentStatusAction(
        incidentId,
        selectedStatus as "NOWE" | "W_TRAKCIE" | "OCZEKUJE_NA_CZESCI" | "ZAKONCZONE" | "ANULOWANE"
      )
      if (!res.success) {
        setError(res.error || "Nie udało się zaktualizować statusu.")
        return
      }
      onSuccess()
    } catch (err) {
      console.error("Change status error:", err)
      setError("Wystąpił błąd podczas zmiany statusu.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-base font-bold text-foreground">Zmień Status Zgłoszenia</h2>
            <p className="text-xs text-muted-foreground">Aktualny etap usuwania usterki</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center justify-center transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-xs">
              {error}
            </div>
          )}

          <div className="space-y-2">
            {STATUS_OPTIONS.map((opt) => {
              const isSelected = selectedStatus === opt.value
              return (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setSelectedStatus(opt.value)}
                  className={`w-full p-3 rounded-xl border text-left transition-all flex flex-col gap-0.5 ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-2xs"
                      : "border-border bg-background hover:bg-secondary/60"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-foreground">{opt.label}</span>
                    {isSelected && <CheckCircle2 className="size-4 text-primary" />}
                  </div>
                  <span className="text-2xs text-muted-foreground">{opt.desc}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="p-4 border-t border-border bg-secondary/20 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting} className="rounded-xl">
            Anuluj
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSubmitting} className="rounded-xl font-semibold">
            {isSubmitting ? "Zapisywanie..." : "Zatwierdź Status"}
          </Button>
        </div>
      </div>
    </div>
  )
}
