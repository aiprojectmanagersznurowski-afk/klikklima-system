import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { fromZonedTime } from 'date-fns-tz';
import { prisma } from '@repo/database';

/**
 * WO: docs/workorders/B2C-LEAD-ATOMIC.md — AC2 (błąd wstrzyknięty na krokach klient/adres/
 * lead PRZEZ NARUSZENIE OGRANICZENIA, nie mockiem), AC5 (kody odkrywane W TRAKCIE transakcji:
 * SLOT_TAKEN/SUBJECT_ALREADY_BOOKED/POOL_MISMATCH — zero nowego klienta/adresu/leada) oraz
 * przypadki brzegowe "wyścig dwóch klientów o jeden slot (pula=1)", "wyścig przy puli>=2",
 * "podwójne kliknięcie".
 *
 * Konwencja repo (patrz `apps/b2c-web/tests/actions/booking-concurrency.itest.ts`,
 * `apps/b2b-web/tests/create-booking-concurrency.itest.ts`): `*.itest.ts` →
 * `vitest.integration.config.mts`, żywy Postgres, `npm run test:integration` z katalogu repo.
 * W TYM środowisku (brak Dockera) ten plik jest odrzucany przez
 * `tools/vitest-integration-db-guard.mjs` przed wykonaniem — weryfikacja realnego przebiegu
 * zostaje jobowi `integracja` w CI / lokalnemu `supabase start` (patrz `project_itest_no_docker_
 * sandbox` w pamięci test-authora).
 *
 * TECHNIKA WSTRZYKNIĘCIA BŁĘDU NA KROKACH KLIENT/ADRES/LEAD (AC2): `klientId`/`adresId`/
 * `leadId` są generowane SERWEROWO przez `crypto.randomUUID()` (P-3, WO) — nie przychodzą z
 * żądania, więc nie da się ich kolidować "z zewnątrz" bez kontrolowania generatora. Ten plik
 * podszywa się WYŁĄCZNIE pod `node:crypto` (nie pod Prismę, nie pod wynik `createBooking`/
 * `writeBookingCandidate` — WO: "nie mockiem" odnosi się do warstwy bazy/rezerwacji), żeby
 * WYMUSIĆ, że jedno z trzech generowanych id jest DOKŁADNIE tym, które test wcześniej wstawił
 * do bazy jako already-existing wiersz — naruszenie ograniczenia PRIMARY KEY jest wtedy
 * prawdziwe, wykryte przez żywy Postgres, nie zasymulowane.
 *
 * ZAŁOŻENIE O KOLEJNOŚCI WOŁAŃ `randomUUID()` w `saveLead.ts` (klientId, potem adresId, potem
 * leadId — DOKŁADNIE ta kolejność, zgodna z P-1/P-2/P-3 WO i z dzisiejszym kodem): jeśli
 * implementer zmieni tę kolejność, ten plik pada na złym kroku — zgłoszone w podsumowaniu tury
 * jako ryzyko, nie jako TEST-DEFECT z automatu (WO nie zamraża tej kolejności explicite, ale
 * opisuje ją konsekwentnie w tej samej sekwencji we WSZYSTKICH miejscach, gdzie ją wymienia).
 *
 * BRAK PRZYPADKU POOL_MISMATCH NA ŻYWYM POSTGRESIE (recenzja PR, MAJOR M1) — ŚWIADOMIE. Ten
 * kod odkrywany jest przez wyzwalacz `bookings_pool_matches_basket_trg` WYŁĄCZNIE, gdy pula
 * koszyka (`visit_duration_baskets.pool`) nie zgadza się z `resource_kind` wpisu `bookings`.
 * `saveLead.ts` ZAWSZE ustawia `resourceKind` na `prepared.resourceKind`, który
 * `prepareBookingCandidates` wylicza WPROST z `pool` TEGO SAMEGO koszyka AUDIT, w TEJ SAMEJ
 * (poprzedzającej transakcję) fazie przygotowawczej — więc w normalnym przebiegu żądania
 * niezgodność nie może powstać. Jedyny sposób wymuszenia jej na żywym Postgresie to zmiana
 * `pool` koszyka AUDIT (globalna, współdzielona konfiguracja) MIĘDZY fazą przygotowawczą a
 * transakcją tego samego żądania — wymagałoby to mutacji współdzielonego fixture'u
 * (`visit_duration_baskets`, wiersz używany przez WSZYSTKIE testy w tym pakiecie
 * uruchamiane równolegle) z realnym ryzykiem zafałszowania innych testów uruchamianych w tym
 * samym oknie. Uznane za nieosiągalne w rozsądny, nieinwazyjny sposób w TYM pliku — pokrycie
 * kodu POOL_MISMATCH jest na poziomie jednostkowym w `saveLead.booking.test.ts` (mock
 * `writeBookingCandidate` zwracający `{ok:false, error:{code:'POOL_MISMATCH'}}`).
 */

