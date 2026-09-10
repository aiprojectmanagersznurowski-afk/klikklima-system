import { prisma } from "@repo/database"
import { fromZonedTime } from "date-fns-tz"

/**
 * FLD-AVAIL-WEEKLY-RULES (WO, blok B — odczyt efektywnej dostępności). Materializacja
 * reguł cyklicznych i wartości domyślnych na konkretne daty. Czysta funkcja BEZ
 * sprawdzania uprawnień — to robi warstwa Server Action (auditors/actions.ts,
 * crews/actions.ts), dokładnie jak `writeAvailabilityRuleRaw` w bloku A.
 *
 * AC-B8: reguły są zapisane jako czas LOKALNY (Europe/Warsaw) bez strefy — materializacja
 * na konkretną datę i zamiana na UTC idzie przez `date-fns-tz` (`fromZonedTime`), nigdy
 * przez własną arytmetykę offsetów (dzień zmiany czasu ma 23 albo 25 godzin).
 */
const TIME_ZONE = "Europe/Warsaw"

export type EffectiveAvailabilityDay = {
  date: string
  weekday: number
  available: boolean
  start_time: string | null
  end_time: string | null
  start_at: Date | null
  end_at: Date | null
  source: 'RULE' | 'RULE_INACTIVE' | 'DEFAULT' | 'NONE'
}

export type EffectiveAvailabilityResult = {
  days: EffectiveAvailabilityDay[]
  error: string | null
}

/**
 * AC-B7: mapowanie daty kalendarzowej na numer dnia tygodnia idzie przez ISO-8601
 * (poniedziałek=1 … niedziela=7, zgodnie z EXTRACT(ISODOW) w bazie), NIGDY przez
 * `Date.getDay()` (niedziela=0). Liczone na samej dacie kalendarzowej (południe UTC),
 * niezależnie od strefy czasowej materializacji godzin.
 */
function isoWeekday(dateStr: string): number {
  const jsDay = new Date(`${dateStr}T12:00:00.000Z`).getUTCDay()
  return jsDay === 0 ? 7 : jsDay
}

function formatDateUTC(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function nextDayUTC(date: Date): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + 1)
  return next
}

/**
 * Kolumny `@db.Time(6)` — Prisma Client zwraca `Date` zakotwiczone na epoce
 * `1970-01-01T` w UTC (konwencja sterownika dla typu TIME). Odczyt godziny/minuty
 * idzie więc przez gettery UTC, nie lokalne.
 */
