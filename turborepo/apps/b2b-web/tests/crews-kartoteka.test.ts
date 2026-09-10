import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PERMISSIONS, can, ROLES } from '@klikklima/contracts';

/**
 * CRM-ZESP-KARTOTEKA — kartoteka zespołu montażowego z panelu B2B: tworzenie
 * (`createCrewAction`), edycja (`updateCrewAction`) i pobranie pełnego rekordu do
 * formularza edycji (`getCrewForEdit`). Źródło: docs/workorders/
 * CRM-KARTOTEKI-CREATE-AND-CREW-ASSIGN.md (Część A + rozszerzenie „edycja",
 * AC-A1..AC-A24 — WYŁĄCZNIE fragmenty dotyczące zespołu, część audytora i część B
 * pozostają poza tym plikiem) oraz contracts/requirements.contract.mjs
 * (CRM-ZESP-KARTOTEKA, 25 kryteriów akceptacji).
 *
 * Trzy nowe funkcje w apps/b2b-web/src/app/(dashboard)/crews/actions.ts, ŻADNA
 * dziś nie istnieje:
 *   - createCrewAction(formData: FormData): Promise<{ success: boolean; error?: string; id?: string }>
 *   - getCrewForEdit(id: string): Promise<CrewEditRecord | null>  (bramka: crews.update)
 *   - updateCrewAction(id: string, formData: FormData, newPhotoPath?: string): Promise<{ success: boolean; error?: string }>
 *
 * 12 pól formularza (potwierdzone w AddCrewModal.tsx i schema.prisma:177-212), ŻADNE
 * inne pole zespołu nie wchodzi w zakres — w szczególności BRAK adresu z
 * autouzupełnianiem i BRAK preferowane_marki, bo tabela zespoly_monterskie nie ma
 * odpowiedników tych kolumn (to różnice względem CRM-AUDYT-KARTOTEKA, nie przeoczenie):
 *   nazwa, telefon_kontaktowy, email, nip, koordynator_imie_nazwisko,
 *   certyfikat_fgaz, uprawnienia_sep, kod_pocztowy_bazowy, promien_dzialania_km,
 *   liczba_brygad, posiada_wiertnice, iban.
 * zdjecie_url NIE jest jednym z 12 pól formularza (idzie osobną ścieżką — path
 * już wgrany przez Supabase Storage, wzorem działającego dziś updateCrewAvatar),
 * ale AC-A20..AC-A22 wymagają, żeby create/update go poprawnie obsługiwały przy
 * zapisie, więc te przypadki są tu też pokryte. Zakładany kształt: updateCrewAction
 * przyjmuje opcjonalny trzeci argument z nową ścieżką (analogicznie do tego, jak
 * updateCrewAvatar przyjmuje `path` jako osobny parametr) — jeśli implementer
 * wybierze inny kształt (np. pole w samym FormData), to jest TEST-DEFECT do
 * zgłoszenia, nie cichej naprawy.
 *
 * Mockujemy @repo/database (brak żywej instancji testowej), next/cache
 * (revalidatePath wymaga kontekstu żądania Next.js) i
 * ../src/utils/supabase/server (getCurrentActorRole woła next/headers cookies(),
 * które poza kontekstem żądania rzuca) — identyczny wzorzec jak w
 * crews-admin-gates.test.ts. Rola WYŁĄCZNIE z getCurrentActorRole(), nigdy z
 * argumentu wywołania — dokładnie tak jak deleteCrewAction/updateCrewAvatar w tym
 * samym pliku produkcyjnym.
 *
 * Świadome ograniczenia (odnotowane, nie pominięte milcząco):
 * - Warstwa UI (CrewsClient + actorRole, AC-A15) i propagacja przez crews/page.tsx
 *   NIE są testowane w tym pliku — to praca GREEN dla implementera UI, a nie dla
 *   Server Actions. Ten plik pokrywa wyłącznie serwer.
 * - Rzeczywisty upload do Supabase Storage (RLS na storage.objects, R-A2 z WO) nie
 *   jest testowany tutaj — createCrewAction/updateCrewAction przyjmują JUŻ WGRANĄ
 *   ścieżkę jako string, więc granica testu to: "co robi akcja z otrzymaną
 *   ścieżką", nie "czy przeglądarka potrafi wgrać plik". To osobna warstwa
 *   (integracyjna z prawdziwym Storage), poza zakresem testów jednostkowych.
 * - Współbieżność dwóch adminów edytujących ten sam rekord (R-A5, brak
 *   updated_at) jest testowana jako STWIERDZENIE efektu "ostatni wygrywa", nie
 *   jako naprawa — WO wprost mówi, że naprawa wymaga zmiany schematu.
 */

const {
  crewCreateMock,
  crewUpdateMock,
  crewFindUniqueMock,
  auditLogCreateMock,
  transactionMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
  getUserMock,
  createClientMock,
  signStoragePathsMock,
} = vi.hoisted(() => ({
  crewCreateMock: vi.fn(),
  crewUpdateMock: vi.fn(),
  crewFindUniqueMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
  transactionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
  signStoragePathsMock: vi.fn(),
}));

// FLD-AUDITOR-RADIUS-RENAME (TEST-DEFECT fix): updateCrewAction opakowuje update+
// auditLog.create w prisma.$transaction WYŁĄCZNIE, gdy zmienia się kod_pocztowy_bazowy
// lub promien_dzialania_km (patrz buildBaseLocationJustification w actions.ts). `tx`
// przekazane do $transaction musi widzieć TE SAME mocki co `prisma.zespoly_monterskie`
// wołane poza transakcją, inaczej asercje na crewUpdateMock nie widziałyby wywołań ze
// ścieżki audytowej — wzorem sharedPrisma w fld-base-location-edit-audit-log.test.ts.
const sharedCrewPrisma = {
  zespoly_monterskie: {
    create: crewCreateMock,
    update: crewUpdateMock,
    findUnique: crewFindUniqueMock,
  },
  auditLog: { create: auditLogCreateMock },
  $transaction: transactionMock,
};

