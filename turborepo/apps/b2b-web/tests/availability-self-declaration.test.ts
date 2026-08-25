import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '@repo/database';

/**
 * WO: docs/workorders/FLD-AVAILABILITY-SPLIT.md — FLD-AVAIL-SELF.
 * Wymaganie (contracts/requirements.contract.mjs, R('FLD-AVAIL-SELF', ...)):
 *   "Pracownik terenowy sam deklaruje własną niedostępność, a deklaracja jest rozłączna
 *   z blokadą administracyjną (is_active) i ze statusem kadrowym (leave_status), których
 *   właścicielem pozostaje administrator."
 *
 * Warstwa kontrakt+schemat już wylądowała na main (commit 7d256f7): tabela
 * `availability_declarations` (model Prisma `AvailabilityDeclaration`), kolumna
 * `leave_status` na `audytorzy`/`zespoly_monterskie`, zasób RBAC
 * `availability_declarations` z `update` w wariancie `:own` dla `audytor`/`monter`
 * (contracts/rbac.contract.mjs), podczas gdy `auditors.update` i `crews.update`
 * ZOSTAJĄ ['admin'] — to jest sedno D-A i R2. Ten plik NIE testuje kontraktu (już
 * DONE, już zielony) — testuje Server Action, która go realnie egzekwuje. Ta akcja
 * DZIŚ NIE ISTNIEJE W OGÓLE w bazie kodu (sprawdzone: `grep -rn "setSelfAvailability"
 * apps/b2b-web/src` = brak wyników).
 *
 * KONTRAKT MIĘDZY TYM TESTEM A IMPLEMENTEREM (nazwa i lokalizacja wybrane przeze mnie,
 * test-author, zgodnie z poleceniem WO — jeśli implementer wybierze inną nazwę/plik,
 * to TEST-DEFECT do zgłoszenia w tej turze, nie powód do zmiany testu; wzorzec tej
 * klauzuli: crews-cert-availability.test.ts, komentarz przy assignCrewToLead):
 *
 *   `setSelfAvailabilityAction(auditorId: string, isAvailable: boolean):
 *      Promise<{ success: boolean; error?: string; isAvailable?: boolean }>`
 *   w `apps/b2b-web/src/app/(dashboard)/auditors/actions.ts` — plik JUŻ ISTNIEJE
 *   (zawiera getAuditors/toggleAuditorActiveAction/deleteAuditorAction, ten sam wzorzec
 *   `can(actorRole, resource, capability)` + `getCurrentActorRole()`), więc dopisanie
 *   nowego eksportu do istniejącego pliku jest bezpieczniejszym RED-em niż wskazywanie
 *   na plik, który nikt jeszcze nie utworzył — brak eksportu w istniejącym module daje
 *   `undefined is not a function`, nie błąd rozwiązania modułu.
 *
 *   `setSelfAvailabilityAction(crewId: string, isAvailable: boolean):
 *      Promise<{ success: boolean; error?: string; isAvailable?: boolean }>`
 *   symetrycznie w `apps/b2b-web/src/app/(dashboard)/crews/actions.ts` (R3 z WO: ekipy
 *   też muszą dostać tę ścieżkę, mimo że dziś ten plik nie ma ŻADNEGO sprawdzenia roli).
 *
 * Identyfikacja "czyj to rekord" (WO, sekcja "Kontekst kodu"): jedyny dziś istniejący
 * w repo mechanizm to dopasowanie po e-mailu z sesji, wzorem middleware.ts — zakładam
 * więc, że akcja woła `createClient()` (już wyeksportowany z
 * `../../../utils/supabase/server`, ten sam plik co `getCurrentActorRole()`) i
 * `supabase.auth.getUser()`, po czym szuka WŁASNEGO rekordu po e-mailu
 * (`prisma.audytorzy.findUnique({ where: { email } })` /
 * `prisma.zespoly_monterskie.findUnique({ where: { email } })`) — i to znalezione `id`,
 * NIE argument wywołania, musi trafić do zapisu. Test "cudzy rekord" poniżej wprost
 * sprawdza, że argument `auditorId`/`crewId` przekazany z zewnątrz nie jest ślepo
 * zaufany (dokładnie luka, przed którą ostrzega CLAUDE.md — Prisma omija RLS, "sprawdź
 * to w RLS, nie tylko tutaj" z komentarza generatora przy wariancie :own).
 *
 * `can(actorRole, 'availability_declarations', 'update')` NIE jest tu mockowane — leci
 * na prawdziwej, już zmergowanej macierzy z `@klikklima/contracts` (alias w
 * vitest.config.mts wskazuje na packages/contracts/src/generated/index.ts).
 *
 * Zakres warstw: ten plik sprawdza WYŁĄCZNIE warstwę Server Action (Prisma omija RLS —
 * CLAUDE.md, pułapka 1). Warstwa UI jest poza zakresem WO (Field App nie istnieje).
 * Warstwa RLS (czy polityka bazy niezależnie odrzuca ten sam zapis) wymaga
 * `rls-security-auditor` i/lub testu integracyjnego na żywej instancji — nie da się jej
 * sprawdzić mockiem Prisma, bo Prisma i tak omija RLS z definicji.
 *
 * Współbieżność (podwójny zapis / wyścig z blokadą administracyjną): pełne pokrycie
 * wymaga prawdziwej bazy (constraint @@unique na auditorId/crewId, transakcje
 * równoległe) — testy poniżej sprawdzają wyłącznie WŁASNOŚĆ STRUKTURALNĄ kodu
 * (osobne tabele, osobne zapisy), nie realną izolację transakcyjną; oznaczone wprost.
 */

