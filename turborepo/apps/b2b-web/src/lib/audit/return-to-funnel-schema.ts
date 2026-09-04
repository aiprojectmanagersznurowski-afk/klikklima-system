import { z } from "zod";
import { deleteJustificationSchema } from "./delete-justification-schema";

/**
 * SEC-AUDIT-LOG-MANUAL-STATUS: rozszerzenie `deleteJustificationSchema` o pole biznesowe
 * dialogu zwrotu leada do obiegu (D2, WO CRM-SAFE-RECORD-ACTIONS) — `newPrice` jest
 * opcjonalne na poziomie schematu, bo jest wymagane tylko na jednej z dwóch legalnych
 * ścieżek (`refreshQuote`); wymuszenie tego dla tej konkretnej ścieżki żyje w komponencie
 * (przycisk „Zaktualizuj cenę i wróć do obiegu" jest disabled dopóki `newPrice` jest puste),
 * tak samo jak w oryginalnym dialogu przed dodaniem pól audytowych.
 */
export const returnToFunnelSchema = deleteJustificationSchema.extend({
  newPrice: z.coerce.number().positive().optional(),
});

export type ReturnToFunnelFormInput = z.infer<typeof returnToFunnelSchema>;
