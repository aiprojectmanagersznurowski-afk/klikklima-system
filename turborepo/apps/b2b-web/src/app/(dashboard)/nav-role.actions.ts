"use server"

import type { Role } from "@klikklima/contracts"
import { getCurrentActorRole } from "../../utils/supabase/server"

/**
 * FLD-AVAIL-WEEKLY-RULES (WO, blok C, AC-C5): `layout.tsx` (sidebar nawigacji) jest
 * dziś client component (`useState`/`usePathname`/wylogowanie), więc nie może
 * bezpośrednio zaimportować `utils/supabase/server.ts` (używa `next/headers`, wyłącznie
 * serwerowe). Ten cienki Server Action jest jedynym mostem — zwraca WYŁĄCZNIE rolę
 * aktora (serializowalny string albo `null`), nigdy dane wrażliwe. Faktyczna bramka
 * widoczności (`isScheduleNavItemVisible`) jest wywoływana w `layout.tsx`, nie tutaj —
 * to jest tylko odczyt roli.
 */
export async function getActorRoleForNavAction(): Promise<Role | null> {
  try {
    return await getCurrentActorRole()
  } catch (error) {
    console.error("Failed to resolve actor role for navigation:", error)
    return null
  }
}
