import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SLA, findTransition, canTransition, PERMISSIONS, can, AUDIT_REQUIREMENTS } from '@klikklima/contracts';
import type { DeleteJustificationInput } from '../src/lib/audit/delete-justification-schema';

/**
 * WO: docs/workorders/CRM-SAFE-RECORD-ACTIONS.md - CRM-ZIMNE-AC2, przejscie T15
 * (QUOTE_REJECTED -> AUDIT_COMPLETED, guard quoteRefreshedIfStale).
 *
 * D2 (rozstrzygniete, ODSTEPSTWO od pierwotnego rejestru): dialog z DWIEMA legalnymi
 * sciezkami wyjscia dla przeterminowanej wyceny - acknowledgeStaleQuote (potwierdz-ze-
 * stara-cena) LUB refreshQuote (zaktualizuj cene). Efekt refreshQuoteValidity
 * (restart okna waznosci, czyli nadpisanie quoted_at = now) zachodzi w OBU sciezkach -
 * to swiadomy projekt (WO: "inaczej lead natychmiast znow bylby przeterminowany"),
 * nie literowka. Guardy resolutions ('acknowledgeStaleQuote'/'refreshQuote') sa w
 * ZRODLOWYM kontrakcie contracts/funnel.contract.mjs (GUARDS[9].resolutions), ale NIE
 * sa eksportowane do packages/contracts/src/generated/funnel.ts (luka codegenu, ten
 * sam typ luki co DISQUALIFICATION_OUTCOMES udokumentowany w getRecommendation.test.ts
 * w b2c-web) - dlatego te dwie nazwy sa tu literalem z komentarzem, nie z importu.
 *
 * D3 (rozstrzygniete): 30 dni liczone od leady.quoted_at (SLA.COLD_LEAD_REPRICE.days),
 * NIE od bucket_entered_at. quoted_at IS NULL = traktowane jako przeterminowane
 * (fail-closed, decyzja dodatkowa z 2026-08-20).
 *
 * Zakladana docelowa sygnatura (WO, "Podzial pracy": "akcje returnToFunnel... oparte
 * na T15/T16 z @klikklima/contracts"):
 *   `returnToFunnel(leadId: string, resolution?: 'acknowledgeStaleQuote' | 'refreshQuote', newPrice?: number): Promise<{ success: boolean; error?: string }>`
 * w apps/b2b-web/src/app/(dashboard)/leads/actions.ts. Ta funkcja dzis NIE ISTNIEJE -
 * istnieje wylacznie stara sciezka `advanceLeadStatus(leadId, "NEW_LEAD")` uzywana
 * przez UI ("Reaktywuj"), ktora D7 nakazuje usunac z ALLOWED_TRANSITIONS.
 *
 * Model Prisma po polsku (leady) - dlug KK-NAMING-BASELINE zamrozony (ADR-002).
 *
 * TEST-DEFECT naprawiony w tej iteracji (WO CRM-SAFE-RECORD-ACTIONS, GREEN 3/3):
 * `returnToFunnel` dostal w REVIEW #2 sprawdzenie roli (`getCurrentActorRole()` +
 * `can(role,'leads','update')`), dokladnie ten sam wzorzec, co wczesniej naprawiony
 * `deleteAuditorAction` w auditors-delete.test.ts. Ten plik nie mockowal
 * `getCurrentActorRole`, wiec kazde wywolanie realnie odpalalo `cookies()` poza
 * kontekstem zadania Next.js i rzucalo blad - stad wszystkie testy byly czerwone.
 * Import w leads/actions.ts jest relatywny jako `../../../utils/supabase/server`
 * (zweryfikowane w kodzie, inna glebokosc katalogu niz w auditors/actions.ts).
 * PERMISSIONS.leads.update = ['admin', 'dyspozytor'] (contracts/rbac.contract.mjs).
 *
 * Zmechanizowane pod SEC-AUDIT-LOG-MANUAL-STATUS Fala A: `returnToFunnel` zyskal
 * czwarty, obowiazkowy parametr `input: DeleteJustificationInput` (`{ justification,
 * legalBasis }`), a modyfikacja `leady` przenosi sie w calosci do
 * `prisma.$transaction` (razem z nowym `tx.auditLog.create`, pokrytym osobno w
 * sec-audit-log-manual-status-wave-a.test.ts). Ten plik NADAL dowodzi wylacznie
 * logiki biznesowej `returnToFunnel` (prog SLA, resolution, strefa czasowa,
 * idempotencja, rola, transakcyjnosc update'u leada) - audytowi nie dopisuje tu
 * nowych asercji. Wzorzec mocka ($transaction-only, `createClient`/`getUser` przez
 * `getCurrentUser`) 1:1 z sec-audit-log-manual-status-wave-a.test.ts, zeby oba pliki
 * zgadzaly sie co do ksztaltu API.
 */

