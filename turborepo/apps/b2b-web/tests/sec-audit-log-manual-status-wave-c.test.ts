import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ROLES, can, AUDIT_REQUIREMENTS, TRANSITIONS, STATE_META } from '@klikklima/contracts';
import type { DeleteJustificationInput } from '../src/lib/audit/delete-justification-schema';
import { isManualStatusChange } from '../src/lib/audit/manual-status-classifier';

/**
 * WO: docs/workorders/SEC-AUDIT-LOG-MANUAL-STATUS.md — Fala C (`test-author` → `implementer-server`).
 * Wymaganie: `SEC-AUDIT-LOG-MANUAL-STATUS` (`contracts/requirements.contract.mjs:409`, TODO, HIGH).
 * Zakres: WYŁĄCZNIE `advanceLeadStatus` (`apps/b2b-web/src/app/(dashboard)/leads/actions.ts`,
 * dziś ok. linii 604-660). Fale A (`archiveLost`/`returnToFunnel`) i B
 * (`bypassLogisticsOrder`/`rollbackLogisticsOrder`) POZA ZAKRESEM tego pliku — już zielone.
 *
 * ═══ KSZTAŁT SYGNATURY WYBRANY W TEJ FALI (decyzja test-authora) ═══
 *   advanceLeadStatus(leadId: string, targetStatus: LeadStatus, input?: DeleteJustificationInput)
 * `input` jest TRZECIM parametrem, opcjonalnym W TYPESCRIPT (żeby wywołania dla przejść
 * normalnych — K1/K2/K3/K4 wszystkie fałszywe — kompilowały się bez podawania obiektu,
 * którego serwer i tak by nie odczytał) ale WARUNKOWO WYMAGANYM W RUNTIME: funkcja liczy
 * `isManualStatusChange(transitionId)` DLA znalezionego przejścia i, jeżeli wynik to `true`,
 * waliduje `input` dokładnie jak `deleteJustificationSchema` (ten sam plik co Fala A/B —
 * AC10 zakazuje drugiego `z.string().trim().min(10)`). Dla przejść normalnych `input`,
 * jeśli podany, jest IGNOROWANY (nie waliduje się go, nie ląduje w żadnym zapisie) — nie
 * powoduje odmowy. Ten wybór (ignoruj, nie odrzucaj) jest jawnie testowany niżej.
 *
 * ═══ MECHANIZM WYSZUKIWANIA PRZEJŚCIA PO (from, to) ═══
 * `findTransition` z `@klikklima/contracts` szuka po (`from`, `action`), nie po (`from`,
 * `to`) — nie nadaje się tu wprost (`advanceLeadStatus` nie zna `action`, tylko cel).
 * Implementer potrzebuje NOWEGO helpera (proponowana nazwa i lokalizacja, decyzja
 * test-authora, NIE zaimplementowana w tym oknie):
 *   apps/b2b-web/src/lib/audit/find-transition-by-from-to.ts
 *   export function findTransitionByFromTo(from: LeadStatus, to: LeadStatus): LeadTransition | undefined
 * Ten plik NIE importuje ani nie testuje tego helpera bezpośrednio (byłoby to testowanie
 * szczegółu implementacyjnego) — testuje wyłącznie zachowanie `advanceLeadStatus` na
 * granicy. Test poniżej oblicza OCZEKIWANE `transitionId`/klasyfikację przez dokładnie ten
 * sam mechanizm, którego oczekujemy od helpera: `TRANSITIONS.find(t => t.from === from &&
 * t.to === to)`, więc test jest odporny na przyszłą zmianę kontraktu (AC4) i nie hardkoduje
 * własnej listy `manual: true/false` obok tej już ustalonej w `manual-status-classifier.ts`
 * (Fala 0, potwierdzone przez Falę B).
 *
 * ═══ K2 — PRZEJŚCIE, KTÓREGO KONTRAKT NIE ZNA (AWAITING_AUDIT → NEW_LEAD) ═══
 * Decyzja człowieka 2026-09-04 (patrz WO, sekcja tuż nad tabelą mapowania): TWARDA ODMOWA,
 * zero zapisu — NIE wpis audytowy. To NIE jest legalny wyjątek wymagający audytu, tylko
 * ręczna dziura w regule, którą trzeba będzie kiedyś świadomie dopisać do kontraktu
 * (osobne ID). `advanceLeadStatus` ma dziś ten cel w swojej lokalnej mapie
 * (`AWAITING_AUDIT: ["AUDIT_COMPLETED", "NEW_LEAD"]`) — po tej fali MA GO NIE MIEĆ.
 *
 * ═══ LUKA ZNALEZIONA W TABELI MAPOWANIA WO (do potwierdzenia przez człowieka) ═══
 * Tabela WO ("dlaczego to jest sedno tego WO") wymienia 13 przejść klasyfikowanych + 1 BRAK
 * (`AWAITING_AUDIT → NEW_LEAD`) = 14 pozycji. Lokalna mapa `ALLOWED_TRANSITIONS` w kodzie ma
 * FAKTYCZNIE 15 par (from,to) — brakuje w tabeli WO pozycji
 * `AWAITING_AUDIT → AUDIT_COMPLETED` (T02 `sendQuote`, actor AUDITOR, trigger
 * AUTO_TRANSITION), która JEST w `ALLOWED_TRANSITIONS.AWAITING_AUDIT`. Klasyfikacja
 * mechaniczna (K1: actor AUDITOR ∉ {ADMIN,DISPATCHER}, brak `manualEquivalent`) daje
 * `isManualStatusChange('T02') === true`. Ten plik TRAKTUJE T02 jak każde inne przejście
 * manualne z tabeli (spójnie z AC4 — klasyfikacja z kontraktu, nie z listy WO) i zgłasza
 * lukę w raporcie końcowym zamiast czekać w miejscu.
 *
 * ═══ WZORZEC MOCKOWANIA ═══ jak Fala B (`bypassLogisticsOrder`): `advanceLeadStatus` DZIŚ
 * nie ma `$transaction` — `prismaLeadFindUniqueMock`/`prismaLeadUpdateMock` (POZA
 * transakcją) muszą pozostać NIEWYWOŁANE po naprawie; cała logika (blokada wiersza, odczyt,
 * walidacja, zapis, wpis audytowy) ma się przenieść do `tx`. `releaseCrewSlot`/
 * `suspendLogisticsSla` (`logistics/rollback-effects.ts`) są mockowane jako MODUŁ (nie
 * wołane naprawdę) wyłącznie po to, żeby dowieść, że `advanceLeadStatus` ich NIE woła
 * (dług udokumentowany w WO, `logistics/actions.ts:267-272` — POZA ZAKRESEM naprawy).
 */

