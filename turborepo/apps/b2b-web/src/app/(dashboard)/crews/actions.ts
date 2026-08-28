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

export type CreateCrewResult = { success: boolean; error?: string; id?: string };

// Ochrona przed podwójnym kliknięciem "Zapisz": jeśli ten sam obiekt FormData
// jest przekazany zanim poprzednie wywołanie się zakończyło, druga próba
// dołącza do tego samego w locie zapytania zamiast tworzyć drugi rekord.
const createCrewInFlight = new WeakMap<FormData, Promise<CreateCrewResult>>();

/**
 * CRM-ZESP-KARTOTEKA: tworzenie kartoteki zespołu montażowego z panelu B2B.
 * Bramka `can(role,'crews','create')==='yes'`, rola wyłącznie z sesji
 * (wzorem deleteCrewAction). 12 pól formularza — brak adresu z
 * autouzupełnianiem i brak preferowane_marki (różnica od audytora, tabela nie
 * ma tych kolumn). `liczba_brygad` jest NOT NULL @default(1) — puste pole daje
 * 1, nie null.
 */
export async function createCrewAction(formData: FormData): Promise<CreateCrewResult> {
  const actorRole = await getCurrentActorRole();
  if (!actorRole || can(actorRole, 'crews', 'create') !== 'yes') {
    return { success: false, error: "Brak uprawnień do utworzenia ekipy." };
  }

  const nazwa = String(formData.get('name') ?? '').trim();
  if (!nazwa) {
    return { success: false, error: "Nazwa ekipy jest wymagana." };
  }

  const inFlight = createCrewInFlight.get(formData);
  if (inFlight) {
    return inFlight;
  }

  const emailRaw = String(formData.get('email') ?? '').trim();
  const radiusRaw = String(formData.get('radius') ?? '').trim();
  const teamsCountRaw = String(formData.get('teamsCount') ?? '').trim();

  const callPromise = (async (): Promise<CreateCrewResult> => {
    try {
      const created = await prisma.zespoly_monterskie.create({
        data: {
          nazwa,
          telefon_kontaktowy: String(formData.get('phone') ?? '') || null,
          email: emailRaw || null,
          nip: String(formData.get('nip') ?? '') || null,
          koordynator_imie_nazwisko: String(formData.get('coordinator') ?? '') || null,
          certyfikat_fgaz: String(formData.get('fgazCert') ?? '') || null,
          uprawnienia_sep: formData.get('sep') === 'true',
          kod_pocztowy_bazowy: String(formData.get('zipCode') ?? '') || null,
          promien_dzialania_km: radiusRaw ? Number(radiusRaw) : null,
          liczba_brygad: teamsCountRaw ? Number(teamsCountRaw) : 1,
          posiada_wiertnice: formData.get('drillingRig') === 'true',
          iban: String(formData.get('iban') ?? '') || null,
        },
      });

      revalidatePath('/crews');
      return { success: true, id: created.id };
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        return { success: false, error: "Ten adres e-mail jest już przypisany do innej ekipy." };
      }
      return { success: false, error: "Nie udało się utworzyć ekipy." };
    } finally {
      createCrewInFlight.delete(formData);
    }
  })();

  createCrewInFlight.set(formData, callPromise);
  return callPromise;
}

export type CrewEditRecord = {
  nazwa: string;
  telefon_kontaktowy: string | null;
  email: string | null;
  nip: string | null;
  koordynator_imie_nazwisko: string | null;
  certyfikat_fgaz: string | null;
  uprawnienia_sep: boolean;
  kod_pocztowy_bazowy: string | null;
  promien_dzialania_km: number | null;
  liczba_brygad: number;
  posiada_wiertnice: boolean;
  iban: string | null;
  zdjecie_url: string | null;
};

/**
 * CRM-ZESP-KARTOTEKA: pobiera komplet 12 pól formularza edycji zespołu.
 * Bramka `can(role,'crews','update')==='yes'`. Świadomie NIE zwraca
 * aktywny/leave_status — pola administracyjne spoza formularza.
 */
