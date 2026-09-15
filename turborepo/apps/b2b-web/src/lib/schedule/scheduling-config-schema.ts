import { z } from "zod";

/**
 * WO: docs/workorders/CAL-SCHEDULING-CONFIG-UI.md.
 * CAL-VISIT-DURATION-BASKETS (AC7): minuty, liczba całkowita. Dolna granica (`positive()`)
 * odpowiada `CHECK (duration_minutes > 0)` z bazy. Górna granica `.max(960)` jest sanity
 * (P-2, świadomie nierozstrzygnięta dalej), nie ograniczeniem kontraktowym.
 * Lista pól jest zamknięta i jawna — `pool`, `code`, `id`, `labelPl`, `sortOrder` przemycone
 * w tym samym żądaniu są odrzucane przez `z.object` (domyślnie usuwa nieznane klucze).
 */
export const updateVisitDurationBasketSchema = z
  .object({
    durationMinutes: z.number().int().positive().max(960).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((data) => data.durationMinutes !== undefined || data.isActive !== undefined, {
    message: "Co najmniej jedno pole (durationMinutes albo isActive) musi być podane.",
  });

export type UpdateVisitDurationBasketInput = z.infer<typeof updateVisitDurationBasketSchema>;

/**
 * CAL-TRAVEL-BUFFER (AC1): `min(0)` — `parseTravelBufferMinutes` (packages/scheduling)
 * odrzuca wartości ujemne, ale `0` jest legalną wartością ("bez bufora"). Asymetria z
 * koszykami (gdzie `0` jest niedozwolone) jest zamierzona — patrz WO, przypadek brzegowy 6.
 * Górna granica `.max(240)` jest sanity (P-2), nie ograniczeniem kontraktowym.
 */
export const updateTravelBufferSchema = z.object({
  travelBufferMinutes: z.number().int().min(0).max(240),
});

export type UpdateTravelBufferInput = z.infer<typeof updateTravelBufferSchema>;
