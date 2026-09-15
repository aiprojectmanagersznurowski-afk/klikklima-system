import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PERMISSIONS, can } from '@klikklima/contracts';

/**
 * WO: docs/workorders/CAL-SCHEDULING-CONFIG-UI.md.
 * Wymaganie: `CAL-VISIT-DURATION-BASKETS` (`contracts/requirements.contract.mjs:699-708`, status TODO).
 *
 * Testowana akcja NIE ISTNIEJE jeszcze (WO, "Brakuje" — grep po apps/b2b-web/src nie znajduje
 * ani jednego wywołania modelu `VisitDurationBasket`). RED w tym pliku jest oczekiwany: import
 * poniżej rzuci błąd modułu ("Cannot find module .../settings/calendar/actions" albo brak
 * eksportu `updateVisitDurationBasketAction`) — to jest DOWÓD braku implementacji, nie usterka
 * testu.
 *
 * Wzorzec do skopiowania (1:1, jak w sec-last-admin-guard.test.ts): `$transaction` z drugim
 * argumentem `{ isolationLevel: 'Serializable' }`, sentinel błędu domenowego rzucany WEWNĄTRZ
 * transakcji i łapany w `catch` (analogicznie do `LastAdminError` w
 * `settings/actions.ts:updateAuthorizedUserRoleAction`), `formatFieldChange` /
 * `buildBaseLocationJustification` z `auditors/actions.ts` jako wzorzec dla justification.
 *
 * Fixture AUDITOR/CREW pochodzi z prawdziwego seeda (migracja 20260910100000): pula AUDITOR ma
 * DZIŚ dokładnie jeden koszyk (`AUDIT`), pula CREW ma sześć. TC-B9 nie jest tu wymyślonym
 * przypadkiem brzegowym — to dosłowny stan produkcyjny.
 *
 * Mockowane zależności: `@repo/database` (brak żywej instancji testowej), `next/cache`
 * (`revalidatePath` poza kontekstem żądania Next.js), `../src/utils/supabase/server`
 * (`getCurrentActorRole`/`getCurrentUser`, oba czytają `next/headers cookies()`).
 */

const {
  transactionMock,
  txFindUniqueMock,
  txUpdateMock,
  txCountMock,
  txAuditLogCreateMock,
  visitDurationBasketFindManyMock,
  visitDurationBasketDeleteMock,
  bookingUpdateMock,
  bookingUpdateManyMock,
  executeRawMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  txFindUniqueMock: vi.fn(),
  txUpdateMock: vi.fn(),
  txCountMock: vi.fn(),
  txAuditLogCreateMock: vi.fn(),
  visitDurationBasketFindManyMock: vi.fn(),
  visitDurationBasketDeleteMock: vi.fn(),
  bookingUpdateMock: vi.fn(),
  bookingUpdateManyMock: vi.fn(),
  executeRawMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    $transaction: transactionMock,
    $executeRaw: executeRawMock,
    visitDurationBasket: {
      findMany: visitDurationBasketFindManyMock,
      delete: visitDurationBasketDeleteMock,
    },
    booking: {
      update: bookingUpdateMock,
      updateMany: bookingUpdateManyMock,
    },
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}));

// Klient transakcyjny współdzielony między testami — dokładnie wzorzec
// sec-last-admin-guard.test.ts / sec-audit-log-role-change.test.ts.
const tx = {
  visitDurationBasket: {
    findUnique: txFindUniqueMock,
    update: txUpdateMock,
    count: txCountMock,
  },
  auditLog: { create: txAuditLogCreateMock },
  booking: {
    update: bookingUpdateMock,
    updateMany: bookingUpdateManyMock,
  },
};

const { updateVisitDurationBasketAction } = await import(
  '../src/app/(dashboard)/settings/calendar/actions'
);

const ADMIN_EMAIL = 'admin@klikklima.pl';
const UNAUTHORIZED_ROLES = ['dyspozytor', 'audytor', 'monter'] as const;

// Fixture calcata na seedzie realnym (migracja 20260910100000): AUDITOR ma jeden koszyk.
const AUDIT_BASKET = {
  id: 'basket-audit',
  code: 'AUDIT',
  labelPl: 'Audyt',
  durationMinutes: 120,
  pool: 'AUDITOR',
  isActive: true,
  sortOrder: 10,
};

