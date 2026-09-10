import { describe, it, expect, vi, beforeEach } from 'vitest';
import { can, ROLES } from '@klikklima/contracts';

/**
 * Wymaganie: CRM-AUDYT-KARTOTEKA (contracts/requirements.contract.mjs, status TODO).
 * Zrodlo: docs/workorders/CRM-KARTOTEKI-CREATE-AND-CREW-ASSIGN.md, CZESC A + rozszerzenie
 * "edycja" (AC-A1..AC-A24, TYLKO czesc dotyczaca audytora — zespol i CZESC B swiadomie
 * pominiete, maja wlasne ID: CRM-ZESP-KARTOTEKA).
 *
 * FAZA RED. Trzy funkcje nie istnieja jeszcze w produkcji:
 *   createAuditorAction(formData: FormData): Promise<{ success: boolean; error?: string; id?: string }>
 *   getAuditorForEdit(id: string): Promise<AuditorEditRecord | null>
 *   updateAuditorAction(id: string, formData: FormData): Promise<{ success: boolean; error?: string }>
 * w apps/b2b-web/src/app/(dashboard)/auditors/actions.ts. Wszystkie trzy testy importu
 * ponizej musza dzis rzucic przy destrukturyzacji ("createAuditorAction is not a function"
 * itp.) — to jest oczekiwany, poprawny RED (brak eksportu funkcji domenowej), potwierdzony
 * uruchomieniem na koncu tej tury.
 *
 * ZALOZENIE WYMAGAJACE POTWIERDZENIA PRZY REVIEW (nie zgaduje po cichu):
 * Kontrakt (requirements.contract.mjs, CRM-AUDYT-KARTOTEKA) i WO uzywaja w prozie NAZW
 * KOLUMN Prisma wprost przy opisie zachowania FormData ("dotyczy doswiadczenie_hvac_lata
 * i promien_dzialania_km", "odznaczone uprawnienia_sep zapisuje wartosc logiczna false",
 * "preferowane_marki jedzie z formularza jako JSON") — to jest kontrakt, zrodlo prawdy
 * (CLAUDE.md, "Zasada zerowa"). Dzisiejszy DEAD-CODE modal (AddAuditorModal.tsx) uzywa
 * za to skroconych angielskich kluczy stanu (name/phone/hvacExperience/sep/radius/zipCode/
 * brands), bo D-A1 (przepisanie na react-hook-form+zod) jeszcze nie nastapilo. Te dwa
 * slowniki sa dzis SPRZECZNE. Wybieram nazwy kolumn Prisma jako klucze FormData w tych
 * testach, bo to one sa cytowane w AUTORYTATYWNYM kontrakcie (nie w opisie martwego kodu
 * sprzed D-A1) i bo ADR-002 nakazuje snake_case dla identyfikatorow technicznych — mapowanie
 * FormData -> Prisma 1:1 eliminuje klase bledow tlumaczenia, ktora to repo juz raz zaplacilo
 * (KK-NAMING-BASELINE). Jesli implementer zdecyduje inaczej (zachowa stare skrocone klucze
 * modala), to jest to sprzeczne z tekstem kontraktu i wymaga jawnej decyzji, nie cichej zmiany
 * tego testu — zgloszenie do review.
 *
 * NIEJASNOSC OTWARTA (kryterium 11, "12 pol formularza"): prozaiczna liczba "12" w kontrakcie
 * nie daje sie jednoznacznie zrekonstruowac z literalnych wyliczen w tym samym kontrakcie —
 * AuditorSummary (8 pol nie-administracyjnych) + 7 jawnie wymienionych brakujacych daje 15,
 * nie 12. Zamiast zgadywac dokladny ksztalt DTO (i pisac kruchy test rownosci Object.keys(),
 * ktory moze paść z niewlasciwego powodu przy calkowicie poprawnej implementacji), test
 * "zwraca wszystkie pola" sprawdza NIEDWUZNACZNA czesc kryterium: obecnosc siedmiu jawnie
 * wymienionych w kontrakcie kolumn (z poprawnymi wartosciami) i BRAK is_active/leave_status,
 * unikajac testu rownosci Object.keys() na spornym pelnym ksztalcie DTO.
 * Dokladny pelny ksztalt DTO — pytanie do review/contract-steward, nie do zgadniecia tutaj.
 *
 * Podwojne klikniecie "Zapisz" (przypadek brzegowy z WO, obie czesci): NIE ma testu na
 * poziomie Server Action. Jedynym unikalnym kluczem biznesowym jest e-mail, ktory jest
 * NULLABLE i najczesciej pusty — dwa niezalezne wywolania createAuditorAction z identycznymi,
 * poprawnymi danymi i bez e-maila SA legalnym stanem (dwoch roznych audytorow moze miec to
 * samo imie i nazwisko). Brak naturalnego klucza dedupikacji po stronie serwera; WO opisuje
 * ochrone jako `disabled={isSubmitting}` juz istniejace w martwym kodzie modala — to jest
 * odpowiedzialnosc UI, nie Server Action. Napisanie testu wymuszajacego dedup w akcji
 * wymyslaloby mechanizm, ktorego kontrakt nie zada. Decyzja: pominiete swiadomie, nie po cichu.
 *
 * Mockujemy @repo/database (brak zywej instancji testowej), next/cache i
 * ../src/utils/supabase/server — identyczny wzorzec jak auditors-delete.test.ts /
 * settings-authorized-users.test.ts.
 */

const {
  auditorCreateMock,
  auditorUpdateMock,
  auditorFindUniqueMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
  signStoragePathsMock,
} = vi.hoisted(() => ({
  auditorCreateMock: vi.fn(),
  auditorUpdateMock: vi.fn(),
  auditorFindUniqueMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  signStoragePathsMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    audytorzy: {
      create: auditorCreateMock,
      update: auditorUpdateMock,
      findUnique: auditorFindUniqueMock,
    },
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}));
// P0-1 (przygotowanie pod przyszłą turę): domyślny brak sesji — ten plik nie testuje ścieżek zależnych od tożsamości poprzez createClient(), więc `getCurrentUser` dostaje bezpieczny, jawny fallback zamiast pozostać niezdefiniowanym mockiem.
getCurrentUserMock.mockResolvedValue({ data: { user: null } });
// Bucket `audytorzy` jest prywatny — getAuditorForEdit musi podpisac sciezke Storage
// przed zwroceniem, identycznie jak signStoragePaths("zespoly", ...) w crews/page.tsx.
// Wzorzec mocka identyczny jak lead-detail-page-pool-spread.test.ts.
vi.mock('@/lib/storage/signed-urls', () => ({
  signStoragePaths: signStoragePathsMock,
}));

