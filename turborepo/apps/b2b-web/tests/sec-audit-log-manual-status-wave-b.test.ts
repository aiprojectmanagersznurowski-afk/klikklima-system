import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ROLES, can, TRANSITIONS, STATE_META } from '@klikklima/contracts';
import { isManualStatusChange } from '../src/lib/audit/manual-status-classifier';

/**
 * WO: docs/workorders/SEC-AUDIT-LOG-MANUAL-STATUS.md — Fala B (`test-author` → `implementer-server`).
 * Wymaganie: `SEC-AUDIT-LOG-MANUAL-STATUS` (`contracts/requirements.contract.mjs:409`, TODO, HIGH).
 *
 * Zakres: WYŁĄCZNIE dwa punkty zapisu, oba w
 * `apps/b2b-web/src/app/(dashboard)/logistics/actions.ts`:
 *   bypassLogisticsOrder   (T07 deliverWithCrew, `override: true` — K4, JEDYNE przejście,
 *                            którego nie łapią K1/K2/K3),
 *   rollbackLogisticsOrder (T10-T13, `action='rollback'` — wszystkie łapane przez K3,
 *                            krawędź bucketu ROLLBACK_RESCHEDULING).
 * Fala C (`advanceLeadStatus`) POZA ZAKRESEM tego pliku (osobna tura).
 *
 * ═══ KSZTAŁT WEJŚCIA WYBRANY W TEJ FALI (decyzja test-authora, zgodna z D4 wariant (b)) ═══
 * W przeciwieństwie do Fali A (`input: { justification, legalBasis }`, oba pola od operatora),
 * WO dla tej fali jest jednoznaczne: `legalBasis` NIE jest wybierany przez operatora — serwer
 * ustawia go na stałą `'OTHER'` przy zapisie. Obiekt `{ justification, legalBasis }` byłby więc
 * kształtem kłamliwym (pole, które nigdy nie jest odczytywane od wywołującego). Wybrany kształt:
 *   bypassLogisticsOrder(leadId: string, reason: string): Promise<{ success; error? }>
 *   rollbackLogisticsOrder(leadId: string, reason: string): Promise<{ success; error? }>
 * `reason` to zwykły string (NIE obiekt), walidowany przez próg `deleteJustificationSchema`
 * (implementer ma reużyć `deleteJustificationSchema.shape.justification`, np. przez
 * `deleteJustificationSchema.shape.justification.safeParse(reason)` — żeby NIE powstał drugi
 * plik z `z.string().trim().min(10)`, pilnowane globalnie przez
 * `sec-audit-log-delete-static.test.ts:253`, poza zakresem tego pliku). Ten plik NIE zakłada
 * istnienia żadnego nowego pliku schematu i nie importuje żadnego — testuje wyłącznie
 * zachowanie na granicy dwóch funkcji eksportowanych z `logistics/actions.ts`.
 *
 * Dla `rollbackLogisticsOrder`: `reason` pełni PODWÓJNĄ funkcję — zostaje notatką operacyjną
 * doklejaną do `notatki_wewnetrzne` (zachowanie dzisiejsze, WO nie każe go usuwać) ORAZ staje
 * się `justification` wpisu audytowego. WO nazywa `notatki_wewnetrzne` "notatką operacyjną, nie
 * dowodem" — ale nie zabrania tego samego tekstu pełnić obu ról; zabrania tylko, żeby operator
 * mógł pominąć uzasadnienie. Testy poniżej sprawdzają OBA skutki tego samego `reason`, słabo
 * (substring/equality na przycięty tekst), żeby nie przesądzać dokładnego formatu prefiksu
 * notatki (`"Rollback z logistyki: "` już istnieje w kodzie i nie ma powodu go usuwać).
 *
 * `legalBasis` w obu funkcjach: literał `'OTHER'`, sprawdzany wprost (ten sam poziom dowodu co
 * `operation='manual_status_change'`/`resource='leads'` w testach Fali A — to są stałe domenowe
 * bez odpowiednika nazwanego w kontrakcie, nie lista uprawnień do wyliczenia).
 *
 * ═══ WZORZEC MOCKOWANIA ═══
 * `bypassLogisticsOrder` DZIŚ nie ma `$transaction` w ogóle — mock `prisma` udostępnia
 * WYŁĄCZNIE `$transaction` (`transactionMock`) plus `leady.update`/`findUnique`
 * (`prismaLeadUpdateMock`/`prismaLeadFindUniqueMock`) SPOZA transakcji. Rozróżnienie
 * `prismaLeadUpdateMock` (poza tx) od `txLeadUpdateMock` (wewnątrz tx, przez fake `$transaction`)
 * jest CELOWE i jest głównym dowodem AC2 dla tej funkcji: dzisiejszy kod woła
 * `prisma.leady.update` bezpośrednio, więc `expect(prismaLeadUpdateMock).not.toHaveBeenCalled()`
 * i `expect(transactionMock).toHaveBeenCalledTimes(1)` muszą DZIŚ zawieść (czerwony dowód braku
 * transakcji), bez potrzeby rzucania wyjątków przez brakujący klucz w mocku (mock ma zarówno
 * `leady.update` na `prisma`, jak i na `tx` — różnica jest w tym, KTÓRY z dwóch operacja
 * faktycznie trafia, nie w tym, czy się kompiluje).
 *
 * `rollbackLogisticsOrder` MA już `$transaction` z `FOR UPDATE` (wzorzec z
 * `logistics-rollback-effects.test.ts`) — wpis audytowy MA wejść do ISTNIEJĄCEJ transakcji, nie
 * stworzyć nową. `prisma.leady.findUnique` (sprawdzenie wstępne PRZED otwarciem transakcji, już
 * istniejące w kodzie) zostaje jako osobny, dozwolony mock — to NIE jest naruszenie AC2 (WO nie
 * każe go usuwać, to fail-fast bez znaczenia dla domknięcia transakcyjnego zapisu).
 * `releaseCrewSlot`/`suspendLogisticsSla` (`rollback-effects.ts`) NIE są mockowane jako moduł —
 * są wołane naprawdę, na obiekcie `tx` przekazanym przez fake `$transaction`, wzorem
 * `logistics-authz-gates.test.ts` (`makeTxImplementation`): `tx.$queryRaw` zwraca pustą tablicę,
 * więc pętla `releaseCrewSlot` nic nie robi, a `tx.leady.findUnique`/`update` używane przez
 * `suspendLogisticsSla` współdzielą te same mocki co reszta logiki — ten plik NIE testuje
 * efektów rollbacku (to `logistics-rollback-effects.test.ts`), tylko wymiar audytowy.
 */

