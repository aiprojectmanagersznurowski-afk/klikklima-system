import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ROLES, can, AUDIT_REQUIREMENTS } from '@klikklima/contracts';
import type {
  DeleteJustificationInput,
  DeleteActionResult,
} from '../src/lib/audit/delete-justification-schema';

/**
 * WO: docs/workorders/SEC-AUDIT-LOG-DELETE.md — Fala B (`test-author` → `implementer-server`).
 * Wymaganie: `SEC-AUDIT-LOG-DELETE` (`contracts/requirements.contract.mjs:331`, status TODO).
 * Ten sam wymóg co Fala A (`sec-audit-log-delete-wave-a.test.ts`) — nie ma osobnego ID dla fal.
 *
 * Zakres tego pliku — WYŁĄCZNIE dwa punkty zapisu Fali B:
 *   deleteAuditorAction (auditors/actions.ts, dziś `Serializable`),
 *   deleteCrewAction (crews/actions.ts).
 * Fala A (pięć prostych usunięć + delegujące logistics) POZA ZAKRESEM tego pliku.
 *
 * ═══ RÓŻNICA WZGLĘDEM FALI A (powód osobnej fali, z WO) ═══
 * Obie funkcje mają dziś JUŻ `$transaction`, ale z WCZESNYM WYJŚCIEM wewnątrz: jeżeli
 * audytor ma "wiszące" leady (status AWAITING_AUDIT/AUDIT_COMPLETED) albo ekipa ma aktywne
 * instalacje (PLANNED/IN_PROGRESS), transakcja zwraca `{ success: false, ... }` PRZED
 * dotarciem do `tx.<model>.delete(...)` — i wpis audytowy NIE MOŻE powstać na tej ścieżce
 * (AC8, "Blokada nie loguje"). To jest jedyny odcień, którego Fala A nie miała: tam każda
 * porażka `delete` przychodziła z RZUCONEGO wyjątku (mock `mockRejectedValue`), tutaj
 * porażka BLOCK_UNTIL_REASSIGNED jest zwykłym `return` (bez wyjątku) ZANIM `delete` w ogóle
 * zostanie wywołane.
 *
 * ═══ STAN DZISIEJSZY (zweryfikowany czytaniem źródeł 2026-09-03) ═══
 * Obie funkcje przyjmują dziś JEDEN parametr (`id: string`), nie znają `input`
 * (justification/legalBasis), nie sięgają po `createClient().auth.getUser()` i NIGDY nie
 * zapisują do `audit_log`. `deleteAuditorAction` otwiera `$transaction` z drugim argumentem
 * `{ isolationLevel: 'Serializable' }` — TEN argument MUSI przetrwać Falę B bez zmian (WO,
 * sekcja "Ryzyka i nieznane": podniesienie liczby błędów serializacji przy dołożeniu wpisu
 * to podejrzenie, nie flaky test — ale sama OPCJA izolacji nie jest czymś, co ten test
 * usuwa). `deleteCrewAction` NIE ma dziś opcji izolacji — WO jej tam nie wymaga, więc ten
 * plik jej nie wymusza.
 *
 * Ten plik testuje TARGET (kształt z WO), nie stan dzisiejszy — RED jest tu oczekiwany i
 * jest dowodem braku implementacji, nie błędem testu.
 *
 * ═══ WZORZEC MOCKOWANIA ═══ Jak w Fali A: `@repo/database` mockowane WYŁĄCZNIE
 * `prisma.$transaction` (żadnego modelu na `prisma` bezpośrednio). `tx` jest współdzielonym
 * obiektem per opisywana sekcja (audytorzy / zespoly_monterskie), z `findUnique` i `delete`
 * na tym samym modelu (dzisiejszy kod już woła oba wewnątrz `tx`) plus `auditLog.create`.
 */

