import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ROLES, can, AUDIT_REQUIREMENTS, PERMISSIONS } from '@klikklima/contracts';
import type { DeleteJustificationInput } from '../src/lib/audit/delete-justification-schema';

/**
 * `daysAgo(1)` (wzorem `leads-return-to-funnel.test.ts`) — `coldLead()` domyślnie
 * reprezentuje wycenę ŚWIEŻĄ (poniżej `SLA.COLD_LEAD_REPRICE.days`), żeby ścieżki
 * generyczne (AC1/AC2/AC5/AC6/AC7/AC8/AC9) przechodziły dla OBU funkcji bez
 * dodatkowego `resolution` — `returnToFunnel` odrzuca wycenę przeterminowaną bez
 * jawnej decyzji (`guard quoteRefreshedIfStale`), co jest osobnym zachowaniem
 * pokrytym w `leads-return-to-funnel.test.ts`, nie tu.
 */
const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);

/**
 * WO: docs/workorders/SEC-AUDIT-LOG-MANUAL-STATUS.md — Fala A (`test-author` → `implementer-server`).
 * Wymaganie: `SEC-AUDIT-LOG-MANUAL-STATUS` (`contracts/requirements.contract.mjs`, TODO, HIGH).
 *
 * Zakres tego pliku — WYŁĄCZNIE dwa punkty zapisu Fali A, oba w
 * `apps/b2b-web/src/app/(dashboard)/leads/actions.ts`:
 *   archiveLost   (T16: QUOTE_REJECTED -> ARCHIVED_LOST, terminalne),
 *   returnToFunnel (T15: QUOTE_REJECTED -> AUDIT_COMPLETED).
 * Fala B (bypassLogisticsOrder, rollbackLogisticsOrder) i Fala C (advanceLeadStatus)
 * POZA ZAKRESEM tego pliku (osobne tury).
 *
 * ═══ DLACZEGO OBIE FUNKCJE SĄ "RĘCZNE" BEZ WARUNKU ═══
 * Obie krawędzie wychodzą z `QUOTE_REJECTED`, a `STATE_META.QUOTE_REJECTED.kind === 'BUCKET'`
 * — K3 łapie je zawsze, niezależnie od aktora. W przeciwieństwie do `advanceLeadStatus`
 * (Fala C), tu NIE MA warunkowości "loguj tylko gdy K1/K2/K3/K4" — każde wykonanie tych
 * dwóch funkcji jest z definicji ręczną zmianą statusu i MUSI zostawić wpis. Dowód tego
 * faktu żyje w `sec-audit-log-manual-status-classifier.test.ts` (K3 dla T15/T16); ten plik
 * go NIE powtarza, tylko z niego korzysta jako z ustalonego faktu.
 *
 * ═══ STAN DZISIEJSZY (zweryfikowany czytaniem źródeł 2026-09-04) ═══
 * Obie funkcje MAJĄ już `prisma.$transaction` (WO, D5: "koszt niski" — jedno
 * `tx.auditLog.create` w istniejącym bloku, BEZ nowej transakcji). Żadna nie przyjmuje
 * dziś parametru `input` (`justification`/`legalBasis`), żadna nie sięga po
 * `createClient()`/`getCurrentUser()` do e-maila operatora, żadna nie zapisuje do
 * `audit_log`. Ten plik testuje KSZTAŁT DOCELOWY:
 *   archiveLost(leadId: string, reason: string, note: string | undefined, input: DeleteJustificationInput)
 *   returnToFunnel(leadId: string, resolution: ... | undefined, newPrice: number | undefined, input: DeleteJustificationInput)
 * `input` jest CZWARTYM, OBOWIĄZKOWYM parametrem — `reason`/`note` (archiveLost) i
 * `resolution`/`newPrice` (returnToFunnel) zostają jako pola BIZNESOWE (analityka powodu
 * utraty / decyzja cenowa), NIEZALEŻNE od `input.justification`/`input.legalBasis`
 * (dowód operatora, dlaczego WYKONAŁ tę operację — WO rozróżnia to wprost). RED jest tu
 * oczekiwany: sygnatury dziś mają 2-3 parametry, nie 4, więc wywołania poniżej albo nie
 * skompilują się względem dzisiejszego typu (jeśli TS strict), albo `input` wyląduje jako
 * czwarty, ignorowany argument dzisiejszej implementacji — w obu przypadkach asercje na
 * `txAuditLogCreateMock` zawiodą, bo audytu dziś nie ma.
 *
 * ═══ SCHEMAT WEJŚCIA (AC10, decyzja tego pliku) ═══
 * ŻADEN nowy plik schematu. `input` ma DOKŁADNIE ten sam kształt co
 * `DeleteJustificationInput` (`{ justification: string; legalBasis: AuditLegalBasis }`) —
 * w przeciwieństwie do `SEC-AUDIT-LOG-ROLE-CHANGE`, żadna z tych dwóch funkcji nie
 * potrzebuje POLA DODATKOWEGO (jak `role` w `roleChangeSchema`), więc `.extend({})` byłoby
 * rozszerzeniem o zero pól — martwym opakowaniem. Implementer może więc użyć
 * `deleteJustificationSchema` BEZPOŚREDNIO (import, nie kopia) do walidacji `input` w obu
 * funkcjach. Ten plik nie importuje żadnego nowego pliku schematu i nie zakłada jego
 * istnienia — testuje wyłącznie zachowanie działania na granicy `{ justification, legalBasis }`,
 * co jest zgodne z KAŻDYM wyborem implementera, o ile nie powstaje drugi
 * `z.string().trim().min(10)` (pilnowane przez `sec-audit-log-delete-static.test.ts:253`,
 * niedotykane w tym oknie).
 *
 * ═══ WZORZEC MOCKOWANIA ═══ Jak `sec-audit-log-delete-wave-b.test.ts`: `@repo/database`
 * mockowane WYŁĄCZNIE `prisma.$transaction` (żadnego modelu na `prisma` bezpośrednio) —
 * dowodzi to AC2 (reużycie ISTNIEJĄCEJ transakcji): wywołanie modelu POZA `tx` rzuci
 * `TypeError`, złapane przez `try/catch` istniejący w obu funkcjach.
 */

