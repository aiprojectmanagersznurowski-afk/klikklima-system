import { CalendarClock } from "lucide-react"
import { findBasketById, type ScheduleBasket } from "../../../../lib/schedule/basket-select"
import { formatDate } from "@/lib/format-date"

/**
 * WO: docs/workorders/FLD-QUOTE-BASKET-SELECT.md — ROZSTRZYGNIĘTY 2026-09-16
 * (dziura 2, contract-steward). AC1: wycena historyczna, która używa koszyka, musi dalej
 * poprawnie wyświetlać jego etykietę — nawet jeśli koszyk zostanie potem wycofany
 * (`isActive: false`) albo jego `labelPl` się zmieni. Etykieta NIE jest zapisywana na
 * rezerwacji — jest wyszukiwana w słowniku `baskets` w chwili renderowania przez
 * `findBasketById` (`lib/schedule/basket-select.ts`), które ignoruje `isActive`.
 */

export type LeadBookingRow = {
  id: string
  scheduledStart: Date
  basketId: string
}

export function LeadBookingsList({
  bookings,
  baskets,
}: {
  bookings: LeadBookingRow[]
  baskets: ScheduleBasket[]
}) {
  if (bookings.length === 0) {
    return (
      <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
        <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
          <CalendarClock className="size-4 text-muted-foreground" />
          Rezerwacje
        </h3>
        <p className="text-sm text-muted-foreground">Brak rezerwacji dla tego leada.</p>
      </div>
    )
  }

  return (
    <div className="bg-card p-6 rounded-2xl border border-border shadow-sm">
      <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
        <CalendarClock className="size-4 text-muted-foreground" />
        Rezerwacje
      </h3>
      <ul className="space-y-3">
        {bookings.map((booking) => {
          const basket = findBasketById(baskets, booking.basketId)
          return (
            <li key={booking.id} className="flex items-center justify-between gap-3 text-sm">
              <span className="text-muted-foreground">
                {formatDate(booking.scheduledStart, "dd.MM.yyyy HH:mm")}
              </span>
              <span className="font-medium text-foreground">
                {basket ? basket.labelPl : "Koszyk niedostępny"}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
