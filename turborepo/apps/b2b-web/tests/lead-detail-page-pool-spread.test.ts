import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';

/**
 * Wymaganie: SEC-ASSIGNMENT-POOL-MINIMIZE (contracts/requirements.contract.mjs, status TODO).
 * Warstwa 2 z dwóch opisanych w kontrakcie: granica serwer/klient POZA samą Server Action.
 *
 * `leads/[id]/page.tsx` pobiera `getAuditors()`, czyta `a.zdjecie_url` SERWEROWO, żeby
 * zbudować podpisany `avatarUrl` przez `signStoragePaths`, po czym buduje props zapisem
 * `{...auditor, avatarUrl}` (spread) — spread kopiuje WSZYSTKO, więc nawet gdyby
 * `getAuditors()` było już zawężone do {id, imie_i_nazwisko, zdjecie_url} (patrz
 * leads-pool-minimize.test.ts, plik OSOBNY testujący WYŁĄCZNIE warstwę 1 — zapytanie),
 * `zdjecie_url` i tak przecieknie do <AssignAuditor> obok `avatarUrl`, bo spread nie wie,
 * które pole miało zostać "wyłącznie wewnętrzne". Ten plik dowodzi WARSTWY 2 niezależnie od
 * warstwy 1: fixture podawana do zamockowanego `getAuditors()` jest CELOWO już węższa niż
 * dzisiejszy pełny rekord Prismy (zawiera dodatkowo `iban`/`is_active`/
 * `availability_declaration` tylko po to, żeby dowieść, że page.tsx samo w sobie explicite
 * wylicza propsy, a nie polega wyłącznie na tym, że coś wcześniej w łańcuchu je odfiltrowało).
 *
 * Kryterium z kontraktu (dosłownie): "Test asercjonuje kształt obiektu przekazywanego do
 * komponentu klienckiego, nie tylko wynik Server Action — inaczej sprawdza połowę drogi."
 *
 * ═══════════════ Kształt testu — wzorem settings-page-authz.test.ts (ta sama sesja) ═══════════
 *
 * `LeadDetailsPage` to async funkcja (Server Component), nie komponent renderowany przez
 * ReactDOM/testing-library — wywołujemy ją bezpośrednio i dostajemy z powrotem DRZEWO
 * elementów React (`React.createElement(...)` zagnieżdżone, nigdy nie "wyrenderowane").
 * W przeciwieństwie do settings/page.tsx (gdzie `<SettingsClient users={...}/>` jest
 * BEZPOŚREDNIM zwróconym elementem), `<AssignAuditor .../>` jest zagnieżdżone kilka
 * poziomów w głąb drzewa JSX (nagłówek, sekcje danych kontaktowych, sidebar) — stąd
 * `findElementByType()`: rekurencyjne przejście po `.props.children`, szukające elementu
 * którego `.type` to zamockowany komponent `AssignAuditor`. React.createElement NIE wywołuje
 * funkcji komponentu, więc `AssignAuditorMock` (vi.fn()) nigdy nie zostaje "wywołany" w
 * sensie `toHaveBeenCalled()` — dowodem jest wyłącznie `.props` znalezionego elementu.
 *
 * Mockowane zależności:
 *  - `@repo/database` (`prisma.leady.findUnique` — brak żywej instancji testowej, jak w
 *    availability-restore.test.ts)
 *  - `../src/app/(dashboard)/leads/actions` (`getAuditors` — mockowane w CAŁOŚCI, żeby ten
 *    plik testował WYŁĄCZNIE warstwę 2 i pozostał zielony niezależnie od stanu warstwy 1)
 *  - `@/lib/storage/signed-urls` (`signStoragePaths` — sprawdzone empirycznie: Vitest
 *    przechwytuje `vi.mock()` dla bare specifiera `@/...` PRZED próbą jego rozwiązania,
 *    mimo że `vitest.config.mts` w korzeniu repo NIE definiuje aliasu `@/*` z
 *    `tsconfig.json` — bez tego mocka import padłby błędem "Cannot find package", czyli
 *    złym RED z niewłaściwego powodu, patrz CLAUDE.md tego agenta)
 *  - `@/components/ui/button`, `@/components/ui/status-pill`, `@/lib/format-date`,
 *    `@/lib/empty-value` (z tego samego powodu co wyżej — same w sobie nierenderowane/
 *    nieasercjonowane w tym teście, ale muszą się dać rozwiązać jako moduł; audyt spójności
 *    wizualnej zastąpił `@/components/ui/badge` przez `StatusPill` i dopisał `formatDate`/
 *    `EMPTY_VALUE` w page.tsx)
 *  - `./assign-auditor` (`AssignAuditor` — zamockowany JAKO CAŁY MODUŁ, żeby przechwycić
 *    `.type` w drzewie elementów; jego wewnętrzne rzutowanie typu na propsie `avatarUrl`
 *    nigdy się nie wykonuje, bo mock nie jest renderowany)
 *  - `./edit-lead-modal`, `./delete-lead-button` (poza zakresem tego wymagania, muszą się
 *    dać rozwiązać jako moduł — zawierają własne `@/components/ui/*` nierozwiązywalne bez
 *    aliasu, stąd zastąpienie CAŁEGO modułu, nie tylko jego zależności)
 *  - `../src/utils/supabase/server` (`getCurrentActorRole`, `createClient` — `getLeadDetail`,
 *    świeżo wydzielone do `leads/[id]/actions.ts` przy zamykaniu SEC-RLS-AUDITOR-SCOPE,
 *    NIE jest tu mockowane w całości: page.tsx woła prawdziwą implementację `getLeadDetail`
 *    na zamockowanym `prisma.leady.findUnique`. `getCurrentActorRole()` samo w sobie ZAWSZE
 *    woła `createClient()` z tego modułu — bez mocka rzuciłoby poza kontekstem żądania
 *    Next.js, zanim jeszcze dojdzie do logiki, którą ten plik testuje (kształt propsów
 *    <AssignAuditor>). Rola ustawiona na `'admin'` — `leads.read = ['admin', 'dyspozytor',
 *    'audytor:own']`, więc `admin` to `access === 'yes'` bez gałęzi `'own'`, która
 *    dodatkowo wołałaby `createClient()`/`auth.getUser()`/`prisma.audytorzy.findUnique`
 *    wewnątrz `getLeadDetail` — dla `admin` te trzy pozostają nieużyte, patrz
 *    `leads-detail-scope.test.ts` dla pełnego pokrycia wariantu `'own'`/odmów. Ten plik
 *    sprawdza WYŁĄCZNIE zawężenie pól audytora w propsach, nie autoryzację samą w sobie.)
 *
 * Świadomie POZA zakresem tego pliku:
 *  - `getAuditors()` samo w sobie — osobny plik, osobna granica
 *  - `EditLeadModal`/`DeleteLeadButton` — nie dotyczą puli audytorów
 *  - trasa `notFound()` dla nieistniejącego leada — niezwiązana z tym wymaganiem, `lead`
 *    zawsze istnieje w fixture'ach poniżej
 */

