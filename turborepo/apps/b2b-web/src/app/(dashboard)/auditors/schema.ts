import { z } from "zod"

/**
 * CRM-AUDYT-KARTOTEKA (D1, WO BATCH-MEDIUM-LOW-CLEANUP.md, punkty 1/5/6/7/8):
 * jeden schemat Zod, współdzielony przez modal (zodResolver) i przez
 * createAuditorAction/updateAuditorAction. Klucze to nazwy kolumn Prisma
 * (snake_case) — kontrakt cytuje je wprost, patrz auditors/actions.ts.
 *
 * Nieznane klucze (np. wstrzyknięte z zewnątrz `is_active`) są domyślnie
 * odrzucane przez zod (klucze poza `.object()` nie trafiają do wyniku
 * `safeParse`), więc pola administracyjne nigdy nie trafiają do payloadu
 * Prisma tą drogą.
 */

const optionalTrimmedString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === undefined || v === "" ? null : v))

const emptyToNullInt = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v === "" ? null : v))
  .pipe(z.coerce.number().int().nonnegative().nullable())

const emptyToNullDate = z
  .string()
  .optional()
  .transform((v) => (v === undefined || v === "" ? null : new Date(v)))
  .refine((d) => d === null || !Number.isNaN(d.getTime()), "Niepoprawna data.")

const preferowaneMarkiField = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (v === undefined || v === "") {
      return [] as string[]
    }
    try {
      const parsed = JSON.parse(v)
      if (!Array.isArray(parsed)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Niepoprawny format preferowanych marek (oczekiwano tablicy).",
        })
        return z.NEVER
      }
      return parsed
    } catch {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Niepoprawny format preferowanych marek (niepoprawny JSON).",
      })
      return z.NEVER
    }
  })
  .pipe(z.array(z.string().min(1)))

export const auditorSchema = z
  .object({
    imie_i_nazwisko: z.string().trim().min(1, "Imię i nazwisko jest wymagane."),
    telefon: optionalTrimmedString,
    email: z.union([z.literal(""), z.string().trim().email("Niepoprawny format e-mail.")]).transform((v) => (v === "" ? null : v)),
    adres: optionalTrimmedString,
    nazwa_firmy: optionalTrimmedString,
    nip: optionalTrimmedString,
    certyfikat_fgaz: optionalTrimmedString,
    fgaz_valid_until: emptyToNullDate,
    sep_valid_until: emptyToNullDate,
    doswiadczenie_hvac_lata: emptyToNullInt,
    uprawnienia_sep: z
      .union([z.boolean(), z.string()])
      .transform((v) => (typeof v === "boolean" ? v : v === "true")),
    preferowane_marki: preferowaneMarkiField,
    kod_pocztowy_bazowy: optionalTrimmedString,
    max_promien_dojazdu_km: emptyToNullInt,
    iban: optionalTrimmedString,
    zdjecie_url: optionalTrimmedString,
  })

export type AuditorFormInput = z.input<typeof auditorSchema>
export type AuditorFormOutput = z.output<typeof auditorSchema>