const {
  auditorFindUniqueMock,
  auditorUpdateMock,
  crewFindUniqueMock,
  crewUpdateMock,
  availabilityUpsertMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getUserMock,
  createClientMock,
} = vi.hoisted(() => ({
  auditorFindUniqueMock: vi.fn(),
  auditorUpdateMock: vi.fn(),
  crewFindUniqueMock: vi.fn(),
  crewUpdateMock: vi.fn(),
  availabilityUpsertMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    audytorzy: {
      findUnique: auditorFindUniqueMock,
      update: auditorUpdateMock,
    },
    zespoly_monterskie: {
      findUnique: crewFindUniqueMock,
      update: crewUpdateMock,
    },
    availabilityDeclaration: {
      upsert: availabilityUpsertMock,
    },
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  createClient: createClientMock,
}));

const { setSelfAvailabilityAction: setAuditorAvailability } = await import(
  '../src/app/(dashboard)/auditors/actions'
);
const { setSelfAvailabilityAction: setCrewAvailability } = await import(
  '../src/app/(dashboard)/crews/actions'
);

const AUDITOR_EMAIL = 'audytor.jan@klikklima.pl';
const CREW_EMAIL = 'ekipa.warszawa@klikklima.pl';

beforeEach(() => {
  auditorFindUniqueMock.mockReset();
  auditorUpdateMock.mockReset();
  crewFindUniqueMock.mockReset();
  crewUpdateMock.mockReset();
  availabilityUpsertMock.mockReset();
  revalidatePathMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  getUserMock.mockReset();
  createClientMock.mockReset();
  createClientMock.mockResolvedValue({ auth: { getUser: getUserMock } });
});

