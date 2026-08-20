import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LOST_REASONS, LOST_REASONS_REQUIRING_NOTE, isValidLostReason, lostReasonRequiresNote, canTransition, PERMISSIONS, can } from '@klikklima/contracts';

/**
 * WO: docs/workorders/CRM-SAFE-RECORD-ACTIONS.md - CRM-ZIMNE-AC3, przejscie T16
 * (QUOTE_REJECTED -> ARCHIVED_LOST, guard lostReasonProvided, terminal).
 *
 * D4 (rozstrzygniete): leady.lost_reason WYLACZNIE ze slownika LOST_REASONS.
 * Znacznik automatu 14-dniowego zyje osobno w leady.auto_rejected_reason - te dwa
 * pola NIGDY nie mieszaja semantyki.
 * D5 (rozstrzygniete): LOST_REASONS zatwierdzone bez zmian (6 wartosci). OTHER
 * wymaga obowiazkowej notatki w leady.lost_reason_note (contracts/generated/funnel.ts:
 * lostReasonRequiresNote / LOST_REASONS_REQUIRING_NOTE - importowane, nie hardkodowane).
 *
 * Zakladana docelowa sygnatura (WO, "Podzial pracy": "archiveLost... oparte na T15/T16"):
 *   `archiveLost(leadId: string, reason: string, note?: string): Promise<{ success: boolean; error?: string }>`
 * w apps/b2b-web/src/app/(dashboard)/leads/actions.ts. Funkcja dzis NIE ISTNIEJE.
 *
 * Model Prisma po polsku (leady) - dlug KK-NAMING-BASELINE zamrozony (ADR-002).
 *
 * TEST-DEFECT naprawiony w tej iteracji (WO CRM-SAFE-RECORD-ACTIONS, GREEN 3/3):
 * `archiveLost` dostal w REVIEW #2 sprawdzenie roli (`getCurrentActorRole()` +
 * `can(role,'leads','update')`), dokladnie ten sam wzorzec, co wczesniej naprawiony
 * `deleteAuditorAction` w auditors-delete.test.ts. Ten plik nie mockowal
 * `getCurrentActorRole`, wiec kazde wywolanie realnie odpalalo `cookies()` poza
 * kontekstem zadania Next.js i rzucalo blad - stad wszystkie testy byly czerwone.
 * PERMISSIONS.leads.update = ['admin', 'dyspozytor'] (contracts/rbac.contract.mjs).
 */

const {
  leadFindUniqueMock,
  leadUpdateMock,
  transactionMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
} = vi.hoisted(() => ({
  leadFindUniqueMock: vi.fn(),
  leadUpdateMock: vi.fn(),
  transactionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    leady: { findUnique: leadFindUniqueMock, update: leadUpdateMock },
    $transaction: transactionMock,
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
}));

const { archiveLost } = await import('../src/app/(dashboard)/leads/actions');

// LOST_REASONS w wygenerowanym kontrakcie to plaska lista identyfikatorow (nie obiektow
// z polem requiresNote - to jest w zrodlowym contracts/funnel.contract.mjs, nie w
// generated/funnel.ts). Wymagajaca notatki wartosc pochodzi z osobnego eksportu
// LOST_REASONS_REQUIRING_NOTE (D5) - importowana, nie hardkodowana jako 'OTHER'.
const OTHER_REASON = LOST_REASONS_REQUIRING_NOTE[0];
const VALID_REASON = LOST_REASONS.find((r) => !(LOST_REASONS_REQUIRING_NOTE as readonly string[]).includes(r))!;

const coldLead = () => ({
  id: 'lead-1',
  status: 'QUOTE_REJECTED',
  lost_reason: null,
  auto_rejected_reason: null,
});

