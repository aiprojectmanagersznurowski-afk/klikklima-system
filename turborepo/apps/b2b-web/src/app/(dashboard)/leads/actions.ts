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
import { getCurrentActorRole, getCurrentUser } from "../../../utils/supabase/server";
import { deleteJustificationSchema, type DeleteJustificationInput, type DeleteActionResult } from "../../../lib/audit/delete-justification-schema";
import { isManualStatusChange } from "../../../lib/audit/manual-status-classifier";
import { findTransitionByFromTo } from "../../../lib/audit/find-transition-by-from-to";

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
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return [];
  }
  if (!actorRole || can(actorRole, "auditors", "read") !== "yes") {
    return [];
  }

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
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return [];
  }
  if (!actorRole || can(actorRole, "crews", "read") !== "yes") {
    return [];
  }

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
  // MAJOR (WO CRM-SAFE-RECORD-ACTIONS, REVIEW #1): Prisma omija RLS — sprawdzenie
  // roli musi żyć jawnie w tej akcji, PRZED jakimkolwiek zapytaniem Prisma.
  // PERMISSIONS.leads.update = ['admin', 'dyspozytor'].
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Brak uprawnień do przypisania ekipy." };
  }
  if (!actorRole || can(actorRole, "leads", "update") !== "yes") {
    return { success: false, error: "Brak uprawnień do przypisania ekipy." };
  }

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

/**
 * SEC-RLS-AUDITOR-SCOPE: Prisma omija RLS — dostęp do listy leadów (i pochodnych
 * liczników) musi być jawnie zawężony w kodzie akcji. `can(actorRole, 'leads', 'read')`
 * zwraca 'yes' dla admin/dyspozytor (bez zmian), 'own' dla audytor (zawężenie po
 * audytor_id własnego rekordu, dociągniętego przez email sesji — wzorem
 * setSelfAvailabilityAction w auditors/actions.ts) i 'no' dla reszty (monter) →
 * odmowa jawna (D2), nie cicha pusta lista. Fail-closed: brak roli, rzucony wyjątek,
 * albo audytor bez powiązanego rekordu w `audytorzy` (email z sesji nie pasuje do
 * żadnego wiersza) — zawsze odmowa, nigdy `where` zbudowane z `undefined`.
 */
/**
 * MAJOR 1 (recenzja `rls-security-auditor` po zamknięciu GREEN 1/3): kształt sukcesu
 * pisany jawnie, pole po polu — dokładnie to, co dziś buduje `narrowedLeads` niżej.
 * `leads: any[]` cofało zawężenie typu zamknięte przez SEC-LEADS-LIST-MINIMIZE/
 * SEC-LEADS-LIST-SCALARS (odczyt usuniętego pola przestawał dawać błąd kompilacji).
 * Discriminowana unia jawna (nie `Extract<Awaited<ReturnType<typeof getLeads>>, …>`
 * wywnioskowane z ciała funkcji) — TypeScript przy wnioskowaniu zwrotu z wielu
 * niejednorodnych `return` w jednej funkcji dokleja do każdego wariantu unii
 * brakujące klucze jako `?: undefined` (obserwowalne przez `tsc`), co psuje
 * zawężanie operatorem `in` w miejscach wywołania (`leads/page.tsx`,
 * `leads-list-minimize.test.ts`) — jawna unia tego nie robi.
 */
export type GetLeadsResult =
  | {
      leads: Array<{
        id: string;
        status: LeadStatus | null;
        created_at: Date;
        data_rezerwacji: Date | null;
        estymowana_wycena: string | null;
        quoted_at: Date | null;
        klient: { id: string; imie_i_nazwisko: string | null } | null;
        adres: { ulica_miasto: string | null } | null;
        instalacje: Array<{ zespol: { nazwa: string } | null }>;
        audytor: { id: string; imie_i_nazwisko: string } | null;
      }>;
      totalCount: number;
      totalPages: number;
      stageCounts: Record<string, number>;
    }
  | { success: false; error: string };