const {
  transactionMock,
  txLeadFindUniqueMock,
  txLeadUpdateMock,
  txAuditLogCreateMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getCurrentUserMock,
  getUserMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  txLeadFindUniqueMock: vi.fn(),
  txLeadUpdateMock: vi.fn(),
  txAuditLogCreateMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
  getUserMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    $transaction: transactionMock,
  },
  LeadStatus: {},
}));
vi.mock('next/cache', () => ({ revalidatePath: revalidatePathMock }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}));
getCurrentUserMock.mockImplementation(() => getUserMock());

const { archiveLost, returnToFunnel } = await import('../src/app/(dashboard)/leads/actions');

const tx = {
  leady: { findUnique: txLeadFindUniqueMock, update: txLeadUpdateMock },
  auditLog: { create: txAuditLogCreateMock },
};

const OPERATOR_EMAIL = 'dyspozytor@klikklima.pl';
const VALID_BASIS = AUDIT_REQUIREMENTS.legalBases[0];
const INVALID_BASIS = 'NIEISTNIEJACA_PODSTAWA';
const VALID_JUSTIFICATION = 'Klient zadzwonił i poprosił o ręczne przywrócenie po awarii systemu.';
const VALID_INPUT: DeleteJustificationInput = { justification: VALID_JUSTIFICATION, legalBasis: VALID_BASIS };
const LEAD_ID = 'lead-1';

const coldLead = (overrides: Record<string, unknown> = {}) => ({
  id: LEAD_ID,
  status: 'QUOTE_REJECTED',
  quoted_at: daysAgo(1),
  lost_reason: null,
  auto_rejected_reason: null,
  ...overrides,
});

