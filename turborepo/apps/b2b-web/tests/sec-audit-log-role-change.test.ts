import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { ROLES, can, AUDIT_REQUIREMENTS } from '@klikklima/contracts';

/**
 * WO: docs/workorders/SEC-AUDIT-LOG-ROLE-CHANGE.md (część 2 z 4 rozbicia SEC-AUDIT-LOG).
 * Wymaganie: `SEC-AUDIT-LOG-ROLE-CHANGE` (`contracts/requirements.contract.mjs`, status TODO,
 * `acceptance` AC1-AC20 — lista tam jest ostateczna, dokładniejsza niż WO w kilku miejscach:
 * AC17-AC20 zostały dopisane dla przypadków brzegowych i to one, nie WO, rozstrzygają szczegóły
 * poniżej, gdziekolwiek się różnią).
 *
 * Kod produkcyjny NIE ISTNIEJE: `updateAuthorizedUserRoleAction` nie jest dziś eksportowana
 * z `apps/b2b-web/src/app/(dashboard)/settings/actions.ts`. RED w tym pliku jest oczekiwany —
 * dowodem braku implementacji, nie literówki.
 *
 * ═══ KONTRAKT Z IMPLEMENTER-SERVER (analogiczny do `deleteAuditorAction`/`deleteCrewAction`,
 * `sec-audit-log-delete-wave-b.test.ts`) ═══
 * Sygnatura: `updateAuthorizedUserRoleAction(id: string, input: { role: string; justification:
 * string; legalBasis: string }): Promise<{ success: boolean; error?: string }>`.
 * Wewnątrz `prisma.$transaction(async (tx) => { ... }, { isolationLevel: 'Serializable' })`
 * (wzorzec `deleteAuditorAction`), w tej kolejności:
 *   1. `tx.authorizedUser.findUnique({ where: { id } })` — odczyt konta DOCELOWEGO po `id`,
 *      NIGDY po e-mailu (AC20).
 *   2. Rekord nieznaleziony → odmowa, zero dalszych zapytań (AC11).
 *   3. Rola docelowa identyczna z bieżącą → no-op, zero `update`, zero `auditLog.create` (AC9).
 *   4. Rekord docelowy ma dziś rolę `admin`, a nowa rola jest inna → sprawdzenie inwariantu:
 *      `tx.authorizedUser.count({ where: { role: 'admin' } })`; wynik `1` → odmowa, zero
 *      `update`, zero wpisu (AC7/AC8). To jest jedyny miejsce, w którym mockujemy `count` —
 *      test-author nie narzuca implementerowi DOKŁADNIE tej nazwy metody Prismy, ale narzuca
 *      OBSERWOWALNY efekt: przy jednym koncie `admin` degradacja jest zablokowana, a decyzja
 *      zapada W TRANSAKCJI `Serializable`, nie przez odczyt poprzedzający zapis w JS.
 *   5. `tx.authorizedUser.update({ where: { id }, data: { role } })`.
 *   6. `tx.auditLog.create({ data: { operation: 'role_change', resource: 'authorized_users',
 *      recordId: id, actorEmail, actorRole, justification: <z prefiksem D2>, legalBasis } })`.
 * `actorRole` pochodzi z `getCurrentActorRole()` WYWOŁANEGO RAZ, PRZED transakcją — jego wartość
 * jest zamrożona jako tekst przekazany do `tx.auditLog.create`, nie odczytywana ponownie.
 *
 * Schemat wejścia: rozszerzenie `deleteJustificationSchema` przez `.extend({ role: z.enum(ROLES) })`
 * w nowym pliku `apps/b2b-web/src/lib/audit/role-change-schema.ts`, eksport `roleChangeSchema`
 * (AC15) — NIE nowy, niezależny schemat (złamałoby to zielony `sec-audit-log-delete-static.test.ts:253`,
 * cudze, już zaliczone wymaganie).
 */

const {
  transactionMock,
  txFindUniqueMock,
  txUpdateMock,
  txCountMock,
  txAuditLogCreateMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  txFindUniqueMock: vi.fn(),
  txUpdateMock: vi.fn(),
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
    update: txUpdateMock,
    count: txCountMock,
  },
  auditLog: { create: txAuditLogCreateMock },
};

// Import dynamiczny — funkcja nie istnieje dziś, `updateAuthorizedUserRoleAction` będzie
// `undefined`, a wywołanie `cfg.fn(...)` w testach padnie na "is not a function". To jest
// poprawny RED (brak eksportu funkcji domenowej), nie literówka ani błąd składni.
const actionsModule = await import('../src/app/(dashboard)/settings/actions');
const updateAuthorizedUserRoleAction = (actionsModule as Record<string, unknown>)
  .updateAuthorizedUserRoleAction as (
  id: string,
  input: { role: string; justification: string; legalBasis: string },
) => Promise<{ success: boolean; error?: string; changed?: boolean }>;