const {
  transactionMock,
  prismaLeadFindUniqueMock,
  prismaLeadUpdateMock,
  txLeadFindUniqueMock,
  txLeadUpdateMock,
  txAuditLogCreateMock,
  txQueryRawMock,
  releaseCrewSlotMock,
  suspendLogisticsSlaMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
  getUserMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  prismaLeadFindUniqueMock: vi.fn(),
  prismaLeadUpdateMock: vi.fn(),
  txLeadFindUniqueMock: vi.fn(),
  txLeadUpdateMock: vi.fn(),
  txAuditLogCreateMock: vi.fn(),
  txQueryRawMock: vi.fn(),
  releaseCrewSlotMock: vi.fn(),
  suspendLogisticsSlaMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  getUserMock: vi.fn(),
}));

const LEAD_STATUS_ENUM = {
  NEW_LEAD: 'NEW_LEAD',
  AWAITING_AUDIT: 'AWAITING_AUDIT',
  AUDIT_COMPLETED: 'AUDIT_COMPLETED',
  AWAITING_CREW_ASSIGNMENT: 'AWAITING_CREW_ASSIGNMENT',
  HARDWARE_IN_WAREHOUSE: 'HARDWARE_IN_WAREHOUSE',
  HARDWARE_IN_TRANSIT: 'HARDWARE_IN_TRANSIT',
  AWAITING_INSTALLATION: 'AWAITING_INSTALLATION',
  INSTALLATION_COMPLETED: 'INSTALLATION_COMPLETED',
  QUOTE_REJECTED: 'QUOTE_REJECTED',
  ROLLBACK_RESCHEDULING: 'ROLLBACK_RESCHEDULING',
  ARCHIVED_LOST: 'ARCHIVED_LOST',
} as const;

vi.mock('@repo/database', () => ({
  prisma: {
    leady: { findUnique: prismaLeadFindUniqueMock, update: prismaLeadUpdateMock },
    $transaction: transactionMock,
  },
  LeadStatus: LEAD_STATUS_ENUM,
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}));
vi.mock('../src/app/(dashboard)/logistics/rollback-effects', () => ({
  releaseCrewSlot: releaseCrewSlotMock,
  suspendLogisticsSla: suspendLogisticsSlaMock,
}));
getCurrentUserMock.mockImplementation(() => getUserMock());

