"use client"

import React, { useState, useEffect } from "react"
import { Wrench, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  assignIncidentCrewAction,
  getIncidentFormDataAction,
  type IncidentCrewOption,
} from "./actions"

export function AssignCrewDialog({
  isOpen,
  incidentId,
  currentCrewId,
  onClose,
  onSuccess,
}: {
  isOpen: boolean
  incidentId: string | null
  currentCrewId?: string | null
  onClose: () => void
  onSuccess: () => void
}) {
  const [crews, setCrews] = useState<IncidentCrewOption[]>([])
  const [selectedCrewId, setSelectedCrewId] = useState<string>(currentCrewId || "")
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && incidentId) {
      setSelectedCrewId(currentCrewId || "")
      setIsLoading(true)
      getIncidentFormDataAction()
        .then((data) => {
          setCrews(data.crews)
        })
        .catch((err) => {
          console.error("Failed to load crews:", err)
        })
        .finally(() => {
          setIsLoading(false)
        })
    }
  }, [isOpen, incidentId, currentCrewId])

  if (!isOpen || !incidentId) return null

  const handleSave = async () => {
    setIsSubmitting(true)
    setError(null)
    try {
      const res = await assignIncidentCrewAction(incidentId, selectedCrewId ? selectedCrewId : null)
      if (!res.success) {
        setError(res.error || "Nie udało się przypisać serwisu.")
        return
      }
      onSuccess()
    } catch (err) {
      console.error("Assign crew error:", err)
      setError("Wystąpił błąd podczas zapisywania.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-md rounded-2xl border border-border shadow-xl overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Wrench className="size-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">Przydział Ekipy Serwisowej</h2>
              <p className="text-xs text-muted-foreground">Wybierz brygadę do usunięcia awarii</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary flex items-center justify-center transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Zespół Montersko-Serwisowy
            </label>
            <select
              value={selectedCrewId}
              onChange={(e) => setSelectedCrewId(e.target.value)}
              disabled={isLoading || isSubmitting}
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">-- Brak przydziału (Do dyspozycji) --</option>
              {crews.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-4 border-t border-border bg-secondary/20 flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={isSubmitting} className="rounded-xl">
            Anuluj
          </Button>
          <Button size="sm" onClick={handleSave} disabled={isSubmitting} className="rounded-xl font-semibold">
            {isSubmitting ? "Zapisywanie..." : "Zapisz Przydział"}
          </Button>
        </div>
      </div>
    </div>
  )
}