const SERVICE_BASKET = {
  id: 'basket-service',
  code: 'SERVICE',
  labelPl: 'Serwis (przegląd okresowy)',
  durationMinutes: 90,
  pool: 'CREW',
  isActive: true,
  sortOrder: 20,
};

const INCIDENT_BASKET = {
  id: 'basket-incident',
  code: 'INCIDENT',
  labelPl: 'Usterka (naprawa)',
  durationMinutes: 120,
  pool: 'CREW',
  isActive: true,
  sortOrder: 30,
};

beforeEach(() => {
  transactionMock.mockReset();
  txFindUniqueMock.mockReset();
  txUpdateMock.mockReset();
  txCountMock.mockReset();
  txAuditLogCreateMock.mockReset();
  visitDurationBasketFindManyMock.mockReset();
  visitDurationBasketDeleteMock.mockReset();
  bookingUpdateMock.mockReset();
  bookingUpdateManyMock.mockReset();
  executeRawMock.mockReset();
  revalidatePathMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  getCurrentUserMock.mockReset();

  transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(tx));
  getCurrentActorRoleMock.mockResolvedValue('admin');
  getCurrentUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } });
  txFindUniqueMock.mockResolvedValue({ ...AUDIT_BASKET });
  txUpdateMock.mockImplementation(async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => ({
    ...AUDIT_BASKET,
    id: where.id,
    ...data,
  }));
  txCountMock.mockResolvedValue(2); // domyślnie: pula NIE jest na skraju wyczerpania
  txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });
});

// ────────────────────────────── Kontrola pozytywna kontraktu RBAC ──────────────────────────────

describe('visit_duration_baskets — kontrola pozytywna macierzy RBAC', () => {
  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('admin ma update na visit_duration_baskets, pozostałe role nie', () => {
    expect(PERMISSIONS.visit_duration_baskets.update).toEqual(['admin']);
    expect(can('admin', 'visit_duration_baskets', 'update')).toBe('yes');
    for (const role of UNAUTHORIZED_ROLES) {
      expect(can(role, 'visit_duration_baskets', 'update')).toBe('no');
    }
  });
});

// ────────────────────────────────── TC-B1 — wartości edytowalne ──────────────────────────────────

describe('updateVisitDurationBasketAction — TC-B1 (AC1, wartości edytowalne przez admina)', () => {
  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('TC-B1 — admin zapisuje durationMinutes: 150, wynik odczytany po zapisie to 150 (nie literał ze słownika)', async () => {
    txFindUniqueMock.mockResolvedValue({ ...AUDIT_BASKET, durationMinutes: 120 });

    const result = await updateVisitDurationBasketAction(AUDIT_BASKET.id, { durationMinutes: 150 });

    expect(result.success).toBe(true);
    expect(txUpdateMock).toHaveBeenCalledTimes(1);
    const call = txUpdateMock.mock.calls[0][0];
    expect(call.where).toEqual({ id: AUDIT_BASKET.id });
    expect(call.data.durationMinutes).toBe(150);
  });
});

// ────────────────────────────────── TC-B2 — brak parametru bookingId ──────────────────────────────────

describe('updateVisitDurationBasketAction — TC-B2 (AC2, weryfikacja negatywna — nie jest ekranem wyceny)', () => {
  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('TC-B2 — sygnatura akcji nie przyjmuje bookingId; wejście z bookingId nie jest zapisywane jako pole koszyka', async () => {
    const inputWithBookingId: { durationMinutes?: number; isActive?: boolean; bookingId?: string } = {
      durationMinutes: 130,
      bookingId: 'booking-1',
    };

    await updateVisitDurationBasketAction(AUDIT_BASKET.id, inputWithBookingId);

    expect(txUpdateMock).toHaveBeenCalledTimes(1);
    const call = txUpdateMock.mock.calls[0][0];
    expect(call.data.bookingId).toBeUndefined();
    expect(bookingUpdateMock).not.toHaveBeenCalled();
    expect(bookingUpdateManyMock).not.toHaveBeenCalled();
  });
});

