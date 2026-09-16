import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * WO: docs/workorders/FNL-2PHASE-BOOKING-MECHANICS.md — Przypadek brzegowy 4
 * ("Obejście przez advanceLeadStatus — pułapka realna, nie teoretyczna"), zawężona
 * lista przypadków testowych, obszar 7. Wymaganie: `FNL-2PHASE-BOOKING`.
 *
 * WO twierdzi dosłownie: "findTransitionByFromTo('AWAITING_INSTALLATION',
 * 'AWAITING_INSTALLATION') dopasuje T17, bo to jedyna pętla własna z tego stanu, a
 * advanceLeadStatus nie sprawdza guardów. Test musi pokazać, że wywołanie
 * advanceLeadStatus(leadId, 'AWAITING_INSTALLATION') NIE zamyka etapu I, NIE tworzy
 * rezerwacji etapu II i NIE wysyła N8a."
 *
 * ═══ STAN ZWERYFIKOWANY 2026-09-16 (test-author, przed napisaniem testu) ═══
 * `ALLOWED_TRANSITIONS.AWAITING_INSTALLATION` w
 * `apps/b2b-web/src/app/(dashboard)/leads/actions.ts` (linia ok. 617) to
 * `["INSTALLATION_COMPLETED"]` — NIE zawiera samo-przejścia
 * `AWAITING_INSTALLATION -> AWAITING_INSTALLATION`. `advanceLeadStatus` sprawdza TĘ
 * lokalną mapę (linia ok. 702-708, `if (!allowed.includes(targetStatus)) throw`)
 * PRZED wywołaniem `findTransitionByFromTo` (linia ok. 716) — więc DZIŚ wywołanie
 * `advanceLeadStatus(leadId, 'AWAITING_INSTALLATION')` z leada już będącego w
 * `AWAITING_INSTALLATION` jest odrzucane na TEJ WCZEŚNIEJSZEJ bramce, zanim
 * `findTransitionByFromTo` w ogóle dopasuje T17. Literalny opis WO ("dopasuje T17...
 * nie sprawdza guardów") opisuje więc scenariusz, który wymagałby NAJPIERW dodania
 * samo-przejścia do lokalnej mapy — to NIE jest dzisiejszy stan.
 *
 * Ten test jest mimo to WYMAGANY przez WO (obszar 7 zawężonej listy) jako TEST
 * OBRONNY/REGRESYJNY: dowodzi, że DZISIEJSZA architektura advanceLeadStatus
 * (odmowa przez ALLOWED_TRANSITIONS, zanim guardy T17 miałyby szansę zostać
 * pominięte) faktycznie blokuje tę drugą, cichą ścieżkę — i będzie nadal blokować,
 * chyba że ktoś w przyszłości "uogólni" ALLOWED_TRANSITIONS dopisując tam
 * samo-przejście AWAITING_INSTALLATION (co WŁAŚNIE otworzyłoby dziurę opisaną w WO).
 * Test jest więc GREEN już teraz z dobrego powodu (obrona istnieje), nie z braku
 * asercji — raportowane jawnie w podsumowaniu tej tury, nie ukryte.
 *
 * Wzorzec mockowania identyczny z `sec-audit-log-manual-status-wave-c.test.ts`
 * (ten sam `advanceLeadStatus`, ta sama granica modułów).
 */

const {
  transactionMock,
  txLeadFindUniqueMock,
  txLeadUpdateMock,
  txAuditLogCreateMock,
  txQueryRawMock,
  txNotificationQueueCreateMock,
  txInstallationPhaseUpdateMock,
  txBookingUpdateMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
  getUserMock,
  releaseCrewSlotMock,
  suspendLogisticsSlaMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  txLeadFindUniqueMock: vi.fn(),
  txLeadUpdateMock: vi.fn(),
  txAuditLogCreateMock: vi.fn(),
  txQueryRawMock: vi.fn(),
  txNotificationQueueCreateMock: vi.fn(),
  txInstallationPhaseUpdateMock: vi.fn(),
  txBookingUpdateMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  getUserMock: vi.fn(),
  releaseCrewSlotMock: vi.fn(),
  suspendLogisticsSlaMock: vi.fn(),
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
    leady: { findUnique: vi.fn(), update: vi.fn() },
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

type AdvanceFn = (leadId: string, targetStatus: string) => Promise<{ success: boolean; error?: string }>;
const advanceLeadStatus = rawActions.advanceLeadStatus as unknown as AdvanceFn;

const tx = {
  leady: { findUnique: txLeadFindUniqueMock, update: txLeadUpdateMock },
  auditLog: { create: txAuditLogCreateMock },
  $queryRaw: txQueryRawMock,
  notificationQueue: { create: txNotificationQueueCreateMock },
  installationPhase: { update: txInstallationPhaseUpdateMock },
  booking: { update: txBookingUpdateMock },
};

const LEAD_ID = 'lead-1';
const OPERATOR_EMAIL = 'dyspozytor@klikklima.pl';

beforeEach(() => {
  transactionMock.mockReset();
  txLeadFindUniqueMock.mockReset();
  txLeadUpdateMock.mockReset();
  txAuditLogCreateMock.mockReset();
  txQueryRawMock.mockReset();
  txNotificationQueueCreateMock.mockReset();
  txInstallationPhaseUpdateMock.mockReset();
  txBookingUpdateMock.mockReset();
  revalidatePathMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  getUserMock.mockReset();
  releaseCrewSlotMock.mockReset();
  suspendLogisticsSlaMock.mockReset();

  transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(tx));
  getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
  getUserMock.mockResolvedValue({ data: { user: { email: OPERATOR_EMAIL } } });
  txLeadFindUniqueMock.mockResolvedValue({ id: LEAD_ID, status: 'AWAITING_INSTALLATION' });
  txLeadUpdateMock.mockResolvedValue({});
  txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });
  txQueryRawMock.mockResolvedValue([]);
});

