import { z } from "zod";
import { LOST_REASONS, lostReasonRequiresNote } from "@klikklima/contracts";
import { deleteJustificationSchema } from "./delete-justification-schema";

/**
 * SEC-AUDIT-LOG-MANUAL-STATUS: rozszerzenie `deleteJustificationSchema` o pola biznesowe
 * dialogu archiwizacji leada (CRM-ZIMNE-AC3 / D4-D5) — `reason` WYŁĄCZNIE ze słownika
 * `LOST_REASONS`, `note` wymagana warunkowo (`lostReasonRequiresNote`). `justification`
 * i `legalBasis` (próg 10 znaków, słownik podstaw prawnych) pochodzą z jednego,
 * współdzielonego miejsca zamiast kopii — ten sam precedens co `roleChangeSchema`.
 */
export const archiveLostSchema = deleteJustificationSchema
  .extend({
    reason: z.enum(LOST_REASONS),
    note: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (lostReasonRequiresNote(data.reason) && !data.note?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["note"],
        message: "Ten powód wymaga notatki.",
      });
    }
  });

export type ArchiveLostInput = z.infer<typeof archiveLostSchema>;
