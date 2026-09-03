"use server"

import { prisma } from "@repo/database"
import { revalidatePath } from "next/cache"
import { differenceInDays, startOfDay } from "date-fns"
import { LeadStatus } from "@repo/database"
import { can, findTransition } from "@klikklima/contracts"
import { getCurrentActorRole } from "../../../utils/supabase/server"
import { deleteLeadAction } from "../leads/actions"
import type { DeleteJustificationInput } from "../../../lib/audit/delete-justification-schema"
import { releaseCrewSlot, suspendLogisticsSla } from "./rollback-effects"
import type { TriageAnswers } from "@/lib/triage-answers"

export type LogisticsLead = {
  id: string
  leadId: string
  clientName: string
  address: string
  deviceModel: string
  installationDate: string | null
  daysToInstall: number | null
  status: LeadStatus
  trackingNumber: string | null
}

/**
 * SEC-RLS-AUDITOR-SCOPE (D4): /logistics jest zamknięte dla audytora i montera
 * całkowicie — w przeciwieństwie do getLeads() nie ma tu zakresu `:own`, więc
 * jedyne dozwolone role to admin/dyspozytor (`can(role, 'leads', 'read') === 'yes'`).
 * Fail-closed: brak roli albo rzucony wyjątek → odmowa, `prisma.leady.findMany`
 * nie jest wołane wcale.
 */
export async function getLogisticsLeads(): Promise<LogisticsLead[] | { success: false; error: string }> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Nie udało się zweryfikować uprawnień." };
  }
  if (!actorRole || can(actorRole, "leads", "read") !== "yes") {
    return { success: false, error: "Brak uprawnień do przeglądania listy logistyki." };
  }

  const leads = await prisma.leady.findMany({
    where: {
      status: {
        in: [
          LeadStatus.HARDWARE_IN_WAREHOUSE,
          LeadStatus.HARDWARE_IN_TRANSIT,
          LeadStatus.ROLLBACK_RESCHEDULING,
        ],
      },
    },
    include: {
      klient: true,
      adres: true,
      logistyka_zamowienia: {
        orderBy: { created_at: 'desc' },
        take: 1,
      },
    },
    orderBy: {
      data_rezerwacji: 'asc',
    },
  })

  return leads.map((lead) => {
    let daysToInstall = null;
    let installationDateStr = null;

    if (lead.data_rezerwacji) {
      const today = startOfDay(new Date());
      const installDay = startOfDay(new Date(lead.data_rezerwacji));
      daysToInstall = differenceInDays(installDay, today);
      installationDateStr = lead.data_rezerwacji.toISOString().split("T")[0]; // YYYY-MM-DD
    }

    const triage: TriageAnswers = (lead.odpowiedzi_triage as TriageAnswers | null) || {}
    let deviceModel = "Brak modelu"
    
    if (triage.selectedExternalUnit) {
       deviceModel = `${triage.selectedExternalUnit.brand} ${triage.selectedExternalUnit.model_code}`
    } else if (triage.selectedDeviceLine) {
       deviceModel = triage.selectedDeviceLine
    }

    const trackingNumber = lead.logistyka_zamowienia?.[0]?.tracking_id || null

    return {
      id: `LOG-${lead.id.substring(0, 8)}`,
      leadId: lead.id,
      clientName: lead.klient?.imie_i_nazwisko || "Nieznany",
      address: lead.adres?.ulica_miasto || "Brak adresu",
      deviceModel,
      installationDate: installationDateStr,
      daysToInstall,
      status: lead.status as LeadStatus,
      trackingNumber,
    }
  })
}

export async function shipLogisticsOrder(leadId: string, trackingNumber?: string): Promise<{ success: boolean; error?: string }> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Nie udało się zweryfikować uprawnień." };
  }
  if (!actorRole || can(actorRole, "leads", "update") !== "yes" || can(actorRole, "shipments", "update") !== "yes") {
    return { success: false, error: "Brak uprawnień do wysyłki zamówienia." };
  }

  await prisma.$transaction(async (tx) => {
    // 1. Zmiana statusu na IN_TRANSIT
    await tx.leady.update({
      where: { id: leadId },
      data: {
        status: LeadStatus.HARDWARE_IN_TRANSIT,
      },
    });

    // 2. Dodanie rekordu logistyki, jeśli podano tracking
    if (trackingNumber) {
      await tx.logistyka_zamowienia.create({
        data: {
          lead_id: leadId,
          status_wysylki: "SHIPPED",
          tracking_id: trackingNumber,
          data_wysylki: new Date(),
        },
      });
    }
  });

  revalidatePath('/logistics');
  revalidatePath('/leads');
  return { success: true };
}

export async function bypassLogisticsOrder(leadId: string): Promise<{ success: boolean; error?: string }> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Nie udało się zweryfikować uprawnień." };
  }
  if (!actorRole || can(actorRole, "leads", "update") !== "yes" || can(actorRole, "shipments", "update") !== "yes") {
    return { success: false, error: "Brak uprawnień do zmiany statusu zamówienia." };
  }

  // Przejście z Magazynu -> Oczekuje instalacji (z pominięciem kuriera)
  await prisma.leady.update({
    where: { id: leadId },
    data: {
      status: LeadStatus.AWAITING_INSTALLATION,
    },
  });

  revalidatePath('/logistics');
  revalidatePath('/leads');
  return { success: true };
}

