"use server"

import { revalidatePath } from "next/cache"
import { prisma, type Prisma } from "@repo/database"
import { can } from "@klikklima/contracts"
import { getCurrentActorRole, createClient } from "../../../utils/supabase/server"
import { auditorSchema } from "./schema"
import type { ZodError } from "zod"
import { deleteJustificationSchema, type DeleteJustificationInput } from "../../../lib/audit/delete-justification-schema"
import { availabilityRuleSchema } from "../../../lib/schedule/availability-rule-schema"
import { writeAvailabilityRuleRaw } from "../../../lib/schedule/availability-rule"

class AuditorBlockedError extends Error {
  result: DeleteAuditorResult
  constructor(result: DeleteAuditorResult) {
    super("blocked")
    this.result = result
  }
}

function formatZodError(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) {
    return "Niepoprawne dane formularza.";
  }
  const field = issue.path.join('.');
  return field ? `${field}: ${issue.message}` : issue.message;
}

/**
 * FLD-BASE-LOCATION-EDIT (contracts/requirements.contract.mjs): justification jest
 * GENEROWANE PRZEZ SERWER z wartości przed/po — nigdy z parametru wywołania. Format
 * "<Etykieta pola>: <przed> → <po>", puste/null jako "(brak)".
 */
function formatFieldChange(label: string, before: unknown, after: unknown): string {
  const fmt = (v: unknown) => (v === null || v === undefined || v === "" ? "(brak)" : String(v));
  return `${label}: ${fmt(before)} → ${fmt(after)}`;
}

/**
 * Zmiana obu pól w jednym żądaniu daje JEDEN wpis z obiema zmianami rozdzielonymi "; ".
 * Zwraca null, gdy żadne z dwóch pól się nie zmieniło (brak wpisu audytowego).
 */
