"use server";

import { prisma, LeadStatus } from "@repo/database";
import { revalidatePath } from "next/cache";
import {
  SLA,
  isValidLostReason,
  lostReasonRequiresNote,
  canTransition,
  findTransition,
  can,
} from "@klikklima/contracts";
import { getCurrentActorRole } from "../../../utils/supabase/server";

/**
 * D6 (WO CRM-SAFE-RECORD-ACTIONS): "ważny w dniu montażu" porównujemy po dacie
 * kalendarzowej (rok-miesiąc-dzień), nie po pełnym znaczniku czasu — fgaz_valid_until/
 * sep_valid_until to `@db.Date` (bez godziny), data_rezerwacji to `@db.Timestamptz`.
 * Porównanie samych znaczników czasu odrzucałoby poprawne certyfikaty ważne "do końca
 * dnia montażu" (przypadek brzegowy #6 z WO). NULL = niewazny (wariant bezpieczny).
 */
function dateOnlyIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * MINOR (WO CRM-SAFE-RECORD-ACTIONS, REVIEW #1): `data_rezerwacji` to prawdziwy
 * znacznik czasu (@db.Timestamptz) reprezentujący realny moment montażu — jego
 * kalendarzowy dzień MUSI być liczony w Europe/Warsaw, nie w UTC, inaczej montaż
 * blisko północy polskiego czasu mógłby zostać przypisany do złego dnia (błąd o
 * jeden dzień przy sprawdzaniu ważności certyfikatu). `fgaz_valid_until` /
 * `sep_valid_until` to @db.Date bez godziny — dla nich UTC-owe `dateOnlyIso` jest
 * poprawne i pozostaje bez zmian (Prisma round-tripuje je jako północ UTC tego
 * samego dnia kalendarzowego, więc konwersja do innej strefy przesunęłaby je błędnie).
 */
function dateOnlyIsoInWarsaw(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function isCertValidForDate(validUntil: Date | null, referenceDate: Date): boolean {
  if (!validUntil) return false;
  return dateOnlyIso(validUntil) >= dateOnlyIsoInWarsaw(referenceDate);
}

type CrewCerts = { fgaz_valid_until: Date | null; sep_valid_until: Date | null };

/** Zwraca listę nazw certyfikatów, które są nieważne względem daty odniesienia. */
function invalidCrewCerts(crew: CrewCerts, referenceDate: Date): string[] {
  const invalid: string[] = [];
  if (!isCertValidForDate(crew.fgaz_valid_until, referenceDate)) invalid.push("F-Gaz");
  if (!isCertValidForDate(crew.sep_valid_until, referenceDate)) invalid.push("SEP");
  return invalid;
}

/** Wiek wyceny liczony od `quoted_at` w ms — D3 (WO), próg z kontraktu (SLA.COLD_LEAD_REPRICE). */
const COLD_LEAD_REPRICE_MS = SLA.COLD_LEAD_REPRICE.days * 24 * 60 * 60 * 1000;

/**
 * `quoted_at IS NULL` traktujemy jako przeterminowane (fail-closed, decyzja dodatkowa
 * z 2026-08-20) — lead bez znanej daty wyceny musi przejść przez jedną z dwóch ścieżek D2.
 */
function isQuoteStale(quotedAt: Date | null, now: Date): boolean {
  if (!quotedAt) return true;
  return now.getTime() - quotedAt.getTime() > COLD_LEAD_REPRICE_MS;
}

/**
 * BLOCKER 4 (WO CRM-SAFE-RECORD-ACTIONS, REVIEW #1): pula wyboru audytora przy
 * przypisywaniu do leada MUSI wykluczać zablokowane konta (`is_active: false`).
 * Panel administracyjny audytorów (auditors/actions.ts getAuditors()) celowo
 * pokazuje WSZYSTKICH — admin musi widzieć zablokowanego, żeby móc go odblokować.
 */
export async function getAuditors() {
  try {
    const auditors = await prisma.audytorzy.findMany({
      where: { is_active: true },
      orderBy: { imie_i_nazwisko: "asc" },
      select: {
        id: true,
        imie_i_nazwisko: true,
        zdjecie_url: true,
        is_active: true,
        availability_declaration: { select: { isAvailable: true } },
      },
    });

    // FLD-AVAIL-SELF (AC4, WO FLD-AVAILABILITY-SPLIT): pracownik, który zadeklarował
    // się jako niedostępny, nie trafia do puli przypisania. Fail-open: brak wiersza
    // deklaracji = dostępny (odwrotnie niż is_active, gdzie brak/blokada = odmowa) —
    // inaczej audytor dodany po migracji nigdy nie trafiłby do puli.
    return auditors
      .filter((a) => a.availability_declaration?.isAvailable !== false)
      .map((a) => ({ id: a.id, imie_i_nazwisko: a.imie_i_nazwisko, zdjecie_url: a.zdjecie_url }));
  } catch (error) {
    console.error("Failed to fetch auditors:", error);
    return [];
  }
}

/**
 * Pula zespołów dostępnych do przypisania w E4 (CRM-ZESP-AC2). Filtr certyfikatów
 * DOKŁADA się do istniejącego `aktywny: true`, nie zastępuje go (AC2.4) — filtrujemy
 * też po stronie aplikacji, bo `where` samo w sobie nie jest jedynym strażnikiem tej
 * reguły (np. przy przypisaniu bezpośrednio w assignCrewToLead).
 */
export async function getCrews(installationDate: Date) {
  try {
    const crews = await prisma.zespoly_monterskie.findMany({
      where: { aktywny: true },
      orderBy: { nazwa: "asc" },
      select: {
        id: true,
        nazwa: true,
        koordynator_imie_nazwisko: true,
        certyfikat_fgaz: true,
        uprawnienia_sep: true,
        promien_dzialania_km: true,
        aktywny: true,
        fgaz_valid_until: true,
        sep_valid_until: true,
        availability_declaration: { select: { isAvailable: true } },
      },
    });

    // FLD-AVAIL-SELF (AC4, R3, WO FLD-AVAILABILITY-SPLIT): dokłada się do istniejącego
    // filtra certyfikatów/aktywny, nie tworzy drugiego, równoległego mechanizmu.
    // Fail-open: brak wiersza deklaracji = dostępny.
    return crews
      .filter(
        (crew) =>
          crew.aktywny &&
          invalidCrewCerts(crew, installationDate).length === 0 &&
          crew.availability_declaration?.isAvailable !== false
      )
      .map((crew) => ({
        id: crew.id,
        nazwa: crew.nazwa,
        koordynator_imie_nazwisko: crew.koordynator_imie_nazwisko,
        certyfikat_fgaz: crew.certyfikat_fgaz,
        uprawnienia_sep: crew.uprawnienia_sep,
        promien_dzialania_km: crew.promien_dzialania_km,
      }));
  } catch (error) {
    console.error("Failed to fetch crews:", error);
    return [];
  }
}

/**
 * Przypisanie zespołu do leada (T05 assignCrew). Walidacja certyfikatów MUSI żyć
 * tutaj, nie tylko w getCrews() — certyfikat może wygasnąć między wyświetleniem
 * listy a kliknięciem "Przypisz" (przypadek brzegowy #2, CRM-ZESP-AC2 AC2.2).
 */
export async function assignCrewToLead(
  leadId: string,
  crewId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const lead = await prisma.leady.findUnique({
      where: { id: leadId },
      select: { status: true, data_rezerwacji: true },
    });

    if (!lead) {
      return { success: false, error: "Lead nie został znaleziony." };
    }
    if (lead.status !== "AWAITING_CREW_ASSIGNMENT") {
      return { success: false, error: "Lead nie oczekuje na przypisanie ekipy." };
    }
    if (!lead.data_rezerwacji) {
      return { success: false, error: "Brak daty montażu — nie można zweryfikować certyfikatów." };
    }

    // Uwaga (REVIEW #1, MAJOR): pozostawiamy findMany({ where: { id } }).find() zamiast
    // findUnique — testy crews-cert-availability.test.ts mockują wyłącznie
    // prisma.zespoly_monterskie.findMany, więc findUnique wywaliłoby się runtime
    // TypeError i zepsuło zielony test AC2.2. Zachowanie funkcjonalnie identyczne.
    const crews = await prisma.zespoly_monterskie.findMany({ where: { id: crewId } });
    const crew = crews.find((c) => c.id === crewId);

    if (!crew) {
      return { success: false, error: "Zespół nie został znaleziony." };
    }
    if (!crew.aktywny) {
      return { success: false, error: "Zespół jest nieaktywny." };
    }

    const invalidCerts = invalidCrewCerts(crew, lead.data_rezerwacji);
    if (invalidCerts.length > 0) {
      return {
        success: false,
        error: `Nie można przypisać zespołu — nieważny certyfikat: ${invalidCerts.join(", ")}.`,
      };
    }

    // MAJOR (WO CRM-SAFE-RECORD-ACTIONS, REVIEW #1): Prisma omija RLS — sprawdzenie
    // roli musi żyć jawnie w tej akcji. PERMISSIONS.leads.update = ['admin', 'dyspozytor'].
    const actorRole = await getCurrentActorRole();
    if (!actorRole || can(actorRole, "leads", "update") !== "yes") {
      return { success: false, error: "Brak uprawnień do przypisania ekipy." };
    }

    // MAJOR (WO CRM-SAFE-RECORD-ACTIONS, REVIEW #2): status docelowy pochodzi z
    // kontraktu (T05 assignCrew), nie jest wpisany na sztywno — spójnie z
    // returnToFunnel/archiveLost w tym samym pliku.
    if (!canTransition("AWAITING_CREW_ASSIGNMENT", "assignCrew")) {
      return { success: false, error: "Przejście niedozwolone przez kontrakt." };
    }
    const transition = findTransition("AWAITING_CREW_ASSIGNMENT", "assignCrew")!;

    // MAJOR: przypisanie zespołu musi realnie wylądować na instalacje.zespol_id, nie
    // tylko zmienić status leada — inaczej ekipa "znika" po zapisaniu. Zmiana statusu
    // i zapis przypisania — jedna transakcja.
    await prisma.$transaction(async (tx) => {
      await tx.leady.update({
        where: { id: leadId },
        data: { status: transition.to as LeadStatus },
      });

      const installation = await tx.instalacje.findFirst({ where: { lead_id: leadId } });
      if (installation) {
        await tx.instalacje.update({
          where: { id: installation.id },
          data: { zespol_id: crewId },
        });
      } else {
        await tx.instalacje.create({
          data: { lead_id: leadId, zespol_id: crewId },
        });
      }
    });

    revalidatePath("/leads");
    return { success: true };
  } catch (error) {
    console.error("Failed to assign crew to lead:", error);
    return { success: false, error: "Nie udało się przypisać ekipy." };
  }
}

/** Map bucket query param to LeadStatus */
function bucketToStatus(bucket: string): LeadStatus | null {
  switch (bucket) {
    case "cold": return "QUOTE_REJECTED";
    case "rejected_auto": return "QUOTE_REJECTED";
    case "rollback": return "ROLLBACK_RESCHEDULING";
    default: return null;
  }
}

export async function getLeads(options?: { 
  status?: LeadStatus | "ALL", 
  bucket?: string,
  page?: number, 
  limit?: number 
}) {
  try {
    const page = options?.page || 1;
    const limit = options?.limit || 50;
    const skip = (page - 1) * limit;

    // Determine filter: bucket takes priority, then status, then default
    let where: any = {};
    
    if (options?.bucket) {
      if (options.bucket === "rejected_auto") {
        // BLOCKER 2 (WO CRM-SAFE-RECORD-ACTIONS, REVIEW #1): migracja Z4/D4 przeniosła
        // znacznik automatu z `lost_reason` do `auto_rejected_reason`. Filtr po starej
        // kolumnie po migracji zwracał zawsze pustą listę.
        where = { status: "QUOTE_REJECTED", auto_rejected_reason: "AUTO_REJECT_14_DAYS" };
      } else {
        const mappedStatus = bucketToStatus(options.bucket);
        if (mappedStatus) {
          where = { status: mappedStatus };
        }
      }
    } else if (options?.status && options.status !== "ALL") {
      where = { status: options.status };
    }
    // If status === "ALL" or no filter → where stays empty (all leads)

    const [leads, totalCount, statusGroups] = await Promise.all([
      prisma.leady.findMany({
        where,
        orderBy: [
          { data_rezerwacji: "asc" },
          { created_at: "desc" }
        ],
        skip,
        take: limit,
        // SEC-LEADS-LIST-MINIMIZE: `select` zagnieżdżony na każdym poziomie zamiast
        // `include` pełnych relacji — lista leadów nie ma prawa nieść danych
        // kontaktowych/rozliczeniowych klienta, ekipy ani współrzędnych adresu.
        // Pola samego leada NIE są zawężane (wymaganie dotyczy wyłącznie relacji),
        // więc wypisujemy je wszystkie jawnie, bo `select` (w odróżnieniu od
        // `include`) nie zwraca skalarów niejawnie.
        select: {
          id: true,
          klient_id: true,
          adres_id: true,
          odpowiedzi_triage: true,
          wybrana_konfiguracja: true,
          estymowana_wycena: true,
          status: true,
          audytor_id: true,
          data_rezerwacji: true,
          finalna_wycena_pln: true,
          przewidywany_czas_montazu: true,
          notatki_wewnetrzne: true,
          bucket_entered_at: true,
          quoted_at: true,
          lost_reason: true,
          lost_reason_note: true,
          auto_rejected_reason: true,
          last_followup_date: true,
          created_at: true,
          updated_at: true,
          klient: { select: { id: true, imie_i_nazwisko: true } },
          adres: { select: { ulica_miasto: true } },
          instalacje: {
            select: {
              zespol: { select: { nazwa: true } },
            },
          },
          audytor: { select: { id: true, imie_i_nazwisko: true } },
        }
      }),
      prisma.leady.count({ where }),
      prisma.leady.groupBy({
        by: ['status'],
        _count: {
          id: true
        }
      })
    ]);

    const stageCounts = statusGroups.reduce((acc, curr) => {
      if (curr.status) {
        acc[curr.status] = curr._count.id;
      }
      return acc;
    }, {} as Record<string, number>);

    // Compute total for "ALL" option
    const allCount = Object.values(stageCounts).reduce((sum, c) => sum + c, 0);
    stageCounts["ALL"] = allCount;

    // SEC-LEADS-LIST-MINIMIZE: reshape jawnie na wyjściu, spójnie z getAuditors()/
    // getCrews() w tym pliku — `select` zawęża zapytanie, mapowanie jest drugą linią
    // obrony (i jedyną, którą widać w testach mockujących samo findMany()).
    const narrowedLeads = leads.map((lead) => ({
      ...lead,
      klient: lead.klient ? { id: lead.klient.id, imie_i_nazwisko: lead.klient.imie_i_nazwisko } : null,
      adres: lead.adres ? { ulica_miasto: lead.adres.ulica_miasto } : null,
      instalacje: (lead.instalacje ?? []).map((inst) => ({
        zespol: inst.zespol ? { nazwa: inst.zespol.nazwa } : null,
      })),
      audytor: lead.audytor ? { id: lead.audytor.id, imie_i_nazwisko: lead.audytor.imie_i_nazwisko } : null,
    }));

    return {
      leads: narrowedLeads,
      totalCount,
      totalPages: Math.ceil(totalCount / limit),
      stageCounts
    };
  } catch (error) {
    console.error("Failed to fetch leads:", error);
    return { leads: [], totalCount: 0, totalPages: 0, stageCounts: {} };
  }
}

export async function updateLeadStatus(leadId: string, newStatus: LeadStatus) {
  try {
    const lead = await prisma.leady.findUnique({
      where: { id: leadId },
      select: { audytor_id: true }
    });

    if (newStatus !== "NEW_LEAD" && !lead?.audytor_id) {
      return { success: false, error: "Nie można przenieść leada bez przypisanego audytora. Najpierw przypisz audytora." };
    }

    if (newStatus === "NEW_LEAD" && lead?.audytor_id) {
      await prisma.leady.update({
        where: { id: leadId },
        data: { status: newStatus, audytor_id: null },
      });
    } else {
      await prisma.leady.update({
        where: { id: leadId },
        data: { status: newStatus },
      });
    }
    revalidatePath("/leads");
    return { success: true };
  } catch (error) {
    console.error("Failed to update lead status:", error);
    return { success: false, error: "Nie udało się zaktualizować statusu." };
  }
}

/**
 * Dozwolone przejścia statusów w lejku sprzedażowym.
 * Klucz = obecny status, wartość = lista dozwolonych statusów docelowych.
 */
const ALLOWED_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NEW_LEAD: ["AWAITING_AUDIT"],
  AWAITING_AUDIT: ["AUDIT_COMPLETED", "NEW_LEAD"],
  AUDIT_COMPLETED: ["AWAITING_CREW_ASSIGNMENT", "QUOTE_REJECTED"],
  AWAITING_CREW_ASSIGNMENT: ["HARDWARE_IN_WAREHOUSE", "ROLLBACK_RESCHEDULING"],
  HARDWARE_IN_WAREHOUSE: ["HARDWARE_IN_TRANSIT", "AWAITING_INSTALLATION", "ROLLBACK_RESCHEDULING"],
  HARDWARE_IN_TRANSIT: ["AWAITING_INSTALLATION", "ROLLBACK_RESCHEDULING"],
  AWAITING_INSTALLATION: ["INSTALLATION_COMPLETED", "ROLLBACK_RESCHEDULING"],
  INSTALLATION_COMPLETED: [],
  // D7 (WO CRM-SAFE-RECORD-ACTIONS): stara ścieżka QUOTE_REJECTED -> NEW_LEAD usunięta.
  // Kontrakt (T15) prowadzi QUOTE_REJECTED -> AUDIT_COMPLETED przez returnToFunnel(),
  // a QUOTE_REJECTED -> ARCHIVED_LOST przez archiveLost() (T16) — obie poza tą lokalną
  // mapą, wprost z @klikklima/contracts (canTransition/findTransition).
  QUOTE_REJECTED: [],
  ROLLBACK_RESCHEDULING: ["AWAITING_CREW_ASSIGNMENT"],
  // ARCHIVED_LOST (T16) jest terminalny — brak jakichkolwiek przejść wychodzących (AC4.4).
  ARCHIVED_LOST: [],
};