vi.mock('@repo/database', () => ({
  prisma: sharedCrewPrisma,
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
  createClient: createClientMock,
}));
// P0-1 (przygotowanie pod przyszłą turę): domyślny brak sesji — ten plik nie testuje ścieżek zależnych od tożsamości poprzez createClient(), więc `getCurrentUser` dostaje bezpieczny, jawny fallback zamiast pozostać niezdefiniowanym mockiem.
getCurrentUserMock.mockResolvedValue({ data: { user: null } });
// FLD-AUDITOR-RADIUS-RENAME: domyślna tożsamość i zachowanie transakcji dla ścieżki
// audytowej updateCrewAction — żaden test w tym pliku nie dowodzi TREŚCI wpisu
// audytowego (to robi fld-base-location-edit-audit-log.test.ts), więc wystarczy
// stabilny, sensowny default zamiast per-testowego resetu.
getUserMock.mockResolvedValue({ data: { user: { email: 'admin@klikklima.pl' } } });
createClientMock.mockResolvedValue({ auth: { getUser: getUserMock } });
auditLogCreateMock.mockResolvedValue({ id: 'audit-1' });
transactionMock.mockImplementation(async (cb: (tx: typeof sharedCrewPrisma) => unknown) =>
  cb(sharedCrewPrisma),
);
// MINOR 7 (rls-security-auditor, review post-GREEN CRM-ZESP-KARTOTEKA): bucket
// `zespoly` jest prywatny — getCrewForEdit musi podpisac sciezke Storage przed
// zwroceniem, dokladnie jak getAuditorForEdit w auditors-kartoteka.test.ts i jak
// signStoragePaths("zespoly", ...) juz uzywany w crews/page.tsx.
vi.mock('@/lib/storage/signed-urls', () => ({
  signStoragePaths: signStoragePathsMock,
}));

const { createCrewAction, getCrewForEdit, updateCrewAction } = await import(
  '../src/app/(dashboard)/crews/actions'
);

const UNAUTHORIZED_ROLES = ROLES.filter((role) => role !== 'admin');

// 12 pól formularza zespołu, kompletnie wypełnione — punkt odniesienia dla
// wszystkich testów "sukces". Wartości dobrane tak, żeby żadna nie kolidowała z
// wartością domyślną kolumny (np. sep: true, żeby test odznaczenia miał sens).
function buildFullFormData(overrides: Record<string, string> = {}): FormData {
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
    // ERRATA A-2 (2026-08-31): fgaz_valid_until / sep_valid_until — daty ważności
    // certyfikatów, dodane przez korektę kontraktu CRM-ZESP-KARTOTEKA (12 -> 14 pól).
    // Wartości domyślne w przyszłości, żeby testy "sukces" istniejące przed errata
    // pozostały niezmienione (nadmiarowe klucze w FormData nie wpływają na
    // asercje objectContaining w tych testach).
    fgaz_valid_until: '2027-06-15',
    sep_valid_until: '2028-01-01',
  };
  const merged = { ...base, ...overrides };
  const data = new FormData();
  for (const [key, value] of Object.entries(merged)) {
    data.append(key, value);
  }
  return data;
}

describe('createCrewAction — bramka roli (CRM-ZESP-KARTOTEKA)', () => {
  beforeEach(() => {
    crewCreateMock.mockReset();
    crewUpdateMock.mockReset();
    crewFindUniqueMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
  });

  // Kryterium: can(role,'crews','create')==='yes' — sprawdzona KAŻDA rola z ROLES,
  // nie tylko admin. Rola wyłącznie z sesji.
  // @REQ: CRM-ZESP-KARTOTEKA
  it.each(UNAUTHORIZED_ROLES)(
    'rola %s jest odrzucona po stronie serwera, create NIE jest wołane',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      expect(can(role, 'crews', 'create')).toBe('no');

      const result = await createCrewAction(buildFullFormData());

      expect(crewCreateMock).not.toHaveBeenCalled();
      expect(result?.success).toBe(false);
    },
  );

  // Rola z argumentu wywołania nie ma znaczenia — jedynym źródłem jest sesja.
  // Test podaje 'role' jako dodatkowe pole w FormData (tak jak zrobiłby to
  // złośliwy klient z pominięciem UI) i dowodzi, że jest ignorowane.
  // @REQ: CRM-ZESP-KARTOTEKA
  it('podanie roli "admin" wewnątrz FormData nie omija bramki, gdy sesja ma inną rolę', async () => {
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
    const data = buildFullFormData();
    data.append('role', 'admin');

    const result = await createCrewAction(data);

    expect(crewCreateMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });

  // Brak sesji — fail-closed.
  // @REQ: CRM-ZESP-KARTOTEKA
  it('brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await createCrewAction(buildFullFormData());

    expect(crewCreateMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });

  // Kontrola pozytywna kontraktu — dowód, że macierz faktycznie przyznaje adminowi
  // create na crews, żeby bramka nie "przechodziła" odrzucając wszystkich.
  // @REQ: CRM-ZESP-KARTOTEKA
  it('kontrola pozytywna kontraktu — admin ma create na crews w macierzy RBAC', () => {
    expect(can('admin', 'crews', 'create')).toBe('yes');
    expect(PERMISSIONS.crews.create).toEqual(['admin']);
  });
});

