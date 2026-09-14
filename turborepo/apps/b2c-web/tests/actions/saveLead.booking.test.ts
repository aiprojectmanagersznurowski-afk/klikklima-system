import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * WO: docs/workorders/B2C-BOOKING-SLOT.md (wersja 2, rozstrzygnięta 2026-09-14) — AC5,
 * AC6, AC7, AC9, AC10 + przypadek brzegowy "strefa czasowa" na `data_rezerwacji`.
 *
 * Plik SIOSTRZANY, NIE zamiennik `saveLead.test.ts` (ten drugi dowodzi geokodowania,
 * WO B2C-LEAD-GEO-PERSIST — DONE, nietknięte tutaj). `saveLead.ts` DZIŚ przyjmuje
 * `bookingDate` + `bookingSlot`; WO zamienia to na jedno pole `startAtIso` i dodaje
 * wywołanie `createBooking` z `@repo/scheduling`. Do chwili przepisania `saveLead.ts`
 * ten plik pada, bo dzisiejsza implementacja: (a) nie rozpoznaje `startAtIso`, (b) nie
 * importuje `createBooking`, (c) nie robi UPDATE na `leady` (którego mock poniżej
 * wymaga) — to jest oczekiwany, właściwy powód czerwieni (WO, "Kolejność ról" pkt 4).
 *
 * Konsekwencja wynikająca z porządku FK (WO, D-6/architektura "Zapis rezerwacji"):
 * `createBooking` wymaga `subject: { kind: 'LEAD', leadId }`, a lead musi istnieć
 * PRZED próbą rezerwacji — więc `saveLead` MUSI: 1) wstawić `leady` bez
 * `data_rezerwacji` (nieznana, dopóki wynik rezerwacji nie jest znany), 2) wywołać
 * `createBooking`, 3) TYLKO gdy `ok:true` — zrobić UPDATE na `leady` ustawiający
 * `data_rezerwacji`. Stąd mock na `leady` w tym pliku ma DWIE metody (insert + update),
 * w przeciwieństwie do `saveLead.test.ts`, gdzie leady ma tylko insert. To nie jest
 * dowolna preferencja test-authora — to bezpośrednia konsekwencja FK
 * (`Booking.lead` → `leady`, `onDelete: Cascade`) opisanej w WO.
 */

const {
  fromSpy,
  klienciInsertSpy,
  adresyInsertSpy,
  leadyInsertSpy,
  leadyUpdateSpy,
  leadyUpdateEqSpy,
  calendarSpy,
  createBookingSpy,
} = vi.hoisted(() => {
  const klienciInsertSpy = vi.fn(async (_row: Record<string, unknown>) => ({ error: null }));
  const adresyInsertSpy = vi.fn(async (_row: Record<string, unknown>) => ({ error: null }));
  const leadyInsertSpy = vi.fn(async (_row: Record<string, unknown>) => ({ error: null }));
  const leadyUpdateEqSpy = vi.fn(async (_col: string, _val: unknown) => ({ error: null }));
  const leadyUpdateSpy = vi.fn((_row: Record<string, unknown>) => ({ eq: leadyUpdateEqSpy }));
  const calendarSpy = vi.fn(async () => ({ success: true, eventLink: 'stub' }));

  type FakeBookingRow = { id: string; scheduledStart: Date; scheduledEnd: Date; [key: string]: unknown };
  type FakeCreateBookingResult =
    | { ok: true; booking: FakeBookingRow; error: null }
    | { ok: false; booking: null; error: { code: string; message: string; alternatives: unknown[] } };

  const createBookingSpy = vi.fn(async (_params: Record<string, unknown>): Promise<FakeCreateBookingResult> => ({
    ok: true,
    booking: {
      id: 'booking-default',
      scheduledStart: new Date('2026-11-16T07:00:00.000Z'),
      scheduledEnd: new Date('2026-11-16T09:00:00.000Z'),
    },
    error: null,
  }));

  const fromSpy = vi.fn((table: string) => {
    switch (table) {
      case 'klienci':
        return { insert: klienciInsertSpy };
      case 'adresy':
        return { insert: adresyInsertSpy };
      case 'leady':
        return { insert: leadyInsertSpy, update: leadyUpdateSpy };
      default:
        throw new Error(
          `saveLead.booking.test: nieoczekiwana tabela "${table}" — dopisz obsługę w mocku zanim rozszerzysz test.`,
        );
    }
  });

  return {
    fromSpy,
    klienciInsertSpy,
    adresyInsertSpy,
    leadyInsertSpy,
    leadyUpdateSpy,
    leadyUpdateEqSpy,
    calendarSpy,
    createBookingSpy,
  };
});