const {
  leadFindUniqueMock,
  getAuditorsMock,
  signStoragePathsMock,
  AssignAuditorMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
  createClientMock,
} = vi.hoisted(() => ({
  leadFindUniqueMock: vi.fn(),
  getAuditorsMock: vi.fn(),
  signStoragePathsMock: vi.fn(),
  AssignAuditorMock: vi.fn(() => null),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: { leady: { findUnique: leadFindUniqueMock } },
}));
vi.mock('../src/app/(dashboard)/leads/actions', () => ({
  getAuditors: getAuditorsMock,
}));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
  createClient: createClientMock,
}));
// P0-1 (przygotowanie pod przyszłą turę): domyślny brak sesji — ten plik nie testuje ścieżek zależnych od tożsamości poprzez createClient(), więc `getCurrentUser` dostaje bezpieczny, jawny fallback zamiast pozostać niezdefiniowanym mockiem.
getCurrentUserMock.mockResolvedValue({ data: { user: null } });
vi.mock('@/lib/storage/signed-urls', () => ({
  signStoragePaths: signStoragePathsMock,
}));
vi.mock('@/components/ui/button', () => ({ Button: () => null }));
vi.mock('@/components/ui/status-pill', () => ({ StatusPill: () => null }));
vi.mock('@/lib/format-date', () => ({ formatDate: vi.fn(() => 'formatted-date') }));
vi.mock('@/lib/empty-value', () => ({ EMPTY_VALUE: '—' }));
vi.mock('../src/app/(dashboard)/leads/[id]/assign-auditor', () => ({
  AssignAuditor: AssignAuditorMock,
}));
vi.mock('../src/app/(dashboard)/leads/[id]/edit-lead-modal', () => ({
  EditLeadModal: () => null,
}));
vi.mock('../src/app/(dashboard)/leads/[id]/delete-lead-button', () => ({
  DeleteLeadButton: () => null,
}));
// `leads-client.tsx` importuje TAKŻE `@/lib/format-id` (obok `@/lib/format-date`,
// `@/lib/empty-value`) — nierozwiązywalne bez aliasu `@/*` w vitest.config.mts. page.tsx
// potrzebuje z tego modułu wyłącznie `LEAD_STATUS_TONE` (mapa tonów dla <StatusPill>,
// samego w sobie zamockowanego na `() => null` — wartość tonu nigdy nie jest asercjonowana
// w tym pliku), więc cały moduł jest zastąpiony zamiast domockowywać jego zależności.
vi.mock('../src/app/(dashboard)/leads/leads-client', () => ({
  LEAD_STATUS_TONE: {},
}));