export async function getLeads(options?: {
  status?: LeadStatus | "ALL",
  bucket?: string,
  page?: number,
  limit?: number
}): Promise<GetLeadsResult> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Nie udało się zweryfikować uprawnień." };
  }

  const access = actorRole ? can(actorRole, "leads", "read") : "no";
  if (access !== "yes" && access !== "own") {
    return { success: false, error: "Brak uprawnień do przeglądania leadów." };
  }

  let scopeWhere: { audytor_id: string } | undefined;
  if (access === "own") {
    const { data: { user } } = await getCurrentUser();
    if (!user?.email) {
      return { success: false, error: "Brak sesji użytkownika." };
    }

    const matches = await prisma.audytorzy.findMany({
      where: { email: user.email },
      select: { id: true, is_active: true },
      take: 2,
    });
    if (matches.length !== 1 || matches[0].is_active === false) {
      return { success: false, error: "Nie znaleziono powiązanego konta audytora." };
    }
    scopeWhere = { audytor_id: matches[0].id };
  }

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

    if (scopeWhere) {
      where = { ...where, ...scopeWhere };
    }

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
        // SEC-LEADS-LIST-SCALARS: skalary samego leada zawężone do dokładnie sześciu
        // pól faktycznie zużywanych przez widok listy. Dopisanie kolejnego pola tutaj
        // wymaga zmiany wymagania w kontrakcie, a przy polu wrażliwym — osobnego ID
        // i decyzji człowieka (patrz WO SEC-LEADS-LIST-SCALARS, rozstrzygnięcie AC10).
        select: {
          id: true,
          status: true,
          created_at: true,
          data_rezerwacji: true,
          estymowana_wycena: true,
          quoted_at: true,
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
        where: scopeWhere,
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

    // SEC-LEADS-LIST-MINIMIZE / SEC-LEADS-LIST-SCALARS: reshape jawnie na wyjściu,
    // spójnie z getAuditors()/getCrews() w tym pliku — `select` zawęża zapytanie,
    // mapowanie jest drugą linią obrony (i jedyną, którą widać w testach mockujących
    // samo findMany()). Bez `...lead` — każde pole wypisane jawnie, żeby przyszłe
    // rozszerzenie `select` nie wyciekło do klienta bez niczyjej decyzji.
    const narrowedLeads = leads.map((lead) => ({
      id: lead.id,
      status: lead.status,
      created_at: lead.created_at,
      data_rezerwacji: lead.data_rezerwacji,
      estymowana_wycena: lead.estymowana_wycena,
      quoted_at: lead.quoted_at,
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

/**
 * KPI-DASHBOARD: wersja `getLeads()` okrojona wyłącznie do `groupBy` po statusie —
 * dashboard potrzebuje samych liczników lejka, nie pełnej strony wyników (leady,
 * paginacja). Autoryzacja i zawężenie `audytor:own` identyczne jak w `getLeads()`
 * (SEC-RLS-AUDITOR-SCOPE) — Prisma omija RLS, więc bramka musi żyć tutaj, nie tylko
 * w funkcji-siostrze.
 */
export async function getLeadStageCounts(): Promise<Record<string, number>> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return {};
  }

  const access = actorRole ? can(actorRole, "leads", "read") : "no";
  if (access !== "yes" && access !== "own") {
    return {};
  }

  let scopeWhere: { audytor_id: string } | undefined;
  if (access === "own") {
    const { data: { user } } = await getCurrentUser();
    if (!user?.email) {
      return {};
    }

    const matches = await prisma.audytorzy.findMany({
      where: { email: user.email },
      select: { id: true, is_active: true },
      take: 2,
    });
    if (matches.length !== 1 || matches[0].is_active === false) {
      return {};
    }
    scopeWhere = { audytor_id: matches[0].id };
  }

  try {
    const statusGroups = await prisma.leady.groupBy({
      by: ['status'],
      where: scopeWhere,
      _count: {
        id: true
      }
    });

    const stageCounts = statusGroups.reduce((acc, curr) => {
      if (curr.status) {
        acc[curr.status] = curr._count.id;
      }
      return acc;
    }, {} as Record<string, number>);

    const allCount = Object.values(stageCounts).reduce((sum, c) => sum + c, 0);
    stageCounts["ALL"] = allCount;

    return stageCounts;
  } catch (error) {
    console.error("Failed to fetch lead stage counts:", error);
    return {};
  }
}

/**
 * KPI-DASHBOARD: liczba leadów "opóźnionych" dla kafelka na dashboardzie. Odtwarza
 * DOKŁADNIE warunek `isDelayed` z `leads-client.tsx` (status NEW_LEAD, ponad 24h od
 * `created_at`) — nie jest to próg z `SLA` (kontrakt go nie definiuje), więc licznik
 * musi pozostać spójny z JEDYNYM istniejącym miejscem tej definicji, zamiast tworzyć
 * drugą, niezależną wersję progu "opóźniony" (dokładnie pułapka opisana w CLAUDE.md).
 * Autoryzacja i zawężenie `audytor:own` identyczne jak w `getLeads()`/`getLeadStageCounts()`.
 */
export async function getDelayedNewLeadsCount(): Promise<number> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return 0;
  }

  const access = actorRole ? can(actorRole, "leads", "read") : "no";
  if (access !== "yes" && access !== "own") {
    return 0;
  }

  let scopeWhere: { audytor_id: string } | undefined;
  if (access === "own") {
    const { data: { user } } = await getCurrentUser();
    if (!user?.email) {
      return 0;
    }

    const matches = await prisma.audytorzy.findMany({
      where: { email: user.email },
      select: { id: true, is_active: true },
      take: 2,
    });
    if (matches.length !== 1 || matches[0].is_active === false) {
      return 0;
    }
    scopeWhere = { audytor_id: matches[0].id };
  }

  try {
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return await prisma.leady.count({
      where: {
        status: "NEW_LEAD",
        created_at: { lt: twentyFourHoursAgo },
        ...scopeWhere,
      },
    });
  } catch (error) {
    console.error("Failed to count delayed leads:", error);
    return 0;
  }
}

