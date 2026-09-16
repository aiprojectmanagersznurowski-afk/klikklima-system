import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { fromZonedTime } from 'date-fns-tz';
import { prisma } from '@repo/database';

/**
 * WO: docs/workorders/FLD-BOOKING-ATOMIC-ASSIGN.md — AC-A4/AC-A5, JEDYNE dwa kryteria Fazy A
 * które dowodzą coś na temat prawdziwej współbieżności (ograniczenie
 * `bookings_no_overlap_per_resource`, EXCLUDE USING gist). Atrapa Prismy w
 * `create-booking.test.ts` NIE MOŻE zaliczyć tych kryteriów — dowodzi wyłącznie tego, jak
 * mock został zaprogramowany (WO, D-2).
 *
 * D-2 (decyzja Michała 2026-09-10): infrastruktura CI z Postgresem jest zbudowana.
 * Konwencja repo: `*.itest.ts` → `vitest.integration.config.mts` (root repo, `fileParallelism:
 * false`, BEZ `passWithNoTests`), uruchamiane `npm run test:integration` z katalogu repo
 * (poziom wyżej niż `apps/`). Lokalnie wymaga `supabase start` (aplikuje WSZYSTKIE migracje
 * z `supabase/migrations/` automatycznie, w tym `20260910100000_fld_calendar_foundation.sql`,
 * która zawiera SEED `visit_duration_baskets` i `system_config.scheduling_config` — więc ten
 * plik może po prostu ODCZYTAĆ koszyk 'AUDIT' i konfigurację bufora, nie tworzyć ich).
 *
 * PROJEKTOWA DECYZJA — dobowy dzień testu to SOBOTA (ISODOW 6), NIE dzień roboczy:
 * `system_config.scheduling_config.default_weekdays` na żywo (i w migracji seedującej) to
 * [1,2,3,4,5] — jeżeli test użyłby dnia roboczego, KAŻDY inny audytor już istniejący w bazie
 * lokalnej (nawet bez własnej reguły) dostałby fail-open domyślną dostępność 08:00-16:00
 * (FLD-AVAIL-WEEKLY-RULES, AC-B4) i wliczyłby się do puli — łamiąc premisę „pula
 * jednoosobowa/dwuosobowa" bez żadnej kontroli z tej strony testu. Sobota nie jest w
 * `default_weekdays`, więc TYLKO audytorzy z WŁASNĄ, jawną regułą na weekday=6 są
 * kandydatami — a te tworzy wyłącznie ten plik, z unikalnym `email`/`imie_i_nazwisko`.
 * Rezydualne ryzyko: istniejący w bazie audytor z własną regułą sobotnią na TĘ SAMĄ godzinę
 * — akceptowane jako mało prawdopodobne w danych testowych/deweloperskich, nie do wyeliminowania
 * bez zmiany schematu.
 *
 * Sprzątanie (WO, "Zadanie 2"): każdy test tworzy własnych audytorów/reguły/leady/rezerwacje
 * i czyści je w `afterEach`, w kolejności bezpiecznej dla FK (`bookings.auditor_id` jest
 * `ON DELETE RESTRICT` — rezerwacje MUSZĄ zniknąć przed audytorem).
 */

const TIME_ZONE = 'Europe/Warsaw';
const MS_PER_MINUTE = 60000;

function localMoment(dateStr: string, hhmm: string): Date {
  return fromZonedTime(`${dateStr}T${hhmm}:00`, TIME_ZONE);
}

