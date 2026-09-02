import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * WO: docs/workorders/FLD-AVAILABILITY-SPLIT.md — FLD-AVAIL-SELF, kryteria dot. puli
 * przypisania (AC4) i fail-open (bullet z contracts/requirements.contract.mjs):
 *   "Pracownik niedostępny przy aktywnym koncie nie występuje w puli wyboru — filtr
 *   ROZSZERZA istniejące zapytania getAuditors() i getCrews(), zamiast tworzyć drugi,
 *   równoległy mechanizm (AC4)."
 *   "Brak wiersza deklaracji znaczy „dostępny" (fail-open), odwrotnie niż przy
 *   is_active, gdzie brak dostępu znaczy odmowa (fail-closed) — inaczej pracownik
 *   dodany po migracji nie trafiłby do puli."
 *   "Obie encje objęte symetrycznie, również zespoly_monterskie (R3)."
 *
 * W przeciwieństwie do availability-self-declaration.test.ts, ten plik NIE testuje
 * nowej Server Action — testuje ISTNIEJĄCE `getAuditors()` i `getCrews(installationDate)`
 * w `apps/b2b-web/src/app/(dashboard)/leads/actions.ts` (WO, "Kontekst kodu": to jest
 * "jedyne dziś działające miejsce, w którym dostępność wpływa na cokolwiek"). Obie
 * funkcje ISTNIEJĄ już dziś (patrz leads-auditor-pool.test.ts, crews-cert-availability.test.ts)
 * — RED tutaj MUSI więc wynikać z asercji, nie z brakującego eksportu.
 *
 * Kształt zapytania: `getAuditors()` dziś zwraca surowy wynik `prisma.audytorzy.findMany(...)`
 * bez żadnej transformacji w JS (przeczytane z produkcji — brak `.map()`/`.filter()`).
 * Zakładam, że przyszła implementacja rozszerzy zapytanie o
 * `include: { availability_declaration: true }` — to DOKŁADNA nazwa pola relacji ze
 * schema.prisma (linia ok. 433 dla audytorzy, ok. 213 dla zespoly_monterskie; NIE
 * `availabilityDeclaration` — to jest nazwa modelu/property Prisma Client dla tabeli
 * samej w sobie, `availability_declaration` to nazwa POLA RELACJI na audytorzy/
 * zespoly_monterskie, jawnie wypisana w schemacie, nie generowana). Mock dostarcza
 * dokładnie ten kształt — jeśli implementer wybierze inne podejście (osobne
 * zapytanie do prisma.availabilityDeclaration zamiast include), a wynik końcowy
 * (przefiltrowana lista) będzie ten sam, testy i tak przejdą, bo sprawdzają WYNIK
 * `getAuditors()`/`getCrews()`, nie kształt zapytania Prisma.
 *
 * Każdy test poniżej łączy pozytywną i negatywną asercję w JEDNYM `it()` — dzięki temu
 * całość realnie PADA dziś (dzisiejszy kod nie filtruje NICZEGO po availability, więc
 * pierwsza asercja "nie zawiera niedostępnego" jest tą, która czerwieni test), a nie
 * tylko deklaruje poprawne zachowanie, które i tak by przeszło.
 *
 * TEST-DEFECT (naprawiony), część o `getAuditors()`: bramka autoryzacyjna
 * `getCurrentActorRole()` + `can(actorRole,'auditors','read')` (patrz
 * leads-get-auditors-authz-gate.test.ts) wymaga mocka `../src/utils/supabase/server` — bez
 * niego realny `getCurrentActorRole()` rzuca poza kontekstem żądania, bramka fail-closed
 * zwraca `[]`, i asercje o filtrze dostępności padają z przyczyny niezwiązanej z tym, co ten
 * plik ma sprawdzać. Rola `admin` (uprawniona) w każdym przypadku — ten plik testuje WYŁĄCZNIE
 * filtr dostępności, nie samą bramkę. `getCrews()` nie ma dziś takiej bramki, więc ta część
 * pliku była i zostaje zielona bez zmian.
 */

const { auditorFindManyMock, crewFindManyMock, leadFindUniqueMock, revalidatePathMock, getCurrentActorRoleMock, getCurrentUserMock } = vi.hoisted(() => ({
  auditorFindManyMock: vi.fn(),
  crewFindManyMock: vi.fn(),
  leadFindUniqueMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    audytorzy: { findMany: auditorFindManyMock },
    zespoly_monterskie: { findMany: crewFindManyMock },
    leady: { findUnique: leadFindUniqueMock, update: vi.fn() },
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}));

// P0-1: domyślny brak sesji dla `getCurrentUser`, wzorem auditors-delete.test.ts.
getCurrentUserMock.mockResolvedValue({ data: { user: null } });
getCurrentActorRoleMock.mockResolvedValue('admin');