const rawActions = await import('../src/app/(dashboard)/leads/actions');

type AdvanceFn = (
  leadId: string,
  targetStatus: string,
  input?: DeleteJustificationInput,
) => Promise<{ success: boolean; error?: string }>;
// Rzutowanie przez `unknown`, nie `any` (zakaz CLAUDE.md) — sygnatura dzisiejsza ma dwa
// parametry (`leadId`, `targetStatus`), bez `input`.
const advanceLeadStatus = rawActions.advanceLeadStatus as unknown as AdvanceFn;

const tx = {
  leady: { findUnique: txLeadFindUniqueMock, update: txLeadUpdateMock },
  auditLog: { create: txAuditLogCreateMock },
  $queryRaw: txQueryRawMock,
};

const OPERATOR_EMAIL = 'dyspozytor@klikklima.pl';
const VALID_BASIS = AUDIT_REQUIREMENTS.legalBases[0];
const INVALID_BASIS = 'NIEISTNIEJACA_PODSTAWA';
const VALID_JUSTIFICATION = 'Ręczne przejście wykonane telefonicznie na prośbę klienta.';
const VALID_INPUT: DeleteJustificationInput = { justification: VALID_JUSTIFICATION, legalBasis: VALID_BASIS };
const LEAD_ID = 'lead-1';

const leadFixture = (status: string, overrides: Record<string, unknown> = {}) => ({
  id: LEAD_ID,
  status,
  audytor_id: 'audytor-1',
  ...overrides,
});

const DENIED_ROLES = ROLES.filter((r) => can(r, 'leads', 'update') !== 'yes');

beforeEach(() => {
  transactionMock.mockReset();
  prismaLeadFindUniqueMock.mockReset();
  prismaLeadUpdateMock.mockReset();
  txLeadFindUniqueMock.mockReset();
  txLeadUpdateMock.mockReset();
  txAuditLogCreateMock.mockReset();
  txQueryRawMock.mockReset();
  releaseCrewSlotMock.mockReset();
  suspendLogisticsSlaMock.mockReset();
  revalidatePathMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  getUserMock.mockReset();

  transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(tx));
  getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
  getUserMock.mockResolvedValue({ data: { user: { email: OPERATOR_EMAIL } } });
  prismaLeadUpdateMock.mockResolvedValue({});
  txLeadFindUniqueMock.mockResolvedValue(leadFixture('NEW_LEAD'));
  txLeadUpdateMock.mockResolvedValue({});
  txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });
  txQueryRawMock.mockResolvedValue([]);
});

// ═══ AC13/K2 — przejście, którego kontrakt nie zna ═══

describe('advanceLeadStatus — AWAITING_AUDIT → NEW_LEAD (K2, decyzja człowieka 2026-09-04: odmowa)', () => {
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('odrzucone bez input — zero update, zero wpisu audytowego', async () => {
    txLeadFindUniqueMock.mockResolvedValue(leadFixture('AWAITING_AUDIT'));

    const result = await advanceLeadStatus(LEAD_ID, 'NEW_LEAD');

    expect(result.success).toBe(false);
    expect(txLeadUpdateMock).not.toHaveBeenCalled();
    expect(prismaLeadUpdateMock).not.toHaveBeenCalled();
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });

  // Nawet z uzasadnieniem poprawnym — TO NIE JEST wyjątek wymagający audytu, to odmowa.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('odrzucone MIMO poprawnego input — nie jest to legalny wyjątek do zaaudytowania, tylko dziura w kontrakcie', async () => {
    txLeadFindUniqueMock.mockResolvedValue(leadFixture('AWAITING_AUDIT'));

    const result = await advanceLeadStatus(LEAD_ID, 'NEW_LEAD', VALID_INPUT);

    expect(result.success).toBe(false);
    expect(txLeadUpdateMock).not.toHaveBeenCalled();
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });
});

// ═══ Klasyfikacja per przejście — 14 par (from,to) z ALLOWED_TRANSITIONS (WO
// wymienia 13 + T02, luka opisana w nagłówku pliku) ═══

type CaseRow = { from: string; to: string };