/**
 * Dozwolone przejścia statusów w lejku sprzedażowym.
 * Klucz = obecny status, wartość = lista dozwolonych statusów docelowych.
 */
const ALLOWED_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  NEW_LEAD: ["AWAITING_AUDIT"],
  // SEC-AUDIT-LOG-MANUAL-STATUS (Fala C, K2, decyzja człowieka 2026-09-04):
  // AWAITING_AUDIT -> NEW_LEAD USUNIĘTE z tej mapy. Kontrakt nie zna tego przejścia
  // (brak w TRANSITIONS) — to nie jest legalny wyjątek do audytu, to dziura w
  // regule, którą trzeba będzie dopisać do kontraktu świadomie, osobnym ID.
  AWAITING_AUDIT: ["AUDIT_COMPLETED"],
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



/**
 * Przesuwa leada do nowego statusu z walidacją dozwolonych przejść.
 *
 * SEC-AUDIT-LOG-MANUAL-STATUS (Fala C): `input` jest opcjonalny w TypeScript (żeby
 * przejścia normalne kompilowały się bez niego), ale warunkowo wymagany w runtime —
 * gdy znalezione przejście kontraktowe jest klasyfikowane jako ręczne
 * (`isManualStatusChange`), `input` musi przejść `deleteJustificationSchema`, inaczej
 * odmowa bez zapisu. Dla przejść normalnych `input`, jeśli podany, jest ignorowany.
 *
 * K2 (przejście, którego kontrakt nie zna, np. AWAITING_AUDIT -> NEW_LEAD): TWARDA
 * ODMOWA, zero zapisu, zero wpisu audytowego — decyzja człowieka 2026-09-04, to nie
 * jest legalny wyjątek do zaaudytowania, to dziura w kontrakcie.
 *
 * Naprawa `advanceLeadStatus` jako maszyny stanów (guardy, efekty, `canTransition`)
 * jest POZA ZAKRESEM tego WO — dokumentujemy i audytujemy istniejące zachowanie,
 * nie naprawiamy go (osobne ID: `FNL-ADVANCE-STATUS-CONTRACT-BOUND`).
 */