describe('advanceLeadStatus — brzeg 4 WO FNL-2PHASE-BOOKING-MECHANICS (obrona przed drugą ścieżką T17)', () => {
  // @REQ: FNL-2PHASE-BOOKING
  it('advanceLeadStatus(leadId, "AWAITING_INSTALLATION") od leada JUŻ w AWAITING_INSTALLATION jest odrzucone — nie zamyka etapu, nie tworzy rezerwacji, nie wysyła powiadomienia', async () => {
    const result = await advanceLeadStatus(LEAD_ID, 'AWAITING_INSTALLATION');

    expect(result.success).toBe(false);
    expect(txLeadUpdateMock).not.toHaveBeenCalled();
    expect(txInstallationPhaseUpdateMock).not.toHaveBeenCalled();
    expect(txBookingUpdateMock).not.toHaveBeenCalled();
    expect(txNotificationQueueCreateMock).not.toHaveBeenCalled();
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });

  // Kontrola: droga NORMALNA do AWAITING_INSTALLATION (z HARDWARE_IN_TRANSIT, T08)
  // pozostaje legalna — ten test nie dowodzi, że advanceLeadStatus jest ogólnie
  // zablokowane dla tego stanu docelowego, tylko że SAMO-PRZEJŚCIE jest odrzucone.
  // @REQ: FNL-2PHASE-BOOKING
  it('kontrola — droga NORMALNA (HARDWARE_IN_TRANSIT -> AWAITING_INSTALLATION, T08) pozostaje dozwolona', async () => {
    txLeadFindUniqueMock.mockResolvedValue({ id: LEAD_ID, status: 'HARDWARE_IN_TRANSIT' });

    const result = await advanceLeadStatus(LEAD_ID, 'AWAITING_INSTALLATION');

    expect(result.success).toBe(true);
    expect(txLeadUpdateMock).toHaveBeenCalledTimes(1);
  });
});