const CASES: CaseRow[] = [
  { from: 'NEW_LEAD', to: 'AWAITING_AUDIT' }, // T01
  { from: 'AWAITING_AUDIT', to: 'AUDIT_COMPLETED' }, // T02 (luka WO, patrz nagłówek)
  { from: 'AUDIT_COMPLETED', to: 'AWAITING_CREW_ASSIGNMENT' }, // T03
  { from: 'AUDIT_COMPLETED', to: 'QUOTE_REJECTED' }, // T04
  { from: 'AWAITING_CREW_ASSIGNMENT', to: 'HARDWARE_IN_WAREHOUSE' }, // T05
  { from: 'AWAITING_CREW_ASSIGNMENT', to: 'ROLLBACK_RESCHEDULING' }, // T10
  { from: 'HARDWARE_IN_WAREHOUSE', to: 'HARDWARE_IN_TRANSIT' }, // T06
  { from: 'HARDWARE_IN_WAREHOUSE', to: 'AWAITING_INSTALLATION' }, // T07
  { from: 'HARDWARE_IN_WAREHOUSE', to: 'ROLLBACK_RESCHEDULING' }, // T11
  { from: 'HARDWARE_IN_TRANSIT', to: 'AWAITING_INSTALLATION' }, // T08
  { from: 'HARDWARE_IN_TRANSIT', to: 'ROLLBACK_RESCHEDULING' }, // T12
  { from: 'AWAITING_INSTALLATION', to: 'INSTALLATION_COMPLETED' }, // T09
  { from: 'AWAITING_INSTALLATION', to: 'ROLLBACK_RESCHEDULING' }, // T13
  { from: 'ROLLBACK_RESCHEDULING', to: 'AWAITING_CREW_ASSIGNMENT' }, // T14
];

const classified = CASES.map(({ from, to }) => {
  const transition = TRANSITIONS.find((t) => t.from === from && t.to === to);
  if (!transition) {
    throw new Error(`Fixture błędna: (${from} -> ${to}) nie istnieje w TRANSITIONS.`);
  }
  return { from, to, id: transition.id, manual: isManualStatusChange(transition.id) };
});

// Kontrola pozytywna: dowód, że lista wyczerpuje ALLOWED_TRANSITIONS z WO (13 + T02 = 14,
// minus AWAITING_AUDIT->NEW_LEAD testowane osobno wyżej).
// @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
it('kontrola pozytywna — 14 par (from,to) z lokalnej mapy advanceLeadStatus mają odpowiednik w TRANSITIONS', () => {
  expect(classified).toHaveLength(14);
  expect(classified.every((c) => c.id)).toBe(true);
});

describe.each(classified)(
  'advanceLeadStatus — $from → $to ($id, manual=$manual)',
  ({ from, to, manual }) => {
    // AC1/AC3/AC4 — klasyfikacja pochodzi z kontraktu: manualne tworzą DOKŁADNIE jeden
    // wpis audit_log z operation/resource/recordId poprawnymi; normalne nie tworzą nic.
    // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
    it(`${manual ? 'TWORZY' : 'NIE TWORZY'} wpisu audytowego, zgodnie z isManualStatusChange`, async () => {
      txLeadFindUniqueMock.mockResolvedValue(leadFixture(from));

      const result = await advanceLeadStatus(LEAD_ID, to, manual ? VALID_INPUT : undefined);

      expect(result.success).toBe(true);
      expect(txLeadUpdateMock).toHaveBeenCalledTimes(1);
      expect(txLeadUpdateMock.mock.calls[0][0]).toEqual(
        expect.objectContaining({ data: expect.objectContaining({ status: to }) }),
      );

      if (manual) {
        expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
        expect(txAuditLogCreateMock).toHaveBeenCalledWith({
          data: expect.objectContaining({
            operation: 'manual_status_change',
            resource: 'leads',
            recordId: LEAD_ID,
            actorEmail: OPERATOR_EMAIL,
            actorRole: 'dyspozytor',
            justification: VALID_JUSTIFICATION,
            legalBasis: VALID_BASIS,
          }),
        });
      } else {
        expect(txAuditLogCreateMock).not.toHaveBeenCalled();
      }
    });

    if (manual) {
      // AC7 — brak input na przejściu manualnym: odmowa, zero update, zero wpisu.
      // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
      it('AC7 — brak input odrzucone bez zmiany statusu i bez wpisu audytowego', async () => {
        txLeadFindUniqueMock.mockResolvedValue(leadFixture(from));

        const result = await advanceLeadStatus(LEAD_ID, to, undefined);

        expect(result.success).toBe(false);
        expect(txLeadUpdateMock).not.toHaveBeenCalled();
        expect(txAuditLogCreateMock).not.toHaveBeenCalled();
      });
    } else {
      // Decyzja test-authora: na przejściu normalnym `input`, jeśli podany (nawet
      // niepoprawny), jest IGNOROWANY — nie powoduje odmowy.
      // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
      it('input podany na przejściu normalnym jest ignorowany — nie powoduje odmowy, nie tworzy wpisu', async () => {
        txLeadFindUniqueMock.mockResolvedValue(leadFixture(from));

        const result = await advanceLeadStatus(LEAD_ID, to, {
          justification: 'x',
          legalBasis: INVALID_BASIS as DeleteJustificationInput['legalBasis'],
        });

        expect(result.success).toBe(true);
        expect(txAuditLogCreateMock).not.toHaveBeenCalled();
      });
    }
  },
);