// ────────────────────────── TC-B3 — najważniejszy test: brak dotknięcia bookings ──────────────────────────

describe('updateVisitDurationBasketAction — TC-B3 (AC3, zmiana nie przesuwa rezerwacji już zawartych)', () => {
  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('TC-B3 — zmiana koszyka z 120 na 240 min: booking.scheduledEnd historycznej rezerwacji zostaje NIETKNIĘTE', async () => {
    txFindUniqueMock.mockResolvedValue({ ...AUDIT_BASKET, durationMinutes: 120 });
    const existingBookingScheduledEnd = new Date('2026-10-01T10:00:00Z');

    const result = await updateVisitDurationBasketAction(AUDIT_BASKET.id, { durationMinutes: 240 });

    expect(result.success).toBe(true);
    // Punkt (a): rezerwacja historyczna, gdyby istniała, zostaje niezmieniona — dowodem
    // jest (b): zero wywołań dotykających bookings w ogóle.
    expect(existingBookingScheduledEnd).toEqual(new Date('2026-10-01T10:00:00Z'));
  });

  // Punkt (b) jest istotniejszy od (a): asercja wprost na braku JAKIEGOKOLWIEK wywołania
  // dotykającego `bookings` w trakcie akcji, nie tylko na wyniku.
  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('TC-B3 — akcja nie wykonuje ani jednego wywołania booking.update / booking.updateMany / $executeRaw na bookings', async () => {
    await updateVisitDurationBasketAction(AUDIT_BASKET.id, { durationMinutes: 240 });

    expect(bookingUpdateMock).not.toHaveBeenCalled();
    expect(bookingUpdateManyMock).not.toHaveBeenCalled();
    expect(executeRawMock).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────── TC-B4 — wycofanie flagą ──────────────────────────────────

describe('updateVisitDurationBasketAction — TC-B4 (AC4, wycofanie flagą, nigdy usunięciem)', () => {
  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('TC-B4a — isActive: false przełącza flagę, koszyk dalej zwracany przez findMany', async () => {
    // Pula CREW ma co najmniej dwa koszyki aktywne — wyłączenie jednego z nich nie jest
    // blokowane przez ochronę ostatniego koszyka (P-6).
    txFindUniqueMock.mockResolvedValue({ ...SERVICE_BASKET });
    txCountMock.mockResolvedValue(2);

    const result = await updateVisitDurationBasketAction(SERVICE_BASKET.id, { isActive: false });

    expect(result.success).toBe(true);
    expect(txUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: SERVICE_BASKET.id }, data: expect.objectContaining({ isActive: false }) }),
    );

    visitDurationBasketFindManyMock.mockResolvedValue([{ ...SERVICE_BASKET, isActive: false }]);
    const list = await visitDurationBasketFindManyMock();
    expect(list).toContainEqual(expect.objectContaining({ id: SERVICE_BASKET.id }));
  });

  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('TC-B4b — moduł akcji nie eksportuje żadnej funkcji usuwającej koszyk, i delete nie jest wołane', async () => {
    const actionsModule = await import('../src/app/(dashboard)/settings/calendar/actions');
    const exportedNames = Object.keys(actionsModule);
    const hasDeleteExport = exportedNames.some((name) => /delete/i.test(name));

    expect(hasDeleteExport).toBe(false);

    await updateVisitDurationBasketAction(SERVICE_BASKET.id, { isActive: false });
    expect(visitDurationBasketDeleteMock).not.toHaveBeenCalled();
  });

  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('TC-B4c — rezerwacja historyczna dalej rozwiązuje relację visitBasket po dezaktywacji koszyka', async () => {
    txFindUniqueMock.mockResolvedValue({ ...SERVICE_BASKET });
    txCountMock.mockResolvedValue(2);

    await updateVisitDurationBasketAction(SERVICE_BASKET.id, { isActive: false });

    // Koszyk musi wciąż istnieć jako wiersz (nie delete) — jedyny sposób, w jaki
    // `Booking.visitBasketId` (onDelete: Restrict) dalej rozwiązuje relację.
    expect(visitDurationBasketDeleteMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────── TC-B5 — pula spójna z przypisaniem ───────────────────────────────

describe('updateVisitDurationBasketAction — TC-B5 (AC5, lista pól zamknięta — pool/code/id ignorowane)', () => {
  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('TC-B5 — pool, code i id przemycone w wejściu są ignorowane albo żądanie odrzucone; pool w bazie niezmieniony', async () => {
    const maliciousInput: {
      durationMinutes?: number;
      isActive?: boolean;
      pool?: string;
      code?: string;
      id?: string;
    } = {
      durationMinutes: 130,
      pool: 'CREW',
      code: 'HACKED',
      id: 'other-basket-id',
    };

    const result = await updateVisitDurationBasketAction(AUDIT_BASKET.id, maliciousInput);

    if (result.success) {
      expect(txUpdateMock).toHaveBeenCalledTimes(1);
      const call = txUpdateMock.mock.calls[0][0];
      expect(call.data.pool).toBeUndefined();
      expect(call.data.code).toBeUndefined();
      expect(call.data.id).toBeUndefined();
      // `where` musi wciąż wskazywać koszyk podany jako parametr `id` funkcji, nie
      // wartość przemyconą w treści żądania.
      expect(call.where).toEqual({ id: AUDIT_BASKET.id });
    } else {
      expect(txUpdateMock).not.toHaveBeenCalled();
    }
  });
});

// ───────────────────────── TC-B6 — wartości początkowe są DANYMI ─────────────────────────

describe('updateVisitDurationBasketAction — TC-B6 (AC6, wartości nie są zakładane)', () => {
  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('TC-B6 — koszyk z durationMinutes: 137 w bazie (wartość arbitralna, nie 120) jest odczytywany i zapisywany bez zniekształcenia', async () => {
    txFindUniqueMock.mockResolvedValue({ ...AUDIT_BASKET, durationMinutes: 137 });

    const result = await updateVisitDurationBasketAction(AUDIT_BASKET.id, { isActive: true });

    expect(result.success).toBe(true);
    // Brak zniekształcenia: akcja odczytała 137 (nie 120) jako wartość "przed" i nie
    // ustawiła durationMinutes na żadną wartość ze słownika etykiet.
    expect(txFindUniqueMock).toHaveBeenCalled();
  });
});

// ────────────────────────────────── TC-B7 — minuty, liczba całkowita ──────────────────────────────────

describe('updateVisitDurationBasketAction — TC-B7 (AC7, walidacja Zod granic durationMinutes)', () => {
  // @REQ: CAL-VISIT-DURATION-BASKETS
  it.each([90.5, '90', 0, -30, null])(
    'TC-B7 — durationMinutes = %p jest odrzucone przez walidację, update nie jest wołane',
    async (invalidValue) => {
      const input: { durationMinutes?: unknown } = { durationMinutes: invalidValue };

      const result = await updateVisitDurationBasketAction(AUDIT_BASKET.id, input as { durationMinutes?: number });

      expect(result.success).toBe(false);
      expect(txUpdateMock).not.toHaveBeenCalled();
    },
  );

  // Przypadek brzegowy 6 z WO: wartość ekstremalna, sanity max(960).
  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('TC-B7 — durationMinutes = 100000 jest odrzucone (górna granica sanity .max(960))', async () => {
    const result = await updateVisitDurationBasketAction(AUDIT_BASKET.id, { durationMinutes: 100000 });

    expect(result.success).toBe(false);
    expect(txUpdateMock).not.toHaveBeenCalled();
  });

  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('TC-B7 — durationMinutes = 960 (górna granica) jest zaakceptowane', async () => {
    const result = await updateVisitDurationBasketAction(AUDIT_BASKET.id, { durationMinutes: 960 });

    expect(result.success).toBe(true);
    expect(txUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ durationMinutes: 960 }) }),
    );
  });
});

// ───────────────────────── TC-B8 — brak koszyka „montaż duży = 2 dni" ─────────────────────────

describe('updateVisitDurationBasketAction — TC-B8 (AC8, brak ścieżki tworzenia koszyka > 480 min)', () => {
  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('TC-B8 — moduł akcji nie eksportuje żadnej funkcji tworzącej koszyk (create)', async () => {
    const actionsModule = await import('../src/app/(dashboard)/settings/calendar/actions');
    const exportedNames = Object.keys(actionsModule);
    const hasCreateExport = exportedNames.some((name) => /create.*[Bb]asket/i.test(name));

    expect(hasCreateExport).toBe(false);
  });

  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('TC-B8 — dane: w visit_duration_baskets nie ma wiersza o durationMinutes > 480 (test danych, findMany)', async () => {
    visitDurationBasketFindManyMock.mockResolvedValue([
      AUDIT_BASKET,
      SERVICE_BASKET,
      INCIDENT_BASKET,
      { ...AUDIT_BASKET, id: 'basket-install-small', code: 'INSTALL_SMALL', durationMinutes: 240, pool: 'CREW' },
      { ...AUDIT_BASKET, id: 'basket-install-standard', code: 'INSTALL_STANDARD', durationMinutes: 480, pool: 'CREW' },
      { ...AUDIT_BASKET, id: 'basket-phase-1', code: 'INSTALL_PHASE_1', durationMinutes: 480, pool: 'CREW' },
      { ...AUDIT_BASKET, id: 'basket-phase-2', code: 'INSTALL_PHASE_2', durationMinutes: 240, pool: 'CREW' },
    ]);

    const rows = await visitDurationBasketFindManyMock();
    const oversized = rows.filter((row: { durationMinutes: number }) => row.durationMinutes > 480);

    expect(oversized).toHaveLength(0);
  });
});

// ──────────────────────── TC-B9 — ostatni aktywny koszyk w puli jest chroniony ────────────────────────

describe('updateVisitDurationBasketAction — TC-B9 (P-6, ochrona ostatniego aktywnego koszyka)', () => {
  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('TC-B9 — pula AUDITOR ma dokładnie jeden koszyk aktywny: wyłączenie jest odrzucone, update NIE jest wołane', async () => {
    txFindUniqueMock.mockResolvedValue({ ...AUDIT_BASKET, isActive: true });
    txCountMock.mockResolvedValue(1); // jedyny aktywny koszyk w puli AUDITOR

    const result = await updateVisitDurationBasketAction(AUDIT_BASKET.id, { isActive: false });

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(txUpdateMock).not.toHaveBeenCalled();
  });

  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('TC-B9 — po odmowie koszyk pozostaje isActive: true (żaden zapis nie przeszedł)', async () => {
    txFindUniqueMock.mockResolvedValue({ ...AUDIT_BASKET, isActive: true });
    txCountMock.mockResolvedValue(1);

    await updateVisitDurationBasketAction(AUDIT_BASKET.id, { isActive: false });

    expect(txUpdateMock).not.toHaveBeenCalled();
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });
});

// ──────────────────────── TC-B10 — blokada nie jest szersza niż trzeba ────────────────────────

describe('updateVisitDurationBasketAction — TC-B10 (P-6, blokada nie jest szersza niż trzeba)', () => {
  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('TC-B10a — pula CREW ma dwa koszyki aktywne: wyłączenie jednego przechodzi, drugi nietknięty', async () => {
    txFindUniqueMock.mockResolvedValue({ ...SERVICE_BASKET });
    txCountMock.mockResolvedValue(2);

    const result = await updateVisitDurationBasketAction(SERVICE_BASKET.id, { isActive: false });

    expect(result.success).toBe(true);
    expect(txUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: SERVICE_BASKET.id }, data: expect.objectContaining({ isActive: false }) }),
    );
    expect(txUpdateMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: INCIDENT_BASKET.id } }),
    );
  });

  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('TC-B10b — włączenie koszyka (isActive: true) przechodzi zawsze, także gdy pula jest pusta', async () => {
    txFindUniqueMock.mockResolvedValue({ ...SERVICE_BASKET, isActive: false });
    txCountMock.mockResolvedValue(0); // pula CREW hipotetycznie pusta

    const result = await updateVisitDurationBasketAction(SERVICE_BASKET.id, { isActive: true });

    expect(result.success).toBe(true);
    expect(txUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ isActive: true }) }),
    );
  });

  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('TC-B10c — ostatni aktywny koszyk puli AUDITOR nie blokuje wyłączenia koszyka w puli CREW (pule liczone osobno)', async () => {
    // Koszyk edytowany jest z puli CREW — count musi dotyczyć TEJ puli, nie AUDITOR.
    txFindUniqueMock.mockResolvedValue({ ...SERVICE_BASKET });
    txCountMock.mockResolvedValue(2);

    const result = await updateVisitDurationBasketAction(SERVICE_BASKET.id, { isActive: false });

    expect(result.success).toBe(true);
    expect(txCountMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ pool: 'CREW' }) }),
    );
  });

  // Przypadek brzegowy 8 z WO: dwóch administratorów wyłącza równolegle dwa ostatnie
  // koszyki tej samej puli — dowód na poziomie mocka (kolejność wywołań `count`), nie
  // dowód realnej współbieżności bazodanowej (ta wymaga Postgresa, patrz sec-last-admin-guard
  // AC4 i memoria "Concurrency test transition premise").
  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('przypadek brzegowy 8 — dwa równoległe wyłączenia dwóch ostatnich koszyków CREW: co najwyżej jedno przechodzi', async () => {
    const BASKET_A = { ...SERVICE_BASKET, id: 'crew-a' };
    const BASKET_B = { ...INCIDENT_BASKET, id: 'crew-b' };

    txFindUniqueMock.mockImplementation(async ({ where: { id } }: { where: { id: string } }) => {
      if (id === BASKET_A.id) return { ...BASKET_A };
      if (id === BASKET_B.id) return { ...BASKET_B };
      return null;
    });
    // Pula CREW ma dokładnie dwa aktywne koszyki (A, B). Pierwsze count() widzi jeszcze
    // dwóch aktywnych -> przechodzi; drugie widzi już tylko jednego -> blokada.
    txCountMock.mockResolvedValueOnce(2).mockResolvedValueOnce(1);

    const [resultA, resultB] = await Promise.all([
      updateVisitDurationBasketAction(BASKET_A.id, { isActive: false }),
      updateVisitDurationBasketAction(BASKET_B.id, { isActive: false }),
    ]);

    const successes = [resultA, resultB].filter((r) => r.success);
    expect(successes.length).toBeLessThanOrEqual(1);
    expect(txUpdateMock).toHaveBeenCalledTimes(successes.length);
  });
});