const { createAuditorAction, updateAuditorAction, getAuditorForEdit } = await import(
  '../src/app/(dashboard)/auditors/actions'
);

const NON_ADMIN_ROLES = ROLES.filter((r) => r !== 'admin');

function buildFullFormData(overrides: Record<string, string> = {}): FormData {
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
    zdjecie_url: 'audytorzy/aud-1-123456.jpg',
    // ERRATA A-2 (2026-08-31): fgaz_valid_until / sep_valid_until — daty ważności
    // certyfikatów, dodane przez korektę kontraktu CRM-AUDYT-KARTOTEKA (12 -> 14 pól).
    // Konwencja nazw pól FormData po stronie audytora naśladuje sąsiada w tym samym
    // pliku (nazwy kolumn Prisma, snake_case), zgodnie z tabelą w erracie WO.
    // Wartości domyślne w przyszłości, żeby istniejące testy "sukces" pozostały
    // niezmienione (nadmiarowe klucze nie wpływają na asercje objectContaining/toMatchObject).
    fgaz_valid_until: '2027-06-15',
    sep_valid_until: '2028-01-01',
  };
  const merged = { ...base, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    fd.append(key, value);
  }
  return fd;
}

const EXISTING_AUDITOR_RECORD = {
  id: 'aud-1',
  imie_i_nazwisko: 'Jan Kowalski',
  telefon: '+48123123123',
  email: 'jan.kowalski@example.com',
  adres: 'Warszawa, ul. Testowa 1',
  nazwa_firmy: 'HVAC Jan Kowalski',
  nip: '1234567890',
  certyfikat_fgaz: 'FGAZ/1/2024',
  fgaz_valid_until: null,
  // ERRATA A-2 (2026-08-31): sep_valid_until dodane przez korektę kontraktu
  // (12 -> 14 pól). Dziś NIE jest czytane nigdzie poza zapisem (AC-E6/poza zakresem
  // w erracie) — obecność w mocku nie zmienia żadnego istniejącego zachowania.
  sep_valid_until: null,
  doswiadczenie_hvac_lata: 5,
  uprawnienia_sep: true,
  preferowane_marki: ['Daikin', 'Mitsubishi'],
  kod_pocztowy_bazowy: '00-001',
  promien_dzialania_km: 50,
  iban: 'PL61109010140000071219812874',
  zdjecie_url: 'audytorzy/aud-1-123456.jpg',
  is_active: true,
  leave_status: 'ACTIVE',
};

