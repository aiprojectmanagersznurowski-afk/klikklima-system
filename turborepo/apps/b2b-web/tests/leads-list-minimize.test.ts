import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Wymaganie: SEC-LEADS-LIST-MINIMIZE (contracts/requirements.contract.mjs, status TODO,
 * dopisane 2026-08-25 przy przeglądzie apps/b2b-web/src/app/(dashboard)/leads/actions.ts,
 * funkcja getLeads()).
 *
 * Ta sama zasada minimalizacji danych po stronie odczytu co SEC-ASSIGNMENT-POOL-MINIMIZE
 * (patrz leads-pool-minimize.test.ts), tyle że zastosowana do zapytania LISTY leadów, a nie
 * do puli przypisania. Dziś `getLeads()` woła `prisma.leady.findMany()` z
 * `include: { klient: true, adres: true, instalacje: { include: { zespol: true } },
 * audytor: true }` — komplet zagnieżdżonych rekordów Prismy trafia do przeglądarki
 * dyspozytora, do pięćdziesięciu na stronę.
 *
 * Pole `audytor` jest JUŻ zawężone przez SEC-ASSIGNMENT-POOL-MINIMIZE — świadomie POZA
 * zakresem tego pliku (nie testujemy go tu ponownie, żeby nie kolidować z tamtym testem/
 * tamtą implementacją). Ten plik testuje WYŁĄCZNIE `klient`, `adres`, `instalacje.zespol`.
 *
 * Konsument (leads-client.tsx, sprawdzone czytaniem pliku) czyta z tych trzech relacji
 * dokładnie: `lead.klient?.imie_i_nazwisko` (linia ~177, ~326), `lead.adres?.ulica_miasto`
 * (linia ~327), `lead.instalacje?.[0]?.zespol?.nazwa` (linia ~332). Docelowy, wąski kształt:
 *   - klient: { id, imie_i_nazwisko } (id jako rozsądne minimum identyfikacyjne — nie
 *     wrażliwe, choć nieczytane wprost gdzie indziej w tym pliku)
 *   - adres: { ulica_miasto }
 *   - instalacje: [{ zespol: { nazwa } | null }]
 *
 * `leads/[id]/page.tsx` jest ŚWIADOMIE poza zakresem — osobne zapytanie `findUnique()`,
 * nie korzysta z `getLeads()`, i tam pełne dane kontaktowe są uzasadnione (ekran istnieje
 * po to, żeby zadzwonić/napisać do klienta).
 *
 * `where`/`orderBy`/`skip`/`take`/`groupBy` (liczniki statusów) MUSZĄ zostać nietknięte —
 * ten plik nie testuje ich od zera (nie miały testu przed tą zmianą — poza zakresem), ale
 * kontrola pozytywna dowodzi pośrednio, że wywołanie nadal przechodzi te argumenty.
 *
 * Mockowanie `@repo/database` i `next/cache` wzorem leads-pool-minimize.test.ts /
 * availability-pool-filter.test.ts — `next/cache` mockowane defensywnie, bo cały moduł
 * actions.ts importuje `revalidatePath` na górze pliku.
 *
 * Dopisane po SEC-RLS-AUDITOR-SCOPE: `getLeads()` woła teraz `getCurrentActorRole()`
 * (`../src/utils/supabase/server`, wzorem leads-auditor-scope.test.ts) i fail-closed
 * odmawia bez zamockowanej roli. Ten plik testuje WYŁĄCZNIE minimalizację pól/skalarów
 * (SEC-LEADS-LIST-MINIMIZE/SEC-LEADS-LIST-SCALARS), nie autoryzację — rola jest tu
 * zamockowana na stałe jako 'dyspozytor' (pełny dostęp, bez filtra audytor_id), żeby
 * każdy istniejący test kontynuował sprawdzanie dokładnie tego, co sprawdzał wcześniej.
 * Autoryzacja/zawężenie audytora ma własny, zamknięty plik: leads-auditor-scope.test.ts.
 */