/** Przesuwa leada do nowego statusu z walidacją dozwolonych przejść */
export async function advanceLeadStatus(leadId: string, targetStatus: LeadStatus) {
  try {
    const lead = await prisma.leady.findUnique({
      where: { id: leadId },
      select: { status: true, audytor_id: true }
    });

    if (!lead || !lead.status) {
      return { success: false, error: "Lead nie został znaleziony." };
    }

    const currentStatus = lead.status as LeadStatus;
    const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];

    if (!allowed.includes(targetStatus)) {
      return { 
        success: false, 
        error: `Przejście z „${currentStatus}" do „${targetStatus}" nie jest dozwolone.` 
      };
    }

    // Walidacja biznesowa: E1→E2 wymaga audytora
    if (targetStatus === "AWAITING_AUDIT" && !lead.audytor_id) {
      return { success: false, error: "Najpierw przypisz audytora do tego leada." };
    }

    // Bucket timestamp
    const isBucket = targetStatus === "QUOTE_REJECTED" || targetStatus === "ROLLBACK_RESCHEDULING";

    await prisma.leady.update({
      where: { id: leadId },
      data: { 
        status: targetStatus,
        ...(isBucket ? { bucket_entered_at: new Date() } : {}),
        // Wyjście z bucketu rollback → powrót do E4 → wyczyść bucket timestamp
        ...(currentStatus === "ROLLBACK_RESCHEDULING" && targetStatus === "AWAITING_CREW_ASSIGNMENT" 
          ? { bucket_entered_at: null } 
          : {}
        ),
      },
    });

    revalidatePath("/leads");
    return { success: true };
  } catch (error) {
    console.error("Failed to advance lead status:", error);
    return { success: false, error: "Nie udało się zmienić statusu leada." };
  }
}