describe('createAuditorAction / updateAuditorAction / getAuditorForEdit — kartoteka audytora (CRM-AUDYT-KARTOTEKA)', () => {
  beforeEach(() => {
    auditorCreateMock.mockReset();
    auditorUpdateMock.mockReset();
    auditorFindUniqueMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('admin');
    signStoragePathsMock.mockReset();
    signStoragePathsMock.mockResolvedValue({
      'audytorzy/aud-1-123456.jpg': 'https://signed.example/audytorzy/aud-1-123456.jpg?token=xyz',
    });
  });

  describe('createAuditorAction — bramka RBAC', () => {
    // Kontrola pozytywna kontraktu: bez niej odmowa wszystkim "przechodzi" z niewlasciwego powodu.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('kontrola pozytywna kontraktu — tylko admin ma create na auditors w macierzy RBAC', () => {
      expect(can('admin', 'auditors', 'create')).toBe('yes');
      for (const role of NON_ADMIN_ROLES) {
        expect(can(role, 'auditors', 'create')).not.toBe('yes');
      }
    });

    // @REQ: CRM-AUDYT-KARTOTEKA
    it.each(NON_ADMIN_ROLES)(
      'rola %s jest odrzucona po stronie serwera i nie tworzy wiersza',
      async (role) => {
        getCurrentActorRoleMock.mockResolvedValue(role);

        const result = await createAuditorAction(buildFullFormData());

        expect(result.success).toBe(false);
        expect(auditorCreateMock).not.toHaveBeenCalled();
      },
    );

    // Rola z sesji, nigdy z argumentu — akcja nie przyjmuje roli jako parametru wywolania
    // wiec jedynym kanalem sterowania jest mock getCurrentActorRole (wzorem
    // auditors-delete.test.ts / settings-authorized-users.test.ts).
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed', async () => {
      getCurrentActorRoleMock.mockResolvedValue(null);

      const result = await createAuditorAction(buildFullFormData());

      expect(result.success).toBe(false);
      expect(auditorCreateMock).not.toHaveBeenCalled();
    });

    // MINOR 4 (rls-security-auditor, review post-GREEN CRM-AUDYT-KARTOTEKA): rola z
    // FormData nie moze ominac bramki — jedynym zrodlem jest getCurrentActorRole()
    // (sesja), nigdy argument wywolania. Analogiczny test istnieje juz dla
    // createCrewAction w crews-kartoteka.test.ts ("podanie roli 'admin' wewnatrz
    // FormData nie omija bramki") — ta sama konwencja klucza `role`.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('podanie roli "admin" wewnatrz FormData nie omija bramki, gdy sesja ma inna role', async () => {
      getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
      const fd = buildFullFormData();
      fd.append('role', 'admin');

      const result = await createAuditorAction(fd);

      expect(result.success).toBe(false);
      expect(auditorCreateMock).not.toHaveBeenCalled();
    });
  });

  describe('createAuditorAction — sukces i mapowanie pol', () => {
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('poprawnie wypelniony FormData tworzy audytora z poprawnie zmapowanymi polami', async () => {
      auditorCreateMock.mockResolvedValue({ ...EXISTING_AUDITOR_RECORD, id: 'aud-new' });

      const result = await createAuditorAction(buildFullFormData());

      expect(result.success).toBe(true);
      expect(auditorCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            imie_i_nazwisko: 'Jan Kowalski',
            telefon: '+48123123123',
            email: 'jan.kowalski@example.com',
            adres: 'Warszawa, ul. Testowa 1',
            nazwa_firmy: 'HVAC Jan Kowalski',
            nip: '1234567890',
            certyfikat_fgaz: 'FGAZ/1/2024',
            doswiadczenie_hvac_lata: 5,
            uprawnienia_sep: true,
            preferowane_marki: ['Daikin', 'Mitsubishi'],
            kod_pocztowy_bazowy: '00-001',
            promien_dzialania_km: 50,
            iban: 'PL61109010140000071219812874',
          }),
        }),
      );
    });

    // AC-A7: walidacja serwerowa niezalezna od atrybutu `required` w HTML.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('brak imie_i_nazwisko odrzuca zapis niezaleznie od tego co przyszlo w FormData', async () => {
      const fd = buildFullFormData({ imie_i_nazwisko: '' });

      const result = await createAuditorAction(fd);

      expect(result.success).toBe(false);
      expect(auditorCreateMock).not.toHaveBeenCalled();
    });

    // @REQ: CRM-AUDYT-KARTOTEKA
    it('brak pola imie_i_nazwisko w ogole (nie tylko puste) odrzuca zapis', async () => {
      const fd = new FormData();
      fd.append('telefon', '+48123123123');

      const result = await createAuditorAction(fd);

      expect(result.success).toBe(false);
      expect(auditorCreateMock).not.toHaveBeenCalled();
    });

    // AC-A9: czytelny blad domenowy, nie surowy wyjatek Prismy.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('kolizja unikalnego e-maila (P2002) zwraca czytelny blad, nie rzuca wyjatku', async () => {
      auditorCreateMock.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      const result = await createAuditorAction(buildFullFormData());

      expect(result.success).toBe(false);
      expect(typeof result.error).toBe('string');
      expect(result.error).not.toMatch(/PrismaClientKnownRequestError/);
    });

    // AC-A10: pusty e-mail zapisuje sie jako NULL, nie jako pusty string ('' koliduje
    // z @unique przy drugim rekordzie, NULL nie koliduje).
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('pusty e-mail w FormData zapisuje sie jako null, nie jako pusty string', async () => {
      auditorCreateMock.mockResolvedValue({ ...EXISTING_AUDITOR_RECORD, id: 'aud-new', email: null });
      const fd = buildFullFormData({ email: '' });

      const result = await createAuditorAction(fd);

      expect(result.success).toBe(true);
      expect(auditorCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ email: null }) }),
      );
    });

    // Kontrola pozytywna dla AC-A10: dwoch audytorow bez e-maila wspolistnieje —
    // dowod ze druga proba z pustym e-mailem NIE trafia w te sama kolizje co niepusty.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('drugie utworzenie audytora z pustym e-mailem tez sie udaje (dwoch bez e-maila wspolistnieje)', async () => {
      auditorCreateMock.mockResolvedValue({ ...EXISTING_AUDITOR_RECORD, id: 'aud-2', email: null });

      const first = await createAuditorAction(buildFullFormData({ email: '', imie_i_nazwisko: 'Anna Nowak' }));
      const second = await createAuditorAction(buildFullFormData({ email: '', imie_i_nazwisko: 'Piotr Zielinski' }));

      expect(first.success).toBe(true);
      expect(second.success).toBe(true);
      expect(auditorCreateMock).toHaveBeenCalledTimes(2);
    });

    // @REQ: CRM-AUDYT-KARTOTEKA
    it.each([
      ['', null],
      ['5', 5],
    ])('doswiadczenie_hvac_lata=%j z FormData mapuje sie na %j (nigdy NaN)', async (input, expected) => {
      auditorCreateMock.mockResolvedValue({ ...EXISTING_AUDITOR_RECORD, id: 'aud-new' });
      const fd = buildFullFormData({ doswiadczenie_hvac_lata: input });

      await createAuditorAction(fd);

      expect(auditorCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ doswiadczenie_hvac_lata: expected }) }),
      );
    });

    // Brak pola w ogole (nie tylko pusty string) — ten sam wymog co dla pustego stringa.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('brak pola doswiadczenie_hvac_lata w FormData mapuje sie na null, nie na 0', async () => {
      auditorCreateMock.mockResolvedValue({ ...EXISTING_AUDITOR_RECORD, id: 'aud-new' });
      const fd = buildFullFormData();
      fd.delete('doswiadczenie_hvac_lata');

      await createAuditorAction(fd);

      expect(auditorCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ doswiadczenie_hvac_lata: null }) }),
      );
    });

    // @REQ: CRM-AUDYT-KARTOTEKA
    it.each([
      ['', null],
      ['50', 50],
    ])('promien_dzialania_km=%j z FormData mapuje sie na %j (nigdy NaN, nigdy 0)', async (input, expected) => {
      auditorCreateMock.mockResolvedValue({ ...EXISTING_AUDITOR_RECORD, id: 'aud-new' });
      const fd = buildFullFormData({ promien_dzialania_km: input });

      await createAuditorAction(fd);

      expect(auditorCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ promien_dzialania_km: expected }) }),
      );
    });

    // preferowane_marki: JSON w polu tekstowym, kolumna String[].
    // @REQ: CRM-AUDYT-KARTOTEKA
    it("preferowane_marki='[]' czysci liste (zapisuje pusta tablice, nie ignoruje)", async () => {
      auditorCreateMock.mockResolvedValue({ ...EXISTING_AUDITOR_RECORD, id: 'aud-new', preferowane_marki: [] });
      const fd = buildFullFormData({ preferowane_marki: '[]' });

      await createAuditorAction(fd);

      expect(auditorCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ preferowane_marki: [] }) }),
      );
    });

    // @REQ: CRM-AUDYT-KARTOTEKA
    it('preferowane_marki z poprawnym JSON-em mapuje sie na tablice stringow', async () => {
      auditorCreateMock.mockResolvedValue({ ...EXISTING_AUDITOR_RECORD, id: 'aud-new' });
      const fd = buildFullFormData({ preferowane_marki: JSON.stringify(['Daikin', 'Mitsubishi']) });

      await createAuditorAction(fd);

      expect(auditorCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ preferowane_marki: ['Daikin', 'Mitsubishi'] }) }),
      );
    });

    // Niepoprawny JSON: kontrakt (CRM-AUDYT-KARTOTEKA acceptance) mowi wprost
    // "niepoprawny JSON ODRZUCA zapis zamiast zapisac pusta tablice po cichu" —
    // dotyczy trybu edycji explicite; dla tworzenia stosuje sie ten sam standard
    // (spojnosc z AC-A9's "czytelny blad, nie cichy fallback").
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('preferowane_marki z niepoprawnym JSON-em odrzuca zapis (nie zapisuje [] po cichu)', async () => {
      const fd = buildFullFormData({ preferowane_marki: 'not-json' });

      const result = await createAuditorAction(fd);

      expect(result.success).toBe(false);
      expect(auditorCreateMock).not.toHaveBeenCalled();
    });

    // Checkbox jako string 'false' jest "prawdziwy" w JS — pulapka wymieniona wprost w kontrakcie.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it("uprawnienia_sep='false' (string) mapuje sie na boolean false, nie true", async () => {
      auditorCreateMock.mockResolvedValue({ ...EXISTING_AUDITOR_RECORD, id: 'aud-new', uprawnienia_sep: false });
      const fd = buildFullFormData({ uprawnienia_sep: 'false' });

      await createAuditorAction(fd);

      expect(auditorCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ uprawnienia_sep: false }) }),
      );
    });

    // @REQ: CRM-AUDYT-KARTOTEKA
    it("uprawnienia_sep='true' (string) mapuje sie na boolean true", async () => {
      auditorCreateMock.mockResolvedValue({ ...EXISTING_AUDITOR_RECORD, id: 'aud-new', uprawnienia_sep: true });
      const fd = buildFullFormData({ uprawnienia_sep: 'true' });

      await createAuditorAction(fd);

      expect(auditorCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ uprawnienia_sep: true }) }),
      );
    });
  });

  describe('createAuditorAction — daty ważności certyfikatów (ERRATA A-2, CRM-AUDYT-KARTOTEKA)', () => {
    // AC-E1/AC-E5: poprawna data kalendarzowa w obu polach -> Date w północ UTC
    // TEGO SAMEGO dnia kalendarzowego. Porównanie przez toISOString(), nie przez
    // konstrukcję Date z literałem porównawczym (zależne od strefy uruchomienia).
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('poprawne fgaz_valid_until i sep_valid_until zapisują się jako Date w północ UTC danego dnia', async () => {
      auditorCreateMock.mockResolvedValue({ ...EXISTING_AUDITOR_RECORD, id: 'aud-new' });
      const fd = buildFullFormData({ fgaz_valid_until: '2027-06-15', sep_valid_until: '2028-01-01' });

      await createAuditorAction(fd);

      const call = auditorCreateMock.mock.calls[0]?.[0];
      expect((call?.data?.fgaz_valid_until as Date)?.toISOString?.()).toBe('2027-06-15T00:00:00.000Z');
      expect((call?.data?.sep_valid_until as Date)?.toISOString?.()).toBe('2028-01-01T00:00:00.000Z');
    });

    // Pusty string z <input type="date"> -> NULL, nigdy Invalid Date ani epoka 1970.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('puste fgaz_valid_until i sep_valid_until zapisują się jako NULL, nie Invalid Date ani epoka 1970', async () => {
      auditorCreateMock.mockResolvedValue({ ...EXISTING_AUDITOR_RECORD, id: 'aud-new' });
      const fd = buildFullFormData({ fgaz_valid_until: '', sep_valid_until: '' });

      await createAuditorAction(fd);

      expect(auditorCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ fgaz_valid_until: null, sep_valid_until: null }) }),
      );
    });

    // Decyzja człowieka z erraty (2026-08-31): data w przeszłości DOZWOLONA.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('data w przeszłości w fgaz_valid_until jest dozwolona — zapis kończy się sukcesem', async () => {
      auditorCreateMock.mockResolvedValue({ ...EXISTING_AUDITOR_RECORD, id: 'aud-new' });
      const fd = buildFullFormData({ fgaz_valid_until: '2020-01-01' });

      const result = await createAuditorAction(fd);

      expect(result.success).toBe(true);
      const call = auditorCreateMock.mock.calls[0]?.[0];
      expect((call?.data?.fgaz_valid_until as Date)?.toISOString?.()).toBe('2020-01-01T00:00:00.000Z');
    });

    // AC-E6: te pola NIE mogą stać się nową bramką walidacyjną dla audytora —
    // errata karmi wyłącznie zapis danymi, getAuditors() nadal ich nie czyta.
    // Audytor z obiema datami NULL (albo przeszłą datą) nadal tworzy się poprawnie.
    // Zabezpieczenie przed "naprawą dla symetrii" zgłoszoną jako poza zakresem w WO.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('AC-E6: audytor z pustymi datami ważności certyfikatów nadal tworzy się poprawnie (brak nowej bramki)', async () => {
      auditorCreateMock.mockResolvedValue({ ...EXISTING_AUDITOR_RECORD, id: 'aud-new', fgaz_valid_until: null, sep_valid_until: null });
      const fd = buildFullFormData({ fgaz_valid_until: '', sep_valid_until: '' });

      const result = await createAuditorAction(fd);

      expect(result.success).toBe(true);
      expect(auditorCreateMock).toHaveBeenCalled();
    });
  });

  describe('getAuditorForEdit — bramka RBAC', () => {
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('kontrola pozytywna kontraktu — tylko admin ma update na auditors w macierzy RBAC', () => {
      expect(can('admin', 'auditors', 'update')).toBe('yes');
      for (const role of NON_ADMIN_ROLES) {
        expect(can(role, 'auditors', 'update')).not.toBe('yes');
      }
    });

    // AC-A14: dyspozytor widzi liste (read), ale nie ma update — przypadek najwazniejszy.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it.each(NON_ADMIN_ROLES)('rola %s jest odrzucona przy pobieraniu rekordu do edycji', async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      auditorFindUniqueMock.mockResolvedValue(EXISTING_AUDITOR_RECORD);

      const result = await getAuditorForEdit('aud-1');

      expect(result).toBeFalsy();
    });

    // @REQ: CRM-AUDYT-KARTOTEKA
    it('brak roli (null) jest odrzucony fail-closed', async () => {
      getCurrentActorRoleMock.mockResolvedValue(null);
      auditorFindUniqueMock.mockResolvedValue(EXISTING_AUDITOR_RECORD);

      const result = await getAuditorForEdit('aud-1');

      expect(result).toBeFalsy();
    });
  });

  describe('getAuditorForEdit — ksztalt danych', () => {
    // AC-A11/AC-A16: dane dla formularza edycji zawieraja co najmniej te 7 pol, ktorych
    // brakuje w AuditorSummary (kontrakt wymienia je jawnie z nazwy). Patrz komentarz na
    // gorze pliku — pelna rownosc Object.keys() na dokladnie 12 kluczach NIE jest tu
    // testowana, bo dokladny ksztalt DTO jest niejednoznaczny w tekscie kontraktu.
    // Bucket `audytorzy` jest prywatny — surowa sciezka z rekordu nie wyrenderuje sie jako
    // <img src> w przegladarce. zdjecie_url w wyniku MUSI byc wartoscia zwrocona przez
    // signStoragePaths (podpisany URL), nie surowa sciezka z bazy — identycznie jak
    // signStoragePaths("zespoly", ...) w crews/page.tsx. Asercja na wartosci z mocka
    // (nie na literale wejsciowym) dowodzi, ze pole faktycznie przeszlo przez podpisywanie,
    // a nie ze test przypadkiem trafil w surowa wartosc.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('zwraca komplet pol brakujacych w AuditorSummary: adres, nazwa_firmy, nip, doswiadczenie_hvac_lata, kod_pocztowy_bazowy, iban, zdjecie_url (podpisany URL)', async () => {
      auditorFindUniqueMock.mockResolvedValue(EXISTING_AUDITOR_RECORD);
      const signedUrl = 'https://signed.example/audytorzy/aud-1-123456.jpg?token=xyz';
      signStoragePathsMock.mockResolvedValue({
        [EXISTING_AUDITOR_RECORD.zdjecie_url]: signedUrl,
      });

      const result = await getAuditorForEdit('aud-1');

      expect(result).toMatchObject({
        adres: 'Warszawa, ul. Testowa 1',
        nazwa_firmy: 'HVAC Jan Kowalski',
        nip: '1234567890',
        doswiadczenie_hvac_lata: 5,
        kod_pocztowy_bazowy: '00-001',
        iban: 'PL61109010140000071219812874',
        zdjecie_url: signedUrl,
      });
      expect(result?.zdjecie_url).not.toBe(EXISTING_AUDITOR_RECORD.zdjecie_url);
      expect(signStoragePathsMock).toHaveBeenCalledWith(
        'audytorzy',
        [EXISTING_AUDITOR_RECORD.zdjecie_url],
        expect.any(Number),
      );
    });

    // Brak zdjecia: podpisywanie pustej/nieistniejacej sciezki nie ma sensu (signStoragePaths
    // samo w sobie jest bezpieczne na []), ale getAuditorForEdit nie powinien w ogole wolac
    // storage, gdy nie ma czego podpisywac.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('audytor bez zdjecia (zdjecie_url null) nie woluje signStoragePaths i zwraca zdjecie_url null', async () => {
      auditorFindUniqueMock.mockResolvedValue({ ...EXISTING_AUDITOR_RECORD, zdjecie_url: null });

      const result = await getAuditorForEdit('aud-1');

      expect(result?.zdjecie_url).toBeNull();
      expect(signStoragePathsMock).not.toHaveBeenCalled();
    });

    // is_active i leave_status sa administracyjne i NIE naleza do 12 pol formularza —
    // nie moga trafic do danych wykorzystywanych przez formularz edycji.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('NIE zwraca is_active ani leave_status', async () => {
      auditorFindUniqueMock.mockResolvedValue(EXISTING_AUDITOR_RECORD);

      const result = await getAuditorForEdit('aud-1');

      expect(result).not.toHaveProperty('is_active');
      expect(result).not.toHaveProperty('leave_status');
    });

    // AC-A23: nieistniejacy id zwraca czytelny brak, nie wyjatek.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('nieistniejacy id zwraca null/falsy, nie rzuca wyjatku', async () => {
      auditorFindUniqueMock.mockResolvedValue(null);

      await expect(getAuditorForEdit('nie-istnieje')).resolves.toBeFalsy();
    });

    // AC-E3 (ERRATA A-2, 2026-08-31): otwarcie formularza edycji musi pokazać obie
    // daty ważności certyfikatów — rozszerzenie na 14 pól.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('zwraca fgaz_valid_until i sep_valid_until z rekordu', async () => {
      const withDates = {
        ...EXISTING_AUDITOR_RECORD,
        fgaz_valid_until: new Date('2027-06-15T00:00:00.000Z'),
        sep_valid_until: new Date('2028-01-01T00:00:00.000Z'),
      };
      auditorFindUniqueMock.mockResolvedValue(withDates);

      const result = await getAuditorForEdit('aud-1');

      expect(result).toMatchObject({
        fgaz_valid_until: withDates.fgaz_valid_until,
        sep_valid_until: withDates.sep_valid_until,
      });
    });
  });

  describe('updateAuditorAction — bramka RBAC', () => {
    // AC-A14: rola inna niz admin odrzucona, zero zmienionych kolumn. dyspozytor
    // (ma read) jest tu najwazniejszym przypadkiem testowym.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it.each(NON_ADMIN_ROLES)('rola %s jest odrzucona i nie zmienia zadnej kolumny', async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);
      auditorFindUniqueMock.mockResolvedValue(EXISTING_AUDITOR_RECORD);

      const result = await updateAuditorAction('aud-1', buildFullFormData());

      expect(result.success).toBe(false);
      expect(auditorUpdateMock).not.toHaveBeenCalled();
    });

    // Rola z sesji, nigdy z argumentu — brak parametru roli w sygnaturze wywolania.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('brak roli (null) jest odrzucony fail-closed przy edycji', async () => {
      getCurrentActorRoleMock.mockResolvedValue(null);
      auditorFindUniqueMock.mockResolvedValue(EXISTING_AUDITOR_RECORD);

      const result = await updateAuditorAction('aud-1', buildFullFormData());

      expect(result.success).toBe(false);
      expect(auditorUpdateMock).not.toHaveBeenCalled();
    });

    // MINOR 4 (rls-security-auditor, review post-GREEN CRM-AUDYT-KARTOTEKA): odpowiednik
    // testu powyzej dla createAuditorAction, tym razem dla edycji — rola z FormData
    // musi byc ignorowana, jedynym zrodlem jest sesja.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('podanie roli "admin" wewnatrz FormData nie omija bramki przy edycji, gdy sesja ma inna role', async () => {
      getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
      auditorFindUniqueMock.mockResolvedValue(EXISTING_AUDITOR_RECORD);
      const fd = buildFullFormData();
      fd.append('role', 'admin');

      const result = await updateAuditorAction('aud-1', fd);

      expect(result.success).toBe(false);
      expect(auditorUpdateMock).not.toHaveBeenCalled();
    });
  });

  describe('updateAuditorAction — sukces, mapowanie i przypadki brzegowe', () => {
    // AC-A12: edycja w miejscu, id niezmienione.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('poprawny zapis edycji woluje prisma.audytorzy.update z tym samym id i zmapowanymi polami', async () => {
      auditorFindUniqueMock.mockResolvedValue(EXISTING_AUDITOR_RECORD);
      auditorUpdateMock.mockResolvedValue({ ...EXISTING_AUDITOR_RECORD, imie_i_nazwisko: 'Jan Nowak' });

      const result = await updateAuditorAction('aud-1', buildFullFormData({ imie_i_nazwisko: 'Jan Nowak' }));

      expect(result.success).toBe(true);
      expect(auditorUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'aud-1' },
          data: expect.objectContaining({ imie_i_nazwisko: 'Jan Nowak' }),
        }),
      );
    });

    // AC-A7 dla edycji: walidacja serwerowa niezalezna od HTML `required`.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('brak imie_i_nazwisko odrzuca edycje, update nie jest wolane', async () => {
      auditorFindUniqueMock.mockResolvedValue(EXISTING_AUDITOR_RECORD);

      const result = await updateAuditorAction('aud-1', buildFullFormData({ imie_i_nazwisko: '' }));

      expect(result.success).toBe(false);
      expect(auditorUpdateMock).not.toHaveBeenCalled();
    });

    // AC-A18: naiwne findUnique({where:{email}}) przed zapisem znajduje WLASNY rekord
    // i falszywie odrzuca kazda edycje pracownika z e-mailem. Test czarnoskrzynkowy:
    // niezaleznie od mechanizmu, edycja z niezmienionym wlasnym e-mailem musi sie udac.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('edycja z niezmienionym wlasnym e-mailem konczy sie sukcesem (brak falszywej kolizji)', async () => {
      auditorFindUniqueMock.mockResolvedValue(EXISTING_AUDITOR_RECORD);
      auditorUpdateMock.mockResolvedValue(EXISTING_AUDITOR_RECORD);

      const result = await updateAuditorAction(
        'aud-1',
        buildFullFormData({ email: EXISTING_AUDITOR_RECORD.email as string }),
      );

      expect(result.success).toBe(true);
      expect(auditorUpdateMock).toHaveBeenCalled();
    });

    // AC-A17: e-mail zajety przez INNY rekord — czytelny blad domenowy, nie surowy P2002.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('zmiana e-maila na zajety przez inny rekord zwraca czytelny blad, nie rzuca wyjatku', async () => {
      auditorFindUniqueMock.mockResolvedValue(EXISTING_AUDITOR_RECORD);
      auditorUpdateMock.mockRejectedValue(
        Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
      );

      const result = await updateAuditorAction(
        'aud-1',
        buildFullFormData({ email: 'zajety-przez-innego@example.com' }),
      );

      expect(result.success).toBe(false);
      expect(typeof result.error).toBe('string');
      expect(result.error).not.toMatch(/PrismaClientKnownRequestError/);
    });

    // AC-A19: wyczyszczenie e-maila w edycji daje NULL, nie ''.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('wyczyszczenie e-maila w edycji zapisuje null, nie pusty string', async () => {
      auditorFindUniqueMock.mockResolvedValue(EXISTING_AUDITOR_RECORD);
      auditorUpdateMock.mockResolvedValue({ ...EXISTING_AUDITOR_RECORD, email: null });

      const result = await updateAuditorAction('aud-1', buildFullFormData({ email: '' }));

      expect(result.success).toBe(true);
      expect(auditorUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ email: null }) }),
      );
    });

    // Odpowiednik AC-A19 w druga strone: dwoch pracownikow z wyczyszczonym e-mailem
    // wspolistnieje (kolumna NULLable + @unique, drugi '' wysadzalby zapis, NULL nie).
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('wyczyszczenie e-maila u dwoch roznych rekordow w edycji nie koliduje', async () => {
      auditorFindUniqueMock.mockResolvedValue(EXISTING_AUDITOR_RECORD);
      auditorUpdateMock.mockResolvedValue({ ...EXISTING_AUDITOR_RECORD, email: null });

      const first = await updateAuditorAction('aud-1', buildFullFormData({ email: '' }));
      const second = await updateAuditorAction('aud-2', buildFullFormData({ email: '' }));

      expect(first.success).toBe(true);
      expect(second.success).toBe(true);
    });

    // @REQ: CRM-AUDYT-KARTOTEKA
    it.each([
      ['', null],
      ['5', 5],
    ])('doswiadczenie_hvac_lata=%j w edycji mapuje sie na %j (nigdy NaN)', async (input, expected) => {
      auditorFindUniqueMock.mockResolvedValue(EXISTING_AUDITOR_RECORD);
      auditorUpdateMock.mockResolvedValue(EXISTING_AUDITOR_RECORD);

      await updateAuditorAction('aud-1', buildFullFormData({ doswiadczenie_hvac_lata: input }));

      expect(auditorUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ doswiadczenie_hvac_lata: expected }) }),
      );
    });

    // @REQ: CRM-AUDYT-KARTOTEKA
    it.each([
      ['', null],
      ['50', 50],
    ])('promien_dzialania_km=%j w edycji mapuje sie na %j (nigdy NaN, nigdy 0)', async (input, expected) => {
      auditorFindUniqueMock.mockResolvedValue(EXISTING_AUDITOR_RECORD);
      auditorUpdateMock.mockResolvedValue(EXISTING_AUDITOR_RECORD);

      await updateAuditorAction('aud-1', buildFullFormData({ promien_dzialania_km: input }));

      expect(auditorUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ promien_dzialania_km: expected }) }),
      );
    });

    // Test gorszego przypadku niz przy tworzeniu (kontrakt to podkresla): ODZNACZENIE
    // wczesniej ZAZNACZONEGO checkboxa. Rekord ma dzis uprawnienia_sep=true.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it("odznaczenie wczesniej zaznaczonego uprawnienia_sep ('false' string) zapisuje boolean false", async () => {
      auditorFindUniqueMock.mockResolvedValue({ ...EXISTING_AUDITOR_RECORD, uprawnienia_sep: true });
      auditorUpdateMock.mockResolvedValue({ ...EXISTING_AUDITOR_RECORD, uprawnienia_sep: false });

      await updateAuditorAction('aud-1', buildFullFormData({ uprawnienia_sep: 'false' }));

      expect(auditorUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ uprawnienia_sep: false }) }),
      );
    });

    // Edycja niepustej listy na '[]' MUSI wyczyscic, nie zignorowac.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it("edycja niepustej preferowane_marki na '[]' czysci liste w bazie", async () => {
      auditorFindUniqueMock.mockResolvedValue(EXISTING_AUDITOR_RECORD);
      auditorUpdateMock.mockResolvedValue({ ...EXISTING_AUDITOR_RECORD, preferowane_marki: [] });

      await updateAuditorAction('aud-1', buildFullFormData({ preferowane_marki: '[]' }));

      expect(auditorUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ preferowane_marki: [] }) }),
      );
    });

    // Niepoprawny JSON w edycji: kontrakt mowi wprost ODRZUCIC, bo cichy fallback do []
    // to cicha utrata danych (inaczej niz przy tworzeniu, gdzie [] byloby tylko brakiem zysku).
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('niepoprawny JSON w preferowane_marki odrzuca edycje, nie zapisuje [] po cichu', async () => {
      auditorFindUniqueMock.mockResolvedValue(EXISTING_AUDITOR_RECORD);

      const result = await updateAuditorAction('aud-1', buildFullFormData({ preferowane_marki: 'not-json' }));

      expect(result.success).toBe(false);
      expect(auditorUpdateMock).not.toHaveBeenCalled();
    });

    // AC-A20/AC-A21: nowe zdjecie podmienia sciezke, edycja bez dotykania zdjecia
    // zostawia zdjecie_url bez zmian (nie ustawia null dlatego, ze pole bylo puste).
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('wgranie nowej sciezki zdjecia podmienia zdjecie_url na nowa wartosc', async () => {
      auditorFindUniqueMock.mockResolvedValue(EXISTING_AUDITOR_RECORD);
      auditorUpdateMock.mockResolvedValue({ ...EXISTING_AUDITOR_RECORD, zdjecie_url: 'audytorzy/aud-1-999.jpg' });

      await updateAuditorAction('aud-1', buildFullFormData({ zdjecie_url: 'audytorzy/aud-1-999.jpg' }));

      expect(auditorUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ zdjecie_url: 'audytorzy/aud-1-999.jpg' }) }),
      );
    });

    // @REQ: CRM-AUDYT-KARTOTEKA
    it('edycja bez pola zdjecie_url w FormData zostawia istniejaca sciezke bez zmian (nie null, nie undefined w zapisie)', async () => {
      auditorFindUniqueMock.mockResolvedValue(EXISTING_AUDITOR_RECORD);
      auditorUpdateMock.mockResolvedValue(EXISTING_AUDITOR_RECORD);
      const fd = buildFullFormData();
      fd.delete('zdjecie_url');

      await updateAuditorAction('aud-1', fd);

      const call = auditorUpdateMock.mock.calls.at(-1)?.[0];
      expect(call.data).not.toHaveProperty('zdjecie_url', null);
      if (Object.prototype.hasOwnProperty.call(call.data, 'zdjecie_url')) {
        expect(call.data.zdjecie_url).not.toBeUndefined();
        expect(call.data.zdjecie_url).toBe(EXISTING_AUDITOR_RECORD.zdjecie_url);
      }
    });

    // MAJOR (rls-security-auditor, review post-GREEN CRM-AUDYT-KARTOTEKA): brak klucza
    // preferowane_marki w FormData (nie ustawiony, nie pusty string — klucz fizycznie
    // nieobecny) nie moze cicho zerowac listy marek audytora. Dowod znaleziony przez
    // recenzenta na zywej bazie (wycofana transakcja): UPDATE bez klucza
    // preferowane_marki -> zapis= []. Ten sam wzorzec dowodowy co dla zdjecie_url
    // ponizej (formData.has() musi chronic to pole tak samo).
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('edycja bez pola preferowane_marki w FormData zostawia istniejaca liste marek bez zmian (nie zapisuje [] po cichu)', async () => {
      auditorFindUniqueMock.mockResolvedValue(EXISTING_AUDITOR_RECORD);
      auditorUpdateMock.mockResolvedValue(EXISTING_AUDITOR_RECORD);
      const fd = buildFullFormData();
      fd.delete('preferowane_marki');

      await updateAuditorAction('aud-1', fd);

      const call = auditorUpdateMock.mock.calls.at(-1)?.[0];
      expect(call.data).not.toHaveProperty('preferowane_marki', []);
      if (Object.prototype.hasOwnProperty.call(call.data, 'preferowane_marki')) {
        expect(call.data.preferowane_marki).not.toBeUndefined();
        expect(call.data.preferowane_marki).toEqual(EXISTING_AUDITOR_RECORD.preferowane_marki);
      }
    });

    // is_active/leave_status nie naleza do 12 pol formularza — zapis edycji nie moze
    // ich cofnac (wyscig z toggleAuditorActiveAction dzialajacym rownolegle w innej karcie).
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('zapis edycji nigdy nie wysyla is_active ani leave_status do prisma.audytorzy.update', async () => {
      auditorFindUniqueMock.mockResolvedValue(EXISTING_AUDITOR_RECORD);
      auditorUpdateMock.mockResolvedValue(EXISTING_AUDITOR_RECORD);

      await updateAuditorAction('aud-1', buildFullFormData());

      const call = auditorUpdateMock.mock.calls.at(-1)?.[0];
      expect(call.data).not.toHaveProperty('is_active');
      expect(call.data).not.toHaveProperty('leave_status');
    });

    // AC-A23: edycja nieistniejacego id (usuniety w innej karcie) — czytelny blad, brak 500,
    // brak nowego rekordu. Wzorem toggleAuditorActiveAction, ktore sprawdza istnienie przed zapisem.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('edycja nieistniejacego id zwraca czytelny blad i nie tworzy nowego rekordu', async () => {
      auditorFindUniqueMock.mockResolvedValue(null);

      const result = await updateAuditorAction('nie-istnieje', buildFullFormData());

      expect(result.success).toBe(false);
      expect(typeof result.error).toBe('string');
      expect(auditorUpdateMock).not.toHaveBeenCalled();
      expect(auditorCreateMock).not.toHaveBeenCalled();
    });
  });

  describe('updateAuditorAction — daty ważności certyfikatów (ERRATA A-2, CRM-AUDYT-KARTOTEKA)', () => {
    const EXISTING_WITH_DATES = {
      ...EXISTING_AUDITOR_RECORD,
      fgaz_valid_until: new Date('2026-01-01T00:00:00.000Z'),
      sep_valid_until: new Date('2026-01-01T00:00:00.000Z'),
    };

    // AC-E1/AC-E5 w trybie edycji: poprawna data -> Date w północ UTC.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('poprawne fgaz_valid_until i sep_valid_until w edycji zapisują się jako Date w północ UTC', async () => {
      auditorFindUniqueMock.mockResolvedValue(EXISTING_WITH_DATES);
      auditorUpdateMock.mockResolvedValue(EXISTING_WITH_DATES);

      await updateAuditorAction('aud-1', buildFullFormData({ fgaz_valid_until: '2027-06-15', sep_valid_until: '2028-01-01' }));

      const call = auditorUpdateMock.mock.calls.at(-1)?.[0];
      expect((call?.data?.fgaz_valid_until as Date)?.toISOString?.()).toBe('2027-06-15T00:00:00.000Z');
      expect((call?.data?.sep_valid_until as Date)?.toISOString?.()).toBe('2028-01-01T00:00:00.000Z');
    });

    // AC-E4: wyczyszczenie daty w edycji zapisuje NULL, nie Invalid Date.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('wyczyszczenie fgaz_valid_until i sep_valid_until w edycji zapisuje NULL, nie Invalid Date', async () => {
      auditorFindUniqueMock.mockResolvedValue(EXISTING_WITH_DATES);
      auditorUpdateMock.mockResolvedValue({ ...EXISTING_WITH_DATES, fgaz_valid_until: null, sep_valid_until: null });

      await updateAuditorAction('aud-1', buildFullFormData({ fgaz_valid_until: '', sep_valid_until: '' }));

      expect(auditorUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ fgaz_valid_until: null, sep_valid_until: null }) }),
      );
    });

    // Decyzja człowieka z erraty: data w przeszłości dozwolona także w edycji.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('data w przeszłości w edycji jest dozwolona — zapis kończy się sukcesem', async () => {
      auditorFindUniqueMock.mockResolvedValue(EXISTING_WITH_DATES);
      auditorUpdateMock.mockResolvedValue(EXISTING_WITH_DATES);

      const result = await updateAuditorAction('aud-1', buildFullFormData({ fgaz_valid_until: '2020-01-01' }));

      expect(result.success).toBe(true);
      const call = auditorUpdateMock.mock.calls.at(-1)?.[0];
      expect((call?.data?.fgaz_valid_until as Date)?.toISOString?.()).toBe('2020-01-01T00:00:00.000Z');
    });

    // Ochrona przed cichym zerowaniem — identyczny wzorzec dowodowy jak już
    // zastosowany dla preferowane_marki (formData.has()) w tym samym pliku.
    // Fizyczny brak klucza w FormData (nie pusty string) NIE może zerować istniejących dat.
    // @REQ: CRM-AUDYT-KARTOTEKA
    it('edycja bez pól fgaz_valid_until/sep_valid_until w FormData zostawia istniejące daty bez zmian (nie zeruje)', async () => {
      auditorFindUniqueMock.mockResolvedValue(EXISTING_WITH_DATES);
      auditorUpdateMock.mockResolvedValue(EXISTING_WITH_DATES);
      const fd = buildFullFormData();
      fd.delete('fgaz_valid_until');
      fd.delete('sep_valid_until');

      await updateAuditorAction('aud-1', fd);

      const call = auditorUpdateMock.mock.calls.at(-1)?.[0];
      if (Object.prototype.hasOwnProperty.call(call?.data ?? {}, 'fgaz_valid_until')) {
        expect(call.data.fgaz_valid_until).not.toBeNull();
        expect(call.data.fgaz_valid_until).toEqual(EXISTING_WITH_DATES.fgaz_valid_until);
      }
      if (Object.prototype.hasOwnProperty.call(call?.data ?? {}, 'sep_valid_until')) {
        expect(call.data.sep_valid_until).not.toBeNull();
        expect(call.data.sep_valid_until).toEqual(EXISTING_WITH_DATES.sep_valid_until);
      }
    });
  });
});