const VALID_LOST_REASON = 'COMPETITOR';

beforeEach(() => {
  transactionMock.mockReset();
  txLeadFindUniqueMock.mockReset();
  txLeadUpdateMock.mockReset();
  txAuditLogCreateMock.mockReset();
  revalidatePathMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  getUserMock.mockReset();

  transactionMock.mockImplementation(async (callback: (tx: unknown) => unknown) => callback(tx));
  getCurrentActorRoleMock.mockResolvedValue('dyspozytor');
  getUserMock.mockResolvedValue({ data: { user: { email: OPERATOR_EMAIL } } });
  txLeadFindUniqueMock.mockResolvedValue(coldLead());
  txLeadUpdateMock.mockResolvedValue({});
  txAuditLogCreateMock.mockResolvedValue({ id: 'audit-1' });
});

type ManualStatusConfig = {
  label: string;
  call: (input: DeleteJustificationInput) => Promise<{ success: boolean; error?: string }>;
  targetStatus: string;
};

const configs: ManualStatusConfig[] = [
  {
    label: 'archiveLost',
    call: (input) => archiveLost(LEAD_ID, VALID_LOST_REASON, undefined, input),
    targetStatus: 'ARCHIVED_LOST',
  },
  {
    label: 'returnToFunnel',
    call: (input) => returnToFunnel(LEAD_ID, undefined, undefined, input),
    targetStatus: 'AUDIT_COMPLETED',
  },
];