// ═══ AC7/AC10 — walidacja justification/legalBasis na przejściu reprezentatywnym
// (AUDIT_COMPLETED -> AWAITING_CREW_ASSIGNMENT, T03, manual=true, bez dodatkowej
// walidacji biznesowej typu audytor_id) ═══

describe('advanceLeadStatus — walidacja input (AC7/AC10, reprezentatywne przejście manualne T03)', () => {
  beforeEach(() => {
    txLeadFindUniqueMock.mockResolvedValue(leadFixture('AUDIT_COMPLETED'));
  });

  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it.each([
    ['', 'pusty string'],
    ['   ', 'same białe znaki'],
    ['  123456789  ', '9 znaków po trim'],
  ] as const)('justification niepoprawny (%s — %s) odrzucony bez zmiany statusu', async (justification, _label) => {
    const result = await advanceLeadStatus(LEAD_ID, 'AWAITING_CREW_ASSIGNMENT', {
      justification,
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(false);
    expect(txLeadUpdateMock).not.toHaveBeenCalled();
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });

  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('justification dokładnie 10 znaków po trim jest dozwolony', async () => {
    const result = await advanceLeadStatus(LEAD_ID, 'AWAITING_CREW_ASSIGNMENT', {
      justification: '  1234567890  ',
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(true);
    expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
  });

  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('legalBasis spoza AUDIT_REQUIREMENTS.legalBases odrzucony bez zmiany statusu', async () => {
    expect(AUDIT_REQUIREMENTS.legalBases).not.toContain(INVALID_BASIS);

    const result = await advanceLeadStatus(LEAD_ID, 'AWAITING_CREW_ASSIGNMENT', {
      justification: VALID_JUSTIFICATION,
      legalBasis: INVALID_BASIS as DeleteJustificationInput['legalBasis'],
    });

    expect(result.success).toBe(false);
    expect(txLeadUpdateMock).not.toHaveBeenCalled();
  });

  // Kontrola pozytywna: każda wartość ze słownika kontraktu jest dozwolona.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it.each(AUDIT_REQUIREMENTS.legalBases)('legalBasis %s (z kontraktu) jest dozwolony', async (basis) => {
    const result = await advanceLeadStatus(LEAD_ID, 'AWAITING_CREW_ASSIGNMENT', {
      justification: VALID_JUSTIFICATION,
      legalBasis: basis,
    });

    expect(result.success).toBe(true);
  });
});

// ═══ AC6 — bramka roli PRZED jakimkolwiek zapytaniem, fail-closed ═══

describe('advanceLeadStatus — bramka roli (AC6, SEC-AUDIT-LOG-MANUAL-STATUS)', () => {
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it.each(DENIED_ROLES)('rola %s odrzucona fail-closed, zero zapytań i zero wpisu audytowego', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);

    const result = await advanceLeadStatus(LEAD_ID, 'AWAITING_AUDIT');

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
    expect(prismaLeadFindUniqueMock).not.toHaveBeenCalled();
    expect(prismaLeadUpdateMock).not.toHaveBeenCalled();
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });

  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('brak roli (null) odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await advanceLeadStatus(LEAD_ID, 'AWAITING_AUDIT');

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('błąd zapytania o rolę daje odmowę, nie nieobsłużony wyjątek, bez odczytu leada', async () => {
    getCurrentActorRoleMock.mockRejectedValue(new Error('błąd zapytania o rolę'));

    const result = await advanceLeadStatus(LEAD_ID, 'AWAITING_AUDIT');

    expect(result).toMatchObject({ success: false });
    expect(transactionMock).not.toHaveBeenCalled();
  });

  // AC5 — brak e-maila w sesji, PRZED transakcją (fail-closed) — przejście manualne, więc
  // e-mail musi być rozstrzygnięty zanim cokolwiek trafi do bazy.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('brak e-maila w sesji odrzucony fail-closed, PRZED transakcją (przejście manualne T03)', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: null } } });

    const result = await advanceLeadStatus(LEAD_ID, 'AWAITING_CREW_ASSIGNMENT', VALID_INPUT);

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
  });
});

