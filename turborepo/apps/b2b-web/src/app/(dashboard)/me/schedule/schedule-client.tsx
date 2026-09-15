"use client"

import { useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Loader2, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { WEEKDAY_LABELS } from "../../../../lib/schedule/weekday-labels"
import { availabilityRuleSchema, type AvailabilityRuleInput, type EffectiveAvailabilityDay } from "@repo/scheduling"

/**
 * FLD-AVAIL-WEEKLY-RULES (WO, blok C): ekran własnego grafiku tygodniowego
 * (`/me/schedule`). Formularz jest JEDEN dla całego tygodnia (AC-C1: siedem dni
 * poniedziałek→niedziela w ustalonej kolejności etykiet dni), oparty o `react-hook-form` +
 * `zodResolver` na schemacie WSPÓLNYM z `setAvailabilityRuleAction`
 * (`availabilityRuleSchema`, AC-C2) — nie osobny, niezależny schemat. Żadne pole dnia
 * (godzina/przełącznik) nie jest trzymane przez `useState`.
 *
 * Wartości domyślne dnia bez zapisanej reguły (`source === 'DEFAULT'`, odczyt z bloku B)
 * są widoczne w formularzu, ale OZNACZONE odznaką "Domyślne" (AC-C3) — zapis (`onSave`)
 * jest wołany wyłącznie z `onSubmit`, nigdy przy montowaniu ekranu, więc samo
 * wyświetlenie wartości domyślnych nie tworzy żadnego wiersza w bazie.
 *
 * Zamierzone uproszczenie: jeden przycisk "Zapisz grafik" zapisuje wszystkie siedem dni
 * sekwencyjnie (siedem wywołań `setAvailabilityRuleAction`/`getAvailabilityAction`
 * odpowiednika przekazanego jako `onSave`). Blok A (Server Action) nadal pozwala zapisać
 * pojedynczy dzień niezależnie od tego ekranu — to jest wyłącznie decyzja UI, nie zmiana
 * kontraktu zapisu.
 */

type SaveResult = {
  success: boolean
  error?: string
  rule?: { weekday: number; start_time: string; end_time: string; is_active: boolean }
}

type WeekScheduleInput = { days: AvailabilityRuleInput[] }

const FALLBACK_START = "08:00"
const FALLBACK_END = "16:00"

function buildDefaultDay(weekday: number, day: EffectiveAvailabilityDay | undefined): AvailabilityRuleInput {
  if (!day) {
    return { weekday, start_time: FALLBACK_START, end_time: FALLBACK_END, is_active: false }
  }
  return {
    weekday,
    start_time: day.start_time ?? FALLBACK_START,
    end_time: day.end_time ?? FALLBACK_END,
    is_active: day.available,
  }
}

export function ScheduleClient({
  initialDays,
  onSave,
}: {
  initialDays: EffectiveAvailabilityDay[]
  onSave: (values: AvailabilityRuleInput) => Promise<SaveResult>
}) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  const daysByWeekday = new Map(initialDays.map((day) => [day.weekday, day]))

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WeekScheduleInput>({
    resolver: zodResolver(z.object({ days: z.array(availabilityRuleSchema).length(7) })),
    defaultValues: {
      days: WEEKDAY_LABELS.map(({ weekday }) => buildDefaultDay(weekday, daysByWeekday.get(weekday))),
    },
  })

  const onSubmit = async (values: WeekScheduleInput) => {
    setSubmitError(null)
    setSubmitSuccess(false)
    setIsSubmitting(true)
    try {
      for (const day of values.days) {
        const result = await onSave(day)
        if (!result.success) {
          setSubmitError(result.error ?? "Nie udało się zapisać grafiku.")
          setIsSubmitting(false)
          return
        }
      }
      setSubmitSuccess(true)
      setIsSubmitting(false)
    } catch (e) {
      setSubmitError("Błąd podczas zapisywania grafiku.")
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="w-full overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-xs uppercase font-semibold text-muted-foreground tracking-wider bg-secondary/50">
                <th className="p-3 text-left">Dzień</th>
                <th className="p-3 text-left">Godzina od</th>
                <th className="p-3 text-left">Godzina do</th>
                <th className="p-3 text-left">Dzień wolny</th>
              </tr>
            </thead>
            <tbody>
              {WEEKDAY_LABELS.map(({ weekday, label }, index) => {
                const sourceDay = daysByWeekday.get(weekday)
                const dayErrors = errors.days?.[index]

                return (
                  <tr key={weekday} className="border-t border-border">
                    <td className="p-3 align-top">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{label}</span>
                        {sourceDay?.source === "DEFAULT" && (
                          <Badge variant="secondary" className="rounded-full">
                            <Info className="size-3" />
                            Domyślne
                          </Badge>
                        )}
                      </div>
                      <input
                        type="hidden"
                        defaultValue={weekday}
                        {...register(`days.${index}.weekday`, { valueAsNumber: true })}
                      />
                    </td>
                    <td className="p-3 align-top">
                      <input
                        type="time"
                        aria-invalid={!!dayErrors?.start_time}
                        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-shadow aria-invalid:border-destructive aria-invalid:ring-destructive/20"
                        {...register(`days.${index}.start_time`)}
                      />
                      {dayErrors?.start_time && (
                        <p className="text-xs text-destructive font-medium mt-1">{dayErrors.start_time.message}</p>
                      )}
                    </td>
                    <td className="p-3 align-top">
                      <input
                        type="time"
                        aria-invalid={!!dayErrors?.end_time}
                        className="rounded-md border border-input bg-background px-2 py-1.5 text-sm shadow-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-shadow aria-invalid:border-destructive aria-invalid:ring-destructive/20"
                        {...register(`days.${index}.end_time`)}
                      />
                      {dayErrors?.end_time && (
                        <p className="text-xs text-destructive font-medium mt-1">{dayErrors.end_time.message}</p>
                      )}
                    </td>
                    <td className="p-3 align-top">
                      <Controller
                        control={control}
                        name={`days.${index}.is_active`}
                        render={({ field }) => (
                          <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                            <input
                              type="checkbox"
                              checked={!field.value}
                              onChange={(e) => field.onChange(!e.target.checked)}
                              className="size-4 rounded-md border border-input focus:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            />
                            Dzień wolny
                          </label>
                        )}
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {submitError && (
        <p role="alert" className="text-sm text-destructive font-medium">
          {submitError}
        </p>
      )}

      {submitSuccess && !submitError && (
        <p className="text-sm text-muted-foreground font-medium">Grafik został zapisany.</p>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting} className="rounded-md">
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          {isSubmitting ? "Zapisywanie..." : "Zapisz grafik"}
        </Button>
      </div>
    </form>
  )
}