/**
 * MAJOR (WO CRM-SAFE-RECORD-ACTIONS, REVIEW #1): twardy DELETE bez żadnego sprawdzenia
 * roli — dziura tożsama z BLOCKER 1. Nie przeprojektowujemy całej ścieżki
 * usuwania/archiwizacji leadów (osobny temat) — tylko domykamy brak sprawdzenia roli
 * w akcji destrukcyjnej, zgodnie z PERMISSIONS.leads.delete = ['admin'].
 */
export async function deleteLeadAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const actorRole = await getCurrentActorRole();
    if (!actorRole || can(actorRole, "leads", "delete") !== "yes") {
      return { success: false, error: "Brak uprawnień do usunięcia leada." };
    }

    await prisma.leady.delete({
      where: { id }
    });
    revalidatePath('/leads');
    return { success: true };
  } catch (error) {
    console.error("Failed to delete lead:", error);
    return { success: false, error: "Nie udało się usunąć leada." };
  }
}

type ReturnToFunnelResolution = "acknowledgeStaleQuote" | "refreshQuote";

/**
 * "Zwróć do obiegu" (T15: QUOTE_REJECTED -> AUDIT_COMPLETED, guard quoteRefreshedIfStale).
 * D2 (rozstrzygnięte): wycena świeższa niż SLA.COLD_LEAD_REPRICE_DAYS wraca bez decyzji;
 * przeterminowana (albo `quoted_at IS NULL`, fail-closed) wymaga jednej z dwóch ścieżek —
 * potwierdzenia (`acknowledgeStaleQuote`) albo aktualizacji ceny (`refreshQuote` + `newPrice`).
 * Efekt `refreshQuoteValidity` (nowe `quoted_at`) zachodzi w OBU ścieżkach, inaczej lead
 * natychmiast znów byłby przeterminowany. Status i odświeżenie wyceny — jedna transakcja (AC3.7).
 */
