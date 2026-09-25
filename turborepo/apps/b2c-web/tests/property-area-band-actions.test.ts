import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * WO: docs/workorders/B2C-PROPERTY-AREA-BAND.md
 * Wymaganie: @REQ: B2C-PROPERTY-AREA-BAND
 * AC4, AC6, AC7
 */

const {
  fromSpy,
  klienciInsertSpy,
  adresyInsertSpy,
  leadyInsertSpy,
  leadyUpdateSpy,
  calendarSpy,
  createBookingSpy,
  visitDurationBasketFindFirstMock,
} = vi.hoisted(() => {
  const klienciInsert = vi.fn(async (_row: Record<string, unknown>) => ({ error: null }));
  const adresyInsert = vi.fn(async (_row: Record<string, unknown>) => ({ error: null }));
  const leadyInsert = vi.fn(async (_row: Record<string, unknown>) => ({ error: null }));
  const leadyUpdateEq = vi.fn(async (_k: string, _v: string) => ({ error: null }));
  const leadyUpdate = vi.fn((_row: Record<string, unknown>) => ({ eq: leadyUpdateEq }));

  const from = vi.fn((table: string) => {
    switch (table) {
      case 'klienci':
        return { insert: klienciInsert };
      case 'adresy':
        return { insert: adresyInsert };
      case 'leady':
        return { insert: leadyInsert, update: leadyUpdate };
      default:
        throw new Error(`property-area-band-actions.test: nieoczekiwana tabela "${table}"`);
    }
  });

  const calendar = vi.fn(async () => ({ success: true, eventId: 'mock-event-id' }));

  const createBooking = vi.fn(async () => ({
    ok: true,
    booking: {
      id: 'mock-booking-id',
      scheduledStart: new Date('2026-10-01T10:00:00.000Z'),
      scheduledEnd: new Date('2026-10-01T11:00:00.000Z'),
    },
  }));

  const findFirst = vi.fn(async () => ({
    id: 'mock-audit-basket-id',
    code: 'AUDIT',
    isActive: true,
  }));

  return {
    fromSpy: from,
    klienciInsertSpy: klienciInsert,
    adresyInsertSpy: adresyInsert,
    leadyInsertSpy: leadyInsert,
    leadyUpdateSpy: leadyUpdate,
    calendarSpy: calendar,
    createBookingSpy: createBooking,
    visitDurationBasketFindFirstMock: findFirst,
  };
});

vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from: fromSpy,
  },
}));

vi.mock('../../app/actions/calendar', () => ({
  createCalendarEvent: calendarSpy,
}));

vi.mock('@repo/scheduling', () => ({
  createBooking: createBookingSpy,
}));

vi.mock('@repo/database', () => ({
  prisma: {
    visitDurationBasket: {
      findFirst: visitDurationBasketFindFirstMock,
    },
  },
}));

const { saveLead } = await import('../app/actions/saveLead');

function basePayload() {
  return {
    name: 'Jan Kowalski',
    email: 'jan@example.com',
    phone: '+48123456789',
    address: 'ul. Marszałkowska 1, Warszawa',
    startAtIso: '2026-10-01T10:00:00.000Z',
    triageData: {
      location: 'Mieszkanie',
      roomCount: 2,
    },
  };
}

