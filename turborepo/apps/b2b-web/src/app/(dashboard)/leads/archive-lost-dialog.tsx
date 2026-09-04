"use client";

import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Archive, AlertTriangle, Loader2 } from "lucide-react";
import { LOST_REASONS, LOST_REASON_PL, lostReasonRequiresNote, AUDIT_REQUIREMENTS } from "@klikklima/contracts";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { archiveLostSchema, type ArchiveLostInput } from "@/lib/audit/archive-lost-schema";
import { archiveLost } from "./actions";

/**
 * CRM-ZIMNE-AC3: archiwizacja trwała (T16, QUOTE_REJECTED -> ARCHIVED_LOST).
 * Powód WYŁĄCZNIE ze słownika LOST_REASONS (zero wolnego tekstu) — D5. `OTHER`
 * wymaga niepustej notatki, wymuszone też w UI, nie tylko na serwerze.
 * ARCHIVED_LOST jest terminalny (AC4.4) — dialog ostrzega, że to nieodwracalne.
 *
 * SEC-AUDIT-LOG-MANUAL-STATUS: dokłada uzasadnienie i podstawę prawną (wzorzec
 * `DeleteJustificationDialog` — react-hook-form + zodResolver, `legalBasis` bez
 * preselekcji) do tego samego formularza — jeden mechanizm walidacji dla całego pliku.
 */
export function ArchiveLostDialog({
  leadId,
  open,
  onOpenChange,
  onSuccess,
}: {
  leadId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isValid },
  } = useForm<ArchiveLostInput>({
    resolver: zodResolver(archiveLostSchema),
    mode: "onChange",
    defaultValues: {
      reason: undefined,
      note: "",
      justification: "",
      legalBasis: undefined,
    },
  });

  const reason = watch("reason");
  const noteRequired = reason !== undefined && lostReasonRequiresNote(reason);

  useEffect(() => {
    if (open) {
      setError(null);
      reset({ reason: undefined, note: "", justification: "", legalBasis: undefined });
    }
  }, [open, reset]);

  const onSubmit = (values: ArchiveLostInput) => {
    setError(null);
    startTransition(async () => {
      const result = await archiveLost(leadId, values.reason, values.note?.trim() || undefined, {
        justification: values.justification,
        legalBasis: values.legalBasis,
      });
      if (!result.success) {
        setError(result.error ?? "Nie udało się zarchiwizować leada.");
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
            <Archive className="size-4 text-destructive" />
            Archiwizuj (Lost)
          </DialogTitle>
          <DialogDescription>
            Lead zostanie oznaczony jako trwale utracony i zniknie z domyślnego widoku zimnych leadów.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            <AlertTriangle className="size-4 shrink-0" />
            <span>Ta operacja jest nieodwracalna — po archiwizacji lead nie wraca do obiegu.</span>
          </div>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-foreground mb-1">Powód utraty</legend>
            {LOST_REASONS.map((id) => (
              <label
                key={id}
                className="flex items-center gap-2 rounded-md p-2 text-sm text-foreground hover:bg-secondary/50 cursor-pointer focus-within:ring-2 focus-within:ring-ring/50"
              >
                <input
                  type="radio"
                  value={id}
                  className="size-4 accent-primary"
                  {...register("reason")}
                />
                {LOST_REASON_PL[id]}
              </label>
            ))}
            {errors.reason && (
              <span className="text-xs text-destructive">Wybierz powód utraty.</span>
            )}
          </fieldset>

          <div className="flex flex-col gap-2">
            <Label htmlFor="lost-reason-note" className="text-sm font-medium">
              Notatka {noteRequired ? "(wymagana dla tego powodu)" : "(opcjonalna)"}
            </Label>
            <textarea
              id="lost-reason-note"
              rows={3}
              aria-invalid={!!errors.note}
              className="w-full rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-xs aria-invalid:border-destructive aria-invalid:ring-destructive/20"
              placeholder="Krótki opis powodu utraty..."
              {...register("note")}
            />
            {errors.note && (
              <span className="text-xs text-destructive">{errors.note.message}</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="archive-justification" className="text-sm font-medium">
              Uzasadnienie <span className="text-destructive">*</span>
            </Label>
            <textarea
              id="archive-justification"
              rows={3}
              placeholder="Min. 10 znaków, np. potwierdzenie od klienta, brak kontaktu mimo prób..."
              aria-invalid={!!errors.justification}
              className="w-full rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-xs aria-invalid:border-destructive aria-invalid:ring-destructive/20"
              {...register("justification")}
            />
            {errors.justification && (
              <span className="text-xs text-destructive">{errors.justification.message}</span>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="archive-legal-basis" className="text-sm font-medium">
              Podstawa prawna <span className="text-destructive">*</span>
            </Label>
            <select
              id="archive-legal-basis"
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

          <DialogFooter>
            <DialogClose render={<Button variant="outline" className="rounded-md" disabled={isPending} />}>
              Anuluj
            </DialogClose>
            <Button
              type="submit"
              variant="destructive"
              className="rounded-md"
              disabled={isPending || !isValid}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Archiwizuj trwale
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
