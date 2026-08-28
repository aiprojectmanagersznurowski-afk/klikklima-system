"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@repo/database"
import { can } from "@klikklima/contracts"
import { getCurrentActorRole, createClient } from "../../../utils/supabase/server"

/**
 * D1 (WO CRM-SAFE-RECORD-ACTIONS): leady "wiszące" przy audytorze to WYŁĄCZNIE te
 * w statusach AWAITING_AUDIT / AUDIT_COMPLETED. Zimne (QUOTE_REJECTED) i zarchiwizowane
 * (ARCHIVED_LOST) NIE blokują usunięcia — relacja audytor_id ma dla nich zostać SetNull.
 */
const HANGING_LEAD_STATUSES = ["AWAITING_AUDIT", "AUDIT_COMPLETED"] as const;

export type AuditorSummary = {
  id: string;
  imie_i_nazwisko: string;
  telefon: string | null;
  email: string | null;
  certyfikat_fgaz: string | null;
  fgaz_valid_until: Date | null;
  uprawnienia_sep: boolean;
  max_promien_dojazdu_km: number | null;
  preferowane_marki: string[];
  leadsCount: number;
  is_active: boolean;
}

/**
 * Panel administracyjny audytorów pokazuje WSZYSTKICH, w tym zablokowanych (BLOCKER 4,
 * WO CRM-SAFE-RECORD-ACTIONS) — administrator musi widzieć zablokowane konto, żeby móc
 * je odblokować. Pula wyboru przy przypisywaniu leada (leads/actions.ts getAuditors())
 * jest tym, co filtruje po `is_active`, nie ten widok.
 */
export async function getAuditors(): Promise<AuditorSummary[]> {
  const auditors = await prisma.audytorzy.findMany({
    include: {
      leady: true
    },
    orderBy: {
      imie_i_nazwisko: 'asc'
    }
  });

  return auditors.map(a => ({
    id: a.id,
    imie_i_nazwisko: a.imie_i_nazwisko,
    telefon: a.telefon,
    email: a.email,
    certyfikat_fgaz: a.certyfikat_fgaz,
    fgaz_valid_until: a.fgaz_valid_until,
    uprawnienia_sep: a.uprawnienia_sep,
    max_promien_dojazdu_km: a.max_promien_dojazdu_km,
    preferowane_marki: a.preferowane_marki,
    leadsCount: a.leady.length,
    is_active: a.is_active
  }));
}

export type ToggleAuditorActiveResult = { success: boolean; error?: string; is_active?: boolean };

/**
 * BLOCKER 4 (WO CRM-SAFE-RECORD-ACTIONS, REVIEW #1): blokada/odblokowanie konta
 * audytora (D1, druga ścieżka obok twardego usunięcia). Tak samo jak w
 * deleteAuditorAction — rola pochodzi z sesji serwera, nigdy z argumentu wywołania.
 */
export async function toggleAuditorActiveAction(id: string): Promise<ToggleAuditorActiveResult> {
  const actorRole = await getCurrentActorRole();
  if (!actorRole || can(actorRole, 'auditors', 'update') !== 'yes') {
    return { success: false, error: "Brak uprawnień do zmiany statusu audytora." };
  }

  const auditor = await prisma.audytorzy.findUnique({ where: { id }, select: { is_active: true } });
  if (!auditor) {
    return { success: false, error: "Audytor nie został znaleziony." };
  }

  const updated = await prisma.audytorzy.update({
    where: { id },
    data: { is_active: !auditor.is_active },
    select: { is_active: true },
  });

  revalidatePath('/auditors');
  return { success: true, is_active: updated.is_active };
}

export type SetSelfAvailabilityResult = { success: boolean; error?: string; isAvailable?: boolean };