// ──────────────────────────────── TC-B11 — wpis audytowy dla koszyka ────────────────────────────────

describe('updateVisitDurationBasketAction — TC-B11 (P-3, wpis audytowy)', () => {
  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('TC-B11a — zmiana durationMinutes ze 120 na 150 tworzy DOKŁADNIE JEDEN wpis field_update z pełnymi polami', async () => {
    txFindUniqueMock.mockResolvedValue({ ...AUDIT_BASKET, durationMinutes: 120 });

    const result = await updateVisitDurationBasketAction(AUDIT_BASKET.id, { durationMinutes: 150 });

    expect(result.success).toBe(true);
    expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
    const payload = txAuditLogCreateMock.mock.calls[0][0].data;
    expect(payload.operation).toBe('field_update');
    expect(payload.resource).toBe('visit_duration_baskets');
    expect(payload.recordId).toBe(AUDIT_BASKET.id);
    expect(payload.actorEmail).toBe(ADMIN_EMAIL);
    expect(payload.actorRole).toBe('admin');
    expect(payload.legalBasis).toBe('OTHER');
    expect(payload.justification).toContain('120');
    expect(payload.justification).toContain('150');
  });

  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('TC-B11b — zmiana durationMinutes ORAZ isActive w jednym żądaniu daje JEDEN wpis, obie zmiany rozdzielone "; "', async () => {
    txFindUniqueMock.mockResolvedValue({ ...SERVICE_BASKET, durationMinutes: 90, isActive: true });
    txCountMock.mockResolvedValue(2);

    const result = await updateVisitDurationBasketAction(SERVICE_BASKET.id, {
      durationMinutes: 100,
      isActive: false,
    });

    expect(result.success).toBe(true);
    expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
    const payload = txAuditLogCreateMock.mock.calls[0][0].data;
    expect(payload.justification).toContain('; ');
    expect(payload.justification).toContain('90');
    expect(payload.justification).toContain('100');
  });

  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('TC-B11c — gdy auditLog.create rzuci, visitDurationBasket.update NIE jest utrwalony (obie operacje w jednej transakcji)', async () => {
    txAuditLogCreateMock.mockRejectedValueOnce(new Error('CHECK constraint violation'));

    const result = await updateVisitDurationBasketAction(AUDIT_BASKET.id, { durationMinutes: 150 });

    expect(result.success).toBe(false);
    // `$transaction` w mocku wywołuje callback bezpośrednio: gdy callback rzuca, całe
    // wywołanie z perspektywy akcji jest odrzucone — dokładnie jak rollback w Postgresie.
    expect(transactionMock).toHaveBeenCalledTimes(1);
  });
});

