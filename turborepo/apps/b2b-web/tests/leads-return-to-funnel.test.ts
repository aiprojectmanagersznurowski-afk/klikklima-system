import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SLA, findTransition, canTransition, PERMISSIONS, can } from '@klikklima/contracts';

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

const { returnToFunnel } = await import('../src/app/(dashboard)/leads/actions');

const COLD_LEAD_REPRICE_DAYS = SLA.COLD_LEAD_REPRICE.days; // 30, z kontraktu, nie literal

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

const coldLead = (overrides: Partial<{ quoted_at: Date | null; status: string }>) => ({
  id: 'lead-1',
  status: 'QUOTE_REJECTED',
  quoted_at: daysAgo(1),
  finalna_wycena_pln: 5000,
  ...overrides,
});

describe('returnToFunnel - "Zwroc do obiegu" (CRM-ZIMNE-AC2, T15)', () => {
  beforeEach(() => {
    leadFindUniqueMock.mockReset();
    leadUpdateMock.mockReset();
    transactionMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
    vi.useRealTimers();
    transactionMock.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({ leady: { findUnique: leadFindUniqueMock, update: leadUpdateMock } }),
    );
  });
  afterEach(() => vi.useRealTimers());

  // @REQ: CRM-ZIMNE-AC2
  it('AC3.1 - wycena swiezsza niz prog wraca do obiegu bez dialogu (T15: QUOTE_REJECTED -> AUDIT_COMPLETED)', async () => {
    leadFindUniqueMock.mockResolvedValue(coldLead({ quoted_at: daysAgo(COLD_LEAD_REPRICE_DAYS - 1) }));

    const result = await returnToFunnel('lead-1');

    expect(result.success).toBe(true);
    expect(leadUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'AUDIT_COMPLETED' }) }),
    );
    // Przejscie musi byc dokladnie tym z kontraktu, nie wlasna mapa lokalna (D7).
    expect(canTransition('QUOTE_REJECTED', 'returnToFunnel')).toBe(true);
    expect(findTransition('QUOTE_REJECTED', 'returnToFunnel')?.to).toBe('AUDIT_COMPLETED');
  });

  // @REQ: CRM-ZIMNE-AC2
  it('AC3.2 / AC3.3 - wycena przeterminowana bez zadnej decyzji jest odrzucona, status bez zmian', async () => {
    leadFindUniqueMock.mockResolvedValue(coldLead({ quoted_at: daysAgo(COLD_LEAD_REPRICE_DAYS + 1) }));

    const result = await returnToFunnel('lead-1');

    expect(result.success).toBe(false);
    expect(leadUpdateMock).not.toHaveBeenCalled();
  });

  // @REQ: CRM-ZIMNE-AC2
  it('D2 sciezka A - acknowledgeStaleQuote: przeterminowana wycena przechodzi po potwierdzeniu', async () => {
    leadFindUniqueMock.mockResolvedValue(coldLead({ quoted_at: daysAgo(COLD_LEAD_REPRICE_DAYS + 1) }));

    const result = await returnToFunnel('lead-1', 'acknowledgeStaleQuote');

    expect(result.success).toBe(true);
    expect(leadUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'AUDIT_COMPLETED', quoted_at: expect.any(Date) }),
      }),
    );
  });

  // @REQ: CRM-ZIMNE-AC2
  it('D2 sciezka B - refreshQuote: przeterminowana wycena przechodzi po aktualizacji ceny, cena zapisana', async () => {
    leadFindUniqueMock.mockResolvedValue(coldLead({ quoted_at: daysAgo(COLD_LEAD_REPRICE_DAYS + 1) }));

    const result = await returnToFunnel('lead-1', 'refreshQuote', 6500);

    expect(result.success).toBe(true);
    expect(leadUpdateMock).toHaveBeenCalledWith(
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
    leadFindUniqueMock.mockResolvedValueOnce(coldLead({ quoted_at: daysAgo(COLD_LEAD_REPRICE_DAYS) }));
    const atThreshold = await returnToFunnel('lead-1');
    expect(atThreshold.success).toBe(true);

    leadUpdateMock.mockClear();
    leadFindUniqueMock.mockResolvedValueOnce(coldLead({ quoted_at: daysAgo(COLD_LEAD_REPRICE_DAYS + 1) }));
    const overThreshold = await returnToFunnel('lead-1');
    expect(overThreshold.success).toBe(false);
  });

  // Przypadek NULL + fail-closed (decyzja dodatkowa 2026-08-20): quoted_at IS NULL
  // traktowane jak przeterminowane, wymaga jednej z dwoch sciezek D2.
  // @REQ: CRM-ZIMNE-AC2
  it('przypadek NULL - quoted_at nieustawione jest fail-closed: traktowane jak przeterminowane', async () => {
    leadFindUniqueMock.mockResolvedValue(coldLead({ quoted_at: null }));

    const withoutDecision = await returnToFunnel('lead-1');
    expect(withoutDecision.success).toBe(false);

    leadFindUniqueMock.mockResolvedValue(coldLead({ quoted_at: null }));
    const withDecision = await returnToFunnel('lead-1', 'acknowledgeStaleQuote');
    expect(withDecision.success).toBe(true);
  });

  // Przypadek brzegowy #3 (WO, idempotencja): drugie klikniecie na tym samym leadzie
  // (juz nie jest w QUOTE_REJECTED) jest odrzucone, nie tworzy drugiego przejscia.
  // @REQ: CRM-ZIMNE-AC2
  it('AC3.5 - idempotencja: druga proba po udanym powrocie (status juz AUDIT_COMPLETED) jest odrzucona', async () => {
    leadFindUniqueMock.mockResolvedValueOnce(coldLead({ quoted_at: daysAgo(1) }));
    const first = await returnToFunnel('lead-1');
    expect(first.success).toBe(true);

    leadUpdateMock.mockClear();
    leadFindUniqueMock.mockResolvedValueOnce({ ...coldLead({}), status: 'AUDIT_COMPLETED' });
    const second = await returnToFunnel('lead-1');

    expect(second.success).toBe(false);
    expect(leadUpdateMock).not.toHaveBeenCalled();
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
    leadFindUniqueMock.mockResolvedValue(coldLead({ quoted_at: quotedAtJustOverThreshold }));

    const result = await returnToFunnel('lead-1');

    expect(result.success).toBe(false);
  });

  // Przypadek brzegowy #8 (WO, transakcyjnosc): zmiana statusu i refreshQuoteValidity
  // dzieja sie w jednej transakcji.
  // @REQ: CRM-ZIMNE-AC2
  it('AC3.7 - zmiana statusu i odswiezenie waznosci wyceny dzieja sie w jednej transakcji', async () => {
    leadFindUniqueMock.mockResolvedValue(coldLead({ quoted_at: daysAgo(1) }));

    await returnToFunnel('lead-1');

    expect(transactionMock).toHaveBeenCalledTimes(1);
  });

  // Przypadek brzegowy #4 (WO, uprawnienia, warstwa Server Action): Prisma omija RLS,
  // wiec sprawdzenie roli musi zyc jawnie w returnToFunnel, tak samo jak w
  // deleteAuditorAction (auditors-delete.test.ts AC1.4).
  // @REQ: CRM-ZIMNE-AC2
  it('uprawnienia - rola spoza PERMISSIONS.leads.update jest odrzucona po stronie serwera', async () => {
    getCurrentActorRoleMock.mockResolvedValue('audytor');
    leadFindUniqueMock.mockResolvedValue(coldLead({ quoted_at: daysAgo(1) }));

    const result = await returnToFunnel('lead-1');

    expect(result.success).toBe(false);
    expect(leadUpdateMock).not.toHaveBeenCalled();
    expect(can('audytor', 'leads', 'update')).toBe('no');
    expect(PERMISSIONS.leads.update).not.toContain('audytor');
  });

  // Fail-closed: brak roli (getCurrentActorRole() zwraca null - brak wpisu w
  // AuthorizedUser albo brak sesji) musi byc odrzucony, nie przepuszczony.
  // @REQ: CRM-ZIMNE-AC2
  it('uprawnienia - brak roli (getCurrentActorRole zwraca null) jest odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);
    leadFindUniqueMock.mockResolvedValue(coldLead({ quoted_at: daysAgo(1) }));

    const result = await returnToFunnel('lead-1');

    expect(result.success).toBe(false);
    expect(leadUpdateMock).not.toHaveBeenCalled();
  });

  // Kontrola pozytywna: obie role z PERMISSIONS.leads.update przechodza sprawdzenie.
  // @REQ: CRM-ZIMNE-AC2
  it('kontrola pozytywna - role admin i dyspozytor przechodza sprawdzenie roli w returnToFunnel', async () => {
    expect(PERMISSIONS.leads.update).toEqual(['admin', 'dyspozytor']);

    getCurrentActorRoleMock.mockResolvedValue('admin');
    leadFindUniqueMock.mockResolvedValue(coldLead({ quoted_at: daysAgo(1) }));
    const asAdmin = await returnToFunnel('lead-1');
    expect(asAdmin.success).toBe(true);

    leadUpdateMock.mockClear();
    getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
    leadFindUniqueMock.mockResolvedValue(coldLead({ quoted_at: daysAgo(1) }));
    const asDyspozytor = await returnToFunnel('lead-1');
    expect(asDyspozytor.success).toBe(true);
  });
});