const {
  transactionMock,
  txAudytorzyFindUniqueMock,
  txAudytorzyDeleteMock,
  txZespolyFindUniqueMock,
  txZespolyDeleteMock,
  txAuditLogCreateMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getUserMock,
  createClientMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  txAudytorzyFindUniqueMock: vi.fn(),
  txAudytorzyDeleteMock: vi.fn(),
  txZespolyFindUniqueMock: vi.fn(),
  txZespolyDeleteMock: vi.fn(),
  txAuditLogCreateMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    $transaction: transactionMock,
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  createClient: createClientMock,
}));

const { deleteAuditorAction } = await import('../src/app/(dashboard)/auditors/actions');
const { deleteCrewAction } = await import('../src/app/(dashboard)/crews/actions');

const tx = {
  audytorzy: { findUnique: txAudytorzyFindUniqueMock, delete: txAudytorzyDeleteMock },
  zespoly_monterskie: { findUnique: txZespolyFindUniqueMock, delete: txZespolyDeleteMock },
  auditLog: { create: txAuditLogCreateMock },
};

const ADMIN_EMAIL = 'admin@klikklima.pl';
const VALID_BASIS = AUDIT_REQUIREMENTS.legalBases[0];
const INVALID_BASIS = 'NIEISTNIEJACA_PODSTAWA';
const VALID_JUSTIFICATION = 'Duplikat rekordu utworzony przez pomyłkę operatora.';

// Audytor bez wiszących leadów (pusta relacja `leady`) — ścieżka sukcesu.
const AUDITOR_NO_BLOCKERS = { id: 'audytor-1', leady: [] };
// Audytor z leadem w statusie blokującym (AWAITING_AUDIT) — ścieżka BLOCK_UNTIL_REASSIGNED.
const AUDITOR_WITH_BLOCKERS = {
  id: 'audytor-1',
  leady: [{ id: 'lead-1', status: 'AWAITING_AUDIT', klient: { imie_i_nazwisko: 'Jan Kowalski' } }],
};

// Ekipa bez aktywnych instalacji — ścieżka sukcesu.
const CREW_NO_BLOCKERS = { id: 'ekipa-1', instalacje: [] };
// Ekipa z instalacją w statusie blokującym (PLANNED) — ścieżka BLOCK_UNTIL_REASSIGNED.
const CREW_WITH_BLOCKERS = {
  id: 'ekipa-1',
  instalacje: [{ id: 'instalacja-1', status: 'PLANNED' }],
};

beforeEach(() => {
  transactionMock.mockReset();
  txAudytorzyFindUniqueMock.mockReset();
  txAudytorzyDeleteMock.mockReset();
  txZespolyFindUniqueMock.mockReset();
  txZespolyDeleteMock.mockReset();
  txAuditLogCreateMock.mockReset();
  revalidatePathMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  getUserMock.mockReset();
  createClientMock.mockReset();

  transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(tx));
  getCurrentActorRoleMock.mockResolvedValue('admin');
  getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } });
  createClientMock.mockResolvedValue({ auth: { getUser: getUserMock } });
  txAudytorzyFindUniqueMock.mockResolvedValue(AUDITOR_NO_BLOCKERS);
  txZespolyFindUniqueMock.mockResolvedValue(CREW_NO_BLOCKERS);
});

type WaveBConfig = {
  label: string;
  resource: string;
  fn: (id: string, input: DeleteJustificationInput) => Promise<DeleteActionResult>;
  deleteMock: ReturnType<typeof vi.fn>;
  findUniqueMock: ReturnType<typeof vi.fn>;
  noBlockersRecord: unknown;
  withBlockersRecord: unknown;
  id: string;
};

