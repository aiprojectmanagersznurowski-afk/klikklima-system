import { z } from "zod";

const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

/**
 * Normalizuje string kwoty z formularza (zamienia przecinek na kropkę, usuwa białe znaki)
 * i sprawdza poprawność formatu walutowego (maks 2 miejsca po przecinku, >= 0).
 */
export const priceAmountSchema = z
  .union([z.string(), z.number()])
  .transform((val) => {
    if (typeof val === "number") {
      return val.toFixed(2);
    }
    return val.trim().replace(",", ".");
  })
  .refine((val) => AMOUNT_PATTERN.test(val), {
    message: "Kwota musi być liczbą nieujemną z maksymalnie 2 miejscami po przecinku.",
  });

export const optionalCrewCostSchema = z
  .union([z.string(), z.number(), z.null(), z.undefined()])
  .transform((val) => {
    if (val === null || val === undefined) return null;
    if (typeof val === "number") return val.toFixed(2);
    const trimmed = val.trim();
    if (trimmed === "") return null;
    return trimmed.replace(",", ".");
  })
  .refine((val) => val === null || AMOUNT_PATTERN.test(val), {
    message: "Koszt ekipy musi być liczbą nieujemną z maksymalnie 2 miejscami po przecinku lub pusty.",
  });

export const createPriceListItemSchema = z.object({
  name: z.string().trim().min(1, "Nazwa pozycji jest wymagana."),
  unit: z.enum(["mb", "szt", "m"], {
    errorMap: () => ({ message: "Jednostka musi być jedną z: mb, szt, m." }),
  }),
  scope: z.enum(["ROOM", "INSTALLATION"], {
    errorMap: () => ({ message: "Zasięg musi być: ROOM lub INSTALLATION." }),
  }),
  category: z.enum(["MATERIAL", "LABOR", "MATERIAL_LABOR"]).optional().nullable(),
  description: z.string().trim().optional().nullable(),
  salePriceNet: priceAmountSchema,
  crewCostNet: optionalCrewCostSchema.optional(),
});

export type CreatePriceListItemInput = z.infer<typeof createPriceListItemSchema>;

export const updatePriceSchema = z.object({
  itemId: z.string().min(1, "Identyfikator pozycji jest wymagany."),
  salePriceNet: priceAmountSchema,
  crewCostNet: optionalCrewCostSchema.optional(),
});

export type UpdatePriceInput = z.infer<typeof updatePriceSchema>;

export const togglePriceListItemActiveSchema = z.object({
  itemId: z.string().min(1, "Identyfikator pozycji jest wymagany."),
  isActive: z.boolean(),
});

export type TogglePriceListItemActiveInput = z.infer<typeof togglePriceListItemActiveSchema>;
