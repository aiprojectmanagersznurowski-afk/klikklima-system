import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AUDIT_REQUIREMENTS } from '@klikklima/contracts';

/**
 * Wymaganie: FLD-BASE-LOCATION-EDIT (contracts/requirements.contract.mjs, status TODO,
 * risk HIGH). Kryterium 4: "Każda zmiana [kod_pocztowy_bazowy LUB promien_dzialania_km]
 * tworzy wpis w audit_log z e-mailem i rolą sprawcy oraz wartością przed i po. Dotyczy to
 * OBU ścieżek: pracownika w Field App i administratora w panelu B2B". Ten plik pokrywa
 * WYŁĄCZNIE ścieżkę panelu B2B (updateAuditorAction, updateCrewAction) — Field App to
 * osobna aplikacja i osobny plik testów, poza zakresem tej tury.
 *
 * STAN PRODUKCYJNY W CHWILI PISANIA (implementer-server pracuje równolegle nad tym samym
 * plikiem `actions.ts` w obu rolach): `updateAuditorAction` i `updateCrewAction` DZIŚ nie
 * wywołują `auditLog.create` w ogóle — wywołują wyłącznie `prisma.audytorzy.update` /
 * `prisma.zespoly_monterskie.update`, poza jakąkolwiek transakcją. RED w blokach "tworzy
 * wpis" poniżej jest w tej chwili oczekiwany — dowodem braku implementacji, nie literówki.
 *
 * ═══ ZAŁOŻENIA WYMAGAJĄCE POTWIERDZENIA PRZY REVIEW (nie zgaduję po cichu) ═══
 *
 * 1. SYGNATURA: `updateAuditorAction(id, formData)` / `updateCrewAction(id, formData, newPhotoPath?)`
 *    NIE zyskują nowego parametru `justification`/`legalBasis` sterowanego przez operatora —
 *    w odróżnieniu od `deleteAuditorAction`/`updateAuthorizedUserRoleAction`, kryterium 4
 *    tego wymagania NIE wspomina o polu uzasadnienia w formularzu edycji promienia/kodu
 *    pocztowego (to rutynowa zmiana danych kontaktowych, nie operacja RODO). Zakładam,
 *    że `justification`/`legalBasis` (obowiązkowe NOT NULL w schemacie `audit_log`) są
 *    WYLICZANE PRZEZ SERWER, nie dostarczane przez klienta. Jeśli implementer zdecyduje
 *    inaczej (dodał trzeci parametr), ten plik testów padnie na złej liczbie argumentów —
 *    to sygnał do review, nie do cichej zmiany testu.
 *
 * 2. WARTOŚĆ `operation`: AUDIT_REQUIREMENTS.mustLog (rbac.contract.mjs) ma DZIŚ dokładnie
 *    sześć wartości: delete, anonymize, role_change, contract_override, manual_status_change,
 *    notification_resend — każda już przypisana do osobnego, zarejestrowanego wymagania
 *    potomnego (patrz komentarz w requirements.contract.mjs przy SEC-AUDIT-LOG-DELETE:
 *    "Wymaganie dotyczy WYŁĄCZNIE operacji delete — pozostałe operacje z AUDIT_REQUIREMENTS.
 *    mustLog mają własne wpisy potomne"). ŻADNA z sześciu nie opisuje semantycznie edycji
 *    lokalizacji bazowej. To POTENCJALNA LUKA KONTRAKTU zgłoszona do review/contract-steward
 *    w podsumowaniu tej tury — CHECK w bazie (audit_log_operation_check) odrzuci każdą
 *    wartość spoza tej szóstki. Testy poniżej NIE zgadują, którą z sześciu wybierze
 *    implementer — asertują wyłącznie, że wybrana wartość NALEŻY do zbioru dozwolonego
 *    przez bazę (inaczej zapis padłby na żywej bazie niezależnie od testów na mocku).
 *
 * 3. TRANSAKCYJNOŚĆ (pułapka 2, CLAUDE.md: "Zmiana statusu i kolejka powiadomień to jedna
 *    transakcja"; analogicznie tutaj — zmiana rekordu i wpis audytowy): WO każe sprawdzić,
 *    czy implementer opakował update+auditLog.create w `prisma.$transaction`, i NIE zgadywać,
 *    jeśli nie. Mock `@repo/database` w tym pliku udostępnia TEN SAM zestaw funkcji jako
 *    `prisma.audytorzy`/`prisma.zespoly_monterskie`/`prisma.auditLog` NA SZCZYCIE ORAZ jako
 *    argument `tx` przekazywany do `$transaction` (patrz `sharedPrisma` niżej) — dzięki temu
 *    testy "tworzy wpis" i "nie tworzy wpisu" przechodzą niezależnie od wybranego stylu
 *    (z transakcją albo bez), a osobny test "kolejność wywołań" dowodzi WYŁĄCZNIE, że update
 *    poprzedza auditLog.create — bez założenia, czy dzieje się to w jednej transakcji Prisma.
 *    Wynik statycznej inspekcji `actions.ts` w chwili pisania tego pliku (do zweryfikowania
 *    ponownie po turze implementera): ANI `updateAuditorAction`, ANI `updateCrewAction` nie
 *    zawierają dziś `$transaction` — to zgłoszone w podsumowaniu tury jako otwarte pytanie,
 *    nie jako asercja w tym pliku.
 *
 * Mockujemy @repo/database, next/cache i ../src/utils/supabase/server — wzorzec z
 * sec-audit-log-delete-wave-b.test.ts (createClient, nie getCurrentUser — `updateAuditorAction`
 * i `updateCrewAction` sąsiadują z `deleteAuditorAction`/`deleteCrewAction` w tych samych
 * plikach, które importują `createClient`, nie `getCurrentUser`).
 */

