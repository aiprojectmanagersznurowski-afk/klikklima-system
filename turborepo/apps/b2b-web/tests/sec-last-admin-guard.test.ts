import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AUDIT_REQUIREMENTS } from '@klikklima/contracts';

/**
 * WO: docs/workorders/SEC-LAST-ADMIN-GUARD.md.
 * Wymaganie: `SEC-LAST-ADMIN-GUARD` (`contracts/requirements.contract.mjs:445-459`, status TODO).
 * Decyzja człowieka (2026-09-07): WYŁĄCZNIE warstwa Server Action — bez triggera/constraint
 * bazodanowego. Ten plik nie testuje niczego na poziomie bazy.
 *
 * Kod produkcyjny NIE MA dziś żadnej ochrony ostatniego admina na ścieżce `deleteAuthorizedUser`
 * (`apps/b2b-web/src/app/(dashboard)/settings/actions.ts:205-264`) — zero wywołań `findUnique`,
 * `count` czy sentinela `LastAdminError` w kontekście tej funkcji. RED w tym pliku jest
 * oczekiwany i jest dowodem braku implementacji, nie literówki: `deleteAuthorizedUser` istnieje
 * i jest poprawnie importowalna, ale dzisiejsza treść transakcji (jedno `tx.authorizedUser.delete`
 * + `tx.auditLog.create`, bez opcji izolacji) nie wywołuje `tx.authorizedUser.findUnique` ani
 * `tx.authorizedUser.count`, więc te mocki pozostają nietknięte, a asercje na nich padają.
 *
 * Wzorzec do skopiowania (WO, "Wzorzec do skopiowania"): 1:1 z `updateAuthorizedUserRoleAction`
 * (ten sam plik, `:286-370`, już zaimplementowana i przetestowana w
 * `sec-audit-log-role-change.test.ts`). Struktura mocków w tym pliku jest zamierzenie
 * analogiczna do tamtego pliku (współdzielony obiekt `tx`, `transactionMock.mockImplementation`
 * wołające `callback(tx)`), rozszerzona o `tx.authorizedUser.delete` (funkcja usuwana, nie
 * aktualizowana) i bez `roleChangeSchema` (ta ścieżka używa `deleteJustificationSchema`, bez
 * zmian w tym WO).
 */

const {
  transactionMock,
  txFindUniqueMock,
  txDeleteMock,
  txCountMock,
  txAuditLogCreateMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  txFindUniqueMock: vi.fn(),
  txDeleteMock: vi.fn(),
  txCountMock: vi.fn(),
  txAuditLogCreateMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    $transaction: transactionMock,
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}));

const tx = {
  authorizedUser: {
    findUnique: txFindUniqueMock,
    delete: txDeleteMock,
    count: txCountMock,
  },
  auditLog: { create: txAuditLogCreateMock },
};

// Import dynamiczny — `deleteAuthorizedUser` istnieje dziś, ale bez ochrony ostatniego
// admina. To NIE jest import na "is not a function": funkcja jest wołana normalnie, RED
// pochodzi z asercji na obserwowalnym zachowaniu (mocki nietknięte / wynik nieprawidłowy).
const { deleteAuthorizedUser } = await import('../src/app/(dashboard)/settings/actions');

const ADMIN_EMAIL = 'admin@klikklima.pl';
const VALID_BASIS = AUDIT_REQUIREMENTS.legalBases[0];
const VALID_JUSTIFICATION = 'Rozwiazanie umowy o prace ustalone z dzialem kadr.';
const VALID_INPUT = { justification: VALID_JUSTIFICATION, legalBasis: VALID_BASIS };

const ADMIN_A = { id: 'usr-admin-a', email: 'admin-a@klikklima.pl', role: 'admin' };
const ADMIN_B = { id: 'usr-admin-b', email: 'admin-b@klikklima.pl', role: 'admin' };
const NON_ADMIN = { id: 'usr-monter-1', email: 'monter@klikklima.pl', role: 'monter' };

const GENERIC_ERROR_MESSAGE = 'Wystąpił błąd podczas usuwania konta.';

beforeEach(() => {
  transactionMock.mockReset();
  txFindUniqueMock.mockReset();
  txDeleteMock.mockReset();
  txCountMock.mockReset();
  txAuditLogCreateMock.mockReset();
  revalidatePathMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  getCurrentUserMock.mockReset();

  transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(tx));
  getCurrentActorRoleMock.mockResolvedValue('admin');
  getCurrentUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } });
  txFindUniqueMock.mockResolvedValue({ ...ADMIN_A });
  txCountMock.mockResolvedValue(2); // co najmniej dwa konta admin domyślnie — usunięcie nie jest blokowane
  txDeleteMock.mockResolvedValue({});
  txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });
});