vi.mock('@/lib/supabaseClient', () => ({ supabase: { from: fromSpy } }));
vi.mock('../../app/actions/calendar', () => ({ createCalendarEvent: calendarSpy }));
vi.mock('@repo/scheduling', () => ({ createBooking: createBookingSpy }));

const { saveLead } = await import('../../app/actions/saveLead');

const basePayload = () => ({
  name: 'Jan Kowalski',
  email: 'jan.kowalski@example.com',
  phone: '500600700',
  address: 'Marszałkowska 1, Warszawa',
  startAtIso: '2026-11-16T08:00:00.000+01:00', // poniedziałek, 08:00 czasu Warszawy (zima)
  triageData: {},
});

function resetAllMocks(): void {
  fromSpy.mockClear();
  klienciInsertSpy.mockClear();
  adresyInsertSpy.mockClear();
  leadyInsertSpy.mockClear();
  leadyUpdateSpy.mockClear();
  leadyUpdateEqSpy.mockClear();
  calendarSpy.mockClear();
  createBookingSpy.mockClear();
  createBookingSpy.mockResolvedValue({
    ok: true,
    booking: {
      id: 'booking-default',
      scheduledStart: new Date('2026-11-16T07:00:00.000Z'),
      scheduledEnd: new Date('2026-11-16T09:00:00.000Z'),
    },
    error: null,
  });
}