const {
  auditorFindUniqueMock,
  auditorUpdateMock,
  crewFindUniqueMock,
  crewUpdateMock,
  auditLogCreateMock,
  transactionMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getUserMock,
  createClientMock,
} = vi.hoisted(() => ({
  auditorFindUniqueMock: vi.fn(),
  auditorUpdateMock: vi.fn(),
  crewFindUniqueMock: vi.fn(),
  crewUpdateMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
  transactionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
}));

// Ten sam obiekt jest wystawiany jako `prisma.*` NA SZCZYCIE modułu i jako `tx` przekazywany
// do `$transaction` — patrz punkt 3 w komentarzu nagłówkowym.
const sharedPrisma = {
  audytorzy: { findUnique: auditorFindUniqueMock, update: auditorUpdateMock },
  zespoly_monterskie: { findUnique: crewFindUniqueMock, update: crewUpdateMock },
  auditLog: { create: auditLogCreateMock },
  $transaction: transactionMock,
};

vi.mock('@repo/database', () => ({
  prisma: sharedPrisma,
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  createClient: createClientMock,
}));

const { updateAuditorAction } = await import('../src/app/(dashboard)/auditors/actions');
const { updateCrewAction } = await import('../src/app/(dashboard)/crews/actions');

const ADMIN_EMAIL = 'admin@klikklima.pl';

const EXISTING_AUDITOR = {
  id: 'aud-1',
  imie_i_nazwisko: 'Jan Kowalski',
  telefon: '+48123123123',
  kod_pocztowy_bazowy: '00-001',
  promien_dzialania_km: 50,
};

const EXISTING_CREW = {
  id: 'ekipa-1',
  nazwa: 'Ekipa Warszawa Południe',
  telefon_kontaktowy: '600100200',
  kod_pocztowy_bazowy: '02-100',
  promien_dzialania_km: 50,
};

function buildAuditorFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    imie_i_nazwisko: 'Jan Kowalski',
    telefon: '+48123123123',
    email: 'jan.kowalski@example.com',
    adres: 'Warszawa, ul. Testowa 1',
    nazwa_firmy: 'HVAC Jan Kowalski',
    nip: '1234567890',
    certyfikat_fgaz: 'FGAZ/1/2024',
    doswiadczenie_hvac_lata: '5',
    uprawnienia_sep: 'true',
    preferowane_marki: JSON.stringify(['Daikin', 'Mitsubishi']),
    kod_pocztowy_bazowy: '00-001',
    promien_dzialania_km: '50',
    iban: 'PL61109010140000071219812874',
    fgaz_valid_until: '2027-06-15',
    sep_valid_until: '2028-01-01',
  };
  const merged = { ...base, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    fd.append(key, value);
  }
  return fd;
}

