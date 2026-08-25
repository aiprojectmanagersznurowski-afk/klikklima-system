import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Wymaganie: SEC-ASSIGNMENT-POOL-MINIMIZE (contracts/requirements.contract.mjs, status TODO,
 * dopisane 2026-08-25 przy przeglądzie apps/b2b-web/src/app/(dashboard)/leads/actions.ts).
 *
 * Warstwa 1 z dwóch opisanych w kontrakcie: `getAuditors()` i `getCrews(installationDate)`
 * wołają dziś `prisma.<tabela>.findMany()` BEZ `select` — do przeglądarki dyspozytora trafia
 * komplet kolumn pracownika (iban, nip, adres, telefon/telefon_kontaktowy, email,
 * kod_pocztowy_bazowy), mimo że żaden z trzech konsumentów (leads-client.tsx,
 * assign-auditor.tsx, assign-crew-dialog.tsx) nie renderuje ani jednego z nich.
 * Warstwa 2 (przekazanie propsów z leads/[id]/page.tsx do <AssignAuditor>, w tym spread
 * kopiujący pole potrzebne wyłącznie serwerowo) ma OSOBNY plik:
 * lead-detail-page-pool-spread.test.ts — inny kształt modułu (Server Component), inna
 * technika testowania (przeszukanie drzewa elementów React), wzorem rozdziału
 * settings-authorized-users.test.ts / settings-page-authz.test.ts z tej samej sesji.
 *
 * Docelowy, wąski kształt (z kontraktu + doprecyzowanie zadania, patrz uzasadnienie w
 * komentarzu przy AUDITOR_POOL_KEYS poniżej):
 *   - pula audytora: id, imie_i_nazwisko, zdjecie_url (ostatnie pole jest potrzebne WYŁĄCZNIE
 *     wewnątrz getAuditors()/leads/[id]/page.tsx do zbudowania podpisanego avatarUrl — nigdy
 *     nie trafia do klienta pod własną nazwą, co dowodzi drugi plik testowy)
 *   - pula ekipy: id, nazwa, koordynator_imie_nazwisko, certyfikat_fgaz, uprawnienia_sep,
 *     promien_dzialania_km
 *   - pola potrzebne wyłącznie do filtrowania (is_active/aktywny, fgaz_valid_until,
 *     sep_valid_until, availability_declaration) NIGDY nie trafiają do zwróconego kształtu —
 *     testy asertują to jako WYKLUCZENIE tych konkretnych kluczy, nie tylko jako "nie ma
 *     wrażliwych pól"
 *
 * Kryterium poprawności dowodu (kontrakt, dosłownie): "Dowodem jest KSZTAŁT zwróconego
 * obiektu... Asercja typu expect(auditor.iban).toBeUndefined() jest niewystarczająca" —
 * dlatego WSZĘDZIE porównujemy zbiory kluczy (Object.keys jako Set), nigdy pojedyncze pola.
 *
 * ŚWIADOMIE POZA ZAKRESEM (kontrakt wprost to wyklucza, patrz ostatnie dwa akapity
 * statement/acceptance w requirements.contract.mjs):
 *   - auditors/actions.ts / crews/actions.ts (panele administracyjne kartotek — admin MA
 *     widzieć komplet danych pracownika)
 *   - getLeads() w tym samym pliku (osobny przeciek, osobne ID, nie domykany tutaj)
 *   - `auditors: Auditor[]` (pula) przekazywana z leads/page.tsx (listy) do leads-client.tsx
 *     bez przebudowy avatarUrl — leads-client.tsx czyta z tej puli wyłącznie `id`/
 *     `imie_i_nazwisko` (sprawdzone czytaniem pliku), ale zadanie explicite wymienia jako
 *     "cztery dotknięte miejsca" wyłącznie: select w getAuditors()/getCrews(),
 *     leads/[id]/page.tsx, assign-auditor.tsx, typ Lead.audytor w leads-client.tsx. Ten plik
 *     nie wykracza poza to wyliczenie.
 *
 * Mockowanie `@repo/database` i `next/cache` wzorem availability-pool-filter.test.ts (ten sam
 * plik testuje te same dwie funkcje pod innym kątem — filtr dostępności, nie zawężenie pól;
 * `next/cache` mockowane defensywnie, bo cały moduł actions.ts importuje `revalidatePath` na
 * górze pliku, choć żadna z dwóch testowanych funkcji go nie woła).
 */