const configs: WaveBConfig[] = [
  {
    label: 'deleteAuditorAction',
    resource: 'auditors',
    fn: deleteAuditorAction as WaveBConfig['fn'],
    deleteMock: txAudytorzyDeleteMock,
    findUniqueMock: txAudytorzyFindUniqueMock,
    noBlockersRecord: AUDITOR_NO_BLOCKERS,
    withBlockersRecord: AUDITOR_WITH_BLOCKERS,
    id: 'audytor-1',
  },
  {
    label: 'deleteCrewAction',
    resource: 'crews',
    fn: deleteCrewAction as WaveBConfig['fn'],
    deleteMock: txZespolyDeleteMock,
    findUniqueMock: txZespolyFindUniqueMock,
    noBlockersRecord: CREW_NO_BLOCKERS,
    withBlockersRecord: CREW_WITH_BLOCKERS,
    id: 'ekipa-1',
  },
];

for (const cfg of configs) {
  const DENIED_ROLES = ROLES.filter((r) => can(r, cfg.resource, 'delete') !== 'yes');
  const ALLOWED_ROLES = ROLES.filter((r) => can(r, cfg.resource, 'delete') === 'yes');

  describe(`${cfg.label} — SEC-AUDIT-LOG-DELETE (Fala B)`, () => {
    // Kontrola pozytywna kontraktu.
    // @REQ: SEC-AUDIT-LOG-DELETE
    it('kontrola pozytywna kontraktu — macierz RBAC rozróżnia role dla tego zasobu', () => {
      expect(ALLOWED_ROLES.length).toBeGreaterThan(0);
      expect(DENIED_ROLES.length).toBeGreaterThan(0);
    });

    // AC4 — fail-closed, rola bez delete: zero delete, zero audit, zero findUnique.
    // @REQ: SEC-AUDIT-LOG-DELETE
    it.each(DENIED_ROLES)('rola %s odrzucona, zero zapytań i zero wpisu audytowego', async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);

      const result = await cfg.fn(cfg.id, { justification: VALID_JUSTIFICATION, legalBasis: VALID_BASIS });

      expect(result.success).toBe(false);
      expect(getUserMock).not.toHaveBeenCalled();
      expect(transactionMock).not.toHaveBeenCalled();
      expect(cfg.deleteMock).not.toHaveBeenCalled();
      expect(txAuditLogCreateMock).not.toHaveBeenCalled();
    });

    // AC4 — fail-closed, brak roli (null).
    // @REQ: SEC-AUDIT-LOG-DELETE
    it('brak roli (null) odrzucony fail-closed, zero zapytań', async () => {
      getCurrentActorRoleMock.mockResolvedValue(null);

      const result = await cfg.fn(cfg.id, { justification: VALID_JUSTIFICATION, legalBasis: VALID_BASIS });

      expect(result.success).toBe(false);
      expect(transactionMock).not.toHaveBeenCalled();
      expect(txAuditLogCreateMock).not.toHaveBeenCalled();
    });

    // AC4 — fail-closed, wyjątek przy odczycie roli. WO wprost nakazuje pokrycie tego w
    // Fali B tak samo jak Fala A dodała try/catch wokół `getCurrentActorRole()`.
    // @REQ: SEC-AUDIT-LOG-DELETE
    it('wyjątek z getCurrentActorRole daje odmowę uprawnień, zero zapytań', async () => {
      getCurrentActorRoleMock.mockRejectedValue(new Error('sesja wygasła'));

      const result = await cfg.fn(cfg.id, { justification: VALID_JUSTIFICATION, legalBasis: VALID_BASIS });

      expect(result.success).toBe(false);
      expect(getUserMock).not.toHaveBeenCalled();
      expect(transactionMock).not.toHaveBeenCalled();
    });

    // AC5 — fail-closed, brak e-maila w sesji, PRZED transakcją.
    // @REQ: SEC-AUDIT-LOG-DELETE
    it('brak e-maila w sesji odrzucony fail-closed, PRZED transakcją', async () => {
      getUserMock.mockResolvedValue({ data: { user: { email: null } } });

      const result = await cfg.fn(cfg.id, { justification: VALID_JUSTIFICATION, legalBasis: VALID_BASIS });

      expect(result.success).toBe(false);
      expect(transactionMock).not.toHaveBeenCalled();
    });

    // AC5 — brak sesji w ogóle.
    // @REQ: SEC-AUDIT-LOG-DELETE
    it('brak sesji (user: null) odrzucony fail-closed, PRZED transakcją', async () => {
      getUserMock.mockResolvedValue({ data: { user: null } });

      const result = await cfg.fn(cfg.id, { justification: VALID_JUSTIFICATION, legalBasis: VALID_BASIS });

      expect(result.success).toBe(false);
      expect(transactionMock).not.toHaveBeenCalled();
    });

    // AC6 — justification: przypadki niepoprawne, bez żadnego zapisu.
    // @REQ: SEC-AUDIT-LOG-DELETE
    it.each([
      ['', 'pusty string'],
      ['   ', 'same białe znaki'],
      ['  123456789  ', '9 znaków po trim'],
    ] as const)('justification niepoprawny (%s — %s) odrzucony bez żadnego zapisu', async (justification, _label) => {
      const result = await cfg.fn(cfg.id, { justification, legalBasis: VALID_BASIS });

      expect(result.success).toBe(false);
      expect(transactionMock).not.toHaveBeenCalled();
      expect(txAuditLogCreateMock).not.toHaveBeenCalled();
    });

    // AC6 — granica: dokładnie 10 znaków po trim jest dozwolone (ścieżka bez blokerów).
    // @REQ: SEC-AUDIT-LOG-DELETE
    it('justification dokładnie 10 znaków po trim (z otaczającymi spacjami) jest dozwolony', async () => {
      cfg.findUniqueMock.mockResolvedValue(cfg.noBlockersRecord);
      cfg.deleteMock.mockResolvedValue({});
      txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });

      const result = await cfg.fn(cfg.id, { justification: '  1234567890  ', legalBasis: VALID_BASIS });

      expect(result.success).toBe(true);
      expect(transactionMock).toHaveBeenCalledTimes(1);
    });

    // AC6 — legalBasis spoza słownika kontraktu, bez żadnego zapisu.
    // @REQ: SEC-AUDIT-LOG-DELETE
    it('legalBasis spoza AUDIT_REQUIREMENTS.legalBases odrzucony bez żadnego zapisu', async () => {
      expect(AUDIT_REQUIREMENTS.legalBases).not.toContain(INVALID_BASIS);

      const result = await cfg.fn(cfg.id, {
        justification: VALID_JUSTIFICATION,
        legalBasis: INVALID_BASIS as DeleteJustificationInput['legalBasis'],
      });

      expect(result.success).toBe(false);
      expect(transactionMock).not.toHaveBeenCalled();
    });

    // AC6 — kontrola pozytywna: każda wartość z kontraktu jest dozwolona (ścieżka bez blokerów).
    // @REQ: SEC-AUDIT-LOG-DELETE
    it.each(AUDIT_REQUIREMENTS.legalBases)('legalBasis %s (z kontraktu) jest dozwolony', async (basis) => {
      cfg.findUniqueMock.mockResolvedValue(cfg.noBlockersRecord);
      cfg.deleteMock.mockResolvedValue({});
      txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });

      const result = await cfg.fn(cfg.id, { justification: VALID_JUSTIFICATION, legalBasis: basis });

      expect(result.success).toBe(true);
    });

    // AC3 — kompletność wpisu audytowego, ścieżka sukcesu (bez blokerów).
    // @REQ: SEC-AUDIT-LOG-DELETE
    it('AC3 — wpis audytowy ma operation/resource/recordId/actorEmail/actorRole/justification/legalBasis', async () => {
      cfg.findUniqueMock.mockResolvedValue(cfg.noBlockersRecord);
      cfg.deleteMock.mockResolvedValue({});
      txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });
      getUserMock.mockResolvedValue({ data: { user: { email: 'ktos-inny@klikklima.pl' } } });

      await cfg.fn(cfg.id, { justification: VALID_JUSTIFICATION, legalBasis: VALID_BASIS });

      expect(txAuditLogCreateMock).toHaveBeenCalledWith({
        data: {
          operation: 'delete',
          resource: cfg.resource,
          recordId: cfg.id,
          actorEmail: 'ktos-inny@klikklima.pl',
          actorRole: 'admin',
          justification: VALID_JUSTIFICATION,
          legalBasis: VALID_BASIS,
        },
      });
    });

    // AC1 — delete i wpis w JEDNEJ transakcji, w tej kolejności (ścieżka sukcesu).
    // @REQ: SEC-AUDIT-LOG-DELETE
    it('AC1 — delete i auditLog.create wywołane w JEDNEJ transakcji, delete PRZED wpisem', async () => {
      cfg.findUniqueMock.mockResolvedValue(cfg.noBlockersRecord);
      cfg.deleteMock.mockResolvedValue({});
      txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });

      await cfg.fn(cfg.id, { justification: VALID_JUSTIFICATION, legalBasis: VALID_BASIS });

      expect(transactionMock).toHaveBeenCalledTimes(1);
      expect(cfg.deleteMock.mock.invocationCallOrder[0]).toBeLessThan(
        txAuditLogCreateMock.mock.invocationCallOrder[0],
      );
    });

    // AC1 — błąd zapisu audytowego cofa całą transakcję (dowód pośredni: porażka, revalidatePath
    // — efekt POZA transakcją — nie jest wołane).
    // @REQ: SEC-AUDIT-LOG-DELETE
    it('AC1 — błąd auditLog.create → transakcja odrzucona, wynik porażka, revalidatePath nie wołane', async () => {
      cfg.findUniqueMock.mockResolvedValue(cfg.noBlockersRecord);
      cfg.deleteMock.mockResolvedValue({});
      txAuditLogCreateMock.mockRejectedValue(new Error('CHECK constraint violation'));

      const result = await cfg.fn(cfg.id, { justification: VALID_JUSTIFICATION, legalBasis: VALID_BASIS });

      expect(result.success).toBe(false);
      expect(revalidatePathMock).not.toHaveBeenCalled();
    });

    // AC2 — odwrotny kierunek: błąd delete → auditLog.create NIGDY nie zostaje osiągnięte.
    // @REQ: SEC-AUDIT-LOG-DELETE
    it('AC2 — błąd delete (np. FK BLOCK) → auditLog.create nie zostaje wywołane, wynik porażka', async () => {
      cfg.findUniqueMock.mockResolvedValue(cfg.noBlockersRecord);
      cfg.deleteMock.mockRejectedValue(new Error('Foreign key constraint violated'));

      const result = await cfg.fn(cfg.id, { justification: VALID_JUSTIFICATION, legalBasis: VALID_BASIS });

      expect(result.success).toBe(false);
      expect(txAuditLogCreateMock).not.toHaveBeenCalled();
    });

    // AC8 — BLOCADA: rekord z wiszącymi zależnościami odmawia usunięcia BEZ wpisu audytowego
    // i BEZ wywołania delete. To jest jądro tej fali (WO, "Blokada nie loguje").
    // @REQ: SEC-AUDIT-LOG-DELETE
    it('AC8 — BLOCK_UNTIL_REASSIGNED odmawia usunięcia, zero delete, zero wpisu audytowego', async () => {
      cfg.findUniqueMock.mockResolvedValue(cfg.withBlockersRecord);

      const result = await cfg.fn(cfg.id, { justification: VALID_JUSTIFICATION, legalBasis: VALID_BASIS });

      expect(result.success).toBe(false);
      expect(cfg.deleteMock).not.toHaveBeenCalled();
      expect(txAuditLogCreateMock).not.toHaveBeenCalled();
    });

    // AC8 — odwrotny kierunek jako kontrola pozytywna: BEZ blokerów usunięcie loguje normalnie
    // (żeby AC8 nie przechodził trywialnie przez "nic nigdy nie loguje").
    // @REQ: SEC-AUDIT-LOG-DELETE
    it('AC8 — kontrola pozytywna: BEZ wiszących zależności usunięcie loguje normalnie', async () => {
      cfg.findUniqueMock.mockResolvedValue(cfg.noBlockersRecord);
      cfg.deleteMock.mockResolvedValue({});
      txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });

      const result = await cfg.fn(cfg.id, { justification: VALID_JUSTIFICATION, legalBasis: VALID_BASIS });

      expect(result.success).toBe(true);
      expect(cfg.deleteMock).toHaveBeenCalledTimes(1);
      expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
    });

    // AC8 — rekord nie znaleziony (już usunięty) to też odmowa bez wpisu — nie jest to
    // technicznie BLOCK_UNTIL_REASSIGNED, ale ta sama rodzina wczesnego wyjścia wewnątrz
    // transakcji, którą Fala A (bez findUnique poprzedzającego delete) nie miała.
    // @REQ: SEC-AUDIT-LOG-DELETE
    it('rekord nieistniejący (findUnique zwraca null) odrzucony bez wpisu audytowego', async () => {
      cfg.findUniqueMock.mockResolvedValue(null);

      const result = await cfg.fn(cfg.id, { justification: VALID_JUSTIFICATION, legalBasis: VALID_BASIS });

      expect(result.success).toBe(false);
      expect(cfg.deleteMock).not.toHaveBeenCalled();
      expect(txAuditLogCreateMock).not.toHaveBeenCalled();
    });

    // AC9 — powtórzone wywołanie na już usuniętym rekordzie nie tworzy drugiego wpisu.
    // Pierwsze wywołanie: brak blokerów → sukces + jeden wpis. Drugie: findUnique zwraca
    // null (rekord już usunięty) → odmowa, zero kolejnego wpisu.
    // @REQ: SEC-AUDIT-LOG-DELETE
    it('AC9 — drugie wywołanie na już usuniętym rekordzie nie tworzy drugiego wpisu audytowego', async () => {
      cfg.findUniqueMock
        .mockResolvedValueOnce(cfg.noBlockersRecord)
        .mockResolvedValueOnce(null);
      cfg.deleteMock.mockResolvedValue({});
      txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });

      const first = await cfg.fn(cfg.id, { justification: VALID_JUSTIFICATION, legalBasis: VALID_BASIS });
      const second = await cfg.fn(cfg.id, { justification: VALID_JUSTIFICATION, legalBasis: VALID_BASIS });

      expect(first.success).toBe(true);
      expect(second.success).toBe(false);
      expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
    });
  });
}