const {
  transactionMock,
  prismaLeadFindUniqueMock,
  prismaLeadUpdateMock,
  txLeadFindUniqueMock,
  txLeadUpdateMock,
  txAuditLogCreateMock,
  txQueryRawMock,
  txInstalacjeUpdateMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
  getUserMock,
  notificationQueueCreateMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  prismaLeadFindUniqueMock: vi.fn(),
  prismaLeadUpdateMock: vi.fn(),
  txLeadFindUniqueMock: vi.fn(),
  txLeadUpdateMock: vi.fn(),
  txAuditLogCreateMock: vi.fn(),
  txQueryRawMock: vi.fn(),
  txInstalacjeUpdateMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  getUserMock: vi.fn(),
  notificationQueueCreateMock: vi.fn().mockResolvedValue({ id: 'nq-mock-id' }),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    leady: { findUnique: prismaLeadFindUniqueMock, update: prismaLeadUpdateMock },
    // LOGISTICS-SHIPPING-EFFECTS (Faza C): bypassLogisticsOrder/rollbackLogisticsOrder
    // woloja odtad enqueueNotification(tx, {...}) wewnatrz $transaction, ktora uzywa
    // tx.notificationQueue.create. Ten plik nie testuje efektow powiadomien, wiec
    // mock jest neutralnym, zawsze-sukces fixture'em.
    notificationQueue: { create: notificationQueueCreateMock },
    $transaction: transactionMock,
  },
  LeadStatus: {
    HARDWARE_IN_WAREHOUSE: 'HARDWARE_IN_WAREHOUSE',
    AWAITING_INSTALLATION: 'AWAITING_INSTALLATION',
    ROLLBACK_RESCHEDULING: 'ROLLBACK_RESCHEDULING',
    HARDWARE_IN_TRANSIT: 'HARDWARE_IN_TRANSIT',
    AWAITING_CREW_ASSIGNMENT: 'AWAITING_CREW_ASSIGNMENT',
  },
  InstallationStatus: { CANCELLED: 'CANCELLED' },
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}));
getCurrentUserMock.mockImplementation(() => getUserMock());

