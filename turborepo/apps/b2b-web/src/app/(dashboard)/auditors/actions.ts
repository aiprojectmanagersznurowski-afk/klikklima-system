"use server"

import { revalidatePath } from "next/cache"
import { prisma } from "@repo/database"
import { can } from "@klikklima/contracts"
import { getCurrentActorRole } from "../../../utils/supabase/server"

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