/**
 * FLD-AVAIL-SELF / FLD-AVAIL-RESTORE (WO FLD-AVAILABILITY-SPLIT, D-A): audytor
 * deklaruje WŁASNĄ dostępność operacyjną — rozłączną z `is_active` (blokada
 * administratora, Z2) i z `leave_status` (kadrowe, też administrator). Zasób RBAC to
 * `availability_declarations` (rbac.contract.mjs), a `auditors.update` zostaje
 * wyłącznie ['admin'] — dlatego ta akcja NIGDY nie wywołuje `prisma.audytorzy.update`.
 *
 * `can()` przy wariancie `:own` NIE sprawdza właścicielstwa rekordu — robi to ta
 * akcja: identyfikacja "czyj to rekord" idzie przez e-mail z sesji (wzorem
 * middleware.ts), a znalezione WŁASNE `id` (nie argument `id`) trafia do zapisu.
 * Bez tego porównania audytor A mógłby jawnie podać `id` audytora B.
 */
export async function setSelfAvailabilityAction(
  id: string,
  isAvailable: boolean
): Promise<SetSelfAvailabilityResult> {
  const actorRole = await getCurrentActorRole();
  // MAJOR (REVIEW #1, rls-security-auditor): `availability_declarations` jest jednym
  // zasobem RBAC dla DWÓCH encji (audytorzy + zespoly_monterskie) — `can() !== 'no'`
  // przepuszcza tu też 'monter', bo macierz nie rozróżnia plików. Wiązanie roli z
  // encją musi więc żyć w kodzie akcji, nie w `can()`.
  if (actorRole !== 'audytor' || can(actorRole, 'availability_declarations', 'update') !== 'own') {
    return { success: false, error: "Brak uprawnień do zmiany własnej dostępności." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return { success: false, error: "Brak sesji użytkownika." };
  }

  const own = await prisma.audytorzy.findUnique({ where: { email: user.email } });
  if (!own || own.id !== id) {
    return { success: false, error: "Nie można zmienić dostępności innego audytora." };
  }

  const declaration = await prisma.availabilityDeclaration.upsert({
    where: { auditorId: own.id },
    create: { auditorId: own.id, isAvailable },
    update: { isAvailable },
  });

  revalidatePath('/auditors');
  return { success: true, isAvailable: declaration.isAvailable };
}

export type AcceptLegalDocumentVersionResult = {
  success: boolean;
  error?: string;
  id?: string;
  acceptedAt?: Date;
};

/**
 * FLD-CONSENT-ACCEPT (WO FLD-CONSENT-DOCS): audytor akceptuje WŁASNĄ, konkretną
 * wersję dokumentu prawnego wskazaną wprost przez `versionId` — nigdy "najnowszą"
 * dobraną po stronie serwera. Wzorem `setSelfAvailabilityAction`: rola i
 * właścicielstwo rekordu idą przez sesję (e-mail), nigdy przez argument wywołania.
 * Zasób RBAC `employee_consents.create` nie ma wariantu `:own` (właścicielstwo
 * wyznacza dopiero para auditorId/crewId, której `can()` nie widzi), dlatego
 * wiązanie roli z encją musi żyć w kodzie akcji.
 *
 * Rejestr jest append-only: brak sprawdzenia "czy już istnieje" przed insertem —
 * ochronę przed duplikatem daje wyłącznie ograniczenie unikalności w bazie.
 */
export async function acceptLegalDocumentVersionAction(
  versionId: string
): Promise<AcceptLegalDocumentVersionResult> {
  const actorRole = await getCurrentActorRole();
  if (actorRole !== 'audytor' || can(actorRole, 'employee_consents', 'create') !== 'yes') {
    return { success: false, error: "Brak uprawnień do akceptacji dokumentu." };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return { success: false, error: "Brak sesji użytkownika." };
  }

  const own = await prisma.audytorzy.findUnique({ where: { email: user.email } });
  if (!own) {
    return { success: false, error: "Nie znaleziono własnego rekordu audytora." };
  }

  try {
    const consent = await prisma.employeeConsent.create({
      data: { auditorId: own.id, versionId },
    });
    return { success: true, id: consent.id, acceptedAt: consent.acceptedAt };
  } catch (error) {
    return { success: false, error: "Nie udało się zapisać akceptacji dokumentu." };
  }
}

export type CreateAuditorResult = { success: boolean; error?: string; id?: string };

/**
 * CRM-AUDYT-KARTOTEKA: tworzenie kartoteki audytora z panelu B2B. Bramka
 * `can(role,'auditors','create')==='yes'`, rola wyłącznie z sesji (wzorem
 * deleteAuditorAction). Klucze FormData to nazwy kolumn Prisma w snake_case
 * (kontrakt cytuje je wprost) — patrz decyzja rozstrzygająca w WO
 * CRM-KARTOTEKI-CREATE-AND-CREW-ASSIGN, punkt 1.
 */
export async function createAuditorAction(formData: FormData): Promise<CreateAuditorResult> {
  const actorRole = await getCurrentActorRole();
  if (!actorRole || can(actorRole, 'auditors', 'create') !== 'yes') {
    return { success: false, error: "Brak uprawnień do utworzenia audytora." };
  }

  const imie_i_nazwisko = String(formData.get('imie_i_nazwisko') ?? '').trim();
  if (!imie_i_nazwisko) {
    return { success: false, error: "Imię i nazwisko jest wymagane." };
  }

  const preferowaneMarkiRaw = formData.get('preferowane_marki');
  let preferowane_marki: string[] = [];
  if (typeof preferowaneMarkiRaw === 'string' && preferowaneMarkiRaw !== '') {
    try {
      const parsed = JSON.parse(preferowaneMarkiRaw);
      if (!Array.isArray(parsed)) {
        return { success: false, error: "Niepoprawny format preferowanych marek." };
      }
      preferowane_marki = parsed;
    } catch {
      return { success: false, error: "Niepoprawny format preferowanych marek." };
    }
  }

  const emailRaw = String(formData.get('email') ?? '').trim();
  const doswiadczenieRaw = String(formData.get('doswiadczenie_hvac_lata') ?? '').trim();
  const promienRaw = String(formData.get('max_promien_dojazdu_km') ?? '').trim();

  try {
    const created = await prisma.audytorzy.create({
      data: {
        imie_i_nazwisko,
        telefon: String(formData.get('telefon') ?? '') || null,
        email: emailRaw || null,
        adres: String(formData.get('adres') ?? '') || null,
        nazwa_firmy: String(formData.get('nazwa_firmy') ?? '') || null,
        nip: String(formData.get('nip') ?? '') || null,
        certyfikat_fgaz: String(formData.get('certyfikat_fgaz') ?? '') || null,
        doswiadczenie_hvac_lata: doswiadczenieRaw ? Number(doswiadczenieRaw) : null,
        uprawnienia_sep: formData.get('uprawnienia_sep') === 'true',
        preferowane_marki,
        kod_pocztowy_bazowy: String(formData.get('kod_pocztowy_bazowy') ?? '') || null,
        max_promien_dojazdu_km: promienRaw ? Number(promienRaw) : null,
        iban: String(formData.get('iban') ?? '') || null,
        zdjecie_url: String(formData.get('zdjecie_url') ?? '') || null,
      },
    });

    revalidatePath('/auditors');
    return { success: true, id: created.id };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return { success: false, error: "Ten adres e-mail jest już przypisany do innego audytora." };
    }
    return { success: false, error: "Nie udało się utworzyć audytora." };
  }
}

