import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ROLES, can, AUDIT_REQUIREMENTS } from '@klikklima/contracts';
import type {
  DeleteJustificationInput,
  DeleteActionResult,
} from '../src/lib/audit/delete-justification-schema';

/**
 * WO: docs/workorders/SEC-AUDIT-LOG-DELETE.md — Fala A (`test-author` → `implementer-server`).
 * Wymaganie: `SEC-AUDIT-LOG-DELETE` (`contracts/requirements.contract.mjs:331`, status TODO).
 *
 * Zakres tego pliku — WYŁĄCZNIE pięć punktów zapisu Fali A:
 *   deleteLeadAction (leads/actions.ts), deleteLogisticsOrderAction (logistics/actions.ts,
 *   deleguje do deleteLeadAction), deleteInstallationAction (installations/actions.ts),
 *   deleteIncidentAction (incidents/actions.ts), deleteServiceAction (services/actions.ts),
 *   deleteAuthorizedUser (settings/actions.ts).
 * Fala B (deleteAuditorAction, deleteCrewAction — BLOCK_UNTIL_REASSIGNED) POZA ZAKRESEM.
 *
 * ═══ STAN DZISIEJSZY (zweryfikowany czytaniem źródeł 2026-09-03, patrz WO sekcja "Kontekst
 * kodu") ═══ Żadna z sześciu funkcji nie przyjmuje drugiego parametru `input`, nie sięga po
 * `createClient().auth.getUser()`, nie otwiera `$transaction` i nie zapisuje do `audit_log`.
 * `deleteServiceAction` ma dodatkowo `findUnique` PRZED `delete`, POZA transakcją (okno wyścigu
 * nazwane w WO). Ten plik testuje TARGET (docelowy kształt z WO), nie stan dzisiejszy — RED
 * jest tu oczekiwany i jest dowodem braku implementacji, nie błędem testu.
 *
 * ═══ WZORZEC MOCKOWANIA ═══ Identyczny z `customers-anonymize-rodo.test.ts`: `@repo/database`
 * mockowane WYŁĄCZNIE `prisma.$transaction` (żadnego modelu na `prisma` bezpośrednio) — próba
 * wywołania `prisma.<model>.delete()` POZA transakcją (dzisiejszy stan produkcyjny) rzuci
 * `TypeError`, co każda z sześciu akcji łapie w swoim `try/catch` i zwraca `{ success: false }`.
 * To jest właściwy powód czerwieni testów ścieżki sukcesu: kod dziś fizycznie nie ma jak
 * dosięgnąć modelu przez `tx`, bo w ogóle nie otwiera transakcji.
 *
 * `tx` jest JEDNYM współdzielonym obiektem dla wszystkich pięciu zasobów (upraszcza plik;
 * modele się nie nakładają nazwami, więc nie ma ryzyka kolizji asercji między sekcjami).
 *
 * ═══ KSZTAŁT DOCELOWY (z WO, "Wzorzec zapisu", wiążący) ═══
 * `<action>(id: string, input: { justification: string; legalBasis: string }):
 *   Promise<{ success: boolean; error?: string }>`
 * 1. `getCurrentActorRole()` w try/catch → wyjątek = odmowa uprawnień.
 * 2. `can(actorRole, <resource>, 'delete') !== 'yes'` → odmowa, zero zapytań.
 * 3. `actorEmail` z `createClient().auth.getUser()`; brak e-maila → odmowa.
 * 4. Walidacja Zod (`justification` min 10 po trim, `legalBasis` z `AUDIT_REQUIREMENTS.legalBases`).
 * 5. `prisma.$transaction(async (tx) => { await tx.<model>.delete(...); await tx.auditLog.create(...) })`.
 *
 * Mapowanie resource (tabela WO): leads→leads, installations→installations,
 * incidents→incidents, services→services, authorized_users→authorized_users,
 * logistics (deleguje do leads)→leads (NIGDY 'logistics' — nie istnieje w CHECK bazy).
 */

