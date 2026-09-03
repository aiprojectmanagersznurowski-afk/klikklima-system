import { z } from "zod"

/**
 * CRM-ZESP-KARTOTEKA (D1/D2, WO BATCH-MEDIUM-LOW-CLEANUP.md, punkty 1/5/6/7/8):
 * jeden schemat Zod, współdzielony przez modal (zodResolver) i przez
 * createCrewAction/updateCrewAction. Klucze to nazwy kolumn Prisma
 * (snake_case) zgodnie z tabelą `zespoly_monterskie` — D2 przepina FormData
 * z krótkich angielskich kluczy na te nazwy.
 *
 * Nieznane klucze (np. wstrzyknięte `is_active`, `leave_status`) są domyślnie
 * odrzucane przez zod (klucze poza `.object()` nie trafiają do wyniku
 * `safeParse`), więc pola administracyjne nigdy nie trafiają do payloadu
 * Prisma tą drogą.
 */

const optionalTrimmedString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === undefined || v === "" ? null : v))

// Nie istnieje w repo ani w dokumentacji architektury jednoznacznie zdefiniowany
// format numeru certyfikatu F-Gaz (różne formaty zależnie od okresu wydania
// i instytucji certyfikującej) — patrz docs/architecture/b2b_crm_specifications.md
// i database_model.md, które mówią wyłącznie o "numerze wpisu". Dlatego to NIE
// jest próba dokładnej walidacji formatu, tylko odsianie oczywistego szumu
// (np. "vdfg", "7a" widziane na produkcji): min. 3 znaki po trim i przynajmniej
// jedna cyfra. Realny, poprawny numer certyfikatu zawsze ma część cyfrową.
const optionalFgazCertificateString = optionalTrimmedString.refine(
  (v) => v === null || (v.length >= 3 && /\d/.test(v)),
  "Niepoprawny numer certyfikatu F-Gaz (min. 3 znaki, musi zawierać cyfrę).",
)

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

const boolFromString = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === "boolean" ? v : v === "true"))

export const crewSchema = z
  .object({
    nazwa: z.string().trim().min(1, "Nazwa ekipy jest wymagana."),
    telefon_kontaktowy: optionalTrimmedString,
    email: z.union([z.literal(""), z.string().trim().email("Niepoprawny format e-mail.")]).transform((v) => (v === "" ? null : v)),
    nip: optionalTrimmedString,
    koordynator_imie_nazwisko: optionalTrimmedString,
    certyfikat_fgaz: optionalFgazCertificateString,
    fgaz_valid_until: emptyToNullDate,
    sep_valid_until: emptyToNullDate,
    uprawnienia_sep: boolFromString,
    kod_pocztowy_bazowy: optionalTrimmedString,
    promien_dzialania_km: emptyToNullInt,
    // liczba_brygad jest NOT NULL @default(1) w schema.prisma — puste pole daje 1, nie null.
    liczba_brygad: z
      .string()
      .optional()
      .transform((v) => (v === undefined || v === "" ? 1 : v))
      .pipe(z.coerce.number().int().nonnegative()),
    posiada_wiertnice: boolFromString,
    iban: optionalTrimmedString,
    zdjecie_url: optionalTrimmedString,
  })

export type CrewFormInput = z.input<typeof crewSchema>
export type CrewFormOutput = z.output<typeof crewSchema>