describe('createCrewAction — mapowanie pól i walidacja (CRM-ZESP-KARTOTEKA)', () => {
  beforeEach(() => {
    crewCreateMock.mockReset();
    crewUpdateMock.mockReset();
    crewFindUniqueMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
    crewCreateMock.mockResolvedValue({ id: 'crew-new' });
  });

  // Sukces: poprawnie wypełniony FormData -> create wołane z poprawnie
  // zmapowanymi polami (11 kolumn skalarnych; zdjecie_url pominięte, bo modal
  // tworzenia nie wysyła zdjęcia — patrz komentarz na górze pliku).
  // @REQ: CRM-ZESP-KARTOTEKA
  it('poprawnie wypełniony formularz tworzy ekipę z poprawnie zmapowanymi polami', async () => {
    const result = await createCrewAction(buildFullFormData());

    expect(result?.success).toBe(true);
    expect(crewCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        nazwa: 'Ekipa Warszawa Południe',
        telefon_kontaktowy: '600100200',
        email: 'ekipa.waw@example.com',
        nip: '1234567890',
        koordynator_imie_nazwisko: 'Jan Kowalski',
        certyfikat_fgaz: 'FGAZ-2026-001',
        uprawnienia_sep: true,
        kod_pocztowy_bazowy: '02-100',
        promien_dzialania_km: 50,
        liczba_brygad: 3,
        posiada_wiertnice: true,
        iban: 'PL61109010140000071219812874',
      }),
    });
  });

  // Walidacja serwerowa: brak nazwy -> odmowa, create NIE wołane, niezależnie od
  // atrybutu required w HTML (AC-A7, wersja zespołu).
  // @REQ: CRM-ZESP-KARTOTEKA
  it('formularz bez nazwy ekipy nie tworzy wiersza — walidacja serwerowa', async () => {
    const data = buildFullFormData();
    data.delete('nazwa');

    const result = await createCrewAction(data);

    expect(crewCreateMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
    expect(typeof result?.error).toBe('string');
  });

  // Kolizja unikalnego e-maila (zespoly_monterskie.email @unique) -> czytelny
  // błąd domenowy, nie surowy wyjątek Prismy P2002 (AC-A9, wzorem
  // settings/actions.ts:42-44).
  // @REQ: CRM-ZESP-KARTOTEKA
  it('kolizja unikalnego e-maila kończy się czytelnym błędem, nie surowym wyjątkiem Prismy', async () => {
    const prismaError = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    crewCreateMock.mockRejectedValue(prismaError);

    const result = await createCrewAction(buildFullFormData());

    expect(result?.success).toBe(false);
    expect(typeof result?.error).toBe('string');
    expect(result?.error).not.toMatch(/P2002/);
    expect(result?.error).not.toMatch(/Unique constraint/i);
  });

  // Pusty e-mail: dwie ekipy bez e-maila da się utworzyć — pusty string z
  // FormData -> null, NIGDY '' (kolumna jest NULLable i @unique jednocześnie,
  // drugi '' wysadziłby zapis) (AC-A10).
  // @REQ: CRM-ZESP-KARTOTEKA
  it('pusty e-mail zapisuje się jako NULL, nie jako pusty łańcuch', async () => {
    const data = buildFullFormData({ email: '' });

    await createCrewAction(data);

    expect(crewCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: null }),
    });
  });

  // Pola liczbowe nullable: promien_dzialania_km puste -> NULL, nigdy NaN i
  // nigdy 0 (promień 0 km oznacza "ekipa nigdzie nie dojedzie" i wypadłaby z
  // przyszłych filtrów).
  // @REQ: CRM-ZESP-KARTOTEKA
  it('puste pole promien_dzialania_km zapisuje się jako NULL, nie NaN i nie 0', async () => {
    const data = buildFullFormData({ promien_dzialania_km: '' });

    await createCrewAction(data);

    expect(crewCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ promien_dzialania_km: null }),
    });
  });

  // liczba_brygad jest NOT NULL z @default(1) w schemacie — WYJĄTEK odróżniający
  // zespół od audytora: puste pole musi dać 1, nie NULL.
  // @REQ: CRM-ZESP-KARTOTEKA
  it('puste pole liczba_brygad zapisuje się jako wartość domyślna 1, nie NULL', async () => {
    const data = buildFullFormData({ liczba_brygad: '' });

    await createCrewAction(data);

    expect(crewCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ liczba_brygad: 1 }),
    });
  });

  // Checkbox 'false' z FormData jest łańcuchem prawdziwym w JS — odznaczony
  // checkbox musi dać wartość logiczną false, nie prawdziwy string 'false'.
  // @REQ: CRM-ZESP-KARTOTEKA
  it("checkbox uprawnienia_sep z wartością stringową 'false' zapisuje boolean false", async () => {
    const data = buildFullFormData({ uprawnienia_sep: 'false' });

    await createCrewAction(data);

    expect(crewCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ uprawnienia_sep: false }),
    });
  });

  // To samo dla posiada_wiertnice — osobne pole, osobny test (żeby jeden nie
  // maskował błędu w drugim przy przypadkowej zamianie nazw pól).
  // @REQ: CRM-ZESP-KARTOTEKA
  it("checkbox posiada_wiertnice z wartością stringową 'false' zapisuje boolean false", async () => {
    const data = buildFullFormData({ posiada_wiertnice: 'false' });

    await createCrewAction(data);

    expect(crewCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ posiada_wiertnice: false }),
    });
  });

  // Podwójne wywołanie (podwójne kliknięcie "Zapisz") nie tworzy dwóch rekordów.
  // @REQ: CRM-ZESP-KARTOTEKA
  it('podwójne wywołanie z tymi samymi danymi tworzy tylko jeden rekord', async () => {
    const data = buildFullFormData();

    await Promise.all([createCrewAction(data), createCrewAction(data)]);

    expect(crewCreateMock).toHaveBeenCalledTimes(1);
  });
});

