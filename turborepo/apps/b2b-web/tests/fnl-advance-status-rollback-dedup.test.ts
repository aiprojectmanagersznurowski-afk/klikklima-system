import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { TRANSITIONS, AUDIT_REQUIREMENTS } from '@klikklima/contracts';

/**
 * WO: docs/workorders/FNL-ADVANCE-STATUS-CONTRACT-BOUND.md — Faza 1
 * (T10-T13, dedup rollback). Wymaganie: FNL-ADVANCE-STATUS-CONTRACT-BOUND.
 * Decyzja człowieka: WARIANT B — `advanceLeadStatus` przestaje obsługiwać
 * przejścia do ROLLBACK_RESCHEDULING (T10-T13 usunięte z lokalnej mapy
 * ALLOWED_TRANSITIONS), a przycisk "Rollback (Problem)" w `leads-client.tsx`
 * woła `rollbackLogisticsOrder` (logistics/actions.ts) zamiast
 * `advanceLeadStatus(leadId, 'ROLLBACK_RESCHEDULING')`.
 *
 * Stan DZISIEJSZY (RED oczekiwany): T10-T13 wciąż są dozwolone przez
 * `advanceLeadStatus` (ALLOWED_TRANSITIONS niezmienione), a przycisk w Kanban
 * wciąż woła `advanceLeadStatus`, nie `rollbackLogisticsOrder`.
 *
 * Wzorzec mockowania serwera: identyczny z
 * `sec-audit-log-manual-status-wave-c.test.ts` (Fala C tej sesji) — jedyne
 * źródło prawdy dla przejścia to `tx.leady.findUnique`/`tx.leady.update`
 * wewnątrz `prisma.$transaction`.
 *
 * Wzorzec testu UI: statyczny, na treści źródła `leads-client.tsx` —
 * ten sam wzorzec dowodowy co `crews-client-admin-visibility.test.ts`
 * (alias `@/*` nie jest skonfigurowany w root `vitest.config.mts`, pełny
 * render komponentu importującego `@/components/ui/*` nie jest dziś
 * wykonalny w tym pakiecie testów).
 */

// ═══════════════════════════ Warstwa serwerowa (K2 hard-deny) ═══════════════════════════

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
  input?: unknown,
) => Promise<{ success: boolean; error?: string }>;
const advanceLeadStatus = rawActions.advanceLeadStatus as unknown as AdvanceFn;

const tx = {
  leady: { findUnique: txLeadFindUniqueMock, update: txLeadUpdateMock },
  auditLog: { create: txAuditLogCreateMock },
  $queryRaw: txQueryRawMock,
};

const OPERATOR_EMAIL = 'dyspozytor@klikklima.pl';
const LEAD_ID = 'lead-1';
const VALID_JUSTIFICATION = 'Rollback zgłoszony telefonicznie przez klienta na miejscu.';
const VALID_BASIS = AUDIT_REQUIREMENTS.legalBases[0];

const leadFixture = (status: string, overrides: Record<string, unknown> = {}) => ({
  id: LEAD_ID,
  status,
  audytor_id: 'audytor-1',
  ...overrides,
});

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
  txLeadUpdateMock.mockResolvedValue({});
  txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });
  txQueryRawMock.mockResolvedValue([]);
});

// T10-T13: wszystkie stany źródłowe, które dziś mapują na ROLLBACK_RESCHEDULING
// w lokalnej ALLOWED_TRANSITIONS (`leads/actions.ts` L614-617).
const ROLLBACK_SOURCE_STATUSES = [
  'AWAITING_CREW_ASSIGNMENT', // T10
  'HARDWARE_IN_WAREHOUSE', // T11
  'HARDWARE_IN_TRANSIT', // T12
  'AWAITING_INSTALLATION', // T13
];

describe('advanceLeadStatus — kontrola pozytywna: T10-T13 nadal istnieją w kontrakcie jako przejście "rollback"', () => {
  // Dowód, że te pary (from, to) SĄ legalne w kontrakcie (mają odbywać się przez
  // rollbackLogisticsOrder, nie że kontrakt je usuwa) — inaczej test odmowy niżej
  // testowałby nieistniejącą parę zamiast celowo usuniętego skrótu.
  it.each(ROLLBACK_SOURCE_STATUSES)('(%s -> ROLLBACK_RESCHEDULING) istnieje w TRANSITIONS kontraktu', (from) => {
    const transition = TRANSITIONS.find((t) => t.from === from && t.to === 'ROLLBACK_RESCHEDULING');
    expect(transition).toBeDefined();
  });
});

