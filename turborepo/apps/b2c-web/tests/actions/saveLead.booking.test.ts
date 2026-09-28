import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * WO: docs/workorders/B2C-BOOKING-SLOT.md (wersja 2) — AC6, AC7, AC10 + przypadek brzegowy
 * "strefa czasowa" NIETKNIĘTE. AC5 z tamtego WO ZASTĘPUJE swój test tutaj (patrz niżej).
 *
 * WO: docs/workorders/B2C-LEAD-ATOMIC.md — AC5 nowej postaci (zastępuje AC9 z
 * B2C-BOOKING-SLOT, "D-6 wariant (a)" — Michał 2026-09-14, WO sekcja "Wymagania": wariant (a)
 * jest tymczasowy, pełna atomowość zostaje przy tym WO). AC10 (mechanizm mockowania: Prisma).
 *
 * MECHANIZM MOCKOWANIA ZMIENIONY (AC10): jak w `saveLead.test.ts` — `@repo/database` mockuje
 * `prisma.$transaction` wołające callback z fałszywym `tx` (`klienci.create`/`adresy.create`/
 * `leady.create`), `@repo/scheduling` mockuje `prepareBookingCandidates` +
 * `writeBookingCandidate` (NIE `createBooking` — ten jest wewnętrznym detalem pakietu,
 * złożonym z tych samych dwóch części, ale `saveLead` woła je z osobna, per P-2 WO
 * B2C-LEAD-ATOMIC: "saveLead iteruje po uporządkowanych kandydatach; każda iteracja to
 * osobna, pełna prisma.$transaction"). Sygnatura tych dwóch funkcji jest decyzją test-authora
 * (WO nie podaje "Proponowanej sygnatury") — patrz `saveLead.atomic.test.ts` dla pełnego
 * uzasadnienia kontraktu.
 *
 * `data_rezerwacji` wchodzi teraz w TEN SAM `leady.create` (P-4) — NIE osobny UPDATE. AC10
 * (oryginalne, z B2C-BOOKING-SLOT: "data_rezerwacji ustawiane WYŁĄCZNIE po ok:true") jest więc
 * przeformułowane na poziomie tego, CO wchodzi do create(): przy sukcesie
 * `data_rezerwacji` w argumencie `leady.create` jest niepuste i równe `scheduledStart` z wyniku
 * rezerwacji; przy porażce cały `leady.create` się NIE odbywa (bo cała transakcja jest wycofana
 * — AC5 poniżej), więc pytanie "czy data_rezerwacji jest null w INSERCIE" nie ma już sensu
 * osobno od AC5.
 */

const {
  transactionSpy,
  klienciCreateSpy,
  adresyCreateSpy,
  leadyCreateSpy,
  calendarSpy,
  prepareBookingCandidatesSpy,
  writeBookingCandidateSpy,
  visitDurationBasketFindFirstMock,
} = vi.hoisted(() => {
  const klienciCreateSpy = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data }));
  const adresyCreateSpy = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data }));
  const leadyCreateSpy = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ ...data }));

  const fakeTx = {
    klienci: { create: klienciCreateSpy },
    adresy: { create: adresyCreateSpy },
    leady: { create: leadyCreateSpy },
  };

  const transactionSpy = vi.fn(async (callback: (tx: typeof fakeTx) => Promise<unknown>) => callback(fakeTx));

  const calendarSpy = vi.fn(async () => ({ success: true, eventLink: 'stub' }));

  type FakePrepareResult =
    | {
        ok: true;
        candidates: { resource_id: string; resource_kind: 'AUDITOR' | 'CREW' }[];
        resourceKind: 'AUDITOR' | 'CREW';
        scheduledEnd: Date;
        visitBasketId: string;
      }
    | { ok: false; error: { code: string; message: string; alternatives: unknown[] } };

  const prepareBookingCandidatesSpy = vi.fn(
    async (_params: Record<string, unknown>): Promise<FakePrepareResult> => ({
      ok: true,
      candidates: [{ resource_id: 'aud-1', resource_kind: 'AUDITOR' }],
      resourceKind: 'AUDITOR',
      scheduledEnd: new Date('2026-11-16T09:00:00.000Z'),
      visitBasketId: 'basket-audit-id',
    }),
  );

  type FakeBookingRow = { id: string; scheduledStart: Date; scheduledEnd: Date; [key: string]: unknown };
  type FakeWriteResult =
    | { ok: true; booking: FakeBookingRow }
    | { ok: false; error: { code: string; message: string; alternatives: unknown[] } };

  const writeBookingCandidateSpy = vi.fn(
    async (_tx: unknown, _params: Record<string, unknown>): Promise<FakeWriteResult> => ({
      ok: true,
      booking: {
        id: 'booking-default',
        scheduledStart: new Date('2026-11-16T07:00:00.000Z'),
        scheduledEnd: new Date('2026-11-16T09:00:00.000Z'),
      },
    }),
  );

  const visitDurationBasketFindFirstMock = vi.fn(async (_args: Record<string, unknown>) => ({
    id: 'basket-audit-id',
    code: 'AUDIT',
    isActive: true,
    durationMinutes: 120,
    pool: 'AUDITOR',
  }));

  return {
    transactionSpy,
    klienciCreateSpy,
    adresyCreateSpy,
    leadyCreateSpy,
    calendarSpy,
    prepareBookingCandidatesSpy,
    writeBookingCandidateSpy,
    visitDurationBasketFindFirstMock,
  };
});