describe('archiveLost - "Archiwizuj trwale (Lost)" (CRM-ZIMNE-AC3, T16)', () => {
  beforeEach(() => {
    leadFindUniqueMock.mockReset();
    leadUpdateMock.mockReset();
    transactionMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
    transactionMock.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({ leady: { findUnique: leadFindUniqueMock, update: leadUpdateMock } }),
    );
  });

  // @REQ: CRM-ZIMNE-AC3
  it('AC4.1 - archiwizacja bez wybranego powodu jest odrzucona, status bez zmian', async () => {
    leadFindUniqueMock.mockResolvedValue(coldLead());

    const result = await archiveLost('lead-1', '');

    expect(result.success).toBe(false);
    expect(leadUpdateMock).not.toHaveBeenCalled();
  });

  // @REQ: CRM-ZIMNE-AC3
  it('AC4.2 - powod spoza slownika (literowka / wartosc z pominieciem UI) jest odrzucony', async () => {
    leadFindUniqueMock.mockResolvedValue(coldLead());
    const bogusReason = 'NIE_MA_TAKIEGO_POWODU';
    expect(isValidLostReason(bogusReason)).toBe(false);

    const result = await archiveLost('lead-1', bogusReason);

    expect(result.success).toBe(false);
    expect(leadUpdateMock).not.toHaveBeenCalled();
  });

  // @REQ: CRM-ZIMNE-AC3
  it('AC4.3 - poprawny powod ustawia ARCHIVED_LOST i zapisuje powod nadajacy sie do agregacji', async () => {
    leadFindUniqueMock.mockResolvedValue(coldLead());

    const result = await archiveLost('lead-1', VALID_REASON);

    expect(result.success).toBe(true);
    expect(leadUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ARCHIVED_LOST', lost_reason: VALID_REASON }) }),
    );
  });

  // D5 - OTHER bez notatki jest odrzucony.
  // @REQ: CRM-ZIMNE-AC3
  it('D5 - powod OTHER bez notatki jest odrzucony', async () => {
    leadFindUniqueMock.mockResolvedValue(coldLead());
    expect(lostReasonRequiresNote(OTHER_REASON)).toBe(true);

    const result = await archiveLost('lead-1', OTHER_REASON);

    expect(result.success).toBe(false);
    expect(leadUpdateMock).not.toHaveBeenCalled();
  });

  // D5 - OTHER z notatka przechodzi i notatka jest zapisana.
  // @REQ: CRM-ZIMNE-AC3
  it('D5 - powod OTHER z niepusta notatka przechodzi i zapisuje lost_reason_note', async () => {
    leadFindUniqueMock.mockResolvedValue(coldLead());

    const result = await archiveLost('lead-1', OTHER_REASON, 'Klient zrezygnowal z powodu przeprowadzki.');

    expect(result.success).toBe(true);
    expect(leadUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'ARCHIVED_LOST',
          lost_reason: OTHER_REASON,
          lost_reason_note: 'Klient zrezygnowal z powodu przeprowadzki.',
        }),
      }),
    );
  });

  // @REQ: CRM-ZIMNE-AC3
  it('AC4.4 - ARCHIVED_LOST jest terminalny: zadne przejscie z tego stanu nie istnieje w kontrakcie', () => {
    // To jest test kontraktowy (transitionMatrix), swiadomie w tym samym pliku co
    // Server Action, ktora go egzekwuje - dowodzi, ze implementacja NIE MOZE
    // legalnie wyprowadzic leada z ARCHIVED_LOST zadna akcja z LEAD_ACTIONS.
    const actions = ['assignAuditor', 'sendQuote', 'acceptQuoteAndBook', 'expireQuote', 'assignCrew',
      'shipByCourier', 'deliverWithCrew', 'markDelivered', 'completeInstallation', 'rollback',
      'rebookInstallation', 'completePhaseOne', 'returnToFunnel', 'archiveLost'] as const;

    for (const action of actions) {
      expect(canTransition('ARCHIVED_LOST', action)).toBe(false);
    }
  });

  // @REQ: CRM-ZIMNE-AC3
  it('AC4.4 (Server Action) - archiveLost wywolane na juz zarchiwizowanym leadzie jest odrzucone', async () => {
    leadFindUniqueMock.mockResolvedValue({ ...coldLead(), status: 'ARCHIVED_LOST', lost_reason: VALID_REASON });

    const result = await archiveLost('lead-1', VALID_REASON);

    expect(result.success).toBe(false);
    expect(leadUpdateMock).not.toHaveBeenCalled();
  });

  // AC4.7 + przypadek brzegowy #8 (transakcyjnosc): status i powod zapisywane
  // atomowo - nie istnieje ARCHIVED_LOST bez powodu.
  // @REQ: CRM-ZIMNE-AC3
  it('AC4.7 - status i powod zapisywane w jednej transakcji, jednym wywolaniem update', async () => {
    leadFindUniqueMock.mockResolvedValue(coldLead());

    await archiveLost('lead-1', VALID_REASON);

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(leadUpdateMock).toHaveBeenCalledTimes(1);
  });

  // D4 - separacja semantyki: archiveLost nigdy nie modyfikuje auto_rejected_reason,
  // nawet dla leadow, ktore trafily do bucketu automatycznie (14 dni).
  // @REQ: CRM-ZIMNE-AC3
  it('AC4.8 / D4 - archiwizacja leada odrzuconego automatycznie nie dotyka auto_rejected_reason', async () => {
    leadFindUniqueMock.mockResolvedValue({ ...coldLead(), auto_rejected_reason: 'AUTO_REJECT_14_DAYS' });

    const result = await archiveLost('lead-1', VALID_REASON);

    expect(result.success).toBe(true);
    const updateCall = leadUpdateMock.mock.calls[0]?.[0];
    expect(updateCall?.data).not.toHaveProperty('auto_rejected_reason');
    // lost_reason zapisany ze slownika NIE JEST rowny technicznemu znacznikowi automatu -
    // dwie semantyki nigdy nie moga wyladowac w tym samym polu.
    expect(updateCall?.data?.lost_reason).not.toBe('AUTO_REJECT_14_DAYS');
  });

  // Przypadek pusty (WO, "Zawsze dopisujesz"): reason undefined (nie tylko pusty string) -
  // symuluje zadanie HTTP z pominieciem walidacji klienckiej, gdzie pole po prostu
  // nie zostalo przeslane. Rzutowanie przez unknown (nie rzutowanie typu „as" + " any",
  // zakazane w projekcie), bo sygnatura funkcji wymaga stringa, a to jest dokladnie ta
  // furtka, ktorej broni AC4.1.
  // @REQ: CRM-ZIMNE-AC3
  it('przypadek pusty - reason undefined jest odrzucony tak samo jak pusty string', async () => {
    leadFindUniqueMock.mockResolvedValue(coldLead());

    const missingReason = undefined as unknown as string;
    const result = await archiveLost('lead-1', missingReason);

    expect(result.success).toBe(false);
  });

  // Przypadek brzegowy #4 (WO, uprawnienia, warstwa Server Action): Prisma omija RLS,
  // wiec sprawdzenie roli musi zyc jawnie w archiveLost, tak samo jak w
  // deleteAuditorAction (auditors-delete.test.ts AC1.4).
  // @REQ: CRM-ZIMNE-AC3
  it('uprawnienia - rola spoza PERMISSIONS.leads.update jest odrzucona po stronie serwera', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    leadFindUniqueMock.mockResolvedValue(coldLead());

    const result = await archiveLost('lead-1', VALID_REASON);

    expect(result.success).toBe(false);
    expect(leadUpdateMock).not.toHaveBeenCalled();
    expect(can('audytor', 'leads', 'update')).toBe('no');
    expect(PERMISSIONS.leads.update).not.toContain('audytor');
  });

  // Fail-closed: brak roli (getCurrentActorRole() zwraca null - brak wpisu w
  // AuthorizedUser albo brak sesji) musi byc odrzucony, nie przepuszczony.
  // @REQ: CRM-ZIMNE-AC3
  it('uprawnienia - brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);
    leadFindUniqueMock.mockResolvedValue(coldLead());

    const result = await archiveLost('lead-1', VALID_REASON);

    expect(result.success).toBe(false);
    expect(leadUpdateMock).not.toHaveBeenCalled();
  });

  // Kontrola pozytywna: obie role z PERMISSIONS.leads.update przechodza sprawdzenie.
  // @REQ: CRM-ZIMNE-AC3
  it('kontrola pozytywna - role admin i dyspozytor przechodza sprawdzenie roli w archiveLost', async () => {
    expect(PERMISSIONS.leads.update).toEqual(['admin', 'dyspozytor']);

    getCurrentActorRoleMock.mockResolvedValue('admin');
    leadFindUniqueMock.mockResolvedValue(coldLead());
    const asAdmin = await archiveLost('lead-1', VALID_REASON);
    expect(asAdmin.success).toBe(true);

    leadUpdateMock.mockClear();
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
    leadFindUniqueMock.mockResolvedValue(coldLead());
    const asDyspozytor = await archiveLost('lead-1', VALID_REASON);
    expect(asDyspozytor.success).toBe(true);
  });
});
