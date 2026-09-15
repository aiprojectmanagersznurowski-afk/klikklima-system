import { findAvailableSlots, type AvailableSlot } from "./available-slots"

/**
 * CAL-POOL-AGGREGATE (docs/workorders/CAL-POOL-AGGREGATE.md). Czysty, deterministyczny
 * przekład wyniku per-pracownik `findAvailableSlots` na widok per-pula, zanonimizowany:
 * bez `resource_id`, bez `resource_kind`. Czysta funkcja domenowa — BEZ sprawdzania roli,
 * BEZ dotykania Prismy, BEZ żadnej gwarancji rezerwowalności zwróconych slotów (nośnikiem
 * tej gwarancji jest `bookings_no_overlap_per_resource`, FLD-BOOKING-ATOMIC-ASSIGN).
 */

export type PoolSlotsResult = {
  slots: AvailableSlot[]
  duration_minutes: number
  travel_buffer_minutes: number
  error: string | null
}

export async function findPoolSlots(
  visitBasketId: string,
  dateRange: { from: Date; to: Date },
  options?: { limit?: number },
  now?: Date,
): Promise<PoolSlotsResult> {
  const limit = options?.limit
  if (limit !== undefined && (!Number.isInteger(limit) || limit < 0)) {
    throw new Error(`Parametr "limit" musi być nieujemną liczbą całkowitą, otrzymano: ${limit}.`)
  }

  const result = await findAvailableSlots(visitBasketId, dateRange, now)

  const flattened: AvailableSlot[] = []
  for (const resource of result.resources) {
    flattened.push(...resource.slots)
  }
  flattened.sort((a, b) => a.start_at.getTime() - b.start_at.getTime())

  const seen = new Set<number>()
  const slots: AvailableSlot[] = []
  for (const slot of flattened) {
    const key = slot.start_at.getTime()
    if (seen.has(key)) continue
    seen.add(key)
    slots.push({ start_at: slot.start_at, end_at: slot.end_at, date: slot.date })
  }

  const limited = limit === undefined ? slots : slots.slice(0, limit)

  return {
    slots: limited,
    duration_minutes: result.duration_minutes,
    travel_buffer_minutes: result.travel_buffer_minutes,
    error: result.error,
  }
}