describe('advanceLeadStatus — T10-T13 ODRZUCONE po usunięciu z lokalnej ALLOWED_TRANSITIONS (Wariant B, FNL-ADVANCE-STATUS-CONTRACT-BOUND)', () => {
  // @REQ: FNL-ADVANCE-STATUS-CONTRACT-BOUND
  it.each(ROLLBACK_SOURCE_STATUSES)(
    'z %s do ROLLBACK_RESCHEDULING jest odrzucone — zero update statusu, zero wpisu audytowego',
    async (from) => {
      txLeadFindUniqueMock.mockResolvedValue(leadFixture(from));

      const result = await advanceLeadStatus(LEAD_ID, 'ROLLBACK_RESCHEDULING', {
        justification: VALID_JUSTIFICATION,
        legalBasis: VALID_BASIS,
      });

      expect(result.success).toBe(false);
      expect(txLeadUpdateMock).not.toHaveBeenCalled();
      expect(prismaLeadUpdateMock).not.toHaveBeenCalled();
      expect(txAuditLogCreateMock).not.toHaveBeenCalled();
    },
  );

  // Nawet z poprawnym uzasadnieniem manualnym — odrzucenie musi być bezwarunkowe,
  // nie zależne od walidacji input (wzorem K2 AWAITING_AUDIT -> NEW_LEAD w Fali C).
  // @REQ: FNL-ADVANCE-STATUS-CONTRACT-BOUND
  it('odrzucone bez podanego input (rollback bez uzasadnienia) — identyczny wynik jak z uzasadnieniem', async () => {
    txLeadFindUniqueMock.mockResolvedValue(leadFixture('AWAITING_CREW_ASSIGNMENT'));

    const result = await advanceLeadStatus(LEAD_ID, 'ROLLBACK_RESCHEDULING');

    expect(result.success).toBe(false);
    expect(txLeadUpdateMock).not.toHaveBeenCalled();
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });

  // AC2 z WO: po naprawie nie istnieje kombinacja wywołań prowadząca do podwójnego
  // efektu — tu dowodzimy połowy AC2: advanceLeadStatus nigdy nie woła efektów
  // rollbacku, więc nie może przyczynić się do duplikatu niezależnie od tego, ile
  // razy zostanie wywołane.
  // @REQ: FNL-ADVANCE-STATUS-CONTRACT-BOUND
  it('releaseCrewSlot/suspendLogisticsSla nigdy nie są wołane przez advanceLeadStatus dla żadnego z T10-T13', async () => {
    for (const from of ROLLBACK_SOURCE_STATUSES) {
      txLeadFindUniqueMock.mockResolvedValue(leadFixture(from));
      await advanceLeadStatus(LEAD_ID, 'ROLLBACK_RESCHEDULING', {
        justification: VALID_JUSTIFICATION,
        legalBasis: VALID_BASIS,
      });
    }

    expect(releaseCrewSlotMock).not.toHaveBeenCalled();
    expect(suspendLogisticsSlaMock).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════ Warstwa UI (statyczna, wzorem crews-client-admin-visibility.test.ts) ═══════════════════════════

const LEADS_DIR = path.resolve(__dirname, '../src/app/(dashboard)/leads');

function readLeadsClient(): string {
  return readFileSync(path.join(LEADS_DIR, 'leads-client.tsx'), 'utf-8');
}

describe('LeadsClient — przycisk "Rollback (Problem)" woła rollbackLogisticsOrder, nie advanceLeadStatus (FNL-ADVANCE-STATUS-CONTRACT-BOUND, Wariant B)', () => {
  // @REQ: FNL-ADVANCE-STATUS-CONTRACT-BOUND
  it('leads-client.tsx importuje rollbackLogisticsOrder z logistics/actions', () => {
    const content = readLeadsClient();

    expect(content).toMatch(
      /import\s*\{[^}]*rollbackLogisticsOrder[^}]*\}\s*from\s*["']\.\.\/logistics\/actions["']/,
    );
  });

  // @REQ: FNL-ADVANCE-STATUS-CONTRACT-BOUND
  it('kliknięcie akcji z target ROLLBACK_RESCHEDULING woła rollbackLogisticsOrder(leadId, ...), nie advanceLeadStatus', () => {
    const content = readLeadsClient();

    // Dowód negatywny: skoro dziś istnieje wyłącznie jedna generyczna ścieżka
    // wywołania (`handleAdvanceStatus` -> `advanceLeadStatus(leadId, targetStatus)`
    // dla KAŻDEGO `action.target`, w tym ROLLBACK_RESCHEDULING), kod musi zyskać
    // rozróżnienie po `action.target === "ROLLBACK_RESCHEDULING"` (albo równoważne)
    // które kieruje do `rollbackLogisticsOrder` zamiast do generycznej ścieżki.
    expect(content).toMatch(/rollbackLogisticsOrder\s*\(\s*leadId/);
  });

  // Kontrola pozytywna statyczna: dowód, że test wyżej nie jest fałszywie zielony
  // z powodu literówki we wzorcu — string `advanceLeadStatus` MUSI wciąż istnieć
  // w pliku (przejścia inne niż rollback nadal go używają), więc sama obecność
  // `advanceLeadStatus` w pliku nie dowodzi niczego bez powyższego dowodu na
  // obecność `rollbackLogisticsOrder` w kontekście rollbacku.
  it('advanceLeadStatus nadal istnieje w pliku (przejścia inne niż rollback go używają) — kontrola negatywna narzędzia testowego', () => {
    const content = readLeadsClient();
    expect(content).toMatch(/advanceLeadStatus/);
  });
});