const {
  transactionMock,
  txLeadDeleteMock,
  txInstalacjeDeleteMock,
  txIncidentDeleteMock,
  txServiceDeleteMock,
  txServiceFindUniqueMock,
  txAuthorizedUserDeleteMock,
  txAuditLogCreateMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
  getUserMock,
  createClientMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  txLeadDeleteMock: vi.fn(),
  txInstalacjeDeleteMock: vi.fn(),
  txIncidentDeleteMock: vi.fn(),
  txServiceDeleteMock: vi.fn(),
  txServiceFindUniqueMock: vi.fn(),
  txAuthorizedUserDeleteMock: vi.fn(),
  txAuditLogCreateMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  getUserMock: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    $transaction: transactionMock,
  },
  // Type-only w produkcji (LeadStatus/InstallationStatus/LegalDocumentKind) — wartości
  // puste wystarczają, bo esbuild je i tak wymazuje z runtime; obecne tu wyłącznie żeby
  // import w plikach akcji się nie wysypał, gdyby kiedyś stały się wartościami.
  LeadStatus: {},
  InstallationStatus: {},
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
  createClient: createClientMock,
}));
getCurrentUserMock.mockImplementation(() => getUserMock());
// `logistics/actions.ts` importuje `shortId` z `@/lib/format-id` (nierozwiązywalne bez
// aliasu `@/*` w vitest.config.mts). Ten plik nie asercjonuje pola `id` zwróconego przez
// funkcje odczytu logistyki, więc mock powtarza prawdziwą implementację zamiast zerować
// zachowanie produkcyjne.
vi.mock('@/lib/format-id', () => ({ shortId: (id: string) => `#${id.substring(0, 8)}` }));

const { deleteLeadAction } = await import('../src/app/(dashboard)/leads/actions');
const { deleteLogisticsOrderAction } = await import('../src/app/(dashboard)/logistics/actions');
const { deleteInstallationAction } = await import('../src/app/(dashboard)/installations/actions');
const { deleteIncidentAction } = await import('../src/app/(dashboard)/incidents/actions');
const { deleteServiceAction } = await import('../src/app/(dashboard)/services/actions');
const { deleteAuthorizedUser } = await import('../src/app/(dashboard)/settings/actions');

const tx = {
  leady: { delete: txLeadDeleteMock },
  instalacje: { delete: txInstalacjeDeleteMock },
  usterki_incidents: { delete: txIncidentDeleteMock },
  serwisy: { delete: txServiceDeleteMock, findUnique: txServiceFindUniqueMock },
  authorizedUser: { delete: txAuthorizedUserDeleteMock },
  auditLog: { create: txAuditLogCreateMock },
};

const ADMIN_EMAIL = 'admin@klikklima.pl';
const VALID_BASIS = AUDIT_REQUIREMENTS.legalBases[0];
const INVALID_BASIS = 'NIEISTNIEJACA_PODSTAWA';
const VALID_JUSTIFICATION = 'Duplikat rekordu utworzony przez pomyłkę operatora.';
const SERVICE_UUID = '11111111-1111-4111-8111-111111111111';

beforeEach(() => {
  transactionMock.mockReset();
  txLeadDeleteMock.mockReset();
  txInstalacjeDeleteMock.mockReset();
  txIncidentDeleteMock.mockReset();
  txServiceDeleteMock.mockReset();
  txServiceFindUniqueMock.mockReset();
  txAuthorizedUserDeleteMock.mockReset();
  txAuditLogCreateMock.mockReset();
  revalidatePathMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  getUserMock.mockReset();
  createClientMock.mockReset();

  transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(tx));
  getCurrentActorRoleMock.mockResolvedValue('admin');
  getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } });
  createClientMock.mockResolvedValue({ auth: { getUser: getUserMock } });
  txServiceFindUniqueMock.mockResolvedValue({ id: SERVICE_UUID });
});

/**
 * Konfiguracja per zasób Fali A (bez logistics — ma osobny opis niżej, bo deleguje).
 */
type WaveAConfig = {
  label: string;
  resource: string;
  fn: (id: string, input: DeleteJustificationInput) => Promise<DeleteActionResult>;
  deleteMock: ReturnType<typeof vi.fn>;
  id: string;
};

const configs: WaveAConfig[] = [
  { label: 'deleteLeadAction', resource: 'leads', fn: deleteLeadAction, deleteMock: txLeadDeleteMock, id: 'lead-1' },
  {
    label: 'deleteInstallationAction',
    resource: 'installations',
    fn: deleteInstallationAction,
    deleteMock: txInstalacjeDeleteMock,
    id: 'instalacja-1',
  },
  {
    label: 'deleteIncidentAction',
    resource: 'incidents',
    fn: deleteIncidentAction,
    deleteMock: txIncidentDeleteMock,
    id: 'usterka-1',
  },
  {
    label: 'deleteServiceAction',
    resource: 'services',
    fn: deleteServiceAction,
    deleteMock: txServiceDeleteMock,
    id: SERVICE_UUID,
  },
  {
    label: 'deleteAuthorizedUser',
    resource: 'authorized_users',
    fn: deleteAuthorizedUser,
    deleteMock: txAuthorizedUserDeleteMock,
    // cuid(), nie UUID — przypadek brzegowy z WO ("record_id to cuid(), nie UUID").
    id: 'ckv8f9q7x0000qzrmn831i7a',
  },
];