const {
  leadFindManyMock,
  leadCountMock,
  leadGroupByMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
} = vi.hoisted(() => ({
  leadFindManyMock: vi.fn(),
  leadCountMock: vi.fn(),
  leadGroupByMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    leady: {
      findMany: leadFindManyMock,
      count: leadCountMock,
      groupBy: leadGroupByMock,
    },
  },
  LeadStatus: {},
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}));
// P0-1 (przygotowanie pod przyszłą turę): domyślny brak sesji — ten plik nie testuje ścieżek zależnych od tożsamości poprzez createClient(), więc `getCurrentUser` dostaje bezpieczny, jawny fallback zamiast pozostać niezdefiniowanym mockiem.
getCurrentUserMock.mockResolvedValue({ data: { user: null } });

const { getLeads } = await import('../src/app/(dashboard)/leads/actions');

/**
 * Odmowa (`{ success: false, error }`) jest poza zakresem tego pliku (należy do
 * SEC-RLS-AUDITOR-SCOPE / leads-auditor-scope.test.ts). Rola jest tu zawsze zamockowana
 * na 'dyspozytor', więc `getLeads()` zawsze zwraca kształt sukcesu — to jawne zawężenie
 * typu unii pozwala reszcie plików kontynuować destrukturyzację `leads` bez zmiany
 * intencji testu (por. wzorzec narrowingu z WO).
 */
async function getLeadsExpectSuccess(...args: Parameters<typeof getLeads>) {
  const result = await getLeads(...args);
  // GetLeadsResult nie niesie klucza `success` w ogóle (patrz actions.ts) — tylko
  // odmowa ma `{ success: false, error }`. Obecność `leads` jest dowodem sukcesu.
  if (!('leads' in result)) {
    throw new Error(`Nieoczekiwana odmowa w teście minimalizacji: ${result.error}`);
  }
  return result;
}

/**
 * Zbiór nazw pól wrażliwych. Forma niezależna od dzisiejszych nazw kolumn (ADR-002 czeka
 * na przemianowanie), wzorem SENSITIVE_FIELD_NAMES w leads-pool-minimize.test.ts —
 * `telefon`/`phone`, `email` klienta; `iban`, `nip`, `telefon_kontaktowy`/`contact_phone`,
 * `email` ekipy; `latitude`, `longitude` adresu.
 */
const SENSITIVE_FIELD_NAMES = new Set([
  'telefon',
  'phone',
  'email',
  'iban',
  'nip',
  'telefon_kontaktowy',
  'contact_phone',
  'latitude',
  'longitude',
]);

const CLIENT_KEYS = ['id', 'imie_i_nazwisko'];
const ADDRESS_KEYS = ['ulica_miasto'];
const CREW_IN_INSTALLATION_KEYS = ['nazwa'];
const AUDITOR_KEYS = ['id', 'imie_i_nazwisko'];

/** Rekord klienta TAKI, JAKI DZIŚ zwraca `include: { klient: true }` bez select — komplet
 * kolumn kontaktowych i osobowych. */
const fullClientRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'klient-1',
  imie_i_nazwisko: 'Anna Wiśniewska',
  telefon: '+48601111222',
  email: 'anna.wisniewska@example.com',
  created_at: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

/** Rekord adresu TAKI, JAKI DZIŚ zwraca `include: { adres: true } }` bez select —
 * włącznie ze współrzędnymi geograficznymi, których lista nie renderuje. */
const fullAddressRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'adres-1',
  ulica_miasto: 'ul. Chłodnicza 5, Warszawa',
  latitude: 52.2297,
  longitude: 21.0122,
  ...overrides,
});

/** Rekord ekipy zagnieżdżony w instalacji TAKI, JAKI DZIŚ zwraca
 * `instalacje: { include: { zespol: true } } }` bez select — komplet danych
 * rozliczeniowych/kontaktowych ekipy. */
const fullCrewRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'crew-1',
  nazwa: 'Ekipa Warszawa',
  telefon_kontaktowy: '+48601200300',
  email: 'ekipa.warszawa@klikklima.pl',
  iban: 'PL27114020040000300201355387',
  nip: '9876543210',
  aktywny: true,
  ...overrides,
});

const fullInstallationRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'inst-1',
  lead_id: 'lead-1',
  zespol_id: 'crew-1',
  zespol: fullCrewRecord(),
  ...overrides,
});

