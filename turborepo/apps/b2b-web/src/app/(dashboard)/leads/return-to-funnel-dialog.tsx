"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { RotateCcw, AlertTriangle, Loader2 } from "lucide-react";
import { differenceInCalendarDays } from "date-fns";
import { SLA, AUDIT_REQUIREMENTS } from "@klikklima/contracts";
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
import { returnToFunnelSchema, type ReturnToFunnelFormInput } from "@/lib/audit/return-to-funnel-schema";
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
 *
 * SEC-AUDIT-LOG-MANUAL-STATUS: uzasadnienie i podstawa prawna żyją w tym samym
 * formularzu (react-hook-form + zodResolver, wzorzec `DeleteJustificationDialog`)
 * co pole biznesowe `newPrice` — `resolution` (którą z dwóch legalnych ścieżek
 * wybrano) pozostaje decyzją podjętą kliknięciem konkretnego przycisku, nie
 * osobnym polem formularza.
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
  const [showStaleOptions, setShowStaleOptions] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isValid },
  } = useForm<ReturnToFunnelFormInput>({
    resolver: zodResolver(returnToFunnelSchema),
    mode: "onChange",
    defaultValues: {
      newPrice: undefined,
      justification: "",
      legalBasis: undefined,
    },
  });

  const newPrice = watch("newPrice");

  const quoteAgeDays = quotedAt ? differenceInCalendarDays(new Date(), new Date(quotedAt)) : null;
  const isKnownStale = quoteAgeDays !== null && quoteAgeDays > SLA.COLD_LEAD_REPRICE.days;
  const isUnknownAge = quoteAgeDays === null;
  const requiresDecision = showStaleOptions || isKnownStale || isUnknownAge;

  useEffect(() => {
    if (open) {
      setError(null);
      setShowStaleOptions(false);
      reset({ newPrice: undefined, justification: "", legalBasis: undefined });
    }
  }, [open, reset]);

  const submitWith = (resolution?: "acknowledgeStaleQuote" | "refreshQuote") =>
    handleSubmit((values) => {
      setError(null);
      startTransition(async () => {
        const result = await returnToFunnel(
          leadId,
          resolution,
          resolution === "refreshQuote" ? values.newPrice : undefined,
          { justification: values.justification, legalBasis: values.legalBasis }
        );
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
    });

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

        <div className="flex flex-col gap-4">
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
                  placeholder="np. 18500"
                  className="rounded-md"
                  {...register("newPrice")}
                />
                <Button
                  type="button"
                  variant="default"
                  className="rounded-md self-start"
                  disabled={isPending || !newPrice}
                  onClick={submitWith("refreshQuote")}
                >
                  {isPending && <Loader2 className="size-4 animate-spin" />}
                  Zaktualizuj cenę i wróć do obiegu
                </Button>
              </div>

              <Button
                type="button"
                variant="outline"
                className="rounded-md self-start"
                disabled={isPending}
                onClick={submitWith("acknowledgeStaleQuote")}
              >
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Potwierdź mimo starej ceny
              </Button>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="return-justification" className="text-sm font-medium">
              Uzasadnienie <span className="text-destructive">*</span>
            </Label>
            <textarea
              id="return-justification"
              rows={3}
              placeholder="Min. 10 znaków, np. klient wznowił rozmowy, nowe ustalenia..."
              aria-invalid={!!errors.justification}
              className="w-full rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-xs aria-invalid:border-destructive aria-invalid:ring-destructive/20"
              {...register("justification")}
            />
            {errors.justification && (
              <span className="text-xs text-destructive">{errors.justification.message}</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="return-legal-basis" className="text-sm font-medium">
              Podstawa prawna <span className="text-destructive">*</span>
            </Label>
            <select
              id="return-legal-basis"
              defaultValue=""
              aria-invalid={!!errors.legalBasis}
              className="w-full rounded-md border border-input bg-background text-foreground p-2 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-primary aria-invalid:border-destructive aria-invalid:ring-destructive/20"
              {...register("legalBasis")}
            >
              <option value="" disabled>
                Wybierz podstawę prawną...
              </option>
              {AUDIT_REQUIREMENTS.legalBases.map((basis) => (
                <option key={basis} value={basis}>
                  {basis}
                </option>
              ))}
            </select>
            {errors.legalBasis && (
              <span className="text-xs text-destructive">{errors.legalBasis.message}</span>
            )}
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" className="rounded-md" disabled={isPending} />}>
            Anuluj
          </DialogClose>
          {!requiresDecision && (
            <Button
              type="button"
              variant="default"
              className="rounded-md"
              disabled={isPending || !isValid}
              onClick={submitWith(undefined)}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Zwróć do obiegu
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
