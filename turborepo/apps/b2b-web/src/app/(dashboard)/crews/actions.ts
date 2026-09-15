"use server"

import { prisma, type Prisma } from "@repo/database"
import { revalidatePath } from "next/cache"
import { can } from "@klikklima/contracts"
import { getCurrentActorRole, createClient } from "../../../utils/supabase/server"
import { crewSchema } from "./schema"
import type { ZodError } from "zod"
import { deleteJustificationSchema, type DeleteJustificationInput } from "../../../lib/audit/delete-justification-schema"
import {
  availabilityRuleSchema,
  writeAvailabilityRuleRaw,
  getEffectiveAvailability,
  type EffectiveAvailabilityDay,
} from "@repo/scheduling"

class CrewBlockedError extends Error {
  result: DeleteCrewResult
  constructor(result: DeleteCrewResult) {
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

  // SEC-EMAIL-UNIQUE: identyfikacja "czyja to ekipa" po e-mailu, nie po `findUnique`
  // (zespoly_monterskie.email nie ma dziś ograniczenia UNIQUE na żywej bazie — patrz WO).
  // Świadomie BEZ sprawdzenia `aktywny`: ta akcja jest rozłączna z blokadą administratora
  // (patrz komentarz nad funkcją) — zablokowana ekipa nadal może zadeklarować niedostępność.
  const matches = await prisma.zespoly_monterskie.findMany({ where: { email: user.email }, take: 2 });
  if (matches.length !== 1) {
    return { success: false, error: "Nie można zmienić dostępności innej ekipy." };
  }
  const own = matches[0];
  if (own.id !== id) {
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

export type SetAvailabilityRuleResult = {
  success: boolean;
  error?: string;
  rule?: { weekday: number; start_time: string; end_time: string; is_active: boolean };
};

/**
 * FLD-AVAIL-WEEKLY-RULES (WO FLD-AVAIL-WEEKLY-RULES, blok A): ekipa zapisuje WŁASNĄ
 * regułę cykliczną dostępności — symetrycznie do auditors/actions.ts
 * setAvailabilityRuleAction. Zasób RBAC to `availability_rules`; wiązanie roli z encją
 * żyje tu, nie w `can()`. Właścicielstwo idzie przez e-mail z sesji, znalezione WŁASNE
 * `id` (nie argument `id`) trafia do zapisu. Walidacja Zod biegnie PRZED jakimkolwiek
 * zapytaniem do bazy; zapis fizyczny idzie przez `writeAvailabilityRuleRaw`
 * (`ON CONFLICT ... DO UPDATE`). Nigdy nie dotyka `zespoly_monterskie.aktywny`/
 * `leave_status` ani `availabilityDeclaration`.
 */
export async function setAvailabilityRuleAction(
  id: string,
  values: { weekday: number; start_time: string; end_time: string; is_active?: boolean }
): Promise<SetAvailabilityRuleResult> {
  const actorRole = await getCurrentActorRole();
  if (actorRole !== 'monter' || can(actorRole, 'availability_rules', 'update') !== 'own') {
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

  const matches = await prisma.zespoly_monterskie.findMany({ where: { email: user.email }, take: 2 });
  if (matches.length !== 1) {
    return { success: false, error: "Nie można zmienić grafiku innej ekipy." };
  }
  const own = matches[0];
  if (own.id !== id) {
    return { success: false, error: "Nie można zmienić grafiku innej ekipy." };
  }

  try {
    const rule = await writeAvailabilityRuleRaw({
      auditorId: null,
      crewId: own.id,
      weekday: parsed.data.weekday,
      startTime: parsed.data.start_time,
      endTime: parsed.data.end_time,
      isActive: parsed.data.is_active,
    });
    revalidatePath('/crews');
    return { success: true, rule };
  } catch (error) {
    console.error("Failed to write crew availability rule:", error);
    return { success: false, error: "Nie udało się zapisać grafiku." };
  }
}

export type GetAvailabilityResult = {
  success: boolean;
  error?: string;
  days?: EffectiveAvailabilityDay[];
};

/**
 * FLD-AVAIL-WEEKLY-RULES (WO FLD-AVAIL-WEEKLY-RULES, blok B): odczyt efektywnej
 * dostępności ekipy — symetrycznie do auditors/actions.ts getAvailabilityAction.
 * Zasób RBAC to `availability_rules`, capability `read` (`admin`/`dyspozytor` →
 * 'yes', czyta dowolny zasób; `monter:own` → 'own', czyta WYŁĄCZNIE własny).
 * Wiązanie roli z encją żyje tu, nie w `can()` — `audytor:own` nie może czytać
 * przez ten plik, mimo że capability wychodzi 'own'.
 */
export async function getAvailabilityAction(
  id: string,
  from: Date,
  to: Date
): Promise<GetAvailabilityResult> {
  const actorRole = await getCurrentActorRole();
  const capability = actorRole ? can(actorRole, 'availability_rules', 'read') : 'no';

  if (capability === 'own') {
    if (actorRole !== 'monter') {
      return { success: false, error: "Brak uprawnień do odczytu grafiku." };
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) {
      return { success: false, error: "Brak sesji użytkownika." };
    }

    const matches = await prisma.zespoly_monterskie.findMany({ where: { email: user.email }, take: 2 });
    if (matches.length !== 1 || matches[0].id !== id) {
      return { success: false, error: "Nie można odczytać grafiku innej ekipy." };
    }
  } else if (capability !== 'yes') {
    return { success: false, error: "Brak uprawnień do odczytu grafiku." };
  }

  const result = await getEffectiveAvailability(id, 'CREW', { from, to });
  return { success: true, days: result.days, error: result.error ?? undefined };
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

  const matches = await prisma.zespoly_monterskie.findMany({ where: { email: user.email }, take: 2 });
  if (matches.length !== 1 || matches[0].aktywny === false) {
    return { success: false, error: "Nie znaleziono własnego rekordu ekipy." };
  }
  const own = matches[0];

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

  const inFlight = createCrewInFlight.get(formData);
  if (inFlight) {
    return inFlight;
  }

  const parsed = crewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = issue?.path.join('.');
    return { success: false, error: field ? `${field}: ${issue.message}` : "Niepoprawne dane formularza." };
  }
  const values = parsed.data;

  const callPromise = (async (): Promise<CreateCrewResult> => {
    try {
      const data: Prisma.zespoly_monterskieCreateInput = {
        nazwa: values.nazwa,
        telefon_kontaktowy: values.telefon_kontaktowy,
        email: values.email,
        nip: values.nip,
        koordynator_imie_nazwisko: values.koordynator_imie_nazwisko,
        certyfikat_fgaz: values.certyfikat_fgaz,
        fgaz_valid_until: values.fgaz_valid_until,
        sep_valid_until: values.sep_valid_until,
        uprawnienia_sep: values.uprawnienia_sep,
        kod_pocztowy_bazowy: values.kod_pocztowy_bazowy,
        promien_dzialania_km: values.promien_dzialania_km,
        liczba_brygad: values.liczba_brygad,
        posiada_wiertnice: values.posiada_wiertnice,
        iban: values.iban,
      };

      const created = await prisma.zespoly_monterskie.create({ data });

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
  fgaz_valid_until: Date | null;
  sep_valid_until: Date | null;
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
    fgaz_valid_until: crew.fgaz_valid_until,
    sep_valid_until: crew.sep_valid_until,
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

  const parsed = crewSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { success: false, error: formatZodError(parsed.error) };
  }
  const values = parsed.data;

  const data: Prisma.zespoly_monterskieUpdateInput = {
    nazwa: values.nazwa,
    telefon_kontaktowy: values.telefon_kontaktowy,
    email: values.email,
    nip: values.nip,
    koordynator_imie_nazwisko: values.koordynator_imie_nazwisko,
    certyfikat_fgaz: values.certyfikat_fgaz,
    uprawnienia_sep: values.uprawnienia_sep,
    kod_pocztowy_bazowy: values.kod_pocztowy_bazowy,
    promien_dzialania_km: values.promien_dzialania_km,
    liczba_brygad: values.liczba_brygad,
    posiada_wiertnice: values.posiada_wiertnice,
    iban: values.iban,
  };

  if (newPhotoPath) {
    data.zdjecie_url = newPhotoPath;
  }

  // formData.has() chroni pola opcjonalne, których fizyczny brak w formularzu
  // NIE może zerować istniejącej wartości.
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
      return { success: false, error: "Nie udało się zapisać zmian ekipy." };
    }
    if (!actorEmail) {
      return { success: false, error: "Nie udało się zapisać zmian ekipy." };
    }
  }

  try {
    if (baseLocationJustification && actorEmail) {
      await prisma.$transaction(async (tx) => {
        await tx.zespoly_monterskie.update({ where: { id }, data });
        await tx.auditLog.create({
          data: {
            operation: 'field_update',
            resource: 'crews',
            recordId: id,
            actorEmail,
            actorRole,
            justification: baseLocationJustification,
            legalBasis: 'OTHER',
          },
        });
      });
    } else {
      await prisma.zespoly_monterskie.update({ where: { id }, data });
    }
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
export async function deleteCrewAction(
  id: string,
  input: DeleteJustificationInput
): Promise<DeleteCrewResult> {
  let actorRole;
  try {
    actorRole = await getCurrentActorRole();
  } catch (error) {
    console.error("Failed to resolve actor role:", error);
    return { success: false, error: "Brak uprawnień do usunięcia ekipy." };
  }
  if (!actorRole || can(actorRole, 'crews', 'delete') !== 'yes') {
    return { success: false, error: "Brak uprawnień do usunięcia ekipy." };
  }

  let actorEmail: string | undefined;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    actorEmail = user?.email;
  } catch (error) {
    console.error("Failed to resolve actor email:", error);
    return { success: false, error: "Brak uprawnień do usunięcia ekipy." };
  }
  if (!actorEmail) {
    return { success: false, error: "Brak uprawnień do usunięcia ekipy." };
  }

  const parsed = deleteJustificationSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Nieprawidłowe dane uzasadnienia lub podstawy prawnej." };
  }
  const { justification, legalBasis } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const crew = await tx.zespoly_monterskie.findUnique({
        where: { id },
        include: { instalacje: true },
      });

      if (!crew) {
        throw new CrewBlockedError({ success: false, error: "Ekipa nie została znaleziona." });
      }

      const blockingInstallations = crew.instalacje.filter((installation: { status: string | null }) =>
        BLOCKING_INSTALLATION_STATUSES.includes(installation.status as (typeof BLOCKING_INSTALLATION_STATUSES)[number])
      );

      if (blockingInstallations.length > 0) {
        throw new CrewBlockedError({
          success: false,
          error: "Nie można usunąć ekipy — ma przypisane aktywne instalacje. Przepnij je najpierw na inną ekipę.",
          blockingInstallations: blockingInstallations.map((installation: { id: string; status: string | null }) => ({
            id: installation.id,
            status: installation.status ?? '',
          })),
        });
      }

      await tx.zespoly_monterskie.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          operation: 'delete',
          resource: 'crews',
          recordId: id,
          actorEmail,
          actorRole,
          justification,
          legalBasis,
        },
      });
      return { success: true };
    });

    if (result.success) {
      revalidatePath('/crews');
    }

    return result;
  } catch (error) {
    if (error instanceof CrewBlockedError) {
      return error.result;
    }
    console.error("Failed to delete crew:", error);
    return { success: false, error: "Wystąpił błąd podczas usuwania ekipy." };
  }
}