const rawActions = await import('../src/app/(dashboard)/logistics/actions');

type ManualStatusFn = (leadId: string, reason: string) => Promise<{ success: boolean; error?: string }>;
// Rzutowanie przez `unknown`, nie `any` (zakaz CLAUDE.md) — sygnatury dzisiejsze mają
// jeden parametr (`bypassLogisticsOrder`) albo `reason?: string` opcjonalny
// (`rollbackLogisticsOrder`); ten plik testuje KSZTAŁT DOCELOWY z drugim, obowiązkowym
// parametrem `reason: string`.
const bypassLogisticsOrder = rawActions.bypassLogisticsOrder as unknown as ManualStatusFn;
const rollbackLogisticsOrder = rawActions.rollbackLogisticsOrder as unknown as ManualStatusFn;

const tx = {
  leady: { findUnique: txLeadFindUniqueMock, update: txLeadUpdateMock },
  auditLog: { create: txAuditLogCreateMock },
  instalacje: { update: txInstalacjeUpdateMock },
  notificationQueue: { create: notificationQueueCreateMock },
  $queryRaw: txQueryRawMock,
};

const OPERATOR_EMAIL = 'dyspozytor@klikklima.pl';
const VALID_REASON = 'Kurier nie dojechał na czas, ekipa dostarcza sprzęt sama.';
const LEAD_ID = 'lead-1';

const LEADS_UPDATE_DENIED = ROLES.filter((r) => can(r, 'leads', 'update') !== 'yes');

beforeEach(() => {
  transactionMock.mockReset();
  prismaLeadFindUniqueMock.mockReset();
  prismaLeadUpdateMock.mockReset();
  txLeadFindUniqueMock.mockReset();
  txLeadUpdateMock.mockReset();
  txAuditLogCreateMock.mockReset();
  txQueryRawMock.mockReset();
  txInstalacjeUpdateMock.mockReset();
  revalidatePathMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  getUserMock.mockReset();

  transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(tx));
  getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
  getUserMock.mockResolvedValue({ data: { user: { email: OPERATOR_EMAIL } } });
  prismaLeadUpdateMock.mockResolvedValue({});
  txLeadFindUniqueMock.mockResolvedValue({ id: LEAD_ID, status: 'HARDWARE_IN_WAREHOUSE' });
  txLeadUpdateMock.mockResolvedValue({});
  txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });
  txQueryRawMock.mockResolvedValue([]);
  prismaLeadFindUniqueMock.mockResolvedValue({ id: LEAD_ID, status: 'HARDWARE_IN_TRANSIT', data_rezerwacji: null, logistics_sla_paused_at: null });
});

// ═══ Klasyfikator (fakt ustalony w Fali 0, potwierdzenie krótkie, nie powtórzenie) ═══

describe('isManualStatusChange — potwierdzenie dla T07/T10-T13 (SEC-AUDIT-LOG-MANUAL-STATUS)', () => {
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('T07 (bypassLogisticsOrder) jest ręczne przez K4 (override), mimo aktora DISPATCHER i STAGE->STAGE', () => {
    const t07 = TRANSITIONS.find((t) => t.id === 'T07')!;
    expect(t07.override).toBe(true);
    expect(STATE_META[t07.from].kind).toBe('STAGE');
    expect(STATE_META[t07.to].kind).toBe('STAGE');
    expect(isManualStatusChange('T07')).toBe(true);
  });

  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it.each(['T10', 'T11', 'T12', 'T13'])(
    '%s (rollbackLogisticsOrder) jest ręczne przez K3 (krawędź bucketu ROLLBACK_RESCHEDULING)',
    (id) => {
      const t = TRANSITIONS.find((tr) => tr.id === id)!;
      expect(STATE_META[t.to].kind).toBe('BUCKET');
      expect(isManualStatusChange(id)).toBe(true);
    },
  );
});