for (const cfg of configs) {
  const DENIED_ROLES = ROLES.filter((r) => can(r, cfg.resource, 'delete') !== 'yes');
  const ALLOWED_ROLES = ROLES.filter((r) => can(r, cfg.resource, 'delete') === 'yes');

  describe(`${cfg.label} — SEC-AUDIT-LOG-DELETE`, () => {
    // Kontrola pozytywna kontraktu — bez niej test.each poniżej mógłby cicho przechodzić z
    // zerem przypadków po jednej ze stron.
    // @REQ: SEC-AUDIT-LOG-DELETE
    it('kontrola pozytywna kontraktu — macierz RBAC rozróżnia role dla tego zasobu', () => {
      expect(ALLOWED_ROLES.length).toBeGreaterThan(0);
      expect(DENIED_ROLES.length).toBeGreaterThan(0);
    });

    // AC4 — fail-closed, rola bez delete: zero delete, zero audit.
    // @REQ: SEC-AUDIT-LOG-DELETE
    it.each(DENIED_ROLES)('rola %s odrzucona, zero delete i zero wpisu audytowego', async (role) => {
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

    // AC4 — fail-closed, wyjątek przy odczycie roli.
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

    // AC6 — granica: dokładnie 10 znaków po trim jest dozwolone.
    // @REQ: SEC-AUDIT-LOG-DELETE
    it('justification dokładnie 10 znaków po trim (z otaczającymi spacjami) jest dozwolony', async () => {
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

    // AC6 — kontrola pozytywna: każda wartość z kontraktu jest dozwolona.
    // @REQ: SEC-AUDIT-LOG-DELETE
    it.each(AUDIT_REQUIREMENTS.legalBases)('legalBasis %s (z kontraktu) jest dozwolony', async (basis) => {
      cfg.deleteMock.mockResolvedValue({});
      txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });

      const result = await cfg.fn(cfg.id, { justification: VALID_JUSTIFICATION, legalBasis: basis });

      expect(result.success).toBe(true);
    });

    // AC3 — kompletność wpisu audytowego.
    // @REQ: SEC-AUDIT-LOG-DELETE
    it('AC3 — wpis audytowy ma operation/resource/recordId/actorEmail/actorRole/justification/legalBasis', async () => {
      cfg.deleteMock.mockResolvedValue({});
      txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });
      getCurrentActorRoleMock.mockResolvedValue(ALLOWED_ROLES[0]);
      getUserMock.mockResolvedValue({ data: { user: { email: 'ktos-inny@klikklima.pl' } } });

      await cfg.fn(cfg.id, { justification: VALID_JUSTIFICATION, legalBasis: VALID_BASIS });

      expect(txAuditLogCreateMock).toHaveBeenCalledWith({
        data: {
          operation: 'delete',
          resource: cfg.resource,
          recordId: cfg.id,
          actorEmail: 'ktos-inny@klikklima.pl',
          actorRole: ALLOWED_ROLES[0],
          justification: VALID_JUSTIFICATION,
          legalBasis: VALID_BASIS,
        },
      });
    });

    // AC3 — resource nigdy nie jest 'logistics' (CHECK bazy jest druga linia, kod nie powinien
    // nawet próbować).
    // @REQ: SEC-AUDIT-LOG-DELETE
    it("resource zapisany w audit_log nigdy nie jest 'logistics'", async () => {
      cfg.deleteMock.mockResolvedValue({});
      txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });

      await cfg.fn(cfg.id, { justification: VALID_JUSTIFICATION, legalBasis: VALID_BASIS });

      expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
      const call = txAuditLogCreateMock.mock.calls[0]?.[0];
      expect(call?.data?.resource).toBe(cfg.resource);
    });

    // AC1 — delete i wpis w JEDNEJ transakcji, w tej kolejności.
    // @REQ: SEC-AUDIT-LOG-DELETE
    it('AC1 — delete i auditLog.create wywołane w JEDNEJ transakcji, delete PRZED wpisem', async () => {
      cfg.deleteMock.mockResolvedValue({});
      txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });

      await cfg.fn(cfg.id, { justification: VALID_JUSTIFICATION, legalBasis: VALID_BASIS });

      expect(transactionMock).toHaveBeenCalledTimes(1);
      expect(cfg.deleteMock.mock.invocationCallOrder[0]).toBeLessThan(
        txAuditLogCreateMock.mock.invocationCallOrder[0],
      );
    });

    // AC1/AC2 — błąd zapisu audytowego cofa całą transakcję (dowód pośredni: wynik porażka,
    // revalidatePath — efekt POZA transakcją — nie jest wołane).
    // @REQ: SEC-AUDIT-LOG-DELETE
    it('AC1 — błąd auditLog.create → transakcja odrzucona, wynik porażka, revalidatePath nie wołane', async () => {
      cfg.deleteMock.mockResolvedValue({});
      txAuditLogCreateMock.mockRejectedValue(new Error('CHECK constraint violation'));

      const result = await cfg.fn(cfg.id, { justification: VALID_JUSTIFICATION, legalBasis: VALID_BASIS });

      expect(result.success).toBe(false);
      expect(revalidatePathMock).not.toHaveBeenCalled();
    });

    // AC2 — odwrotny kierunek: błąd delete → auditLog.create NIGDY nie zostaje osiągnięte.
    // @REQ: SEC-AUDIT-LOG-DELETE
    it('AC2 — błąd delete (np. FK BLOCK) → auditLog.create nie zostaje wywołane, wynik porażka', async () => {
      cfg.deleteMock.mockRejectedValue(new Error('Foreign key constraint violated'));

      const result = await cfg.fn(cfg.id, { justification: VALID_JUSTIFICATION, legalBasis: VALID_BASIS });

      expect(result.success).toBe(false);
      expect(txAuditLogCreateMock).not.toHaveBeenCalled();
    });

    // AC9 — powtórzone wywołanie na już usuniętym rekordzie nie tworzy drugiego wpisu.
    // @REQ: SEC-AUDIT-LOG-DELETE
    it('AC9 — drugie wywołanie na już usuniętym rekordzie nie tworzy drugiego wpisu audytowego', async () => {
      cfg.deleteMock
        .mockResolvedValueOnce({}) // pierwsze wywołanie: rekord istnieje
        .mockRejectedValueOnce(new Error('Record to delete does not exist.')); // drugie: P2025
      txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });

      const first = await cfg.fn(cfg.id, { justification: VALID_JUSTIFICATION, legalBasis: VALID_BASIS });
      const second = await cfg.fn(cfg.id, { justification: VALID_JUSTIFICATION, legalBasis: VALID_BASIS });

      expect(first.success).toBe(true);
      expect(second.success).toBe(false);
      expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
    });

    // Przypadek brzegowy — współbieżność: dwa równoległe usunięcia tego samego id, jedno
    // kończy się sukcesem z jednym wpisem, drugie odmową bez wpisu. Rozstrzygnięcie należy do
    // bazy (wynik delete), nie do odczytu poprzedzającego zapis — dlatego oba wywołania są
    // Promise.all, nie sekwencyjne.
    // UWAGA: to jest dowód na poziomie mocka (kolejność/wynik wywołań `deleteMock`), NIE dowód
    // realnej współbieżności bazodanowej. Jest mechanicznie identyczny z testem AC9 powyżej —
    // implementacja z odczytem `findUnique` PRZED zapisem (wzorzec, przed którym ostrzega WO)
    // przeszłaby ten test tak samo jak implementacja poprawna. Prawdziwy dowód współbieżności
    // wymagałby żywej instancji Postgresa i osobnego mechanizmu (test integracyjny/E2E), nie
    // jednostkowego mocka — nie czytać tego testu jako mocniejszego pokrycia, niż jest.
    // @REQ: SEC-AUDIT-LOG-DELETE
    it('współbieżność — dwa równoległe usunięcia tego samego id: jeden sukces+wpis, drugi odmowa+brak wpisu', async () => {
      cfg.deleteMock
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new Error('Record to delete does not exist.'));
      txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });

      const [a, b] = await Promise.all([
        cfg.fn(cfg.id, { justification: VALID_JUSTIFICATION, legalBasis: VALID_BASIS }),
        cfg.fn(cfg.id, { justification: VALID_JUSTIFICATION, legalBasis: VALID_BASIS }),
      ]);

      const successes = [a, b].filter((r) => r.success);
      const failures = [a, b].filter((r) => !r.success);
      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
      expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
    });
  });
}

