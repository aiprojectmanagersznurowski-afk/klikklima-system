import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { START_STATE } from '@klikklima/contracts';

/**
 * WO: docs/workorders/B2C-LEAD-ATOMIC.md — AC1, AC3, AC4, AC6, AC7, AC8, AC9 + sekwencjonowanie
 * jednostkowe dla AC2 (dowód realnego ZERA wierszy na żywym Postgresie jest w
 * `saveLead-atomic.itest.ts` — atrapa Prismy nie ma prawdziwego ROLLBACK, WO, "Przypadki
 * brzegowe", pierwszy punkt).
 *
 * KONTRAKT MOCKOWANIA (decyzja test-authora — WO B2C-LEAD-ATOMIC opisuje PODEJŚCIE P-2
 * ("część przygotowawcza" / "część zapisująca") ale NIE podaje "Proponowanej sygnatury" dla
 * te dwie funkcje, w przeciwieństwie np. do `create-booking-concurrency.itest.ts`/WO
 * FLD-BOOKING-ATOMIC-ASSIGN. Ten plik (i pliki siostrzane `saveLead.test.ts`,
 * `saveLead.booking.test.ts`, `saveLead-atomic.itest.ts`, `packages/scheduling/tests/
 * create-booking-split.test.ts`) zakłada KONSEKWENTNIE ten sam kontrakt:
 *
 *   prepareBookingCandidates(params): Promise<
 *     | { ok: true, candidates: {resource_id, resource_kind}[], resourceKind, scheduledEnd, visitBasketId }
 *     | { ok: false, error: { code, message, alternatives } }
 *   >
 *   // Odczyty WYŁĄCZNIE: koszyk, konfiguracja, findAvailableSlots + D-1 + preferredResourceId.
 *   // BEZ zapisu. Woła się PRZED otwarciem jakiejkolwiek transakcji `saveLead`.
 *
 *   writeBookingCandidate(tx, params): Promise<
 *     | { ok: true, booking }
 *     | { ok: false, error: { code: 'POOL_MISMATCH'|'SUBJECT_ALREADY_BOOKED', message, alternatives, existingBooking? } }
 *   >
 *   // Przyjmuje klienta transakcyjnego `tx`. Wykonuje DOKŁADNIE jeden `tx.booking.create`.
 *   // NIE ŁAPIE 23P01/40P01 (WO, P-2: "oddaje błąd wołającemu") — te kody wydostają się jako
 *   // wyjątek, wołający (pętla po kandydatach w `saveLead`, każda iteracja to NOWA
 *   // `prisma.$transaction`) decyduje o retry na następnym kandydacie.
 *
 * Jeśli implementer wybierze inny kształt (inne nazwy, inny podział odpowiedzialności), to
 * NIE JEST z automatu TEST-DEFECT — WO rozstrzyga PODEJŚCIE (P-2), nie nazwy eksportów.
 * Zgłoszone w podsumowaniu tury jako ryzyko do potwierdzenia w review/z implementerem.
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

  const prepareBookingCandidatesSpy = vi.fn(async (_params: Record<string, unknown>) => ({
    ok: true,
    candidates: [{ resource_id: 'aud-1', resource_kind: 'AUDITOR' as const }],
    resourceKind: 'AUDITOR' as const,
    scheduledEnd: new Date('2026-11-16T09:00:00.000Z'),
    visitBasketId: 'basket-audit-id',
  }));

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
  triageData: { location: 'Dom jednorodzinny' },
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

describe('saveLead — transakcja atomowa (WO B2C-LEAD-ATOMIC)', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  // @REQ: B2C-LEAD-ATOMIC
  it('AC1 — sukces: klient, adres, lead i rezerwacja powstają w JEDNEJ prisma.$transaction, powiązane przez klient_id/adres_id/lead_id, data_rezerwacji === scheduledStart', async () => {
    const result = await saveLead(basePayload());

    expect(result.success).toBe(true);
    expect(transactionSpy).toHaveBeenCalledTimes(1);
    expect(klienciCreateSpy).toHaveBeenCalledTimes(1);
    expect(adresyCreateSpy).toHaveBeenCalledTimes(1);
    expect(leadyCreateSpy).toHaveBeenCalledTimes(1);
    expect(writeBookingCandidateSpy).toHaveBeenCalledTimes(1);

    const klientRow = klienciCreateSpy.mock.calls[0][0].data as Record<string, unknown>;
    const adresRow = adresyCreateSpy.mock.calls[0][0].data as Record<string, unknown>;
    const leadRow = leadyCreateSpy.mock.calls[0][0].data as Record<string, unknown>;

    expect(adresRow.klient_id).toBe(klientRow.id);
    expect(leadRow.klient_id).toBe(klientRow.id);
    expect(leadRow.adres_id).toBe(adresRow.id);
    expect(new Date(leadRow.data_rezerwacji as string | Date).getTime()).toBe(
      new Date('2026-11-16T07:00:00.000Z').getTime(),
    );

    // Wszystkie trzy create() muszą się odbyć NA `tx` przekazanym do $transaction, nie na
    // globalnym `prisma` — to jest dowód, że powiązanie zachodzi WEWNĄTRZ jednej transakcji
    // (AC3), nie osobnymi zapytaniami poza nią. Sam fakt, że mock `tx` (nie globalny `prisma`)
    // zarejestrował te wywołania, jest tu wystarczającym dowodem na poziomie jednostkowym —
    // atomowość na żywym Postgresie jest dowiedziona w `saveLead-atomic.itest.ts`.
    expect(transactionSpy.mock.invocationCallOrder[0]).toBeLessThan(klienciCreateSpy.mock.invocationCallOrder[0]);
  });

  // @REQ: B2C-LEAD-ATOMIC
  it('AC4 — awaria kalendarza (rzucony wyjątek) PO zatwierdzonej transakcji nie wycofuje zapisu: saveLead zwraca success:true, klient/adres/lead/rezerwacja istnieją', async () => {
    calendarSpy.mockRejectedValueOnce(new Error('Google Calendar API down'));

    const result = await saveLead(basePayload());

    expect(result.success).toBe(true);
    expect(klienciCreateSpy).toHaveBeenCalledTimes(1);
    expect(adresyCreateSpy).toHaveBeenCalledTimes(1);
    expect(leadyCreateSpy).toHaveBeenCalledTimes(1);
    expect(writeBookingCandidateSpy).toHaveBeenCalledTimes(1);
  });

  // @REQ: B2C-LEAD-ATOMIC
  it('AC4 — awaria kalendarza (createCalendarEvent zwraca success:false, nie rzuca) NIE jest wywoływana, gdy transakcja się nie udała (SLOT_TAKEN)', async () => {
    writeBookingCandidateSpy.mockResolvedValueOnce({
      ok: false,
      error: { code: 'SLOT_TAKEN', message: 'x', alternatives: [] },
    });

    await saveLead(basePayload());

    expect(calendarSpy).not.toHaveBeenCalled();
  });

  // @REQ: B2C-LEAD-ATOMIC
  it('AC4 — kalendarz jest wołany DOKŁADNIE PO tym, jak $transaction już się rozstrzygnęła (kolejność wywołań)', async () => {
    await saveLead(basePayload());

    expect(calendarSpy).toHaveBeenCalledTimes(1);
    expect(transactionSpy.mock.invocationCallOrder[0]).toBeLessThan(calendarSpy.mock.invocationCallOrder[0]);
  });

  // @REQ: B2C-LEAD-ATOMIC
  it('AC3 (statyczny) — apps/b2c-web nie zawiera żadnego UPDATE ustawiającego klient_id na leady spoza tego samego create() co reszta leada', () => {
    const saveLeadSource = readFileSync(
      path.resolve(__dirname, '../../app/actions/saveLead.ts'),
      'utf-8',
    );
    // Zakazany wzorzec: jakikolwiek UPDATE na `leady`/`tx.leady` ustawiający `klient_id` po
    // fakcie (dowód, że powiązanie klient<->lead NIE jest osobnym krokiem po zatwierdzeniu).
    expect(/leady\s*\.\s*update\([^)]*klient_id/.test(saveLeadSource)).toBe(false);
    expect(/from\(\s*['"]leady['"]\s*\)\s*\.\s*update\([^)]*klient_id/.test(saveLeadSource)).toBe(false);
  });

  // @REQ: B2C-LEAD-ENTRY
  it('AC6 (statyczny) — dokładnie jeden plik w apps/b2c-web zapisuje do tabeli leady (Prisma leady.create/createMany albo from(\'leady\').insert/upsert)', () => {
    const roots = ['app', 'components', 'lib'].map((dir) => path.resolve(__dirname, '../../', dir));
    const writePatterns = [
      /(?:^|[^a-zA-Z0-9_.])leady\s*\.\s*create(?:Many)?\s*\(/,
      /from\(\s*['"]leady['"]\s*\)\s*\.\s*(?:insert|upsert)\s*\(/,
    ];

    const matchingFiles: string[] = [];
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
          const content = readFileSync(full, 'utf-8');
          if (writePatterns.some((p) => p.test(content))) {
            matchingFiles.push(full);
          }
        }
      }
    };
    for (const root of roots) walk(root);

    expect(matchingFiles).toHaveLength(1);
    expect(matchingFiles[0]).toMatch(/saveLead\.ts$/);
  });

  // @REQ: B2C-LEAD-ENTRY
  it('AC6 (statyczny) — leads.ts nie eksportuje submitFinalTriage (druga ścieżka zlikwidowana, nie zdeprecjonowana)', async () => {
    const leadsModule = await import('../../app/actions/leads');
    expect((leadsModule as Record<string, unknown>).submitFinalTriage).toBeUndefined();
  });

  // @REQ: B2C-LEAD-ENTRY
  it('AC7 (statyczny) — saveLead.ts nie zawiera literału \'NEW_LEAD\' jako wartości status', () => {
    const saveLeadSource = readFileSync(
      path.resolve(__dirname, '../../app/actions/saveLead.ts'),
      'utf-8',
    );
    expect(/status\s*:\s*['"]NEW_LEAD['"]/.test(saveLeadSource)).toBe(false);
  });

  // @REQ: B2C-LEAD-ENTRY
  it('AC7 (statyczny) — saveLead.ts importuje START_STATE z @klikklima/contracts', () => {
    const saveLeadSource = readFileSync(
      path.resolve(__dirname, '../../app/actions/saveLead.ts'),
      'utf-8',
    );
    expect(/import\s*\{[^}]*\bSTART_STATE\b[^}]*\}\s*from\s*['"]@klikklima\/contracts['"]/.test(saveLeadSource)).toBe(
      true,
    );
  });

  // @REQ: B2C-LEAD-ENTRY
  it('AC7 (zachowanie) — status utworzonego leada w argumencie create() jest równy START_STATE z kontraktu lejka', async () => {
    await saveLead(basePayload());

    expect(leadyCreateSpy).toHaveBeenCalledTimes(1);
    const leadRow = leadyCreateSpy.mock.calls[0][0].data as Record<string, unknown>;
    expect(leadRow.status).toBe(START_STATE);
  });

  // @REQ: B2C-LEAD-ENTRY
  it('AC8 — żądanie zawierające pole status (dowolna wartość, np. QUOTED) jest odrzucane błędem walidacji, zero zapisów — schemat Zod jest .strict()', async () => {
    const payloadWithStatus = { ...basePayload(), status: 'QUOTED' };

    const result = await saveLead(payloadWithStatus as unknown as Parameters<typeof saveLead>[0]);

    expect((result as { success: boolean }).success).toBe(false);
    expect((result as { code?: string }).code).toBe('VALIDATION_ERROR');
    expect(transactionSpy).not.toHaveBeenCalled();
    expect(klienciCreateSpy).not.toHaveBeenCalled();
  });

  // @REQ: B2C-LEAD-ENTRY
  describe('AC9 — brak elementu kontaktowego odrzuca żądanie błędem walidacji, zero zapisów (pięć osobnych przypadków, pusty string i biały znak liczą się jako brak)', () => {
    const cases: [string, Record<string, unknown>][] = [
      ['imię i nazwisko — brak pola', { name: undefined }],
      ['imię i nazwisko — pusty string', { name: '' }],
      ['imię i nazwisko — sam biały znak', { name: '   ' }],
      ['adres — brak pola', { address: undefined }],
      ['adres — pusty string', { address: '' }],
      ['telefon — brak pola', { phone: undefined }],
      ['telefon — pusty string', { phone: '' }],
      ['e-mail — brak pola', { email: undefined }],
      ['e-mail — pusty string', { email: '' }],
      ['odpowiedzi Triage — brak pola', { triageData: undefined }],
    ];

    it.each(cases)('%s', async (_label, override) => {
      const payload = { ...basePayload(), ...override };

      const result = await saveLead(payload as unknown as Parameters<typeof saveLead>[0]);

      expect((result as { success: boolean }).success).toBe(false);
      expect(transactionSpy).not.toHaveBeenCalled();
      expect(klienciCreateSpy).not.toHaveBeenCalled();
      expect(adresyCreateSpy).not.toHaveBeenCalled();
      expect(leadyCreateSpy).not.toHaveBeenCalled();
    });
  });

  /**
   * AC2 (sekwencjonowanie jednostkowe) — dowód realnego ZERA wierszy jest w
   * `saveLead-atomic.itest.ts` (WO, "Przypadki brzegowe": "Błąd na krokach klient/adres/lead
   * wolno wstrzyknąć naruszeniem ograniczenia (...), nie mockiem"). Ten blok dowodzi
   * WYŁĄCZNIE, że `saveLead` łapie odrzucenie na KAŻDYM z czterech kroków, zwraca
   * `success:false` (nie rzuca do UI) i NIE wywołuje kroków PO tym, na którym nastąpiła
   * awaria — warunek koniecznY dla atomowości, nie dowód sam w sobie.
   */
  describe('AC2 (sekwencjonowanie) — błąd na każdym z czterech kroków zatrzymuje kolejne kroki i nie rzuca do UI', () => {
    // @REQ: B2C-LEAD-ATOMIC
    it('krok klient: tx.klienci.create() odrzucony -> adresy/leady/rezerwacja niewołane, success:false', async () => {
      klienciCreateSpy.mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'));

      const result = await saveLead(basePayload());

      expect(result.success).toBe(false);
      expect(adresyCreateSpy).not.toHaveBeenCalled();
      expect(leadyCreateSpy).not.toHaveBeenCalled();
      expect(writeBookingCandidateSpy).not.toHaveBeenCalled();
      expect(calendarSpy).not.toHaveBeenCalled();
    });

    // @REQ: B2C-LEAD-ATOMIC
    it('krok adres: tx.adresy.create() odrzucony -> leady/rezerwacja niewołane, success:false', async () => {
      adresyCreateSpy.mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'));

      const result = await saveLead(basePayload());

      expect(result.success).toBe(false);
      expect(leadyCreateSpy).not.toHaveBeenCalled();
      expect(writeBookingCandidateSpy).not.toHaveBeenCalled();
      expect(calendarSpy).not.toHaveBeenCalled();
    });

    // @REQ: B2C-LEAD-ATOMIC
    it('krok lead: tx.leady.create() odrzucony -> rezerwacja niewołana, success:false', async () => {
      leadyCreateSpy.mockRejectedValueOnce(new Error('duplicate key value violates unique constraint'));

      const result = await saveLead(basePayload());

      expect(result.success).toBe(false);
      expect(writeBookingCandidateSpy).not.toHaveBeenCalled();
      expect(calendarSpy).not.toHaveBeenCalled();
    });

    // @REQ: B2C-LEAD-ATOMIC
    it('krok rezerwacja: writeBookingCandidate() rzuca (23P01 nierozpoznany na tym poziomie / wyczerpanie kandydatów) -> success:false, kalendarz niewołany', async () => {
      writeBookingCandidateSpy.mockRejectedValueOnce(
        Object.assign(new Error('SQLSTATE 23P01'), { name: 'PrismaClientUnknownRequestError' }),
      );

      const result = await saveLead(basePayload());

      expect(result.success).toBe(false);
      expect(calendarSpy).not.toHaveBeenCalled();
    });
  });
});
