/**
 * WO: docs/workorders/FLD-QUOTE-BASKET-SELECT.md — ROZSTRZYGNIĘTY 2026-09-16.
 * Wymaganie: `FLD-QUOTE-BASKET-SELECT` (contracts/requirements.contract.mjs, TODO, 4 AC).
 *
 * Moduł CZYSTEJ logiki domenowej dla ekranu tworzenia rezerwacji w panelu B2B (D-1 = (A),
 * D-2 = (a)): filtrowanie koszyków do wyboru (AC2/AC7), wyszukanie koszyka po ID niezależnie
 * od `isActive` dla widoku szczegółu (AC3) i budowa payloadu do `createBookingAction`
 * (AC1/AC4). Bez importów `react`/`@/components/*`, bez "use client"/"use server" — wzorzec
 * identyczny co `scheduling-config-schema.ts` (współdzielony przez klienta i serwer, ale tu
 * bez Zod, bo wejście jest już zwalidowanym słownikiem z bazy).
 *
 * `POOL_LABELS` przeniesione 1:1 z `settings/calendar/CalendarSettingsClient.tsx` — jedna
 * definicja współdzielona, nie duplikat (WO, "Kształt zmiany").
 */

export type ScheduleBasket = {
  id: string
  code: string
  labelPl: string
  pool: string
  durationMinutes: number
  isActive: boolean
  sortOrder: number
}

export const POOL_LABELS: Record<string, string> = {
  AUDITOR: "Audytor",
  CREW: "Ekipa",
}

export type CreateBookingSubject =
  | { kind: "LEAD"; leadId: string }
  | { kind: "SERVICE"; serviceId: string }
  | { kind: "INCIDENT"; incidentId: string }

/**
 * AC2 + AC7: koszyki DO WYBORU na ekranie tworzenia rezerwacji — wyłącznie aktywne, wyłącznie
 * z żądanej puli, w kolejności `sortOrder`. `settings/calendar` (konfiguracja) pokazuje
 * WSZYSTKIE koszyki (aktywne i wycofane) — to inna funkcja, nie ta.
 */
export function selectableBaskets(baskets: ScheduleBasket[], pool: string): ScheduleBasket[] {
  return baskets
    .filter((basket) => basket.isActive && basket.pool === pool)
    .sort((a, b) => a.sortOrder - b.sortOrder)
}

/**
 * AC3: widok szczegółu rezerwacji historycznej musi znaleźć koszyk PO ID niezależnie od
 * `isActive`. Zwraca `undefined`, jeśli nic nie odpowiada (`BASKET_NOT_FOUND` — poza zakresem
 * tej funkcji, obsługiwane już w `create-booking.ts`).
 */
export function findBasketById(baskets: ScheduleBasket[], id: string): ScheduleBasket | undefined {
  return baskets.find((basket) => basket.id === id)
}

/**
 * AC1 + AC4 + przypadek brzegowy 6 (strefa czasowa) + przypadek brzegowy 9 (przemycone pola):
 * jedyny legalny sposób budowy payloadu wysyłanego do `createBookingAction`. Obiekt jest
 * KONSTRUOWANY jawnie z dokładnie czterema kluczami — nigdy przez spread — więc dodatkowe pola
 * przemycone do wejścia (np. `durationMinutes`, `scheduledEnd`, `resourceId`, `pool`) nie mają
 * szansy przeciekać. `startAt` przechodzi przez identity — żaden `scheduledEnd` nie jest
 * liczony po stronie klienta.
 */
export function buildCreateBookingPayload(input: {
  visitBasketId: string
  startAt: Date
  subject: CreateBookingSubject
  bookedBy: "DISPATCHER"
}): { visitBasketId: string; startAt: Date; subject: CreateBookingSubject; bookedBy: "DISPATCHER" } {
  return {
    visitBasketId: input.visitBasketId,
    startAt: input.startAt,
    subject: input.subject,
    bookedBy: input.bookedBy,
  }
}