export async function returnToFunnel(
  leadId: string,
  resolution?: ReturnToFunnelResolution,
  newPrice?: number
): Promise<{ success: boolean; error?: string }> {
  // BLOCKER (WO CRM-SAFE-RECORD-ACTIONS, REVIEW #2): Prisma omija RLS — sprawdzenie
  // roli musi żyć jawnie w tej akcji, tak samo jak w assignCrewToLead/deleteLeadAction.
  // PERMISSIONS.leads.update = ['admin', 'dyspozytor'].
  const actorRole = await getCurrentActorRole();
  if (!actorRole || can(actorRole, "leads", "update") !== "yes") {
    return { success: false, error: "Brak uprawnień do zwrócenia leada do obiegu." };
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const lead = await tx.leady.findUnique({
        where: { id: leadId },
        select: { status: true, quoted_at: true },
      });

      if (!lead || lead.status !== "QUOTE_REJECTED") {
        return { success: false, error: "Lead nie jest w buckecie zimnych leadów." };
      }

      if (!canTransition("QUOTE_REJECTED", "returnToFunnel")) {
        return { success: false, error: "Przejście niedozwolone przez kontrakt." };
      }
      const transition = findTransition("QUOTE_REJECTED", "returnToFunnel")!;

      const now = new Date();
      const stale = isQuoteStale(lead.quoted_at, now);

      if (!stale) {
        await tx.leady.update({
          where: { id: leadId },
          data: { status: transition.to as LeadStatus },
        });
        revalidatePath("/leads");
        return { success: true };
      }

      if (!resolution) {
        return {
          success: false,
          error: "Wycena jest przeterminowana — potwierdź lub zaktualizuj cenę, żeby wrócić do obiegu.",
        };
      }

      if (resolution === "refreshQuote") {
        if (newPrice === undefined) {
          return { success: false, error: "Podaj nową cenę, żeby zaktualizować wycenę." };
        }
        await tx.leady.update({
          where: { id: leadId },
          data: { status: transition.to as LeadStatus, quoted_at: now, finalna_wycena_pln: newPrice },
        });
      } else {
        await tx.leady.update({
          where: { id: leadId },
          data: { status: transition.to as LeadStatus, quoted_at: now },
        });
      }

      revalidatePath("/leads");
      return { success: true };
    });
  } catch (error) {
    console.error("Failed to return lead to funnel:", error);
    return { success: false, error: "Nie udało się zwrócić leada do obiegu." };
  }
}