const { getAuditors, getCrews } = await import('../src/app/(dashboard)/leads/actions');

const INSTALLATION_DATE = new Date('2026-09-15T00:00:00.000Z');

const crewWithCerts = (overrides: Record<string, unknown> = {}) => ({
  id: 'crew-1',
  nazwa: 'Ekipa Testowa',
  aktywny: true,
  fgaz_valid_until: new Date('2027-01-01'),
  sep_valid_until: new Date('2027-01-01'),
  availability_declaration: null,
  ...overrides,
});

describe('getAuditors() — filtr dostępności (FLD-AVAIL-SELF, AC4 + fail-open)', () => {
  beforeEach(() => {
    auditorFindManyMock.mockReset();
  });

  // @REQ: FLD-AVAIL-SELF
  it('AC4/fail-open — wyklucza is_available:false, zachowuje is_available:true i brak wiersza deklaracji', async () => {
    auditorFindManyMock.mockResolvedValue([
      { id: 'aud-unavailable', imie_i_nazwisko: 'Ewa Niedostępna', is_active: true, availability_declaration: { isAvailable: false } },
      { id: 'aud-available', imie_i_nazwisko: 'Jan Dostępny', is_active: true, availability_declaration: { isAvailable: true } },
      { id: 'aud-no-row', imie_i_nazwisko: 'Nowy Audytor (brak deklaracji)', is_active: true, availability_declaration: null },
    ]);

    const ids = (await getAuditors()).map((a: { id: string }) => a.id);

    // Ta linia pada dziś: filtr jeszcze nie istnieje, dzisiejszy kod zwraca WSZYSTKICH
    // trzech, więc `not.toContain` jest fałszywe.
    expect(ids).not.toContain('aud-unavailable');
    expect(ids).toContain('aud-available');
    // Fail-open (AC7): brak wiersza deklaracji = dostępny, inaczej pracownik dodany po
    // migracji nigdy nie trafiłby do puli.
    expect(ids).toContain('aud-no-row');
  });

  // Przypadek pusty specyficzny dla TEGO wymagania (nie duplikat CRM-AUDYT-AC1 z
  // leads-auditor-pool.test.ts, tam pusta pula wynika z braku aktywnych kont — tutaj z
  // tego, że WSZYSCY aktywni są jawnie niedostępni).
  // @REQ: FLD-AVAIL-SELF
  it('przypadek pusty — wszyscy aktywni audytorzy zadeklarowali się jako niedostępni, pula jest pusta', async () => {
    auditorFindManyMock.mockResolvedValue([
      { id: 'aud-1', imie_i_nazwisko: 'A', is_active: true, availability_declaration: { isAvailable: false } },
      { id: 'aud-2', imie_i_nazwisko: 'B', is_active: true, availability_declaration: { isAvailable: false } },
    ]);

    const auditors = await getAuditors();

    expect(auditors).toEqual([]);
  });
});

describe('getCrews(installationDate) — filtr dostępności ekipy, symetrycznie do audytorów (R3, FLD-AVAIL-SELF)', () => {
  beforeEach(() => {
    crewFindManyMock.mockReset();
  });

  // R3 z WO: dziś żadna bramka autoryzacyjna nie czyta zespoly_monterskie.aktywny w
  // celach dostępności — ten test musi objąć ekipy, nie tylko audytorów, inaczej
  // rozdzielenie działa dla połowy ról terenowych.
  // @REQ: FLD-AVAIL-SELF
  it('AC4/fail-open — zespół z is_available:false znika mimo aktywny:true i ważnych certyfikatów; brak wiersza = dostępny', async () => {
    crewFindManyMock.mockResolvedValue([
      crewWithCerts({ id: 'crew-unavailable', availability_declaration: { isAvailable: false } }),
      crewWithCerts({ id: 'crew-available', availability_declaration: { isAvailable: true } }),
      crewWithCerts({ id: 'crew-no-row', availability_declaration: null }),
    ]);

    const ids = (await getCrews(INSTALLATION_DATE)).map((c: { id: string }) => c.id);

    expect(ids).not.toContain('crew-unavailable');
    expect(ids).toContain('crew-available');
    expect(ids).toContain('crew-no-row');
  });

  // @REQ: FLD-AVAIL-SELF
  it('przypadek pusty — wszystkie ekipy z ważnymi certyfikatami zadeklarowały się jako niedostępne, pula jest pusta', async () => {
    crewFindManyMock.mockResolvedValue([
      crewWithCerts({ id: 'crew-1', availability_declaration: { isAvailable: false } }),
      crewWithCerts({ id: 'crew-2', availability_declaration: { isAvailable: false } }),
    ]);

    const crews = await getCrews(INSTALLATION_DATE);

    expect(crews).toEqual([]);
  });
});