export async function markAsDelivered(leadId: string): Promise<{ success: boolean; error?: string }> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Nie udało się zweryfikować uprawnień." };
  }
  if (!actorRole || can(actorRole, "leads", "update") !== "yes") {
    return { success: false, error: "Brak uprawnień do oznaczenia dostawy." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.leady.update({
      where: { id: leadId },
      data: {
        status: LeadStatus.AWAITING_INSTALLATION,
      },
    });

    // Aktualizujemy status_wysylki w ostatnim zleceniu
    const lastOrder = await tx.logistyka_zamowienia.findFirst({
      where: { lead_id: leadId },
      orderBy: { created_at: 'desc' },
    });

    if (lastOrder) {
      await tx.logistyka_zamowienia.update({
        where: { id: lastOrder.id },
        data: { status_wysylki: "DELIVERED" },
      });
    }
  });

  revalidatePath('/logistics');
  revalidatePath('/leads');
  return { success: true };
}

/**
 * Błąd domenowy rzucany WEWNĄTRZ `$transaction` w `rollbackLogisticsOrder`, żeby
 * odróżnić kontrolowaną odmowę (status leada zmienił się pod nami między
 * sprawdzeniem wstępnym a otwarciem transakcji) od awarii infrastrukturalnej —
 * obie muszą cofnąć transakcję, ale tylko ta pierwsza niesie komunikat dla
 * użytkownika zamiast generycznego "Nie udało się cofnąć zamówienia.".
 */
class RollbackDomainError extends Error {}

export async function rollbackLogisticsOrder(leadId: string, reason?: string): Promise<{ success: boolean; error?: string }> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Nie udało się zweryfikować uprawnień." };
  }
  if (!actorRole || can(actorRole, "leads", "update") !== "yes" || can(actorRole, "shipments", "update") !== "yes") {
    return { success: false, error: "Brak uprawnień do rollbacku zamówienia." };
  }

  // Sprawdzenie wstępne — szybka odmowa dla oczywistych przypadków (lead
  // nieistniejący, status poza zakresem T10-T13), zanim w ogóle otworzymy
  // transakcję. NIE jest to blokada współbieżności (patrz ponowny odczyt
  // wewnątrz transakcji poniżej) — to tylko fail-fast, żeby nie płacić za
  // $transaction w przypadkach, które i tak zakończą się odmową.
  const lead = await prisma.leady.findUnique({ where: { id: leadId } });
  if (!lead) {
    return { success: false, error: "Lead nie istnieje." };
  }
  if (lead.status !== LeadStatus.ROLLBACK_RESCHEDULING) {
    const preTransition = findTransition(lead.status as LeadStatus, "rollback");
    if (!preTransition) {
      return { success: false, error: "Rollback niedostępny dla bieżącego statusu leada." };
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Blokada wiersza leada (pułapka 4 z CLAUDE.md): pod domyślnym poziomem
      // izolacji Postgresa (READ COMMITTED) sam ponowny `findUnique` wewnątrz
      // transakcji NIE daje żadnej gwarancji — dwie równoległe transakcje mogą
      // obie odczytać ten sam stary status, zanim którakolwiek zatwierdzi zapis.
      // `SELECT ... FOR UPDATE` serializuje dostęp do TEGO wiersza między
      // równoległymi wywołaniami rollbacku.
      await tx.$queryRaw<{ id: string; status: string }[]>`
        SELECT id, status FROM leady WHERE id = ${leadId}::uuid FOR UPDATE
      `;

      // Ponowny odczyt statusu WEWNĄTRZ transakcji, na wierszu już zablokowanym
      // powyżej: decyzja "czy i dokąd przejść" musi być liczona na stanie
      // widocznym w TEJ transakcji, tuż przed zapisem, nie na stanie sprzed jej
      // otwarcia — inaczej dwa równoległe rollbacki oba przechodzą sprawdzenie
      // wstępne i oba nadpisują dane.
      const freshLead = await tx.leady.findUnique({ where: { id: leadId } });
      if (!freshLead) {
        throw new RollbackDomainError("Lead nie istnieje.");
      }

      // Idempotencja (AC-A5): lead już w ROLLBACK_RESCHEDULING (poprzedni
      // rollback się powiódł, ALBO lead trafił tu inną ścieżką, np.
      // `updateLeadStatusAction`, bez zwolnienia slotu/wstrzymania SLA) —
      // status się nie powtarza, ale releaseCrewSlot/suspendLogisticsSla SĄ
      // wykonywane, bo są idempotentne i to jedyny sposób naprawić leada
      // osieroconego przez inną ścieżkę zmiany statusu.
      if (freshLead.status === LeadStatus.ROLLBACK_RESCHEDULING) {
        await releaseCrewSlot(tx, leadId);
        await suspendLogisticsSla(tx, leadId);
        return;
      }

      const transition = findTransition(freshLead.status as LeadStatus, "rollback");
      if (!transition) {
        throw new RollbackDomainError("Rollback niedostępny dla bieżącego statusu leada.");
      }

      await tx.leady.update({
        where: { id: leadId },
        data: {
          status: transition.to,
          bucket_entered_at: new Date(),
          notatki_wewnetrzne: reason ? `Rollback z logistyki: ${reason}` : undefined,
        },
      });

      await releaseCrewSlot(tx, leadId);
      await suspendLogisticsSla(tx, leadId);
    });
  } catch (error) {
    if (error instanceof RollbackDomainError) {
      return { success: false, error: error.message };
    }
    console.error("Failed to rollback logistics order:", error);
    return { success: false, error: "Nie udało się cofnąć zamówienia." };
  }

  revalidatePath('/logistics');
  revalidatePath('/leads');
  return { success: true };
}

export async function deleteLogisticsOrderAction(
  id: string,
  input: DeleteJustificationInput
): Promise<{ success: boolean; error?: string }> {
  const result = await deleteLeadAction(id, input);
  if (result.success) revalidatePath('/logistics');
  return result;
}
