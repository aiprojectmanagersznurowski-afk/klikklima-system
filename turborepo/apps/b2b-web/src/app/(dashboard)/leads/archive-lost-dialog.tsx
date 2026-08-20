"use client";

import { useState, useTransition, useEffect } from "react";
import { Archive, AlertTriangle, Loader2 } from "lucide-react";
import { LOST_REASONS, LOST_REASON_PL, lostReasonRequiresNote, type LostReason } from "@klikklima/contracts";
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
import { archiveLost } from "./actions";

/**
 * CRM-ZIMNE-AC3: archiwizacja trwała (T16, QUOTE_REJECTED -> ARCHIVED_LOST).
 * Powód WYŁĄCZNIE ze słownika LOST_REASONS (zero wolnego tekstu) — D5. `OTHER`
 * wymaga niepustej notatki, wymuszone też w UI, nie tylko na serwerze.
 * ARCHIVED_LOST jest terminalny (AC4.4) — dialog ostrzega, że to nieodwracalne.
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
  const [reason, setReason] = useState<LostReason | "">("");
  const [note, setNote] = useState("");

  useEffect(() => {
    if (open) {
      setError(null);
      setReason("");
      setNote("");
    }
  }, [open]);

  const noteRequired = reason !== "" && lostReasonRequiresNote(reason);
  const noteMissing = noteRequired && note.trim().length === 0;
  const canSubmit = reason !== "" && !noteMissing;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setError(null);
    startTransition(async () => {
      const result = await archiveLost(leadId, reason, note.trim() || undefined);
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
                name="lost-reason"
                value={id}
                checked={reason === id}
                onChange={() => setReason(id)}
                className="size-4 accent-primary"
              />
              {LOST_REASON_PL[id]}
            </label>
          ))}
        </fieldset>

        <div className="flex flex-col gap-2">
          <Label htmlFor="lost-reason-note" className="text-sm font-medium">
            Notatka {noteRequired ? "(wymagana dla tego powodu)" : "(opcjonalna)"}
          </Label>
          <textarea
            id="lost-reason-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="w-full rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground p-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary shadow-xs"
            placeholder="Krótki opis powodu utraty..."
          />
          {noteMissing && (
            <span className="text-xs text-destructive">Ten powód wymaga notatki.</span>
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
            variant="destructive"
            className="rounded-md"
            disabled={isPending || !canSubmit}
            onClick={handleSubmit}
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Archiwizuj trwale
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
