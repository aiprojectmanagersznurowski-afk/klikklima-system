import React from "react"
import { prisma } from "@repo/database"
import { can } from "@klikklima/contracts"
import { getCurrentActorRole, createClient } from "../../../../utils/supabase/server"
import {
  setAvailabilityRuleAction as setAuditorAvailabilityRuleAction,
  getAvailabilityAction as getAuditorAvailabilityAction,
} from "../../auditors/actions"
import {
  setAvailabilityRuleAction as setCrewAvailabilityRuleAction,
  getAvailabilityAction as getCrewAvailabilityAction,
} from "../../crews/actions"
import type { AvailabilityRuleInput } from "../../../../lib/schedule/availability-rule-schema"
import type { EffectiveAvailabilityDay } from "../../../../lib/schedule/effective-availability"
import { ScheduleClient } from "./schedule-client"

/**
 * FLD-AVAIL-WEEKLY-RULES (WO, blok C, AC-C1/AC-C3): trasa samoobsługowa
 * `/me/schedule` — DECYZJA MICHAŁA (2026-09-10), nie pod `/auditors/[id]` ani
 * `/crews/[id]` (te trasy to kartoteki dla admina/dyspozytora). Server Component
 * ustala WŁASNY rekord pracownika (po e-mailu z sesji, wzorem
 * `setAvailabilityRuleAction`/`setSelfAvailabilityAction`) i przekazuje do klienta
 * WYŁĄCZNIE dane grafiku — zero pól kadrowych/blokady konta pracownika (AC-C4).
 *
 * Dostęp mają wyłącznie role z `availability_rules:update` DLA SIEBIE — `audytor` i
 * `monter` (wariant `:own`). `admin` ma `update` bez `:own`, ale nie ma własnego
 * rekordu audytora/ekipy do edycji — ten ekran jest samoobsługowy, nie kartoteką, więc
 * dla `admin`/`dyspozytor` (i braku własnego rekordu) pokazujemy komunikat po polsku,
 * nie `notFound()` (AC-C6 dotyczy błędów Server Action, ale ten sam duch: brak pustego
 * ekranu / zrzutu wyjątku).
 */
export default async function MyScheduleScreen() {
  let actorRole: Awaited<ReturnType<typeof getCurrentActorRole>> = null
  try {
    actorRole = await getCurrentActorRole()
  } catch (error) {
    console.error("Failed to resolve actor role:", error)
  }

  if (actorRole !== "audytor" && actorRole !== "monter") {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">
          Ten ekran jest dostępny wyłącznie dla audytorów i monterów zarządzających własnym grafikiem.
        </p>
      </div>
    )
  }

  if (can(actorRole, "availability_rules", "update") !== "own") {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Brak uprawnień do edycji własnego grafiku.</p>
      </div>
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.email) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Brak sesji użytkownika.</p>
      </div>
    )
  }

  const ownId =
    actorRole === "audytor"
      ? await resolveOwnAuditorId(user.email)
      : await resolveOwnCrewId(user.email)

  if (!ownId) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">
          Nie znaleziono Twojej kartoteki — skontaktuj się z administratorem.
        </p>
      </div>
    )
  }

  const from = new Date()
  const to = new Date(from)
  to.setUTCDate(to.getUTCDate() + 6)

  const availability =
    actorRole === "audytor"
      ? await getAuditorAvailabilityAction(ownId, from, to)
      : await getCrewAvailabilityAction(ownId, from, to)

  const initialDays: EffectiveAvailabilityDay[] = availability.success && availability.days ? availability.days : []

  async function onSave(values: AvailabilityRuleInput) {
    "use server"
    if (actorRole === "audytor") {
      return setAuditorAvailabilityRuleAction(ownId as string, values)
    }
    return setCrewAvailabilityRuleAction(ownId as string, values)
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-semibold text-foreground">Mój grafik</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Cykliczna dostępność tygodniowa — nie steruje aktywnością konta ani urlopem.
        </p>
      </div>

      {availability.error && (
        <p role="alert" className="text-sm text-destructive font-medium">
          {availability.error}
        </p>
      )}

      <ScheduleClient initialDays={initialDays} onSave={onSave} />
    </div>
  )
}

async function resolveOwnAuditorId(email: string): Promise<string | null> {
  const matches = await prisma.audytorzy.findMany({ where: { email }, take: 2 })
  return matches.length === 1 ? matches[0].id : null
}

async function resolveOwnCrewId(email: string): Promise<string | null> {
  const matches = await prisma.zespoly_monterskie.findMany({ where: { email }, take: 2 })
  return matches.length === 1 ? matches[0].id : null
}