function buildCrewFormData(overrides: Record<string, string> = {}): FormData {
  const fd = new FormData();
  const base: Record<string, string> = {
    nazwa: 'Ekipa Warszawa Południe',
    telefon_kontaktowy: '600100200',
    email: 'ekipa.waw@example.com',
    nip: '1234567890',
    koordynator_imie_nazwisko: 'Jan Kowalski',
    certyfikat_fgaz: 'FGAZ-2026-001',
    uprawnienia_sep: 'true',
    kod_pocztowy_bazowy: '02-100',
    promien_dzialania_km: '50',
    liczba_brygad: '3',
    posiada_wiertnice: 'true',
    iban: 'PL61109010140000071219812874',
    fgaz_valid_until: '2027-06-15',
    sep_valid_until: '2028-01-01',
  };
  const merged = { ...base, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    fd.append(key, value);
  }
  return fd;
}

beforeEach(() => {
  auditorFindUniqueMock.mockReset();
  auditorUpdateMock.mockReset();
  crewFindUniqueMock.mockReset();
  crewUpdateMock.mockReset();
  auditLogCreateMock.mockReset();
  transactionMock.mockReset();
  revalidatePathMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  getUserMock.mockReset();
  createClientMock.mockReset();

  transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(sharedPrisma));
  getCurrentActorRoleMock.mockResolvedValue('admin');
  getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } });
  createClientMock.mockResolvedValue({ auth: { getUser: getUserMock } });
  auditorFindUniqueMock.mockResolvedValue({ ...EXISTING_AUDITOR });
  auditorUpdateMock.mockResolvedValue({});
  crewFindUniqueMock.mockResolvedValue({ ...EXISTING_CREW });
  crewUpdateMock.mockResolvedValue({});
  auditLogCreateMock.mockResolvedValue({ id: 'audit-1' });
});

// ───────────────────────────── updateAuditorAction ─────────────────────────────