// ═══ AC2 — transakcyjność i AC8 — blokada wiersza (reprezentatywne przejście T03) ═══

describe('advanceLeadStatus — transakcyjność i blokada wiersza (AC2/AC8)', () => {
  beforeEach(() => {
    txLeadFindUniqueMock.mockResolvedValue(leadFixture('AUDIT_COMPLETED'));
  });

  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('AC2 — status i wpis audytowy trafiają do JEDNEJ, NOWEJ transakcji, nie do prisma.leady.update bezpośrednio', async () => {
    const result = await advanceLeadStatus(LEAD_ID, 'AWAITING_CREW_ASSIGNMENT', VALID_INPUT);

    expect(result.success).toBe(true);
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(prismaLeadUpdateMock).not.toHaveBeenCalled();
    expect(txLeadUpdateMock).toHaveBeenCalledTimes(1);
    expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
  });

  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('AC2 — update statusu wywołany PRZED auditLog.create, w tej samej transakcji', async () => {
    await advanceLeadStatus(LEAD_ID, 'AWAITING_CREW_ASSIGNMENT', VALID_INPUT);

    expect(txLeadUpdateMock).toHaveBeenCalledTimes(1);
    expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
    expect(txLeadUpdateMock.mock.invocationCallOrder[0]).toBeLessThan(
      txAuditLogCreateMock.mock.invocationCallOrder[0],
    );
  });

  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('AC2 — błąd auditLog.create → wynik porażka, revalidatePath nie wołane (transakcja wycofana)', async () => {
    txAuditLogCreateMock.mockRejectedValue(new Error('CHECK constraint violation'));

    const result = await advanceLeadStatus(LEAD_ID, 'AWAITING_CREW_ASSIGNMENT', VALID_INPUT);

    expect(result.success).toBe(false);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('AC2 — błąd update statusu → auditLog.create nie zostaje wywołane', async () => {
    txLeadUpdateMock.mockRejectedValue(new Error('DB error'));

    const result = await advanceLeadStatus(LEAD_ID, 'AWAITING_CREW_ASSIGNMENT', VALID_INPUT);

    expect(result.success).toBe(false);
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });

  // AC8 — pułapka 4 z CLAUDE.md: blokada MUSI być w bazie (`SELECT ... FOR UPDATE`),
  // nie w odczycie JS poprzedzającym zapis. Sprawdzamy, że PIERWSZE wywołanie
  // `tx.$queryRaw` niesie `FOR UPDATE` na `leady` i poprzedza (invocationCallOrder)
  // odczyt statusu (`tx.leady.findUnique`), update i wpis audytowy — dokładnie
  // wzorzec z `bypassLogisticsOrder`/`rollbackLogisticsOrder` (Fala B).
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('AC8 — blokada wiersza leady (FOR UPDATE) w tx.$queryRaw poprzedza odczyt/zapis statusu', async () => {
    await advanceLeadStatus(LEAD_ID, 'AWAITING_CREW_ASSIGNMENT', VALID_INPUT);

    expect(txQueryRawMock).toHaveBeenCalled();

    const firstSql = txQueryRawMock.mock.calls[0][0];
    const firstSqlText = Array.isArray(firstSql) ? firstSql.join('?') : String(firstSql);
    expect(firstSqlText).toMatch(/FOR UPDATE/i);
    expect(firstSqlText).toMatch(/leady/i);

    const lockCallOrder = txQueryRawMock.mock.invocationCallOrder[0];
    expect(lockCallOrder).toBeLessThan(txLeadFindUniqueMock.mock.invocationCallOrder[0]);
    expect(lockCallOrder).toBeLessThan(txLeadUpdateMock.mock.invocationCallOrder[0]);
    expect(lockCallOrder).toBeLessThan(txAuditLogCreateMock.mock.invocationCallOrder[0]);
  });

  // AC9 — idempotencja: cel identyczny z bieżącym statusem nie zmienia rekordu i nie
  // tworzy wpisu.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('AC9 — cel identyczny z bieżącym statusem nie zmienia rekordu i nie tworzy wpisu', async () => {
    txLeadFindUniqueMock.mockResolvedValue(leadFixture('AWAITING_CREW_ASSIGNMENT'));

    const result = await advanceLeadStatus(LEAD_ID, 'AWAITING_CREW_ASSIGNMENT', VALID_INPUT);

    expect(result.success).toBe(false);
    expect(txLeadUpdateMock).not.toHaveBeenCalled();
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });

  // Przypadek pusty: lead nieistniejący wewnątrz tx.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('lead nieistniejący (findUnique null wewnątrz tx) odrzucony bez wpisu audytowego', async () => {
    txLeadFindUniqueMock.mockResolvedValue(null);

    const result = await advanceLeadStatus(LEAD_ID, 'AWAITING_CREW_ASSIGNMENT', VALID_INPUT);

    expect(result.success).toBe(false);
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });

  // AC8 — współbieżność: dwa wywołania "równoległe" na tym samym leadzie; drugi odczyt
  // (symulujący drugi start transakcji po zwolnieniu blokady przez pierwszą) widzi już
  // stan zmieniony przez pierwsze wywołanie. Dowód WYNIKOWY (dokładnie jeden sukces,
  // dokładnie jeden wpis) — NIE dowód istnienia blokady (to test wyżej, przez
  // invocationCallOrder na FOR UPDATE).
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('AC8 — dwa równoległe wywołania na tym samym leadzie kończą się dokładnie jednym sukcesem i jednym wpisem', async () => {
    txLeadFindUniqueMock
      .mockResolvedValueOnce(leadFixture('AUDIT_COMPLETED'))
      .mockResolvedValueOnce(leadFixture('AWAITING_CREW_ASSIGNMENT'));

    const [first, second] = await Promise.all([
      advanceLeadStatus(LEAD_ID, 'AWAITING_CREW_ASSIGNMENT', VALID_INPUT),
      advanceLeadStatus(LEAD_ID, 'AWAITING_CREW_ASSIGNMENT', VALID_INPUT),
    ]);

    const successes = [first, second].filter((r) => r.success);
    expect(successes).toHaveLength(1);
    expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
  });

  // TEST-DEFECT naprawiony (zgłoszenie implementer-server, 2026-09-07): pierwotna
  // wersja tego testu zakładała, że bypass (T07, HARDWARE_IN_WAREHOUSE ->
  // AWAITING_INSTALLATION) i rollback (cel ROLLBACK_RESCHEDULING) są WZAJEMNIE
  // WYKLUCZAJĄCE — to było błędne. Po sukcesie bypassu lead jest w
  // AWAITING_INSTALLATION, z którego AWAITING_INSTALLATION -> ROLLBACK_RESCHEDULING
  // (T13, `ALLOWED_TRANSITIONS.AWAITING_INSTALLATION` zawiera `ROLLBACK_RESCHEDULING`)
  // jest NIEZALEŻNYM, LEGALNYM przejściem — dowiedzionym osobno, zielono, w
  // `describe.each(classified)` (linie ok. 251-315). Realny kod daje więc DWA
  // sukcesy dla tej pary, nie jeden — asercja `toHaveLength(1)` była fałszywą
  // przesłanką testu, nie błędem `advanceLeadStatus`.
  //
  // Poprawiony scenariusz: TA SAMA operacja (ten sam cel, T07, HARDWARE_IN_WAREHOUSE
  // -> AWAITING_INSTALLATION) wywołana "równolegle" dwa razy na tym samym leadzie.
  // Pierwsze wywołanie odczytuje HARDWARE_IN_WAREHOUSE i przechodzi do
  // AWAITING_INSTALLATION. Drugie wywołanie — dzięki blokadzie `FOR UPDATE`, która
  // wymusza świeży odczyt po zwolnieniu blokady przez pierwszą transakcję — odczytuje
  // już AWAITING_INSTALLATION. Cel drugiego wywołania to wciąż AWAITING_INSTALLATION,
  // a `ALLOWED_TRANSITIONS.AWAITING_INSTALLATION` NIE zawiera samo-przejścia
  // `AWAITING_INSTALLATION -> AWAITING_INSTALLATION` — więc druga próba dostaje
  // odmowę z powodu nieprawidłowego przejścia. To dowód WYNIKOWY (dokładnie jeden
  // sukces, dokładnie jeden wpis), analogiczny do testu T03 wyżej — NIE dowód
  // istnienia blokady per se (to wciąż wyłącznie test AC8 z `invocationCallOrder`
  // na `FOR UPDATE` powyżej; ten test przechodziłby identycznie, gdyby sekwencję
  // odczytów wymusić inaczej niż blokadą wiersza — udokumentowane ograniczenie tego
  // wzorca, patrz pamięć `test-author`, antywzorzec `mockResolvedValueOnce`).
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('AC8 — dwa równoległe wywołania TEGO SAMEGO bypassu (T07) na tym samym leadzie kończą się dokładnie jednym sukcesem i jednym wpisem', async () => {
    txLeadFindUniqueMock
      .mockResolvedValueOnce(leadFixture('HARDWARE_IN_WAREHOUSE'))
      .mockResolvedValueOnce(leadFixture('AWAITING_INSTALLATION'));

    const [first, second] = await Promise.all([
      advanceLeadStatus(LEAD_ID, 'AWAITING_INSTALLATION', VALID_INPUT),
      advanceLeadStatus(LEAD_ID, 'AWAITING_INSTALLATION', VALID_INPUT),
    ]);

    const successes = [first, second].filter((r) => r.success);
    expect(successes).toHaveLength(1);
    expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
  });
});