const LeadDetailsPage = (await import('../src/app/(dashboard)/leads/[id]/page')).default;

/** Ten sam zbiór co w leads-pool-minimize.test.ts — patrz tam uzasadnienie derywacji z NAMING.md. */
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

const ALLOWED_ASSIGN_AUDITOR_PROP_KEYS = new Set(['id', 'imie_i_nazwisko', 'avatarUrl']);

const LEAD_FIXTURE = {
  id: 'lead-1',
  created_at: new Date('2026-08-20T10:00:00Z'),
  klient: null,
  adres: null,
  status: 'NEW_LEAD',
  data_rezerwacji: null,
  odpowiedzi_triage: null,
  estymowana_wycena: null,
  audytor_id: null,
};

function callPage(id = 'lead-1') {
  return LeadDetailsPage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve({}),
  });
}

/**
 * `<AssignAuditor .../>` w JSX to `React.createElement(AssignAuditorMock, props)` — nigdy
 * WYWOŁANY (to nie jest render), więc jedynym dowodem jest znalezienie tego elementu w
 * drzewie i odczytanie `.props` wprost z niego. Przeszukanie rekurencyjne, bo element jest
 * zagnieżdżony w sidebarze, nie jest bezpośrednim zwróconym elementem (inaczej niż
 * `<SettingsClient/>` w settings-page-authz.test.ts).
 */
function findElementByType(node: unknown, type: unknown): { props: Record<string, unknown> } | null {
  if (!node || typeof node !== 'object') return null;
  if (React.isValidElement(node)) {
    const element = node as { type: unknown; props?: { children?: unknown } };
    if (element.type === type) {
      return node as { props: Record<string, unknown> };
    }
    return findElementByType(element.props?.children, type);
  }
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findElementByType(child, type);
      if (found) return found;
    }
  }
  return null;
}

async function assignAuditorProps(id = 'lead-1'): Promise<{ auditors: Array<Record<string, unknown>> }> {
  const result = await callPage(id);
  const element = findElementByType(result, AssignAuditorMock);
  if (!element) {
    throw new Error('<AssignAuditor> nie znaleziony w drzewie zwróconym przez LeadDetailsPage — test nie może dowieść kształtu propsów.');
  }
  return element.props as { auditors: Array<Record<string, unknown>> };
}