const ADMIN_EMAIL = 'admin@klikklima.pl';
const VALID_BASIS = AUDIT_REQUIREMENTS.legalBases[4]; // 'OTHER' — decyzja D1
const INVALID_BASIS = 'NIEISTNIEJACA_PODSTAWA';
const VALID_JUSTIFICATION = 'Zmiana zakresu obowiazkow ustalona z kierownictwem operacyjnym.';

const TARGET = { id: 'usr-target-1', email: 'pracownik@klikklima.pl', role: 'monter' };
const SOLE_ADMIN = { id: 'usr-admin-1', email: ADMIN_EMAIL, role: 'admin' };

beforeEach(() => {
  transactionMock.mockReset();
  txFindUniqueMock.mockReset();
  txUpdateMock.mockReset();
  txCountMock.mockReset();
  txAuditLogCreateMock.mockReset();
  revalidatePathMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  getCurrentUserMock.mockReset();

  transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(tx));
  getCurrentActorRoleMock.mockResolvedValue('admin');
  getCurrentUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } });
  txFindUniqueMock.mockResolvedValue({ ...TARGET });
  txCountMock.mockResolvedValue(2); // co najmniej dwa konta admin domyślnie — degradacja nie jest blokowana
  txUpdateMock.mockResolvedValue({});
  txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });
});

// ─────────────────────────── AC4/AC5 — bramka roli, fail-closed ───────────────────────────

