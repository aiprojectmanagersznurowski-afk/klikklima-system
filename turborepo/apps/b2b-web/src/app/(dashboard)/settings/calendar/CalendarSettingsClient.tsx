"use client"

import { Fragment, useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2, Clock, Truck, AlertCircle } from "lucide-react"
import type { Role } from "@klikklima/contracts"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { StatusPill } from "@/components/ui/status-pill"
import {
  updateVisitDurationBasketSchema,
  updateTravelBufferSchema,
  type UpdateVisitDurationBasketInput,
  type UpdateTravelBufferInput,
} from "../../../../lib/schedule/scheduling-config-schema"
import { POOL_LABELS, type ScheduleBasket } from "../../../../lib/schedule/basket-select"
import { updateVisitDurationBasketAction, updateTravelBufferAction } from "./actions"

/**
 * WO: docs/workorders/CAL-SCHEDULING-CONFIG-UI.md.
 * Formularz sekcji "Kalendarz i wizyty": tabela koszyków czasu wizyty (CAL-VISIT-DURATION-BASKETS)
 * i bufor dojazdu (CAL-TRAVEL-BUFFER). Bramką WIĄŻĄCĄ jest Server Action (`actions.ts`) — ten
 * komponent tylko wyszarza kontrolki dla nie-admina (`actorRole`), zgodnie z ustaleniem WO
 * ("Kształt ekranu"). Schematy Zod są WSPÓLNE z Server Actions (`scheduling-config-schema.ts`),
 * ten sam wzorzec co `ScheduleClient` (`me/schedule/schedule-client.tsx`) — żadne pole liczbowe
 * ani przełącznik nie jest trzymane przez `useState` na pojedynczym polu.
 */

// Wyniesione do `apps/b2b-web/src/lib/schedule/basket-select.ts` (WO FLD-QUOTE-BASKET-SELECT,
// "Kształt zmiany") — re-eksport dla zgodności z dotychczasowymi importami tego modułu.
export type CalendarSettingsBasket = ScheduleBasket

export type CalendarSettingsClientProps = {
  baskets: CalendarSettingsBasket[]
  travelBufferMinutes: number | null
  actorRole: Role
}

/**
 * Podpowiedź wyliczana WYŁĄCZNIE z wpisanej liczby minut (WO, Sekcja 1) — nigdy ze słownika
 * etykiet trzymanego per `code`. `480`/`240` odpowiadają domyślnemu oknu pracy (8 h), nie są
 * progiem SLA i nie pochodzą z `contracts/sla.contract.mjs` (WO, wymagania, akapit 3).
 */
function formatDurationHint(minutes: number | undefined): string | null {
  if (minutes === undefined || Number.isNaN(minutes) || minutes <= 0) {
    return null
  }
  const hours = minutes / 60
  if (!Number.isInteger(hours)) {
    return `= ${hours.toFixed(1)} h`
  }
  if (hours === 8) {
    return "= cały dzień (8 h)"
  }
  if (hours === 4) {
    return "= pół dnia (4 h)"
  }
  return `= ${hours} ${hours === 1 ? "godzina" : "godziny"}`
}

type FeedbackState = { type: "error" | "success"; message: string } | null