for (const cfg of configs) {
  const DENIED_ROLES = ROLES.filter((r) => can(r, 'leads', 'update') !== 'yes');

  describe(`${cfg.label} — SEC-AUDIT-LOG-MANUAL-STATUS (Fala A)`, () => {
    // Kontrola pozytywna kontraktu — inaczej AC6 poniżej byłoby wektorem pustym.
    // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
    it('kontrola pozytywna kontraktu — PERMISSIONS.leads.update rozróżnia role', () => {
      expect(PERMISSIONS.leads.update).toEqual(['admin', 'dyspozytor']);
      expect(DENIED_ROLES.length).toBeGreaterThan(0);
    });

    // AC6 — bramka roli PRZED jakimkolwiek zapytaniem: rola bez can(...,'leads','update')==='yes'
    // odrzucona, zero transakcji, zero findUnique/update/auditLog.
    // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
    it.each(DENIED_ROLES)('rola %s odrzucona fail-closed, zero zapytań i zero wpisu audytowego', async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);

      const result = await cfg.call(VALID_INPUT);

      expect(result.success).toBe(false);
      expect(transactionMock).not.toHaveBeenCalled();
      expect(txLeadUpdateMock).not.toHaveBeenCalled();
      expect(txAuditLogCreateMock).not.toHaveBeenCalled();
    });

    // AC6 — brak roli (null), fail-closed.
    // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
    it('brak roli (null) odrzucony fail-closed, zero zapytań', async () => {
      getCurrentActorRoleMock.mockResolvedValue(null);

      const result = await cfg.call(VALID_INPUT);

      expect(result.success).toBe(false);
      expect(transactionMock).not.toHaveBeenCalled();
      expect(txAuditLogCreateMock).not.toHaveBeenCalled();
    });

    // AC7 — justification: przypadki niepoprawne, bez żadnej zmiany statusu.
    // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
    it.each([
      ['', 'pusty string'],
      ['   ', 'same białe znaki'],
      ['  123456789  ', '9 znaków po trim'],
    ] as const)('justification niepoprawny (%s — %s) odrzucony bez zmiany statusu', async (justification, _label) => {
      const result = await cfg.call({ justification, legalBasis: VALID_BASIS });

      expect(result.success).toBe(false);
      expect(txLeadUpdateMock).not.toHaveBeenCalled();
      expect(txAuditLogCreateMock).not.toHaveBeenCalled();
    });

    // AC7 — granica: dokładnie 10 znaków po trim jest dozwolone.
    // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
    it('justification dokładnie 10 znaków po trim jest dozwolony', async () => {
      const result = await cfg.call({ justification: '  1234567890  ', legalBasis: VALID_BASIS });

      expect(result.success).toBe(true);
      expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
    });

    // AC7 — legalBasis spoza słownika kontraktu odrzucony bez zmiany statusu.
    // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
    it('legalBasis spoza AUDIT_REQUIREMENTS.legalBases odrzucony bez zmiany statusu', async () => {
      expect(AUDIT_REQUIREMENTS.legalBases).not.toContain(INVALID_BASIS);

      const result = await cfg.call({
        justification: VALID_JUSTIFICATION,
        legalBasis: INVALID_BASIS as DeleteJustificationInput['legalBasis'],
      });

      expect(result.success).toBe(false);
      expect(txLeadUpdateMock).not.toHaveBeenCalled();
    });

    // AC7 — brak `input` w ogóle (sygnatura bez wartości domyślnej) — symuluje wywołanie
    // z pominięciem walidacji klienckiej. Rzutowanie przez `unknown`, nie `any`.
    // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
    it('brak input jest odrzucony bez zmiany statusu — nie istnieje wartość domyślna uzasadnienia', async () => {
      const missingInput = undefined as unknown as DeleteJustificationInput;

      const result = await cfg.call(missingInput);

      expect(result.success).toBe(false);
      expect(txLeadUpdateMock).not.toHaveBeenCalled();
      expect(txAuditLogCreateMock).not.toHaveBeenCalled();
    });

    // AC1 — dokładnie jeden wiersz audit_log, operation/resource/recordId poprawne.
    // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
    it('AC1 — wpis audytowy ma operation=manual_status_change, resource=leads, recordId=id leada', async () => {
      await cfg.call(VALID_INPUT);

      expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
      expect(txAuditLogCreateMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          operation: 'manual_status_change',
          resource: 'leads',
          recordId: LEAD_ID,
        }),
      });
    });

    // AC5 — kompletność wpisu: actor_email WYŁĄCZNIE z sesji (nigdy z parametru akcji),
    // actor_role utrwalona, justification/legalBasis przekazane 1:1.
    // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
    it('AC5 — actorEmail pochodzi z sesji, actorRole/justification/legalBasis zapisane', async () => {
      getUserMock.mockResolvedValue({ data: { user: { email: 'ktos-inny@klikklima.pl' } } });
      getCurrentActorRoleMock.mockResolvedValue('admin');

      await cfg.call(VALID_INPUT);

      expect(txAuditLogCreateMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          actorEmail: 'ktos-inny@klikklima.pl',
          actorRole: 'admin',
          justification: VALID_JUSTIFICATION,
          legalBasis: VALID_BASIS,
        }),
      });
    });

    // AC5 (tożsamość po ID, nie e-mailu) — recordId to ID LEADA z parametru, e-mail
    // operatora nie ląduje NIGDY w recordId ani nie jest używany do identyfikacji rekordu.
    // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
    it('AC5 — recordId to id leada z parametru, nigdy e-mail operatora', async () => {
      await cfg.call(VALID_INPUT);

      const call = txAuditLogCreateMock.mock.calls[0]?.[0];
      expect(call?.data?.recordId).toBe(LEAD_ID);
      expect(call?.data?.recordId).not.toBe(OPERATOR_EMAIL);
    });

    // AC5 — brak e-maila w sesji, PRZED transakcją (fail-closed).
    // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
    it('brak e-maila w sesji odrzucony fail-closed, PRZED transakcją', async () => {
      getUserMock.mockResolvedValue({ data: { user: { email: null } } });

      const result = await cfg.call(VALID_INPUT);

      expect(result.success).toBe(false);
      expect(transactionMock).not.toHaveBeenCalled();
    });

    // AC2 — REUŻYCIE istniejącej transakcji: dokładnie JEDNO wywołanie $transaction
    // zawiera i update statusu, i wpis audytowy (nie dwie osobne transakcje).
    // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
    it('AC2 — jedna transakcja obejmuje update statusu ORAZ auditLog.create', async () => {
      await cfg.call(VALID_INPUT);

      expect(transactionMock).toHaveBeenCalledTimes(1);
      expect(txLeadUpdateMock).toHaveBeenCalledTimes(1);
      expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
    });

    // AC2 — kolejność: update statusu PRZED wpisem audytowym (ten sam wzorzec co DELETE).
    // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
    it('AC2 — update statusu wywołany PRZED auditLog.create, w tej samej transakcji', async () => {
      await cfg.call(VALID_INPUT);

      // Asercje jawne na WYWOŁANIE obu mocków najpierw — inaczej porównanie
      // `invocationCallOrder` poniżej rzuca TypeError na `undefined` zamiast czytelnego
      // niepowodzenia, gdy `auditLog.create` jeszcze nie istnieje (dzisiejszy RED).
      expect(txLeadUpdateMock).toHaveBeenCalledTimes(1);
      expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);

      expect(txLeadUpdateMock.mock.invocationCallOrder[0]).toBeLessThan(
        txAuditLogCreateMock.mock.invocationCallOrder[0],
      );
    });

    // AC2 — błąd wpisu audytowego cofa całą transakcję: status NIE jest zmieniony
    // (dowód pośredni na mocku: revalidatePath, efekt POZA transakcją, nie jest wołane).
    // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
    it('AC2 — błąd auditLog.create → transakcja odrzucona, wynik porażka, revalidatePath nie wołane', async () => {
      txAuditLogCreateMock.mockRejectedValue(new Error('CHECK constraint violation'));

      const result = await cfg.call(VALID_INPUT);

      expect(result.success).toBe(false);
      expect(revalidatePathMock).not.toHaveBeenCalled();
    });

    // AC2 — odwrotny kierunek: błąd update statusu → auditLog.create NIGDY nie zostaje wywołane.
    // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
    it('AC2 — błąd update statusu → auditLog.create nie zostaje wywołane, wynik porażka', async () => {
      txLeadUpdateMock.mockRejectedValue(new Error('DB error'));

      const result = await cfg.call(VALID_INPUT);

      expect(result.success).toBe(false);
      expect(txAuditLogCreateMock).not.toHaveBeenCalled();
    });

    // AC9 — idempotencja/no-op: drugie wywołanie na leadzie, który już opuścił
    // QUOTE_REJECTED (bo pierwsze wywołanie się powiodło), jest odrzucone i NIE tworzy
    // drugiego wpisu audytowego. Obie funkcje mają dziś strażnika `status !== 'QUOTE_REJECTED'`
    // — ten test dowodzi, że strażnik przetrwa dołożenie audytu i że odmowa nie loguje.
    // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
    it('AC9 — drugie wywołanie na leadzie, który opuścił bucket, nie tworzy drugiego wpisu audytowego', async () => {
      txLeadFindUniqueMock
        .mockResolvedValueOnce(coldLead())
        .mockResolvedValueOnce(coldLead({ status: cfg.targetStatus }));

      const first = await cfg.call(VALID_INPUT);
      const second = await cfg.call(VALID_INPUT);

      expect(first.success).toBe(true);
      expect(second.success).toBe(false);
      expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
    });

    // AC8 — współbieżność: dwa wywołania "równoległe" na tym samym leadzie: pierwsze
    // wygrywa i widzi QUOTE_REJECTED, drugie startuje z tym samym odczytem początkowym,
    // ale MUSI zakończyć się co najwyżej jednym sukcesem i co najwyżej jednym wpisem —
    // dowód na poziomie mocka, że kod NIE zakłada wyłączności odczyt-przed-zapisem w JS
    // (pułapka nr 4, CLAUDE.md); rozstrzygnięcie o serializacji żywej bazy zostaje
    // integracyjnej warstwie testów, tu dowodzimy wyłącznie że wynik jest spójny z
    // dokładnie jedną faktyczną zmianą, gdy drugi odczyt (symulujący FOR UPDATE / drugi
    // start transakcji) widzi już zmieniony rekord.
    // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
    it('AC8 — dwa równoległe wywołania na tym samym leadzie kończą się dokładnie jednym sukcesem i jednym wpisem', async () => {
      txLeadFindUniqueMock
        .mockResolvedValueOnce(coldLead())
        .mockResolvedValueOnce(coldLead({ status: cfg.targetStatus }));

      const [first, second] = await Promise.all([cfg.call(VALID_INPUT), cfg.call(VALID_INPUT)]);

      const successes = [first, second].filter((r) => r.success);
      expect(successes).toHaveLength(1);
      expect(txAuditLogCreateMock).toHaveBeenCalledTimes(1);
    });

    // Przypadek pusty: lead nieistniejący (findUnique zwraca null) — odmowa domenowa,
    // zero wpisu audytowego.
    // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
    it('lead nieistniejący (findUnique null) odrzucony bez wpisu audytowego', async () => {
      txLeadFindUniqueMock.mockResolvedValue(null);

      const result = await cfg.call(VALID_INPUT);

      expect(result.success).toBe(false);
      expect(txLeadUpdateMock).not.toHaveBeenCalled();
      expect(txAuditLogCreateMock).not.toHaveBeenCalled();
    });

    // Kontrola pozytywna: każda wartość z AUDIT_REQUIREMENTS.legalBases jest dozwolona.
    // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
    it.each(AUDIT_REQUIREMENTS.legalBases)('legalBasis %s (z kontraktu) jest dozwolony', async (basis) => {
      const result = await cfg.call({ justification: VALID_JUSTIFICATION, legalBasis: basis });

      expect(result.success).toBe(true);
    });
  });
}