describe('saveLead — rezerwacja audytu (WO B2C-BOOKING-SLOT)', () => {
  beforeEach(() => {
    resetAllMocks();
  });

  // @REQ: B2C-BOOKING-SLOT
  it('AC5 — visitBasketId/bookedBy/resource_id/auditorId/status dołączone do żądania NIE są honorowane: createBooking woła z bookedBy=CLIENT i serwerowym visitBasketId', async () => {
    const maliciousPayload = {
      ...basePayload(),
      visitBasketId: 'attacker-basket-id',
      bookedBy: 'DISPATCHER',
      resource_id: 'attacker-resource',
      auditorId: 'attacker-auditor',
      status: 'CONFIRMED',
    };

    await saveLead(maliciousPayload as unknown as Parameters<typeof saveLead>[0]);

    expect(createBookingSpy).toHaveBeenCalledTimes(1);
    const callArg = createBookingSpy.mock.calls[0][0] as Record<string, unknown>;

    expect(callArg.bookedBy).toBe('CLIENT');
    expect(callArg.visitBasketId).not.toBe('attacker-basket-id');
    expect(callArg).not.toHaveProperty('resource_id');
    expect(callArg).not.toHaveProperty('auditorId');
    expect(callArg).not.toHaveProperty('status');
  });

  // @REQ: B2C-BOOKING-SLOT
  it('AC7 — leadId cudzy dołączony do żądania nie tworzy rezerwacji na tym leadzie: subject.leadId to id wygenerowane serwerowo w tym samym żądaniu', async () => {
    const maliciousPayload = { ...basePayload(), leadId: 'attacker-lead-id' };

    await saveLead(maliciousPayload as unknown as Parameters<typeof saveLead>[0]);

    expect(leadyInsertSpy).toHaveBeenCalledTimes(1);
    const leadRow = leadyInsertSpy.mock.calls[0][0] as Record<string, unknown>;
    const generatedLeadId = leadRow.id as string;
    expect(generatedLeadId).not.toBe('attacker-lead-id');
    expect(typeof generatedLeadId).toBe('string');

    expect(createBookingSpy).toHaveBeenCalledTimes(1);
    const callArg = createBookingSpy.mock.calls[0][0] as { subject: { kind: string; leadId: string } };
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

  // @REQ: B2C-BOOKING-SLOT
  it('AC9 (D-6 wariant a) — po SLOT_TAKEN klient/adres/lead zostają zapisane, kalendarz nie jest wywoływany; ponowna próba tworzy NOWY, niezależny komplet z innym leadId', async () => {
    createBookingSpy.mockResolvedValueOnce({
      ok: false,
      booking: null,
      error: { code: 'SLOT_TAKEN', message: 'Termin zajęty.', alternatives: [] },
    });

    const first = await saveLead(basePayload());
    expect((first as { success: boolean }).success).toBe(false);
    expect((first as { code?: string }).code).toBe('SLOT_TAKEN');

    // Klient/adres/lead POZOSTAJĄ zapisane — żaden nie jest kasowany ani wycofywany.
    expect(klienciInsertSpy).toHaveBeenCalledTimes(1);
    expect(adresyInsertSpy).toHaveBeenCalledTimes(1);
    expect(leadyInsertSpy).toHaveBeenCalledTimes(1);
    // Kalendarz jest wywoływany PO udanym createBooking (architektura WO) — po
    // nieudanej rezerwacji nie ma czego wpisywać do kalendarza.
    expect(calendarSpy).not.toHaveBeenCalled();

    const firstLeadId = (leadyInsertSpy.mock.calls[0][0] as Record<string, unknown>).id;

    const second = await saveLead({ ...basePayload(), name: 'Anna Nowak', email: 'anna.nowak@example.com' });
    expect((second as { success: boolean }).success).toBe(true);

    expect(klienciInsertSpy).toHaveBeenCalledTimes(2);
    expect(adresyInsertSpy).toHaveBeenCalledTimes(2);
    expect(leadyInsertSpy).toHaveBeenCalledTimes(2);

    const secondLeadId = (leadyInsertSpy.mock.calls[1][0] as Record<string, unknown>).id;
    expect(secondLeadId).not.toBe(firstLeadId);
  });

  // @REQ: B2C-BOOKING-SLOT
  it('AC10 — data_rezerwacji NIE jest ustawiane, gdy createBooking zwraca błąd (żaden z kodów), niezależnie od kodu', async () => {
    const failureCodes = [
      'SLOT_TAKEN',
      'SUBJECT_ALREADY_BOOKED',
      'SLOT_NOT_OFFERED',
      'POOL_MISMATCH',
      'BASKET_NOT_FOUND',
      'BASKET_INACTIVE',
      'CONFIG_MISSING',
    ];

    for (const code of failureCodes) {
      resetAllMocks();
      createBookingSpy.mockResolvedValueOnce({
        ok: false,
        booking: null,
        error: { code, message: 'x', alternatives: [] },
      });

      await saveLead(basePayload());

      expect(leadyInsertSpy).toHaveBeenCalledTimes(1);
      const leadRow = leadyInsertSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(leadRow.data_rezerwacji ?? null).toBeNull();
      expect(leadyUpdateSpy).not.toHaveBeenCalled();
    }
  });

  // @REQ: B2C-BOOKING-SLOT
  it('AC10 — data_rezerwacji JEST ustawiane wyłącznie po ok:true, przez UPDATE na leady (nie w INSERT)', async () => {
    await saveLead(basePayload());

    expect(leadyInsertSpy).toHaveBeenCalledTimes(1);
    const insertRow = leadyInsertSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(insertRow.data_rezerwacji ?? null).toBeNull();

    expect(leadyUpdateSpy).toHaveBeenCalledTimes(1);
    const updateRow = leadyUpdateSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(updateRow.data_rezerwacji).not.toBeNull();
  });

  // @REQ: B2C-BOOKING-SLOT
  it('strefa czasowa — data_rezerwacji zapisana wprost z startAtIso (bez przeliczenia w strefie procesu), dzień zmiany czasu na letni', async () => {
    const startAtIso = '2026-03-29T12:00:00.000+02:00'; // 12:00 czasu letniego Warszawy, po zmianie
    createBookingSpy.mockResolvedValueOnce({
      ok: true,
      booking: {
        id: 'booking-dst',
        scheduledStart: new Date(startAtIso),
        scheduledEnd: new Date(new Date(startAtIso).getTime() + 120 * 60000),
      },
      error: null,
    });

    await saveLead({ ...basePayload(), startAtIso });

    expect(leadyUpdateSpy).toHaveBeenCalledTimes(1);
    const updateRow = leadyUpdateSpy.mock.calls[0][0] as Record<string, unknown>;
    expect(updateRow.data_rezerwacji).toBe(new Date(startAtIso).toISOString());
  });
});