export async function getCrewForEdit(id: string): Promise<CrewEditRecord | null> {
  const actorRole = await getCurrentActorRole();
  if (!actorRole || can(actorRole, 'crews', 'update') !== 'yes') {
    return null;
  }

  const crew = await prisma.zespoly_monterskie.findUnique({ where: { id } });
  if (!crew) {
    return null;
  }

  let zdjecie_url = crew.zdjecie_url;
  if (zdjecie_url) {
    const { signStoragePaths } = await import("@/lib/storage/signed-urls");
    const signedUrls = await signStoragePaths("zespoly", [zdjecie_url], 60 * 60);
    zdjecie_url = signedUrls[zdjecie_url] ?? zdjecie_url;
  }

  return {
    nazwa: crew.nazwa,
    telefon_kontaktowy: crew.telefon_kontaktowy,
    email: crew.email,
    nip: crew.nip,
    koordynator_imie_nazwisko: crew.koordynator_imie_nazwisko,
    certyfikat_fgaz: crew.certyfikat_fgaz,
    uprawnienia_sep: crew.uprawnienia_sep,
    kod_pocztowy_bazowy: crew.kod_pocztowy_bazowy,
    promien_dzialania_km: crew.promien_dzialania_km,
    liczba_brygad: crew.liczba_brygad,
    posiada_wiertnice: crew.posiada_wiertnice,
    iban: crew.iban,
    zdjecie_url,
  };
}

export type UpdateCrewResult = { success: boolean; error?: string };

/**
 * CRM-ZESP-KARTOTEKA: edycja kartoteki zespołu. Bramka
 * `can(role,'crews','update')==='yes'`. `newPhotoPath` to już wgrana ścieżka
 * Supabase Storage — brak argumentu zachowuje istniejące zdjecie_url bez
 * zmian (nie ustawia null). Nigdy nie woła prisma.zespoly_monterskie.create.
 */
export async function updateCrewAction(
  id: string,
  formData: FormData,
  newPhotoPath?: string
): Promise<UpdateCrewResult> {
  const actorRole = await getCurrentActorRole();
  if (!actorRole || can(actorRole, 'crews', 'update') !== 'yes') {
    return { success: false, error: "Brak uprawnień do edycji ekipy." };
  }

  const existing = await prisma.zespoly_monterskie.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, error: "Ekipa nie została znaleziona." };
  }

  const nazwa = String(formData.get('name') ?? '').trim();
  if (!nazwa) {
    return { success: false, error: "Nazwa ekipy jest wymagana." };
  }

  const emailRaw = String(formData.get('email') ?? '').trim();
  const radiusRaw = String(formData.get('radius') ?? '').trim();
  const teamsCountRaw = String(formData.get('teamsCount') ?? '').trim();

  const data: Record<string, unknown> = {
    nazwa,
    telefon_kontaktowy: String(formData.get('phone') ?? '') || null,
    email: emailRaw || null,
    nip: String(formData.get('nip') ?? '') || null,
    koordynator_imie_nazwisko: String(formData.get('coordinator') ?? '') || null,
    certyfikat_fgaz: String(formData.get('fgazCert') ?? '') || null,
    uprawnienia_sep: formData.get('sep') === 'true',
    kod_pocztowy_bazowy: String(formData.get('zipCode') ?? '') || null,
    promien_dzialania_km: radiusRaw ? Number(radiusRaw) : null,
    liczba_brygad: teamsCountRaw ? Number(teamsCountRaw) : 1,
    posiada_wiertnice: formData.get('drillingRig') === 'true',
    iban: String(formData.get('iban') ?? '') || null,
  };

  if (newPhotoPath) {
    data.zdjecie_url = newPhotoPath;
  }

  try {
    await prisma.zespoly_monterskie.update({ where: { id }, data });
    revalidatePath('/crews');
    return { success: true };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return { success: false, error: "Ten adres e-mail jest już przypisany do innej ekipy." };
    }
    return { success: false, error: "Nie udało się zapisać zmian ekipy." };
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