/** Rekord audytora TAKI, JAKI DZIŚ zwróciłoby `audytor: true` (mutant SEC-ASSIGNMENT-POOL-
 * MINIMIZE) — komplet danych osobowych/rozliczeniowych, których lista dyspozytora nie ma
 * prawa nieść (por. fullCrewRecord powyżej, ta sama luka co dla zespol_id). Używany tu
 * WYŁĄCZNIE jako fixture wejściowa (co zwróciłby Prisma bez select) — asercje sprawdzają,
 * że `getLeads()` i sam kształt zapytania to zawężają, niezależnie od tego, co zwróci mock. */
const fullAuditorRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'audytor-1',
  imie_i_nazwisko: 'Jan Kowalski',
  telefon: '+48601333444',
  email: 'jan.kowalski@klikklima.pl',
  iban: 'PL61109010140000071219812874',
  nip: '1234567890',
  is_active: true,
  ...overrides,
});

const fullLeadRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'lead-1',
  status: 'AWAITING_CREW_ASSIGNMENT',
  klient: fullClientRecord(),
  adres: fullAddressRecord(),
  instalacje: [fullInstallationRecord()],
  audytor: fullAuditorRecord(),
  ...overrides,
});

describe('getLeads() — minimalizacja pól zagnieżdżonych relacji (SEC-LEADS-LIST-MINIMIZE)', () => {
  beforeEach(() => {
    leadFindManyMock.mockReset();
    leadCountMock.mockReset();
    leadGroupByMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    leadCountMock.mockResolvedValue(1);
    leadGroupByMock.mockResolvedValue([]);
    // Poza zakresem tego pliku (SEC-RLS-AUDITOR-SCOPE): rola pełnego dostępu, bez
    // filtra audytor_id, żeby testy minimalizacji kontynuowały sprawdzanie tego,
    // co sprawdzały przed dodaniem bramki roli — patrz leads-auditor-scope.test.ts.
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
  });

  // Kryterium #1 z kontraktu: dowód KSZTAŁTEM (Object.keys jako równość zbiorów), nie
  // toBeUndefined() na pojedynczych polach.
  // @REQ: SEC-LEADS-LIST-MINIMIZE
  it('lead.klient ma DOKŁADNIE zbiór kluczy {id, imie_i_nazwisko} — bez i jednej kolumny więcej', async () => {
    leadFindManyMock.mockResolvedValue([fullLeadRecord()]);

    const { leads } = await getLeadsExpectSuccess();

    expect(leads).toHaveLength(1);
    expect(new Set(Object.keys(leads[0].klient as object))).toEqual(new Set(CLIENT_KEYS));
  });

  // @REQ: SEC-LEADS-LIST-MINIMIZE
  it('lead.adres ma DOKŁADNIE zbiór kluczy {ulica_miasto} — bez id, bez współrzędnych', async () => {
    leadFindManyMock.mockResolvedValue([fullLeadRecord()]);

    const { leads } = await getLeadsExpectSuccess();

    expect(new Set(Object.keys(leads[0].adres as object))).toEqual(new Set(ADDRESS_KEYS));
  });

  // @REQ: SEC-LEADS-LIST-MINIMIZE
  it('lead.instalacje[0].zespol ma DOKŁADNIE zbiór kluczy {nazwa} — bez iban/nip/kontaktów ekipy', async () => {
    leadFindManyMock.mockResolvedValue([fullLeadRecord()]);

    const { leads } = await getLeadsExpectSuccess();

    const zespol = leads[0].instalacje[0].zespol as object;
    expect(new Set(Object.keys(zespol))).toEqual(new Set(CREW_IN_INSTALLATION_KEYS));
  });

  // Domknięcie luki z recenzji rls-security-auditor po SEC-LEADS-LIST-MINIMIZE: `audytor`
  // jest już zawężony przez SEC-ASSIGNMENT-POOL-MINIMIZE, ale żaden test w TYM zapytaniu
  // (getLeads(), a nie puli przypisania z leads-pool-minimize.test.ts) tego nie pilnował —
  // mutant `audytor: true` (pełny rekord z iban/nip/telefon/email) przechodził cały pakiet
  // bez czerwonego testu. Dowód KSZTAŁTEM (Object.keys jako równość zbiorów), tym samym
  // wzorem co klient/adres/zespol powyżej — nie samym `toBeUndefined()` na polach wrażliwych.
  // @REQ: SEC-ASSIGNMENT-POOL-MINIMIZE
  it('lead.audytor ma DOKŁADNIE zbiór kluczy {id, imie_i_nazwisko} — bez iban/nip/telefon/email', async () => {
    leadFindManyMock.mockResolvedValue([fullLeadRecord()]);

    const { leads } = await getLeadsExpectSuccess();

    expect(new Set(Object.keys(leads[0].audytor as object))).toEqual(new Set(AUDITOR_KEYS));
  });

  // Kryterium #2: pola wrażliwe nie występują pod ŻADNĄ nazwą — iteracja po kluczach klienta
  // i ekipy, nie odpytywanie pojedynczych, z góry ustalonych nazw.
  // @REQ: SEC-LEADS-LIST-MINIMIZE
  it('żaden zwrócony klucz klienta, adresu ani ekipy nie należy do zbioru pól wrażliwych (telefon, email, iban, nip, telefon_kontaktowy, latitude, longitude)', async () => {
    leadFindManyMock.mockResolvedValue([fullLeadRecord()]);

    const { leads } = await getLeadsExpectSuccess();
    const [lead] = leads;

    const leakedClientKeys = Object.keys(lead.klient as object).filter((k) => SENSITIVE_FIELD_NAMES.has(k));
    const leakedAddressKeys = Object.keys(lead.adres as object).filter((k) => SENSITIVE_FIELD_NAMES.has(k));
    const leakedCrewKeys = Object.keys(lead.instalacje[0].zespol as object).filter((k) =>
      SENSITIVE_FIELD_NAMES.has(k)
    );

    expect(leakedClientKeys).toEqual([]);
    expect(leakedAddressKeys).toEqual([]);
    expect(leakedCrewKeys).toEqual([]);
  });

  // Kryterium #3: zawężenie zadeklarowane w SAMYM zapytaniu (select), włącznie z relacjami
  // zagnieżdżonymi — nie w map po jego wykonaniu. Dzisiejszy kod woła
  // findMany({ where, orderBy, skip, take, include }) BEZ select.
  // @REQ: SEC-LEADS-LIST-MINIMIZE
  it('prisma.leady.findMany() jest wołane z jawnym `select` (nie `include` pełnych relacji), zagnieżdżonym też dla klient/adres/instalacje.zespol', async () => {
    leadFindManyMock.mockResolvedValue([fullLeadRecord()]);

    await getLeads();

    expect(leadFindManyMock).toHaveBeenCalledTimes(1);
    const callArgs = leadFindManyMock.mock.calls[0]?.[0] ?? {};

    // Nie wolno wciągać całych relacji przez include: true.
    expect(callArgs.include).toBeUndefined();
    expect(callArgs.select).toBeTruthy();

    const clientSelect = callArgs.select.klient;
    const addressSelect = callArgs.select.adres;
    const installationsSelect = callArgs.select.instalacje;

    expect(clientSelect).not.toBe(true);
    expect(addressSelect).not.toBe(true);
    expect(installationsSelect).not.toBe(true);

    const clientSelectedKeys = Object.entries(clientSelect?.select ?? {})
      .filter(([, v]) => v === true)
      .map(([k]) => k);
    const addressSelectedKeys = Object.entries(addressSelect?.select ?? {})
      .filter(([, v]) => v === true)
      .map(([k]) => k);

    for (const key of clientSelectedKeys) {
      expect(SENSITIVE_FIELD_NAMES.has(key)).toBe(false);
    }
    for (const key of addressSelectedKeys) {
      expect(SENSITIVE_FIELD_NAMES.has(key)).toBe(false);
    }

    // instalacje.zespol musi też być select, nie include całości.
    const installationZespolSelect = installationsSelect?.select?.zespol ?? installationsSelect?.include?.zespol;
    expect(installationZespolSelect).not.toBe(true);
    const zespolSelectedKeys = Object.entries(installationZespolSelect?.select ?? {})
      .filter(([, v]) => v === true)
      .map(([k]) => k);
    for (const key of zespolSelectedKeys) {
      expect(SENSITIVE_FIELD_NAMES.has(key)).toBe(false);
    }
  });

  // Domknięcie luki z recenzji rls-security-auditor po SEC-LEADS-LIST-MINIMIZE: asercja na
  // KSZTAŁCIE ARGUMENTÓW wywołania (select.audytor jako obiekt select, nie `true`), nie tylko
  // na wyjściu funkcji — inaczej mutant `audytor: true` z narrowedLeads.map() jawnie
  // przycinającym pola mógłby ukryć wyciek na poziomie zapytania (mapowanie jest DRUGĄ
  // linią obrony, pierwszą jest samo `select` przekazane do Prismy, patrz komentarz w
  // actions.ts przy SEC-LEADS-LIST-MINIMIZE).
  // @REQ: SEC-ASSIGNMENT-POOL-MINIMIZE
  it('prisma.leady.findMany() jest wołane z select.audytor jako obiektem { select: { id, imie_i_nazwisko } }, nie `true`', async () => {
    leadFindManyMock.mockResolvedValue([fullLeadRecord()]);

    await getLeads();

    const callArgs = leadFindManyMock.mock.calls[0]?.[0] ?? {};
    expect(callArgs.select.audytor).toEqual({ select: { id: true, imie_i_nazwisko: true } });
  });

  // Kryterium #4: where/orderBy/skip/take/groupBy NIETKNIĘTE — zawężenie kolumn nie może
  // przy okazji zgubić filtra/sortowania/stronicowania.
  // @REQ: SEC-LEADS-LIST-MINIMIZE
  it('where/orderBy/skip/take przekazane do findMany oraz osobne groupBy liczące statusy zostają zachowane', async () => {
    leadFindManyMock.mockResolvedValue([fullLeadRecord()]);
    leadCountMock.mockResolvedValue(7);
    leadGroupByMock.mockResolvedValue([{ status: 'NEW_LEAD', _count: { id: 3 } }]);

    const result = await getLeadsExpectSuccess({ status: 'NEW_LEAD', page: 2, limit: 10 });

    const callArgs = leadFindManyMock.mock.calls[0]?.[0] ?? {};
    expect(callArgs.where).toEqual({ status: 'NEW_LEAD' });
    expect(callArgs.orderBy).toEqual([{ data_rezerwacji: 'asc' }, { created_at: 'desc' }]);
    expect(callArgs.skip).toBe(10);
    expect(callArgs.take).toBe(10);

    expect(leadGroupByMock).toHaveBeenCalledTimes(1);
    expect(result.stageCounts.NEW_LEAD).toBe(3);
    expect(result.totalCount).toBe(7);
  });

  // Kontrola pozytywna: lead z pełnymi danymi nadal pokazuje nazwę klienta, adres z miastem
  // i nazwę ekipy pierwszej instalacji.
  // @REQ: SEC-LEADS-LIST-MINIMIZE
  it('kontrola pozytywna — lead z pełnymi relacjami niesie imie_i_nazwisko klienta, ulica_miasto adresu i nazwa ekipy pierwszej instalacji, wartości niezmienione', async () => {
    leadFindManyMock.mockResolvedValue([
      fullLeadRecord({
        klient: fullClientRecord({ imie_i_nazwisko: 'Anna Wiśniewska' }),
        adres: fullAddressRecord({ ulica_miasto: 'ul. Chłodnicza 5, Warszawa' }),
        instalacje: [fullInstallationRecord({ zespol: fullCrewRecord({ nazwa: 'Ekipa Warszawa' }) })],
      }),
    ]);

    const { leads } = await getLeadsExpectSuccess();

    expect(leads[0].klient?.imie_i_nazwisko).toBe('Anna Wiśniewska');
    expect(leads[0].adres?.ulica_miasto).toBe('ul. Chłodnicza 5, Warszawa');
    expect(leads[0].instalacje[0].zespol?.nazwa).toBe('Ekipa Warszawa');
  });

  // Przypadek pusty: lead bez przypisanej instalacji — instalacje: [] — nie może rzucać.
  // @REQ: SEC-LEADS-LIST-MINIMIZE
  it('przypadek pusty — lead bez instalacji (instalacje: []) nie rzuca i zwraca pustą tablicę instalacji', async () => {
    leadFindManyMock.mockResolvedValue([fullLeadRecord({ instalacje: [] })]);

    const { leads } = await getLeadsExpectSuccess();

    expect(leads[0].instalacje).toEqual([]);
  });
});