describe('updateAuditorAction — wpis audytowy przy zmianie promienia/kodu pocztowego (FLD-BASE-LOCATION-EDIT)', () => {
  // @REQ: FLD-BASE-LOCATION-EDIT
  it('zmiana promien_dzialania_km tworzy dokładnie jeden wpis w audit_log', async () => {
    await updateAuditorAction('aud-1', buildAuditorFormData({ promien_dzialania_km: '80' }));

    expect(auditLogCreateMock).toHaveBeenCalledTimes(1);
  });

  // @REQ: FLD-BASE-LOCATION-EDIT
  it('zmiana kod_pocztowy_bazowy tworzy dokładnie jeden wpis w audit_log', async () => {
    await updateAuditorAction('aud-1', buildAuditorFormData({ kod_pocztowy_bazowy: '05-500' }));

    expect(auditLogCreateMock).toHaveBeenCalledTimes(1);
  });

  // Asercja negatywna kluczowa: bez niej test nie odróżnia "loguje te dwa pola konkretnie"
  // od "loguje każdą zmianę rekordu" — patrz WO, punkt 3.
  // @REQ: FLD-BASE-LOCATION-EDIT
  it('zmiana WYŁĄCZNIE telefonu (bez zmiany promienia ani kodu pocztowego) NIE tworzy wpisu w audit_log', async () => {
    await updateAuditorAction('aud-1', buildAuditorFormData({ telefon: '+48999999999' }));

    expect(auditorUpdateMock).toHaveBeenCalledTimes(1);
    expect(auditLogCreateMock).not.toHaveBeenCalled();
  });

  // @REQ: FLD-BASE-LOCATION-EDIT
  it('wpis ma actorEmail i actorRole z sesji, resource=auditors, recordId=id zmienianego rekordu, operation w zamkniętej liście AUDIT_REQUIREMENTS.mustLog', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'ktos-inny@klikklima.pl' } } });

    await updateAuditorAction('aud-1', buildAuditorFormData({ promien_dzialania_km: '80' }));

    expect(auditLogCreateMock).toHaveBeenCalledTimes(1);
    const payload = auditLogCreateMock.mock.calls[0][0].data;
    expect(payload.actorEmail).toBe('ktos-inny@klikklima.pl');
    expect(payload.actorRole).toBe('admin');
    expect(payload.resource).toBe('auditors');
    expect(payload.recordId).toBe('aud-1');
    // CHECK w bazie (audit_log_operation_check) odrzuci każdą wartość spoza tej listy —
    // patrz punkt 2 komentarza nagłówkowego (LUKA KONTRAKTU zgłoszona do review).
    expect(AUDIT_REQUIREMENTS.mustLog).toContain(payload.operation);
    expect(AUDIT_REQUIREMENTS.legalBases).toContain(payload.legalBasis);
    // justification NOT NULL, CHECK length(btrim(...)) >= 10 w bazie.
    expect(typeof payload.justification).toBe('string');
    expect(payload.justification.trim().length).toBeGreaterThanOrEqual(10);
  });

  // Kryterium 4: "wartość przed i po". Schemat audit_log NIE ma kolumn before/after
  // (patrz schema.prisma, model AuditLog) — jedynym miejscem, gdzie wartość przed/po
  // może dziś wylądować, jest tekst `justification` (wzorem prefiksu D2 w
  // SEC-AUDIT-LOG-ROLE-CHANGE). Test dowodzi obecności OBU wartości w treści wpisu,
  // bez narzucania dokładnego formatu zdania.
  // @REQ: FLD-BASE-LOCATION-EDIT
  it('wpis przy zmianie promienia zawiera zarówno starą (50), jak i nową (80) wartość', async () => {
    await updateAuditorAction('aud-1', buildAuditorFormData({ promien_dzialania_km: '80' }));

    expect(auditLogCreateMock).toHaveBeenCalledTimes(1);
    const payload = auditLogCreateMock.mock.calls[0][0].data;
    const haystack = JSON.stringify(payload);
    expect(haystack).toContain('50');
    expect(haystack).toContain('80');
  });

  // @REQ: FLD-BASE-LOCATION-EDIT
  it('wpis przy zmianie kodu pocztowego zawiera zarówno stary (00-001), jak i nowy (05-500) kod', async () => {
    await updateAuditorAction('aud-1', buildAuditorFormData({ kod_pocztowy_bazowy: '05-500' }));

    expect(auditLogCreateMock).toHaveBeenCalledTimes(1);
    const payload = auditLogCreateMock.mock.calls[0][0].data;
    const haystack = JSON.stringify(payload);
    expect(haystack).toContain('00-001');
    expect(haystack).toContain('05-500');
  });

  // Dowód, że zapis rekordu poprzedza wpis audytowy — nie zakłada, czy dzieje się to
  // w jednej transakcji Prisma (patrz punkt 3 komentarza nagłówkowego).
  // @REQ: FLD-BASE-LOCATION-EDIT
  it('audytorzy.update jest wywołane PRZED auditLog.create', async () => {
    await updateAuditorAction('aud-1', buildAuditorFormData({ promien_dzialania_km: '80' }));

    expect(auditorUpdateMock).toHaveBeenCalledTimes(1);
    expect(auditLogCreateMock).toHaveBeenCalledTimes(1);
    expect(auditorUpdateMock.mock.invocationCallOrder[0]).toBeLessThan(
      auditLogCreateMock.mock.invocationCallOrder[0],
    );
  });
});

// ───────────────────────────── updateCrewAction ─────────────────────────────