/**
 * `deleteServiceAction` — uwaga specjalna z WO: dziś `findUnique` sprawdzający istnienie
 * jest PRZED `delete`, POZA transakcją (okno wyścigu). Wymóg: sprawdzenie istnienia wchodzi
 * DO tej samej transakcji co delete+audit, ALBO znika (i tak `delete` na nieistniejącym
 * rekordzie rzuci błąd, który transakcja i tak musi obsłużyć — patrz AC9/AC2 powyżej).
 * W obu wariantach docelowych `tx.serwisy.findUnique` (jeśli w ogóle zostanie) MUSI być
 * wywołane w ramach TEJ SAMEJ transakcji, nigdy jako osobne zapytanie `prisma.serwisy.findUnique`
 * poprzedzające `$transaction`.
 */
describe('deleteServiceAction — okno wyścigu findUnique/delete (SEC-AUDIT-LOG-DELETE)', () => {
  beforeEach(() => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
  });

  // @REQ: SEC-AUDIT-LOG-DELETE
  it('sprawdzenie istnienia rekordu (jeśli obecne) nie poprzedza otwarcia $transaction', async () => {
    txServiceDeleteMock.mockResolvedValue({});
    txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });

    await deleteServiceAction(SERVICE_UUID, { justification: VALID_JUSTIFICATION, legalBasis: VALID_BASIS });

    // Jeśli implementacja w ogóle woła findUnique, musi to być invocationCallOrder PO
    // otwarciu transakcji (transactionMock) — nie przed nią. Brak wywołania w ogóle też
    // spełnia ten wymóg (wariant "znika" z uwagi WO).
    if (txServiceFindUniqueMock.mock.calls.length > 0) {
      expect(transactionMock.mock.invocationCallOrder[0]).toBeLessThan(
        txServiceFindUniqueMock.mock.invocationCallOrder[0],
      );
    }
    expect(transactionMock).toHaveBeenCalledTimes(1);
  });
});