const { auditorFindManyMock, crewFindManyMock, revalidatePathMock } = vi.hoisted(() => ({
  auditorFindManyMock: vi.fn(),
  crewFindManyMock: vi.fn(),
  revalidatePathMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    audytorzy: { findMany: auditorFindManyMock },
    zespoly_monterskie: { findMany: crewFindManyMock },
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));

const { getAuditors, getCrews } = await import('../src/app/(dashboard)/leads/actions');

/**
 * Zbiór nazw pól wrażliwych. Kontrakt wprost wymaga formy "niezależnej od dzisiejszych nazw
 * kolumn", bo obie tabele czekają na przemianowanie wg ADR-002 (docs/architecture/NAMING.md).
 * Zawiera dzisiejsze nazwy polskie ORAZ te tłumaczenia angielskie, które NAMING.md już
 * definiuje (`adres` -> `address`, `telefon` -> `phone`, `telefon_kontaktowy` ->
 * `contact_phone`); `iban`, `nip` i `kod_pocztowy_bazowy` nie mają dziś wpisu w słowniku
 * (zostają bez zmian), `email` jest już po angielsku.
 */
const SENSITIVE_FIELD_NAMES = new Set([
  'iban',
  'nip',
  'adres',
  'address',
  'telefon',
  'phone',
  'telefon_kontaktowy',
  'contact_phone',
  'email',
  'kod_pocztowy_bazowy',
]);

const AUDITOR_POOL_KEYS = ['id', 'imie_i_nazwisko', 'zdjecie_url'];
const CREW_POOL_KEYS = [
  'id',
  'nazwa',
  'koordynator_imie_nazwisko',
  'certyfikat_fgaz',
  'uprawnienia_sep',
  'promien_dzialania_km',
];

/** Rekord audytora TAKI, JAKI DZIŚ zwraca prisma.audytorzy.findMany() bez select — komplet
 * kolumn ze schema.prisma (model audytorzy), włącznie ze wszystkimi polami finansowymi/
 * kontaktowymi i polami czysto filtrującymi (is_active, availability_declaration). */
const fullAuditorRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'aud-1',
  imie_i_nazwisko: 'Jan Kowalski',
  telefon: '+48600100200',
  email: 'jan.kowalski@klikklima.pl',
  nazwa_firmy: 'Kowalski HVAC Sp. z o.o.',
  nip: '1234567890',
  adres: 'ul. Chłodnicza 5, 00-950 Warszawa',
  zdjecie_url: 'audytorzy/aud-1.png',
  certyfikat_fgaz: 'FG-2024-001',
  doswiadczenie_hvac_lata: 8,
  uprawnienia_sep: true,
  preferowane_marki: ['Daikin', 'Mitsubishi'],
  kod_pocztowy_bazowy: '00-950',
  max_promien_dojazdu_km: 40,
  fgaz_valid_until: new Date('2027-01-01'),
  sep_valid_until: new Date('2027-01-01'),
  iban: 'PL61109010140000071219812874',
  is_active: true,
  leave_status: 'ACTIVE',
  availability_declaration: null,
  created_at: new Date('2026-01-01T00:00:00Z'),
  ...overrides,
});

/** Rekord ekipy TAKI, JAKI DZIŚ zwraca prisma.zespoly_monterskie.findMany() bez select —
 * komplet kolumn ze schema.prisma (model zespoly_monterskie). */
const fullCrewRecord = (overrides: Record<string, unknown> = {}) => ({
  id: 'crew-1',
  nazwa: 'Ekipa Warszawa',
  telefon_kontaktowy: '+48601200300',
  email: 'ekipa.warszawa@klikklima.pl',
  aktywny: true,
  nip: '9876543210',
  koordynator_imie_nazwisko: 'Piotr Nowak',
  certyfikat_fgaz: 'FG-2024-777',
  uprawnienia_sep: true,
  kod_pocztowy_bazowy: '02-100',
  promien_dzialania_km: 60,
  liczba_brygad: 2,
  posiada_wiertnice: true,
  zdjecie_url: 'zespoly/crew-1.png',
  fgaz_valid_until: new Date('2027-06-01'),
  sep_valid_until: new Date('2027-06-01'),
  iban: 'PL27114020040000300201355387',
  leave_status: 'ACTIVE',
  availability_declaration: null,
  ...overrides,
});

const INSTALLATION_DATE = new Date('2026-09-15T00:00:00.000Z');