/**
 * Wymaganie: SEC-LEADS-LIST-SCALARS (contracts/requirements.contract.mjs, status TODO).
 *
 * Sąsiedztwo zamknięte: SEC-LEADS-LIST-MINIMIZE (relacje w tym samym zapytaniu, powyżej —
 * NIETKNIĘTE). To wymaganie zawęża SKALARY samego leada (dziś: 19 pól, docelowo: 6 — id,
 * status, created_at, data_rezerwacji, estymowana_wycena, quoted_at) — patrz
 * docs/workorders/SEC-LEADS-LIST-SCALARS.md, sekcja „Docelowy kształt".
 *
 * `auto_rejected_reason` jest przypadkiem brzegowym świadomym: zostaje w `where` (kubełek
 * rejected_auto), znika wyłącznie z `select`/wyniku (AC brzegowe z WO).
 *
 * Fixture `fullLeadRecordWithAllScalars` reprezentuje to, co Prisma zwróciłaby DZIŚ bez
 * żadnego zawężenia skalarów leada (`select` wypisujący wszystkie 19 pól) — z polami
 * wrażliwymi (notatki_wewnetrzne, odpowiedzi_triage) wypełnionymi NIEPUSTĄ treścią, żeby
 * `null`/`""` nie mogło udawać dowodu zawężenia.
 */
