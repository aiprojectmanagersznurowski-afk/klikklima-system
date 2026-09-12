"use client"

import React, { useState, useEffect } from "react"
import { AlertTriangle, Plus, Trash2, X, ShieldAlert } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  createIncidentAction,
  getIncidentFormDataAction,
  type IncidentClientOption,
} from "./actions"

export function CreateIncidentDialog({
  isOpen,
  onClose,
  onSuccess,
  preselectedClientId,
}: {
  isOpen: boolean
  onClose: () => void
  onSuccess: () => void
  preselectedClientId?: string | null
}) {
  const [clients, setClients] = useState<IncidentClientOption[]>([])
  const [isLoadingData, setIsLoadingData] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const [selectedClientId, setSelectedClientId] = useState(preselectedClientId || "")
  const [selectedInstallationId, setSelectedInstallationId] = useState("")
  const [selectedPriority, setSelectedPriority] = useState<"NISKI" | "ŚREDNI" | "WYSOKI" | "KRYTYCZNY">("NISKI")
  const [defectDescription, setDefectDescription] = useState("")
  const [photosList, setPhotosList] = useState<string[]>([])
  const [currentPhotoInput, setCurrentPhotoInput] = useState("")

  useEffect(() => {
    if (isOpen) {
      setIsLoadingData(true)
      getIncidentFormDataAction()
        .then((data) => {
          setClients(data.clients)
          if (preselectedClientId) {
            setSelectedClientId(preselectedClientId)
          }
        })
        .catch((err) => {
          console.error("Failed to load incident form data:", err)
        })
        .finally(() => {
          setIsLoadingData(false)
        })
    }
  }, [isOpen, preselectedClientId])

  if (!isOpen) return null

  const selectedClient = clients.find((c) => c.id === selectedClientId)
  const availableInstallations = selectedClient?.installations || []

  const handleAddPhoto = () => {
    if (currentPhotoInput.trim()) {
      setPhotosList([...photosList, currentPhotoInput.trim()])
      setCurrentPhotoInput("")
    }
  }

  const handleRemovePhoto = (index: number) => {
    setPhotosList(photosList.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitError(null)

    if (!selectedClientId) {
      setSubmitError("Wybierz klienta, którego dotyczy zgłoszenie.")
      return
    }

    if (defectDescription.trim().length < 5) {
      setSubmitError("Opis usterki musi zawierać przynajmniej 5 znaków.")
      return
    }

    setIsSubmitting(true)
    try {
      const result = await createIncidentAction({
        client_id: selectedClientId,
        installation_id: selectedInstallationId || null,
        priority: selectedPriority,
        description: defectDescription.trim(),
        photo_urls: photosList,
      })

      if (!result.success) {
        setSubmitError(result.error || "Wystąpił błąd podczas rejestracji usterki.")
        return
      }

      onSuccess()
    } catch (err) {
      console.error("Submit incident error:", err)
      setSubmitError("Wystąpił błąd sieciowy lub serwerowy.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-xl rounded-2xl border border-border shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border bg-card">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center border border-destructive/20">
              <AlertTriangle className="size-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Nowe Zgłoszenie Usterki</h2>
              <p className="text-xs text-muted-foreground">
                Rejestracja awarii lub usterki gwarancyjnej w systemie KlikKlima
              </p>
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

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {submitError && (
            <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-xl text-destructive text-sm flex items-start gap-2">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <span>{submitError}</span>
            </div>
          )}

          {/* Klient */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Klient *
            </label>
            <select
              value={selectedClientId}
              onChange={(e) => {
                setSelectedClientId(e.target.value)
                setSelectedInstallationId("")
              }}
              disabled={isLoadingData || isSubmitting}
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs"
            >
              <option value="">-- Wybierz klienta --</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Instalacja */}
          {selectedClient && availableInstallations.length > 0 && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                Dotyczy Instalacji (Opcjonalnie)
              </label>
              <select
                value={selectedInstallationId}
                onChange={(e) => setSelectedInstallationId(e.target.value)}
                disabled={isSubmitting}
                className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs"
              >
                <option value="">-- Dowolna / Ogólna --</option>
                {availableInstallations.map((inst) => (
                  <option key={inst.id} value={inst.id}>
                    {inst.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Priorytet */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Priorytet Zgłoszenia *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(["NISKI", "ŚREDNI", "WYSOKI", "KRYTYCZNY"] as const).map((p) => {
                const isSelected = selectedPriority === p
                let activeColor = "border-primary bg-primary/10 text-primary"
                if (p === "KRYTYCZNY") {
                  activeColor = "border-destructive bg-destructive/15 text-destructive font-bold"
                } else if (p === "WYSOKI") {
                  activeColor = "border-amber-500 bg-amber-500/15 text-amber-600 dark:text-amber-500 font-bold"
                }

                return (
                  <button
                    type="button"
                    key={p}
                    onClick={() => setSelectedPriority(p)}
                    className={`py-2 px-3 text-xs rounded-xl border transition-all text-center ${
                      isSelected
                        ? activeColor
                        : "border-border bg-background hover:bg-secondary text-muted-foreground"
                    }`}
                  >
                    {p}
                  </button>
                )
              })}
            </div>

            {selectedPriority === "KRYTYCZNY" && (
              <div className="mt-2.5 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive flex items-start gap-2">
                <ShieldAlert className="size-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Tryb Krytyczny (SLA 48h):</strong> Wyśle natychmiastowe powiadomienie PUSH
                  (I7) do dyspozytorów dyżurnych i uruchomi licznik czasu reakcji.
                </span>
              </div>
            )}
          </div>

          {/* Opis usterki */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Opis Usterki / Objawy *
            </label>
            <textarea
              rows={4}
              value={defectDescription}
              onChange={(e) => setDefectDescription(e.target.value)}
              placeholder="Dokładny opis awarii, kody błędów klimatyzatora (np. E1, F3), czy wycieka woda, czy urządzenie się włącza..."
              disabled={isSubmitting}
              className="w-full px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs resize-none"
            />
          </div>

          {/* Zdjęcia / Dokumentacja usterki */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
              Zdjęcia / Linki do dokumentacji (Opcjonalnie)
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                placeholder="https://... (URL zdjęcia lub wideo usterki)"
                value={currentPhotoInput}
                onChange={(e) => setCurrentPhotoInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault()
                    handleAddPhoto()
                  }
                }}
                disabled={isSubmitting}
                className="flex-1 px-3 py-2 text-sm rounded-xl border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary shadow-2xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddPhoto}
                disabled={!currentPhotoInput.trim() || isSubmitting}
                className="rounded-xl shrink-0"
              >
                <Plus className="size-4 mr-1" /> Dodaj
              </Button>
            </div>

            {photosList.length > 0 && (
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {photosList.map((url, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-secondary/40 border border-border/60 text-xs"
                  >
                    <span className="truncate max-w-[400px] text-foreground font-mono">{url}</span>
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      className="text-muted-foreground hover:text-destructive p-1"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-secondary/20 flex justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl"
          >
            Anuluj
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting || !selectedClientId || defectDescription.trim().length < 5}
            className="rounded-xl font-semibold bg-destructive hover:bg-destructive/90 text-destructive-foreground shadow-sm"
          >
            {isSubmitting ? "Zapisywanie..." : "Utwórz Zgłoszenie"}
          </Button>
        </div>
      </div>
    </div>
  )
}