describe('leads/[id]/page.tsx — propsy <AssignAuditor auditors={...}> (SEC-ASSIGNMENT-POOL-MINIMIZE, warstwa 2)', () => {
  beforeEach(() => {
    leadFindUniqueMock.mockReset();
    getAuditorsMock.mockReset();
    signStoragePathsMock.mockReset();
    AssignAuditorMock.mockClear();
    getCurrentActorRoleMock.mockReset();
    createClientMock.mockReset();
    leadFindUniqueMock.mockResolvedValue(LEAD_FIXTURE);
    // Rola z pełnym dostępem (leads.read === 'yes', bez gałęzi 'own') — te testy
    // dowodzą zawężenia pól audytora w propsach <AssignAuditor>, nie autoryzacji
    // getLeadDetail() samej w sobie (patrz leads-detail-scope.test.ts).
    getCurrentActorRoleMock.mockResolvedValue('admin');
  });

  // Kryterium #5 z kontraktu: pole potrzebne WYŁĄCZNIE serwerowo (`zdjecie_url`) nie
  // przecieka przez spread `{...auditor, avatarUrl}`. Fixture zawiera dokładnie to, czego
  // `getAuditors()` potrzebuje wewnętrznie (id, imie_i_nazwisko, zdjecie_url) — dzisiejszy
  // kod i tak przekaże `zdjecie_url` DALEJ obok `avatarUrl`, bo spread kopiuje wszystko, co
  // dostał, niezależnie od tego, jak wąski był wejściowy kształt.
  // @REQ: SEC-ASSIGNMENT-POOL-MINIMIZE
  it('propsy przekazane do <AssignAuditor> mają DOKŁADNIE zbiór kluczy {id, imie_i_nazwisko, avatarUrl} na element — bez zdjecie_url', async () => {
    getAuditorsMock.mockResolvedValue([
      { id: 'aud-1', imie_i_nazwisko: 'Jan Kowalski', zdjecie_url: 'audytorzy/aud-1.png' },
    ]);
    signStoragePathsMock.mockResolvedValue({ 'audytorzy/aud-1.png': 'https://signed.example/aud-1.png' });

    const { auditors } = await assignAuditorProps();

    expect(auditors).toHaveLength(1);
    expect(new Set(Object.keys(auditors[0]))).toEqual(ALLOWED_ASSIGN_AUDITOR_PROP_KEYS);
  });

  // Obrona w głąb: NIEZALEŻNIE od tego, czy warstwa 1 (getAuditors()) jest już naprawiona,
  // page.tsx samo w sobie musi explicite wyliczać propsy. Fixture tu jest CELOWO szersza niż
  // docelowy kontrakt getAuditors() (zawiera iban/is_active/availability_declaration) — gdyby
  // implementacja page.tsx nadal robiła `{...auditor, avatarUrl}`, te pola przeciekną razem
  // ze zdjecie_url. Ten test pada dziś z tego samego powodu co poprzedni (spread), niezależnie
  // od tego, co zwróci mock getAuditors().
  // @REQ: SEC-ASSIGNMENT-POOL-MINIMIZE
  it('żadne pole spoza {id, imie_i_nazwisko, avatarUrl} nie przecieka do propsów, nawet gdy getAuditors() zwróci więcej niż kontrakt zakłada', async () => {
    getAuditorsMock.mockResolvedValue([
      {
        id: 'aud-1',
        imie_i_nazwisko: 'Jan Kowalski',
        zdjecie_url: 'audytorzy/aud-1.png',
        iban: 'PL61109010140000071219812874',
        is_active: true,
        availability_declaration: null,
      },
    ]);
    signStoragePathsMock.mockResolvedValue({ 'audytorzy/aud-1.png': 'https://signed.example/aud-1.png' });

    const { auditors } = await assignAuditorProps();
    const [auditorProp] = auditors;

    const disallowedKeys = Object.keys(auditorProp).filter((key) => !ALLOWED_ASSIGN_AUDITOR_PROP_KEYS.has(key));
    expect(disallowedKeys).toEqual([]);
    const leakedSensitive = Object.keys(auditorProp).filter((key) => SENSITIVE_FIELD_NAMES.has(key));
    expect(leakedSensitive).toEqual([]);
  });

  // Kontrola pozytywna: po naprawie audytor nadal jest wybieralny po nazwie, a avatarUrl to
  // rzeczywiście podpisany URL zwrócony przez signStoragePaths — bez tego testu funkcja
  // zwracająca pustą tablicę albo {id} bez nazwy/avatara przeszłaby wszystkie testy kształtu
  // powyżej.
  // @REQ: SEC-ASSIGNMENT-POOL-MINIMIZE
  it('kontrola pozytywna — avatarUrl to podpisany URL ze signStoragePaths, id i imie_i_nazwisko zachowane', async () => {
    getAuditorsMock.mockResolvedValue([
      { id: 'aud-1', imie_i_nazwisko: 'Jan Kowalski', zdjecie_url: 'audytorzy/aud-1.png' },
    ]);
    signStoragePathsMock.mockResolvedValue({ 'audytorzy/aud-1.png': 'https://signed.example/aud-1.png' });

    const { auditors } = await assignAuditorProps();

    expect(auditors).toEqual([
      { id: 'aud-1', imie_i_nazwisko: 'Jan Kowalski', avatarUrl: 'https://signed.example/aud-1.png' },
    ]);
    expect(signStoragePathsMock).toHaveBeenCalledWith('audytorzy', ['audytorzy/aud-1.png'], 60 * 60);
  });

  // Audytor bez zdjęcia: avatarUrl musi być jawnym `null`, nie `undefined` (a już na pewno
  // nie `zdjecie_url: null` przeciekającym pod własną nazwą) — dzisiejszy kod robi dokładnie
  // to (`auditor.zdjecie_url ? ... : null`), ale test i tak pada na kluczach obok (spread).
  // @REQ: SEC-ASSIGNMENT-POOL-MINIMIZE
  it('audytor bez zdjęcia — avatarUrl to null, zdjecie_url nie występuje pod żadną postacią', async () => {
    getAuditorsMock.mockResolvedValue([
      { id: 'aud-2', imie_i_nazwisko: 'Ewa Nowak', zdjecie_url: null },
    ]);
    signStoragePathsMock.mockResolvedValue({});

    const { auditors } = await assignAuditorProps();

    expect(auditors).toEqual([{ id: 'aud-2', imie_i_nazwisko: 'Ewa Nowak', avatarUrl: null }]);
  });

  // Przypadek pusty — pula bez audytorów nie powinna wywalić budowy propsów ani wywołania
  // signStoragePaths (które samo w sobie jest bezpieczne na pustej liście, ale asercja
  // dokumentuje oczekiwane zachowanie na granicy, nie tylko brak wyjątku).
  // @REQ: SEC-ASSIGNMENT-POOL-MINIMIZE
  it('przypadek pusty — brak audytorów w puli, propsy to pusta tablica', async () => {
    getAuditorsMock.mockResolvedValue([]);
    signStoragePathsMock.mockResolvedValue({});

    const { auditors } = await assignAuditorProps();

    expect(auditors).toEqual([]);
    expect(signStoragePathsMock).toHaveBeenCalledWith('audytorzy', [], expect.any(Number));
  });

  // Przypadek maksymalny (dopisany z własnej inicjatywy, CLAUDE.md tej roli): wielu
  // audytorów naraz — zawężenie musi objąć KAŻDY element puli, nie tylko pierwszy (typowy
  // błąd naprawy testowanej tylko na tablicy jednoelementowej).
  // @REQ: SEC-ASSIGNMENT-POOL-MINIMIZE
  it('przypadek maksymalny — zawężenie kluczy obowiązuje dla każdego z wielu audytorów naraz', async () => {
    getAuditorsMock.mockResolvedValue([
      { id: 'aud-1', imie_i_nazwisko: 'Jan Kowalski', zdjecie_url: 'audytorzy/aud-1.png' },
      { id: 'aud-2', imie_i_nazwisko: 'Ewa Nowak', zdjecie_url: null },
      { id: 'aud-3', imie_i_nazwisko: 'Piotr Zieliński', zdjecie_url: 'audytorzy/aud-3.png' },
    ]);
    signStoragePathsMock.mockResolvedValue({
      'audytorzy/aud-1.png': 'https://signed.example/aud-1.png',
      'audytorzy/aud-3.png': 'https://signed.example/aud-3.png',
    });

    const { auditors } = await assignAuditorProps();

    expect(auditors).toHaveLength(3);
    for (const auditorProp of auditors) {
      expect(new Set(Object.keys(auditorProp))).toEqual(ALLOWED_ASSIGN_AUDITOR_PROP_KEYS);
    }
  });
});
