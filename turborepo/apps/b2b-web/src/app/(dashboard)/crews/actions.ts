"use server"

import { prisma } from "@repo/database"
import { revalidatePath } from "next/cache"
import { can } from "@klikklima/contracts"
import { getCurrentActorRole, createClient } from "../../../utils/supabase/server"

export type CrewSummary = {
  id: string;
  nazwa: string;
  telefon_kontaktowy: string | null;
  koordynator_imie_nazwisko: string | null;
  certyfikat_fgaz: string | null;
  uprawnienia_sep: boolean;
  promien_dzialania_km: number | null;
  liczba_brygad: number;
  aktywny: boolean;
  installationsCount: number;
  zdjecie_url: string | null;
}

export async function getCrews(): Promise<CrewSummary[]> {
  const crews = await prisma.zespoly_monterskie.findMany({
    include: {
      instalacje: {
        where: {
          status: 'COMPLETED'
        }
      }
    },
    orderBy: {
      nazwa: 'asc'
    }
  });

  return crews.map(c => ({
    id: c.id,
    nazwa: c.nazwa,
    telefon_kontaktowy: c.telefon_kontaktowy,
    koordynator_imie_nazwisko: c.koordynator_imie_nazwisko,
    certyfikat_fgaz: c.certyfikat_fgaz,
    uprawnienia_sep: c.uprawnienia_sep,
    promien_dzialania_km: c.promien_dzialania_km,
    liczba_brygad: c.liczba_brygad,
    aktywny: c.aktywny,
    installationsCount: c.instalacje.length,
    zdjecie_url: c.zdjecie_url
  }));
}

export async function updateCrewAvatar(crewId: string, path: string) {
  await prisma.zespoly_monterskie.update({
    where: { id: crewId },
    data: { zdjecie_url: path }
  });
  revalidatePath('/crews');
}

export type SetSelfAvailabilityResult = { success: boolean; error?: string; isAvailable?: boolean };

/**
 * FLD-AVAIL-SELF / FLD-AVAIL-RESTORE (WO FLD-AVAILABILITY-SPLIT, D-A, R3): ekipa
 * deklaruje WŁASNĄ dostępność operacyjną — symetrycznie do
 * auditors/actions.ts setSelfAvailabilityAction. Rozłączna z `aktywny` (blokada
 * administratora) i z `leave_status` (kadrowe). Zasób RBAC to
 * `availability_declarations`; `crews.update` zostaje wyłącznie ['admin'], więc ta
 * akcja NIGDY nie wywołuje `prisma.zespoly_monterskie.update`.
 *
 * `can()` przy wariancie `:own` NIE sprawdza właścicielstwa rekordu — robi to ta
 * akcja: identyfikacja "czyj to rekord" idzie przez e-mail z sesji, a znalezione
 * WŁASNE `id` (nie argument `id`) trafia do zapisu.
 */
export async function setSelfAvailabilityAction(
  id: string,
  isAvailable: boolean
): Promise<SetSelfAvailabilityResult> {
  const actorRole = await getCurrentActorRole();
  // MAJOR (REVIEW #1, rls-security-auditor): `availability_declarations` jest jednym
  // zasobem RBAC dla DWÓCH encji (audytorzy + zespoly_monterskie) — `can() !== 'no'`
  // przepuszcza tu też 'audytor', bo macierz nie rozróżnia plików. Wiązanie roli z
  // encją musi więc żyć w kodzie akcji, nie w `can()`.
  if (actorRole !== 'monter' || can(actorRole, 'availability_declarations', 'update') !== 'own') {
    return { success: false, error: "Brak uprawnień do zmiany własnej dostępności." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return { success: false, error: "Brak sesji użytkownika." };
  }

  const own = await prisma.zespoly_monterskie.findUnique({ where: { email: user.email } });
  if (!own || own.id !== id) {
    return { success: false, error: "Nie można zmienić dostępności innej ekipy." };
  }

  const declaration = await prisma.availabilityDeclaration.upsert({
    where: { crewId: own.id },
    create: { crewId: own.id, isAvailable },
    update: { isAvailable },
  });

  revalidatePath('/crews');
  return { success: true, isAvailable: declaration.isAvailable };
}

export async function deleteCrewAction(id: string) {
  await prisma.zespoly_monterskie.delete({
    where: { id }
  });
  revalidatePath('/crews');
}
