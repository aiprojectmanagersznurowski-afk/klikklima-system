"use server";
import { prisma } from "@repo/database";
import { revalidatePath } from "next/cache";
import { can } from "@klikklima/contracts";
import { getCurrentActorRole, createClient } from "../../../../utils/supabase/server";

/**
 * SEC-RLS-AUDITOR-SCOPE (MAJOR 3, recenzja `rls-security-auditor` po zamknięciu GREEN
 * 1/3): `page.tsx` wołało `prisma.leady.findUnique` bezpośrednio, bez żadnej bramki
 * roli ani filtra własności — każde zalogowane konto, w tym audytor spoza sprawy i
 * monter, dostawało pełny rekord po wpisaniu dowolnego `id` w URL. `leads.read =
 * ['admin', 'dyspozytor', 'audytor:own']` (contracts/rbac.contract.mjs) — wariant
 * `'own'` wymaga dociągnięcia własnej tożsamości audytora tym samym wzorcem co w
 * `getLeads()` (leads/actions.ts): `createClient()` + `supabase.auth.getUser()` +
 * `prisma.audytorzy.findUnique({ where: { email }, select: { id, is_active } })`.
 *
 * AC4 (nieodróżnialność): lead cudzy i lead nieistniejący muszą zwracać DOKŁADNIE
 * ten sam kształt odmowy — audytor zgadujący cudze ID nie może w ten sposób odkryć,
 * że rekord w ogóle istnieje.
 */
export async function getLeadDetail(id: string) {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false as const, error: "Nie udało się zweryfikować uprawnień." };
  }

  const access = actorRole ? can(actorRole, "leads", "read") : "no";
  if (access !== "yes" && access !== "own") {
    return { success: false as const, error: "Brak uprawnień do przeglądania leada." };
  }

  const DENIED = { success: false as const, error: "Lead nie został znaleziony." };

  let ownId: string | undefined;
  if (access === "own") {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return { success: false as const, error: "Brak sesji użytkownika." };
    }

    const matches = await prisma.audytorzy.findMany({
      where: { email: user.email },
      select: { id: true, is_active: true },
      take: 2,
    });
    if (matches.length !== 1 || matches[0].is_active === false) {
      // Nieodróżnialność (AC-A2/AC4 z SEC-RLS-AUDITOR-SCOPE): duplikat tożsamości
      // musi dać dokładnie tę samą odmowę co lead nieistniejący — audytor nie może
      // przez duplikat wywnioskować, że rekord w ogóle istnieje.
      return DENIED;
    }
    ownId = matches[0].id;
  }

  const lead = await prisma.leady.findUnique({
    where: { id },
    include: { klient: true, adres: true },
  });

  if (!lead || (access === "own" && lead.audytor_id !== ownId)) {
    return DENIED;
  }

  return { success: true as const, lead };
}

/**
 * BLOCKER 4 (WO CRM-SAFE-RECORD-ACTIONS, REVIEW #1, AC1.6): pula wyboru w UI
 * (getAuditors() w leads/actions.ts) już wyklucza zablokowanych audytorów, ale
 * to nie chroni przed żądaniem wysłanym wprost do tej Server Action z pominięciem
 * UI — trzeba odrzucić przypisanie zablokowanego audytora również tutaj.
 *
 * CRM-LEAD-UPDATE-ADMIN-DISPATCHER: Prisma omija RLS — sprawdzenie roli musi być
 * jawne, PRZED jakimkolwiek zapytaniem do Prismy. PERMISSIONS.leads.update =
 * ['admin', 'dyspozytor'].
 */
export async function updateLeadAuditor(leadId: string, audytorId: string | null) {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Brak uprawnień do edycji leada." };
  }
  if (!actorRole || can(actorRole, "leads", "update") !== "yes") {
    return { success: false, error: "Brak uprawnień do edycji leada." };
  }

  try {
    const lead = await prisma.leady.findUnique({ where: { id: leadId } });
    if (!lead) return { success: false, error: "Lead not found" };

    if (audytorId) {
      const audytor = await prisma.audytorzy.findUnique({
        where: { id: audytorId },
        select: { is_active: true },
      });
      if (!audytor || !audytor.is_active) {
        return { success: false, error: "Audytor jest zablokowany — nie można go przypisać." };
      }
    }

    let newStatus = lead.status;
    if (audytorId && lead.status === "NEW_LEAD") {
      newStatus = "AWAITING_AUDIT";
    } else if (!audytorId && lead.status === "AWAITING_AUDIT") {
      newStatus = "NEW_LEAD";
    }

    await prisma.leady.update({
      where: { id: leadId },
      data: { 
        audytor_id: audytorId,
        status: newStatus 
      },
    });
    revalidatePath(`/leads/${leadId}`);
    revalidatePath(`/leads`);
    return { success: true };
  } catch (error) {
    console.error("Failed to assign auditor:", error);
    return { success: false, error: "Nie udało się przypisać audytora." };
  }
}

export async function updateLeadData(
  leadId: string, 
  data: { 
    name: string; 
    phone: string; 
    email: string; 
    address: string; 
    estimatedQuote: string; 
  }
) {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Brak uprawnień do edycji leada." };
  }
  if (!actorRole || can(actorRole, "leads", "update") !== "yes") {
    return { success: false, error: "Brak uprawnień do edycji leada." };
  }

  try {
    const lead = await prisma.leady.findUnique({
      where: { id: leadId },
      include: { klient: true, adres: true }
    });

    if (!lead) {
      return { success: false, error: "Lead not found" };
    }

    // Upsert Klient
    let klientId = lead.klient_id;
    if (klientId) {
      await prisma.klienci.update({
        where: { id: klientId },
        data: {
          imie_i_nazwisko: data.name,
          telefon: data.phone,
          email: data.email,
        }
      });
    } else {
      const newKlient = await prisma.klienci.create({
        data: {
          imie_i_nazwisko: data.name,
          telefon: data.phone,
          email: data.email,
        }
      });
      klientId = newKlient.id;
    }

    // Upsert Adres
    let adresId = lead.adres_id;
    if (adresId) {
      await prisma.adresy.update({
        where: { id: adresId },
        data: {
          ulica_miasto: data.address,
        }
      });
    } else {
      const newAdres = await prisma.adresy.create({
        data: {
          klient_id: klientId,
          ulica_miasto: data.address,
        }
      });
      adresId = newAdres.id;
    }

    // Update Lead
    await prisma.leady.update({
      where: { id: leadId },
      data: {
        klient_id: klientId,
        adres_id: adresId,
        estymowana_wycena: data.estimatedQuote,
      }
    });

    revalidatePath(`/leads/${leadId}`);
    return { success: true };
  } catch (error) {
    console.error("Failed to update lead data:", error);
    return { success: false, error: "Nie udało się zapisać danych." };
  }
}

