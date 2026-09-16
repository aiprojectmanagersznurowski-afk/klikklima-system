import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { fromZonedTime } from 'date-fns-tz';
import { prisma } from '@repo/database';

/**
 * WO: docs/workorders/B2C-BOOKING-SLOT.md (wersja 2, rozstrzygnięta 2026-09-14) — AC1,
 * AC4, przypadek brzegowy "współbieżność między ścieżkami", "idempotencja / podwójne
 * kliknięcie" i "granica przedziału [start, end)".
 *
 * Wzorzec 1:1 z `apps/b2b-web/tests/create-booking-concurrency.itest.ts` (przeczytany
 * w całości przed napisaniem tego pliku) — ta sama konwencja `*.itest.ts`, ten sam
 * `requireBasket`, ta sama decyzja projektowa "dzień testu to SOBOTA (ISODOW 6)" (żeby
 * `default_weekdays` [1,2,3,4,5] nie wciągnął fail-open innych audytorów istniejących
 * w bazie lokalnej, patrz uzasadnienie w pliku b2b — nie powielam go tu w całości).
 *
 * RÓŻNICA względem b2b: tam `createBooking` jest wołane wyłącznie z
 * `bookedBy: 'DISPATCHER'` (ścieżka panelu). Tu dowodzimy DODATKOWO: (1) że to samo
 * zachowanie utrzymuje się dla `bookedBy: 'CLIENT'` (ścieżka B2C, AC1/AC4), (2) że
 * dwie ścieżki (klient B2C i dyspozytor panelu) rywalizujące o TEN SAM termin
 * respektują TO SAMO ograniczenie bazy (`bookings_no_overlap_per_resource`) — to jest
 * AC6 w praktyce: jedna funkcja domenowa, nie dwie kopie logiki.
 *
 * `createBooking` z `@repo/scheduling` JUŻ istnieje i już przyjmuje
 * `bookedBy: 'CLIENT' | 'DISPATCHER'` (FLD-BOOKING-ATOMIC-ASSIGN, DONE) — więc te testy
 * mogą, w zasadzie, przejść już DZIŚ na żywym Postgresie. To jest zamierzone: rejestr
 * mapuje K1/K3 -> AC1, K2/K4 -> AC4 na wprost tę samą funkcję domenową, którą
 * `B2C-BOOKING-SLOT` PONOWNIE WYKORZYSTUJE (nie odtwarza). Nowość w tym pliku to
 * dowód dla `bookedBy: 'CLIENT'` i dla scenariusza krzyżowego, których b2b itest nie
 * pokrywał. W tym środowisku (brak Dockera) ten plik i tak zostanie odrzucony przez
 * `tools/vitest-integration-db-guard.mjs`, zanim dojdzie do wykonania — weryfikacja
 * realnego przebiegu zostaje jobowi `integracja` / lokalnemu `supabase start`.
 */

const TIME_ZONE = 'Europe/Warsaw';
const MS_PER_MINUTE = 60000;

function localMoment(dateStr: string, hhmm: string): Date {
  return fromZonedTime(`${dateStr}T${hhmm}:00`, TIME_ZONE);
}