/**
 * `deleteLogisticsOrderAction` — deleguje do `deleteLeadAction`. AC7: dokładnie JEDEN wpis
 * audytowy z resource='leads' na usunięcie, nie dwa (bo deleguje, nie tworzy własnego wpisu).
 */
describe('deleteLogisticsOrderAction — deleguje do deleteLeadAction (AC7, SEC-AUDIT-LOG-DELETE)', () => {
  beforeEach(() => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    txLeadDeleteMock.mockResolvedValue({});
    txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });
  });

  // @REQ: SEC-AUDIT-LOG-DELETE
  it("AC7 — usunięcie przez deleteLogisticsOrderAction tworzy DOKŁADNIE jeden wpis z resource='leads'", async () => {
    const result = await deleteLogisticsOrderAction('lead-logistics-1', {
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(true);
    expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
    expect(txAuditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ resource: 'leads', recordId: 'lead-logistics-1' }) }),
    );
  });

  // Odmowa roli na leads.delete odmawia też logistics (deleguje bramkę razem z resztą).
  // @REQ: SEC-AUDIT-LOG-DELETE
  it('rola bez leads.delete jest odrzucona przez deleteLogisticsOrderAction, zero wpisu', async () => {
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');

    const result = await deleteLogisticsOrderAction('lead-logistics-1', {
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(false);
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });
});

/**
 * Przypadki brzegowe specyficzne dla `deleteAuthorizedUser` (WO, sekcja "Przypadki brzegowe").
 */
describe('deleteAuthorizedUser — przypadki brzegowe (SEC-AUDIT-LOG-DELETE)', () => {
  const CUID_ID = 'ckv8f9q7x0000qzrmn831i7a';

  beforeEach(() => {
    getCurrentActorRoleMock.mockResolvedValue('admin');
    txAuthorizedUserDeleteMock.mockResolvedValue({});
    txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });
  });

  // record_id jest cuid(), nie UUID — wpis musi przejść mimo braku FK i mimo że konto po
  // operacji nie istnieje.
  // @REQ: SEC-AUDIT-LOG-DELETE
  it('record_id typu cuid() (nie UUID) trafia do wpisu audytowego bez modyfikacji formatu', async () => {
    await deleteAuthorizedUser(CUID_ID, { justification: VALID_JUSTIFICATION, legalBasis: VALID_BASIS });

    expect(txAuditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ recordId: CUID_ID }) }),
    );
  });

  // Usunięcie własnego konta admina: actor_email == e-mail usuwanego konta. To poprawne i
  // musi przejść (konto zniknęło, dowód zostaje).
  // @REQ: SEC-AUDIT-LOG-DELETE
  it('usunięcie własnego konta admina zapisuje wpis z actor_email równym e-mailowi usuwanego konta', async () => {
    const OWN_EMAIL = 'admin-usuwany@klikklima.pl';
    getUserMock.mockResolvedValue({ data: { user: { email: OWN_EMAIL } } });

    const result = await deleteAuthorizedUser(CUID_ID, {
      justification: VALID_JUSTIFICATION,
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(true);
    expect(txAuditLogCreateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ actorEmail: OWN_EMAIL, recordId: CUID_ID }) }),
    );
  });
});