const TIME_ZONE = 'Europe/Warsaw';
const MS_PER_MINUTE = 60000;

function localMoment(dateStr: string, hhmm: string): Date {
  return fromZonedTime(`${dateStr}T${hhmm}:00`, TIME_ZONE);
}

function timeOfDay(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00.000Z`);
}

/** Patrz `booking-concurrency.itest.ts` — sobota WZGLĘDNA do "teraz", nigdy literał. */
function futureSaturday(weeksFromNow: number, hhmm: string): Date {
  const base = new Date();
  base.setUTCDate(base.getUTCDate() + weeksFromNow * 7);
  const day = base.getUTCDay();
  const diffToSaturday = (6 - day + 7) % 7;
  base.setUTCDate(base.getUTCDate() + diffToSaturday);
  const dateStr = base.toISOString().slice(0, 10);
  return localMoment(dateStr, hhmm);
}

// Referencja do PRAWDZIWEGO `randomUUID`, uchwycona PRZED zamockowaniem `node:crypto` (przez
// `vi.importActual`, wewnątrz `vi.hoisted`) — celowo NIGDY nie importujemy `randomUUID`
// zwykłym `import { randomUUID } from 'node:crypto'` w tym pliku: taki import zostałby PO
// zamockowaniu podmieniony na `cryptoRandomUUIDSpy` (ten sam moduł co w `saveLead.ts`), więc
// każde użycie w pomocnikach testu/`afterEach` wywoływałoby samo siebie ->
// „Maximum call stack size exceeded" (BLOCKER 1, recenzja PR). `actualRandomUUID` jest
// jedynym dozwolonym źródłem „prawdziwych" id w tym pliku.
const { actualRandomUUID, cryptoRandomUUIDSpy } = await vi.hoisted(async () => {
  const actual = await vi.importActual<typeof import('node:crypto')>('node:crypto');
  return { actualRandomUUID: actual.randomUUID, cryptoRandomUUIDSpy: vi.fn() };
});

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  cryptoRandomUUIDSpy.mockImplementation(() => actualRandomUUID());
  return { ...actual, randomUUID: cryptoRandomUUIDSpy };
});

// Stub NIEUŻYWANY merytorycznie — `saveLead.ts` DZIŚ (przed implementacją P-3) wciąż
// importuje `@/lib/supabaseClient`; bez tego mocka import realnego modułu pada na
// nierozwiązywalnym aliasie `@/*` (`vitest.integration.config.mts` go nie definiuje) — RED
// z niewłaściwego powodu. Po P-3 (implementer usuwa ten import) ten mock staje się martwym,
// nieszkodliwym stubem — cały ten plik dowodzi zachowania na PRAWDZIWEJ Prismie, nie na
// żadnej atrapie supabase.
vi.mock('@/lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }));

const { saveLead } = await import('../../app/actions/saveLead');

async function createTestAuditor(): Promise<{ id: string }> {
  const suffix = actualRandomUUID();
  const auditor = await prisma.audytorzy.create({
    data: {
      imie_i_nazwisko: `ITEST B2C-LEAD-ATOMIC ${suffix}`,
      email: `itest-b2c-lead-atomic-${suffix}@example.invalid`,
      is_active: true,
      leave_status: 'ACTIVE',
    },
  });
  return auditor;
}

async function createTestSaturdayRule(auditorId: string, start: string, end: string): Promise<void> {
  await prisma.availabilityRule.create({
    data: { auditorId, weekday: 6, startTime: timeOfDay(start), endTime: timeOfDay(end), isActive: true },
  });
}

function testEmail(marker: string): string {
  return `itest-b2c-lead-atomic-${marker}-${actualRandomUUID()}@example.invalid`;
}

async function countByEmail(email: string): Promise<{ klienci: number; adresy: number; leady: number }> {
  const klienci = await prisma.klienci.count({ where: { email } });
  const adresy = await prisma.adresy.count({ where: { klient: { email } } });
  const leady = await prisma.leady.count({ where: { klient: { email } } });
  return { klienci, adresy, leady };
}

async function cleanupByEmail(email: string): Promise<void> {
  const client = await prisma.klienci.findFirst({ where: { email } });
  if (!client) return;
  await prisma.booking.deleteMany({
    where: { lead: { klient_id: client.id } },
  });
  await prisma.leady.deleteMany({ where: { klient_id: client.id } });
  await prisma.adresy.deleteMany({ where: { klient_id: client.id } });
  await prisma.klienci.deleteMany({ where: { id: client.id } });
}

let cleanupEmails: string[] = [];
let cleanupAuditorIds: string[] = [];

async function afterEachCleanup(): Promise<void> {
  for (const email of cleanupEmails) {
    await cleanupByEmail(email);
  }
  if (cleanupAuditorIds.length > 0) {
    // Klucz obcy `bookings_auditor_id_fkey` (model Prisma `Booking`, pole `auditorId`, patrz
    // `packages/database/prisma/schema.prisma`) blokuje usunięcie audytora, dla którego
    // istnieje jeszcze rezerwacja. `cleanupByEmail` powyżej usuwa rezerwacje wyłącznie te
    // powiązane z leadem PIERWSZEGO znalezionego klienta o danym e-mailu (`findFirst`) — test
    // "podwójne kliknięcie" tworzy DWA klientów z tym samym e-mailem i DWIE rezerwacje na tym
    // samym audytorze, więc rezerwacja drugiego klienta przeżywa `cleanupByEmail` i musi być
    // usunięta tutaj, po id audytora, zanim spróbujemy usunąć samego audytora.
    await prisma.booking.deleteMany({ where: { auditorId: { in: cleanupAuditorIds } } });
    await prisma.availabilityRule.deleteMany({ where: { auditorId: { in: cleanupAuditorIds } } });
    await prisma.audytorzy.deleteMany({ where: { id: { in: cleanupAuditorIds } } });
  }
  cleanupEmails = [];
  cleanupAuditorIds = [];
}

let auditBasketId: string;

async function requireBasket(code: string): Promise<string> {
  const basket = await prisma.visitDurationBasket.findFirst({ where: { code, isActive: true } });
  if (!basket) {
    throw new Error(
      `Koszyk '${code}' nie istnieje na tej bazie — uruchom \`supabase start\` przed \`npm run test:integration\`.`,
    );
  }
  return basket.id;
}

beforeAll(async () => {
  auditBasketId = await requireBasket('AUDIT');
});

afterEach(async () => {
  await afterEachCleanup();
  cryptoRandomUUIDSpy.mockReset();
  cryptoRandomUUIDSpy.mockImplementation(() => actualRandomUUID());
});

function basePayload(email: string, startAtIso: string) {
  return {
    name: 'Jan Testowy',
    email,
    phone: '500600700',
    address: 'Marszałkowska 1, Warszawa',
    startAtIso,
    triageData: { location: 'Dom jednorodzinny' },
  };
}

describe('saveLead — atomowość na żywym Postgresie (WO B2C-LEAD-ATOMIC, AC2/AC5)', () => {
  // @REQ: B2C-LEAD-ATOMIC
  it(
    'AC2 — krok KLIENT: id kolidujący z istniejącym wierszem klienci (naruszenie PRIMARY KEY) -> success:false, ZERO nowego klienta/adresu/leada',
    async () => {
      const auditor = await createTestAuditor();
      cleanupAuditorIds.push(auditor.id);
      await createTestSaturdayRule(auditor.id, '08:00', '16:00');

      const email = testEmail('krok-klient');
      cleanupEmails.push(email);

      const collisionId = actualRandomUUID();
      await prisma.klienci.create({ data: { id: collisionId, email: 'kolidujacy@example.invalid' } });

      cryptoRandomUUIDSpy.mockReturnValueOnce(collisionId);

      const startAt = futureSaturday(8, '08:00');
      const result = await saveLead(basePayload(email, startAt.toISOString()));

      // NAPRAWA WYCIEKU (fix/b2c-savelead-error-leak): `saveLead` nie zwraca już treści
      // surowego błędu Prismy (mogła nieść PII/nazwy ograniczeń bazy) do niezalogowanego
      // klienta B2C — odpowiedź niesie WYŁĄCZNIE ustalony, bezpieczny kształt. Kolizja PK
      // na kroku klient/adres/lead nie jest jednym z rozpoznanych kodów domenowych
      // (BASKET_NOT_FOUND/SLOT_TAKEN/BOOKING_WRITE_REJECTED.*), więc trafia do zewnętrznego
      // catch-a jako `INTERNAL_ERROR`, `error` już nie istnieje w wyniku — WIĘC ten test już
      // nie może rozróżniać kroku KLIENT/ADRES/LEAD po treści `result`. Odróżnia je fixture
      // (wiersz kolidujący wstawiony na innym modelu) i `countByEmail` niżej — to jest
      // właściwy dowód atomowości, niezależny od treści komunikatu błędu.
      expect(result).toEqual({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie za chwilę.',
      });

      const counts = await countByEmail(email);
      expect(counts).toEqual({ klienci: 0, adresy: 0, leady: 0 });

      await prisma.klienci.deleteMany({ where: { id: collisionId } });
    },
    30000,
  );

  // @REQ: B2C-LEAD-ATOMIC
  it(
    'AC2 — krok ADRES: id kolidujący z istniejącym wierszem adresy (naruszenie PRIMARY KEY) -> success:false, ZERO nowego klienta/adresu/leada (rollback obejmuje krok klienta)',
    async () => {
      const auditor = await createTestAuditor();
      cleanupAuditorIds.push(auditor.id);
      await createTestSaturdayRule(auditor.id, '08:00', '16:00');

      const email = testEmail('krok-adres');
      cleanupEmails.push(email);

      const collisionId = actualRandomUUID();
      await prisma.adresy.create({ data: { id: collisionId, ulica_miasto: 'kolidujący' } });

      // Pierwsze wywołanie (klientId) — id prawdziwe, wygenerowane normalnie (wartość
      // ustalona TERAZ, synchronicznie, `mockReturnValueOnce` — NIE
      // `mockImplementationOnce(async () => ...)`: to drugie zwraca Promise jako wartość
      // klientId, którą Prisma odrzuca na kroku KLIENTA, więc kolizja adresu nigdy nie
      // zostałaby osiągnięta — BLOCKER 2, recenzja PR). Drugie (adresId) — kolidujące.
      // Trzecie i dalsze (leadId, jeśli implementacja próbowałaby kontynuować mimo błędu
      // klienta/adresu — nie powinna) — normalne (domyślny `mockImplementation`).
      cryptoRandomUUIDSpy
        .mockReturnValueOnce(actualRandomUUID())
        .mockReturnValueOnce(collisionId);

      const startAt = futureSaturday(9, '08:00');
      const result = await saveLead(basePayload(email, startAt.toISOString()));

      // NAPRAWA WYCIEKU (fix/b2c-savelead-error-leak) — patrz komentarz w teście „krok
      // KLIENT" powyżej: `result` już nie niesie treści surowego błędu Prismy, więc nie da
      // się nim odróżnić kroku ADRES od kroku KLIENT (dawny cel BLOCKERA 2). Ten test nadal
      // dowodzi czegoś innego niż „krok KLIENT": fixture wstawia kolidujący wiersz na
      // `adresy` (nie `klienci`) i wymusza kolizję DOPIERO na DRUGIM wywołaniu
      // `randomUUID()` — czyli sprawdza inny punkt w kodzie (rollback po nieudanym kroku
      // adresu, nie tylko klienta), nawet jeśli finalna asercja na wyniku jest identyczna.
      expect(result).toEqual({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie za chwilę.',
      });

      const counts = await countByEmail(email);
      expect(counts).toEqual({ klienci: 0, adresy: 0, leady: 0 });

      await prisma.adresy.deleteMany({ where: { id: collisionId } });
    },
    30000,
  );

  // @REQ: B2C-LEAD-ATOMIC
  it(
    'AC2 — krok LEAD: id kolidujący z istniejącym wierszem leady (naruszenie PRIMARY KEY) -> success:false, ZERO nowego klienta/adresu/leada (rollback obejmuje kroki klienta i adresu)',
    async () => {
      const auditor = await createTestAuditor();
      cleanupAuditorIds.push(auditor.id);
      await createTestSaturdayRule(auditor.id, '08:00', '16:00');

      const email = testEmail('krok-lead');
      cleanupEmails.push(email);

      const collisionId = actualRandomUUID();
      await prisma.leady.create({ data: { id: collisionId } });

      // Trzy wartości ustalone TERAZ, synchronicznie (patrz komentarz w teście „krok
      // ADRES" — BLOCKER 2): klientId i adresId prawdziwe, leadId kolidujące.
      cryptoRandomUUIDSpy
        .mockReturnValueOnce(actualRandomUUID())
        .mockReturnValueOnce(actualRandomUUID())
        .mockReturnValueOnce(collisionId);

      const startAt = futureSaturday(10, '08:00');
      const result = await saveLead(basePayload(email, startAt.toISOString()));

      // NAPRAWA WYCIEKU (fix/b2c-savelead-error-leak) — patrz komentarz w teście „krok
      // KLIENT" powyżej: `result` już nie niesie treści surowego błędu Prismy, więc nie da
      // się nim odróżnić kroku LEAD od kroków KLIENT/ADRES (dawny cel BLOCKERA 2). Ten test
      // nadal dowodzi czegoś innego: fixture wstawia kolidujący wiersz na `leady` i wymusza
      // kolizję DOPIERO na TRZECIM wywołaniu `randomUUID()` — sprawdza rollback po nieudanym
      // kroku leada (klient i adres muszą się cofnąć), inny punkt w kodzie niż poprzednie dwa
      // testy, nawet jeśli finalna asercja na wyniku jest identyczna.
      expect(result).toEqual({
        success: false,
        code: 'INTERNAL_ERROR',
        message: 'Wystąpił nieoczekiwany błąd. Spróbuj ponownie za chwilę.',
      });

      const counts = await countByEmail(email);
      expect(counts).toEqual({ klienci: 0, adresy: 0, leady: 0 });

      await prisma.leady.deleteMany({ where: { id: collisionId } });
    },
    30000,
  );

  // @REQ: B2C-LEAD-ATOMIC
  it(
    'AC5 — pula JEDNOOSOBOWA: dwaj klienci B2C RÓWNOLEGLE na TEN SAM termin -> dokładnie jeden sukces; przegrany ma ZERO nowego klienta/adresu/leada (dziś, przed tym WO, zostawały trzy)',
    async () => {
      const auditor = await createTestAuditor();
      cleanupAuditorIds.push(auditor.id);
      await createTestSaturdayRule(auditor.id, '08:00', '16:00');

      const emailA = testEmail('race-pool1-a');
      const emailB = testEmail('race-pool1-b');
      cleanupEmails.push(emailA, emailB);

      const startAt = futureSaturday(11, '08:00');

      const [resultA, resultB] = await Promise.all([
        saveLead(basePayload(emailA, startAt.toISOString())),
        saveLead(basePayload(emailB, startAt.toISOString())),
      ]);

      const successes = [resultA, resultB].filter((r) => r.success);
      const failures = [resultA, resultB].filter((r) => !r.success);
      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);

      const countsA = await countByEmail(emailA);
      const countsB = await countByEmail(emailB);
      const winnerCounts = resultA.success ? countsA : countsB;
      const loserCounts = resultA.success ? countsB : countsA;

      expect(winnerCounts).toEqual({ klienci: 1, adresy: 1, leady: 1 });
      expect(loserCounts).toEqual({ klienci: 0, adresy: 0, leady: 0 });

      const rowsForThisSlot = await prisma.booking.count({
        where: { auditorId: auditor.id, scheduledStart: startAt, status: { in: ['RESERVED', 'CONFIRMED'] } },
      });
      expect(rowsForThisSlot).toBe(1);
    },
    30000,
  );

  // @REQ: B2C-LEAD-ATOMIC
  it(
    'AC5 — pula DWUOSOBOWA: dwaj klienci B2C RÓWNOLEGLE na TEN SAM termin -> OBIE rezerwacje się udają, na RÓŻNYCH pracownikach, w bazie jest dokładnie JEDEN komplet klient+adres+lead per żądanie (nie jeden za każdą wycofaną iterację)',
    async () => {
      const auditorOne = await createTestAuditor();
      const auditorTwo = await createTestAuditor();
      cleanupAuditorIds.push(auditorOne.id, auditorTwo.id);
      await createTestSaturdayRule(auditorOne.id, '08:00', '16:00');
      await createTestSaturdayRule(auditorTwo.id, '08:00', '16:00');

      const emailA = testEmail('race-pool2-a');
      const emailB = testEmail('race-pool2-b');
      cleanupEmails.push(emailA, emailB);

      const startAt = futureSaturday(12, '08:00');

      const [resultA, resultB] = await Promise.all([
        saveLead(basePayload(emailA, startAt.toISOString())),
        saveLead(basePayload(emailB, startAt.toISOString())),
      ]);

      expect(resultA.success).toBe(true);
      expect(resultB.success).toBe(true);

      const countsA = await countByEmail(emailA);
      const countsB = await countByEmail(emailB);
      // Dokładnie JEDEN komplet per żądanie — jeśli implementacja tworzyłaby nowy
      // klient/adres/lead PRZY KAŻDEJ wycofanej iteracji pętli kandydatów (a nie tylko
      // przy tej, która się ostatecznie zapisała), ta liczba byłaby > 1.
      expect(countsA).toEqual({ klienci: 1, adresy: 1, leady: 1 });
      expect(countsB).toEqual({ klienci: 1, adresy: 1, leady: 1 });

      const rowsForThisSlot = await prisma.booking.count({
        where: {
          auditorId: { in: [auditorOne.id, auditorTwo.id] },
          scheduledStart: startAt,
          status: { in: ['RESERVED', 'CONFIRMED'] },
        },
      });
      expect(rowsForThisSlot).toBe(2);
    },
    30000,
  );

  // @REQ: B2C-LEAD-ATOMIC
  it(
    'brzeg: podwójne kliknięcie „Umów" — dwa żądania SEKWENCYJNE z tymi samymi danymi kontaktowymi tworzą DWA niezależne, każde ATOMOWE komplety klient+adres+lead+rezerwacja (zachowanie nie zmienia się względem dziś: leadId jest nowy przy każdym wywołaniu, idempotencja formularza poza zakresem — WO, R-2)',
    async () => {
      const auditor = await createTestAuditor();
      cleanupAuditorIds.push(auditor.id);
      await createTestSaturdayRule(auditor.id, '08:00', '16:00');

      const email = testEmail('double-click');
      cleanupEmails.push(email);

      const firstStart = futureSaturday(13, '08:00');
      const secondStart = futureSaturday(13, '11:00');

      const first = await saveLead(basePayload(email, firstStart.toISOString()));
      const second = await saveLead(basePayload(email, secondStart.toISOString()));

      expect(first.success).toBe(true);
      expect(second.success).toBe(true);

      const counts = await countByEmail(email);
      expect(counts).toEqual({ klienci: 2, adresy: 2, leady: 2 });
    },
    30000,
  );
});