describe('createCrewAction — daty ważności certyfikatów (ERRATA A-2, CRM-ZESP-KARTOTEKA)', () => {
  beforeEach(() => {
    crewCreateMock.mockReset();
    crewUpdateMock.mockReset();
    crewFindUniqueMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
    crewCreateMock.mockResolvedValue({ id: 'crew-new' });
  });

  // AC-E1/AC-E5: poprawna data kalendarzowa w obu polach musi trafić do Prismy jako
  // Date odpowiadający północy UTC TEGO SAMEGO dnia kalendarzowego (new Date("YYYY-MM-DD")),
  // nie czasowi lokalnemu maszyny uruchamiającej test — stąd porównanie przez toISOString(),
  // nie przez konstruktor Date z literałem porównawczym.
  // @REQ: CRM-ZESP-KARTOTEKA
  it('poprawne fgazValidUntil i sepValidUntil zapisują się jako Date w północ UTC danego dnia kalendarzowego', async () => {
    const data = buildFullFormData({ fgaz_valid_until: '2027-06-15', sep_valid_until: '2028-01-01' });

    await createCrewAction(data);

    const callArgs = crewCreateMock.mock.calls[0]?.[0];
    const fgaz = callArgs?.data?.fgaz_valid_until as Date;
    const sep = callArgs?.data?.sep_valid_until as Date;
    expect(fgaz?.toISOString?.()).toBe('2027-06-15T00:00:00.000Z');
    expect(sep?.toISOString?.()).toBe('2028-01-01T00:00:00.000Z');
  });

  // Przypadek brzegowy z errata: pusty string z <input type="date"> -> NULL, nigdy
  // Invalid Date (co Prisma odrzuciłaby runtime'owo) i nigdy epoka 1970 (new Date(0),
  // która po cichu ustawiłaby certyfikat wygasły 56 lat temu).
  // @REQ: CRM-ZESP-KARTOTEKA
  it('puste fgazValidUntil i sepValidUntil zapisują się jako NULL, nie Invalid Date ani epoka 1970', async () => {
    const data = buildFullFormData({ fgaz_valid_until: '', sep_valid_until: '' });

    await createCrewAction(data);

    expect(crewCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ fgaz_valid_until: null, sep_valid_until: null }),
    });
  });

  // Decyzja człowieka z erraty (2026-08-31): data w przeszłości DOZWOLONA — rekord
  // dokumentuje stan faktyczny, walidator formularza nie ma prawa tego blokować.
  // @REQ: CRM-ZESP-KARTOTEKA
  it('data w przeszłości w fgazValidUntil jest dozwolona — zapis kończy się sukcesem', async () => {
    const data = buildFullFormData({ fgaz_valid_until: '2020-01-01' });

    const result = await createCrewAction(data);

    expect(result?.success).toBe(true);
    const callArgs = crewCreateMock.mock.calls[0]?.[0];
    expect((callArgs?.data?.fgaz_valid_until as Date)?.toISOString?.()).toBe('2020-01-01T00:00:00.000Z');
  });
});