describe('setSelfAvailabilityAction (auditors/actions.ts) — audytor deklaruje własną dostępność (FLD-AVAIL-SELF)', () => {
  // @REQ: FLD-AVAIL-SELF
  it('AC1 — ustawienie się jako niedostępny nie zmienia audytorzy.is_active (odczyt przed i po)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    const row = { id: 'aud-1', email: AUDITOR_EMAIL, is_active: true, leave_status: 'ACTIVE' };
    auditorFindUniqueMock.mockResolvedValue(row);
    availabilityUpsertMock.mockResolvedValue({ isAvailable: false });

    const before = await prisma.audytorzy.findUnique({ where: { id: 'aud-1' } });
    await setAuditorAvailability('aud-1', false);
    const after = await prisma.audytorzy.findUnique({ where: { id: 'aud-1' } });

    expect(before?.is_active).toBe(true);
    expect(after?.is_active).toBe(before?.is_active);
    // Dowód mocniejszy niż sam odczyt: akcja NIE MA prawa w ogóle wywołać update na
    // audytorzy (auditors.update = ['admin'], D-A) — jeśli kiedyś dotknie tej kolumny,
    // ten mock i tak nie ujawni zmiany (jest statyczny), więc to jest właściwy dowód.
    expect(auditorUpdateMock).not.toHaveBeenCalled();
  });

  // @REQ: FLD-AVAIL-SELF
  it('AC3 — akcja nigdy nie wywołuje prisma.audytorzy.update (auditors.update pozostaje wyłącznie admin)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', email: AUDITOR_EMAIL, is_active: true, leave_status: 'ACTIVE' });
    availabilityUpsertMock.mockResolvedValue({ isAvailable: false });

    const result = await setAuditorAvailability('aud-1', false);

    expect(result.success).toBe(true);
    expect(auditorUpdateMock).not.toHaveBeenCalled();
    // BLOCKER 1 (REVIEW #1, iteracja 2/3): `objectContaining` na zewnętrznym obiekcie
    // nie ogranicza w ogóle `create`/`update` — implementacja, która zapisuje
    // `isAvailable: true` na sztywno albo odwraca wartość, przechodziłaby ten test.
    // Pełne dopasowanie payloadu (kształt zweryfikowany czytaniem
    // auditors/actions.ts:122-126) łapie oba te błędy.
    expect(availabilityUpsertMock).toHaveBeenCalledWith({
      where: { auditorId: 'aud-1' },
      create: { auditorId: 'aud-1', isAvailable: false },
      update: { isAvailable: false },
    });
  });

  // Luka opisana w prompcie zlecającym: `can()` przy wariancie :own NIE sprawdza
  // właścicielstwa rekordu — to musi zrobić sama akcja, porównując ID z sesji, nie
  // z argumentu wywołania. Bez tego sprawdzenia audytor A mógłby jawnie podać ID
  // audytora B i zgasić/zapalić JEGO dostępność.
  // @REQ: FLD-AVAIL-SELF
  it('próba zadeklarowania dostępności dla CUDZEGO rekordu audytora jest odrzucona', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    // Sesja rozwiązuje się do WŁASNEGO rekordu 'aud-own' po e-mailu — ale wywołujący
    // przekazuje wprost cudze id 'aud-other-guy'.
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-own', email: AUDITOR_EMAIL, is_active: true, leave_status: 'ACTIVE' });

    const result = await setAuditorAvailability('aud-other-guy', false);

    expect(result.success).toBe(false);
    expect(availabilityUpsertMock).not.toHaveBeenCalled();
  });

  // BLOCKER 2 (REVIEW #2, iteracja 3/3): bez skonfigurowania `auditorFindUniqueMock`
  // ten test padał na "brak rekordu" (mock zwraca `undefined` po `mockReset()`), nie
  // na bramce roli, którą deklaruje nazwa i @REQ — pod mutacją cofającą
  // `actorRole !== 'audytor'` z powrotem do `can(...) !== 'no'` test i tak by przeszedł
  // (fałszywy zielony). Skonfigurowanie rekordu, który PRZESZEDŁBY dalej gdyby bramka
  // roli nie zadziałała, plus asercja `not.toHaveBeenCalled()` na tym mocku, dowodzi że
  // odmowa nastąpiła PRZED sięgnięciem do bazy — czyli na bramce roli.
  // @REQ: FLD-AVAIL-SELF
  it('rola dyspozytor (brak wariantu :own na availability_declarations) jest odrzucona po stronie serwera', async () => {
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', email: AUDITOR_EMAIL, is_active: true, leave_status: 'ACTIVE' });

    const result = await setAuditorAvailability('aud-1', false);

    expect(result.success).toBe(false);
    expect(auditorFindUniqueMock).not.toHaveBeenCalled();
    expect(availabilityUpsertMock).not.toHaveBeenCalled();
  });

  // BLOCKER 4 (REVIEW #2, iteracja 3/3): poprawka `implementer-server` z iteracji 2
  // jest dwustronna (`actorRole !== 'audytor'` w auditors/actions.ts,
  // `actorRole !== 'monter'` w crews/actions.ts), ale do tej pory test istniał tylko
  // dla jednej strony (audytor wołający setSelfAvailabilityAction ekipy — patrz "rola
  // audytor (obcy zasób — to nie jej własna ekipa)" w opisywanym niżej bloku crews).
  // Ten test jest lustrzany: monter (rola prawidłowa dla RBAC :own, ale dla INNEJ
  // encji) wołający wariant audytora.
  // @REQ: FLD-AVAIL-SELF
  it('rola monter (obcy zasób — to nie jej własny audytor) jest odrzucona po stronie serwera', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', email: AUDITOR_EMAIL, is_active: true, leave_status: 'ACTIVE' });

    const result = await setAuditorAvailability('aud-1', false);

    expect(result.success).toBe(false);
    expect(auditorFindUniqueMock).not.toHaveBeenCalled();
    expect(availabilityUpsertMock).not.toHaveBeenCalled();
  });

  // Fail-closed: brak roli nie może przejść jako "brak sprawdzenia" — wzorzec z
  // auditors-toggle-active.test.ts.
  // BLOCKER 3 (REVIEW #2, iteracja 3/3): bez `getUserMock`/`auditorFindUniqueMock`
  // skonfigurowanych, ten test padał pod mutacją wyłącznie przez `TypeError` przy
  // destrukturyzacji `{ data: { user } } = await supabase.auth.getUser()` na
  // `undefined` — a nie przez prawdziwą odmowę fail-closed z powodu roli `null`.
  // Konfiguracja poniżej pozwoliłaby akcji przejść dalej, GDYBY bramka roli nie
  // zadziałała — jedynym możliwym powodem odmowy zostaje więc `actorRole === null`.
  // @REQ: FLD-AVAIL-SELF
  it('brak roli (null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', email: AUDITOR_EMAIL, is_active: true, leave_status: 'ACTIVE' });

    const result = await setAuditorAvailability('aud-1', false);

    expect(result.success).toBe(false);
    expect(availabilityUpsertMock).not.toHaveBeenCalled();
  });

  // BLOCKER 2 (REVIEW #1, iteracja 2/3, opcja b — usunięcie, nie wzmocnienie): ten test
  // w oryginalnej formie mockował `auditorFindManyMock.mockResolvedValue([])` PRZED
  // odczytem puli, więc `pool.map(a=>a.id)).not.toContain('aud-blocked')` było prawdziwe
  // dla KAŻDEJ implementacji `getAuditors()`, także takiej bez `where: { is_active: true }`
  // — vacuous truth, `kk-trace` liczyłby to jako pokrycie AC2, którego realnie nie było.
  // Naprawa "wzmocnij mock" (opcja a z prompta review) okazuła się fałszywą drogą: prawdziwe
  // `getAuditors()` (leads/actions.ts) filtruje `is_active` w klauzuli SQL `where`, którą
  // mock `findMany` nie wykonuje sam z siebie — jedyny uczciwy sposób sprawdzenia tego
  // faktu to asercja na ARGUMENCIE wywołania `findMany` (czy `where.is_active === true`
  // zostało w ogóle wysłane), nie na jego zwrotce. Dokładnie to już robi
  // `leads-auditor-pool.test.ts` (`CRM-AUDYT-AC1`, `AC1.6 - zapytanie o pule wyboru
  // filtruje is_active: true`) — pisanie tu drugiej wersji tej samej asercji byłoby
  // duplikatem, nie dodatkowym dowodem.
  // Reszta twierdzenia AC2 ("self-declare zablokowanego konta nie odblokowuje go") jest
  // już w pełni pokryta w TYM pliku: `AC3 — akcja nigdy nie wywołuje
  // prisma.audytorzy.update` (wyżej) i `wyścig blokady administracyjnej z deklaracją`
  // (niżej, wołane wprost z `is_active: false`) — oba dowodzą, że self-declare NIGDY nie
  // dotyka `audytorzy.is_active`, niezależnie od stanu blokady w chwili wywołania.
  // Filtr `availability_declaration.isAvailable` w puli ma z kolei osobny, realistyczny
  // test (nie skryptowany na pustą listę) w `availability-pool-filter.test.ts` (AC4/
  // fail-open). Suma tych trzech testów dowodzi całości AC2 — czwarty, vacuous test nie
  // dokłada nic i został usunięty.
  // MINOR (REVIEW #2, iteracja 3/3): kluczowa asercja "zablokowany nie trafia do puli"
  // (druga połowa AC2 — filtr `is_active` w zapytaniu o pulę) żyje pod innym ID
  // wymagania w INNYM pliku: `leads-auditor-pool.test.ts`, describe
  // `getAuditors (leads/actions.ts) - pula wyboru wyklucza zablokowanych
  // (CRM-AUDYT-AC1.6)`, test `AC1.6 - zapytanie o pule wyboru filtruje is_active: true`
  // (@REQ: CRM-AUDYT-AC1). Ślad jest więc kompletny, ale rozjeżdża się między plikami/
  // ID — ten komentarz odsyła wprost, żeby nie trzeba było polegać na `kk-trace`.

  // Wyścig blokady z deklaracją (WO, "Przypadki brzegowe"): niezależnie od kolejności
  // — admin blokuje / pracownik się odblokowuje — is_active i availability_declarations
  // to OSOBNE tabele i OSOBNE zapisy, więc żaden z nich nie może nadpisać drugiego.
  // Pełna gwarancja deterministycznego wyniku PRZY REALNEJ WSPÓŁBIEŻNOŚCI (dwa
  // równoległe zapisy w bazie) wymaga testu integracyjnego z prawdziwym Postgresem —
  // to poniżej sprawdza wyłącznie strukturalną własność kodu (self-declare NIGDY nie
  // dotyka audytorzy.update), która czyni ten wyścig nieszkodliwym z definicji.
  //
  // MAJOR (REVIEW #2, iteracja 3/3, decyzja (a)): w wersji z iteracji 2 ten test był
  // duplikatem AC3 pod mylącą nazwą — kod akcji nigdy nie czyta `own.is_active`, więc
  // fixture `is_active: false` zamiast `true` niczego nie zmieniało w przebiegu i
  // żadna mutacja nie odróżniała tego testu od AC3 (`toHaveBeenCalledWith` w AC3 już
  // dowodzi tego samego payloadu). Zamiast tylko przemianować, dopisuję asercję, która
  // faktycznie dowodzi "determinizmu niezależnie od stanu blokady": wołam akcję z OBIEMA
  // wartościami `is_active` i porównuję zapisany payload — jeśli implementacja kiedyś
  // dołoży gałąź czytającą `own.is_active` (np. blokującą zapis albo zmieniającą wartość
  // przy zablokowanym koncie), ten test to złapie, a poprzednia wersja by tego nie
  // zauważyła (obie fixture prowadziły do identycznego, niesprawdzanego payloadu).
  // @REQ: FLD-AVAIL-SELF
  it('wyścig blokady administracyjnej z deklaracją: payload zapisu do availability_declarations jest identyczny niezależnie od aktualnego stanu is_active', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    availabilityUpsertMock.mockResolvedValue({ isAvailable: true });

    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', email: AUDITOR_EMAIL, is_active: false, leave_status: 'ACTIVE' });
    await setAuditorAvailability('aud-1', true);
    const payloadWhenBlocked = availabilityUpsertMock.mock.calls[0][0];

    availabilityUpsertMock.mockClear();
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', email: AUDITOR_EMAIL, is_active: true, leave_status: 'ACTIVE' });
    await setAuditorAvailability('aud-1', true);
    const payloadWhenActive = availabilityUpsertMock.mock.calls[0][0];

    expect(auditorUpdateMock).not.toHaveBeenCalled();
    expect(payloadWhenBlocked).toEqual(payloadWhenActive);
  });

  // Współbieżność zapisu (nie wyścig z blokadą, tylko podwójne wywołanie tej samej
  // deklaracji — np. dwa kliknięcia/dwa requesty crona). Testowalne bez prawdziwej
  // bazy TYLKO na poziomie "kod kieruje oba zapisy przez upsert po tym samym kluczu
  // unikalnym (auditorId)" — to NIE dowodzi, że Postgres faktycznie nie utworzy dwóch
  // wierszy przy realnym wyścigu. Ochronę przed duplikatem daje dopiero constraint
  // @@unique na auditorId (schema.prisma, model AvailabilityDeclaration) egzekwowany
  // przez bazę — pełne pokrycie wymaga testu integracyjnego z żywą instancją Postgres.
  // @REQ: FLD-AVAIL-SELF
  it('podwójne równoległe wywołanie tej samej deklaracji kieruje oba zapisy przez upsert po tym samym kluczu unikalnym', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', email: AUDITOR_EMAIL, is_active: true, leave_status: 'ACTIVE' });
    availabilityUpsertMock.mockResolvedValue({ isAvailable: false });

    await Promise.all([
      setAuditorAvailability('aud-1', false),
      setAuditorAvailability('aud-1', false),
    ]);

    expect(availabilityUpsertMock).toHaveBeenCalledTimes(2);
    for (const call of availabilityUpsertMock.mock.calls) {
      expect(call[0]).toEqual(
        expect.objectContaining({ where: expect.objectContaining({ auditorId: 'aud-1' }) }),
      );
    }
  });
});

