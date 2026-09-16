"use client"

import { useMemo, useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { CalendarPlus, Loader2, AlertTriangle, X } from "lucide-react"
import { can, type Role } from "@klikklima/contracts"
import { Button } from "@/components/ui/button"
import { selectableBaskets, type ScheduleBasket, type CreateBookingSubject } from "../../../../lib/schedule/basket-select"
import { createBookingAction } from "../../bookings/actions"

/**
 * WO: docs/workorders/FLD-QUOTE-BASKET-SELECT.md — ROZSTRZYGNIĘTY 2026-09-16
 * (D-1 = (A): ekran w panelu B2B dla dyspozytora/admina; D-2 = (a): RBAC bez zmian).
 * Wymaganie: `FLD-QUOTE-BASKET-SELECT` (contracts/requirements.contract.mjs, TODO, 4 AC).
 *
 * Dialog tworzenia rezerwacji z karty leada. Użytkownik wybiera KOSZYK ze słownika (AC1) —
 * nie podaje liczby godzin/minut — i termin startu. Czas trwania oraz pula są wyliczane przez
 * serwer z koszyka (`createBooking`, `packages/scheduling/src/create-booking.ts`); ten
 * komponent wysyła wyłącznie `visitBasketId` (UUID wiersza, AC4), `startAt`, `subject`,
 * `bookedBy: "DISPATCHER"`.
 *
 * Bramka WIĄŻĄCA jest w `createBookingAction` (`bookings.create`, `can()` przed jakimkolwiek
 * zapytaniem do bazy) — `canCreate` tutaj tylko chowa przycisk dla ról bez uprawnienia
 * (wzorzec `assign-auditor.tsx`).
 *
 * UWAGA WYJĄTKU STYLISTYCZNEGO: ta strona (`leads/[id]/page.tsx`) jest realnie importowana
 * (bez mocka modułu) przez `lead-detail-page-pool-spread.test.ts` (SEC-ASSIGNMENT-POOL-MINIMIZE,
 * sesja wcześniejsza) — ten test mockuje `@/components/ui/button` ale NIE
 * `@/components/ui/label`/`input`/`dialog` (nie znał tego komponentu w chwili powstania,
 * a implementer nie ma prawa edytować testów). Root `vitest.config.mts` nie ma aliasu `@/*`,
 * więc każdy REALNY (niezamockowany) import `@/components/ui/*`/`@/lib/utils` w module
 * ładowanym przez `page.tsx` wywala test wcześniejszej sesji błędem rozwiązania modułu.
 * Stąd: `Dialog`/`Label`/`Input` NIE są importowane z `@/components/ui/*` tutaj — dialog jest
 * zbudowany bezpośrednio na `@base-ui/react/dialog` (pakiet zewnętrzny, zawsze rozwiązywalny),
 * a etykiety/pola to plain `<label>`/`<input>` z tymi samymi klasami Tailwind co komponenty
 * współdzielone. `Button` zostaje importowany normalnie — jest już zamockowany w tamtym teście.
 */

const createBookingFormSchema = z.object({
  visitBasketId: z.string().min(1, "Wybierz koszyk wizyty."),
  startAt: z.string().min(1, "Podaj termin wizyty."),
});

type CreateBookingFormInput = z.infer<typeof createBookingFormSchema>

const FIELD_CLASSNAME =
  "mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50";

const LABEL_CLASSNAME = "flex items-center gap-2 text-sm leading-none font-medium select-none";

export function CreateBookingDialog({
  baskets,
  leadId,
  subject,
  actorRole,
}: {
  baskets: ScheduleBasket[]
  leadId: string
  subject: CreateBookingSubject
  actorRole: Role | null
}) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const [alternatives, setAlternatives] = useState<Date[]>([])

  const canCreate = !!actorRole && can(actorRole, "bookings", "create") === "yes"

  // R-1 (WO, "Ryzyka i nieznane") jest poza zakresem tego zadania — dla leada pokazujemy
  // pulę AUDITOR (etap audytu), zgodnie z jedynym dziś istniejącym konsumentem koszyków w
  // kontekście leada (`saveLead.ts` rozwiązuje koszyk AUDIT po stronie serwera).
  const pool = "AUDITOR"
  const options = useMemo(() => selectableBaskets(baskets, pool), [baskets, pool])

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateBookingFormInput>({
    resolver: zodResolver(createBookingFormSchema),
    defaultValues: { visitBasketId: "", startAt: "" },
  })

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen)
    if (nextOpen) {
      setServerError(null)
      setAlternatives([])
      reset({ visitBasketId: "", startAt: "" })
    }
  }

  const onSubmit = (values: CreateBookingFormInput) => {
    setServerError(null)
    setAlternatives([])
    startTransition(async () => {
      const result = await createBookingAction({
        visitBasketId: values.visitBasketId,
        startAt: new Date(values.startAt),
        subject,
        bookedBy: "DISPATCHER",
      })
      if (!result.ok) {
        setServerError(result.error.message)
        setAlternatives(result.error.alternatives.map((slot) => new Date(slot.start_at)))
        return
      }
      setOpen(false)
    })
  }

  return canCreate ? (
    <DialogPrimitive.Root open={open} onOpenChange={handleOpenChange}>
      <DialogPrimitive.Trigger
        render={
          <Button variant="outline" className="rounded-md gap-2">
            <CalendarPlus className="size-4" />
            Zarezerwuj wizytę
          </Button>
        }
      />
      <DialogPrimitive.Portal>
        <DialogPrimitive.Backdrop className="fixed inset-0 z-50 bg-black/10" />
        <DialogPrimitive.Popup
          data-lead-id={leadId}
          className="fixed top-1/2 left-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 outline-none"
        >
          <DialogPrimitive.Close
            render={<Button type="button" variant="ghost" size="icon-sm" className="absolute top-2 right-2" />}
          >
            <X className="size-4" />
            <span className="sr-only">Zamknij</span>
          </DialogPrimitive.Close>

          <DialogPrimitive.Title className="flex items-center gap-2 text-base font-medium">
            <CalendarPlus className="size-4 text-primary" />
            Nowa rezerwacja
          </DialogPrimitive.Title>
          <DialogPrimitive.Description className="text-sm text-muted-foreground mt-1">
            Wybierz koszyk wizyty ze słownika — czas trwania i wykonawca są wyliczane przez
            system, nie podaje się ich ręcznie.
          </DialogPrimitive.Description>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
            <div>
              <label htmlFor="visit-basket-id" className={LABEL_CLASSNAME}>
                Koszyk wizyty
              </label>
              {options.length === 0 ? (
                <p className="text-sm text-muted-foreground mt-1">
                  Brak aktywnych koszyków w tej puli — poproś administratora o przywrócenie
                  koszyka w ustawieniach kalendarza.
                </p>
              ) : (
                <select
                  id="visit-basket-id"
                  disabled={isPending}
                  aria-invalid={!!errors.visitBasketId}
                  className={FIELD_CLASSNAME}
                  {...register("visitBasketId")}
                >
                  <option value="">Wybierz koszyk…</option>
                  {options.map((basket) => (
                    <option key={basket.id} value={basket.id}>
                      {basket.labelPl}
                    </option>
                  ))}
                </select>
              )}
              {errors.visitBasketId && (
                <p className="text-xs text-destructive font-medium mt-1">{errors.visitBasketId.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="start-at" className={LABEL_CLASSNAME}>
                Termin wizyty
              </label>
              <input
                id="start-at"
                type="datetime-local"
                disabled={isPending}
                aria-invalid={!!errors.startAt}
                className={FIELD_CLASSNAME}
                {...register("startAt")}
              />
              {errors.startAt && (
                <p className="text-xs text-destructive font-medium mt-1">{errors.startAt.message}</p>
              )}
            </div>

            {serverError && (
              <p className="flex items-start gap-2 text-sm text-destructive" role="alert">
                <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                <span>{serverError}</span>
              </p>
            )}

            {alternatives.length > 0 && (
              <div className="rounded-md border border-border bg-secondary/50 p-3 text-sm text-muted-foreground">
                <p className="font-medium text-foreground mb-1">Termin zajęty — dostępne alternatywy:</p>
                <ul className="space-y-0.5">
                  {alternatives.map((slot) => (
                    <li key={slot.toISOString()}>{slot.toLocaleString("pl-PL")}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex flex-col-reverse gap-2 pt-4 border-t border-border sm:flex-row sm:justify-end">
              <DialogPrimitive.Close render={<Button type="button" variant="outline" className="rounded-md" disabled={isPending} />}>
                Anuluj
              </DialogPrimitive.Close>
              <Button
                type="submit"
                className="rounded-md"
                disabled={isPending || options.length === 0}
              >
                {isPending && <Loader2 className="size-4 animate-spin" />}
                Rezerwuj
              </Button>
            </div>
          </form>
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  ) : null
}