describe('B2C-PROPERTY-AREA-BAND — saveLead server action validation & persistence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // @REQ: B2C-PROPERTY-AREA-BAND
  it('AC6: dla location Mieszkanie bez propertyAreaBand zwraca błąd walidacji PRZED jakimkolwiek zapisem i rezerwacją', async () => {
    const payload = basePayload();
    // Brak propertyAreaBand
    delete (payload.triageData as { propertyAreaBand?: string }).propertyAreaBand;

    const result = await saveLead(payload);

    expect(result.success).toBe(false);
    expect(klienciInsertSpy).not.toHaveBeenCalled();
    expect(adresyInsertSpy).not.toHaveBeenCalled();
    expect(leadyInsertSpy).not.toHaveBeenCalled();
    expect(createBookingSpy).not.toHaveBeenCalled();
  });

  // @REQ: B2C-PROPERTY-AREA-BAND
  it('AC6: dla location Dom bez propertyAreaBand zwraca błąd walidacji PRZED jakimkolwiek zapisem', async () => {
    const payload = {
      ...basePayload(),
      triageData: {
        location: 'Dom',
        roomCount: 3,
      },
    };

    const result = await saveLead(payload);

    expect(result.success).toBe(false);
    expect(klienciInsertSpy).not.toHaveBeenCalled();
    expect(adresyInsertSpy).not.toHaveBeenCalled();
    expect(leadyInsertSpy).not.toHaveBeenCalled();
    expect(createBookingSpy).not.toHaveBeenCalled();
  });

  // @REQ: B2C-PROPERTY-AREA-BAND
  it('AC4: wartość spoza PROPERTY_AREA_BAND_IDS (np. tekst etykiety "Do 300 m²" lub liczba 300) przysłana do serwera jest odrzucana', async () => {
    // Przypadek 1: etykieta po polsku
    const payloadLabel = {
      ...basePayload(),
      triageData: {
        location: 'Mieszkanie',
        roomCount: 1,
        propertyAreaBand: 'Do 300 m²',
      },
    };
    const result1 = await saveLead(payloadLabel);
    expect(result1.success).toBe(false);
    expect(klienciInsertSpy).not.toHaveBeenCalled();

    // Przypadek 2: liczba 300
    const payloadNumber = {
      ...basePayload(),
      triageData: {
        location: 'Mieszkanie',
        roomCount: 1,
        propertyAreaBand: 300,
      },
    };
    const result2 = await saveLead(payloadNumber as unknown as typeof payloadLabel);
    expect(result2.success).toBe(false);
    expect(klienciInsertSpy).not.toHaveBeenCalled();
  });

  // @REQ: B2C-PROPERTY-AREA-BAND
  it('AC4: dla Mieszkania z poprawnym propertyAreaBand (UP_TO_300 lub ABOVE_300) zapis zawiera klucz w odpowiedzi_triage', async () => {
    const payload = {
      ...basePayload(),
      triageData: {
        location: 'Mieszkanie',
        roomCount: 2,
        propertyAreaBand: 'UP_TO_300',
      },
    };

    const result = await saveLead(payload);

    expect(result.success).toBe(true);
    expect(klienciInsertSpy).toHaveBeenCalledTimes(1);
    expect(adresyInsertSpy).toHaveBeenCalledTimes(1);
    expect(leadyInsertSpy).toHaveBeenCalledTimes(1);

    const leadInsertedRow = leadyInsertSpy.mock.calls[0][0] as {
      odpowiedzi_triage: Record<string, unknown>;
    };
    expect(leadInsertedRow.odpowiedzi_triage.propertyAreaBand).toBe('UP_TO_300');
  });

  // @REQ: B2C-PROPERTY-AREA-BAND
  it('AC6: dla Lokalu komercyjnego brak propertyAreaBand jest poprawny (zapis przechodzi)', async () => {
    const payload = {
      ...basePayload(),
      triageData: {
        location: 'Lokal komercyjny',
        roomCount: 1,
      },
    };

    const result = await saveLead(payload);

    expect(result.success).toBe(true);
    expect(leadyInsertSpy).toHaveBeenCalledTimes(1);
    const leadInsertedRow = leadyInsertSpy.mock.calls[0][0] as {
      odpowiedzi_triage: Record<string, unknown>;
    };
    expect(leadInsertedRow.odpowiedzi_triage.propertyAreaBand).toBeUndefined();
  });

  // @REQ: B2C-PROPERTY-AREA-BAND
  it('AC6: dla Lokalu komercyjnego wartość propertyAreaBand przysłana przez klienta NIE jest zapisywana', async () => {
    const payload = {
      ...basePayload(),
      triageData: {
        location: 'Lokal komercyjny',
        roomCount: 1,
        propertyAreaBand: 'UP_TO_300',
      },
    };

    const result = await saveLead(payload);

    expect(result.success).toBe(true);
    expect(leadyInsertSpy).toHaveBeenCalledTimes(1);
    const leadInsertedRow = leadyInsertSpy.mock.calls[0][0] as {
      odpowiedzi_triage: Record<string, unknown>;
    };
    // Wartość nie może trafić do odpowiedzi_triage dla komercyjnego
    expect(leadInsertedRow.odpowiedzi_triage.propertyAreaBand).toBeUndefined();
  });
});