describe('updateCrewAction — wpis audytowy przy zmianie promienia/kodu pocztowego (FLD-BASE-LOCATION-EDIT)', () => {
  // @REQ: FLD-BASE-LOCATION-EDIT
  it('zmiana promien_dzialania_km tworzy dokładnie jeden wpis w audit_log', async () => {
    await updateCrewAction('ekipa-1', buildCrewFormData({ promien_dzialania_km: '80' }));

    expect(auditLogCreateMock).toHaveBeenCalledTimes(1);
  });

  // @REQ: FLD-BASE-LOCATION-EDIT
  it('zmiana kod_pocztowy_bazowy tworzy dokładnie jeden wpis w audit_log', async () => {
    await updateCrewAction('ekipa-1', buildCrewFormData({ kod_pocztowy_bazowy: '05-500' }));

    expect(auditLogCreateMock).toHaveBeenCalledTimes(1);
  });

  // @REQ: FLD-BASE-LOCATION-EDIT
  it('zmiana WYŁĄCZNIE nazwy ekipy (bez zmiany promienia ani kodu pocztowego) NIE tworzy wpisu w audit_log', async () => {
    await updateCrewAction('ekipa-1', buildCrewFormData({ nazwa: 'Ekipa Warszawa Północ' }));

    expect(crewUpdateMock).toHaveBeenCalledTimes(1);
    expect(auditLogCreateMock).not.toHaveBeenCalled();
  });

  // @REQ: FLD-BASE-LOCATION-EDIT
  it('wpis ma actorEmail i actorRole z sesji, resource=crews, recordId=id zmienianego rekordu, operation w zamkniętej liście AUDIT_REQUIREMENTS.mustLog', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'ktos-inny@klikklima.pl' } } });

    await updateCrewAction('ekipa-1', buildCrewFormData({ promien_dzialania_km: '80' }));

    expect(auditLogCreateMock).toHaveBeenCalledTimes(1);
    const payload = auditLogCreateMock.mock.calls[0][0].data;
    expect(payload.actorEmail).toBe('ktos-inny@klikklima.pl');
    expect(payload.actorRole).toBe('admin');
    expect(payload.resource).toBe('crews');
    expect(payload.recordId).toBe('ekipa-1');
    expect(AUDIT_REQUIREMENTS.mustLog).toContain(payload.operation);
    expect(AUDIT_REQUIREMENTS.legalBases).toContain(payload.legalBasis);
    expect(typeof payload.justification).toBe('string');
    expect(payload.justification.trim().length).toBeGreaterThanOrEqual(10);
  });

  // @REQ: FLD-BASE-LOCATION-EDIT
  it('wpis przy zmianie promienia zawiera zarówno starą (50), jak i nową (80) wartość', async () => {
    await updateCrewAction('ekipa-1', buildCrewFormData({ promien_dzialania_km: '80' }));

    expect(auditLogCreateMock).toHaveBeenCalledTimes(1);
    const payload = auditLogCreateMock.mock.calls[0][0].data;
    const haystack = JSON.stringify(payload);
    expect(haystack).toContain('50');
    expect(haystack).toContain('80');
  });

  // @REQ: FLD-BASE-LOCATION-EDIT
  it('wpis przy zmianie kodu pocztowego zawiera zarówno stary (02-100), jak i nowy (05-500) kod', async () => {
    await updateCrewAction('ekipa-1', buildCrewFormData({ kod_pocztowy_bazowy: '05-500' }));

    expect(auditLogCreateMock).toHaveBeenCalledTimes(1);
    const payload = auditLogCreateMock.mock.calls[0][0].data;
    const haystack = JSON.stringify(payload);
    expect(haystack).toContain('02-100');
    expect(haystack).toContain('05-500');
  });

  // @REQ: FLD-BASE-LOCATION-EDIT
  it('zespoly_monterskie.update jest wywołane PRZED auditLog.create', async () => {
    await updateCrewAction('ekipa-1', buildCrewFormData({ promien_dzialania_km: '80' }));

    expect(crewUpdateMock).toHaveBeenCalledTimes(1);
    expect(auditLogCreateMock).toHaveBeenCalledTimes(1);
    expect(crewUpdateMock.mock.invocationCallOrder[0]).toBeLessThan(
      auditLogCreateMock.mock.invocationCallOrder[0],
    );
  });
});
