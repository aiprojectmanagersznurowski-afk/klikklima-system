import { z } from "zod"

/**
 * FLD-AVAIL-WEEKLY-RULES (AC-A5, AC-A6 aplikacja): schemat współdzielony przez
 * `setAvailabilityRuleAction` w auditors/actions.ts i crews/actions.ts (symetrycznie).
 * `weekday` musi być liczbą całkowitą 1-7 (ISO-8601, EXTRACT(ISODOW) w bazie).
 * `end_time` musi być późniejszy niż `start_time` — walidacja aplikacyjna jest wygodą,
 * ostateczną gwarancją porządku czasu jest CHECK `availability_rules_time_order_check`
 * w bazie (dowiedzione na atrapie w AC-A6 baza).
 *
 * Nieznane klucze (np. wstrzyknięte `is_active`/`aktywny`/`leave_status` na rekordzie
 * pracownika) są domyślnie odrzucane przez zod poza zdefiniowanym kształtem obiektu —
 * ta akcja nigdy nie dotyka encji pracownika, tylko tabeli `availability_rules`.
 */
const timeString = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Niepoprawny format godziny (oczekiwano GG:MM).")

export const availabilityRuleSchema = z
  .object({
    weekday: z.number().int("Dzień tygodnia musi być liczbą całkowitą.").min(1, "Dzień tygodnia musi być w zakresie 1-7.").max(7, "Dzień tygodnia musi być w zakresie 1-7."),
    start_time: timeString,
    end_time: timeString,
    is_active: z.boolean().optional().default(true),
  })
  .refine((values) => values.end_time > values.start_time, {
    message: "Godzina końca musi być późniejsza niż godzina początku.",
    path: ["end_time"],
  })

export type AvailabilityRuleInput = z.infer<typeof availabilityRuleSchema>