describe('setSelfAvailabilityAction (crews/actions.ts) — ekipa deklaruje własną dostępność (R3, FLD-AVAIL-SELF)', () => {
  // R3 z WO: dziś ŻADNA bramka autoryzacyjna nie czyta zespoly_monterskie.aktywny —
  // rozdzielenie musi objąć obie encje symetrycznie, inaczej działa tylko dla połowy ról.
  // @REQ: FLD-AVAIL-SELF
  it('AC1 — ustawienie się ekipy jako niedostępnej nie zmienia zespoly_monterskie.aktywny (odczyt przed i po)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getUserMock.mockResolvedValue({ data: { user: { email: CREW_EMAIL } } });
    const row = { id: 'crew-1', email: CREW_EMAIL, aktywny: true, leave_status: 'ACTIVE' };
    crewFindUniqueMock.mockResolvedValue(row);
    availabilityUpsertMock.mockResolvedValue({ isAvailable: false });

    const before = await prisma.zespoly_monterskie.findUnique({ where: { id: 'crew-1' } });
    await setCrewAvailability('crew-1', false);
    const after = await prisma.zespoly_monterskie.findUnique({ where: { id: 'crew-1' } });

    expect(before?.aktywny).toBe(true);
    expect(after?.aktywny).toBe(before?.aktywny);
    expect(crewUpdateMock).not.toHaveBeenCalled();
  });

  // @REQ: FLD-AVAIL-SELF
  it('AC3 — akcja nigdy nie wywołuje prisma.zespoly_monterskie.update (crews.update pozostaje wyłącznie admin)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getUserMock.mockResolvedValue({ data: { user: { email: CREW_EMAIL } } });
    crewFindUniqueMock.mockResolvedValue({ id: 'crew-1', email: CREW_EMAIL, aktywny: true, leave_status: 'ACTIVE' });
    availabilityUpsertMock.mockResolvedValue({ isAvailable: false });

    const result = await setCrewAvailability('crew-1', false);

    expect(result.success).toBe(true);
    expect(crewUpdateMock).not.toHaveBeenCalled();
    // BLOCKER 1 (REVIEW #1, iteracja 2/3) — analogicznie do wariantu audytora powyżej,
    // kształt zweryfikowany czytaniem crews/actions.ts:93-97.
    expect(availabilityUpsertMock).toHaveBeenCalledWith({
      where: { crewId: 'crew-1' },
      create: { crewId: 'crew-1', isAvailable: false },
      update: { isAvailable: false },
    });
  });

  // @REQ: FLD-AVAIL-SELF
  it('próba zadeklarowania dostępności dla CUDZEGO rekordu ekipy jest odrzucona', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getUserMock.mockResolvedValue({ data: { user: { email: CREW_EMAIL } } });
    crewFindUniqueMock.mockResolvedValue({ id: 'crew-own', email: CREW_EMAIL, aktywny: true, leave_status: 'ACTIVE' });

    const result = await setCrewAvailability('crew-other-team', false);

    expect(result.success).toBe(false);
    expect(availabilityUpsertMock).not.toHaveBeenCalled();
  });

  // BLOCKER 1 (REVIEW #2, iteracja 3/3): bez skonfigurowania `crewFindUniqueMock` ten
  // test padał na "brak rekordu" (mock zwraca `undefined` po `mockReset()`), nie na
  // bramce roli, którą deklaruje nazwa i @REQ — pod mutacją cofającą
  // `actorRole !== 'monter'` z powrotem do `can(...) !== 'no'` test i tak by przeszedł
  // (fałszywy zielony). Skonfigurowanie rekordu, który PRZESZEDŁBY dalej gdyby bramka
  // roli nie zadziałała, plus asercja `not.toHaveBeenCalled()` na tym mocku, dowodzi że
  // odmowa nastąpiła PRZED sięgnięciem do bazy — czyli na bramce roli.
  // @REQ: FLD-AVAIL-SELF
  it('rola audytor (obcy zasób — to nie jej własna ekipa) jest odrzucona po stronie serwera', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: CREW_EMAIL } } });
    crewFindUniqueMock.mockResolvedValue({ id: 'crew-1', email: CREW_EMAIL, aktywny: true, leave_status: 'ACTIVE' });

    const result = await setCrewAvailability('crew-1', false);

    expect(result.success).toBe(false);
    expect(crewFindUniqueMock).not.toHaveBeenCalled();
    expect(availabilityUpsertMock).not.toHaveBeenCalled();
  });

  // BLOCKER 3 (REVIEW #2, iteracja 3/3): bez `getUserMock`/`crewFindUniqueMock`
  // skonfigurowanych, ten test padał pod mutacją wyłącznie przez `TypeError` przy
  // destrukturyzacji `{ data: { user } } = await supabase.auth.getUser()` na
  // `undefined` — a nie przez prawdziwą odmowę fail-closed z powodu roli `null`.
  // Konfiguracja poniżej pozwoliłaby akcji przejść dalej, GDYBY bramka roli nie
  // zadziałała — jedynym możliwym powodem odmowy zostaje więc `actorRole === null`.
  // @REQ: FLD-AVAIL-SELF
  it('brak roli (null) jest odrzucony fail-closed dla ekipy', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);
    getUserMock.mockResolvedValue({ data: { user: { email: CREW_EMAIL } } });
    crewFindUniqueMock.mockResolvedValue({ id: 'crew-1', email: CREW_EMAIL, aktywny: true, leave_status: 'ACTIVE' });

    const result = await setCrewAvailability('crew-1', false);

    expect(result.success).toBe(false);
    expect(availabilityUpsertMock).not.toHaveBeenCalled();
  });
});