export async function advanceLeadStatus(
  leadId: string,
  targetStatus: LeadStatus,
  input?: DeleteJustificationInput,
): Promise<{ success: boolean; error?: string }> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Nie udało się zmienić statusu leada." };
  }
  if (!actorRole || can(actorRole, "leads", "update") !== "yes") {
    return { success: false, error: "Brak uprawnień do zmiany statusu leada." };
  }

  let actorEmail: string | undefined;
  try {
    const {
      data: { user },
    } = await getCurrentUser();
    actorEmail = user?.email ?? undefined;
  } catch (error) {
    console.error("Failed to resolve actor email:", error);
    return { success: false, error: "Nie udało się zmienić statusu leada." };
  }
  if (!actorEmail) {
    return { success: false, error: "Brak uprawnień do zmiany statusu leada." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Blokada wiersza leada (pułapka 4 z CLAUDE.md), wzorzec identyczny z
      // `bypassLogisticsOrder`/`rollbackLogisticsOrder`: serializuje dostęp do
      // TEGO wiersza między równoległymi wywołaniami `advanceLeadStatus`.
      await tx.$queryRaw<{ id: string; status: string }[]>`
        SELECT id, status FROM leady WHERE id = ${leadId}::uuid FOR UPDATE
      `;

      const lead = await tx.leady.findUnique({
        where: { id: leadId },
        select: { status: true, audytor_id: true },
      });

      if (!lead || !lead.status) {
        throw new Error("Lead nie został znaleziony.");
      }

      const currentStatus = lead.status as LeadStatus;
      const allowed = ALLOWED_TRANSITIONS[currentStatus] || [];

      if (!allowed.includes(targetStatus)) {
        throw new Error(
          `Przejście z „${currentStatus}" do „${targetStatus}" nie jest dozwolone.`,
        );
      }

      // Walidacja biznesowa: E1→E2 wymaga audytora
      if (targetStatus === "AWAITING_AUDIT" && !lead.audytor_id) {
        throw new Error("Najpierw przypisz audytora do tego leada.");
      }

      // K2 — przejście, którego kontrakt nie zna: twarda odmowa, zero zapisu.
      const transition = findTransitionByFromTo(currentStatus, targetStatus);
      if (!transition) {
        throw new Error(
          `Przejście z „${currentStatus}" do „${targetStatus}" nie istnieje w kontrakcie.`,
        );
      }

      const isManual = isManualStatusChange(transition.id);
      let validatedInput: DeleteJustificationInput | undefined;
      if (isManual) {
        const parsed = deleteJustificationSchema.safeParse(input);
        if (!parsed.success) {
          throw new Error("Nieprawidłowe uzasadnienie.");
        }
        validatedInput = parsed.data;
      }

      // Bucket timestamp
      const isBucket = targetStatus === "QUOTE_REJECTED" || targetStatus === "ROLLBACK_RESCHEDULING";

      await tx.leady.update({
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

      if (isManual && validatedInput) {
        await tx.auditLog.create({
          data: {
            operation: "manual_status_change",
            resource: "leads",
            recordId: leadId,
            actorEmail,
            actorRole,
            justification: validatedInput.justification,
            legalBasis: validatedInput.legalBasis,
          },
        });
      }
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
export async function deleteLeadAction(
  id: string,
  input: DeleteJustificationInput
): Promise<DeleteActionResult> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Brak uprawnień do usunięcia leada." };
  }
  if (!actorRole || can(actorRole, "leads", "delete") !== "yes") {
    return { success: false, error: "Brak uprawnień do usunięcia leada." };
  }

  let actorEmail: string | undefined;
  try {
    const {
      data: { user },
    } = await getCurrentUser();
    actorEmail = user?.email;
  } catch (error) {
    console.error("Failed to resolve actor email:", error);
    return { success: false, error: "Brak uprawnień do usunięcia leada." };
  }
  if (!actorEmail) {
    return { success: false, error: "Brak uprawnień do usunięcia leada." };
  }

  const parsed = deleteJustificationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Nieprawidłowe dane uzasadnienia lub podstawy prawnej." };
  }
  const { justification, legalBasis } = parsed.data;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.leady.delete({
        where: { id }
      });
      await tx.auditLog.create({
        data: {
          operation: 'delete',
          resource: 'leads',
          recordId: id,
          actorEmail,
          actorRole,
          justification,
          legalBasis,
        },
      });
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
  resolution: ReturnToFunnelResolution | undefined,
  newPrice: number | undefined,
  input: DeleteJustificationInput
): Promise<{ success: boolean; error?: string }> {
  // BLOCKER (WO CRM-SAFE-RECORD-ACTIONS, REVIEW #2): Prisma omija RLS — sprawdzenie
  // roli musi żyć jawnie w tej akcji, tak samo jak w assignCrewToLead/deleteLeadAction.
  // PERMISSIONS.leads.update = ['admin', 'dyspozytor'].
  const actorRole = await getCurrentActorRole();
  if (!actorRole || can(actorRole, "leads", "update") !== "yes") {
    return { success: false, error: "Brak uprawnień do zwrócenia leada do obiegu." };
  }

  // SEC-AUDIT-LOG-MANUAL-STATUS (AC5): actorEmail wyłącznie z sesji, PRZED transakcją.
  let actorEmail: string | undefined;
  try {
    const {
      data: { user },
    } = await getCurrentUser();
    actorEmail = user?.email ?? undefined;
  } catch (error) {
    console.error("Failed to resolve actor email:", error);
    return { success: false, error: "Brak uprawnień do zwrócenia leada do obiegu." };
  }
  if (!actorEmail) {
    return { success: false, error: "Brak uprawnień do zwrócenia leada do obiegu." };
  }

  // SEC-AUDIT-LOG-MANUAL-STATUS (AC7): uzasadnienie i podstawa prawna walidowane
  // tym samym schematem co delete (deleteJustificationSchema), bez zmiany statusu
  // przy niepoprawnym wejściu.
  const parsedInput = deleteJustificationSchema.safeParse(input);
  if (!parsedInput.success) {
    return { success: false, error: "Nieprawidłowe dane uzasadnienia lub podstawy prawnej." };
  }
  const { justification, legalBasis } = parsedInput.data;

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
        await tx.auditLog.create({
          data: {
            operation: "manual_status_change",
            resource: "leads",
            recordId: leadId,
            actorEmail,
            actorRole,
            justification,
            legalBasis,
          },
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

      await tx.auditLog.create({
        data: {
          operation: "manual_status_change",
          resource: "leads",
          recordId: leadId,
          actorEmail,
          actorRole,
          justification,
          legalBasis,
        },
      });

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
  note: string | undefined,
  input: DeleteJustificationInput
): Promise<{ success: boolean; error?: string }> {
  // BLOCKER (WO CRM-SAFE-RECORD-ACTIONS, REVIEW #2): Prisma omija RLS — sprawdzenie
  // roli musi żyć jawnie w tej akcji, tak samo jak w assignCrewToLead/deleteLeadAction.
  // PERMISSIONS.leads.update = ['admin', 'dyspozytor'].
  const actorRole = await getCurrentActorRole();
  if (!actorRole || can(actorRole, "leads", "update") !== "yes") {
    return { success: false, error: "Brak uprawnień do archiwizacji leada." };
  }

  // SEC-AUDIT-LOG-MANUAL-STATUS (AC5): actorEmail wyłącznie z sesji, PRZED transakcją.
  let actorEmail: string | undefined;
  try {
    const {
      data: { user },
    } = await getCurrentUser();
    actorEmail = user?.email ?? undefined;
  } catch (error) {
    console.error("Failed to resolve actor email:", error);
    return { success: false, error: "Brak uprawnień do archiwizacji leada." };
  }
  if (!actorEmail) {
    return { success: false, error: "Brak uprawnień do archiwizacji leada." };
  }

  // SEC-AUDIT-LOG-MANUAL-STATUS (AC7): uzasadnienie i podstawa prawna walidowane
  // tym samym schematem co delete (deleteJustificationSchema), bez zmiany statusu
  // przy niepoprawnym wejściu.
  const parsedInput = deleteJustificationSchema.safeParse(input);
  if (!parsedInput.success) {
    return { success: false, error: "Nieprawidłowe dane uzasadnienia lub podstawy prawnej." };
  }
  const { justification, legalBasis } = parsedInput.data;

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

      await tx.auditLog.create({
        data: {
          operation: "manual_status_change",
          resource: "leads",
          recordId: leadId,
          actorEmail,
          actorRole,
          justification,
          legalBasis,
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