describe('getAuditors() — minimalizacja pól puli (SEC-ASSIGNMENT-POOL-MINIMIZE)', () => {
  beforeEach(() => {
    auditorFindManyMock.mockReset();
    revalidatePathMock.mockReset();
  });

  // Kryterium #1 z kontraktu: dowód KSZTAŁTEM, nie toBeUndefined() na pojedynczych polach —
  // ta asercja pada dla obiektu z dowolną liczbą dodatkowych kolumn obok, ani jedna z nich
  // nie może przeżyć porównania zbiorów kluczy.
  // @REQ: SEC-ASSIGNMENT-POOL-MINIMIZE
  it('zwrócony audytor ma DOKŁADNIE zbiór kluczy {id, imie_i_nazwisko, zdjecie_url} — bez i jednej kolumny więcej', async () => {
    auditorFindManyMock.mockResolvedValue([fullAuditorRecord(), fullAuditorRecord({ id: 'aud-2', imie_i_nazwisko: 'Ewa Nowak' })]);

    const auditors = await getAuditors();

    expect(auditors).toHaveLength(2);
    for (const auditor of auditors) {
      expect(new Set(Object.keys(auditor as object))).toEqual(new Set(AUDITOR_POOL_KEYS));
    }
  });

  // Kryterium #2: pola wrażliwe nie występują pod ŻADNĄ nazwą — iteracja po kluczach, nie
  // odpytywanie pojedynczych, z góry ustalonych nazw.
  // @REQ: SEC-ASSIGNMENT-POOL-MINIMIZE
  it('żaden zwrócony klucz nie należy do zbioru pól wrażliwych (iban, nip, adres, telefon, email, kod_pocztowy_bazowy — także po angielsku wg NAMING.md)', async () => {
    auditorFindManyMock.mockResolvedValue([fullAuditorRecord()]);

    const [auditor] = await getAuditors();

    const leakedKeys = Object.keys(auditor as object).filter((key) => SENSITIVE_FIELD_NAMES.has(key));
    expect(leakedKeys).toEqual([]);
  });

  // Kryterium #4: zawężenie zadeklarowane w SAMYM zapytaniu (select), nie dopiero po jego
  // wykonaniu — rekord z numerem konta nie może w ogóle trafić do pamięci serwera "na
  // chwilę". Dzisiejszy kod woła findMany({ where, orderBy, include }) BEZ select.
  // @REQ: SEC-ASSIGNMENT-POOL-MINIMIZE
  it('prisma.audytorzy.findMany() jest wołane z jawnym `select`, który nie żąda żadnego pola wrażliwego', async () => {
    auditorFindManyMock.mockResolvedValue([fullAuditorRecord()]);

    await getAuditors();

    expect(auditorFindManyMock).toHaveBeenCalledTimes(1);
    const callArgs = auditorFindManyMock.mock.calls[0]?.[0] ?? {};
    expect(callArgs.select).toBeTruthy();

    const trueSelectedKeys = Object.entries(callArgs.select as Record<string, unknown>)
      .filter(([, value]) => value === true)
      .map(([key]) => key);
    for (const key of trueSelectedKeys) {
      expect(SENSITIVE_FIELD_NAMES.has(key)).toBe(false);
    }
  });

  // Kontrola pozytywna (kryterium: "pula nadal pokazuje to, co ma pokazywać"): bez tego testu
  // implementacja zwracająca pustą listę albo same identyfikatory przeszłaby wszystkie
  // powyższe testy kształtu i zniknęłaby dyspozytorowi możliwość wyboru audytora po nazwie.
  // @REQ: SEC-ASSIGNMENT-POOL-MINIMIZE
  it('kontrola pozytywna — audytor nadal jest wybieralny po id i pełnym imieniu i nazwisku, wartości niezmienione', async () => {
    auditorFindManyMock.mockResolvedValue([
      fullAuditorRecord({ id: 'aud-1', imie_i_nazwisko: 'Jan Kowalski', zdjecie_url: 'audytorzy/aud-1.png' }),
    ]);

    const auditors = await getAuditors();

    expect(auditors).toEqual([{ id: 'aud-1', imie_i_nazwisko: 'Jan Kowalski', zdjecie_url: 'audytorzy/aud-1.png' }]);
  });

  // Przypadek pusty — zawężenie kolumn nie może przy okazji zepsuć pustej puli.
  // @REQ: SEC-ASSIGNMENT-POOL-MINIMIZE
  it('przypadek pusty — brak audytorów w bazie daje pustą tablicę, nie błąd', async () => {
    auditorFindManyMock.mockResolvedValue([]);

    await expect(getAuditors()).resolves.toEqual([]);
  });
});