describe('updateAuthorizedUserRoleAction — bramka roli i fail-closed (SEC-AUDIT-LOG-ROLE-CHANGE)', () => {
  // Kontrola pozytywna kontraktu — bez niej AC4 mógłby przechodzić, gdyby bramka odrzucała
  // wszystkich (w tym admina), a test nigdy by tego nie zauważył.
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('kontrola pozytywna kontraktu — RBAC rozróżnia role na authorized_users.update', () => {
    expect(can('admin', 'authorized_users', 'update')).toBe('yes');
    const denied = ROLES.filter((r) => can(r, 'authorized_users', 'update') !== 'yes');
    expect(denied.length).toBeGreaterThan(0);
  });

  const DENIED_ROLES = ROLES.filter((r) => can(r, 'authorized_users', 'update') !== 'yes');

  // AC4 — wywołanie przez rolę bez `update` jest odrzucone, zero zapytań.
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it.each(DENIED_ROLES)('rola %s odrzucona po stronie serwera, zero transakcji i zero wpisu', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);

    const result = await updateAuthorizedUserRoleAction(TARGET.id, {
      role: 'dyspozytor',
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(false);
    expect(getCurrentUserMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
    expect(txUpdateMock).not.toHaveBeenCalled();
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });

  // AC5 — brak roli (null), fail-closed.
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('brak roli (null) odrzucony fail-closed, zero zapytań', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await updateAuthorizedUserRoleAction(TARGET.id, {
      role: 'dyspozytor',
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  // AC5 — rola zwrócona przez sesję nierozpoznana przez ROLES (spoza macierzy) — bramka `can()`
  // odrzuca ją naturalnie (brak wpisu w PERMISSIONS), fail-closed bez specjalnej gałęzi kodu.
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('rola z sesji nierozpoznana przez ROLES odrzucona fail-closed, zero zapytań', async () => {
    getCurrentActorRoleMock.mockResolvedValue('SUPERADMIN' as never);

    const result = await updateAuthorizedUserRoleAction(TARGET.id, {
      role: 'dyspozytor',
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  // AC5 — wyjątek z getCurrentActorRole() daje odmowę, nie nieobsłużony reject/500.
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('wyjątek z getCurrentActorRole() daje odmowę uprawnień jako wynik domenowy', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('sesja wygasła'));

    await expect(
      updateAuthorizedUserRoleAction(TARGET.id, {
        role: 'dyspozytor',
        justification: VALID_JUSTIFICATION,
        legalBasis: VALID_BASIS,
      }),
    ).resolves.toMatchObject({ success: false });
    expect(transactionMock).not.toHaveBeenCalled();
  });

  // AC5 — sesja bez adresu e-mail odrzucona PRZED jakąkolwiek transakcją.
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('brak e-maila w sesji odrzucony fail-closed, PRZED transakcją', async () => {
    getCurrentUserMock.mockResolvedValue({ data: { user: { email: null } } });

    const result = await updateAuthorizedUserRoleAction(TARGET.id, {
      role: 'dyspozytor',
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  // AC5 — brak sesji w ogóle.
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('brak sesji (user: null) odrzucony fail-closed, PRZED transakcją', async () => {
    getCurrentUserMock.mockResolvedValue({ data: { user: null } });

    const result = await updateAuthorizedUserRoleAction(TARGET.id, {
      role: 'dyspozytor',
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────── AC6 — walidacja wejścia ───────────────────────────────────

describe('updateAuthorizedUserRoleAction — walidacja wejścia (SEC-AUDIT-LOG-ROLE-CHANGE, AC6)', () => {
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it.each(['superadmin', '', 'ADMIN', null])(
    'rola docelowa spoza ROLES (%j) odrzucona bez zapisu, nawet dla wywołującego admin',
    async (invalidRole) => {
      const result = await updateAuthorizedUserRoleAction(TARGET.id, {
        role: invalidRole as unknown as string,
        justification: VALID_JUSTIFICATION,
        legalBasis: VALID_BASIS,
      });

      expect(result.success).toBe(false);
      expect(transactionMock).not.toHaveBeenCalled();
      expect(txAuditLogCreateMock).not.toHaveBeenCalled();
    },
  );

  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it.each([
    ['', 'pusty string'],
    ['   ', 'same białe znaki'],
    ['  123456789  ', '9 znaków po trim'],
  ] as const)('justification niepoprawny (%s — %s) odrzucony bez żadnego zapisu', async (justification, _opis) => {
    const result = await updateAuthorizedUserRoleAction(TARGET.id, {
      role: 'dyspozytor',
      justification,
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });

  // Granica: dokładnie 10 znaków po trim (z otaczającymi spacjami) jest dozwolone.
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('justification dokładnie 10 znaków po trim jest dozwolony', async () => {
    const result = await updateAuthorizedUserRoleAction(TARGET.id, {
      role: 'dyspozytor',
      justification: '  1234567890  ',
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(true);
    expect(transactionMock).toHaveBeenCalledTimes(1);
  });

  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('legalBasis spoza AUDIT_REQUIREMENTS.legalBases odrzucony bez żadnego zapisu', async () => {
    expect(AUDIT_REQUIREMENTS.legalBases).not.toContain(INVALID_BASIS);

    const result = await updateAuthorizedUserRoleAction(TARGET.id, {
      role: 'dyspozytor',
      justification: VALID_JUSTIFICATION,
      legalBasis: INVALID_BASIS,
    });

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  // Kontrola pozytywna: wszystkie pięć wartości kontraktu są dozwolone (D1 — lista NIE jest
  // zawężana w formularzu/serwerze).
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it.each(AUDIT_REQUIREMENTS.legalBases)('legalBasis %s (z kontraktu) jest dozwolony', async (basis) => {
    const result = await updateAuthorizedUserRoleAction(TARGET.id, {
      role: 'dyspozytor',
      justification: VALID_JUSTIFICATION,
      legalBasis: basis,
    });

    expect(result.success).toBe(true);
  });
});

// ────────────────────────────── AC3, AC20 — kompletność i tożsamość wpisu ──────────────────────────────

describe('updateAuthorizedUserRoleAction — kompletność wpisu audytowego (SEC-AUDIT-LOG-ROLE-CHANGE, AC3/AC20)', () => {
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('wpis ma operation=role_change, resource=authorized_users, recordId=konto docelowe, actorEmail z sesji, actorRole z chwili operacji', async () => {
    getCurrentUserMock.mockResolvedValue({ data: { user: { email: 'ktos-inny@klikklima.pl' } } });

    await updateAuthorizedUserRoleAction(TARGET.id, {
      role: 'dyspozytor',
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
    const payload = txAuditLogCreateMock.mock.calls[0][0].data;
    expect(payload.operation).toBe('role_change');
    expect(payload.resource).toBe('authorized_users');
    expect(payload.recordId).toBe(TARGET.id);
    expect(payload.actorEmail).toBe('ktos-inny@klikklima.pl');
    expect(payload.actorRole).toBe('admin');
    expect(payload.legalBasis).toBe(VALID_BASIS);
  });

  // AC20 — tożsamość celu wyznacza `id`, nie e-mail: findUnique wewnątrz transakcji jest
  // wołane z `id`, a akcja nie przyjmuje e-maila jako identyfikatora celu (sygnatura z WO
  // ma dokładnie dwa parametry: `id` i `input`).
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('konto docelowe jest wyszukiwane po id, nie po e-mailu', async () => {
    await updateAuthorizedUserRoleAction(TARGET.id, {
      role: 'dyspozytor',
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(txFindUniqueMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TARGET.id } }),
    );
  });

  // Druga linia bazy: kod używa literałów z kontraktu, nie wartości spoza mustLog/RESOURCES.
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it("'role_change' jest jedną z sześciu wartości AUDIT_REQUIREMENTS.mustLog", () => {
    expect(AUDIT_REQUIREMENTS.mustLog).toContain('role_change');
  });
});

// ───────────────────────────────── AC2 — transakcyjność w obie strony ─────────────────────────────────

describe('updateAuthorizedUserRoleAction — transakcyjność (SEC-AUDIT-LOG-ROLE-CHANGE, AC2)', () => {
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('błąd auditLog.create → transakcja odrzucona, wynik porażka, revalidatePath nie wołane (rola nie zmieniona)', async () => {
    txAuditLogCreateMock.mockRejectedValue(new Error('CHECK constraint violation'));

    const result = await updateAuthorizedUserRoleAction(TARGET.id, {
      role: 'dyspozytor',
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(false);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('błąd update → auditLog.create NIGDY nie zostaje wywołane, wynik porażka', async () => {
    txUpdateMock.mockRejectedValue(new Error('deadlock'));

    const result = await updateAuthorizedUserRoleAction(TARGET.id, {
      role: 'dyspozytor',
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(false);
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });

  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('update i auditLog.create wywołane w JEDNEJ transakcji, update PRZED wpisem', async () => {
    await updateAuthorizedUserRoleAction(TARGET.id, {
      role: 'dyspozytor',
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(txUpdateMock.mock.invocationCallOrder[0]).toBeLessThan(
      txAuditLogCreateMock.mock.invocationCallOrder[0],
    );
  });

  // `deleteAuditorAction` musi zachować `{ isolationLevel: 'Serializable' }` — ten sam wymóg
  // dotyczy tej ścieżki (WO, wzorzec zapisu p.5).
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it("prisma.$transaction wywołane z drugim argumentem { isolationLevel: 'Serializable' }", async () => {
    await updateAuthorizedUserRoleAction(TARGET.id, {
      role: 'dyspozytor',
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    const secondArg = transactionMock.mock.calls[0]?.[1];
    expect(secondArg).toEqual({ isolationLevel: 'Serializable' });
  });
});

// ────────────────────────────── AC7/AC8/AC17 — ochrona ostatniego admina ──────────────────────────────

describe('updateAuthorizedUserRoleAction — ochrona ostatniego admina (SEC-AUDIT-LOG-ROLE-CHANGE, AC7/AC8/AC17, D3 — ochrona WĄSKA)', () => {
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('degradacja JEDYNEGO konta admin jest odrzucona: zero update, zero wpisu audytowego', async () => {
    txFindUniqueMock.mockResolvedValue({ ...SOLE_ADMIN });
    txCountMock.mockResolvedValue(1);

    const result = await updateAuthorizedUserRoleAction(SOLE_ADMIN.id, {
      role: 'monter',
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(false);
    expect(txUpdateMock).not.toHaveBeenCalled();
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });

  // Kontrola pozytywna: bez inwariantu ten sam scenariusz przechodziłby zawsze —
  // przy DWÓCH kontach admin degradacja JEDNEGO z nich musi się udać.
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('kontrola pozytywna — przy DWÓCH kontach admin degradacja jednego z nich przechodzi', async () => {
    txFindUniqueMock.mockResolvedValue({ ...SOLE_ADMIN });
    txCountMock.mockResolvedValue(2);

    const result = await updateAuthorizedUserRoleAction(SOLE_ADMIN.id, {
      role: 'monter',
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(true);
    expect(result.changed).toBe(true);
    expect(txUpdateMock).toHaveBeenCalledTimes(1);
    expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
  });

  // Inwariant dotyczy WYŁĄCZNIE degradacji konta admin — zmiana roli konta, które admin
  // NIE jest, nigdy nie sprawdza liczby adminów (nie ma się czego bać).
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('zmiana roli konta, które NIE jest admin, nie sprawdza inwariantu ostatniego admina', async () => {
    txFindUniqueMock.mockResolvedValue({ ...TARGET }); // role: 'monter'
    txCountMock.mockResolvedValue(1); // choćby był tylko jeden admin w systemie — bez znaczenia tutaj

    const result = await updateAuthorizedUserRoleAction(TARGET.id, {
      role: 'dyspozytor',
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(true);
  });

  // AC17 — samodegradacja admina przy DWÓCH kontach admin PRZECHODZI: wpis ma actor_email
  // równy e-mailowi konta, którego rola się zmienia (bo to ten sam operator), i
  // actor_role='admin' (rola SPRZED zmiany, utrwalona).
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('AC17 — samodegradacja własnej roli admina przy dwóch kontach admin przechodzi, wpis zapisuje rolę sprzed zmiany', async () => {
    getCurrentUserMock.mockResolvedValue({ data: { user: { email: SOLE_ADMIN.email } } });
    txFindUniqueMock.mockResolvedValue({ ...SOLE_ADMIN });
    txCountMock.mockResolvedValue(2);

    const result = await updateAuthorizedUserRoleAction(SOLE_ADMIN.id, {
      role: 'dyspozytor',
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(true);
    const payload = txAuditLogCreateMock.mock.calls[0][0].data;
    expect(payload.actorEmail).toBe(SOLE_ADMIN.email);
    expect(payload.actorRole).toBe('admin');
  });

  // AC8 — dowód pośredni współbieżności na mocku: decyzja zapada wewnątrz transakcji
  // `Serializable`, nie przez odczyt liczby adminów poprzedzający zapis w JS (pułapka 4,
  // CLAUDE.md). Prawdziwej współbieżności nie da się odtworzyć na mocku (patrz WO, "Ryzyka") —
  // ten test dowodzi wyłącznie, że opcja izolacji przetrwała dołożenie inwariantu (patrz też
  // test w bloku "transakcyjność" powyżej) i że `count` jest odpytywane WEWNĄTRZ callbacku tx,
  // nie przed wywołaniem $transaction.
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('AC8 — sprawdzenie liczby adminów odbywa się wewnątrz callbacku $transaction, nie przed nim', async () => {
    txFindUniqueMock.mockResolvedValue({ ...SOLE_ADMIN });
    txCountMock.mockResolvedValue(1);
    let countCalledBeforeTransaction = false;
    transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) => {
      countCalledBeforeTransaction = txCountMock.mock.calls.length > 0;
      return callback(tx);
    });

    await updateAuthorizedUserRoleAction(SOLE_ADMIN.id, {
      role: 'monter',
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(countCalledBeforeTransaction).toBe(false);
    expect(txCountMock).toHaveBeenCalled();
  });
});

// ──────────────────────────────── AC9/AC10 — no-op i idempotencja ────────────────────────────────

describe('updateAuthorizedUserRoleAction — no-op i idempotencja (SEC-AUDIT-LOG-ROLE-CHANGE, AC9/AC10)', () => {
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('AC9 — rola docelowa identyczna z bieżącą nie wykonuje update ani nie tworzy wpisu audytowego', async () => {
    txFindUniqueMock.mockResolvedValue({ ...TARGET }); // role: 'monter'

    const result = await updateAuthorizedUserRoleAction(TARGET.id, {
      role: 'monter',
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(txUpdateMock).not.toHaveBeenCalled();
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
    // Operator dostaje wynik jawnie odróżnialny od błędu — nie jest to porażka autoryzacji
    // ani walidacji, ale też nic się nie wydarzyło. Pole `changed` odróżnia no-op od
    // rzeczywistej zmiany roli (naprawa MAJOR-a z recenzji).
    expect(result.success).toBe(true);
    expect(result.changed).toBe(false);
  });

  // AC10 — N-krotne wywołanie z tą samą docelową rolą daje dokładnie JEDEN wpis: pierwsze
  // wywołanie zmienia (findUnique zwraca starą rolę), drugie jest no-op (findUnique zwraca
  // już zaktualizowaną rolę — symulacja stanu bazy po pierwszym wywołaniu).
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('AC10 — drugie wywołanie z tą samą docelową rolą nie tworzy drugiego wpisu audytowego', async () => {
    txFindUniqueMock
      .mockResolvedValueOnce({ ...TARGET, role: 'monter' })
      .mockResolvedValueOnce({ ...TARGET, role: 'dyspozytor' });

    const first = await updateAuthorizedUserRoleAction(TARGET.id, {
      role: 'dyspozytor',
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });
    const second = await updateAuthorizedUserRoleAction(TARGET.id, {
      role: 'dyspozytor',
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(first.success).toBe(true);
    expect(second.success).toBe(true);
    expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
    expect(txUpdateMock).toHaveBeenCalledTimes(1);
  });
});

// ───────────────────────────────────── AC11 — konto nieistniejące ─────────────────────────────────────

describe('updateAuthorizedUserRoleAction — konto nieistniejące (SEC-AUDIT-LOG-ROLE-CHANGE, AC11)', () => {
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('id konta, którego nie ma, kończy się błędem domenowym bez wpisu audytowego', async () => {
    txFindUniqueMock.mockResolvedValue(null);

    const result = await updateAuthorizedUserRoleAction('usr-nieistniejacy', {
      role: 'dyspozytor',
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(false);
    expect(txUpdateMock).not.toHaveBeenCalled();
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });

  // Brak ujawniania, czy konto kiedykolwiek istniało: kształt wyniku identyczny dla dwóch
  // różnych brakujących id.
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('wynik nie ujawnia, czy konto kiedykolwiek istniało — identyczny kształt dla dwóch różnych brakujących id', async () => {
    txFindUniqueMock.mockResolvedValue(null);

    const forA = await updateAuthorizedUserRoleAction('usr-brak-a', {
      role: 'dyspozytor',
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });
    const forB = await updateAuthorizedUserRoleAction('usr-brak-b', {
      role: 'dyspozytor',
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(forA).toEqual(forB);
  });
});

// ─────────────────────────────── AC18 — awans podlega tym samym wymogom ───────────────────────────────

describe('updateAuthorizedUserRoleAction — awans (monter → admin) podlega tym samym wymogom co degradacja (SEC-AUDIT-LOG-ROLE-CHANGE, AC18)', () => {
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('awans monter → admin przechodzi przez tę samą bramkę, walidację i wpis co degradacja', async () => {
    txFindUniqueMock.mockResolvedValue({ ...TARGET, role: 'monter' });

    const result = await updateAuthorizedUserRoleAction(TARGET.id, {
      role: 'admin',
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(true);
    expect(txUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TARGET.id }, data: expect.objectContaining({ role: 'admin' }) }),
    );
    const payload = txAuditLogCreateMock.mock.calls[0][0].data;
    expect(payload.operation).toBe('role_change');
  });

  // Awans BEZ uzasadnienia (justification poniżej progu) jest odrzucony dokładnie tak samo
  // jak degradacja — test nie może pokrywać wyłącznie degradacji (WO, przypadki brzegowe).
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('awans z justification poniżej progu jest odrzucony bez żadnego zapisu', async () => {
    txFindUniqueMock.mockResolvedValue({ ...TARGET, role: 'monter' });

    const result = await updateAuthorizedUserRoleAction(TARGET.id, {
      role: 'admin',
      justification: '  123456789  ',
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
  });
});

// ──────────────────────────── AC19 (D2) — prefiks stara → nowa rola w justification ────────────────────────────

describe('updateAuthorizedUserRoleAction — prefiks stara → nowa rola w justification (SEC-AUDIT-LOG-ROLE-CHANGE, AC19, decyzja D2)', () => {
  const OPERATOR_TEXT = 'Zmiana zakresu obowiazkow zatwierdzona przez kierownika.';

  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('justification zapisane w audit_log zawiera tekst operatora W CAŁOŚCI, nienaruszony, z doklejonym przed nim prefiksem stara→nowa rola', async () => {
    txFindUniqueMock.mockResolvedValue({ ...TARGET, role: 'monter' });

    await updateAuthorizedUserRoleAction(TARGET.id, {
      role: 'dyspozytor',
      justification: OPERATOR_TEXT,
      legalBasis: VALID_BASIS,
    });

    const stored = txAuditLogCreateMock.mock.calls[0][0].data.justification as string;
    // Prefiks jest DOKLEJANY PRZED tekstem operatora — tekst operatora musi więc zamykać wpis,
    // niezmieniony co do litery.
    expect(stored.endsWith(OPERATOR_TEXT)).toBe(true);
    expect(stored.length).toBeGreaterThan(OPERATOR_TEXT.length);
    // Prefiks musi identyfikować obie role (starą i nową) — bez tego rejestr po dwóch kolejnych
    // zmianach roli nie pozwala odtworzyć ścieżki (powód D2).
    expect(stored).toContain('monter');
    expect(stored).toContain('dyspozytor');
  });

  // Próg 10 znaków liczy się od TEKSTU OPERATORA, nie od tekstu z doklejonym prefiksem —
  // dokładnie 10 znaków po trim przechodzi, mimo że prefiks wydłuża zapisaną wartość.
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('próg 10 znaków liczy się od tekstu operatora — dokładnie 10 znaków po trim przechodzi, mimo doklejanego prefiksu', async () => {
    txFindUniqueMock.mockResolvedValue({ ...TARGET, role: 'monter' });

    const result = await updateAuthorizedUserRoleAction(TARGET.id, {
      role: 'dyspozytor',
      justification: '  1234567890  ',
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(true);
  });

  // 9 znaków po trim jest odrzucone NIEZALEŻNIE od długości prefiksu — prefiks nie może
  // wypełnić minimalnej długości za operatora.
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('9 znaków po trim jest odrzucone niezależnie od prefiksu (dłuższa para ról nie ratuje zbyt krótkiego tekstu)', async () => {
    txFindUniqueMock.mockResolvedValue({ ...TARGET, role: 'monter' });

    const result = await updateAuthorizedUserRoleAction(TARGET.id, {
      role: 'administratorem_systemu' as never, // rola spoza ROLES i tak odrzucona wcześniej;
      justification: '  123456789  ',
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
  });
});

// ───────────────────────────────── AC15 — jedno źródło schematu i słownika ─────────────────────────────────

describe('updateAuthorizedUserRoleAction — jedno źródło progu i słownika (SEC-AUDIT-LOG-ROLE-CHANGE, AC15)', () => {
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('roleChangeSchema ROZSZERZA deleteJustificationSchema (ta sama referencja pól justification/legalBasis, nie kopia)', async () => {
    const { deleteJustificationSchema } = await import('../src/lib/audit/delete-justification-schema');
    const { roleChangeSchema } = await import('../src/lib/audit/role-change-schema');

    // `.extend()` Zod zachowuje referencję niezmodyfikowanych pól — to jest dowód, że
    // `roleChangeSchema` jest rozszerzeniem, a nie niezależną, skopiowaną definicją.
    expect(roleChangeSchema.shape.justification).toBe(deleteJustificationSchema.shape.justification);
    expect(roleChangeSchema.shape.legalBasis).toBe(deleteJustificationSchema.shape.legalBasis);
  });

  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('roleChangeSchema.shape.role jest z.enum(ROLES) — jedno źródło słownika ról', async () => {
    const { roleChangeSchema } = await import('../src/lib/audit/role-change-schema');

    const parsedValid = roleChangeSchema.safeParse({
      role: 'dyspozytor',
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });
    expect(parsedValid.success).toBe(true);

    const parsedInvalid = roleChangeSchema.safeParse({
      role: 'superadmin',
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });
    expect(parsedInvalid.success).toBe(false);
  });

  // Plik nowego schematu NIE zawiera własnej kopii `z.string().trim().min(10)` — inaczej
  // `sec-audit-log-delete-static.test.ts:253` (cudze, już zielone wymaganie) zostałby złamany
  // przez drugi plik pasujący do tego wzorca.
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('plik role-change-schema.ts nie zawiera własnej kopii wyrażenia z.string().trim().min(10)', () => {
    const filePath = path.resolve(
      __dirname,
      '../src/lib/audit/role-change-schema.ts',
    );
    const content = readFileSync(filePath, 'utf-8');
    expect(content).not.toMatch(/z\s*\.\s*string\s*\(\s*\)\s*\.\s*trim\s*\(\s*\)\s*\.\s*min\s*\(\s*10\s*\)/);
  });
});

// ───────────────────────────────── AC1/AC14 — jedyna ścieżka zapisu, w transakcji z audytem ─────────────────────────────────

describe('AC1/AC14 (testy statyczne) — jedyna ścieżka zapisu roli, zawsze w $transaction z auditLog.create', () => {
  const B2B_SRC_DIR = path.resolve(__dirname, '../src');
  const APPS_DIR = path.resolve(__dirname, '../../');

  function findSourceFiles(dir: string, results: string[] = []): string[] {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === 'node_modules' || entry.name === '.next') continue;
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        findSourceFiles(fullPath, results);
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        results.push(fullPath);
      }
    }
    return results;
  }

  const nonTestSourceFiles = findSourceFiles(B2B_SRC_DIR).filter(
    (f) => !f.includes(`${path.sep}tests${path.sep}`) && !f.endsWith('.test.ts'),
  );

  const roleWriteRe = /\bauthorizedUser\.(update|updateMany|upsert)\s*\(/g;

  function extractEnclosingBlock(content: string, idx: number): string | null {
    const markers = ['export async function', 'export function', 'export const', 'export default async function'];
    const beforeIdx = content.slice(0, idx);
    let fnStart = -1;
    for (const marker of markers) {
      const i = beforeIdx.lastIndexOf(marker);
      if (i > fnStart) fnStart = i;
    }
    if (fnStart === -1) return null;
    const braceOpen = content.indexOf('{', fnStart);
    if (braceOpen === -1) return null;
    let depth = 0;
    let end = -1;
    for (let i = braceOpen; i < content.length; i++) {
      if (content[i] === '{') depth++;
      else if (content[i] === '}') {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end === -1) return null;
    return content.slice(fnStart, end + 1);
  }

  // AC1 — istnieje dokładnie jedno miejsce zapisujące authorizedUser.role: settings/actions.ts.
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('poza apps/b2b-web/src/app/(dashboard)/settings/actions.ts nie istnieje drugie miejsce wywołujące authorizedUser.update/updateMany/upsert', () => {
    const settingsActionsPath = path.resolve(__dirname, '../src/app/(dashboard)/settings/actions.ts');
    const offenders: string[] = [];

    for (const file of nonTestSourceFiles) {
      if (file === settingsActionsPath) continue;
      const content = readFileSync(file, 'utf-8');
      if (roleWriteRe.test(content)) {
        offenders.push(path.relative(APPS_DIR, file));
      }
      roleWriteRe.lastIndex = 0;
    }

    expect(offenders).toEqual([]);
  });

  // AC14 — każde wystąpienie authorizedUser.update/updateMany/upsert siedzi wewnątrz funkcji
  // zawierającej ZARÓWNO $transaction, JAK I auditLog.create.
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('każde wystąpienie authorizedUser.update/updateMany/upsert jest wewnątrz funkcji z $transaction i auditLog.create', () => {
    const offenders: string[] = [];

    for (const file of nonTestSourceFiles) {
      const content = readFileSync(file, 'utf-8');
      let m: RegExpExecArray | null;
      const re = new RegExp(roleWriteRe.source, 'g');
      while ((m = re.exec(content))) {
        const block = extractEnclosingBlock(content, m.index);
        if (block === null) {
          offenders.push(`${path.relative(APPS_DIR, file)} — ${m[0]}: granica funkcji nieznana, sprawdź ręcznie`);
          continue;
        }
        const hasTransaction = /\$transaction\s*\(\s*async/.test(block);
        const hasAuditLogCreate = /auditLog\.create\s*\(/.test(block);
        const missing: string[] = [];
        if (!hasTransaction) missing.push('$transaction');
        if (!hasAuditLogCreate) missing.push('auditLog.create');
        if (missing.length > 0) {
          offenders.push(`${path.relative(APPS_DIR, file)} — ${m[0]} bez ${missing.join(' i ')}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});

// ───────────────────────────────────────── AC16 — druga linia bazy ─────────────────────────────────────────

describe('AC16 (test statyczny, dzielony z SEC-AUDIT-LOG-APPEND-ONLY) — migracja dopuszcza role_change/authorized_users i ma trigger append-only', () => {
  function readMigration(): string {
    const migrationPath = path.resolve(
      __dirname,
      '../../../supabase/migrations/20260901220000_rodo_audit_log_and_client_anonymization.sql',
    );
    return readFileSync(migrationPath, 'utf-8');
  }

  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it("audit_log_operation_check dopuszcza 'role_change' i audit_log_resource_check dopuszcza 'authorized_users'", () => {
    const sql = readMigration();
    expect(sql).toContain('CONSTRAINT audit_log_operation_check CHECK (operation IN (');
    expect(sql).toContain("'role_change'");
    expect(sql).toContain('CONSTRAINT audit_log_resource_check CHECK (resource IN (');
    expect(sql).toContain("'authorized_users'");
  });

  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('trigger audit_log_append_only_trg jest obecny — wpis roli nie da się poprawić ani usunąć (dowód statyczny, brak Postgresa w środowisku)', () => {
    const sql = readMigration();
    expect(sql).toContain('CREATE TRIGGER audit_log_append_only_trg');
    expect(sql).toContain('BEFORE UPDATE OR DELETE ON public.audit_log');
  });
});

// ───────────────────────────────────── AC12 — UI pokazuje prawdziwą rolę (warunek wstępny) ─────────────────────────────────────

describe('AC12 (test statyczny) — SettingsClient.tsx ma prezentować faktyczną rolę użytkownika, nie stały napis "Administrator"', () => {
  // Ograniczenie infrastrukturalne dziedziczone z `customers-anonymize-ui.test.ts`: alias `@/*`
  // nie jest skonfigurowany w root `vitest.config.mts`, a test-author nie może go dopisać
  // (guard-paths.mjs). `SettingsClient.tsx` importuje `@/components/ui/*` — pełny render
  // (`@testing-library/react`) nie jest dziś wykonalny w tym pakiecie testów. Test statyczny
  // nad treścią źródła, wzorem `customers-anonymize-ui.test.ts`.
  function readSettingsClient(): string {
    const filePath = path.resolve(__dirname, '../src/app/(dashboard)/settings/SettingsClient.tsx');
    return readFileSync(filePath, 'utf-8');
  }

  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('blok renderujący wiersz tabeli (users.map) odwołuje się do user.role, nie tylko do stałego tekstu', () => {
    const content = readSettingsClient();
    const mapIdx = content.indexOf('users.map(user =>');
    expect(mapIdx).toBeGreaterThan(-1);
    const rowBlock = content.slice(mapIdx, mapIdx + 3000);

    expect(rowBlock).toMatch(/user\.role/);
  });

  // DZIŚ (RED oczekiwany): wiersz renderuje stały napis "Administrator" dla KAŻDEGO wiersza,
  // niezależnie od danych — to jest dokładnie defekt opisany w WO (SettingsClient.tsx:98-102).
  // Ten test dokumentuje defekt i ma zniknąć (przejść na zielono) w fazie GREEN.
  // @REQ: SEC-AUDIT-LOG-ROLE-CHANGE
  it('konto o dowolnej roli nie jest opisane stałym, bezwarunkowym napisem "Administrator" w Badge', () => {
    const content = readSettingsClient();
    const mapIdx = content.indexOf('users.map(user =>');
    const rowBlock = content.slice(mapIdx, mapIdx + 3000);

    expect(rowBlock).not.toMatch(/<Badge[^>]*>\s*Administrator\s*<\/Badge>/);
  });
});