describe('getCrewForEdit — bramka i kompletność (CRM-ZESP-KARTOTEKA)', () => {
  const FULL_RECORD = {
    id: 'crew-1',
    nazwa: 'Ekipa Warszawa Południe',
    telefon_kontaktowy: '600100200',
    email: 'ekipa.waw@example.com',
    nip: '1234567890',
    koordynator_imie_nazwisko: 'Jan Kowalski',
    certyfikat_fgaz: 'FGAZ-2026-001',
    uprawnienia_sep: true,
    kod_pocztowy_bazowy: '02-100',
    promien_dzialania_km: 50,
    liczba_brygad: 3,
    posiada_wiertnice: true,
    iban: 'PL61109010140000071219812874',
    zdjecie_url: 'zespoly/crew-1-123.jpg',
    // ERRATA A-2 (2026-08-31): kolumny dat ważności certyfikatów — dodane do mocka
    // rekordu Prismy. Test "12 pól" poniżej sprawdza obecność tych 12 kluczy przez
    // toMatchObject (nie zamyka pełnego zbioru) — obecność tych dwóch dodatkowych
    // pól w wyniku sprawdza osobny test AC-E3 tuż pod nim, żeby nie mieszać
    // niezmienionego kryterium "12 pól" z nowym kryterium "14 pól".
    fgaz_valid_until: new Date('2027-06-15T00:00:00.000Z'),
    sep_valid_until: new Date('2028-01-01T00:00:00.000Z'),
    // Kolumny administracyjne, które NIE mogą trafić do wyniku akcji (patrz
    // test poniżej "nie zawiera pól administracyjnych").
    aktywny: true,
    leave_status: 'ACTIVE',
  };

  beforeEach(() => {
    crewCreateMock.mockReset();
    crewUpdateMock.mockReset();
    crewFindUniqueMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
    crewFindUniqueMock.mockResolvedValue(FULL_RECORD);
    signStoragePathsMock.mockReset();
    signStoragePathsMock.mockResolvedValue({
      [FULL_RECORD.zdjecie_url]: 'https://signed.example/zespoly/crew-1-123.jpg?token=xyz',
    });
  });

  // Bramka can(role,'crews','update')==='yes'.
  // @REQ: CRM-ZESP-KARTOTEKA
  it.each(UNAUTHORIZED_ROLES)(
    'rola %s jest odrzucona, findUnique NIE jest wołane',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      expect(can(role, 'crews', 'update')).toBe('no');

      const result = await getCrewForEdit('crew-1');

      expect(crewFindUniqueMock).not.toHaveBeenCalled();
      expect(result).toBeNull();
    },
  );

  // Zwraca WSZYSTKIE 12 pól formularza (to jest dokładnie defekt, który
  // AC-A13/CrewSummary miałyby ujawnić, gdyby getCrewForEdit sięgał po
  // okrojony typ). ERRATA A-2 (2026-08-31): TEST-DEFECT zgłoszony przez
  // implementer-server — poprzednia wersja zamykała PEŁNY zbiór kluczy
  // (Object.keys równość), co wykluczało się wzajemnie z AC-E3 poniżej (14
  // pól po erracie). Wzorem auditors-kartoteka.test.ts (patrz komentarz na
  // początku tego pliku): sprawdzamy obecność i wartość każdego z 12 pól
  // imiennie, przez toMatchObject — odporne na dodanie kolejnego pola w
  // przyszłości, bez utraty intencji "wszystkie 12 pól formularza są tu, nie
  // tylko podzbiór z CrewSummary".
  // @REQ: CRM-ZESP-KARTOTEKA
  it('admin — zwraca wszystkie 12 pól formularza (obecność i wartości, nie zamknięty zbiór)', async () => {
    const result = await getCrewForEdit('crew-1');

    expect(result).not.toBeNull();
    expect(result).toMatchObject({
      nazwa: FULL_RECORD.nazwa,
      telefon_kontaktowy: FULL_RECORD.telefon_kontaktowy,
      email: FULL_RECORD.email,
      nip: FULL_RECORD.nip,
      koordynator_imie_nazwisko: FULL_RECORD.koordynator_imie_nazwisko,
      certyfikat_fgaz: FULL_RECORD.certyfikat_fgaz,
      uprawnienia_sep: FULL_RECORD.uprawnienia_sep,
      kod_pocztowy_bazowy: FULL_RECORD.kod_pocztowy_bazowy,
      promien_dzialania_km: FULL_RECORD.promien_dzialania_km,
      liczba_brygad: FULL_RECORD.liczba_brygad,
      posiada_wiertnice: FULL_RECORD.posiada_wiertnice,
      iban: FULL_RECORD.iban,
    });
  });

  // aktywny i leave_status NIE należą do 12 pól formularza i NIE mogą znaleźć
  // się w wyniku tej akcji — inaczej zapis formularza edycji ryzykowałby
  // cofnięcie blokady administracyjnej ustawionej równolegle przez inną akcję.
  // @REQ: CRM-ZESP-KARTOTEKA
  it('wynik nie zawiera pól administracyjnych aktywny ani leave_status', async () => {
    const result = await getCrewForEdit('crew-1');

    expect(result).not.toHaveProperty('aktywny');
    expect(result).not.toHaveProperty('leave_status');
  });

  // Nieistniejące id -> odmowa/null, nie wyjątek.
  // @REQ: CRM-ZESP-KARTOTEKA
  it('nieistniejące id zwraca null, nie wyjątek', async () => {
    crewFindUniqueMock.mockResolvedValue(null);

    const result = await getCrewForEdit('crew-nonexistent');

    expect(result).toBeNull();
  });

  // AC-E3 (ERRATA A-2, 2026-08-31): otwarcie formularza edycji musi pokazać obie daty
  // ważności certyfikatów — rozszerzenie 12 -> 14 pól formularza.
  // @REQ: CRM-ZESP-KARTOTEKA
  it('admin — wynik zawiera fgaz_valid_until i sep_valid_until z rekordu', async () => {
    const result = await getCrewForEdit('crew-1');

    expect(result).toMatchObject({
      fgaz_valid_until: FULL_RECORD.fgaz_valid_until,
      sep_valid_until: FULL_RECORD.sep_valid_until,
    });
  });

  // MINOR 7 (rls-security-auditor, review post-GREEN CRM-ZESP-KARTOTEKA): surowa
  // ścieżka Storage nie wyrenderuje się jako <img src> w przeglądarce (bucket
  // `zespoly` jest prywatny). zdjecie_url w wyniku MUSI być wartością zwróconą
  // przez signStoragePaths (podpisany URL), nie surową ścieżką z bazy —
  // identycznie jak getAuditorForEdit w auditors-kartoteka.test.ts. Asercja na
  // wartości z mocka (nie na literale wejściowym) dowodzi, że pole faktycznie
  // przeszło przez podpisywanie.
  // @REQ: CRM-ZESP-KARTOTEKA
  it('admin — zdjecie_url w wyniku jest podpisanym URL-em, nie surową ścieżką Storage', async () => {
    const signedUrl = 'https://signed.example/zespoly/crew-1-123.jpg?token=xyz';
    signStoragePathsMock.mockResolvedValue({
      [FULL_RECORD.zdjecie_url]: signedUrl,
    });

    const result = await getCrewForEdit('crew-1');

    expect(result?.zdjecie_url).toBe(signedUrl);
    expect(result?.zdjecie_url).not.toBe(FULL_RECORD.zdjecie_url);
    expect(signStoragePathsMock).toHaveBeenCalledWith(
      'zespoly',
      [FULL_RECORD.zdjecie_url],
      expect.any(Number),
    );
  });

  // Brak zdjęcia: podpisywanie pustej/nieistniejącej ścieżki nie ma sensu —
  // getCrewForEdit nie powinien w ogóle wołać storage, gdy nie ma czego podpisywać.
  // @REQ: CRM-ZESP-KARTOTEKA
  it('ekipa bez zdjęcia (zdjecie_url null) nie wołuje signStoragePaths i zwraca zdjecie_url null', async () => {
    crewFindUniqueMock.mockResolvedValue({ ...FULL_RECORD, zdjecie_url: null });

    const result = await getCrewForEdit('crew-1');

    expect(result?.zdjecie_url).toBeNull();
    expect(signStoragePathsMock).not.toHaveBeenCalled();
  });
});