function timeOfDay(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00.000Z`);
}

/**
 * Sobota WZGLĘDNA do prawdziwego "teraz" w chwili wykonania, nigdy zaszyty literał
 * kalendarzowy — inaczej `findAvailableSlots`/`createBooking` (CAL-SLOT-ENGINE, filtr
 * `start < nowMs` na rzeczywistym zegarze systemowym w tym pliku `.itest.ts`, BEZ
 * mockowania `now`) odrzuca cały slot jako `SLOT_NOT_OFFERED` zanim test dotrze do
 * scenariusza współbieżności, który miał sprawdzić. `weeksFromNow` przesuwa najpierw o
 * pełne tygodnie (żeby data była odpowiednio odległa i testy pozostały niezależne), a
 * następnie dociąga do NAJBLIŻSZEJ soboty NIE WCZEŚNIEJSZEJ niż ten punkt — czyli wynik
 * jest zawsze w przyszłości względem `new Date()` w momencie wywołania, niezależnie od
 * tego, kiedy CI faktycznie uruchomi ten plik.
 */
function futureSaturday(weeksFromNow: number, hhmm: string): Date {
  const base = new Date();
  base.setUTCDate(base.getUTCDate() + weeksFromNow * 7);
  const day = base.getUTCDay(); // 0=niedziela … 6=sobota
  const diffToSaturday = (6 - day + 7) % 7;
  base.setUTCDate(base.getUTCDate() + diffToSaturday);
  const dateStr = base.toISOString().slice(0, 10);
  return localMoment(dateStr, hhmm);
}

let createdAuditorIds: string[] = [];
let createdLeadIds: string[] = [];

async function createTestAuditor(): Promise<{ id: string }> {
  const suffix = randomUUID();
  const auditor = await prisma.audytorzy.create({
    data: {
      imie_i_nazwisko: `ITEST B2C-BOOKING-SLOT ${suffix}`,
      email: `itest-b2c-booking-slot-${suffix}@example.invalid`,
      is_active: true,
      leave_status: 'ACTIVE',
    },
  });
  createdAuditorIds.push(auditor.id);
  return auditor;
}

async function createTestSaturdayRule(auditorId: string, start: string, end: string): Promise<void> {
  await prisma.availabilityRule.create({
    data: {
      auditorId,
      weekday: 6, // ISODOW: sobota
      startTime: timeOfDay(start),
      endTime: timeOfDay(end),
      isActive: true,
    },
  });
}

async function createTestLead(): Promise<{ id: string }> {
  const lead = await prisma.leady.create({ data: {} });
  createdLeadIds.push(lead.id);
  return lead;
}

afterEach(async () => {
  if (createdLeadIds.length > 0) {
    await prisma.booking.deleteMany({ where: { leadId: { in: createdLeadIds } } });
  }
  if (createdAuditorIds.length > 0) {
    await prisma.booking.deleteMany({ where: { auditorId: { in: createdAuditorIds } } });
    await prisma.availabilityRule.deleteMany({ where: { auditorId: { in: createdAuditorIds } } });
    await prisma.audytorzy.deleteMany({ where: { id: { in: createdAuditorIds } } });
  }
  if (createdLeadIds.length > 0) {
    await prisma.leady.deleteMany({ where: { id: { in: createdLeadIds } } });
  }
  createdAuditorIds = [];
  createdLeadIds = [];
});

const { createBooking, findPoolSlots } = await import('@repo/scheduling');

let auditBasketId: string;

async function requireBasket(code: string): Promise<string> {
  const basket = await prisma.visitDurationBasket.findFirst({ where: { code, isActive: true } });
  if (!basket) {
    throw new Error(
      `Koszyk '${code}' nie istnieje na tej bazie — migracja seedująca nie została zaaplikowana. ` +
        'Uruchom `supabase start` w katalogu repo przed `npm run test:integration`.',
    );
  }
  return basket.id;
}

beforeAll(async () => {
  auditBasketId = await requireBasket('AUDIT');
});

describe('createBooking na ścieżce B2C — B2C-BOOKING-SLOT AC1/AC4, żywy Postgres', () => {
  // @REQ: B2C-BOOKING-SLOT
  it(
    'AC1/AC4 — pula JEDNOOSOBOWA, DWA klienci B2C RÓWNOLEGLE na ten sam termin: dokładnie jedno ok:true, jedno SLOT_TAKEN z niepustymi alternatywami, bez wycieku SQLSTATE',
    async () => {
      const auditor = await createTestAuditor();
      await createTestSaturdayRule(auditor.id, '08:00', '16:00');
      const leadA = await createTestLead();
      const leadB = await createTestLead();

      const startAt = futureSaturday(4, '08:00'); // sobota, względna do "teraz"

      const [resultA, resultB] = await Promise.all([
        createBooking({
          visitBasketId: auditBasketId,
          startAt,
          subject: { kind: 'LEAD', leadId: leadA.id },
          bookedBy: 'CLIENT',
        }),
        createBooking({
          visitBasketId: auditBasketId,
          startAt,
          subject: { kind: 'LEAD', leadId: leadB.id },
          bookedBy: 'CLIENT',
        }),
      ]);

      const outcomes = [resultA, resultB];
      const successes = outcomes.filter((r) => r.ok);
      const failures = outcomes.filter((r) => !r.ok);

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
      if (failures[0]!.ok) throw new Error('unreachable');

      // AC4 — kod domenowy SLOT_TAKEN ALBO SLOT_NOT_OFFERED, NIGDY SUBJECT_ALREADY_BOOKED
      // (dwa różne podmioty — przypadek brzegowy "idempotencja / podwójne kliknięcie", D-6
      // wariant (a) — to rozróżnienie jest istotą AC4 i zostaje bez zmian).
      //
      // Oba pierwsze kody są RÓWNOWAŻNYM dowodem tej samej właściwości domenowej, różnym
      // tylko etapem, na którym przegrany odkrył porażkę — `createBooking` (packages/
      // scheduling/src/create-booking.ts) najpierw woła `findAvailableSlots` (same SELECT-y,
      // BEZ blokady/`FOR UPDATE`), a rywalizacja realna zaczyna się dopiero na
      // `prisma.booking.create()`. `Promise.all` gwarantuje jedynie wspólny start w tym samym
      // ticku JS — NIE gwarantuje, że odpowiadające zapytania SQL trafią do Postgresa w tym
      // samym momencie. Jeśli zwycięzca zdąży w pełni zacommitować swój `INSERT` PRZED tym,
      // jak przegrany wykona swój `findAvailableSlots`, przegrany zobaczy `candidates.length
      // === 0` i dostanie `SLOT_NOT_OFFERED` (silnik nie ma tu błędu — to prawidłowa
      // odpowiedź "ten termin już nie jest wolny", odkryta wcześniej niż na etapie INSERT-u).
      // Jeśli obie strony zdążą dotrzeć do `INSERT`-u, o wyniku rozstrzyga ograniczenie
      // `bookings_no_overlap_per_resource` i przegrany dostaje `SLOT_TAKEN` — tak samo
      // nondeterministyczne jak rozróżnienie 23P01/40P01 opisane w komentarzu przy
      // `extractSqlState` w `create-booking.ts`. Zaakceptowane oba, bo test dowodzi
      // WŁAŚCIWOŚCI DOMENOWEJ ("drugie żądanie na ten sam termin nie może się powtórnie
      // udać"), nie DOKŁADNEGO ETAPU wykrycia — na tym etapie nie da się go kontrolować z
      // poziomu testu bez wstrzykiwania opóźnień do silnika, co jest zakazane
      // (implementer-server, nie test-author, jest właścicielem `create-booking.ts`).
      expect(['SLOT_TAKEN', 'SLOT_NOT_OFFERED']).toContain(failures[0]!.error.code);
      expect(failures[0]!.error.alternatives.length).toBeGreaterThan(0);

      const serializedError = JSON.stringify(failures[0]!.error);
      expect(serializedError).not.toMatch(/23P01|23505|EXCLUDE|constraint/i);

      const rowsForThisSlot = await prisma.booking.count({
        where: { auditorId: auditor.id, scheduledStart: startAt, status: { in: ['RESERVED', 'CONFIRMED'] } },
      });
      expect(rowsForThisSlot).toBe(1);

      if (!successes[0]!.ok) throw new Error('unreachable');
      expect(successes[0]!.booking.bookedBy).toBe('CLIENT');
    },
    30000,
  );

  // @REQ: B2C-BOOKING-SLOT
  it(
    'współbieżność między ścieżkami — klient B2C (bookedBy=CLIENT) i dyspozytor panelu (bookedBy=DISPATCHER) na ten sam termin: dokładnie jeden wygrywa, ZWYCIĘZCA ma bookedBy zgodny z własnym żądaniem',
    async () => {
      const auditor = await createTestAuditor();
      await createTestSaturdayRule(auditor.id, '08:00', '16:00');
      const leadClient = await createTestLead();
      const leadDispatcher = await createTestLead();

      const startAt = futureSaturday(5, '08:00'); // inna sobota — testy niezależne, względna do "teraz"

      const [clientResult, dispatcherResult] = await Promise.all([
        createBooking({
          visitBasketId: auditBasketId,
          startAt,
          subject: { kind: 'LEAD', leadId: leadClient.id },
          bookedBy: 'CLIENT',
        }),
        createBooking({
          visitBasketId: auditBasketId,
          startAt,
          subject: { kind: 'LEAD', leadId: leadDispatcher.id },
          bookedBy: 'DISPATCHER',
        }),
      ]);

      const outcomes = [clientResult, dispatcherResult];
      expect(outcomes.filter((r) => r.ok)).toHaveLength(1);
      expect(outcomes.filter((r) => !r.ok)).toHaveLength(1);

      // Przegrany dostaje SLOT_TAKEN ALBO SLOT_NOT_OFFERED — patrz uzasadnienie przy teście
      // AC1/AC4 powyżej (ten sam `Promise.all` bez blokady na odczycie w `createBooking`,
      // ta sama nondeterministyczna granica między "przegrał na SELECT-cie" i "przegrał na
      // INSERT-cie"). Rozróżnienie, które NIE jest tu zniesione: przegrany NIGDY nie dostaje
      // SUBJECT_ALREADY_BOOKED — to są dwa różne podmioty (leadClient/leadDispatcher).
      if (clientResult.ok) {
        expect(clientResult.booking.bookedBy).toBe('CLIENT');
        expect(clientResult.booking.leadId).toBe(leadClient.id);
      } else {
        expect(['SLOT_TAKEN', 'SLOT_NOT_OFFERED']).toContain(clientResult.error.code);
      }

      if (dispatcherResult.ok) {
        expect(dispatcherResult.booking.bookedBy).toBe('DISPATCHER');
        expect(dispatcherResult.booking.leadId).toBe(leadDispatcher.id);
      } else {
        expect(['SLOT_TAKEN', 'SLOT_NOT_OFFERED']).toContain(dispatcherResult.error.code);
      }

      const rowsForThisSlot = await prisma.booking.count({
        where: { auditorId: auditor.id, scheduledStart: startAt, status: { in: ['RESERVED', 'CONFIRMED'] } },
      });
      expect(rowsForThisSlot).toBe(1);
    },
    30000,
  );

  // @REQ: B2C-BOOKING-SLOT
  it(
    'brzeg: granica przedziału [start, end) — druga rezerwacja klienta B2C u TEGO SAMEGO audytora dokładnie na koniec pierwszej (uwzględniając bufor dojazdu z scheduling_config) jest dozwolona',
    async () => {
      const auditor = await createTestAuditor();
      await createTestSaturdayRule(auditor.id, '08:00', '16:00');
      const leadA = await createTestLead();
      const leadB = await createTestLead();

      const firstStart = futureSaturday(6, '08:00'); // kolejna, niezależna sobota, względna do "teraz"

      const firstResult = await createBooking({
        visitBasketId: auditBasketId,
        startAt: firstStart,
        subject: { kind: 'LEAD', leadId: leadA.id },
        bookedBy: 'CLIENT',
      });
      expect(firstResult.ok).toBe(true);
      if (!firstResult.ok) throw new Error('unreachable');

      // Nie zakładamy z góry wartości bufora — pytamy silnik o NASTĘPNY realnie
      // proponowany termin tej samej puli (fail-closed: jeśli bufor > 0, silnik go
      // uwzględni sam, nie odtwarzamy tej arytmetyki tutaj).
      const poolResult = await findPoolSlots(auditBasketId, {
        from: firstResult.booking.scheduledEnd,
        to: new Date(firstResult.booking.scheduledEnd.getTime() + 24 * 60 * MS_PER_MINUTE),
      });
      expect(poolResult.error).toBeNull();
      expect(poolResult.slots.length).toBeGreaterThan(0);

      const nextOfferedStart = poolResult.slots[0]!.start_at;

      const secondResult = await createBooking({
        visitBasketId: auditBasketId,
        startAt: nextOfferedStart,
        subject: { kind: 'LEAD', leadId: leadB.id },
        bookedBy: 'CLIENT',
      });

      expect(secondResult.ok).toBe(true);
      if (!secondResult.ok) throw new Error('unreachable');
      expect(secondResult.booking.auditorId).toBe(auditor.id);

      const rowsForAuditor = await prisma.booking.count({
        where: { auditorId: auditor.id, status: { in: ['RESERVED', 'CONFIRMED'] } },
      });
      expect(rowsForAuditor).toBe(2);
    },
    30000,
  );

  // @REQ: B2C-BOOKING-SLOT
  it(
    'brzeg: termin spoza zaproponowanej listy — klient B2C wysyła startAt, którego żaden audytor NIE oferuje (poza godzinami reguły dostępności): SLOT_NOT_OFFERED z niepustymi alternatywami',
    async () => {
      const auditor = await createTestAuditor();
      await createTestSaturdayRule(auditor.id, '08:00', '16:00');
      const lead = await createTestLead();

      // 20:00 jest POZA regułą 08:00-16:00 tego audytora, w tej samej sobocie (data
      // względna do "teraz" — patrz `futureSaturday`).
      const offeredHoursSaturday = futureSaturday(7, '20:00');

      const result = await createBooking({
        visitBasketId: auditBasketId,
        startAt: offeredHoursSaturday,
        subject: { kind: 'LEAD', leadId: lead.id },
        bookedBy: 'CLIENT',
      });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.error.code).toBe('SLOT_NOT_OFFERED');

      const rowsForAuditor = await prisma.booking.count({
        where: { auditorId: auditor.id, status: { in: ['RESERVED', 'CONFIRMED'] } },
      });
      expect(rowsForAuditor).toBe(0);
    },
    30000,
  );

  // @REQ: B2C-BOOKING-SLOT
  // @REQ: CAL-SLOT-ENGINE
  it(
    'brzeg: termin w przeszłości — klient B2C wysyła startAt sprzed "teraz": SLOT_NOT_OFFERED, nie rezerwacja',
    async () => {
      const auditor = await createTestAuditor();
      await createTestSaturdayRule(auditor.id, '08:00', '16:00');
      const lead = await createTestLead();

      // Sobota w PRZESZŁOŚCI względem "teraz" — literał ZAMIERZONY (nie `futureSaturday`):
      // zegar systemowy tylko idzie do przodu, więc ta data pozostanie przeszłością na
      // zawsze od chwili napisania tego testu (2026-09-14) i nie wymaga wyliczenia
      // względnego jak pozostałe przypadki w tym pliku.
      const pastSaturday = localMoment('2026-08-01', '08:00');

      const result = await createBooking({
        visitBasketId: auditBasketId,
        startAt: pastSaturday,
        subject: { kind: 'LEAD', leadId: lead.id },
        bookedBy: 'CLIENT',
      });

      expect(result.ok).toBe(false);
      if (result.ok) throw new Error('unreachable');
      expect(result.error.code).toBe('SLOT_NOT_OFFERED');
    },
    30000,
  );
});
