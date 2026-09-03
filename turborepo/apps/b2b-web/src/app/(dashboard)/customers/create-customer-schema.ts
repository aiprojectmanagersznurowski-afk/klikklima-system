import { z } from "zod";

/**
 * Schemat formularza "Dodaj klienta ręcznie" (`customers-client.tsx`, `zodResolver`)
 * oraz walidacja wejścia `createCustomerAction` (`actions.ts`). Jedno źródło prawdy
 * dla obu miejsc, żeby komunikaty błędów i reguły nie rozjechały się.
 *
 * `telefon` celowo bez regexu — polskie numery mają zbyt wiele wariantów zapisu
 * (spacje, prefiksy, myślniki), żaden inny formularz w repo nie waliduje formatu.
 * Tylko rozsądny limit długości jako zabezpieczenie przed nadużyciem pola.
 */
export const createCustomerSchema = z.object({
  imieINazwisko: z.string().trim().min(2, "Imię i nazwisko jest wymagane"),
  email: z
    .union([z.literal(""), z.string().trim().email("Nieprawidłowy adres e-mail")])
    .optional(),
  telefon: z.string().trim().max(30, "Numer telefonu jest za długi").optional(),
});

export type CreateCustomerFormValues = z.infer<typeof createCustomerSchema>;