export type AuditorEditRecord = {
  imie_i_nazwisko: string;
  telefon: string | null;
  email: string | null;
  adres: string | null;
  nazwa_firmy: string | null;
  nip: string | null;
  certyfikat_fgaz: string | null;
  doswiadczenie_hvac_lata: number | null;
  uprawnienia_sep: boolean;
  preferowane_marki: string[];
  kod_pocztowy_bazowy: string | null;
  max_promien_dojazdu_km: number | null;
  iban: string | null;
  zdjecie_url: string | null;
};

/**
 * CRM-AUDYT-KARTOTEKA: pobiera komplet pól formularza edycji audytora. Bramka
 * `can(role,'auditors','update')==='yes'`. Świadomie NIE zwraca is_active ani
 * leave_status — to pola administracyjne spoza formularza (patrz komentarz
 * nagłówkowy testu).
 */
export async function getAuditorForEdit(id: string): Promise<AuditorEditRecord | null> {
  const actorRole = await getCurrentActorRole();
  if (!actorRole || can(actorRole, 'auditors', 'update') !== 'yes') {
    return null;
  }

  const auditor = await prisma.audytorzy.findUnique({ where: { id } });
  if (!auditor) {
    return null;
  }

  let zdjecie_url = auditor.zdjecie_url;
  if (zdjecie_url) {
    const { signStoragePaths } = await import("@/lib/storage/signed-urls");
    const signedUrls = await signStoragePaths("audytorzy", [zdjecie_url], 60 * 60);
    zdjecie_url = signedUrls[zdjecie_url] ?? zdjecie_url;
  }

  return {
    imie_i_nazwisko: auditor.imie_i_nazwisko,
    telefon: auditor.telefon,
    email: auditor.email,
    adres: auditor.adres,
    nazwa_firmy: auditor.nazwa_firmy,
    nip: auditor.nip,
    certyfikat_fgaz: auditor.certyfikat_fgaz,
    doswiadczenie_hvac_lata: auditor.doswiadczenie_hvac_lata,
    uprawnienia_sep: auditor.uprawnienia_sep,
    preferowane_marki: auditor.preferowane_marki,
    kod_pocztowy_bazowy: auditor.kod_pocztowy_bazowy,
    max_promien_dojazdu_km: auditor.max_promien_dojazdu_km,
    iban: auditor.iban,
    zdjecie_url,
  };
}

