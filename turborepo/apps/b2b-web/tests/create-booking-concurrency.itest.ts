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

function localMoment(dateStr: string, hhmm: string): Date {
  return fromZonedTime(`${dateStr}T${hhmm}:00`, TIME_ZONE);
}

function timeOfDay(hhmm: string): Date {
  return new Date(`1970-01-01T${hhmm}:00.000Z`);
}

let createdAuditorIds: string[] = [];
let createdLeadIds: string[] = [];

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
  // 4) leady testowe.
  if (createdLeadIds.length > 0) {
    await prisma.leady.deleteMany({ where: { id: { in: createdLeadIds } } });
  }
  createdAuditorIds = [];
  createdLeadIds = [];
});

const { createBooking } = await import('../src/lib/schedule/create-booking');

let auditBasketId: string;

beforeAll(async () => {
  // Koszyk 'AUDIT' jest SEEDOWANY przez migrację `20260910100000_fld_calendar_foundation.sql`
  // — czytamy, nie tworzymy (WO, "Zadanie 2": "sprawdź (...) czy trzeba wypełnić tylko to, co
  // NOT NULL wymaga" — tu nic nie trzeba wypełniać, koszyk już istnieje na każdym stacku, który
  // aplikuje migracje z repo, w tym lokalny `supabase start`).
  const basket = await prisma.visitDurationBasket.findFirst({ where: { code: 'AUDIT', isActive: true } });
  if (!basket) {
    throw new Error(
      "Koszyk 'AUDIT' nie istnieje na tej bazie — migracja 20260910100000_fld_calendar_foundation.sql " +
        'nie została zaaplikowana. Uruchom `supabase start` w katalogu repo przed `npm run test:integration`.',
    );
  }
  auditBasketId = basket.id;
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
      expect(failures[0]!.error.code).toBe('SLOT_TAKEN');

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
});
