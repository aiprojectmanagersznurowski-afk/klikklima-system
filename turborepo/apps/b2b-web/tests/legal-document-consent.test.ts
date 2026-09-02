import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * WO: docs/workorders/FLD-CONSENT-DOCS.md — FLD-CONSENT-ACCEPT.
 * Wymaganie (contracts/requirements.contract.mjs, R('FLD-CONSENT-ACCEPT', ...), status TODO):
 *   "System rejestruje akceptację dokumentów prawnych przez pracownika terenowego: kto, którą
 *   wersję i kiedy — w sposób nieodwracalny i odporny na późniejszą zmianę treści."
 *
 * Warstwa kontrakt+schemat już wylądowała na main (commit 24681f4): tabela `employee_consents`
 * (model Prisma `EmployeeConsent`), zasób RBAC `employee_consents`
 * (`create: ['audytor','monter']` — BEZ admina, `read: ['admin','audytor:own','monter:own']`,
 * `update: []`, `delete: []`) — ale Server Action DZIŚ NIE ISTNIEJE W OGÓLE (sprawdzone:
 * `grep -rn "employeeConsent\|EmployeeConsent\|acceptLegalDocumentVersion" apps/b2b-web/src`
 * = brak wyników poza samym schema.prisma).
 *
 * ═══════════════════════ KSZTAŁT I LOKALIZACJA (decyzja test-author) ═══════════════════════
 *
 * Dwie funkcje o IDENTYCZNEJ nazwie i sygnaturze, symetrycznie, dopisane do dwóch ISTNIEJĄCYCH
 * plików — dokładnie wzorzec `setSelfAvailabilityAction` (auditors/actions.ts, crews/actions.ts),
 * nazwany wprost w poleceniu jako WZORZEC do naśladowania 1:1:
 *
 *   `acceptLegalDocumentVersionAction(versionId: string):
 *      Promise<{ success: boolean; error?: string; id?: string; acceptedAt?: Date }>`
 *   w `apps/b2b-web/src/app/(dashboard)/auditors/actions.ts` (encja: audytor, klucz: auditorId)
 *   oraz symetrycznie w `apps/b2b-web/src/app/(dashboard)/crews/actions.ts` (encja: ekipa,
 *   klucz: crewId).
 *
 * Argument to WYŁĄCZNIE `versionId` — kontrakt wprost wymaga, żeby Server Action przyjmowała
 * identyfikator wersji jawnie z frontendu (pracownik akceptuje TĘ KONKRETNĄ wersję, którą
 * właśnie czytał), zamiast doklejać "najnowszą" po stronie serwera. Akcja NIE przyjmuje
 * `auditorId`/`crewId` jako argument — właściciel wpisu ZAWSZE pochodzi z sesji (dokładnie jak
 * w `setSelfAvailabilityAction`, tyle że tam argument `id` służył do wykrycia próby podania
 * cudzego rekordu; tutaj takiego argumentu nie ma wcale, więc atak "podaj cudze ID" jest
 * strukturalnie niemożliwy — patrz ostatni `describe` niżej, który to dowodzi wprost).
 *
 * Jeśli implementer wybierze inną nazwę/lokalizację/kształt — to jest TEST-DEFECT do zgłoszenia
 * w tej turze, nie powód, żeby ten plik cichcem dopasować (wzorzec ustalony w
 * availability-self-declaration.test.ts i legal-document-versions.test.ts).
 *
 * ═══════════════════════ ZAŁOŻONA KOLEJNOŚĆ WEWNĄTRZ AKCJI (wzorzec setSelfAvailabilityAction) ═══
 *
 * 1. Bramka roli WIĄŻĄCA ROLĘ Z ENCJĄ, PRZED jakimkolwiek zapytaniem:
 *    `actorRole !== 'audytor' || can(actorRole, 'employee_consents', 'create') !== 'yes'`
 *    (w crews/actions.ts: `actorRole !== 'monter'`). Zwróć uwagę: capability to `'create'`, a
 *    oczekiwany wynik `can()` to `'yes'`, NIE `'own'` — macierz RBAC nie ma wariantu `:own` na
 *    `create` dla `employee_consents` (inaczej niż na `availability_declarations`), bo
 *    właścicielstwo wiersza wyznacza dopiero para (auditor_id | crew_id), której `can()` nie widzi.
 * 2. `createClient()` + `supabase.auth.getUser()` — brak e-maila w sesji odrzucone fail-closed.
 * 3. `prisma.audytorzy.findUnique({ where: { email } })` (odpowiednio `zespoly_monterskie`) —
 *    znalezienie WŁASNEGO rekordu. Brak rekordu odrzucone (konto usunięte w międzyczasie).
 * 4. `prisma.employeeConsent.create({ data: { auditorId: own.id, versionId } })` — WŁASNE `own.id`,
 *    NIGDY argument sterowany przez klienta (bo klient nie ma nawet jak go przekazać — patrz wyżej).
 *    Żadnego wcześniejszego `findFirst`/`findUnique` "czy już istnieje" na `employeeConsent` —
 *    ochronę przed duplikatem daje WYŁĄCZNIE ograniczenie unikalności w bazie (AC4/kryterium 4
 *    z prompta), nie sprawdzenie w kodzie, które przegrywa wyścig dwóch równoległych żądań.
 *
 * ═══════════════════════ MOCKOWANE ZALEŻNOŚCI ═══════════════════════
 *
 * `@repo/database` (brak żywej instancji testowej), `../src/utils/supabase/server`
 * (`getCurrentActorRole` woła `next/headers cookies()`, niedostępne poza kontekstem żądania
 * Next.js — wzorzec z auditors/crews actions), `next/cache` (`revalidatePath`, zamockowany na
 * wszelki wypadek — ten plik NIE asercjuje na nim, bo żaden istniejący ekran panelu B2B nie
 * wyświetla dziś listy akceptacji; jeśli implementer go woła albo nie, obie decyzje są zgodne
 * z kontraktem). `can()` z `@klikklima/contracts` NIE jest mockowane — leci na prawdziwej, już
 * zmergowanej macierzy RBAC (`employee_consents: create: ['audytor','monter']`, zweryfikowane
 * czytaniem `packages/contracts/src/generated/rbac.ts:36` — `admin` w tej liście NIE WYSTĘPUJE).
 *
 * `prisma.employeeConsent` jest zamockowany z metodami `create` i `update` (ta druga celowo, żeby
 * `expect(employeeConsentUpdateMock).not.toHaveBeenCalled()` miało na czym się oprzeć — bez
 * zdefiniowania metody w mocku przypadkowe wywołanie `update` wywaliłoby się `TypeError: ... is
 * not a function`, co byłoby ZŁYM RED-em dla tego konkretnego dowodu, gdyby kiedyś ten test padł
 * pod mutacją). Analogicznie `findFirst`/`findUnique` na `employeeConsent` — zdefiniowane w mocku
 * wyłącznie po to, żeby dowieść, że NIE są wołane (kryterium 4 z prompta: "insert wprost", nie
 * "sprawdź i wstaw").
 *
 * ═══════════════════════ NIETESTOWALNE NA TYM ETAPIE (jawnie, nie milcząco) ═══════════════════════
 *
 * - Kryterium 2 (akceptacja wskazująca NIEISTNIEJĄCĄ wersję odrzucona przez bazę — FK): wymaga
 *   żywego Postgresa. Test "create rzuca błąd" niżej sprawdza WYŁĄCZNIE, że akcja obsługuje
 *   odrzucenie przez zapytanie bez propagowania wyjątku i bez fałszywego `success: true` — nie
 *   dowodzi, że Postgres faktycznie odrzuci FK wskazujący donikąd.
 * - Kryterium 3 (akceptacja wskazująca wersję NIEOBOWIĄZUJĄCĄ w danej chwili odrzucona przez
 *   wyzwalacz `employee_consents_version_must_be_current_trg`): jak wyżej — mock `create` nie
 *   wykonuje wyzwalacza Postgresa. Ten sam test "create rzuca błąd" jest najbliższym możliwym
 *   dowodem na tym poziomie (obsługa błędu, nie jego przyczyna).
 * - Kryterium 4 (ponowna akceptacja tej samej wersji nie tworzy drugiego wpisu — unikalność w
 *   bazie): testy "równoległe"/"sekwencyjne drugie wywołanie" niżej dowodzą WYŁĄCZNIE własności
 *   strukturalnej (kod nie sprawdza "czy istnieje" przed insertem, każde wywołanie niezależnie
 *   woła `create` z tym samym payloadem) — NIE dowodzą, że Postgres faktycznie odrzuci drugi
 *   wiersz przy realnym wyścigu. Ochronę przed duplikatem daje wyłącznie
 *   `@@unique([auditorId, versionId])` / `@@unique([crewId, versionId])` (schema.prisma),
 *   egzekwowane przez bazę — pełne pokrycie wymaga testu integracyjnego z żywą instancją.
 * - Kryterium 6 (`update: []` w macierzy — UPDATE odrzucony dla KAŻDEJ roli, łącznie z adminem):
 *   ten plik NIE definiuje żadnej ścieżki Server Action próbującej UPDATE na `employee_consents`
 *   (rejestr jest append-only, WO nie wymaga takiej akcji w minimalnym zestawie) — nie ma więc
 *   kodu, który mógłby złamać to kryterium, a pisanie oddzielnego testu wyłącznie na `can()` na
 *   surowym kontrakcie BYŁOBY DZIŚ ZIELONE (macierz jest już zmergowana), co złamałoby bramkę RED
 *   tego pliku — świadomie pominięte, zgodnie z sugestią WO ("prawdopodobnie nie ma takiej
 *   ścieżki do przetestowania — odnotuj, jeśli nietestowalne wprost"). Najbliższy dowód, jaki
 *   TEN plik dostarcza: test "AC5 strukturalnie" niżej pokazuje, że `acceptLegalDocumentVersionAction`
 *   sama nigdy nie woła `employeeConsent.update`.
 * - Kryterium 7 (usunięcie konta pracownika z akceptacjami odrzucone przez FK RESTRICT):
 *   `deleteAuditorAction`/`deleteCrewAction` już istnieją i NIE są w zakresie tego WO (prompt
 *   wprost). Właściwość żyje w `onDelete: Restrict` (schema.prisma) i wymaga żywego Postgresa.
 * - Warstwa RLS: migracja `20260821130000_fld_consent_docs.sql` włącza RLS na
 *   `employee_consents` BEZ ŻADNEJ polityki (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` bez
 *   `CREATE POLICY`, komentarz w migracji: "Autor polityk: osobna pętla z rls-security-auditor,
 *   po decyzji o mapowaniu auth.users na rekord [pracownika]") — dokładnie ten sam stan co przy
 *   `legal_document_versions` (patrz `legal-document-versions.test.ts`). Panel B2B używa Prismy,
 *   która RLS omija (CLAUDE.md, pułapka 1) — jedyną granicą jest dziś kod tego pliku. Warstwa RLS
 *   jest więc podwójnie nietestowalna: brakuje zarówno polityk, jak i żywej instancji.
 * - Warstwa UI: Field App (gdzie pracownik faktycznie klika "akceptuję") nie istnieje — poza
 *   zakresem tego WO (faza 3).
 * - "Przypadek maksymalny" (checklist tej roli): to wymaganie nie ma naturalnego numerycznego
 *   capu (w odróżnieniu od progów SLA typu cap 5) — najbliższym sensownym odpowiednikiem jest
 *   wolumen równoległych akceptacji, pokryty testem "równoległe wywołania" niżej. Nie
 *   fabrykuję sztucznego capu, którego kontrakt nie definiuje.
 */

const {
  auditorFindUniqueMock,
  crewFindUniqueMock,
  employeeConsentCreateMock,
  employeeConsentUpdateMock,
  employeeConsentFindFirstMock,
  employeeConsentFindUniqueMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
  getUserMock,
  createClientMock,
} = vi.hoisted(() => ({
  auditorFindUniqueMock: vi.fn(),
  crewFindUniqueMock: vi.fn(),
  employeeConsentCreateMock: vi.fn(),
  employeeConsentUpdateMock: vi.fn(),
  employeeConsentFindFirstMock: vi.fn(),
  employeeConsentFindUniqueMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    audytorzy: {
      findUnique: auditorFindUniqueMock,
    },
    zespoly_monterskie: {
      findUnique: crewFindUniqueMock,
    },
    employeeConsent: {
      create: employeeConsentCreateMock,
      update: employeeConsentUpdateMock,
      findFirst: employeeConsentFindFirstMock,
      findUnique: employeeConsentFindUniqueMock,
    },
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
  createClient: createClientMock,
}));
// P0-1 (przygotowanie pod przyszłą turę): `getCurrentUser` deleguje do tego samego
// `getUserMock`, którym testy już sterują dla `createClient().auth.getUser()` —
// jeden punkt prawdy o sesji, spójny niezależnie od tego, którą ścieżką kod
// produkcyjny po nią sięgnie.
getCurrentUserMock.mockImplementation(() => getUserMock());

const { acceptLegalDocumentVersionAction: acceptAuditorConsent } = await import(
  '../src/app/(dashboard)/auditors/actions'
);
const { acceptLegalDocumentVersionAction: acceptCrewConsent } = await import(
  '../src/app/(dashboard)/crews/actions'
);

const AUDITOR_EMAIL = 'audytor.jan@klikklima.pl';
const CREW_EMAIL = 'ekipa.warszawa@klikklima.pl';
const CURRENT_VERSION_ID = 'ldv-rodo-v3';

beforeEach(() => {
  auditorFindUniqueMock.mockReset();
  crewFindUniqueMock.mockReset();
  employeeConsentCreateMock.mockReset();
  employeeConsentUpdateMock.mockReset();
  employeeConsentFindFirstMock.mockReset();
  employeeConsentFindUniqueMock.mockReset();
  revalidatePathMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  getUserMock.mockReset();
  createClientMock.mockReset();
  createClientMock.mockResolvedValue({ auth: { getUser: getUserMock } });
});

describe('acceptLegalDocumentVersionAction (auditors/actions.ts) — audytor akceptuje wersję dokumentu (FLD-CONSENT-ACCEPT)', () => {
  // Kryterium 1: zapis obejmuje moment (_at, timestamptz) oraz wersję wskazaną kluczem obcym —
  // nie sama flaga logiczna. Payload dokładny (nie objectContaining), wzorem BLOCKER 1 z
  // availability-self-declaration.test.ts.
  // @REQ: FLD-CONSENT-ACCEPT
  it('audytor akceptuje obowiązującą wersję: zapis zawiera własny auditorId, podany versionId, i zwraca id + acceptedAt z bazy', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', email: AUDITOR_EMAIL });
    const acceptedAt = new Date('2026-08-24T10:15:00Z');
    employeeConsentCreateMock.mockResolvedValue({
      id: 'consent-1',
      auditorId: 'aud-1',
      crewId: null,
      versionId: CURRENT_VERSION_ID,
      acceptedAt,
    });

    const result = await acceptAuditorConsent(CURRENT_VERSION_ID);

    expect(result.success).toBe(true);
    expect(result.id).toBe('consent-1');
    expect(result.acceptedAt).toEqual(acceptedAt);
    // Tożsamość rozstrzygana WYŁĄCZNIE e-mailem z sesji — nigdy argumentem sterowanym przez
    // klienta (np. versionId podstawionym jako id własnego rekordu). Bez tej asercji mutant
    // `{ where: { id: versionId } }` przechodzi ten test niezauważony (mock zwraca statyczną
    // wartość niezależnie od argumentu).
    expect(auditorFindUniqueMock).toHaveBeenCalledWith({ where: { email: AUDITOR_EMAIL } });
    expect(employeeConsentCreateMock).toHaveBeenCalledWith({
      data: { auditorId: 'aud-1', versionId: CURRENT_VERSION_ID },
    });
    // Kryterium 4 (część): żadnego "sprawdź, czy już istnieje" przed insertem — ochrania
    // wyłącznie ograniczenie unikalności w bazie.
    expect(employeeConsentFindFirstMock).not.toHaveBeenCalled();
    expect(employeeConsentFindUniqueMock).not.toHaveBeenCalled();
  });

  // Kryterium 11: zapisany auditorId to WŁASNY rekord znaleziony po e-mailu z sesji — powtórka
  // z INNYM ID własnym niż w teście powyżej, żeby wykluczyć implementację, która przez pomyłkę
  // wkłada stałą/nieprawidłową wartość zamiast realnie użytego `own.id`.
  // @REQ: FLD-CONSENT-ACCEPT
  it('zapisany auditorId to zawsze własny rekord z sesji, niezależnie od jego wartości (brak jakiegokolwiek argumentu sterującego właścicielem)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-completely-different-id-999', email: AUDITOR_EMAIL });
    employeeConsentCreateMock.mockResolvedValue({
      id: 'consent-2',
      auditorId: 'aud-completely-different-id-999',
      versionId: CURRENT_VERSION_ID,
      acceptedAt: new Date(),
    });

    await acceptAuditorConsent(CURRENT_VERSION_ID);

    // Główny dowód tego testu: findUnique jest wołany po e-mailu z sesji, NIGDY po versionId
    // (mutant `{ where: { id: versionId } }` rozstrzygnąłby tożsamość argumentem klienta —
    // ten mock zwraca statyczną wartość niezależnie od `where`, więc bez tej asercji mutant
    // przechodzi test cicho).
    expect(auditorFindUniqueMock).toHaveBeenCalledWith({ where: { email: AUDITOR_EMAIL } });
    expect(employeeConsentCreateMock).toHaveBeenCalledWith({
      data: { auditorId: 'aud-completely-different-id-999', versionId: CURRENT_VERSION_ID },
    });
  });

  // Kryterium 9: rola BEZ employee_consents.create — KAŻDA poza audytor/monter, WŁĄCZNIE Z
  // ADMINEM (admin celowo nieobecny w create, RBAC: "administrator nie akceptuje w imieniu
  // pracownika"). Mock findUnique skonfigurowany na PASUJĄCY rekord, żeby dowód opierał się na
  // bramce, nie na przypadkowym "brak rekordu" (pułapka nazwana wprost w prompcie, BLOCKER z
  // reviewu setSelfAvailabilityAction).
  // @REQ: FLD-CONSENT-ACCEPT
  it('rola admin (BRAK create na employee_consents mimo bycia administratorem) jest odrzucona fail-closed, przed sięgnięciem do bazy', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', email: AUDITOR_EMAIL });

    const result = await acceptAuditorConsent(CURRENT_VERSION_ID);

    expect(result.success).toBe(false);
    expect(auditorFindUniqueMock).not.toHaveBeenCalled();
    expect(employeeConsentCreateMock).not.toHaveBeenCalled();
  });

  // @REQ: FLD-CONSENT-ACCEPT
  it('rola dyspozytor (brak create na employee_consents) jest odrzucona fail-closed, przed sięgnięciem do bazy', async () => {
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', email: AUDITOR_EMAIL });

    const result = await acceptAuditorConsent(CURRENT_VERSION_ID);

    expect(result.success).toBe(false);
    expect(auditorFindUniqueMock).not.toHaveBeenCalled();
    expect(employeeConsentCreateMock).not.toHaveBeenCalled();
  });

  // Kryterium 10: wiązanie roli z encją. `can('monter', 'employee_consents', 'create')` zwraca
  // `'yes'` (monter JEST na liście create — to prawidłowa rola dla TEGO zasobu, ale dla INNEJ
  // encji: to nie jest jego własny audytor). Mock findUnique skonfigurowany na PASUJĄCY rekord —
  // gdyby bramka `actorRole !== 'audytor'` nie zadziałała, ten test przeszedłby dalej i
  // wywołałby create, więc `not.toHaveBeenCalled()` faktycznie dowodzi działania bramki.
  // @REQ: FLD-CONSENT-ACCEPT
  it('rola monter (prawidłowa dla zasobu, ale to nie jej własny audytor) jest odrzucona po stronie serwera, przed sięgnięciem do bazy', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', email: AUDITOR_EMAIL });

    const result = await acceptAuditorConsent(CURRENT_VERSION_ID);

    expect(result.success).toBe(false);
    expect(auditorFindUniqueMock).not.toHaveBeenCalled();
    expect(employeeConsentCreateMock).not.toHaveBeenCalled();
  });

  // Fail-closed: brak roli nie może przejść jako "brak sprawdzenia" — wzorzec z
  // availability-self-declaration.test.ts. Mock skonfigurowany na PASUJĄCY rekord z tego samego
  // powodu co wyżej (BLOCKER 3, REVIEW #2 tamtego pliku).
  // @REQ: FLD-CONSENT-ACCEPT
  it('brak roli (null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', email: AUDITOR_EMAIL });

    const result = await acceptAuditorConsent(CURRENT_VERSION_ID);

    expect(result.success).toBe(false);
    expect(employeeConsentCreateMock).not.toHaveBeenCalled();
  });

  // Przypadek pusty (sesja): brak e-maila w sesji (np. token wygasł między renderem a akcją) —
  // odrzucone fail-closed, PRZED odczytem własnego rekordu.
  // @REQ: FLD-CONSENT-ACCEPT
  it('brak e-maila w sesji jest odrzucony fail-closed, przed odczytem własnego rekordu', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: null } });

    const result = await acceptAuditorConsent(CURRENT_VERSION_ID);

    expect(result.success).toBe(false);
    expect(auditorFindUniqueMock).not.toHaveBeenCalled();
    expect(employeeConsentCreateMock).not.toHaveBeenCalled();
  });

  // Przypadek pusty (encja): własny rekord nie istnieje (konto usunięte między renderem
  // ekranu akceptacji a kliknięciem — np. usunięte przez admina w innej karcie).
  // @REQ: FLD-CONSENT-ACCEPT
  it('brak własnego rekordu audytora (konto usunięte w międzyczasie) jest odrzucony, bez wywołania create', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    auditorFindUniqueMock.mockResolvedValue(null);

    const result = await acceptAuditorConsent(CURRENT_VERSION_ID);

    expect(result.success).toBe(false);
    expect(employeeConsentCreateMock).not.toHaveBeenCalled();
  });

  // Kryteria 2/3 (nietestowalne w pełni bez żywej bazy — patrz nagłówek pliku): dowód, że akcja
  // OBSŁUGUJE odrzucenie zapytania (FK na nieistniejącą wersję / wyzwalacz na wersję
  // nieobowiązującą) bez rzucania wyjątku dalej i bez fałszywego `success: true`. NIE dowodzi,
  // że Postgres faktycznie odrzuci — to wymaga testu integracyjnego.
  // @REQ: FLD-CONSENT-ACCEPT
  it('odrzucenie zapytania przez bazę (symulacja FK / wyzwalacza "wersja nieobowiązująca") kończy się { success: false }, nie wyjątkiem', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', email: AUDITOR_EMAIL });
    employeeConsentCreateMock.mockRejectedValue(
      Object.assign(new Error('employee_consents: mozna zaakceptowac wylacznie wersje obowiazujaca w chwili zapisu (AC3)'), {
        code: 'P2003',
      }),
    );

    await expect(acceptAuditorConsent('ldv-draft-or-superseded')).resolves.toMatchObject({
      success: false,
    });
    expect(auditorFindUniqueMock).toHaveBeenCalledWith({ where: { email: AUDITOR_EMAIL } });
  });

  // Przypadek pusty (dane wejściowe): versionId pusty łańcuch — akcja NIE waliduje treści
  // versionId sama (to jest praca FK/wyzwalacza w bazie, kryterium 2/3), ale MUSI obsłużyć
  // odrzucenie zapytania tak samo jak wyżej, zamiast zwrócić fałszywy sukces.
  // @REQ: FLD-CONSENT-ACCEPT
  it('pusty versionId prowadzi do odrzuconego zapytania obsłużonego jako { success: false }, nie do cichego sukcesu', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', email: AUDITOR_EMAIL });
    employeeConsentCreateMock.mockRejectedValue(Object.assign(new Error('invalid input syntax for type uuid'), { code: 'P2003' }));

    const result = await acceptAuditorConsent('');

    expect(result.success).toBe(false);
    expect(auditorFindUniqueMock).toHaveBeenCalledWith({ where: { email: AUDITOR_EMAIL } });
  });

  // Kryterium 5 (strukturalnie): publikacja nowej wersji nie ma tu ŻADNEJ ścieżki, bo ta akcja
  // sama nigdy nie wywołuje UPDATE na employee_consents — jedyna operacja to CREATE.
  // @REQ: FLD-CONSENT-ACCEPT
  it('akcja nigdy nie wywołuje employeeConsent.update (jedyna operacja to create — rejestr jest append-only)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', email: AUDITOR_EMAIL });
    employeeConsentCreateMock.mockResolvedValue({ id: 'consent-3', auditorId: 'aud-1', versionId: CURRENT_VERSION_ID, acceptedAt: new Date() });

    await acceptAuditorConsent(CURRENT_VERSION_ID);

    expect(auditorFindUniqueMock).toHaveBeenCalledWith({ where: { email: AUDITOR_EMAIL } });
    expect(employeeConsentUpdateMock).not.toHaveBeenCalled();
  });

  // Kryterium 4 (część strukturalna, współbieżność — checklist tej roli): dwa równoległe
  // żądania akceptacji TEJ SAMEJ wersji przez TEGO SAMEGO pracownika. Kod kieruje OBA zapisy
  // przez create z identycznym payloadem, bez sprawdzenia "czy istnieje" pomiędzy nimi — ochronę
  // przed duplikatem daje wyłącznie constraint w bazie (nietestowalne tu w pełni, patrz nagłówek).
  // @REQ: FLD-CONSENT-ACCEPT
  it('dwa równoległe wywołania akceptacji tej samej wersji przez tego samego audytora kierują oba zapisy przez create z identycznym payloadem', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', email: AUDITOR_EMAIL });
    employeeConsentCreateMock.mockResolvedValue({ id: 'consent-x', auditorId: 'aud-1', versionId: CURRENT_VERSION_ID, acceptedAt: new Date() });

    await Promise.all([
      acceptAuditorConsent(CURRENT_VERSION_ID),
      acceptAuditorConsent(CURRENT_VERSION_ID),
    ]);

    expect(employeeConsentCreateMock).toHaveBeenCalledTimes(2);
    for (const call of employeeConsentCreateMock.mock.calls) {
      expect(call[0]).toEqual({ data: { auditorId: 'aud-1', versionId: CURRENT_VERSION_ID } });
    }
    for (const call of auditorFindUniqueMock.mock.calls) {
      expect(call[0]).toEqual({ where: { email: AUDITOR_EMAIL } });
    }
    expect(employeeConsentFindFirstMock).not.toHaveBeenCalled();
    expect(employeeConsentFindUniqueMock).not.toHaveBeenCalled();
  });

  // Idempotencja (checklist tej roli — najbliższy sensowny odpowiednik "drugie wywołanie crona/
  // webhooka" dla tej akcji): drugie, SEKWENCYJNE wywołanie tej samej akceptacji nie zmienia
  // zachowania — każde wywołanie niezależnie woła create z tym samym payloadem, bo "nieduplikowanie"
  // jest odpowiedzialnością bazy, nie pamięci procesu ani logiki warunkowej w akcji.
  // @REQ: FLD-CONSENT-ACCEPT
  it('drugie, sekwencyjne wywołanie tej samej akceptacji ponownie woła create z identycznym payloadem (nieduplikowanie żyje w bazie, nie w akcji)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    auditorFindUniqueMock.mockResolvedValue({ id: 'aud-1', email: AUDITOR_EMAIL });
    employeeConsentCreateMock.mockResolvedValue({ id: 'consent-y', auditorId: 'aud-1', versionId: CURRENT_VERSION_ID, acceptedAt: new Date() });

    await acceptAuditorConsent(CURRENT_VERSION_ID);
    await acceptAuditorConsent(CURRENT_VERSION_ID);

    expect(employeeConsentCreateMock).toHaveBeenCalledTimes(2);
    expect(employeeConsentCreateMock.mock.calls[0][0]).toEqual(employeeConsentCreateMock.mock.calls[1][0]);
    for (const call of auditorFindUniqueMock.mock.calls) {
      expect(call[0]).toEqual({ where: { email: AUDITOR_EMAIL } });
    }
  });
});

describe('acceptLegalDocumentVersionAction (crews/actions.ts) — ekipa akceptuje wersję dokumentu (FLD-CONSENT-ACCEPT, symetria)', () => {
  // @REQ: FLD-CONSENT-ACCEPT
  it('ekipa akceptuje obowiązującą wersję: zapis zawiera własny crewId, podany versionId, i zwraca id + acceptedAt z bazy', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getUserMock.mockResolvedValue({ data: { user: { email: CREW_EMAIL } } });
    crewFindUniqueMock.mockResolvedValue({ id: 'crew-1', email: CREW_EMAIL });
    const acceptedAt = new Date('2026-08-24T11:00:00Z');
    employeeConsentCreateMock.mockResolvedValue({
      id: 'consent-crew-1',
      auditorId: null,
      crewId: 'crew-1',
      versionId: CURRENT_VERSION_ID,
      acceptedAt,
    });

    const result = await acceptCrewConsent(CURRENT_VERSION_ID);

    expect(result.success).toBe(true);
    expect(result.id).toBe('consent-crew-1');
    expect(result.acceptedAt).toEqual(acceptedAt);
    // Symetrycznie do wariantu audytorskiego: tożsamość rozstrzygana WYŁĄCZNIE e-mailem z sesji.
    expect(crewFindUniqueMock).toHaveBeenCalledWith({ where: { email: CREW_EMAIL } });
    expect(employeeConsentCreateMock).toHaveBeenCalledWith({
      data: { crewId: 'crew-1', versionId: CURRENT_VERSION_ID },
    });
    expect(employeeConsentFindFirstMock).not.toHaveBeenCalled();
    expect(employeeConsentFindUniqueMock).not.toHaveBeenCalled();
  });

  // @REQ: FLD-CONSENT-ACCEPT
  it('rola admin (BRAK create na employee_consents) jest odrzucona fail-closed, przed sięgnięciem do bazy', async () => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    getUserMock.mockResolvedValue({ data: { user: { email: CREW_EMAIL } } });
    crewFindUniqueMock.mockResolvedValue({ id: 'crew-1', email: CREW_EMAIL });

    const result = await acceptCrewConsent(CURRENT_VERSION_ID);

    expect(result.success).toBe(false);
    expect(crewFindUniqueMock).not.toHaveBeenCalled();
    expect(employeeConsentCreateMock).not.toHaveBeenCalled();
  });

  // @REQ: FLD-CONSENT-ACCEPT
  it('rola dyspozytor (brak create na employee_consents) jest odrzucona fail-closed, przed sięgnięciem do bazy', async () => {
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
    getUserMock.mockResolvedValue({ data: { user: { email: CREW_EMAIL } } });
    crewFindUniqueMock.mockResolvedValue({ id: 'crew-1', email: CREW_EMAIL });

    const result = await acceptCrewConsent(CURRENT_VERSION_ID);

    expect(result.success).toBe(false);
    expect(crewFindUniqueMock).not.toHaveBeenCalled();
    expect(employeeConsentCreateMock).not.toHaveBeenCalled();
  });

  // Kryterium 10 (lustrzane): audytor (prawidłowa rola dla zasobu, ale to nie jego własna
  // ekipa) wołający wariant ekipowy. Mock skonfigurowany na PASUJĄCY rekord z tego samego
  // powodu co w wariancie audytorskim wyżej.
  // @REQ: FLD-CONSENT-ACCEPT
  it('rola audytor (prawidłowa dla zasobu, ale to nie jej własna ekipa) jest odrzucona po stronie serwera, przed sięgnięciem do bazy', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: CREW_EMAIL } } });
    crewFindUniqueMock.mockResolvedValue({ id: 'crew-1', email: CREW_EMAIL });

    const result = await acceptCrewConsent(CURRENT_VERSION_ID);

    expect(result.success).toBe(false);
    expect(crewFindUniqueMock).not.toHaveBeenCalled();
    expect(employeeConsentCreateMock).not.toHaveBeenCalled();
  });

  // @REQ: FLD-CONSENT-ACCEPT
  it('brak roli (null) jest odrzucony fail-closed dla ekipy', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);
    getUserMock.mockResolvedValue({ data: { user: { email: CREW_EMAIL } } });
    crewFindUniqueMock.mockResolvedValue({ id: 'crew-1', email: CREW_EMAIL });

    const result = await acceptCrewConsent(CURRENT_VERSION_ID);

    expect(result.success).toBe(false);
    expect(employeeConsentCreateMock).not.toHaveBeenCalled();
  });

  // Przypadek pusty (sesja).
  // @REQ: FLD-CONSENT-ACCEPT
  it('brak e-maila w sesji jest odrzucony fail-closed dla ekipy, przed odczytem własnego rekordu', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getUserMock.mockResolvedValue({ data: { user: null } });

    const result = await acceptCrewConsent(CURRENT_VERSION_ID);

    expect(result.success).toBe(false);
    expect(crewFindUniqueMock).not.toHaveBeenCalled();
    expect(employeeConsentCreateMock).not.toHaveBeenCalled();
  });

  // Przypadek pusty (encja).
  // @REQ: FLD-CONSENT-ACCEPT
  it('brak własnego rekordu ekipy (konto usunięte w międzyczasie) jest odrzucony, bez wywołania create', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getUserMock.mockResolvedValue({ data: { user: { email: CREW_EMAIL } } });
    crewFindUniqueMock.mockResolvedValue(null);

    const result = await acceptCrewConsent(CURRENT_VERSION_ID);

    expect(result.success).toBe(false);
    expect(employeeConsentCreateMock).not.toHaveBeenCalled();
  });

  // @REQ: FLD-CONSENT-ACCEPT
  it('odrzucenie zapytania przez bazę (symulacja FK / wyzwalacza "wersja nieobowiązująca") kończy się { success: false } dla ekipy, nie wyjątkiem', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getUserMock.mockResolvedValue({ data: { user: { email: CREW_EMAIL } } });
    crewFindUniqueMock.mockResolvedValue({ id: 'crew-1', email: CREW_EMAIL });
    employeeConsentCreateMock.mockRejectedValue(
      Object.assign(new Error('employee_consents: mozna zaakceptowac wylacznie wersje obowiazujaca w chwili zapisu (AC3)'), {
        code: 'P2003',
      }),
    );

    await expect(acceptCrewConsent('ldv-draft-or-superseded')).resolves.toMatchObject({
      success: false,
    });
    expect(crewFindUniqueMock).toHaveBeenCalledWith({ where: { email: CREW_EMAIL } });
  });

  // @REQ: FLD-CONSENT-ACCEPT
  it('akcja ekipy nigdy nie wywołuje employeeConsent.update (jedyna operacja to create)', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getUserMock.mockResolvedValue({ data: { user: { email: CREW_EMAIL } } });
    crewFindUniqueMock.mockResolvedValue({ id: 'crew-1', email: CREW_EMAIL });
    employeeConsentCreateMock.mockResolvedValue({ id: 'consent-crew-2', crewId: 'crew-1', versionId: CURRENT_VERSION_ID, acceptedAt: new Date() });

    await acceptCrewConsent(CURRENT_VERSION_ID);

    expect(crewFindUniqueMock).toHaveBeenCalledWith({ where: { email: CREW_EMAIL } });
    expect(employeeConsentUpdateMock).not.toHaveBeenCalled();
  });

  // @REQ: FLD-CONSENT-ACCEPT
  it('dwa równoległe wywołania akceptacji tej samej wersji przez tę samą ekipę kierują oba zapisy przez create z identycznym payloadem', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');
    getUserMock.mockResolvedValue({ data: { user: { email: CREW_EMAIL } } });
    crewFindUniqueMock.mockResolvedValue({ id: 'crew-1', email: CREW_EMAIL });
    employeeConsentCreateMock.mockResolvedValue({ id: 'consent-crew-x', crewId: 'crew-1', versionId: CURRENT_VERSION_ID, acceptedAt: new Date() });

    await Promise.all([
      acceptCrewConsent(CURRENT_VERSION_ID),
      acceptCrewConsent(CURRENT_VERSION_ID),
    ]);

    expect(employeeConsentCreateMock).toHaveBeenCalledTimes(2);
    for (const call of employeeConsentCreateMock.mock.calls) {
      expect(call[0]).toEqual({ data: { crewId: 'crew-1', versionId: CURRENT_VERSION_ID } });
    }
    for (const call of crewFindUniqueMock.mock.calls) {
      expect(call[0]).toEqual({ where: { email: CREW_EMAIL } });
    }
  });
});

describe('FLD-CONSENT-ACCEPT — pracownik obu światów akceptuje dwa razy (R1 z WO: audytorzy i zespoly_monterskie to dwie niepowiązane encje)', () => {
  // Kryterium 8: ta sama osoba, występująca w systemie zarówno jako rekord audytora, jak i
  // rekord (koordynatora) ekipy, akceptuje DWA razy tę samą wersję — dwa osobne wiersze, dwa
  // różne klucze obce (auditorId vs crewId), nigdy jeden połączony zapis. To jest dowód na
  // poziomie kształtu zapytań, nie na poziomie CHECK w bazie (num_nonnulls = 1), którego mock
  // nie wykonuje.
  // @REQ: FLD-CONSENT-ACCEPT
  it('akceptacja jako audytor i akceptacja jako ekipa (ta sama wersja) tworzą dwa osobne zapisy z rozłącznymi kluczami obcymi', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    getUserMock.mockResolvedValue({ data: { user: { email: AUDITOR_EMAIL } } });
    auditorFindUniqueMock.mockResolvedValue({ id: 'person-as-auditor', email: AUDITOR_EMAIL });
    employeeConsentCreateMock.mockResolvedValueOnce({
      id: 'consent-dual-1',
      auditorId: 'person-as-auditor',
      versionId: CURRENT_VERSION_ID,
      acceptedAt: new Date(),
    });
    await acceptAuditorConsent(CURRENT_VERSION_ID);

    getCurrentActorRoleMock.mockResolvedValue('monter');
    getUserMock.mockResolvedValue({ data: { user: { email: CREW_EMAIL } } });
    crewFindUniqueMock.mockResolvedValue({ id: 'person-as-crew', email: CREW_EMAIL });
    employeeConsentCreateMock.mockResolvedValueOnce({
      id: 'consent-dual-2',
      crewId: 'person-as-crew',
      versionId: CURRENT_VERSION_ID,
      acceptedAt: new Date(),
    });
    await acceptCrewConsent(CURRENT_VERSION_ID);

    expect(employeeConsentCreateMock).toHaveBeenCalledTimes(2);
    const [firstCallArgs, secondCallArgs] = employeeConsentCreateMock.mock.calls;
    expect(firstCallArgs[0]).toEqual({ data: { auditorId: 'person-as-auditor', versionId: CURRENT_VERSION_ID } });
    expect(secondCallArgs[0]).toEqual({ data: { crewId: 'person-as-crew', versionId: CURRENT_VERSION_ID } });
    // Rozłączność: żaden z dwóch payloadów nie zawiera OBU kluczy jednocześnie.
    expect(firstCallArgs[0].data).not.toHaveProperty('crewId');
    expect(secondCallArgs[0].data).not.toHaveProperty('auditorId');
    // Tożsamość w obu światach rozstrzygana wyłącznie e-mailem z sesji, nigdy versionId.
    expect(auditorFindUniqueMock).toHaveBeenCalledWith({ where: { email: AUDITOR_EMAIL } });
    expect(crewFindUniqueMock).toHaveBeenCalledWith({ where: { email: CREW_EMAIL } });
  });
});