describe('getCrews(installationDate) — minimalizacja pól puli (SEC-ASSIGNMENT-POOL-MINIMIZE)', () => {
  beforeEach(() => {
    crewFindManyMock.mockReset();
    revalidatePathMock.mockReset();
  });

  // @REQ: SEC-ASSIGNMENT-POOL-MINIMIZE
  it('zwrócona ekipa ma DOKŁADNIE zbiór kluczy {id, nazwa, koordynator_imie_nazwisko, certyfikat_fgaz, uprawnienia_sep, promien_dzialania_km}', async () => {
    crewFindManyMock.mockResolvedValue([fullCrewRecord(), fullCrewRecord({ id: 'crew-2', nazwa: 'Ekipa Kraków' })]);

    const crews = await getCrews(INSTALLATION_DATE);

    expect(crews).toHaveLength(2);
    for (const crew of crews) {
      expect(new Set(Object.keys(crew as object))).toEqual(new Set(CREW_POOL_KEYS));
    }
  });

  // @REQ: SEC-ASSIGNMENT-POOL-MINIMIZE
  it('żaden zwrócony klucz ekipy nie należy do zbioru pól wrażliwych (iban, nip, telefon_kontaktowy, email, kod_pocztowy_bazowy)', async () => {
    crewFindManyMock.mockResolvedValue([fullCrewRecord()]);

    const [crew] = await getCrews(INSTALLATION_DATE);

    const leakedKeys = Object.keys(crew as object).filter((key) => SENSITIVE_FIELD_NAMES.has(key));
    expect(leakedKeys).toEqual([]);
  });

  // Kryterium #4, symetrycznie do audytorów — dzisiejszy kod woła
  // findMany({ where, orderBy, include }) BEZ select.
  // @REQ: SEC-ASSIGNMENT-POOL-MINIMIZE
  it('prisma.zespoly_monterskie.findMany() jest wołane z jawnym `select`, który nie żąda żadnego pola wrażliwego', async () => {
    crewFindManyMock.mockResolvedValue([fullCrewRecord()]);

    await getCrews(INSTALLATION_DATE);

    expect(crewFindManyMock).toHaveBeenCalledTimes(1);
    const callArgs = crewFindManyMock.mock.calls[0]?.[0] ?? {};
    expect(callArgs.select).toBeTruthy();

    const trueSelectedKeys = Object.entries(callArgs.select as Record<string, unknown>)
      .filter(([, value]) => value === true)
      .map(([key]) => key);
    for (const key of trueSelectedKeys) {
      expect(SENSITIVE_FIELD_NAMES.has(key)).toBe(false);
    }
  });

  // Kontrola pozytywna: karta ekipy nadal pokazuje koordynatora, oba certyfikaty (F-Gaz jako
  // numer, SEP jako znacznik) i promień działania — dokładnie to, co renderuje
  // assign-crew-dialog.tsx.
  // @REQ: SEC-ASSIGNMENT-POOL-MINIMIZE
  it('kontrola pozytywna — ekipa nadal niesie koordynatora, oba certyfikaty i promień działania, wartości niezmienione', async () => {
    crewFindManyMock.mockResolvedValue([
      fullCrewRecord({
        id: 'crew-1',
        nazwa: 'Ekipa Warszawa',
        koordynator_imie_nazwisko: 'Piotr Nowak',
        certyfikat_fgaz: 'FG-2024-777',
        uprawnienia_sep: true,
        promien_dzialania_km: 60,
      }),
    ]);

    const crews = await getCrews(INSTALLATION_DATE);

    expect(crews).toEqual([
      {
        id: 'crew-1',
        nazwa: 'Ekipa Warszawa',
        koordynator_imie_nazwisko: 'Piotr Nowak',
        certyfikat_fgaz: 'FG-2024-777',
        uprawnienia_sep: true,
        promien_dzialania_km: 60,
      },
    ]);
  });

  // Przypadek pusty.
  // @REQ: SEC-ASSIGNMENT-POOL-MINIMIZE
  it('przypadek pusty — brak ekip w bazie daje pustą tablicę, nie błąd', async () => {
    crewFindManyMock.mockResolvedValue([]);

    await expect(getCrews(INSTALLATION_DATE)).resolves.toEqual([]);
  });
});