function timeOfDayToHHMM(time: Date): string {
  const hh = String(time.getUTCHours()).padStart(2, '0')
  const mm = String(time.getUTCMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function materializeMoment(dateStr: string, hhmm: string): Date {
  return fromZonedTime(`${dateStr}T${hhmm}:00`, TIME_ZONE)
}

type SchedulingConfig = {
  default_workday_start: string
  default_workday_end: string
  default_weekdays: number[]
}

function parseSchedulingConfig(konfiguracja: unknown): SchedulingConfig | null {
  if (!konfiguracja || typeof konfiguracja !== 'object') {
    return null
  }
  const cfg = konfiguracja as Record<string, unknown>
  if (
    typeof cfg.default_workday_start !== 'string' ||
    typeof cfg.default_workday_end !== 'string' ||
    !Array.isArray(cfg.default_weekdays)
  ) {
    return null
  }
  return {
    default_workday_start: cfg.default_workday_start,
    default_workday_end: cfg.default_workday_end,
    default_weekdays: cfg.default_weekdays as number[],
  }
}

/**
 * AC-B4 (potwierdzone przez Michała 2026-09-10): fallback do wartości domyślnych jest
 * PER-PRACOWNIK, nie per-dzień. Pracownik z choćby jedną regułą NIE dostaje wartości
 * domyślnych na dni bez reguły — są dla niego dniami wolnymi. Fallback do
 * `scheduling_config` uruchamia się WYŁĄCZNIE, gdy pracownik nie ma ŻADNEJ reguły
 * w ogóle (`rules.length === 0`).
 *
 * AC-B5: reguła z `is_active=false` to "brak dostępności" (source `RULE_INACTIVE`),
 * jawnie odróżniona od braku wiersza w ogóle (source `NONE`) — fallback się NIE
 * uruchamia dla wyłączonej reguły.
 *
 * AC-B6: brak wiersza `scheduling_config` (albo jego niepoprawny kształt) nie wywraca
 * odczytu — kontrolowany błąd domenowy w `error`, dni bez reguły traktowane jako `NONE`.
 *
 * AC-B10: jedno zapytanie `findMany`/`findUnique` na cały zakres dat, materializacja
 * w pamięci — brak N+1.
 */
export async function getEffectiveAvailability(
  resourceId: string,
  resourceKind: 'AUDITOR' | 'CREW',
  dateRange: { from: Date; to: Date },
): Promise<EffectiveAvailabilityResult> {
  const rules = await prisma.availabilityRule.findMany({
    where: resourceKind === 'AUDITOR' ? { auditorId: resourceId } : { crewId: resourceId },
  })

  const configRow = await prisma.system_config.findUnique({
    where: { typ_konfiguracji: 'scheduling_config' },
  })

  const hasAnyRule = rules.length > 0
  const rulesByWeekday = new Map<number, (typeof rules)[number]>()
  for (const rule of rules) {
    rulesByWeekday.set(rule.weekday, rule)
  }

  let error: string | null = null
  let defaults: SchedulingConfig | null = null

  if (!hasAnyRule) {
    defaults = parseSchedulingConfig(configRow?.konfiguracja)
    if (!defaults) {
      error = "Brak konfiguracji domyślnej dostępności (scheduling_config) — nie można wyliczyć grafiku."
    }
  }

  const days: EffectiveAvailabilityDay[] = []
  const rangeStart = new Date(Date.UTC(
    dateRange.from.getUTCFullYear(),
    dateRange.from.getUTCMonth(),
    dateRange.from.getUTCDate(),
  ))
  const rangeEnd = new Date(Date.UTC(
    dateRange.to.getUTCFullYear(),
    dateRange.to.getUTCMonth(),
    dateRange.to.getUTCDate(),
  ))

  for (let cursor = rangeStart; cursor.getTime() <= rangeEnd.getTime(); cursor = nextDayUTC(cursor)) {
    const dateStr = formatDateUTC(cursor)
    const weekday = isoWeekday(dateStr)
    const rule = rulesByWeekday.get(weekday)

    if (rule && rule.isActive) {
      const startTime = timeOfDayToHHMM(rule.startTime)
      const endTime = timeOfDayToHHMM(rule.endTime)
      days.push({
        date: dateStr,
        weekday,
        available: true,
        start_time: startTime,
        end_time: endTime,
        start_at: materializeMoment(dateStr, startTime),
        end_at: materializeMoment(dateStr, endTime),
        source: 'RULE',
      })
      continue
    }

    if (rule && !rule.isActive) {
      days.push({
        date: dateStr,
        weekday,
        available: false,
        start_time: null,
        end_time: null,
        start_at: null,
        end_at: null,
        source: 'RULE_INACTIVE',
      })
      continue
    }

    if (!hasAnyRule && defaults && defaults.default_weekdays.includes(weekday)) {
      days.push({
        date: dateStr,
        weekday,
        available: true,
        start_time: defaults.default_workday_start,
        end_time: defaults.default_workday_end,
        start_at: materializeMoment(dateStr, defaults.default_workday_start),
        end_at: materializeMoment(dateStr, defaults.default_workday_end),
        source: 'DEFAULT',
      })
      continue
    }

    days.push({
      date: dateStr,
      weekday,
      available: false,
      start_time: null,
      end_time: null,
      start_at: null,
      end_at: null,
      source: 'NONE',
    })
  }

  return { days, error }
}
