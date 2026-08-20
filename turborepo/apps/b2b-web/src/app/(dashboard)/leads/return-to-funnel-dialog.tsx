"use client";

import { useState, useTransition, useEffect } from "react";
import { RotateCcw, AlertTriangle, Loader2 } from "lucide-react";
import { differenceInCalendarDays } from "date-fns";
import { SLA } from "@klikklima/contracts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { returnToFunnel } from "./actions";

/**
 * D2 (WO CRM-SAFE-RECORD-ACTIONS): "Zwróć do obiegu" dla leada w QUOTE_REJECTED.
 * Świeża wycena -> jedno kliknięcie, sukces od razu. Przeterminowana (albo
 * `quoted_at IS NULL`, fail-closed) -> dwie legalne ścieżki: potwierdź mimo starej
 * ceny, albo zaktualizuj cenę i wróć razem z nią. Guard żyje na serwerze —
 * ten dialog tylko prowadzi użytkownika przez decyzję (D2).
 *
 * Kontrolowany z zewnątrz (open/onOpenChange), bo jest otwierany z pozycji
 * DropdownMenuItem, nie z lokalnego DialogTrigger.
 */
export function ReturnToFunnelDialog({
  leadId,
  quotedAt,
  open,
  onOpenChange,
  onSuccess,
}: {
  leadId: string;
  quotedAt: Date | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newPrice, setNewPrice] = useState("");
  const [showStaleOptions, setShowStaleOptions] = useState(false);

  const quoteAgeDays = quotedAt ? differenceInCalendarDays(new Date(), new Date(quotedAt)) : null;
  const isKnownStale = quoteAgeDays !== null && quoteAgeDays > SLA.COLD_LEAD_REPRICE.days;
  const isUnknownAge = quoteAgeDays === null;
  const requiresDecision = showStaleOptions || isKnownStale || isUnknownAge;

  useEffect(() => {
    if (open) {
      setError(null);
      setShowStaleOptions(false);
      setNewPrice("");
    }
  }, [open]);

  const runReturn = (resolution?: "acknowledgeStaleQuote" | "refreshQuote", price?: number) => {
    setError(null);
    startTransition(async () => {
      const result = await returnToFunnel(leadId, resolution, price);
      if (!result.success) {
        if (!resolution) {
          // Serwer odrzucił próbę bez decyzji -> pokaż dwie legalne ścieżki wyjścia,
          // ale nie ukrywaj przyczyny odrzucenia (np. brak uprawnień, zły status leada) —
          // przyczyna może być inna niż przeterminowana wycena.
          setError(result.error ?? null);
          setShowStaleOptions(true);
          return;
        }
        setError(result.error ?? "Nie udało się zwrócić leada do obiegu.");
        return;
      }
      onOpenChange(false);
      onSuccess();
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="size-4 text-primary" />
            Zwróć do obiegu
          </DialogTitle>
          <DialogDescription>
            {isUnknownAge
              ? "Ten lead nie ma zapisanej daty wystawienia wyceny — traktujemy ją jako przeterminowaną."
              : `Aktualna wycena ma ${quoteAgeDays} ${quoteAgeDays === 1 ? "dzień" : "dni"} (próg odświeżenia: ${SLA.COLD_LEAD_REPRICE.days} dni).`}
          </DialogDescription>
        </DialogHeader>

        {!requiresDecision && (
          <p className="text-sm text-foreground">
            Wycena jest aktualna. Lead wróci do etapu „Wykonany audyt".
          </p>
        )}

        {requiresDecision && (
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-500">
              <AlertTriangle className="size-4 shrink-0" />
              <span>Wycena jest przeterminowana. Wybierz jedną z dwóch ścieżek powrotu.</span>
            </div>

            <div className="flex flex-col gap-2 rounded-md border border-border p-3">
              <Label htmlFor="new-price" className="text-sm font-medium">
                Zaktualizuj cenę (PLN)
              </Label>
              <Input
                id="new-price"
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={newPrice}
                onChange={(e) => setNewPrice(e.target.value)}
                placeholder="np. 18500"
                className="rounded-md"
              />
              <Button
                variant="default"
                className="rounded-md self-start"
                disabled={isPending || !newPrice}
                onClick={() => runReturn("refreshQuote", Number(newPrice))}
              >
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Zaktualizuj cenę i wróć do obiegu
              </Button>
            </div>

            <Button
              variant="outline"
              className="rounded-md self-start"
              disabled={isPending}
              onClick={() => runReturn("acknowledgeStaleQuote")}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Potwierdź mimo starej ceny
            </Button>
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
          {!requiresDecision && (
            <Button variant="default" className="rounded-md" disabled={isPending} onClick={() => runReturn()}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Zwróć do obiegu
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
