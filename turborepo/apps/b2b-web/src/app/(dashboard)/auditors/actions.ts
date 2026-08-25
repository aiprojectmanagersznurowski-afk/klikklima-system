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