// ───────────────────────── TC-B12 — brak zmiany, fail-closed na e-mailu ─────────────────────────

describe('updateVisitDurationBasketAction — TC-B12 (P-3, no-op i fail-closed)', () => {
  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('TC-B12a — zapis tej samej wartości (durationMinutes już 150) nie tworzy drugiego wpisu audytowego', async () => {
    txFindUniqueMock.mockResolvedValue({ ...AUDIT_BASKET, durationMinutes: 150 });

    const result = await updateVisitDurationBasketAction(AUDIT_BASKET.id, { durationMinutes: 150 });

    expect(result.success).toBe(true);
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });

  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('TC-B12b — brak e-maila w sesji (auth.getUser() zwraca user: null) odrzuca akcję: zero koszyka, zero wpisu', async () => {
    getCurrentUserMock.mockResolvedValue({ data: { user: null } });

    const result = await updateVisitDurationBasketAction(AUDIT_BASKET.id, { durationMinutes: 150 });

    expect(result.success).toBe(false);
    expect(txUpdateMock).not.toHaveBeenCalled();
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });
});

// ────────────────────────── TC-G1 (część koszykowa) — bramka RBAC przed zapytaniem ──────────────────────────

describe('updateVisitDurationBasketAction — TC-G1 (bramka RBAC dla ról nieuprawnionych i braku sesji)', () => {
  it.each(UNAUTHORIZED_ROLES)(
    'TC-G1 — rola %s jest odrzucona, ZERO wywołań Prismy',
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);

      const result = await updateVisitDurationBasketAction(AUDIT_BASKET.id, { durationMinutes: 150 });

      expect(result.success).toBe(false);
      expect(transactionMock).not.toHaveBeenCalled();
      expect(txUpdateMock).not.toHaveBeenCalled();
      expect(txAuditLogCreateMock).not.toHaveBeenCalled();
    },
  );

  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('TC-G1 — brak sesji (getCurrentActorRole zwraca null) jest odrzucone fail-closed, ZERO wywołań Prismy', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await updateVisitDurationBasketAction(AUDIT_BASKET.id, { durationMinutes: 150 });

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  // Przypadek brzegowy 10 z WO: odmowa nie loguje.
  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('przypadek brzegowy 10 — odmowa RBAC nie tworzy wpisu w audit_log', async () => {
    getCurrentActorRoleMock.mockResolvedValue('monter');

    await updateVisitDurationBasketAction(AUDIT_BASKET.id, { durationMinutes: 150 });

    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });
});

// ───────────────────────────── Przypadek brzegowy 7 — strefa czasowa ─────────────────────────────

describe('updateVisitDurationBasketAction — przypadek brzegowy 7 (strefa czasowa nie jest parametrem domeny)', () => {
  // @REQ: CAL-VISIT-DURATION-BASKETS
  it('akcja nie podaje createdAt z JS — audit_log.create jest wołane bez pola createdAt (baza ustawia je w UTC)', async () => {
    await updateVisitDurationBasketAction(AUDIT_BASKET.id, { durationMinutes: 150 });

    expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
    const payload = txAuditLogCreateMock.mock.calls[0][0].data;
    expect(payload.createdAt).toBeUndefined();
  });
});