function BasketRow({ basket, canEdit }: { basket: CalendarSettingsBasket; canEdit: boolean }) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState>(null)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isDirty },
  } = useForm<UpdateVisitDurationBasketInput>({
    resolver: zodResolver(updateVisitDurationBasketSchema),
    defaultValues: { durationMinutes: basket.durationMinutes, isActive: basket.isActive },
  })

  // Po odświeżeniu strony (Server Action -> revalidatePath) rodzic przekazuje świeże dane —
  // synchronizujemy formularz do stanu z bazy, żeby wiersz nie pokazywał wartości sprzed zapisu.
  useEffect(() => {
    reset({ durationMinutes: basket.durationMinutes, isActive: basket.isActive })
  }, [basket.durationMinutes, basket.isActive, reset])

  const watchedDuration = watch("durationMinutes")

  const onSubmit = async (values: UpdateVisitDurationBasketInput) => {
    setFeedback(null)
    setIsSubmitting(true)
    try {
      const result = await updateVisitDurationBasketAction(basket.id, values)
      if (!result.success) {
        setFeedback({ type: "error", message: result.error ?? "Nie udało się zapisać zmian koszyka." })
        // P-6 (WO, Sekcja 1): odmowa wyłączenia ostatniego aktywnego koszyka w puli musi być
        // WIDOCZNA, a przełącznik wraca do stanu włączony — nie zostaje cicho wyłączony.
        setValue("isActive", basket.isActive)
        return
      }
      setFeedback({ type: "success", message: "Zapisano." })
    } catch {
      setFeedback({ type: "error", message: "Nie udało się zapisać zmian koszyka." })
      setValue("isActive", basket.isActive)
    } finally {
      setIsSubmitting(false)
    }
  }

  const disabled = !canEdit || isSubmitting

  return (
    <tr className={`border-t border-border ${basket.isActive ? "" : "opacity-60"}`}>
      <td className="p-3 align-top font-mono text-xs text-muted-foreground">{basket.code}</td>
      <td className="p-3 align-top text-foreground">{basket.labelPl}</td>
      <td className="p-3 align-top">
        <StatusPill tone="info" label={POOL_LABELS[basket.pool] ?? basket.pool} />
      </td>
      <td className="p-3 align-top">
        <Label htmlFor={`duration-${basket.id}`} className="sr-only">
          Czas trwania (minuty) — {basket.labelPl}
        </Label>
        <Input
          id={`duration-${basket.id}`}
          type="number"
          min={1}
          max={960}
          step={1}
          disabled={disabled}
          aria-invalid={!!errors.durationMinutes}
          className="w-24"
          {...register("durationMinutes", { valueAsNumber: true })}
        />
        {errors.durationMinutes && (
          <p className="text-xs text-destructive font-medium mt-1">{errors.durationMinutes.message}</p>
        )}
        {!errors.durationMinutes && formatDurationHint(watchedDuration) && (
          <p className="text-xs text-muted-foreground mt-1">{formatDurationHint(watchedDuration)}</p>
        )}
      </td>
      <td className="p-3 align-top">
        <Label htmlFor={`active-${basket.id}`} className="flex items-center gap-2">
          <Switch
            id={`active-${basket.id}`}
            disabled={disabled}
            checked={watch("isActive")}
            onCheckedChange={(checked) => setValue("isActive", checked === true, { shouldDirty: true })}
          />
          <span className="text-xs text-muted-foreground">{watch("isActive") ? "Aktywny" : "Wycofany"}</span>
        </Label>
      </td>
      <td className="p-3 align-top">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="rounded-md"
          disabled={disabled || !isDirty}
          onClick={handleSubmit(onSubmit)}
        >
          {isSubmitting && <Loader2 className="size-3.5 animate-spin" />}
          {isSubmitting ? "Zapisywanie..." : "Zapisz"}
        </Button>
        {feedback && (
          <p
            role={feedback.type === "error" ? "alert" : undefined}
            className={`text-xs font-medium mt-1 ${
              feedback.type === "error" ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {feedback.message}
          </p>
        )}
      </td>
    </tr>
  )
}

function VisitDurationBasketsSection({
  baskets,
  canEdit,
}: {
  baskets: CalendarSettingsBasket[]
  canEdit: boolean
}) {
  const grouped = new Map<string, CalendarSettingsBasket[]>()
  for (const basket of baskets) {
    const list = grouped.get(basket.pool) ?? []
    list.push(basket)
    grouped.set(basket.pool, list)
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Clock className="size-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Czas trwania wizyty</h2>
      </div>

      {baskets.length === 0 ? (
        <p className="text-sm text-muted-foreground">Brak zdefiniowanych koszyków czasu wizyty.</p>
      ) : (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="w-full overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-xs uppercase font-semibold text-muted-foreground tracking-wider bg-secondary/50">
                  <th className="p-3 text-left">Kod</th>
                  <th className="p-3 text-left">Nazwa</th>
                  <th className="p-3 text-left">Pula</th>
                  <th className="p-3 text-left">Czas trwania (min)</th>
                  <th className="p-3 text-left">Aktywny</th>
                  <th className="p-3 text-left">Zapis</th>
                </tr>
              </thead>
              <tbody>
                {[...grouped.entries()].map(([pool, poolBaskets]) => (
                  <Fragment key={`group-${pool}`}>
                    <tr className="border-t border-border bg-secondary/20">
                      <td colSpan={6} className="p-2 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {POOL_LABELS[pool] ?? pool}
                      </td>
                    </tr>
                    {poolBaskets.map((basket) => (
                      <BasketRow key={basket.id} basket={basket} canEdit={canEdit} />
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!canEdit && (
        <p className="text-sm text-muted-foreground">
          Tylko administrator może edytować koszyki czasu wizyty.
        </p>
      )}
    </section>
  )
}

function TravelBufferSection({
  travelBufferMinutes,
  canEdit,
}: {
  travelBufferMinutes: number | null
  canEdit: boolean
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<UpdateTravelBufferInput>({
    resolver: zodResolver(updateTravelBufferSchema),
    defaultValues: { travelBufferMinutes: travelBufferMinutes ?? 0 },
  })

  useEffect(() => {
    reset({ travelBufferMinutes: travelBufferMinutes ?? 0 })
  }, [travelBufferMinutes, reset])

  const onSubmit = async (values: UpdateTravelBufferInput) => {
    setFeedback(null)
    setIsSubmitting(true)
    try {
      const result = await updateTravelBufferAction(values)
      if (!result.success) {
        setFeedback({ type: "error", message: result.error ?? "Nie udało się zapisać bufora dojazdu." })
        return
      }
      setFeedback({ type: "success", message: "Zapisano bufor dojazdu." })
    } catch {
      setFeedback({ type: "error", message: "Nie udało się zapisać bufora dojazdu." })
    } finally {
      setIsSubmitting(false)
    }
  }

  const disabled = !canEdit || isSubmitting

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <Truck className="size-5 text-muted-foreground" />
        <h2 className="text-lg font-semibold text-foreground">Bufor dojazdu</h2>
      </div>

      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <p className="text-sm text-muted-foreground">
          Bufor dotyczy dwóch wizyt tej samej osoby i wpływa wyłącznie na wyliczanie nowych
          terminów — istniejące rezerwacje nie są przeliczane.
        </p>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="travel-buffer-minutes">Bufor dojazdu (minuty)</Label>
            <Input
              id="travel-buffer-minutes"
              type="number"
              min={0}
              max={240}
              step={1}
              disabled={disabled}
              aria-invalid={!!errors.travelBufferMinutes}
              className="w-32 mt-1"
              {...register("travelBufferMinutes", { valueAsNumber: true })}
            />
          </div>
          <Button type="submit" disabled={disabled || !isDirty} className="rounded-md">
            {isSubmitting && <Loader2 className="size-4 animate-spin" />}
            {isSubmitting ? "Zapisywanie..." : "Zapisz bufor"}
          </Button>
        </form>

        {errors.travelBufferMinutes && (
          <p className="text-xs text-destructive font-medium">{errors.travelBufferMinutes.message}</p>
        )}

        {feedback && (
          <p
            role={feedback.type === "error" ? "alert" : undefined}
            className={`text-sm font-medium flex items-center gap-1.5 ${
              feedback.type === "error" ? "text-destructive" : "text-muted-foreground"
            }`}
          >
            {feedback.type === "error" && <AlertCircle className="size-4" />}
            {feedback.message}
          </p>
        )}

        {!canEdit && (
          <p className="text-sm text-muted-foreground">
            Tylko administrator może edytować bufor dojazdu.
          </p>
        )}
      </div>
    </section>
  )
}

export function CalendarSettingsClient({ baskets, travelBufferMinutes, actorRole }: CalendarSettingsClientProps) {
  const canEdit = actorRole === "admin"

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">Kalendarz i wizyty</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Parametry operacyjne kalendarza: czas trwania wizyt i bufor dojazdu między nimi.
        </p>
      </div>

      <VisitDurationBasketsSection baskets={baskets} canEdit={canEdit} />
      <TravelBufferSection travelBufferMinutes={travelBufferMinutes} canEdit={canEdit} />
    </div>
  )
}