export type UpdateAuditorResult = { success: boolean; error?: string };

/**
 * CRM-AUDYT-KARTOTEKA: edycja kartoteki audytora. Bramka
 * `can(role,'auditors','update')==='yes'`. Nigdy nie wysyła is_active/leave_status
 * do prisma.audytorzy.update (pola administracyjne, wyścig z
 * toggleAuditorActiveAction). Brak podanego zdjecie_url zachowuje istniejącą
 * ścieżkę bez zmian.
 */
export async function updateAuditorAction(id: string, formData: FormData): Promise<UpdateAuditorResult> {
  const actorRole = await getCurrentActorRole();
  if (!actorRole || can(actorRole, 'auditors', 'update') !== 'yes') {
    return { success: false, error: "Brak uprawnień do edycji audytora." };
  }

  const existing = await prisma.audytorzy.findUnique({ where: { id } });
  if (!existing) {
    return { success: false, error: "Audytor nie został znaleziony." };
  }

  const imie_i_nazwisko = String(formData.get('imie_i_nazwisko') ?? '').trim();
  if (!imie_i_nazwisko) {
    return { success: false, error: "Imię i nazwisko jest wymagane." };
  }

  const preferowaneMarkiRaw = formData.get('preferowane_marki');
  let preferowane_marki: string[] = [];
  if (typeof preferowaneMarkiRaw === 'string' && preferowaneMarkiRaw !== '') {
    try {
      const parsed = JSON.parse(preferowaneMarkiRaw);
      if (!Array.isArray(parsed)) {
        return { success: false, error: "Niepoprawny format preferowanych marek." };
      }
      preferowane_marki = parsed;
    } catch {
      return { success: false, error: "Niepoprawny format preferowanych marek." };
    }
  }

  const emailRaw = String(formData.get('email') ?? '').trim();
  const doswiadczenieRaw = String(formData.get('doswiadczenie_hvac_lata') ?? '').trim();
  const promienRaw = String(formData.get('max_promien_dojazdu_km') ?? '').trim();

  const data: Record<string, unknown> = {
    imie_i_nazwisko,
    telefon: String(formData.get('telefon') ?? '') || null,
    email: emailRaw || null,
    adres: String(formData.get('adres') ?? '') || null,
    nazwa_firmy: String(formData.get('nazwa_firmy') ?? '') || null,
    nip: String(formData.get('nip') ?? '') || null,
    certyfikat_fgaz: String(formData.get('certyfikat_fgaz') ?? '') || null,
    doswiadczenie_hvac_lata: doswiadczenieRaw ? Number(doswiadczenieRaw) : null,
    uprawnienia_sep: formData.get('uprawnienia_sep') === 'true',
    kod_pocztowy_bazowy: String(formData.get('kod_pocztowy_bazowy') ?? '') || null,
    max_promien_dojazdu_km: promienRaw ? Number(promienRaw) : null,
    iban: String(formData.get('iban') ?? '') || null,
  };

  if (formData.has('preferowane_marki')) {
    data.preferowane_marki = preferowane_marki;
  }

  if (formData.has('zdjecie_url')) {
    data.zdjecie_url = String(formData.get('zdjecie_url') ?? '') || null;
  }

  try {
    await prisma.audytorzy.update({ where: { id }, data });
    revalidatePath('/auditors');
    return { success: true };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return { success: false, error: "Ten adres e-mail jest już przypisany do innego audytora." };
    }
    return { success: false, error: "Nie udało się zapisać zmian audytora." };
  }
}