/**
 * Trwała archiwizacja (T16: QUOTE_REJECTED -> ARCHIVED_LOST, guard lostReasonProvided).
 * D4/D5: powód WYŁĄCZNIE ze słownika LOST_REASONS; `OTHER` (i inne oznaczone w
 * LOST_REASONS_REQUIRING_NOTE) wymaga niepustej notatki. Status i powód — jedna
 * transakcja (AC4.7); nigdy nie dotyka `auto_rejected_reason` (AC4.8/D4).
 */
export async function archiveLost(
  leadId: string,
  reason: string,
  note?: string
): Promise<{ success: boolean; error?: string }> {
  // BLOCKER (WO CRM-SAFE-RECORD-ACTIONS, REVIEW #2): Prisma omija RLS — sprawdzenie
  // roli musi żyć jawnie w tej akcji, tak samo jak w assignCrewToLead/deleteLeadAction.
  // PERMISSIONS.leads.update = ['admin', 'dyspozytor'].
  const actorRole = await getCurrentActorRole();
  if (!actorRole || can(actorRole, "leads", "update") !== "yes") {
    return { success: false, error: "Brak uprawnień do archiwizacji leada." };
  }

  try {
    if (!reason) {
      return { success: false, error: "Wybierz powód utraty leada." };
    }
    if (!isValidLostReason(reason)) {
      return { success: false, error: "Powód utraty spoza dozwolonego słownika." };
    }
    if (lostReasonRequiresNote(reason) && !note?.trim()) {
      return { success: false, error: "Ten powód wymaga dodatkowej notatki." };
    }

    return await prisma.$transaction(async (tx) => {
      const lead = await tx.leady.findUnique({
        where: { id: leadId },
        select: { status: true },
      });

      if (!lead || lead.status !== "QUOTE_REJECTED") {
        return { success: false, error: "Lead nie jest w buckecie zimnych leadów." };
      }

      if (!canTransition("QUOTE_REJECTED", "archiveLost")) {
        return { success: false, error: "Przejście niedozwolone przez kontrakt." };
      }
      const transition = findTransition("QUOTE_REJECTED", "archiveLost")!;

      await tx.leady.update({
        where: { id: leadId },
        data: {
          status: transition.to as LeadStatus,
          lost_reason: reason,
          lost_reason_note: note ?? null,
        },
      });

      revalidatePath("/leads");
      return { success: true };
    });
  } catch (error) {
    console.error("Failed to archive lead as lost:", error);
    return { success: false, error: "Nie udało się zarchiwizować leada." };
  }
}
