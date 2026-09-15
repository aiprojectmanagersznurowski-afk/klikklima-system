import { prisma } from "@repo/database"

export type WriteAvailabilityRuleParams = {
  auditorId: string | null
  crewId: string | null
  weekday: number
  startTime: string
  endTime: string
  isActive: boolean
}

export type AvailabilityRuleRow = {
  weekday: number
  start_time: string
  end_time: string
  is_active: boolean
}

/**
 * FLD-AVAIL-WEEKLY-RULES (WO, sekcja "Zmiana kontraktu"): `resource_id` w
 * `availability_rules` jest kolumną GENEROWANĄ (COALESCE(auditor_id, crew_id)),
 * niewidoczną dla modelu Prisma — `prisma.availabilityRule.upsert` nie ma celu
 * unikalności do rozstrzygnięcia konfliktu. Zapis idzie więc przez JEDNO zapytanie
 * raw z `ON CONFLICT (resource_id, weekday) DO UPDATE`, nie przez "sprawdź, potem
 * stwórz/zaktualizuj" w JS — ten wariant WO wprost odrzuca.
 *
 * Czysta funkcja BEZ walidacji: Zod (weekday 1-7, end_time > start_time) jest
 * odpowiedzialnością wywołującej Server Action, wykonywaną PRZED wywołaniem tej
 * funkcji. Ostateczną gwarancją porządku czasu jest CHECK
 * `availability_rules_time_order_check` w bazie — walidacja aplikacyjna to wygoda,
 * nie gwarancja.
 */
export async function writeAvailabilityRuleRaw(
  params: WriteAvailabilityRuleParams
): Promise<AvailabilityRuleRow> {
  const { auditorId, crewId, weekday, startTime, endTime, isActive } = params

  const rows = await prisma.$queryRaw<AvailabilityRuleRow[]>`
    INSERT INTO public.availability_rules (auditor_id, crew_id, weekday, start_time, end_time, is_active)
    VALUES (${auditorId}::uuid, ${crewId}::uuid, ${weekday}, ${startTime}, ${endTime}, ${isActive})
    ON CONFLICT (resource_id, weekday) DO UPDATE SET
      start_time = EXCLUDED.start_time,
      end_time = EXCLUDED.end_time,
      is_active = EXCLUDED.is_active,
      updated_at = timezone('utc', now())
    RETURNING weekday, start_time, end_time, is_active
  `

  return rows[0]
}