// ────────────────────────────── AC1 — ostatni admin nie może zostać usunięty ──────────────────────────────

describe('deleteAuthorizedUser — ochrona ostatniego admina (SEC-LAST-ADMIN-GUARD, AC1)', () => {
  // @REQ: SEC-LAST-ADMIN-GUARD
  it('AC1 — usunięcie JEDYNEGO konta admin jest odrzucone: zero delete, zero wpisu audytowego', async () => {
    txFindUniqueMock.mockResolvedValue({ ...ADMIN_A });
    txCountMock.mockResolvedValue(1);

    const result = await deleteAuthorizedUser(ADMIN_A.id, VALID_INPUT);

    expect(result.success).toBe(false);
    expect(txDeleteMock).not.toHaveBeenCalled();
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });

  // @REQ: SEC-LAST-ADMIN-GUARD
  it('AC1 — po odrzuceniu revalidatePath nie jest wołane (operacja nie miała żadnego skutku)', async () => {
    txFindUniqueMock.mockResolvedValue({ ...ADMIN_A });
    txCountMock.mockResolvedValue(1);

    await deleteAuthorizedUser(ADMIN_A.id, VALID_INPUT);

    expect(revalidatePathMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────── AC2 — przy ≥2 adminach usunięcie przechodzi normalnie ───────────────────────────

describe('deleteAuthorizedUser — brak regresji przy ≥2 adminach lub koncie nie-admin (SEC-LAST-ADMIN-GUARD, AC2)', () => {
  // @REQ: SEC-LAST-ADMIN-GUARD
  it('AC2 — kontrola pozytywna: przy DWÓCH kontach admin usunięcie jednego z nich przechodzi', async () => {
    txFindUniqueMock.mockResolvedValue({ ...ADMIN_A });
    txCountMock.mockResolvedValue(2);

    const result = await deleteAuthorizedUser(ADMIN_A.id, VALID_INPUT);

    expect(result.success).toBe(true);
    expect(txDeleteMock).toHaveBeenCalledTimes(1);
    expect(txDeleteMock).toHaveBeenCalledWith(expect.objectContaining({ where: { id: ADMIN_A.id } }));
    expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
    const payload = txAuditLogCreateMock.mock.calls[0][0].data;
    expect(payload.operation).toBe('delete');
    expect(payload.resource).toBe('authorized_users');
    expect(payload.recordId).toBe(ADMIN_A.id);
  });

  // @REQ: SEC-LAST-ADMIN-GUARD
  it('AC2 — usunięcie konta o roli innej niż admin przechodzi normalnie, niezależnie od liczby adminów', async () => {
    txFindUniqueMock.mockResolvedValue({ ...NON_ADMIN });
    txCountMock.mockResolvedValue(1); // choćby był tylko jeden admin w systemie — nie dotyczy tego konta

    const result = await deleteAuthorizedUser(NON_ADMIN.id, VALID_INPUT);

    expect(result.success).toBe(true);
    expect(txDeleteMock).toHaveBeenCalledTimes(1);
    expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
  });
});

// ──────────────────────── AC3 — liczenie adminów wewnątrz transakcji, przed delete ────────────────────────

describe('deleteAuthorizedUser — liczenie adminów wewnątrz $transaction, przed delete (SEC-LAST-ADMIN-GUARD, AC3)', () => {
  // Wzorem sec-audit-log-role-change.test.ts:496-513 (AC8) — dowód pośredni: `count` jest
  // odpytywane WEWNĄTRZ callbacku $transaction, nigdy przed jego wywołaniem.
  // @REQ: SEC-LAST-ADMIN-GUARD
  it('AC3 — sprawdzenie liczby adminów odbywa się wewnątrz callbacku $transaction, nie przed nim', async () => {
    txFindUniqueMock.mockResolvedValue({ ...ADMIN_A });
    txCountMock.mockResolvedValue(1);
    let countCalledBeforeTransaction = false;
    transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) => {
      countCalledBeforeTransaction = txCountMock.mock.calls.length > 0;
      return callback(tx);
    });

    await deleteAuthorizedUser(ADMIN_A.id, VALID_INPUT);

    expect(countCalledBeforeTransaction).toBe(false);
    expect(txCountMock).toHaveBeenCalled();
  });

  // @REQ: SEC-LAST-ADMIN-GUARD
  it('AC3 — count wywołane PRZED delete, oba w JEDNEJ transakcji', async () => {
    txFindUniqueMock.mockResolvedValue({ ...ADMIN_A });
    txCountMock.mockResolvedValue(2);

    await deleteAuthorizedUser(ADMIN_A.id, VALID_INPUT);

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(txCountMock).toHaveBeenCalled();
    expect(txDeleteMock).toHaveBeenCalled();
    expect(txCountMock.mock.invocationCallOrder[0]).toBeLessThan(
      txDeleteMock.mock.invocationCallOrder[0],
    );
  });

  // Inwariant dotyczy WYŁĄCZNIE usunięcia konta admin — usunięcie konta, które admin NIE
  // jest, nigdy nie sprawdza liczby adminów (nie ma się czego bać, wzorem
  // sec-audit-log-role-change.test.ts:455-466).
  // @REQ: SEC-LAST-ADMIN-GUARD
  it('AC3 — usunięcie konta niebędące adminem nigdy nie liczy adminów', async () => {
    txFindUniqueMock.mockResolvedValue({ ...NON_ADMIN });

    await deleteAuthorizedUser(NON_ADMIN.id, VALID_INPUT);

    expect(txCountMock).not.toHaveBeenCalled();
  });

  // findUnique -> count -> delete -> auditLog.create, w tej kolejności, wewnątrz jednej
  // transakcji (wzorem sec-audit-log-role-change.test.ts:386-397).
  // @REQ: SEC-LAST-ADMIN-GUARD
  it('AC3 — kolejność findUnique -> count -> delete -> auditLog.create wewnątrz jednej transakcji', async () => {
    txFindUniqueMock.mockResolvedValue({ ...ADMIN_A });
    txCountMock.mockResolvedValue(2);

    await deleteAuthorizedUser(ADMIN_A.id, VALID_INPUT);

    expect(txFindUniqueMock).toHaveBeenCalled();
    expect(txCountMock).toHaveBeenCalled();
    expect(txDeleteMock).toHaveBeenCalled();
    expect(txAuditLogCreateMock).toHaveBeenCalled();
    expect(txFindUniqueMock.mock.invocationCallOrder[0]).toBeLessThan(
      txCountMock.mock.invocationCallOrder[0],
    );
    expect(txCountMock.mock.invocationCallOrder[0]).toBeLessThan(
      txDeleteMock.mock.invocationCallOrder[0],
    );
    expect(txDeleteMock.mock.invocationCallOrder[0]).toBeLessThan(
      txAuditLogCreateMock.mock.invocationCallOrder[0],
    );
  });
});

// ───────────────────────────────────── AC4 — współbieżność ─────────────────────────────────────

describe('deleteAuthorizedUser — współbieżność (SEC-LAST-ADMIN-GUARD, AC4, pułapka 4 CLAUDE.md)', () => {
  // Warunek strukturalny na to, żeby Postgres (Serializable) mógł w ogóle wyłapać
  // rzeczywisty wyścig — bez tej opcji rozstrzygnięcie zapadałoby na domyślnym poziomie
  // izolacji, niewystarczającym dla AC4 (wzorem
  // sec-audit-log-role-change.test.ts:402-411, `deleteAuthorizedUser` dziś jej NIE MA).
  // @REQ: SEC-LAST-ADMIN-GUARD
  it("AC4 — prisma.\$transaction wywołane z drugim argumentem { isolationLevel: 'Serializable' }", async () => {
    await deleteAuthorizedUser(ADMIN_A.id, VALID_INPUT);

    const secondArg = transactionMock.mock.calls[0]?.[1];
    expect(secondArg).toEqual({ isolationLevel: 'Serializable' });
  });

  // Dowód na poziomie mocka (kolejność wywołań `count`), NIE dowód realnej współbieżności
  // bazodanowej — ten sam zastrzeżenie jak w sec-audit-log-delete-wave-a.test.ts:405-414.
  // Scenariusz: system ma dokładnie dwa konta admin (ADMIN_A, ADMIN_B); dwa równoległe
  // wywołania próbują usunąć KAŻDE z nich. Pierwsze wywołanie count() (call1, ADMIN_A)
  // widzi jeszcze dwóch adminów -> przechodzi; drugie wywołanie count() (call2, ADMIN_B)
  // widzi już tylko jednego -> zablokowane. Co najwyżej jeden sukces.
  // @REQ: SEC-LAST-ADMIN-GUARD
  it('AC4 — dwa równoległe wywołania na dwóch różnych, jedynych kontach admin: co najwyżej jeden sukces', async () => {
    txFindUniqueMock.mockImplementation(async ({ where: { id } }: { where: { id: string } }) => {
      if (id === ADMIN_A.id) return { ...ADMIN_A };
      if (id === ADMIN_B.id) return { ...ADMIN_B };
      return null;
    });
    txCountMock.mockResolvedValueOnce(2).mockResolvedValueOnce(1);

    const [a, b] = await Promise.all([
      deleteAuthorizedUser(ADMIN_A.id, VALID_INPUT),
      deleteAuthorizedUser(ADMIN_B.id, VALID_INPUT),
    ]);

    const successes = [a, b].filter((r) => r.success);
    expect(successes.length).toBeLessThanOrEqual(1);
    expect(txDeleteMock).toHaveBeenCalledTimes(successes.length);
  });
});

// ────────────────────────── AC5 — sentinel błędu odróżnialny od innych awarii ──────────────────────────

describe('deleteAuthorizedUser — sentinel błędu ostatniego admina (SEC-LAST-ADMIN-GUARD, AC5)', () => {
  // @REQ: SEC-LAST-ADMIN-GUARD
  it('AC5 — błąd ochrony ostatniego admina zwraca komunikat domenowy, różny od generycznego fallbacku', async () => {
    txFindUniqueMock.mockResolvedValue({ ...ADMIN_A });
    txCountMock.mockResolvedValue(1);

    const result = await deleteAuthorizedUser(ADMIN_A.id, VALID_INPUT);

    expect(result.success).toBe(false);
    expect(result.error).toBeTruthy();
    expect(result.error).not.toBe(GENERIC_ERROR_MESSAGE);
  });

  // @REQ: SEC-LAST-ADMIN-GUARD
  it('AC5 — inna awaria w tej samej transakcji (np. zapis auditLog) zwraca komunikat GENERYCZNY, różny od sentinela', async () => {
    txFindUniqueMock.mockResolvedValue({ ...ADMIN_A });
    txCountMock.mockResolvedValue(2); // inwariant nie blokuje — dwóch adminów
    txAuditLogCreateMock.mockRejectedValue(new Error('CHECK constraint violation'));

    const result = await deleteAuthorizedUser(ADMIN_A.id, VALID_INPUT);

    expect(result.success).toBe(false);
    expect(result.error).toBe(GENERIC_ERROR_MESSAGE);
  });

  // Sentinel nie ucieka poza akcję jako nieobsłużony wyjątek/reject — wywołanie się
  // ROZWIĄZUJE (resolves), nie odrzuca (rejects).
  // @REQ: SEC-LAST-ADMIN-GUARD
  it('AC5 — sentinel błędu ostatniego admina nie ucieka jako nieobsłużony wyjątek (promise resolves, nie rejects)', async () => {
    txFindUniqueMock.mockResolvedValue({ ...ADMIN_A });
    txCountMock.mockResolvedValue(1);

    await expect(deleteAuthorizedUser(ADMIN_A.id, VALID_INPUT)).resolves.toMatchObject({
      success: false,
    });
  });

  // Dwa różne komunikaty muszą się różnić między sobą — nie wystarczy, że oba są
  // "jakimś" tekstem; test dowodzi, że implementer faktycznie rozgałęzia catch na
  // `instanceof LastAdminError`, a nie że generyczny fallback przypadkiem pasuje.
  // @REQ: SEC-LAST-ADMIN-GUARD
  it('AC5 — komunikat sentinela różni się od komunikatu awarii generycznej w tym samym pliku testowym', async () => {
    txFindUniqueMock.mockResolvedValue({ ...ADMIN_A });
    txCountMock.mockResolvedValueOnce(1);
    const sentinelResult = await deleteAuthorizedUser(ADMIN_A.id, VALID_INPUT);

    txCountMock.mockResolvedValueOnce(2);
    txAuditLogCreateMock.mockRejectedValueOnce(new Error('deadlock'));
    const genericResult = await deleteAuthorizedUser(ADMIN_A.id, VALID_INPUT);

    expect(sentinelResult.error).not.toBe(genericResult.error);
  });
});

// ──────────────────────── AC6 — konta nieistniejące i konta niebędące adminem ────────────────────────

describe('deleteAuthorizedUser — brak regresji dla konta nieistniejącego (SEC-LAST-ADMIN-GUARD, AC6)', () => {
  // Dołożenie `findUnique` (warunek wstępny AC1/AC3, WO "Brakuje") nie zmienia
  // obserwowalnego wyniku dla konta, którego nie ma: odmowa, zero `delete`, zero wpisu.
  // Dodatkowo: inwariant admina nigdy nie jest sprawdzany, gdy nie ma czego sprawdzić.
  // @REQ: SEC-LAST-ADMIN-GUARD
  it('AC6 — usunięcie konta nieistniejącego (findUnique zwraca null) kończy się odmową, zero delete, zero count, zero wpisu', async () => {
    txFindUniqueMock.mockResolvedValue(null);

    const result = await deleteAuthorizedUser('usr-nieistniejacy', VALID_INPUT);

    expect(result.success).toBe(false);
    expect(txDeleteMock).not.toHaveBeenCalled();
    expect(txCountMock).not.toHaveBeenCalled();
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });
});