const LEAD_SCALAR_KEYS = ['id', 'project_number', 'status', 'created_at', 'data_rezerwacji', 'estymowana_wycena', 'quoted_at'];
const LEAD_TOP_LEVEL_KEYS = [...LEAD_SCALAR_KEYS, 'klient', 'adres', 'instalacje', 'audytor'];

/** Rekord leada TAKI, JAKI DZIŚ zwraca `select` wypisujący wszystkie 19 skalarów (mutant) —
 * z polami wrażliwymi (notatki_wewnetrzne, odpowiedzi_triage) NIEPUSTYMI, żeby wartość
 * pusta nie mogła udawać dowodu zawężenia (patrz WO, sekcja „Przypadki brzegowe"). */
const fullLeadRecordWithAllScalars = (overrides: Record<string, unknown> = {}) => ({
  id: 'lead-1',
  project_number: 'L-000001',
  klient_id: 'klient-1',
  adres_id: 'adres-1',
  odpowiedzi_triage: {
    powierzchnia_m2: 45,
    kontakt_dodatkowy: '+48601999888',
    uwagi: 'Klient prosi o montaż w weekend',
  },
  wybrana_konfiguracja: { moc_kw: 3.5, model: 'Mitsubishi MSZ-LN35' },
  estymowana_wycena: 8500,
  status: 'AWAITING_CREW_ASSIGNMENT',
  audytor_id: 'audytor-1',
  data_rezerwacji: new Date('2026-09-01T09:00:00Z'),
  finalna_wycena_pln: 8200,
  przewidywany_czas_montazu: 240,
  notatki_wewnetrzne: 'Klient prosił o kontakt tylko po 18:00, trudny dojazd do bramy.',
  bucket_entered_at: new Date('2026-08-20T00:00:00Z'),
  quoted_at: new Date('2026-08-22T00:00:00Z'),
  lost_reason: 'PRICE_TOO_HIGH',
  lost_reason_note: 'Klient znalazł tańszą ofertę u konkurencji',
  auto_rejected_reason: 'AUTO_REJECT_14_DAYS',
  last_followup_date: new Date('2026-08-24T00:00:00Z'),
  created_at: new Date('2026-08-01T00:00:00Z'),
  updated_at: new Date('2026-08-25T00:00:00Z'),
  klient: fullClientRecord(),
  adres: fullAddressRecord(),
  instalacje: [fullInstallationRecord()],
  audytor: fullAuditorRecord(),
  ...overrides,
});