/**
 * Pola BIZNESOWE (`reason`/`note` dla archiveLost, `resolution`/`newPrice` dla
 * returnToFunnel) zostają NIEZALEŻNE od `input.justification`/`input.legalBasis` — WO
 * rozróżnia je wprost jako "słownik analityczny, cel biznesowy ≠ audytowy". Ten blok
 * dowodzi, że dodanie audytu NIE zjada dotychczasowej walidacji biznesowej: brak
 * poprawnego `reason`/`resolution` jest odrzucony NIEZALEŻNIE od tego, czy `input` jest
 * poprawny, i odwrotnie.
 */
describe('archiveLost / returnToFunnel — pola biznesowe pozostają niezależne od input (SEC-AUDIT-LOG-MANUAL-STATUS)', () => {
  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('archiveLost — reason spoza słownika LOST_REASONS odrzucony mimo poprawnego input', async () => {
    const result = await archiveLost(LEAD_ID, 'NIE_MA_TAKIEGO_POWODU', undefined, VALID_INPUT);

    expect(result.success).toBe(false);
    expect(txLeadUpdateMock).not.toHaveBeenCalled();
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });

  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('archiveLost — reason poprawny, ale input niepoprawny (justification za krótki), odrzucony', async () => {
    const result = await archiveLost(LEAD_ID, VALID_LOST_REASON, undefined, {
      justification: 'za krotko',
      legalBasis: VALID_BASIS,
    });

    expect(result.success).toBe(false);
    expect(txLeadUpdateMock).not.toHaveBeenCalled();
  });

  // @REQ: SEC-AUDIT-LOG-MANUAL-STATUS
  it('returnToFunnel — wycena przeterminowana bez resolution odrzucona mimo poprawnego input', async () => {
    txLeadFindUniqueMock.mockResolvedValue(
      coldLead({ quoted_at: daysAgo(365) }),
    );

    const result = await returnToFunnel(LEAD_ID, undefined, undefined, VALID_INPUT);

    expect(result.success).toBe(false);
    expect(txLeadUpdateMock).not.toHaveBeenCalled();
    expect(txAuditLogCreateMock).not.toHaveBeenCalled();
  });
});
