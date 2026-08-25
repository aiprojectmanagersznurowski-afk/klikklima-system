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

export type UpdateCrewAvatarResult = { success: boolean; error?: string };

/**
 * CRM-CREW-UPDATE-ADMIN-ONLY: aktualizacja zdjęcia ekipy wyłącznie dla admina —
 * rola pochodzi z sesji serwera (`getCurrentActorRole()`), nigdy z argumentu
 * wywołania (Prisma omija RLS, klient mógłby podać dowolną rolę wprost z
 * przeglądarki). Wzorem `deleteAuditorAction`/`toggleAuditorActiveAction`.
 */
export async function updateCrewAvatar(crewId: string, path: string): Promise<UpdateCrewAvatarResult> {
  try {
    const actorRole = await getCurrentActorRole();
    if (!actorRole || can(actorRole, 'crews', 'update') !== 'yes') {
      return { success: false, error: "Brak uprawnień do zmiany zdjęcia ekipy." };
    }

    await prisma.zespoly_monterskie.update({
      where: { id: crewId },
      data: { zdjecie_url: path }
    });
    revalidatePath('/crews');
    return { success: true };
  } catch (error) {
    console.error("Failed to update crew avatar:", error);
    return { success: false, error: "Wystąpił błąd podczas zapisu zdjęcia ekipy." };
  }
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

export type AcceptLegalDocumentVersionResult = {
  success: boolean;
  error?: string;
  id?: string;
  acceptedAt?: Date;
};

/**
 * FLD-CONSENT-ACCEPT (WO FLD-CONSENT-DOCS): ekipa akceptuje WŁASNĄ, konkretną
 * wersję dokumentu prawnego wskazaną wprost przez `versionId` — symetrycznie do
 * auditors/actions.ts. Rola i właścicielstwo rekordu idą przez sesję (e-mail),
 * nigdy przez argument wywołania. Rejestr jest append-only: brak sprawdzenia
 * "czy już istnieje" przed insertem — ochronę przed duplikatem daje wyłącznie
 * ograniczenie unikalności w bazie.
 */
export async function acceptLegalDocumentVersionAction(
  versionId: string
): Promise<AcceptLegalDocumentVersionResult> {
  const actorRole = await getCurrentActorRole();
  if (actorRole !== 'monter' || can(actorRole, 'employee_consents', 'create') !== 'yes') {
    return { success: false, error: "Brak uprawnień do akceptacji dokumentu." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return { success: false, error: "Brak sesji użytkownika." };
  }

  const own = await prisma.zespoly_monterskie.findUnique({ where: { email: user.email } });
  if (!own) {
    return { success: false, error: "Nie znaleziono własnego rekordu ekipy." };
  }

  try {
    const consent = await prisma.employeeConsent.create({
      data: { crewId: own.id, versionId },
    });
    return { success: true, id: consent.id, acceptedAt: consent.acceptedAt };
  } catch (error) {
    return { success: false, error: "Nie udało się zapisać akceptacji dokumentu." };
  }
}

export type DeleteCrewResult = {
  success: boolean;
  error?: string;
  blockingInstallations?: { id: string; status: string }[];
};

/**
 * Statusy instalacji, które blokują usunięcie ekipy (D-DELETE-POLICIES,
 * strategy: BLOCK_UNTIL_REASSIGNED). `InstallationStatus` jest enumem Prisma
 * (schema.prisma), nie eksportem @klikklima/contracts — kontrakt obejmuje
 * maszynę stanów lejka/SLA/RBAC/powiadomienia, nie każdy enum bazy.
 */
const BLOCKING_INSTALLATION_STATUSES = ["PLANNED", "IN_PROGRESS"] as const;

/**
 * CRM-DELETE-ADMIN-ONLY (crews): usuwa ekipę, o ile nie ma przy niej
 * blokujących instalacji (PLANNED/IN_PROGRESS). Sprawdzenie roli
 * (PERMISSIONS.crews.delete = ['admin']) i sprawdzenie blokujących instalacji
 * muszą żyć w JEDNEJ transakcji Prisma z samym DELETE — przepięcie ostatniej
 * instalacji i usunięcie ekipy zlecone równolegle nie mogą się zazębić.
 * Wzorem `deleteAuditorAction` (auditors/actions.ts).
 */
export async function deleteCrewAction(id: string): Promise<DeleteCrewResult> {
  try {
    const actorRole = await getCurrentActorRole();
    if (!actorRole || can(actorRole, 'crews', 'delete') !== 'yes') {
      return { success: false, error: "Brak uprawnień do usunięcia ekipy." };
    }

    const result = await prisma.$transaction(async (tx) => {
      const crew = await tx.zespoly_monterskie.findUnique({
        where: { id },
        include: { instalacje: true },
      });

      if (!crew) {
        return { success: false, error: "Ekipa nie została znaleziona." };
      }

      const blockingInstallations = crew.instalacje.filter((installation: { status: string | null }) =>
        BLOCKING_INSTALLATION_STATUSES.includes(installation.status as (typeof BLOCKING_INSTALLATION_STATUSES)[number])
      );

      if (blockingInstallations.length > 0) {
        return {
          success: false,
          error: "Nie można usunąć ekipy — ma przypisane aktywne instalacje. Przepnij je najpierw na inną ekipę.",
          blockingInstallations: blockingInstallations.map((installation: { id: string; status: string | null }) => ({
            id: installation.id,
            status: installation.status ?? '',
          })),
        };
      }

      await tx.zespoly_monterskie.delete({ where: { id } });
      return { success: true };
    });

    if (result.success) {
      revalidatePath('/crews');
    }

    return result;
  } catch (error) {
    console.error("Failed to delete crew:", error);
    return { success: false, error: "Wystąpił błąd podczas usuwania ekipy." };
  }
}
