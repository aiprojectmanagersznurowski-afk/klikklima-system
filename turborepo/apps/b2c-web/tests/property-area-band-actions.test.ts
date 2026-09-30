import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * WO: docs/workorders/B2C-PROPERTY-AREA-BAND.md
 * Wymaganie: @REQ: B2C-PROPERTY-AREA-BAND
 * AC4, AC6, AC7
 *
 * MECHANIZM MOCKOWANIA ZMIENIONY (WO B2C-LEAD-ATOMIC, AC10 — "test-author przepisuje z
 * mocka supabase.from na Prismę — asercje merytoryczne bez zmian"): `saveLead.ts` przestaje
 * importować `@/lib/supabaseClient` (P-3), cały zapis idzie przez `@repo/database` (Prisma) w
 * jednej `prisma.$transaction`, a rezerwacja przez `prepareBookingCandidates` +
 * `writeBookingCandidate` z `@repo/scheduling` (P-2) — NIE `createBooking`. Wzorzec identyczny
 * jak w `tests/actions/saveLead.test.ts` / `tests/actions/saveLead.booking.test.ts`. Asercje
 * merytoryczne dotyczące `PROPERTY_AREA_BAND` (AC4/AC6) bez zmian — zmienia się wyłącznie
 * ścieżka odczytu argumentu wywołania (`tx.leady.create({ data })` zamiast
 * `supabase.from('leady').insert(row)`).
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
  legalDocumentVersionFindUniqueMock,
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
    scheduledEnd: new Date('2026-10-01T11:00:00.000Z'),
    visitBasketId: 'mock-audit-basket-id',
  }));

  const writeBookingCandidateSpy = vi.fn(async (_tx: unknown, _params: Record<string, unknown>) => ({
    ok: true,
    booking: {
      id: 'mock-booking-id',
      scheduledStart: new Date('2026-10-01T10:00:00.000Z'),
      scheduledEnd: new Date('2026-10-01T11:00:00.000Z'),
    },
  }));

  const visitDurationBasketFindFirstMock = vi.fn(async (_args: Record<string, unknown>) => ({
    id: 'mock-audit-basket-id',
    code: 'AUDIT',
    isActive: true,
    durationMinutes: 120,
    pool: 'AUDITOR',
  }));

  // Zgoda B2C (WO B2C-CONSENT-RODO, AC2/AC5) — ten plik nie testuje zgody merytorycznie
  // (patrz `saveLead.consent.test.ts`), atrapa tylko przepuszcza poprawny `basePayload()`.
  const legalDocumentVersionFindUniqueMock = vi.fn(async (_args: { where: { id: string } }) => null as unknown);

  return {
    transactionSpy,
    klienciCreateSpy,
    adresyCreateSpy,
    leadyCreateSpy,
    calendarSpy,
    prepareBookingCandidatesSpy,
    writeBookingCandidateSpy,
    visitDurationBasketFindFirstMock,
    legalDocumentVersionFindUniqueMock,
  };
});

// Stub NIEUŻYWANY merytorycznie — patrz uzasadnienie w `saveLead.test.ts`.
vi.mock('@/lib/supabaseClient', () => ({ supabase: { from: vi.fn() } }));

vi.mock('../app/actions/calendar', () => ({
  createCalendarEvent: calendarSpy,
}));

vi.mock('@repo/scheduling', () => ({
  prepareBookingCandidates: prepareBookingCandidatesSpy,
  writeBookingCandidate: writeBookingCandidateSpy,
}));

vi.mock('@repo/database', () => ({
  prisma: {
    visitDurationBasket: { findFirst: visitDurationBasketFindFirstMock },
    legalDocumentVersion: { findUnique: legalDocumentVersionFindUniqueMock },
    $transaction: transactionSpy,
  },
}));

const { saveLead } = await import('../app/actions/saveLead');

// Zgoda B2C (WO B2C-CONSENT-RODO) — kontrakt wejścia i mock wersji patrz
// `saveLead.consent.test.ts`. Ten plik nie testuje zgody merytorycznie.
const PRIVACY_VERSION_ID = 'aaaaaaaa-1111-4111-8111-111111111111';
const TERMS_VERSION_ID = 'bbbbbbbb-2222-4222-8222-222222222222';

function currentVersionRow(id: string, documentKind: string) {
  return {
    id,
    documentKind,
    versionNo: 1,
    content: 'Treść ITEST',
    isCurrent: true,
    publishedAt: new Date('2026-08-01T00:00:00.000Z'),
  };
}

legalDocumentVersionFindUniqueMock.mockImplementation(async ({ where }: { where: { id: string } }) => {
  if (where.id === PRIVACY_VERSION_ID) return currentVersionRow(PRIVACY_VERSION_ID, 'B2C_PRIVACY_POLICY');
  if (where.id === TERMS_VERSION_ID) return currentVersionRow(TERMS_VERSION_ID, 'B2C_TERMS');
  return null;
});

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
    consent: {
      privacyPolicyConsentVersionId: PRIVACY_VERSION_ID,
      termsConsentVersionId: TERMS_VERSION_ID,
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
    expect(klienciCreateSpy).not.toHaveBeenCalled();
    expect(adresyCreateSpy).not.toHaveBeenCalled();
    expect(leadyCreateSpy).not.toHaveBeenCalled();
    expect(writeBookingCandidateSpy).not.toHaveBeenCalled();
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
    expect(klienciCreateSpy).not.toHaveBeenCalled();
    expect(adresyCreateSpy).not.toHaveBeenCalled();
    expect(leadyCreateSpy).not.toHaveBeenCalled();
    expect(writeBookingCandidateSpy).not.toHaveBeenCalled();
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
    expect(klienciCreateSpy).not.toHaveBeenCalled();

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
    expect(klienciCreateSpy).not.toHaveBeenCalled();
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
    expect(klienciCreateSpy).toHaveBeenCalledTimes(1);
    expect(adresyCreateSpy).toHaveBeenCalledTimes(1);
    expect(leadyCreateSpy).toHaveBeenCalledTimes(1);

    const leadInsertedRow = leadyCreateSpy.mock.calls[0][0].data as {
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
    expect(leadyCreateSpy).toHaveBeenCalledTimes(1);
    const leadInsertedRow = leadyCreateSpy.mock.calls[0][0].data as {
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
    expect(leadyCreateSpy).toHaveBeenCalledTimes(1);
    const leadInsertedRow = leadyCreateSpy.mock.calls[0][0].data as {
      odpowiedzi_triage: Record<string, unknown>;
    };
    // Wartość nie może trafić do odpowiedzi_triage dla komercyjnego
    expect(leadInsertedRow.odpowiedzi_triage.propertyAreaBand).toBeUndefined();
  });
});