// ═══ AC12 (WO) — ta sama zmiana statusu dwiema drogami ═══

describe('advanceLeadStatus — AC12, ta sama zmiana statusu dwiema drogami', () => {
  // HARDWARE_IN_WAREHOUSE -> AWAITING_INSTALLATION (T07) jest już dowiedzione jako
  // manualne i audytowane w pętli `describe.each(classified)` powyżej. `bypassLogisticsOrder`
  // na TYM SAMYM celu jest dowiedzione w `sec-audit-log-manual-status-wave-b.test.ts`
  // (AC1). Ten test NIE duplikuje tamtego dowodu — potwierdza tylko, że `advanceLeadStatus`
  // z panelu leadów prowadzi do tego samego wpisu audytowego, czyli nie ma tu obejścia
  // dostępnego z sąsiedniej zakładki.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('HARDWARE_IN_WAREHOUSE → AWAITING_INSTALLATION przez advanceLeadStatus tworzy wpis audytowy (jak bypassLogisticsOrder)', async () => {
    txLeadFindUniqueMock.mockResolvedValue(leadFixture('HARDWARE_IN_WAREHOUSE'));

    const result = await advanceLeadStatus(LEAD_ID, 'AWAITING_INSTALLATION', VALID_INPUT);

    expect(result.success).toBe(true);
    expect(txAuditLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ operation: 'manual_status_change', resource: 'leads', recordId: LEAD_ID }),
    });
  });

  // AC12 — rollback dwiema drogami: `advanceLeadStatus → ROLLBACK_RESCHEDULING` (dowolne
  // z T10-T13, tu T10) NIE wykonuje efektów `releaseCrewSlot`/`suspendLogisticsSla` — to
  // ZNANY dług udokumentowany w kodzie (`logistics/actions.ts:267-272`, "lead osierocony
  // przez inną ścieżkę zmiany statusu"), POZA ZAKRESEM naprawy w tym WO ("Naprawa
  // advanceLeadStatus jako maszyny stanów... to wymaganie go dokumentuje i audytuje, ale
  // nie naprawia"). Ten test potwierdza, że wpis audytowy POWSTAJE MIMO braku tych
  // efektów — nie naprawia długu, tylko go utrwala testem.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('advanceLeadStatus → ROLLBACK_RESCHEDULING tworzy wpis audytowy, ale NIE woła releaseCrewSlot/suspendLogisticsSla (dług udokumentowany, poza zakresem naprawy)', async () => {
    txLeadFindUniqueMock.mockResolvedValue(leadFixture('AWAITING_CREW_ASSIGNMENT'));

    const result = await advanceLeadStatus(LEAD_ID, 'ROLLBACK_RESCHEDULING', VALID_INPUT);

    expect(result.success).toBe(true);
    expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
    expect(releaseCrewSlotMock).not.toHaveBeenCalled();
    expect(suspendLogisticsSlaMock).not.toHaveBeenCalled();
  });
});