function timeOfDay(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00.000Z`);
}

let createdAuditorIds: string[] = [];
let createdCrewIds: string[] = [];
let createdLeadIds: string[] = [];

async function createTestCrew(): Promise<{ id: string }> {
  const suffix = randomUUID();
  const crew = await prisma.zespoly_monterskie.create({
    data: {
      nazwa: `ITEST FLD-BOOKING-ATOMIC-ASSIGN ${suffix}`,
    },
  });
  createdCrewIds.push(crew.id);
  return crew;
}

async function createTestAuditor(): Promise<{ id: string }> {
  const suffix = randomUUID();
  const auditor = await prisma.audytorzy.create({
    data: {
      imie_i_nazwisko: `ITEST FLD-BOOKING-ATOMIC-ASSIGN ${suffix}`,
      email: `itest-fld-booking-atomic-${suffix}@example.invalid`,
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
  // 1) bookings — muszą zniknąć PRZED audytorami (FK RESTRICT) i przed leadami (FK CASCADE,
  //    ale usuwamy jawnie, żeby nie zależeć od kaskady).
  if (createdLeadIds.length > 0) {
    await prisma.booking.deleteMany({ where: { leadId: { in: createdLeadIds } } });
  }
  if (createdAuditorIds.length > 0) {
    await prisma.booking.deleteMany({ where: { auditorId: { in: createdAuditorIds } } });
    // 2) reguły dostępności (FK CASCADE z audytora — usuwane jawnie z tego samego powodu).
    await prisma.availabilityRule.deleteMany({ where: { auditorId: { in: createdAuditorIds } } });
    // 3) audytorzy testowi.
    await prisma.audytorzy.deleteMany({ where: { id: { in: createdAuditorIds } } });
  }
  if (createdCrewIds.length > 0) {
    // Rezerwacje testów bezpośredniego INSERT (bypass silnika) na ekipach — analogiczne
    // FK RESTRICT jak przy audytorach, sprzątamy jawnie zanim usuniemy ekipę.
    await prisma.booking.deleteMany({ where: { crewId: { in: createdCrewIds } } });
    await prisma.zespoly_monterskie.deleteMany({ where: { id: { in: createdCrewIds } } });
  }
  // 4) leady testowe.
  if (createdLeadIds.length > 0) {
    await prisma.leady.deleteMany({ where: { id: { in: createdLeadIds } } });
  }
  createdAuditorIds = [];
  createdCrewIds = [];
  createdLeadIds = [];
});

const { createBooking, extractSqlState } = await import('@repo/scheduling');

let auditBasketId: string;
let installStandardBasketId: string;
let incidentBasketId: string;

async function requireBasket(code: string): Promise<string> {
  // Koszyki są SEEDOWANE przez migrację `20260910100000_fld_calendar_foundation.sql` —
  // czytamy, nie tworzymy (WO, "Zadanie 2": "sprawdź (...) czy trzeba wypełnić tylko to, co
  // NOT NULL wymaga" — tu nic nie trzeba wypełniać, koszyki już istnieją na każdym stacku,
  // który aplikuje migracje z repo, w tym lokalny `supabase start`).
  const basket = await prisma.visitDurationBasket.findFirst({ where: { code, isActive: true } });
  if (!basket) {
    throw new Error(
      `Koszyk '${code}' nie istnieje na tej bazie — migracja 20260910100000_fld_calendar_foundation.sql ` +
        'nie została zaaplikowana. Uruchom `supabase start` w katalogu repo przed `npm run test:integration`.',
    );
  }
  return basket.id;
}

beforeAll(async () => {
  auditBasketId = await requireBasket('AUDIT');
  installStandardBasketId = await requireBasket('INSTALL_STANDARD');
  incidentBasketId = await requireBasket('INCIDENT');
});

describe('createBooking — współbieżność na żywym Postgresie, FLD-BOOKING-ATOMIC-ASSIGN AC-A4/AC-A5', () => {
  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it(
    'AC-A4 — pula JEDNOOSOBOWA: dwa RÓWNOLEGŁE żądania na ten sam slot -> dokładnie jedno ok:true, jedno ok:false/SLOT_TAKEN, w bazie zostaje JEDEN wiersz',
    async () => {
      const auditor = await createTestAuditor();
      await createTestSaturdayRule(auditor.id, '08:00', '16:00');
      const leadA = await createTestLead();
      const leadB = await createTestLead();

      const startAt = localMoment('2026-11-21', '08:00'); // sobota

      // Promise.all, NIE await sekwencyjny (WO, AC-A4: "wywołanie sekwencyjne nie zalicza") —
      // dwa żądania startują naprawdę równolegle, nie jedno po drugim.
      const [resultA, resultB] = await Promise.all([
        createBooking({
          visitBasketId: auditBasketId,
          startAt,
          subject: { kind: 'LEAD', leadId: leadA.id },
          bookedBy: 'DISPATCHER',
        }),
        createBooking({
          visitBasketId: auditBasketId,
          startAt,
          subject: { kind: 'LEAD', leadId: leadB.id },
          bookedBy: 'DISPATCHER',
        }),
      ]);

      const outcomes = [resultA, resultB];
      const successes = outcomes.filter((r) => r.ok);
      const failures = outcomes.filter((r) => !r.ok);

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
      if (failures[0]!.ok) throw new Error('unreachable');
      // Oba kody są RÓWNOWAŻNYM dowodem tej samej właściwości domenowej, różnym tylko
      // etapem, na którym przegrany odkrył porażkę — `createBooking` (packages/scheduling/
      // src/create-booking.ts) najpierw woła `findAvailableSlots` (same SELECT-y, BEZ
      // blokady/`FOR UPDATE`), a rywalizacja realna zaczyna się dopiero na
      // `prisma.booking.create()`. `Promise.all` gwarantuje jedynie wspólny start w tym
      // samym ticku JS — NIE gwarantuje, że odpowiadające zapytania SQL trafią do
      // Postgresa w tym samym momencie. Jeśli zwycięzca zdąży w pełni zacommitować swój
      // `INSERT` PRZED tym, jak przegrany wykona swój `findAvailableSlots`, przegrany
      // zobaczy `candidates.length === 0` i dostanie `SLOT_NOT_OFFERED` (silnik nie ma tu
      // błędu — to prawidłowa odpowiedź "ten termin już nie jest wolny", odkryta wcześniej
      // niż na etapie INSERT-u). Jeśli obie strony zdążą dotrzeć do `INSERT`-u, o wyniku
      // rozstrzyga ograniczenie `bookings_no_overlap_per_resource` i przegrany dostaje
      // `SLOT_TAKEN`. Zaakceptowane oba, bo test dowodzi WŁAŚCIWOŚCI DOMENOWEJ ("drugie
      // żądanie na ten sam termin nie może się powtórnie udać"), nie DOKŁADNEGO ETAPU
      // wykrycia — patrz identyczny wzorzec i uzasadnienie w
      // `apps/b2c-web/tests/actions/booking-concurrency.itest.ts`, AC1/AC4.
      expect(['SLOT_TAKEN', 'SLOT_NOT_OFFERED']).toContain(failures[0]!.error.code);

      const rowsForThisSlot = await prisma.booking.count({
        where: {
          auditorId: auditor.id,
          scheduledStart: startAt,
          status: { in: ['RESERVED', 'CONFIRMED'] },
        },
      });
      expect(rowsForThisSlot).toBe(1);
    },
    30000,
  );

  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it(
    'AC-A5 — pula DWUOSOBOWA: dwa RÓWNOLEGŁE żądania na ten sam slot -> OBIE rezerwacje się udają, na RÓŻNYCH pracownikach',
    async () => {
      const auditorOne = await createTestAuditor();
      const auditorTwo = await createTestAuditor();
      await createTestSaturdayRule(auditorOne.id, '08:00', '16:00');
      await createTestSaturdayRule(auditorTwo.id, '08:00', '16:00');
      const leadA = await createTestLead();
      const leadB = await createTestLead();

      const startAt = localMoment('2026-11-28', '08:00'); // inna sobota — testy niezależne

      const [resultA, resultB] = await Promise.all([
        createBooking({
          visitBasketId: auditBasketId,
          startAt,
          subject: { kind: 'LEAD', leadId: leadA.id },
          bookedBy: 'DISPATCHER',
        }),
        createBooking({
          visitBasketId: auditBasketId,
          startAt,
          subject: { kind: 'LEAD', leadId: leadB.id },
          bookedBy: 'DISPATCHER',
        }),
      ]);

      expect(resultA.ok).toBe(true);
      expect(resultB.ok).toBe(true);
      if (!resultA.ok || !resultB.ok) throw new Error('unreachable');

      const auditorIdA = resultA.booking.auditorId ?? resultA.booking['auditor_id'];
      const auditorIdB = resultB.booking.auditorId ?? resultB.booking['auditor_id'];
      expect(auditorIdA).not.toBe(auditorIdB);
      expect([auditorOne.id, auditorTwo.id]).toContain(auditorIdA);
      expect([auditorOne.id, auditorTwo.id]).toContain(auditorIdB);

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

  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it(
    'ograniczenie zabrania NAKŁADANIA SIĘ przedziałów, nie tylko identycznego startu — montaż całodniowy od 08:00 blokuje usterkę od 10:00 u TEJ SAMEJ ekipy',
    async () => {
      // Test celuje wyłącznie w `bookings_no_overlap_per_resource` (EXCLUDE USING gist), nie
      // w algorytm doboru wykonawcy z `createBooking` — `findAvailableSlots` odfiltrowałby tę
      // ekipę PRZED próbą zapisu drugiej rezerwacji (WO), więc oba wiersze wstawiamy
      // bezpośrednio przez `prisma.booking.create()`, z pominięciem warstwy domenowej.
      const crew = await createTestCrew();
      const leadA = await createTestLead();
      const leadB = await createTestLead();

      const installStart = localMoment('2026-11-23', '08:00');
      const installEnd = new Date(installStart.getTime() + 480 * MS_PER_MINUTE);

      await prisma.booking.create({
        data: {
          leadId: leadA.id,
          crewId: crew.id,
          resourceKind: 'CREW',
          visitBasketId: installStandardBasketId,
          scheduledStart: installStart,
          scheduledEnd: installEnd,
          status: 'RESERVED',
          bookedBy: 'DISPATCHER',
          assignmentMode: 'AUTO',
        },
      });

      // 10:00 NIE jest identyczny start z 08:00 — łapie go WYŁĄCZNIE ograniczenie nakładania
      // się przedziałów, nie zwykły UNIQUE(pracownik, godzina startu).
      const incidentStart = localMoment('2026-11-23', '10:00');
      const incidentEnd = new Date(incidentStart.getTime() + 120 * MS_PER_MINUTE);

      let thrown: unknown = null;
      try {
        await prisma.booking.create({
          data: {
            leadId: leadB.id,
            crewId: crew.id,
            resourceKind: 'CREW',
            visitBasketId: incidentBasketId,
            scheduledStart: incidentStart,
            scheduledEnd: incidentEnd,
            status: 'RESERVED',
            bookedBy: 'DISPATCHER',
            assignmentMode: 'AUTO',
          },
        });
      } catch (err) {
        thrown = err;
      }

      expect(thrown).not.toBeNull();
      expect(extractSqlState(thrown)).toBe('23P01');

      const activeRowsForCrew = await prisma.booking.count({
        where: { crewId: crew.id, status: { in: ['RESERVED', 'CONFIRMED'] } },
      });
      expect(activeRowsForCrew).toBe(1);
    },
    30000,
  );

  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it(
    'styk godzinowy NIE jest kolizją — wizyta 08:00–10:00 i wizyta 10:00–12:00 u TEJ SAMEJ osoby przechodzą OBIE',
    async () => {
      // Dowód właściwości ograniczenia bazy (przedział `[)`), nie algorytmu doboru wykonawcy —
      // bezpośredni `prisma.booking.create()`, z pominięciem warstwy domenowej.
      const auditor = await createTestAuditor();
      const leadA = await createTestLead();
      const leadB = await createTestLead();

      const firstStart = localMoment('2026-11-24', '08:00');
      const firstEnd = new Date(firstStart.getTime() + 120 * MS_PER_MINUTE); // AUDIT = 120 min -> 10:00

      const bookingA = await prisma.booking.create({
        data: {
          leadId: leadA.id,
          auditorId: auditor.id,
          resourceKind: 'AUDITOR',
          visitBasketId: auditBasketId,
          scheduledStart: firstStart,
          scheduledEnd: firstEnd,
          status: 'RESERVED',
          bookedBy: 'DISPATCHER',
          assignmentMode: 'AUTO',
        },
      });

      const secondStart = firstEnd; // dokładny styk: koniec pierwszej = start drugiej
      const secondEnd = new Date(secondStart.getTime() + 120 * MS_PER_MINUTE);

      const bookingB = await prisma.booking.create({
        data: {
          leadId: leadB.id,
          auditorId: auditor.id,
          resourceKind: 'AUDITOR',
          visitBasketId: auditBasketId,
          scheduledStart: secondStart,
          scheduledEnd: secondEnd,
          status: 'RESERVED',
          bookedBy: 'DISPATCHER',
          assignmentMode: 'AUTO',
        },
      });

      expect(bookingA.id).toBeTruthy();
      expect(bookingB.id).toBeTruthy();

      const activeRowsForAuditor = await prisma.booking.count({
        where: { auditorId: auditor.id, status: { in: ['RESERVED', 'CONFIRMED'] } },
      });
      expect(activeRowsForAuditor).toBe(2);
    },
    30000,
  );

  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it(
    'rezerwacja w statusie RELEASED nie blokuje slotu — nowa rezerwacja na TEN SAM slot u TEGO SAMEGO pracownika się udaje',
    async () => {
      // Ograniczenie jest CZĘŚCIOWE (WHERE status IN ('RESERVED','CONFIRMED')) — dowód na
      // bezpośrednim `prisma.booking.create()`, z pominięciem warstwy domenowej.
      const auditor = await createTestAuditor();
      const leadA = await createTestLead();
      const leadB = await createTestLead();

      const startAt = localMoment('2026-11-25', '08:00');
      const endAt = new Date(startAt.getTime() + 120 * MS_PER_MINUTE);

      await prisma.booking.create({
        data: {
          leadId: leadA.id,
          auditorId: auditor.id,
          resourceKind: 'AUDITOR',
          visitBasketId: auditBasketId,
          scheduledStart: startAt,
          scheduledEnd: endAt,
          status: 'RELEASED',
          bookedBy: 'DISPATCHER',
          assignmentMode: 'AUTO',
        },
      });

      const newBooking = await prisma.booking.create({
        data: {
          leadId: leadB.id,
          auditorId: auditor.id,
          resourceKind: 'AUDITOR',
          visitBasketId: auditBasketId,
          scheduledStart: startAt,
          scheduledEnd: endAt,
          status: 'RESERVED',
          bookedBy: 'DISPATCHER',
          assignmentMode: 'AUTO',
        },
      });

      expect(newBooking.id).toBeTruthy();
      expect(newBooking.status).toBe('RESERVED');
    },
    30000,
  );

  // @REQ: FLD-BOOKING-ATOMIC-ASSIGN
  it(
    'rezerwacja w statusie COMPLETED nie blokuje slotu — nowa rezerwacja na TEN SAM slot u TEGO SAMEGO pracownika się udaje',
    async () => {
      // Ograniczenie jest CZĘŚCIOWE (WHERE status IN ('RESERVED','CONFIRMED')) — dowód na
      // bezpośrednim `prisma.booking.create()`, z pominięciem warstwy domenowej.
      const auditor = await createTestAuditor();
      const leadA = await createTestLead();
      const leadB = await createTestLead();

      const startAt = localMoment('2026-11-26', '08:00');
      const endAt = new Date(startAt.getTime() + 120 * MS_PER_MINUTE);

      await prisma.booking.create({
        data: {
          leadId: leadA.id,
          auditorId: auditor.id,
          resourceKind: 'AUDITOR',
          visitBasketId: auditBasketId,
          scheduledStart: startAt,
          scheduledEnd: endAt,
          status: 'COMPLETED',
          bookedBy: 'DISPATCHER',
          assignmentMode: 'AUTO',
        },
      });

      const newBooking = await prisma.booking.create({
        data: {
          leadId: leadB.id,
          auditorId: auditor.id,
          resourceKind: 'AUDITOR',
          visitBasketId: auditBasketId,
          scheduledStart: startAt,
          scheduledEnd: endAt,
          status: 'RESERVED',
          bookedBy: 'DISPATCHER',
          assignmentMode: 'AUTO',
        },
      });

      expect(newBooking.id).toBeTruthy();
      expect(newBooking.status).toBe('RESERVED');
    },
    30000,
  );
});

/**
 * Domykanie FLD-BOOKING-ONE-ACTIVE-PER-SUBJECT (contracts/requirements.contract.mjs:687),
 * AC2/AC3/AC4 — jedyne trzy kryteria z tego wymagania które dowodzą właściwość SAMEGO
 * indeksu częściowego `bookings_one_active_per_subject` (a nie zachowania kodu, patrz
 * `apps/b2b-web/tests/booking-one-active-per-subject.test.ts` dla AC5/AC6 na atrapie).
 * AC1/AC8 spełnione wcześniej (contract-steward). AC7 jest kryterium meta, spełnionym samym
 * faktem, że te trzy testy są `*.itest.ts`, nie testami na atrapie.
 *
 * AC2 używa DOMENOWEJ funkcji `createBooking` (dowodzi, że kod rozróżnia 23505 od 23P01) —
 * AC3/AC4 bypassują warstwę domenową przez bezpośredni `prisma.booking.create/update` (dowód
 * właściwości SAMEGO ograniczenia, patrz `feedback_db_constraint_itest_bypass_domain`).
 */
describe('createBooking — FLD-BOOKING-ONE-ACTIVE-PER-SUBJECT AC2/AC3/AC4, żywy Postgres', () => {
  // @REQ: FLD-BOOKING-ONE-ACTIVE-PER-SUBJECT
  it(
    'AC2 — dwa RÓWNOLEGŁE żądania, TEN SAM podmiot, RÓŻNE sloty, pula DWUOSOBOWA -> dokładnie jeden sukces, przegrany dostaje SUBJECT_ALREADY_BOOKED (23505), NIE SLOT_TAKEN (23P01)',
    async () => {
      const auditorOne = await createTestAuditor();
      const auditorTwo = await createTestAuditor();
      await createTestSaturdayRule(auditorOne.id, '08:00', '16:00');
      await createTestSaturdayRule(auditorTwo.id, '08:00', '16:00');
      const lead = await createTestLead();

      // sobota nieużywana w innych testach tego pliku
      const startA = localMoment('2026-12-05', '08:00');
      // inny slot — AUDIT trwa 120 min (08:00-10:00), więc 11:00 nie nakłada się na startA,
      // niezależnie od tego, którego z dwóch audytorów wybierze silnik.
      const startB = localMoment('2026-12-05', '11:00');

      const [resultA, resultB] = await Promise.all([
        createBooking({
          visitBasketId: auditBasketId,
          startAt: startA,
          subject: { kind: 'LEAD', leadId: lead.id },
          bookedBy: 'DISPATCHER',
        }),
        createBooking({
          visitBasketId: auditBasketId,
          startAt: startB,
          subject: { kind: 'LEAD', leadId: lead.id },
          bookedBy: 'DISPATCHER',
        }),
      ]);

      const outcomes = [resultA, resultB];
      const successes = outcomes.filter((r) => r.ok);
      const failures = outcomes.filter((r) => !r.ok);

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
      if (failures[0]!.ok) throw new Error('unreachable');
      // Rdzeń AC2: przegrany MUSI dostać kod właściwy dla kolizji NA PODMIOCIE, nie kolizji
      // zasobu — różne sloty formalnie nie nakładają się na `bookings_no_overlap_per_resource`,
      // więc SLOT_TAKEN (23P01) byłby tu dowodem błędnego rozpoznania SQLSTATE.
      expect(failures[0]!.error.code).toBe('SUBJECT_ALREADY_BOOKED');

      const activeRowsForLead = await prisma.booking.count({
        where: { leadId: lead.id, status: { in: ['RESERVED', 'CONFIRMED'] } },
      });
      expect(activeRowsForLead).toBe(1);
    },
    30000,
  );

  // @REQ: FLD-BOOKING-ONE-ACTIVE-PER-SUBJECT
  it(
    'AC3 — CRM-BOOK-HISTORY nienaruszone: łańcuch przekładań (RELEASED, RELEASED, RESERVED) na tym samym podmiocie — WSZYSTKIE trzy INSERT-y się udają, bo w chwili każdego z nich podmiot nie ma innej aktywnej rezerwacji',
    async () => {
      // Dowód właściwości ograniczenia (indeks obejmuje wyłącznie RESERVED/CONFIRMED) —
      // bezpośredni `prisma.booking.create()`/`update()`, z pominięciem warstwy domenowej.
      const auditor = await createTestAuditor();
      const lead = await createTestLead();

      const start = localMoment('2026-11-27', '08:00');
      const end = new Date(start.getTime() + 120 * MS_PER_MINUTE);

      const bookingBase = {
        leadId: lead.id,
        auditorId: auditor.id,
        resourceKind: 'AUDITOR',
        visitBasketId: auditBasketId,
        scheduledStart: start,
        scheduledEnd: end,
        bookedBy: 'DISPATCHER',
        assignmentMode: 'AUTO',
      } as const;

      const first = await prisma.booking.create({ data: { ...bookingBase, status: 'RESERVED' } });
      expect(first.id).toBeTruthy();
      await prisma.booking.update({ where: { id: first.id }, data: { status: 'RELEASED' } });

      const second = await prisma.booking.create({ data: { ...bookingBase, status: 'RESERVED' } });
      expect(second.id).toBeTruthy();
      await prisma.booking.update({ where: { id: second.id }, data: { status: 'RELEASED' } });

      const third = await prisma.booking.create({ data: { ...bookingBase, status: 'RESERVED' } });
      expect(third.id).toBeTruthy();
      expect(third.status).toBe('RESERVED');

      const historyRowsForLead = await prisma.booking.count({ where: { leadId: lead.id } });
      expect(historyRowsForLead).toBe(3);

      const activeRowsForLead = await prisma.booking.count({
        where: { leadId: lead.id, status: { in: ['RESERVED', 'CONFIRMED'] } },
      });
      expect(activeRowsForLead).toBe(1);
    },
    30000,
  );

  // @REQ: FLD-BOOKING-ONE-ACTIVE-PER-SUBJECT
  it(
    'AC4 — indeks NIE jest odroczony: w jednej transakcji, kolejność ODWROTNA (najpierw INSERT nowej aktywnej rezerwacji, POTEM UPDATE starej na RELEASED) daje odmowę 23505, a cała transakcja się wycofuje',
    async () => {
      // Dowód właściwości ograniczenia (brak DEFERRABLE) — bezpośredni `prisma.$transaction`
      // z pominięciem warstwy domenowej (przełożenia w `createBooking` nie ma w zakresie tego
      // WO — dotyczy wyłącznie samego ograniczenia).
      const auditor = await createTestAuditor();
      const lead = await createTestLead();

      const oldStart = localMoment('2026-11-30', '08:00');
      const oldEnd = new Date(oldStart.getTime() + 120 * MS_PER_MINUTE);
      const oldBooking = await prisma.booking.create({
        data: {
          leadId: lead.id,
          auditorId: auditor.id,
          resourceKind: 'AUDITOR',
          visitBasketId: auditBasketId,
          scheduledStart: oldStart,
          scheduledEnd: oldEnd,
          status: 'RESERVED',
          bookedBy: 'DISPATCHER',
          assignmentMode: 'AUTO',
        },
      });

      const newStart = localMoment('2026-11-30', '13:00');
      const newEnd = new Date(newStart.getTime() + 120 * MS_PER_MINUTE);

      let thrown: unknown = null;
      try {
        await prisma.$transaction(async (tx) => {
          // KOLEJNOŚĆ ODWROTNA, ZAMIERZONA: INSERT nowej aktywnej PRZED zwolnieniem starej —
          // w chwili tego INSERT-u podmiot ma DWIE aktywne rezerwacje, co indeks musi odrzucić.
          await tx.booking.create({
            data: {
              leadId: lead.id,
              auditorId: auditor.id,
              resourceKind: 'AUDITOR',
              visitBasketId: auditBasketId,
              scheduledStart: newStart,
              scheduledEnd: newEnd,
              status: 'RESERVED',
              bookedBy: 'DISPATCHER',
              assignmentMode: 'AUTO',
            },
          });
          await tx.booking.update({ where: { id: oldBooking.id }, data: { status: 'RELEASED' } });
        });
      } catch (err) {
        thrown = err;
      }

      expect(thrown).not.toBeNull();
      expect(extractSqlState(thrown)).toBe('23505');

      // Transakcja MUSI wycofać się w całości: stara rezerwacja pozostaje RESERVED, żaden
      // nowy wiersz nie przetrwał.
      const reread = await prisma.booking.findUnique({ where: { id: oldBooking.id } });
      expect(reread?.status).toBe('RESERVED');

      const activeRowsForLead = await prisma.booking.count({
        where: { leadId: lead.id, status: { in: ['RESERVED', 'CONFIRMED'] } },
      });
      expect(activeRowsForLead).toBe(1);
    },
    30000,
  );
});