function buildBaseLocationJustification(
  existing: { kod_pocztowy_bazowy: string | null; promien_dzialania_km: number | null },
  values: { kod_pocztowy_bazowy: string | null; promien_dzialania_km: number | null },
): string | null {
  const parts: string[] = [];
  if (existing.kod_pocztowy_bazowy !== values.kod_pocztowy_bazowy) {
    parts.push(formatFieldChange("Zmiana kodu pocztowego bazowego", existing.kod_pocztowy_bazowy, values.kod_pocztowy_bazowy));
  }
  if (existing.promien_dzialania_km !== values.promien_dzialania_km) {
    parts.push(formatFieldChange("Zmiana promienia działania", existing.promien_dzialania_km, values.promien_dzialania_km));
  }
  return parts.length > 0 ? parts.join("; ") : null;
}

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
  promien_dzialania_km: number | null;
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
    promien_dzialania_km: a.promien_dzialania_km,
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

  // SEC-EMAIL-UNIQUE: identyfikacja "czyj to rekord" po e-mailu, nie po `findUnique`
  // (audytorzy.email nie ma dziś ograniczenia UNIQUE na żywej bazie — patrz WO). Świadomie
  // BEZ sprawdzenia `is_active`: ta akcja jest rozłączna z blokadą administratora (patrz
  // komentarz nad funkcją, D-A WO FLD-AVAILABILITY-SPLIT) — zablokowany audytor nadal może
  // zadeklarować własną niedostępność, to nie jest ścieżka do odblokowania się.
  const matches = await prisma.audytorzy.findMany({ where: { email: user.email }, take: 2 });
  if (matches.length !== 1) {
    return { success: false, error: "Nie można zmienić dostępności innego audytora." };
  }
  const own = matches[0];
  if (own.id !== id) {
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

export type SetAvailabilityRuleResult = {
  success: boolean;
  error?: string;
  rule?: { weekday: number; start_time: string; end_time: string; is_active: boolean };
};

/**
 * FLD-AVAIL-WEEKLY-RULES (WO FLD-AVAIL-WEEKLY-RULES, blok A): audytor zapisuje WŁASNĄ
 * regułę cykliczną dostępności ("poniedziałki 8-16"). Zasób RBAC to `availability_rules`
 * (rbac.contract.mjs) — jeden zasób dla DWÓCH encji (audytorzy + zespoly_monterskie),
 * wiązanie roli z encją więc żyje tu, nie w `can()`. Wzorem `setSelfAvailabilityAction`:
 * właścicielstwo idzie przez e-mail z sesji, znalezione WŁASNE `id` (nie argument
 * `id`) trafia do zapisu.
 *
 * Walidacja Zod (weekday 1-7, end_time > start_time) biegnie PRZED jakimkolwiek
 * zapytaniem do bazy. Zapis fizyczny idzie przez `writeAvailabilityRuleRaw`
 * (`ON CONFLICT ... DO UPDATE`, jedno zapytanie atomowe) — `resource_id` jest kolumną
 * generowaną, niewidoczną dla `prisma.availabilityRule.upsert`. Nigdy nie dotyka
 * `audytorzy.is_active`/`leave_status` ani `availabilityDeclaration` (mechanizmy
 * rozłączne, patrz komentarz nad `setSelfAvailabilityAction`).
 */
export async function setAvailabilityRuleAction(
  id: string,
  values: { weekday: number; start_time: string; end_time: string; is_active?: boolean }
): Promise<SetAvailabilityRuleResult> {
  const actorRole = await getCurrentActorRole();
  if (actorRole !== 'audytor' || can(actorRole, 'availability_rules', 'update') !== 'own') {
    return { success: false, error: "Brak uprawnień do zmiany własnego grafiku." };
  }

  const parsed = availabilityRuleSchema.safeParse(values);
  if (!parsed.success) {
    return { success: false, error: formatZodError(parsed.error) };
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) {
    return { success: false, error: "Brak sesji użytkownika." };
  }

  const matches = await prisma.audytorzy.findMany({ where: { email: user.email }, take: 2 });
  if (matches.length !== 1) {
    return { success: false, error: "Nie można zmienić grafiku innego audytora." };
  }
  const own = matches[0];
  if (own.id !== id) {
    return { success: false, error: "Nie można zmienić grafiku innego audytora." };
  }

  try {
    const rule = await writeAvailabilityRuleRaw({
      auditorId: own.id,
      crewId: null,
      weekday: parsed.data.weekday,
      startTime: parsed.data.start_time,
      endTime: parsed.data.end_time,
      isActive: parsed.data.is_active,
    });
    revalidatePath('/auditors');
    return { success: true, rule };
  } catch (error) {
    console.error("Failed to write auditor availability rule:", error);
    return { success: false, error: "Nie udało się zapisać grafiku." };
  }
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

  const matches = await prisma.audytorzy.findMany({ where: { email: user.email }, take: 2 });
  if (matches.length !== 1 || matches[0].is_active === false) {
    return { success: false, error: "Nie znaleziono własnego rekordu audytora." };
  }
  const own = matches[0];

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

  const parsed = auditorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { success: false, error: formatZodError(parsed.error) };
  }
  const values = parsed.data;

  try {
    const data: Prisma.audytorzyCreateInput = {
      imie_i_nazwisko: values.imie_i_nazwisko,
      telefon: values.telefon,
      email: values.email,
      adres: values.adres,
      nazwa_firmy: values.nazwa_firmy,
      nip: values.nip,
      certyfikat_fgaz: values.certyfikat_fgaz,
      fgaz_valid_until: values.fgaz_valid_until,
      sep_valid_until: values.sep_valid_until,
      doswiadczenie_hvac_lata: values.doswiadczenie_hvac_lata,
      uprawnienia_sep: values.uprawnienia_sep,
      preferowane_marki: values.preferowane_marki,
      kod_pocztowy_bazowy: values.kod_pocztowy_bazowy,
      promien_dzialania_km: values.promien_dzialania_km,
      iban: values.iban,
      zdjecie_url: values.zdjecie_url,
    };

    const created = await prisma.audytorzy.create({ data });

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
  fgaz_valid_until: Date | null;
  sep_valid_until: Date | null;
  doswiadczenie_hvac_lata: number | null;
  uprawnienia_sep: boolean;
  preferowane_marki: string[];
  kod_pocztowy_bazowy: string | null;
  promien_dzialania_km: number | null;
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
    fgaz_valid_until: auditor.fgaz_valid_until,
    sep_valid_until: auditor.sep_valid_until,
    doswiadczenie_hvac_lata: auditor.doswiadczenie_hvac_lata,
    uprawnienia_sep: auditor.uprawnienia_sep,
    preferowane_marki: auditor.preferowane_marki,
    kod_pocztowy_bazowy: auditor.kod_pocztowy_bazowy,
    promien_dzialania_km: auditor.promien_dzialania_km,
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

  const parsed = auditorSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { success: false, error: formatZodError(parsed.error) };
  }
  const values = parsed.data;

  const data: Prisma.audytorzyUpdateInput = {
    imie_i_nazwisko: values.imie_i_nazwisko,
    telefon: values.telefon,
    email: values.email,
    adres: values.adres,
    nazwa_firmy: values.nazwa_firmy,
    nip: values.nip,
    certyfikat_fgaz: values.certyfikat_fgaz,
    doswiadczenie_hvac_lata: values.doswiadczenie_hvac_lata,
    uprawnienia_sep: values.uprawnienia_sep,
    kod_pocztowy_bazowy: values.kod_pocztowy_bazowy,
    promien_dzialania_km: values.promien_dzialania_km,
    iban: values.iban,
  };

  // formData.has() chroni pola opcjonalne, których fizyczny brak w formularzu
  // NIE może zerować istniejącej wartości (odróżnia "nie zmieniono" od "wyczyszczono").
  if (formData.has('preferowane_marki')) {
    data.preferowane_marki = values.preferowane_marki;
  }

  if (formData.has('zdjecie_url')) {
    data.zdjecie_url = values.zdjecie_url;
  }

  if (formData.has('fgaz_valid_until')) {
    data.fgaz_valid_until = values.fgaz_valid_until;
  }

  if (formData.has('sep_valid_until')) {
    data.sep_valid_until = values.sep_valid_until;
  }

  // FLD-BASE-LOCATION-EDIT: kod_pocztowy_bazowy/promien_dzialania_km wymagają wpisu
  // audytowego w TEJ SAMEJ transakcji co zapis rekordu — rekord zmieniony bez wpisu
  // znosi warunek, pod którym edycja tych pól została w ogóle dopuszczona.
  const baseLocationJustification = buildBaseLocationJustification(existing, values);

  let actorEmail: string | undefined;
  if (baseLocationJustification) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      actorEmail = user?.email;
    } catch (error) {
      console.error("Failed to resolve actor email:", error);
      return { success: false, error: "Nie udało się zapisać zmian audytora." };
    }
    if (!actorEmail) {
      return { success: false, error: "Nie udało się zapisać zmian audytora." };
    }
  }

  try {
    if (baseLocationJustification && actorEmail) {
      await prisma.$transaction(async (tx) => {
        await tx.audytorzy.update({ where: { id }, data });
        await tx.auditLog.create({
          data: {
            operation: 'field_update',
            resource: 'auditors',
            recordId: id,
            actorEmail,
            actorRole,
            justification: baseLocationJustification,
            legalBasis: 'OTHER',
          },
        });
      });
    } else {
      await prisma.audytorzy.update({ where: { id }, data });
    }
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
export async function deleteAuditorAction(
  id: string,
  input: DeleteJustificationInput
): Promise<DeleteAuditorResult> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Brak uprawnień do usunięcia audytora." };
  }
  if (!actorRole || can(actorRole, 'auditors', 'delete') !== 'yes') {
    return { success: false, error: "Brak uprawnień do usunięcia audytora." };
  }

  let actorEmail: string | undefined;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    actorEmail = user?.email;
  } catch (error) {
    console.error("Failed to resolve actor email:", error);
    return { success: false, error: "Brak uprawnień do usunięcia audytora." };
  }
  if (!actorEmail) {
    return { success: false, error: "Brak uprawnień do usunięcia audytora." };
  }

  const parsed = deleteJustificationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Nieprawidłowe dane uzasadnienia lub podstawy prawnej." };
  }
  const { justification, legalBasis } = parsed.data;

  let result: DeleteAuditorResult;
  try {
    result = await prisma.$transaction(async (tx) => {
      const auditor = await tx.audytorzy.findUnique({
        where: { id },
        include: { leady: { include: { klient: true } } },
      });

      if (!auditor) {
        throw new AuditorBlockedError({ success: false, error: "Audytor nie został znaleziony." });
      }

      const blockingLeads = auditor.leady.filter((lead: { status: string | null }) =>
        HANGING_LEAD_STATUSES.includes(lead.status as (typeof HANGING_LEAD_STATUSES)[number])
      );

      if (blockingLeads.length > 0) {
        throw new AuditorBlockedError({
          success: false,
          error: "Nie można usunąć audytora — ma przypisane aktywne leady. Przepnij je najpierw na innego audytora.",
          blockingLeads: blockingLeads.map((lead: { id: string; klient?: { imie_i_nazwisko: string | null } | null }) => ({
            id: lead.id,
            clientName: lead.klient?.imie_i_nazwisko ?? null,
          })),
        });
      }

      await tx.audytorzy.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          operation: 'delete',
          resource: 'auditors',
          recordId: id,
          actorEmail,
          actorRole,
          justification,
          legalBasis,
        },
      });
      return { success: true };
    }, { isolationLevel: 'Serializable' });
  } catch (error) {
    if (error instanceof AuditorBlockedError) {
      return error.result;
    }
    console.error("Failed to delete auditor:", error);
    return { success: false, error: "Nie udało się usunąć audytora." };
  }

  if (result.success) {
    revalidatePath('/auditors');
  }

  return result;
}