// ═══ bypassLogisticsOrder ═══

describe('bypassLogisticsOrder — SEC-AUDIT-LOG-MANUAL-STATUS (Fala B)', () => {
  // AC6 — bramka roli PRZED jakimkolwiek zapytaniem.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it.each(LEADS_UPDATE_DENIED)('rola %s odrzucona fail-closed, zero transakcji i zero wpisu audytowego', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);

    const result = await bypassLogisticsOrder(LEAD_ID, VALID_REASON);

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
    expect(prismaLeadUpdateMock).not.toHaveBeenCalled();
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });

  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('brak roli (null) odrzucony fail-closed', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await bypassLogisticsOrder(LEAD_ID, VALID_REASON);

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  // AC1 — wpis audytowy z operation/resource/recordId poprawnymi.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('AC1 — wpis audytowy ma operation=manual_status_change, resource=leads, recordId=id leada', async () => {
    const result = await bypassLogisticsOrder(LEAD_ID, VALID_REASON);

    expect(result.success).toBe(true);
    expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
    expect(txAuditLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        operation: 'manual_status_change',
        resource: 'leads',
        recordId: LEAD_ID,
      }),
    });
  });

  // AC5 — actorEmail z sesji, actorRole utrwalona.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('AC5 — actorEmail pochodzi z sesji, actorRole zapisana, recordId to id leada (nigdy e-mail)', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'ktos-inny@klikklima.pl' } } });
    getCurrentActorRoleMock.mockResolvedValue('admin');

    await bypassLogisticsOrder(LEAD_ID, VALID_REASON);

    const call = txAuditLogCreateMock.mock.calls[0]?.[0];
    expect(call?.data?.actorEmail).toBe('ktos-inny@klikklima.pl');
    expect(call?.data?.actorRole).toBe('admin');
    expect(call?.data?.recordId).toBe(LEAD_ID);
    expect(call?.data?.recordId).not.toBe('ktos-inny@klikklima.pl');
  });

  // Bez e-maila w sesji — odmowa PRZED transakcją.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('brak e-maila w sesji odrzucony fail-closed, PRZED transakcją', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: null } } });

    const result = await bypassLogisticsOrder(LEAD_ID, VALID_REASON);

    expect(result.success).toBe(false);
    expect(transactionMock).not.toHaveBeenCalled();
  });

  // D4(b) — legalBasis ustalany przez serwer na 'OTHER', niezależnie od czegokolwiek
  // (nic nie jest przekazywane — operator nie wybiera podstawy prawnej).
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it("D4(b) — legalBasis zapisanego wpisu to literalnie 'OTHER'", async () => {
    await bypassLogisticsOrder(LEAD_ID, VALID_REASON);

    expect(txAuditLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ legalBasis: 'OTHER' }),
    });
  });

  // reason obowiązkowy ≥10 znaków po trim — dziś pole NIE ISTNIEJE w ogóle.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it.each([
    [undefined, 'brak w ogóle'],
    ['', 'pusty string'],
    ['   ', 'same białe znaki'],
    ['  123456789  ', '9 znaków po trim'],
  ] as const)('reason niepoprawny (%s — %s) odrzucony bez zmiany statusu i bez wpisu', async (reason, _label) => {
    const result = await bypassLogisticsOrder(LEAD_ID, reason as unknown as string);

    expect(result.success).toBe(false);
    expect(prismaLeadUpdateMock).not.toHaveBeenCalled();
    expect(txLeadUpdateMock).not.toHaveBeenCalled();
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });

  // Granica: dokładnie 10 znaków po trim jest dozwolone.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('reason dokładnie 10 znaków po trim jest dozwolony', async () => {
    const result = await bypassLogisticsOrder(LEAD_ID, '  1234567890  ');

    expect(result.success).toBe(true);
    expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
  });

  // AC2 — transakcyjność: DZIŚ funkcja nie ma $transaction w ogóle. Dowód: mutacja
  // statusu i wpis audytowy muszą trafić RAZEM do JEDNEJ, NOWEJ transakcji — nie do
  // `prisma.leady.update` bezpośrednio (jak dziś).
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('AC2 — status i wpis audytowy trafiają do JEDNEJ transakcji, nie do prisma.leady.update bezpośrednio', async () => {
    const result = await bypassLogisticsOrder(LEAD_ID, VALID_REASON);

    expect(result.success).toBe(true);
    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(prismaLeadUpdateMock).not.toHaveBeenCalled();
    expect(txLeadUpdateMock).toHaveBeenCalledTimes(1);
    expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
  });

  // AC2 — kolejność: update statusu PRZED wpisem audytowym.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('AC2 — update statusu wywołany PRZED auditLog.create, w tej samej transakcji', async () => {
    await bypassLogisticsOrder(LEAD_ID, VALID_REASON);

    expect(txLeadUpdateMock).toHaveBeenCalledTimes(1);
    expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
    expect(txLeadUpdateMock.mock.invocationCallOrder[0]).toBeLessThan(
      txAuditLogCreateMock.mock.invocationCallOrder[0],
    );
  });

  // AC2 — błąd wpisu audytowego cofa całą transakcję.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('AC2 — błąd auditLog.create → wynik porażka, revalidatePath nie wołane', async () => {
    txAuditLogCreateMock.mockRejectedValue(new Error('CHECK constraint violation'));

    const result = await bypassLogisticsOrder(LEAD_ID, VALID_REASON);

    expect(result.success).toBe(false);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  // AC2 — odwrotny kierunek: błąd update statusu → auditLog.create nigdy nie wywołane.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('AC2 — błąd update statusu → auditLog.create nie zostaje wywołane', async () => {
    txLeadUpdateMock.mockRejectedValue(new Error('DB error'));

    const result = await bypassLogisticsOrder(LEAD_ID, VALID_REASON);

    expect(result.success).toBe(false);
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });

  // Nowy guard (WO: "dziś bypass przechodzi z DOWOLNEGO statusu, bo nie ma żadnego
  // odczytu przed zapisem") — bypass MUSI odczytać stan bieżący WEWNĄTRZ transakcji i
  // odrzucić, jeśli lead nie jest w HARDWARE_IN_WAREHOUSE (źródłowy stan T07).
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('lead POZA HARDWARE_IN_WAREHOUSE (np. już AWAITING_INSTALLATION) jest odrzucony, bez zmiany statusu i bez wpisu', async () => {
    txLeadFindUniqueMock.mockResolvedValue({ id: LEAD_ID, status: 'AWAITING_INSTALLATION' });

    const result = await bypassLogisticsOrder(LEAD_ID, VALID_REASON);

    expect(result.success).toBe(false);
    expect(txLeadUpdateMock).not.toHaveBeenCalled();
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });

  // Przypadek pusty: lead nieistniejący.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('lead nieistniejący (findUnique null wewnątrz tx) odrzucony bez wpisu audytowego', async () => {
    txLeadFindUniqueMock.mockResolvedValue(null);

    const result = await bypassLogisticsOrder(LEAD_ID, VALID_REASON);

    expect(result.success).toBe(false);
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });

  // AC8 — blokada współbieżności: to, co można dowieść w tym środowisku (bez żywego
  // Postgresa), to KONTRAKT WYWOŁAŃ mocka, nie realną rywalizację dwóch transakcji —
  // wzorzec identyczny z `AC-A6`/`BLOKADA-LEADY` w `logistics-rollback-effects.test.ts`.
  // Sprawdzamy, że PIERWSZE wywołanie `tx.$queryRaw` niesie `SELECT ... FOR UPDATE` na
  // tabeli `leady` i poprzedza (globalna kolejność wywołań mocków, `invocationCallOrder`)
  // zarówno `tx.leady.findUnique`, jak i `tx.leady.update`/`tx.auditLog.create` — to jest
  // dokładnie ten mechanizm, który w prawdziwym Postgresie serializowałby dwa równoległe
  // wywołania bypassu na tym samym leadzie (druga transakcja czeka na zwolnienie blokady
  // wiersza, zamiast czytać ten sam, jeszcze niezmieniony status).
  //
  // Poprzednia wersja tego testu (`mockResolvedValueOnce`/`mockResolvedValueOnce` na
  // `txLeadFindUniqueMock` + `Promise.all`) NIE dowodziła obecności blokady: kolejność,
  // w jakiej te dwie odpowiedzi trafiały do dwóch wywołań `bypassLogisticsOrder`, była
  // artefaktem deterministycznej kolejności rozwiązywania mocków w silniku JS (kolejka
  // mikrozadań), nie efektem `FOR UPDATE`. Test przechodziłby identycznie, gdyby
  // produkcyjny kod NIE MIAŁ żadnej blokady wiersza — więc nie wykrywał jej braku.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('AC8 — blokada wiersza leady (FOR UPDATE) w tx.$queryRaw poprzedza findUnique/update/auditLog', async () => {
    await bypassLogisticsOrder(LEAD_ID, VALID_REASON);

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
});