describe('updateCrewAction — bramka roli (CRM-ZESP-KARTOTEKA)', () => {
  beforeEach(() => {
    crewCreateMock.mockReset();
    crewUpdateMock.mockReset();
    crewFindUniqueMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
  });

  // Bramka can(role,'crews','update')==='yes' — każda rola z ROLES, przed
  // jakimkolwiek zapisem.
  // @REQ: CRM-ZESP-KARTOTEKA
  it.each(UNAUTHORIZED_ROLES)(
    'rola %s jest odrzucona, update NIE jest wołane, zero zmienionych kolumn',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      expect(can(role, 'crews', 'update')).toBe('no');

      const result = await updateCrewAction('crew-1', buildFullFormData());

      expect(crewUpdateMock).not.toHaveBeenCalled();
      expect(result?.success).toBe(false);
    },
  );

  // Kontrola pozytywna.
  // @REQ: CRM-ZESP-KARTOTEKA
  it('kontrola pozytywna kontraktu — admin ma update na crews w macierzy RBAC', () => {
    expect(can('admin', 'crews', 'update')).toBe('yes');
    expect(PERMISSIONS.crews.update).toEqual(['admin']);
  });
});

describe('updateCrewAction — mapowanie, kolizje i zdjęcie (CRM-ZESP-KARTOTEKA)', () => {
  // FLD-AUDITOR-RADIUS-RENAME (TEST-DEFECT fix): kod_pocztowy_bazowy/promien_dzialania_km
  // muszą być OBECNE i IDENTYCZNE z domyślnymi wartościami buildFullFormData() ('02-100'/50),
  // inaczej updateCrewAction rozpoznaje każdy zapis w tym bloku jako zmianę lokalizacji
  // bazowej (buildBaseLocationJustification porównuje existing vs values) i przechodzi
  // przez ścieżkę audytową ($transaction) zamiast prostego prisma.zespoly_monterskie.update
  // — ten blok testuje mapowanie pól i kolizje, nie audyt lokalizacji (ten ma własny plik:
  // fld-base-location-edit-audit-log.test.ts).
  const EXISTING_RECORD = {
    id: 'crew-1',
    nazwa: 'Ekipa Warszawa Południe',
    email: 'ekipa.waw@example.com',
    zdjecie_url: 'zespoly/crew-1-100.jpg',
    kod_pocztowy_bazowy: '02-100',
    promien_dzialania_km: 50,
  };

  beforeEach(() => {
    crewCreateMock.mockReset();
    crewUpdateMock.mockReset();
    crewFindUniqueMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
    crewFindUniqueMock.mockResolvedValue(EXISTING_RECORD);
    crewUpdateMock.mockResolvedValue({ ...EXISTING_RECORD });
  });

  // Sukces: prisma.zespoly_monterskie.update wołane poprawnie, na właściwym id.
  // @REQ: CRM-ZESP-KARTOTEKA
  it('poprawnie wypełniony formularz aktualizuje istniejący rekord', async () => {
    const result = await updateCrewAction('crew-1', buildFullFormData());

    expect(result?.success).toBe(true);
    expect(crewUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'crew-1' },
        data: expect.objectContaining({
          nazwa: 'Ekipa Warszawa Południe',
          telefon_kontaktowy: '600100200',
          uprawnienia_sep: true,
          liczba_brygad: 3,
          posiada_wiertnice: true,
        }),
      }),
    );
  });

  // Walidacja serwerowa przy edycji: brak nazwy -> odmowa, update NIE wołane.
  // @REQ: CRM-ZESP-KARTOTEKA
  it('edycja bez nazwy ekipy nie zmienia rekordu — walidacja serwerowa', async () => {
    const data = buildFullFormData();
    data.delete('nazwa');

    const result = await updateCrewAction('crew-1', data);

    expect(crewUpdateMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
  });

  // Edycja WŁASNEGO niezmienionego e-maila nie jest fałszywie odrzucana jako
  // kolizja (AC-A18) — regres na naiwne findUnique({ where: { email } }) bez
  // wykluczenia własnego id.
  // @REQ: CRM-ZESP-KARTOTEKA
  it('edycja z niezmienionym własnym e-mailem kończy się sukcesem', async () => {
    const data = buildFullFormData({ email: EXISTING_RECORD.email });

    const result = await updateCrewAction('crew-1', data);

    expect(result?.success).toBe(true);
    expect(crewUpdateMock).toHaveBeenCalled();
  });

  // Kolizja z e-mailem INNEGO rekordu -> czytelny błąd, nie surowy P2002.
  // @REQ: CRM-ZESP-KARTOTEKA
  it('zmiana e-maila na zajęty przez inny rekord kończy się czytelnym błędem, nie P2002', async () => {
    const prismaError = Object.assign(new Error('Unique constraint failed'), { code: 'P2002' });
    crewUpdateMock.mockRejectedValue(prismaError);

    const result = await updateCrewAction('crew-1', buildFullFormData({ email: 'inny@example.com' }));

    expect(result?.success).toBe(false);
    expect(typeof result?.error).toBe('string');
    expect(result?.error).not.toMatch(/P2002/);
  });

  // Pusty e-mail w edycji -> NULL, nie '' (AC-A19, odpowiednik AC-A10 dla edycji).
  // @REQ: CRM-ZESP-KARTOTEKA
  it('wyczyszczenie e-maila w edycji zapisuje NULL, nie pusty łańcuch', async () => {
    const data = buildFullFormData({ email: '' });

    await updateCrewAction('crew-1', data);

    expect(crewUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ email: null }) }),
    );
  });

  // Puste pole liczbowe nullable w edycji -> NULL, ten sam wymóg co przy tworzeniu.
  // @REQ: CRM-ZESP-KARTOTEKA
  it('puste pole promien_dzialania_km w edycji zapisuje się jako NULL', async () => {
    const data = buildFullFormData({ promien_dzialania_km: '' });

    await updateCrewAction('crew-1', data);

    expect(crewUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ promien_dzialania_km: null }) }),
    );
  });

  // liczba_brygad NOT NULL @default(1) — w edycji puste pole musi dać 1, nie NULL.
  // @REQ: CRM-ZESP-KARTOTEKA
  it('puste pole liczba_brygad w edycji zapisuje wartość domyślną 1, nie NULL', async () => {
    const data = buildFullFormData({ liczba_brygad: '' });

    await updateCrewAction('crew-1', data);

    expect(crewUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ liczba_brygad: 1 }) }),
    );
  });

  // Odznaczenie WCZEŚNIEJ ZAZNACZONEGO checkboxa w edycji: true -> false musi się
  // zapisać (gorszy przypadek niż przy tworzeniu, bo wartość domyślna kolumny to
  // false i maskuje ten błąd przy create).
  // @REQ: CRM-ZESP-KARTOTEKA
  it("odznaczenie uprawnienia_sep w edycji ('true' -> 'false') zapisuje boolean false", async () => {
    const data = buildFullFormData({ uprawnienia_sep: 'false' });

    await updateCrewAction('crew-1', data);

    expect(crewUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ uprawnienia_sep: false }) }),
    );
  });

  // Odpowiednik dla posiada_wiertnice.
  // @REQ: CRM-ZESP-KARTOTEKA
  it("odznaczenie posiada_wiertnice w edycji ('true' -> 'false') zapisuje boolean false", async () => {
    const data = buildFullFormData({ posiada_wiertnice: 'false' });

    await updateCrewAction('crew-1', data);

    expect(crewUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ posiada_wiertnice: false }) }),
    );
  });

  // Upload nowego zdjęcia przy edycji podmienia zdjecie_url na nową ścieżkę
  // (AC-A20) — akcja przyjmuje już-wgraną ścieżkę, wzorem updateCrewAvatar.
  // @REQ: CRM-ZESP-KARTOTEKA
  it('podanie nowej ścieżki zdjęcia podmienia zdjecie_url na nową wartość', async () => {
    await updateCrewAction('crew-1', buildFullFormData(), 'zespoly/crew-1-999.jpg');

    expect(crewUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ zdjecie_url: 'zespoly/crew-1-999.jpg' }) }),
    );
  });

  // Edycja BEZ zmiany zdjęcia zachowuje istniejącą ścieżkę — nie ustawia NULL
  // dlatego, że pole pliku było puste (AC-A21, najczęstszy sposób kasowania
  // awatarów formularzem edycji).
  // @REQ: CRM-ZESP-KARTOTEKA
  it('edycja bez podania nowej ścieżki zdjęcia zachowuje istniejące zdjecie_url', async () => {
    await updateCrewAction('crew-1', buildFullFormData());

    const call = crewUpdateMock.mock.calls[0]?.[0];
    // Kluczowe kryterium: klucz zdjecie_url albo jest pominięty w ogóle w
    // przekazanym `data`, albo wskazuje dokładnie starą wartość — nigdy jawnie
    // ustawiony na null ani na undefined.
    if (Object.prototype.hasOwnProperty.call(call?.data ?? {}, 'zdjecie_url')) {
      expect(call.data.zdjecie_url).toBe(EXISTING_RECORD.zdjecie_url);
    }
  });

  // Otwarcie edycji i zapis BEZ ŻADNEJ zmiany zostawia iban/nip/kod_pocztowy_bazowy
  // nietknięte (AC-A13) — test buduje FormData z dokładnie tymi samymi wartościami,
  // jakie miał rekord przed edycją, i sprawdza że zapisane wartości są identyczne.
  // @REQ: CRM-ZESP-KARTOTEKA
  it('zapis formularza edycji bez zmian zachowuje iban, nip i kod_pocztowy_bazowy', async () => {
    const unchanged = buildFullFormData({
      iban: 'PL11000000000000000000000001',
      nip: '9998887766',
      kod_pocztowy_bazowy: '00-001',
    });
    crewFindUniqueMock.mockResolvedValue({
      ...EXISTING_RECORD,
      iban: 'PL11000000000000000000000001',
      nip: '9998887766',
      kod_pocztowy_bazowy: '00-001',
    });

    await updateCrewAction('crew-1', unchanged);

    expect(crewUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          iban: 'PL11000000000000000000000001',
          nip: '9998887766',
          kod_pocztowy_bazowy: '00-001',
        }),
      }),
    );
  });

  // Edycja nieistniejącego id -> czytelny błąd, nie tworzy nowego rekordu i nie
  // kończy się błędem 500 (AC-A23).
  // @REQ: CRM-ZESP-KARTOTEKA
  it('edycja nieistniejącego id zwraca czytelny błąd, nie wywala wyjątku i nie tworzy rekordu', async () => {
    crewFindUniqueMock.mockResolvedValue(null);

    const result = await updateCrewAction('crew-nonexistent', buildFullFormData());

    expect(crewCreateMock).not.toHaveBeenCalled();
    expect(crewUpdateMock).not.toHaveBeenCalled();
    expect(result?.success).toBe(false);
    expect(typeof result?.error).toBe('string');
  });

  // Tryb tworzenia i tryb edycji są rozłączne — updateCrewAction NIGDY nie woła
  // create, nawet dla istniejącego rekordu.
  // @REQ: CRM-ZESP-KARTOTEKA
  it('updateCrewAction nigdy nie woła prisma.zespoly_monterskie.create', async () => {
    await updateCrewAction('crew-1', buildFullFormData());

    expect(crewCreateMock).not.toHaveBeenCalled();
  });

  // Podwójne kliknięcie "Zapisz" w edycji: dwa wywołania na tym samym id nie
  // tworzą drugiego rekordu (create pozostaje niewołane w obu przypadkach) —
  // odpowiednik testu "jeden zapis" dla create, dostosowany do semantyki update
  // (idempotentny zapis na istniejącym id, nie deduplikacja wywołań akcji).
  // @REQ: CRM-ZESP-KARTOTEKA
  it('podwójne wywołanie edycji z tymi samymi danymi nie tworzy drugiego rekordu', async () => {
    const data = buildFullFormData();

    await Promise.all([updateCrewAction('crew-1', data), updateCrewAction('crew-1', data)]);

    expect(crewCreateMock).not.toHaveBeenCalled();
  });
});