export type DeleteAuditorResult = {
  success: boolean;
  error?: string;
  blockingLeads?: { id: string; clientName: string | null }[];
};

/**
 * Usuwa audytora, o ile nie ma przy nim "wiszących" leadów (D1). Sprawdzenie roli
 * (PERMISSIONS.auditors.delete = ['admin']) i sprawdzenie blokujących leadów muszą
 * żyć w JEDNEJ transakcji Prisma z samym DELETE — przepięcie ostatniego leada i
 * usunięcie audytora zlecone równolegle nie mogą się zazębić (przypadek brzegowy #1).
 *
 * BLOCKER 1 (WO CRM-SAFE-RECORD-ACTIONS, REVIEW #1): rola NIE jest przyjmowana jako
 * parametr sterowany przez klienta — Prisma omija RLS, więc klient mógłby wysłać
 * dowolną wartość (np. `actorRole: 'admin'`) wprost z przeglądarki. Rola musi
 * pochodzić z sesji serwera (`getCurrentActorRole()`).
 */
export async function deleteAuditorAction(id: string): Promise<DeleteAuditorResult> {
  const actorRole = await getCurrentActorRole();
  if (!actorRole || can(actorRole, 'auditors', 'delete') !== 'yes') {
    return { success: false, error: "Brak uprawnień do usunięcia audytora." };
  }

  const result = await prisma.$transaction(async (tx) => {
    const auditor = await tx.audytorzy.findUnique({
      where: { id },
      include: { leady: { include: { klient: true } } },
    });

    if (!auditor) {
      return { success: false, error: "Audytor nie został znaleziony." };
    }

    const blockingLeads = auditor.leady.filter((lead: { status: string | null }) =>
      HANGING_LEAD_STATUSES.includes(lead.status as (typeof HANGING_LEAD_STATUSES)[number])
    );

    if (blockingLeads.length > 0) {
      return {
        success: false,
        error: "Nie można usunąć audytora — ma przypisane aktywne leady. Przepnij je najpierw na innego audytora.",
        blockingLeads: blockingLeads.map((lead: { id: string; klient?: { imie_i_nazwisko: string | null } | null }) => ({
          id: lead.id,
          clientName: lead.klient?.imie_i_nazwisko ?? null,
        })),
      };
    }

    await tx.audytorzy.delete({ where: { id } });
    return { success: true };
  }, { isolationLevel: 'Serializable' });

  if (result.success) {
    revalidatePath('/auditors');
  }

  return result;
}