describe('getLeads() — minimalizacja SKALARÓW samego leada (SEC-LEADS-LIST-SCALARS)', () => {
  beforeEach(() => {
    leadFindManyMock.mockReset();
    leadCountMock.mockReset();
    leadGroupByMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    leadCountMock.mockResolvedValue(1);
    leadGroupByMock.mockResolvedValue([]);
    // Poza zakresem tego pliku (SEC-RLS-AUDITOR-SCOPE): rola pełnego dostępu, bez
    // filtra audytor_id, żeby testy minimalizacji kontynuowały sprawdzanie tego,
    // co sprawdzały przed dodaniem bramki roli — patrz leads-auditor-scope.test.ts.
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
  });

  // AC1 — dowód KSZTAŁTEM: równość zbiorów w obie strony wobec stałej zadeklarowanej w
  // teście (AC10), nie `toContain`/`toMatchObject`/`toBeUndefined()` na pojedynczych polach.
  // @REQ: SEC-LEADS-LIST-SCALARS
  it('Object.keys(lead) jest RÓWNE jako zbiór dokładnie {id, status, created_at, data_rezerwacji, estymowana_wycena, quoted_at, klient, adres, instalacje, audytor} — bez i jednego pola więcej', async () => {
    leadFindManyMock.mockResolvedValue([fullLeadRecordWithAllScalars()]);

    const { leads } = await getLeadsExpectSuccess();

    expect(leads).toHaveLength(1);
    expect(new Set(Object.keys(leads[0]))).toEqual(new Set(LEAD_TOP_LEVEL_KEYS));
  });

  // AC3 — zawężenie zadeklarowane w SAMYM `select`, nie tylko w mapowaniu wyniku. Liczymy
  // WYŁĄCZNIE klucze o wartości `true` (skalary) — relacje mają własne obiekty `select` i są
  // pilnowane przez SEC-LEADS-LIST-MINIMIZE powyżej, nie duplikujemy tu tamtej asercji.
  // @REQ: SEC-LEADS-LIST-SCALARS
  it('prisma.leady.findMany() jest wołane z `select` zawierającym DOKŁADNIE sześć skalarów leada jako `true` — zero z 13 usuwanych pól', async () => {
    leadFindManyMock.mockResolvedValue([fullLeadRecordWithAllScalars()]);

    await getLeads();

    const callArgs = leadFindManyMock.mock.calls[0]?.[0] ?? {};
    expect(callArgs.select).toBeTruthy();

    const scalarKeys = Object.entries(callArgs.select ?? {})
      .filter(([, v]) => v === true)
      .map(([k]) => k);

    expect(new Set(scalarKeys)).toEqual(new Set(LEAD_SCALAR_KEYS));
  });

  // AC2 — kontrola negatywna jawna i nazwana osobno dla dwóch pól niosących ryzyko RODO:
  // notatka wewnętrzna (tekst swobodny, niekontrolowany) i surowe odpowiedzi triage (zrzut
  // formularza B2C, treść może wykraczać poza to, co ekran szczegółów pokazuje świadomie).
  // Fixture ma te pola NIEPUSTE — wartość pusta nie może udawać dowodu zawężenia.
  // @REQ: SEC-LEADS-LIST-SCALARS
  it('lead.notatki_wewnetrzne NIE występuje w wyniku listy (ryzyko RODO — tekst swobodny niekontrolowany)', async () => {
    leadFindManyMock.mockResolvedValue([fullLeadRecordWithAllScalars()]);

    const { leads } = await getLeadsExpectSuccess();

    expect(Object.keys(leads[0])).not.toContain('notatki_wewnetrzne');
  });

  // @REQ: SEC-LEADS-LIST-SCALARS
  it('lead.odpowiedzi_triage NIE występuje w wyniku listy (ryzyko RODO — surowy zrzut formularza B2C)', async () => {
    leadFindManyMock.mockResolvedValue([fullLeadRecordWithAllScalars()]);

    const { leads } = await getLeadsExpectSuccess();

    expect(Object.keys(leads[0])).not.toContain('odpowiedzi_triage');
  });

  // Przypadek brzegowy jawnie wskazany w WO jako najbardziej prawdopodobna cicha regresja:
  // `auto_rejected_reason` musi zostać w `where` (kubełek rejected_auto), ale zniknąć z
  // `select`/wyniku — jest potrzebny do filtrowania po stronie serwera, nie do renderowania.
  // @REQ: SEC-LEADS-LIST-SCALARS
  it('kubełek rejected_auto — `where` nadal zawiera auto_rejected_reason, ale pole znika z wyniku (`select`/`Object.keys`)', async () => {
    leadFindManyMock.mockResolvedValue([fullLeadRecordWithAllScalars()]);

    const { leads } = await getLeadsExpectSuccess({ bucket: 'rejected_auto' });

    const callArgs = leadFindManyMock.mock.calls[0]?.[0] ?? {};
    expect(callArgs.where).toEqual({ status: 'QUOTE_REJECTED', auto_rejected_reason: 'AUTO_REJECT_14_DAYS' });

    expect(Object.keys(leads[0])).not.toContain('auto_rejected_reason');
    const scalarKeys = Object.entries(callArgs.select ?? {})
      .filter(([, v]) => v === true)
      .map(([k]) => k);
    expect(scalarKeys).not.toContain('auto_rejected_reason');
  });

  // AC5 — zapytanie poza `select` bez zmian, powtórzone tutaj z fixture zawierającą
  // WSZYSTKIE 19 skalarów (żeby dowieść, że zawężenie select nie psuje where/orderBy/skip/
  // take/groupBy nawet gdy mock zwraca pełny rekord — a nie tylko wąski jak w kryterium #4
  // powyżej z SEC-LEADS-LIST-MINIMIZE).
  // @REQ: SEC-LEADS-LIST-SCALARS
  it('where/orderBy/skip/take oraz groupBy pozostają bit-w-bit identyczne mimo zawężenia select (fixture z pełnym rekordem skalarów)', async () => {
    leadFindManyMock.mockResolvedValue([fullLeadRecordWithAllScalars()]);
    leadCountMock.mockResolvedValue(7);
    leadGroupByMock.mockResolvedValue([{ status: 'NEW_LEAD', _count: { id: 3 } }]);

    const result = await getLeadsExpectSuccess({ status: 'NEW_LEAD', page: 2, limit: 10 });

    const callArgs = leadFindManyMock.mock.calls[0]?.[0] ?? {};
    expect(callArgs.where).toEqual({ status: 'NEW_LEAD' });
    expect(callArgs.orderBy).toEqual([{ data_rezerwacji: 'asc' }, { created_at: 'desc' }]);
    expect(callArgs.skip).toBe(10);
    expect(callArgs.take).toBe(10);

    expect(leadGroupByMock).toHaveBeenCalledTimes(1);
    expect(result.stageCounts.NEW_LEAD).toBe(3);
    expect(result.totalCount).toBe(7);
  });

  // Kontrola pozytywna (AC6/AC7) — wartości sześciu zachowanych skalarów przechodzą
  // niezmienione (nie same klucze, ale i wartości), w tym `data_rezerwacji` jako obiekt
  // `Date`, nie `string` (granica serwer/klient, AssignCrewDialog).
  // @REQ: SEC-LEADS-LIST-SCALARS
  it('kontrola pozytywna — sześć zachowanych skalarów niesie niezmienione wartości, data_rezerwacji jako Date', async () => {
    const bookingDate = new Date('2026-09-01T09:00:00Z');
    const quotedAt = new Date('2026-08-22T00:00:00Z');
    leadFindManyMock.mockResolvedValue([
      fullLeadRecordWithAllScalars({
        id: 'lead-42',
        status: 'AWAITING_CREW_ASSIGNMENT',
        estymowana_wycena: 8500,
        data_rezerwacji: bookingDate,
        quoted_at: quotedAt,
      }),
    ]);

    const { leads } = await getLeadsExpectSuccess();
    const [lead] = leads;

    expect(lead.id).toBe('lead-42');
    expect(lead.status).toBe('AWAITING_CREW_ASSIGNMENT');
    expect(lead.estymowana_wycena).toBe(8500);
    expect(lead.data_rezerwacji).toBeInstanceOf(Date);
    expect(lead.data_rezerwacji).toEqual(bookingDate);
    expect(lead.quoted_at).toEqual(quotedAt);
  });

  // Przypadek pusty — `getLeads()` w gałęzi `catch` zwraca `{ leads: [], ... }`; test kształtu
  // (AC1) musi to znieść bez rzucania na `leads[0]`.
  // @REQ: SEC-LEADS-LIST-SCALARS
  it('przypadek pusty — lista pusta ([]) nie rzuca przy próbie odczytu kształtu pierwszego elementu', async () => {
    leadFindManyMock.mockResolvedValue([]);

    const { leads } = await getLeadsExpectSuccess();

    expect(leads).toEqual([]);
    expect(() => Object.keys((leads as unknown[])[0] ?? {})).not.toThrow();
  });
});