describe('updateCrewAction — daty ważności certyfikatów (ERRATA A-2, CRM-ZESP-KARTOTEKA)', () => {
  // FLD-AUDITOR-RADIUS-RENAME (TEST-DEFECT fix): sam wymóg co przy EXISTING_RECORD
  // powyżej — kod_pocztowy_bazowy/promien_dzialania_km identyczne z buildFullFormData(),
  // ten blok testuje daty ważności certyfikatów, nie audyt lokalizacji bazowej.
  const EXISTING_RECORD_WITH_DATES = {
    id: 'crew-1',
    nazwa: 'Ekipa Warszawa Południe',
    email: 'ekipa.waw@example.com',
    zdjecie_url: 'zespoly/crew-1-100.jpg',
    kod_pocztowy_bazowy: '02-100',
    promien_dzialania_km: 50,
    fgaz_valid_until: new Date('2026-01-01T00:00:00.000Z'),
    sep_valid_until: new Date('2026-01-01T00:00:00.000Z'),
  };

  beforeEach(() => {
    crewCreateMock.mockReset();
    crewUpdateMock.mockReset();
    crewFindUniqueMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
    crewFindUniqueMock.mockResolvedValue(EXISTING_RECORD_WITH_DATES);
    crewUpdateMock.mockResolvedValue({ ...EXISTING_RECORD_WITH_DATES });
  });

  // AC-E1/AC-E5 w trybie edycji: poprawna data -> Date w północ UTC.
  // @REQ: CRM-ZESP-KARTOTEKA
  it('poprawne fgazValidUntil i sepValidUntil w edycji zapisują się jako Date w północ UTC danego dnia', async () => {
    const data = buildFullFormData({ fgaz_valid_until: '2027-06-15', sep_valid_until: '2028-01-01' });

    await updateCrewAction('crew-1', data);

    const call = crewUpdateMock.mock.calls[0]?.[0];
    expect((call?.data?.fgaz_valid_until as Date)?.toISOString?.()).toBe('2027-06-15T00:00:00.000Z');
    expect((call?.data?.sep_valid_until as Date)?.toISOString?.()).toBe('2028-01-01T00:00:00.000Z');
  });

  // AC-E4: wyczyszczenie daty w trybie edycji zapisuje NULL, a nie zostawia poprzedniej
  // wartości ani nie zapisuje Invalid Date.
  // @REQ: CRM-ZESP-KARTOTEKA
  it('wyczyszczenie fgazValidUntil i sepValidUntil w edycji zapisuje NULL, nie Invalid Date', async () => {
    const data = buildFullFormData({ fgaz_valid_until: '', sep_valid_until: '' });

    await updateCrewAction('crew-1', data);

    expect(crewUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ fgaz_valid_until: null, sep_valid_until: null }),
      }),
    );
  });

  // Decyzja człowieka z erraty: data w przeszłości dozwolona także w trybie edycji.
  // @REQ: CRM-ZESP-KARTOTEKA
  it('data w przeszłości w edycji jest dozwolona — zapis kończy się sukcesem', async () => {
    const data = buildFullFormData({ fgaz_valid_until: '2020-01-01' });

    const result = await updateCrewAction('crew-1', data);

    expect(result?.success).toBe(true);
    const call = crewUpdateMock.mock.calls[0]?.[0];
    expect((call?.data?.fgaz_valid_until as Date)?.toISOString?.()).toBe('2020-01-01T00:00:00.000Z');
  });

  // AC-E3: zapis edycji bez żadnej zmiany zostawia obie kolumny z tą samą wartością
  // co przed — rozszerzenie istniejącego AC-A13 (iban/nip/kod_pocztowy_bazowy) na
  // nowe pola z erraty A-2.
  // @REQ: CRM-ZESP-KARTOTEKA
  it('zapis formularza edycji bez zmian zachowuje fgaz_valid_until i sep_valid_until', async () => {
    const unchanged = buildFullFormData({ fgaz_valid_until: '2026-01-01', sep_valid_until: '2026-01-01' });

    await updateCrewAction('crew-1', unchanged);

    expect(crewUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          fgaz_valid_until: EXISTING_RECORD_WITH_DATES.fgaz_valid_until,
          sep_valid_until: EXISTING_RECORD_WITH_DATES.sep_valid_until,
        }),
      }),
    );
  });

  // Ochrona przed cichym zerowaniem — dokładnie ten sam wzorzec dowodowy co już
  // zastosowany dla preferowane_marki (auditors-kartoteka.test.ts): fizyczny brak
  // klucza w FormData (nie pusty string) NIE może zerować istniejącej wartości.
  // @REQ: CRM-ZESP-KARTOTEKA
  it('edycja bez pól fgazValidUntil/sepValidUntil w FormData zostawia istniejące daty bez zmian (nie zeruje)', async () => {
    const data = buildFullFormData();
    data.delete('fgaz_valid_until');
    data.delete('sep_valid_until');

    await updateCrewAction('crew-1', data);

    const call = crewUpdateMock.mock.calls.at(-1)?.[0];
    if (Object.prototype.hasOwnProperty.call(call?.data ?? {}, 'fgaz_valid_until')) {
      expect(call.data.fgaz_valid_until).not.toBeNull();
      expect(call.data.fgaz_valid_until).toEqual(EXISTING_RECORD_WITH_DATES.fgaz_valid_until);
    }
    if (Object.prototype.hasOwnProperty.call(call?.data ?? {}, 'sep_valid_until')) {
      expect(call.data.sep_valid_until).not.toBeNull();
      expect(call.data.sep_valid_until).toEqual(EXISTING_RECORD_WITH_DATES.sep_valid_until);
    }
  });
});