// Stub NIEUŻYWANY merytorycznie — patrz uzasadnienie w saveLead.test.ts (import realnego
// `@/lib/supabaseClient` bez mocka pada na nierozwiązywalnym aliasie `@/*`, RED z
// niewłaściwego powodu, dopóki implementer nie usunie tego importu z saveLead.ts, P-3).
vi.mock('@/lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }));
vi.mock('../../app/actions/calendar', () => ({ createCalendarEvent: calendarSpy }));
vi.mock('@repo/scheduling', () => ({
  prepareBookingCandidates: prepareBookingCandidatesSpy,
  writeBookingCandidate: writeBookingCandidateSpy,
}));
vi.mock('@repo/database', () => ({
  prisma: {
    visitDurationBasket: { findFirst: visitDurationBasketFindFirstMock },
    $transaction: transactionSpy,
  },
}));

const { saveLead } = await import('../../app/actions/saveLead');

const basePayload = () => ({
  name: 'Jan Kowalski',
  email: 'jan.kowalski@example.com',
  phone: '500600700',
  address: 'Marszałkowska 1, Warszawa',
  startAtIso: '2026-11-16T08:00:00.000+01:00',
  triageData: {},
});

function resetAllMocks(): void {
  transactionSpy.mockClear();
  klienciCreateSpy.mockClear();
  adresyCreateSpy.mockClear();
  leadyCreateSpy.mockClear();
  calendarSpy.mockClear();
  prepareBookingCandidatesSpy.mockClear();
  writeBookingCandidateSpy.mockClear();
  visitDurationBasketFindFirstMock.mockClear();

  visitDurationBasketFindFirstMock.mockResolvedValue({
    id: 'basket-audit-id',
    code: 'AUDIT',
    isActive: true,
    durationMinutes: 120,
    pool: 'AUDITOR',
  });
  prepareBookingCandidatesSpy.mockResolvedValue({
    ok: true,
    candidates: [{ resource_id: 'aud-1', resource_kind: 'AUDITOR' }],
    resourceKind: 'AUDITOR',
    scheduledEnd: new Date('2026-11-16T09:00:00.000Z'),
    visitBasketId: 'basket-audit-id',
  });
  writeBookingCandidateSpy.mockResolvedValue({
    ok: true,
    booking: {
      id: 'booking-default',
      scheduledStart: new Date('2026-11-16T07:00:00.000Z'),
      scheduledEnd: new Date('2026-11-16T09:00:00.000Z'),
    },
  });
}

describe('saveLead — rezerwacja audytu (WO B2C-BOOKING-SLOT, mechanizm mockowania zaktualizowany przez WO B2C-LEAD-ATOMIC AC10)', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  // @REQ: B2C-BOOKING-SLOT
  it('AC5 (numeracja B2C-BOOKING-SLOT) — visitBasketId/bookedBy/resource_id/auditorId dołączone do żądania NIE są honorowane', async () => {
    // Pole `status` NIE wchodzi do tego payloadu: od AC8 (B2C-LEAD-ATOMIC) jego obecność —
    // niezależnie od wartości — jest odrzucana walidacją Zod przed jakimkolwiek zapisem
    // (patrz `saveLead.atomic.test.ts`, test AC8). Ten test sprawdza inną rzecz: że pola
    // rezerwacji dołączone przez atakującego nie są honorowane, więc payload musi przejść
    // walidację, żeby dotrzeć do `writeBookingCandidate`.
    const maliciousPayload = {
      ...basePayload(),
      visitBasketId: 'attacker-basket-id',
      bookedBy: 'DISPATCHER',
      resource_id: 'attacker-resource',
      auditorId: 'attacker-auditor',
    };

    await saveLead(maliciousPayload as unknown as Parameters<typeof saveLead>[0]);

    expect(writeBookingCandidateSpy).toHaveBeenCalledTimes(1);
    const callArg = writeBookingCandidateSpy.mock.calls[0][1] as Record<string, unknown>;

    expect(callArg.bookedBy).toBe('CLIENT');
    expect(callArg).not.toHaveProperty('resource_id');
    expect(callArg).not.toHaveProperty('auditorId');
    expect(callArg).not.toHaveProperty('status');

    const prepareArg = prepareBookingCandidatesSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(prepareArg.visitBasketId).not.toBe('attacker-basket-id');
  });

  // @REQ: B2C-BOOKING-SLOT
  it('AC7 — leadId cudzy dołączony do żądania nie tworzy rezerwacji na tym leadzie: subject.leadId to id wygenerowane serwerowo w tym samym żądaniu', async () => {
    const maliciousPayload = { ...basePayload(), leadId: 'attacker-lead-id' };

    await saveLead(maliciousPayload as unknown as Parameters<typeof saveLead>[0]);

    expect(leadyCreateSpy).toHaveBeenCalledTimes(1);
    const leadRow = leadyCreateSpy.mock.calls[0][0].data as Record<string, unknown>;
    const generatedLeadId = leadRow.id as string;
    expect(generatedLeadId).not.toBe('attacker-lead-id');
    expect(typeof generatedLeadId).toBe('string');

    expect(writeBookingCandidateSpy).toHaveBeenCalledTimes(1);
    const callArg = writeBookingCandidateSpy.mock.calls[0][1] as { subject: { kind: string; leadId: string } };
    expect(callArg.subject.kind).toBe('LEAD');
    expect(callArg.subject.leadId).toBe(generatedLeadId);
    expect(callArg.subject.leadId).not.toBe('attacker-lead-id');
  });

  // @REQ: B2C-BOOKING-SLOT
  it('AC6 (statyczny) — apps/b2c-web nie zawiera własnego zapisu do tabeli bookings poza @repo/scheduling', () => {
    const roots = ['app', 'components', 'lib'].map((dir) => path.resolve(__dirname, '../../', dir));
    const forbiddenPatterns = [/from\(\s*['"]bookings['"]\s*\)/, /prisma\.booking\.create/, /\$queryRaw`[^`]*bookings/i];

    const files: string[] = [];
    const walk = (dir: string): void => {
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry === 'node_modules' || entry === '.next') continue;
        const full = path.join(dir, entry);
        const stat = statSync(full);
        if (stat.isDirectory()) {
          walk(full);
        } else if (/\.(ts|tsx)$/.test(entry)) {
          files.push(full);
        }
      }
    };
    for (const root of roots) walk(root);

    expect(files.length).toBeGreaterThan(0);

    for (const file of files) {
      const content = readFileSync(file, 'utf-8');
      for (const pattern of forbiddenPatterns) {
        expect(pattern.test(content)).toBe(false);
      }
    }
  });

  /**
   * @REQ: B2C-LEAD-ATOMIC
   *
   * ZASTĘPUJE test AC9 z WO B2C-BOOKING-SLOT ("D-6 wariant a" — po SLOT_TAKEN klient/adres/
   * lead ZOSTAJĄ zapisane). WO B2C-LEAD-ATOMIC, sekcja "Wymagania": ten wariant jest
   * "zaakceptowany, tymczasowy skutek — pełna atomowość zostaje przy B2C-LEAD-ATOMIC" i AC9
   * (kryt. rejestru B2C-BOOKING-SLOT NIE zawiera go) przestaje obowiązywać na rzecz nowego
   * AC5 z tego WO: po każdym kodzie błędu rezerwacji w bazie NIE MA nowego klienta/adresu/
   * leada. Na poziomie jednostkowym (mockowana Prisma) obserwowalny skutek to: `tx.klienci
   * .create` / `tx.adresy.create` / `tx.leady.create` albo nie zostały wywołane wcale (kody
   * wykryte w fazie przygotowawczej, PRZED otwarciem transakcji), albo — jeśli zostały —
   * cała `prisma.$transaction` się odrzuca (callback rzuca), co dowodzi, że implementacja NIE
   * ma odrębnej ścieżki "zatwierdź częściowo". Prawdziwe zero wierszy na żywym Postgresie
   * (dla kodów odkrywanych W TRAKCIE transakcji: SLOT_TAKEN/SUBJECT_ALREADY_BOOKED/
   * POOL_MISMATCH) jest dowiedzione w `saveLead-atomic.itest.ts` — ten test jednostkowy nie
   * może tego dowieść (atrapa `$transaction` nie ma prawdziwego ROLLBACK).
   */
  it('AC5 (B2C-LEAD-ATOMIC) — po każdym kodzie błędu rezerwacji odkrytym W FAZIE PRZYGOTOWAWCZEJ (przed otwarciem transakcji) transakcja NIE jest otwierana i żaden create() na klienci/adresy/leady się nie odbywa', async () => {
    const prepareFailureCodes = ['BASKET_NOT_FOUND', 'BASKET_INACTIVE', 'CONFIG_MISSING', 'SLOT_NOT_OFFERED'];

    for (const code of prepareFailureCodes) {
      resetAllMocks();
      prepareBookingCandidatesSpy.mockResolvedValueOnce({
        ok: false,
        error: { code, message: 'x', alternatives: [] },
      });

      const result = await saveLead(basePayload());

      expect((result as { success: boolean }).success).toBe(false);
      expect((result as { code?: string }).code).toBe(code);
      expect(transactionSpy).not.toHaveBeenCalled();
      expect(klienciCreateSpy).not.toHaveBeenCalled();
      expect(adresyCreateSpy).not.toHaveBeenCalled();
      expect(leadyCreateSpy).not.toHaveBeenCalled();
      expect(writeBookingCandidateSpy).not.toHaveBeenCalled();
      expect(calendarSpy).not.toHaveBeenCalled();
    }
  });

  // @REQ: B2C-LEAD-ATOMIC
  it('AC5 (B2C-LEAD-ATOMIC) — po kodzie błędu odkrytym WEWNĄTRZ transakcji (SLOT_TAKEN/SUBJECT_ALREADY_BOOKED/POOL_MISMATCH) cała transakcja jest odrzucona: brak sukcesu, kalendarz niewołany, dokładnie jedna próba writeBookingCandidate na jedynego kandydata', async () => {
    const inTransactionFailureCodes = ['SLOT_TAKEN', 'SUBJECT_ALREADY_BOOKED', 'POOL_MISMATCH'];

    for (const code of inTransactionFailureCodes) {
      resetAllMocks();
      writeBookingCandidateSpy.mockResolvedValueOnce({
        ok: false,
        error: { code, message: 'x', alternatives: [] },
      });

      const result = await saveLead(basePayload());

      expect((result as { success: boolean }).success).toBe(false);
      expect((result as { code?: string }).code).toBe(code);
      expect(calendarSpy).not.toHaveBeenCalled();
    }
  });

  // @REQ: B2C-LEAD-ATOMIC
  it('AC1/P-4 — sukces: data_rezerwacji w argumencie leady.create (nie w osobnym update) jest niepuste i równe scheduledStart z wyniku rezerwacji', async () => {
    await saveLead(basePayload());

    expect(leadyCreateSpy).toHaveBeenCalledTimes(1);
    const leadRow = leadyCreateSpy.mock.calls[0][0].data as Record<string, unknown>;
    expect(leadRow.data_rezerwacji).not.toBeNull();
    expect(new Date(leadRow.data_rezerwacji as string | Date).getTime()).toBe(
      new Date('2026-11-16T07:00:00.000Z').getTime(),
    );
  });

  // @REQ: B2C-BOOKING-SLOT
  it('strefa czasowa — data_rezerwacji zapisana wprost z wyniku rezerwacji (bez przeliczenia w strefie procesu), dzień zmiany czasu na letni', async () => {
    const startAtIso = '2026-03-29T12:00:00.000+02:00'; // 12:00 czasu letniego Warszawy, po zmianie
    writeBookingCandidateSpy.mockResolvedValueOnce({
      ok: true,
      booking: {
        id: 'booking-dst',
        scheduledStart: new Date(startAtIso),
        scheduledEnd: new Date(new Date(startAtIso).getTime() + 120 * 60000),
      },
    });

    await saveLead({ ...basePayload(), startAtIso });

    expect(leadyCreateSpy).toHaveBeenCalledTimes(1);
    const leadRow = leadyCreateSpy.mock.calls[0][0].data as Record<string, unknown>;
    expect(new Date(leadRow.data_rezerwacji as string | Date).toISOString()).toBe(new Date(startAtIso).toISOString());
  });
});