// ═══ rollbackLogisticsOrder ═══

describe('rollbackLogisticsOrder — SEC-AUDIT-LOG-MANUAL-STATUS (Fala B)', () => {
  // AC6 — bramka roli PRZED jakimkolwiek zapytaniem (już pokryte przez
  // `logistics-authz-gates.test.ts` dla samego `can()`; tu dowodzimy dodatkowo, że
  // brak wywołania sięga do zerowego wpisu audytowego, nie tylko zerowego update).
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it.each(LEADS_UPDATE_DENIED)('rola %s odrzucona fail-closed, zero wpisu audytowego', async (role) => {
    getCurrentActorRoleMock.mockResolvedValue(role);

    const result = await rollbackLogisticsOrder(LEAD_ID, VALID_REASON);

    expect(result.success).toBe(false);
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });

  // AC1 — wpis audytowy, operation/resource/recordId poprawne.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('AC1 — wpis audytowy ma operation=manual_status_change, resource=leads, recordId=id leada', async () => {
    const result = await rollbackLogisticsOrder(LEAD_ID, VALID_REASON);

    expect(result.success).toBe(true);
    expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
    expect(txAuditLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({
        operation: 'manual_status_change',
        resource: 'leads',
        recordId: LEAD_ID,
      }),
    });
  });

  // AC5 — actorEmail z sesji, actorRole utrwalona.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('AC5 — actorEmail pochodzi z sesji, actorRole zapisana', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: 'ktos-inny@klikklima.pl' } } });
    getCurrentActorRoleMock.mockResolvedValue('admin');

    await rollbackLogisticsOrder(LEAD_ID, VALID_REASON);

    const call = txAuditLogCreateMock.mock.calls[0]?.[0];
    expect(call?.data?.actorEmail).toBe('ktos-inny@klikklima.pl');
    expect(call?.data?.actorRole).toBe('admin');
    expect(call?.data?.recordId).toBe(LEAD_ID);
  });

  // D4(b) — legalBasis ustalany przez serwer na 'OTHER'.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it("D4(b) — legalBasis zapisanego wpisu to literalnie 'OTHER'", async () => {
    await rollbackLogisticsOrder(LEAD_ID, VALID_REASON);

    expect(txAuditLogCreateMock).toHaveBeenCalledWith({
      data: expect.objectContaining({ legalBasis: 'OTHER' }),
    });
  });

  // D4(b) — reason pełni podwójną funkcję: notatka operacyjna (notatki_wewnetrzne,
  // zachowanie dzisiejsze) ORAZ uzasadnienie audytowe (justification, nowe). Sprawdzone
  // słabo (substring / równość na przycięty tekst), żeby nie przesądzać formatu
  // prefiksu notatki.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('reason trafia RÓWNOCZEŚNIE do notatki_wewnetrzne (z dotychczasowym prefiksem) i do justification wpisu audytowego', async () => {
    await rollbackLogisticsOrder(LEAD_ID, VALID_REASON);

    const updateCall = txLeadUpdateMock.mock.calls.find(
      (c) => typeof (c[0] as { data?: { notatki_wewnetrzne?: unknown } })?.data?.notatki_wewnetrzne === 'string',
    );
    expect(updateCall).toBeDefined();
    expect((updateCall?.[0] as { data: { notatki_wewnetrzne: string } }).data.notatki_wewnetrzne).toContain(VALID_REASON);

    const auditCall = txAuditLogCreateMock.mock.calls[0]?.[0];
    expect(auditCall?.data?.justification).toBe(VALID_REASON);
  });

  // D4 — ZMIANA ZACHOWANIA: `reason` był opcjonalny, teraz jest obowiązkowy ≥10
  // znaków po trim. Dawne wywołania bez `reason` (np. `rollbackLogisticsOrder(leadId)`)
  // MUSZĄ zostać odrzucone — to jest świadomie testowany regres wobec dzisiejszego
  // kodu, zgodny z D4(b).
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it.each([
    [undefined, 'brak w ogóle (dawne wywołanie bez reason)'],
    ['', 'pusty string'],
    ['   ', 'same białe znaki'],
    ['  123456789  ', '9 znaków po trim'],
  ] as const)('reason niepoprawny (%s — %s) odrzucony bez zmiany statusu i bez wpisu audytowego', async (reason, _label) => {
    const result = await rollbackLogisticsOrder(LEAD_ID, reason as unknown as string);

    expect(result.success).toBe(false);
    expect(txLeadUpdateMock).not.toHaveBeenCalled();
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });

  // Granica: dokładnie 10 znaków po trim jest dozwolone.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('reason dokładnie 10 znaków po trim jest dozwolony', async () => {
    const result = await rollbackLogisticsOrder(LEAD_ID, '  1234567890  ');

    expect(result.success).toBe(true);
    expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
  });

  // AC2 — REUŻYCIE istniejącej transakcji (z FOR UPDATE): audyt wchodzi do TEJ SAMEJ
  // transakcji, nie tworzy nowej. Dokładnie jedno wywołanie $transaction.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('AC2 — jedna (istniejąca) transakcja obejmuje update statusu ORAZ auditLog.create', async () => {
    await rollbackLogisticsOrder(LEAD_ID, VALID_REASON);

    expect(transactionMock).toHaveBeenCalledTimes(1);
    expect(txLeadUpdateMock).toHaveBeenCalled();
    expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
  });

  // AC2 — kolejność: update statusu PRZED wpisem audytowym.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('AC2 — update statusu wywołany PRZED auditLog.create, w tej samej transakcji', async () => {
    await rollbackLogisticsOrder(LEAD_ID, VALID_REASON);

    expect(txLeadUpdateMock.mock.calls.length).toBeGreaterThan(0);
    expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);

    const statusUpdateCall = txLeadUpdateMock.mock.invocationCallOrder[0];
    expect(statusUpdateCall).toBeLessThan(txAuditLogCreateMock.mock.invocationCallOrder[0]);
  });

  // AC2 — błąd wpisu audytowego cofa całą transakcję.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('AC2 — błąd auditLog.create → wynik porażka, revalidatePath nie wołane', async () => {
    txAuditLogCreateMock.mockRejectedValue(new Error('CHECK constraint violation'));

    const result = await rollbackLogisticsOrder(LEAD_ID, VALID_REASON);

    expect(result.success).toBe(false);
    expect(revalidatePathMock).not.toHaveBeenCalled();
  });

  // AC2 — odwrotny kierunek: błąd update statusu → auditLog.create nigdy nie wywołane.
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('AC2 — błąd update statusu → auditLog.create nie zostaje wywołane', async () => {
    txLeadUpdateMock.mockRejectedValue(new Error('DB error'));

    const result = await rollbackLogisticsOrder(LEAD_ID, VALID_REASON);

    expect(result.success).toBe(false);
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });

  // Przypadek pusty: lead nieistniejący (sprawdzenie wstępne, poza tx).
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('lead nieistniejący (sprawdzenie wstępne) odrzucony bez wpisu audytowego', async () => {
    prismaLeadFindUniqueMock.mockResolvedValue(null);

    const result = await rollbackLogisticsOrder(LEAD_ID, VALID_REASON);

    expect(result.success).toBe(false);
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });
});