/**
 * `deleteAuditorAction` — opcja `{ isolationLevel: 'Serializable' }` MUSI przetrwać dołożenie
 * wpisu audytowego (WO, "Ryzyka i nieznane"). Ten test dowodzi tylko OBECNOŚCI opcji na
 * wywołaniu `$transaction`, nie realnej serializacji Postgresa (niemożliwej do odtworzenia
 * na mocku — patrz komentarz nagłówkowy pliku).
 */
describe('deleteAuditorAction — opcja Serializable przetrwała dołożenie wpisu audytowego (SEC-AUDIT-LOG-DELETE)', () => {
  beforeEach(() => {
    txAudytorzyFindUniqueMock.mockResolvedValue(AUDITOR_NO_BLOCKERS);
    txAudytorzyDeleteMock.mockResolvedValue({});
    txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });
  });

  // @REQ: SEC-AUDIT-LOG-DELETE
  it("prisma.$transaction jest wywołane z drugim argumentem { isolationLevel: 'Serializable' }", async () => {
    await deleteAuditorAction('audytor-1', { justification: VALID_JUSTIFICATION, legalBasis: VALID_BASIS });

    expect(transactionMock).toHaveBeenCalledTimes(1);
    const secondArg = transactionMock.mock.calls[0]?.[1];
    expect(secondArg).toEqual({ isolationLevel: 'Serializable' });
  });
});
