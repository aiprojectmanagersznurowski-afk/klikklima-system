"use client";

import { useState, useTransition, useEffect, useCallback } from "react";
import { Users, ShieldCheck, FileCheck, MapPin, Loader2, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { getCrews, assignCrewToLead } from "./actions";

type CrewItem = Awaited<ReturnType<typeof getCrews>>[number];

/**
 * E4-CREW-ASSIGNMENT-UI: Dialog wyboru ekipy monterskiej dla leada
 * w statusie AWAITING_CREW_ASSIGNMENT. Pobiera listę ekip z ważnymi
 * certyfikatami (filtrowaną po dacie montażu) i pozwala adminowi/dyspozytorowi
 * wybrać jedną z nich. Walidacja serwerowa (assignCrewToLead) stanowi
 * drugą barierę — certyfikat może wygasnąć między renderem a kliknięciem.
 *
 * Wymagania: FNL-E4-E5, CRM-ZESP-AC2 (UI layer).
 */
export function AssignCrewDialog({
  leadId,
  installationDate,
  open,
  onOpenChange,
  onSuccess,
}: {
  leadId: string;
  installationDate: Date | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [crews, setCrews] = useState<CrewItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedCrewId, setSelectedCrewId] = useState<string | null>(null);

  const loadCrews = useCallback(async () => {
    if (!installationDate) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await getCrews(installationDate);
      setCrews(result);
    } catch {
      setError("Nie udało się pobrać listy ekip.");
    } finally {
      setIsLoading(false);
    }
  }, [installationDate]);

  useEffect(() => {
    if (open) {
      setSelectedCrewId(null);
      setError(null);
      setCrews([]);
      loadCrews();
    }
  }, [open, loadCrews]);

  const handleSubmit = () => {
    if (!selectedCrewId) return;
    setError(null);
    startTransition(async () => {
      const result = await assignCrewToLead(leadId, selectedCrewId);
      if (!result.success) {
        setError(result.error ?? "Nie udało się przypisać ekipy.");
        // Odśwież listę — certyfikat mógł wygasnąć (przypadek brzegowy #2)
        loadCrews();
        setSelectedCrewId(null);
        return;
      }
      onOpenChange(false);
      onSuccess();
    });
  };

  const noInstallationDate = !installationDate;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="size-4 text-primary" />
            Przypisz ekipę monterską
          </DialogTitle>
          <DialogDescription>
            Wybierz ekipę z ważnymi certyfikatami F-Gaz i SEP na dzień montażu.
          </DialogDescription>
        </DialogHeader>

        {noInstallationDate ? (
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <span>
              Brak daty montażu (<code>data_rezerwacji</code>) — nie można
              zweryfikować certyfikatów. Klient musi najpierw wybrać termin
              instalacji.
            </span>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-primary" />
            <span className="ml-2 text-sm text-muted-foreground">Ładowanie dostępnych ekip…</span>
          </div>
        ) : crews.length === 0 ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20 p-3 text-sm text-amber-700 dark:text-amber-400">
            <AlertTriangle className="size-4 shrink-0 mt-0.5" />
            <span>
              Brak dostępnych ekip z ważnymi certyfikatami na dzień montażu.
              Sprawdź daty ważności certyfikatów w widoku Zespoły Monterskie.
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto pr-1">
            {crews.map((crew) => {
              const isSelected = selectedCrewId === crew.id;
              return (
                <button
                  key={crew.id}
                  type="button"
                  onClick={() => setSelectedCrewId(crew.id)}
                  className={`w-full text-left rounded-lg border p-3 transition-all cursor-pointer ${
                    isSelected
                      ? "border-primary bg-primary/5 ring-2 ring-primary/30 shadow-sm"
                      : "border-border hover:border-primary/40 hover:bg-secondary/30"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="font-semibold text-sm text-foreground">
                        {crew.nazwa}
                      </div>
                      {crew.koordynator_imie_nazwisko && (
                        <div className="text-xs text-muted-foreground mt-0.5">
                          Koordynator: {crew.koordynator_imie_nazwisko}
                        </div>
                      )}
                    </div>
                    {isSelected && (
                      <div className="size-5 rounded-full bg-primary flex items-center justify-center shrink-0 mt-0.5">
                        <svg className="size-3 text-primary-foreground" viewBox="0 0 12 12" fill="none">
                          <path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <ShieldCheck className="size-3.5 text-primary" />
                      <span>F-Gaz: {crew.certyfikat_fgaz || "—"}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <FileCheck className={`size-3.5 ${crew.uprawnienia_sep ? "text-primary" : "text-muted-foreground"}`} />
                      <span>SEP: {crew.uprawnienia_sep ? "Tak" : "Brak"}</span>
                    </div>
                    {crew.promien_dzialania_km && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3.5" />
                        <span>do {crew.promien_dzialania_km} km</span>
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" className="rounded-md" disabled={isPending} />}>
            Anuluj
          </DialogClose>
          <Button
            className="rounded-md"
            disabled={isPending || !selectedCrewId || noInstallationDate}
            onClick={handleSubmit}
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Przypisz ekipę
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