const {
  txLeadFindUniqueMock,
  txLeadUpdateMock,
  txAuditLogCreateMock,
  transactionMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
  getUserMock,
} = vi.hoisted(() => ({
  txLeadFindUniqueMock: vi.fn(),
  txLeadUpdateMock: vi.fn(),
  txAuditLogCreateMock: vi.fn(),
  transactionMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  getUserMock: vi.fn(),
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
getCurrentUserMock.mockImplementation(() => getUserMock());

const { returnToFunnel } = await import('../src/app/(dashboard)/leads/actions');

const COLD_LEAD_REPRICE_DAYS = SLA.COLD_LEAD_REPRICE.days; // 30, z kontraktu, nie literal

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const OPERATOR_EMAIL = 'dyspozytor@klikklima.pl';
const VALID_INPUT: DeleteJustificationInput = {
  justification: 'Uzgodnione telefonicznie z klientem, potwierdzona rezygnacja.',
  legalBasis: AUDIT_REQUIREMENTS.legalBases[0],
};

const coldLead = (overrides: Partial<{ quoted_at: Date | null; status: string }>) => ({
  id: 'lead-1',
  status: 'QUOTE_REJECTED',
  quoted_at: daysAgo(1),
  finalna_wycena_pln: 5000,
  ...overrides,
});

describe('returnToFunnel - "Zwroc do obiegu" (CRM-ZIMNE-AC2, T15)', () => {
  beforeEach(() => {
    txLeadFindUniqueMock.mockReset();
    txLeadUpdateMock.mockReset();
    txAuditLogCreateMock.mockReset();
    transactionMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getUserMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
    getUserMock.mockResolvedValue({ data: { user: { email: OPERATOR_EMAIL } } });
    txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });
    vi.useRealTimers();
    transactionMock.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({
        leady: { findUnique: txLeadFindUniqueMock, update: txLeadUpdateMock },
        auditLog: { create: txAuditLogCreateMock },
      }),
    );
  });
  afterEach(() => vi.useRealTimers());

  // @REQ: CRM-ZIMNE-AC2
  it('AC3.1 - wycena swiezsza niz prog wraca do obiegu bez dialogu (T15: QUOTE_REJECTED -> AUDIT_COMPLETED)', async () => {
    txLeadFindUniqueMock.mockResolvedValue(coldLead({ quoted_at: daysAgo(COLD_LEAD_REPRICE_DAYS - 1) }));

    const result = await returnToFunnel('lead-1', undefined, undefined, VALID_INPUT);

    expect(result.success).toBe(true);
    expect(txLeadUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'AUDIT_COMPLETED' }) }),
    );
    // Przejscie musi byc dokladnie tym z kontraktu, nie wlasna mapa lokalna (D7).
    expect(canTransition('QUOTE_REJECTED', 'returnToFunnel')).toBe(true);
    expect(findTransition('QUOTE_REJECTED', 'returnToFunnel')?.to).toBe('AUDIT_COMPLETED');
  });

  // @REQ: CRM-ZIMNE-AC2
  it('AC3.2 / AC3.3 - wycena przeterminowana bez zadnej decyzji jest odrzucona, status bez zmian', async () => {
    txLeadFindUniqueMock.mockResolvedValue(coldLead({ quoted_at: daysAgo(COLD_LEAD_REPRICE_DAYS + 1) }));

    const result = await returnToFunnel('lead-1', undefined, undefined, VALID_INPUT);

    expect(result.success).toBe(false);
    expect(txLeadUpdateMock).not.toHaveBeenCalled();
  });

  // @REQ: CRM-ZIMNE-AC2
  it('D2 sciezka A - acknowledgeStaleQuote: przeterminowana wycena przechodzi po potwierdzeniu', async () => {
    txLeadFindUniqueMock.mockResolvedValue(coldLead({ quoted_at: daysAgo(COLD_LEAD_REPRICE_DAYS + 1) }));

    const result = await returnToFunnel('lead-1', 'acknowledgeStaleQuote', undefined, VALID_INPUT);

    expect(result.success).toBe(true);
    expect(txLeadUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'AUDIT_COMPLETED', quoted_at: expect.any(Date) }),
      }),
    );
  });

  // @REQ: CRM-ZIMNE-AC2
  it('D2 sciezka B - refreshQuote: przeterminowana wycena przechodzi po aktualizacji ceny, cena zapisana', async () => {
    txLeadFindUniqueMock.mockResolvedValue(coldLead({ quoted_at: daysAgo(COLD_LEAD_REPRICE_DAYS + 1) }));

    const result = await returnToFunnel('lead-1', 'refreshQuote', 6500, VALID_INPUT);

    expect(result.success).toBe(true);
    expect(txLeadUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'AUDIT_COMPLETED',
          quoted_at: expect.any(Date),
          finalna_wycena_pln: 6500,
        }),
      }),
    );
  });

  // @REQ: CRM-ZIMNE-AC2
  it('AC3.4 - granica: dokladnie prog dni (30) przechodzi bez decyzji, prog+1 dnia wymaga decyzji', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-20T10:00:00.000Z'));

    txLeadFindUniqueMock.mockResolvedValueOnce(coldLead({ quoted_at: daysAgo(COLD_LEAD_REPRICE_DAYS) }));
    const atThreshold = await returnToFunnel('lead-1', undefined, undefined, VALID_INPUT);
    expect(atThreshold.success).toBe(true);

    txLeadUpdateMock.mockClear();
    txLeadFindUniqueMock.mockResolvedValueOnce(coldLead({ quoted_at: daysAgo(COLD_LEAD_REPRICE_DAYS + 1) }));
    const overThreshold = await returnToFunnel('lead-1', undefined, undefined, VALID_INPUT);
    expect(overThreshold.success).toBe(false);
  });

  // Przypadek NULL + fail-closed (decyzja dodatkowa 2026-08-20): quoted_at IS NULL
  // traktowane jak przeterminowane, wymaga jednej z dwoch sciezek D2.
  // @REQ: CRM-ZIMNE-AC2
  it('przypadek NULL - quoted_at nieustawione jest fail-closed: traktowane jak przeterminowane', async () => {
    txLeadFindUniqueMock.mockResolvedValue(coldLead({ quoted_at: null }));

    const withoutDecision = await returnToFunnel('lead-1', undefined, undefined, VALID_INPUT);
    expect(withoutDecision.success).toBe(false);

    txLeadFindUniqueMock.mockResolvedValue(coldLead({ quoted_at: null }));
    const withDecision = await returnToFunnel('lead-1', 'acknowledgeStaleQuote', undefined, VALID_INPUT);
    expect(withDecision.success).toBe(true);
  });

  // Przypadek brzegowy #3 (WO, idempotencja): drugie klikniecie na tym samym leadzie
  // (juz nie jest w QUOTE_REJECTED) jest odrzucone, nie tworzy drugiego przejscia.
  // @REQ: CRM-ZIMNE-AC2
  it('AC3.5 - idempotencja: druga proba po udanym powrocie (status juz AUDIT_COMPLETED) jest odrzucona', async () => {
    txLeadFindUniqueMock.mockResolvedValueOnce(coldLead({ quoted_at: daysAgo(1) }));
    const first = await returnToFunnel('lead-1', undefined, undefined, VALID_INPUT);
    expect(first.success).toBe(true);

    txLeadUpdateMock.mockClear();
    txLeadFindUniqueMock.mockResolvedValueOnce({ ...coldLead({}), status: 'AUDIT_COMPLETED' });
    const second = await returnToFunnel('lead-1', undefined, undefined, VALID_INPUT);

    expect(second.success).toBe(false);
    expect(txLeadUpdateMock).not.toHaveBeenCalled();
  });

  // Przypadek brzegowy #6 (WO, strefa czasowa): lead przekroczyl prog o godzine -
  // odrzucony niezaleznie od tego, czy serwer liczy w UTC czy Europe/Warsaw. Ustawiamy
  // systemowy czas testu na date w czasie letnim (CEST, UTC+2), zeby przesuniecie
  // strefy mialo szanse ujawnic blad o "jeden dzien"/"jedna godzine".
  // @REQ: CRM-ZIMNE-AC2
  it('przypadek brzegowy - strefa czasowa: prog przekroczony o godzine odrzucony w CEST i w UTC jednakowo', async () => {
    const nowInCest = new Date('2026-07-15T10:00:00.000Z'); // lato, Europe/Warsaw = UTC+2
    vi.useFakeTimers();
    vi.setSystemTime(nowInCest);

    const quotedAtJustOverThreshold = new Date(
      nowInCest.getTime() - (COLD_LEAD_REPRICE_DAYS * 24 * 60 * 60 * 1000 + 60 * 60 * 1000),
    );
    txLeadFindUniqueMock.mockResolvedValue(coldLead({ quoted_at: quotedAtJustOverThreshold }));

    const result = await returnToFunnel('lead-1', undefined, undefined, VALID_INPUT);

    expect(result.success).toBe(false);
  });

  // Przypadek brzegowy #8 (WO, transakcyjnosc): zmiana statusu i refreshQuoteValidity
  // dzieja sie w jednej transakcji.
  // @REQ: CRM-ZIMNE-AC2
  it('AC3.7 - zmiana statusu i odswiezenie waznosci wyceny dzieja sie w jednej transakcji', async () => {
    txLeadFindUniqueMock.mockResolvedValue(coldLead({ quoted_at: daysAgo(1) }));

    await returnToFunnel('lead-1', undefined, undefined, VALID_INPUT);

    expect(transactionMock).toHaveBeenCalledTimes(1);
  });

  // Przypadek brzegowy #4 (WO, uprawnienia, warstwa Server Action): Prisma omija RLS,
  // wiec sprawdzenie roli musi zyc jawnie w returnToFunnel, tak samo jak w
  // deleteAuditorAction (auditors-delete.test.ts AC1.4).
  // @REQ: CRM-ZIMNE-AC2
  it('uprawnienia - rola spoza PERMISSIONS.leads.update jest odrzucona po stronie serwera', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    txLeadFindUniqueMock.mockResolvedValue(coldLead({ quoted_at: daysAgo(1) }));

    const result = await returnToFunnel('lead-1', undefined, undefined, VALID_INPUT);

    expect(result.success).toBe(false);
    expect(txLeadUpdateMock).not.toHaveBeenCalled();
    expect(can('audytor', 'leads', 'update')).toBe('no');
    expect(PERMISSIONS.leads.update).not.toContain('audytor');
  });

  // Fail-closed: brak roli (getCurrentActorRole() zwraca null - brak wpisu w
  // AuthorizedUser albo brak sesji) musi byc odrzucony, nie przepuszczony.
  // @REQ: CRM-ZIMNE-AC2
  it('uprawnienia - brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);
    txLeadFindUniqueMock.mockResolvedValue(coldLead({ quoted_at: daysAgo(1) }));

    const result = await returnToFunnel('lead-1', undefined, undefined, VALID_INPUT);

    expect(result.success).toBe(false);
    expect(txLeadUpdateMock).not.toHaveBeenCalled();
  });

  // Kontrola pozytywna: obie role z PERMISSIONS.leads.update przechodza sprawdzenie.
  // @REQ: CRM-ZIMNE-AC2
  it('kontrola pozytywna - role admin i dyspozytor przechodza sprawdzenie roli w returnToFunnel', async () => {
    expect(PERMISSIONS.leads.update).toEqual(['admin', 'dyspozytor']);

    getCurrentActorRoleMock.mockResolvedValue('admin');
    txLeadFindUniqueMock.mockResolvedValue(coldLead({ quoted_at: daysAgo(1) }));
    const asAdmin = await returnToFunnel('lead-1', undefined, undefined, VALID_INPUT);
    expect(asAdmin.success).toBe(true);

    txLeadUpdateMock.mockClear();
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
    txLeadFindUniqueMock.mockResolvedValue(coldLead({ quoted_at: daysAgo(1) }));
    const asDyspozytor = await returnToFunnel('lead-1', undefined, undefined, VALID_INPUT);
    expect(asDyspozytor.success).toBe(true);
  });
});
