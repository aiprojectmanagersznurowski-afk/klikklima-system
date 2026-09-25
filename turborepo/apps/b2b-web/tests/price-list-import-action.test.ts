import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PERMISSIONS, can, AUDIT_REQUIREMENTS } from '@klikklima/contracts';

/**
 * WO: docs/workorders/PRICE-LIST-IMPORT.md — PRICE-LIST-IMPORT AC-I6 (zależne od D-P1,
 * ROZSTRZYGNIĘTE = (A): Server Action w /settings/pricing przyjmująca plik CSV od
 * zalogowanego administratora).
 *
 * Server Action `importPriceListAction` NIE ISTNIEJE jeszcze (WO, "Kolejność ról":
 * `implementer-server` dowozi `apps/b2b-web/src/lib/pricing/` + Server Action w
 * `settings/pricing/actions.ts` PO tym pliku). Ścieżka i nazwa funkcji domenowej
 * `importPriceList` są WSPÓLNE z `price-list-import.itest.ts` (ten sam moduł
 * `../src/lib/pricing/price-list`) — implementer musi dowieźć JEDEN moduł spełniający
 * oba pliki testów, nie dwa równoległe.
 *
 * Wzorzec mockowania 1:1 z `auditors-delete.test.ts`: mockujemy WYŁĄCZNIE
 * `prisma.auditLog.create` (żadnego innego modelu — pisanie samych pozycji cennika
 * dzieje się wewnątrz zamockowanej funkcji domenowej `importPriceList`, nie w tym
 * pliku), `next/cache` (revalidatePath poza kontekstem zadania Next.js w vitest) i
 * `../src/utils/supabase/server` (`getCurrentActorRole`, `createClient`).
 *
 * Kształt raportu `importPriceList` uzgodniony z `price-list-import.itest.ts`:
 * `{ createdItems, createdVersions, updatedVersions, skipped, metadataWarnings,
 * priceChanges: { itemId, itemName, before, after }[] }` — `priceChanges` opisuje
 * WYŁĄCZNIE pozycje, którym import przypisał nową wersję ceny (AC-I5), z wartościami
 * przed i po (WO AC-I6: "uzasadnienie z wartością przed i po").
 *
 * DECYZJA CZŁOWIEKA (nieodwołalna, uzasadnienie: implementer wykazał, że jeden wpis
 * zbiorczy na koniec importu jest strukturalnie niekompatybilny z atomowością per-wiersz
 * — błąd w wierszu N nie może cofać dobrych wierszy 1..N-1, więc nie da się mieć jednej
 * transakcji na cały import ani czekać do końca z audytem): `audit_log` przechodzi z
 * modelu "jeden wpis zbiorczy po zakończeniu importu" na "jeden wpis audytowy PER
 * faktyczna zmiana (nowa pozycja LUB zmiana ceny), zapisany OD RAZU w swojej WŁASNEJ
 * `$transaction`". Na poziomie tej Server Action (gdzie `importPriceList` jest
 * zamockowane w całości — czarna skrzynka zwracająca gotowy raport) to oznacza: pętla po
 * "faktycznych zmianach" opisanych raportem (bulk-create jako jedna pozycja raportu, bo
 * report nie ma rozbicia per-item dla `createdItems`; plus jeden wpis per `priceChanges`)
 * wywołuje `prisma.$transaction` RAZ PER wpis — nie jedną transakcję obejmującą całą
 * pętlę. Wzorzec mockowania `$transaction` 1:1 z `auditors-delete.test.ts` /
 * `fld-base-location-edit-audit-log.test.ts`: `prisma` udostępnia WYŁĄCZNIE
 * `$transaction`, a `tx` przekazywany do callbacku ma `auditLog.create`.
 */

const {
  importPriceListMock,
  transactionMock,
  auditLogCreateMock,
  revalidatePathMock,
  getCurrentActorRoleMock,
  getUserMock,
  createClientMock,
} = vi.hoisted(() => ({
  importPriceListMock: vi.fn(),
  transactionMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
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
vi.mock('../src/lib/pricing/price-list', () => ({
  importPriceList: importPriceListMock,
}));

const { importPriceListAction } = await import('../src/app/(dashboard)/settings/pricing/actions');

const ADMIN_EMAIL = 'admin@klikklima.pl';
const CSV_CONTENT = 'category,item_name,description,unit,crew_cost_net,sale_price_net,scope\n';
const OTHER_LEGAL_BASIS = AUDIT_REQUIREMENTS.legalBases.at(-1);

const CREATE_ONLY_REPORT = {
  createdItems: 39,
  createdVersions: 39,
  updatedVersions: 0,
  skipped: [],
  metadataWarnings: [],
  priceChanges: [],
};

const PRICE_CHANGE_REPORT = {
  createdItems: 0,
  createdVersions: 0,
  updatedVersions: 1,
  skipped: [],
  metadataWarnings: [],
  priceChanges: [
    {
      itemId: 'item-1',
      itemName: 'jedn zew stoi na podstawach kauczukowych',
      before: { salePriceNet: 120, crewCostNet: 77 },
      after: { salePriceNet: 125, crewCostNet: 77 },
    },
  ],
};

describe('importPriceListAction — AC-I6, bramka roli (przed jakimkolwiek zapisem)', () => {
  beforeEach(() => {
    importPriceListMock.mockReset();
    transactionMock.mockReset();
    auditLogCreateMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getUserMock.mockReset();
    createClientMock.mockReset();

    getCurrentActorRoleMock.mockResolvedValue('admin');
    getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } });
    createClientMock.mockResolvedValue({ auth: { getUser: getUserMock } });
    auditLogCreateMock.mockResolvedValue({ id: 'audit-1' });
    transactionMock.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({ auditLog: { create: auditLogCreateMock } }),
    );
    importPriceListMock.mockResolvedValue(CREATE_ONLY_REPORT);
  });

  // @REQ: PRICE-LIST-IMPORT
  it.each(['dyspozytor', 'audytor', 'monter'] as const)(
    "AC-I6 — rola '%s' dostaje odmowę PRZED jakimkolwiek zapisem (zero wierszy: importPriceList i auditLog.create nie są wołane)",
    async (role) => {
      getCurrentActorRoleMock.mockResolvedValue(role);

      const result = await importPriceListAction(CSV_CONTENT);

      expect(result.success).toBe(false);
      expect(importPriceListMock).not.toHaveBeenCalled();
      expect(auditLogCreateMock).not.toHaveBeenCalled();
      expect(transactionMock).not.toHaveBeenCalled();
      expect(can(role, 'price_list_items', 'create')).toBe('no');
      // Whitelist całej macierzy, nie blacklista jednej roli — mutant rozszerzający
      // PERMISSIONS.price_list_items.create przechodziłby obok blacklisty tej jednej roli.
      expect(PERMISSIONS.price_list_items.create).toEqual(['admin']);
    },
  );

  // Fail-closed: brak sesji (getCurrentActorRole zwraca null) traktowany jak brak uprawnień.
  // @REQ: PRICE-LIST-IMPORT
  it('AC-I6 — brak sesji (getCurrentActorRole zwraca null) jest odrzucony fail-closed, zero zapisów', async () => {
    getCurrentActorRoleMock.mockResolvedValue(null);

    const result = await importPriceListAction(CSV_CONTENT);

    expect(result.success).toBe(false);
    expect(importPriceListMock).not.toHaveBeenCalled();
    expect(auditLogCreateMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  // Kontrola pozytywna — bez niej zestaw przechodziłby także dla akcji, która odrzuca
  // wszystkich, w tym admina.
  // @REQ: PRICE-LIST-IMPORT
  it('kontrola pozytywna — rola admin przechodzi bramkę i importPriceList jest wywołane', async () => {
    expect(can('admin', 'price_list_items', 'create')).toBe('yes');

    const result = await importPriceListAction(CSV_CONTENT);

    expect(result.success).toBe(true);
    // Wpisy audytowe dla NOWYCH POZYCJI są pisane wewnątrz zamockowanej
    // `importPriceList` — bez kontekstu prawdziwego aktora dostałyby domyślnego,
    // fałszywego autora (`system@klikklima.pl` / `system`) w `price-list.ts`.
    // AC-I6 wymaga prawdziwego aktora dla KAŻDEGO wpisu audytowego, nie tylko dla
    // zmian ceny dopisywanych osobno w tej Server Action.
    expect(importPriceListMock).toHaveBeenCalledWith(CSV_CONTENT, {
      actorEmail: ADMIN_EMAIL,
      actorRole: 'admin',
    });
  });

  // Sesja bez e-maila (np. `auth.getUser()` zwraca użytkownika bez pola `email`) łapie mutanta,
  // który dziś przeżywa: usunięcie `if (!actorEmail) return { success: false, ... }` w
  // `importPriceListAction` (`.../settings/pricing/actions.ts:61-63`). Rola admina przechodzi
  // bramkę RBAC, ale bez e-maila nie ma autora wpisu audytowego — zero zapisów, fail-closed.
  // @REQ: PRICE-LIST-IMPORT
  it('AC-I6 — sesja bez e-maila (auth.getUser() bez email) jest odrzucona PRZED zapisem, zero wywołań importPriceList i auditLog.create', async () => {
    getUserMock.mockResolvedValue({ data: { user: { email: undefined } } });

    const result = await importPriceListAction(CSV_CONTENT);

    expect(result.success).toBe(false);
    expect(importPriceListMock).not.toHaveBeenCalled();
    expect(auditLogCreateMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });

  // Wariant: `user` sam jest `null`/`undefined` (brak sesji Supabase), nie tylko brak `email`
  // na obiekcie użytkownika.
  // @REQ: PRICE-LIST-IMPORT
  it('AC-I6 — sesja bez użytkownika (auth.getUser() zwraca user: null) jest odrzucona PRZED zapisem, zero wywołań importPriceList i auditLog.create', async () => {
    getUserMock.mockResolvedValue({ data: { user: null } });

    const result = await importPriceListAction(CSV_CONTENT);

    expect(result.success).toBe(false);
    expect(importPriceListMock).not.toHaveBeenCalled();
    expect(auditLogCreateMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });
});

describe('importPriceListAction — AC-I6, ślad audytowy (rola admin)', () => {
  beforeEach(() => {
    importPriceListMock.mockReset();
    transactionMock.mockReset();
    auditLogCreateMock.mockReset();
    revalidatePathMock.mockReset();
    getCurrentActorRoleMock.mockReset();
    getUserMock.mockReset();
    createClientMock.mockReset();

    getCurrentActorRoleMock.mockResolvedValue('admin');
    getUserMock.mockResolvedValue({ data: { user: { email: ADMIN_EMAIL } } });
    createClientMock.mockResolvedValue({ auth: { getUser: getUserMock } });
    auditLogCreateMock.mockResolvedValue({ id: 'audit-1' });
    // Decyzja człowieka: każdy wpis audytowy dostaje WŁASNĄ `$transaction`, nie jedną
    // transakcję obejmującą całą pętlę zmian — dlatego callback przekazuje nowy obiekt tx
    // za każdym wywołaniem, a asercje niżej liczą `transactionMock.mock.calls.length`
    // osobno od `auditLogCreateMock`, żeby złapać mutanta, który zwinąłby N wpisów do
    // jednego wspólnego `$transaction`.
    transactionMock.mockImplementation(async (cb: (tx: unknown) => unknown) =>
      cb({ auditLog: { create: auditLogCreateMock } }),
    );
  });

  // @REQ: PRICE-LIST-IMPORT
  it('AC-I6 — utworzenie pozycji w pustej bazie zostawia JEDEN wpis zbiorczy, nie 39, we WŁASNEJ transakcji', async () => {
    importPriceListMock.mockResolvedValue(CREATE_ONLY_REPORT);

    await importPriceListAction(CSV_CONTENT);

    expect(auditLogCreateMock).toHaveBeenCalledTimes(1);
    expect(transactionMock).toHaveBeenCalledTimes(1);
    const call = auditLogCreateMock.mock.calls[0]![0];
    expect(call.data.operation).toBe('field_update');
    expect(call.data.resource).toBe('price_list_items');
    expect(call.data.actorEmail).toBe(ADMIN_EMAIL);
    expect(call.data.actorRole).toBe('admin');
    expect(call.data.legalBasis).toBe(OTHER_LEGAL_BASIS);
    expect(call.data.justification).toContain('39');
  });

  // @REQ: PRICE-LIST-IMPORT
  it('AC-I6 — zmiana ceny istniejącej pozycji zostawia wpis audit_log z record_id pozycji i wartościami przed/po, we WŁASNEJ transakcji', async () => {
    importPriceListMock.mockResolvedValue(PRICE_CHANGE_REPORT);

    await importPriceListAction(CSV_CONTENT);

    expect(auditLogCreateMock).toHaveBeenCalledTimes(1);
    expect(transactionMock).toHaveBeenCalledTimes(1);
    const call = auditLogCreateMock.mock.calls[0]![0];
    expect(call.data.operation).toBe('field_update');
    expect(call.data.resource).toBe('price_list_items');
    expect(call.data.recordId).toBe('item-1');
    // Asercja na SAM podciąg '120'/'125' przechodziłaby także dla kierunku odwróconego
    // (125 → 120), dla wpisu bez crew_cost_net, albo dla braku kosztu ekipy zapisanego jako
    // "0.00" — wymuszamy strzałkę kierunku, zgodną z `formatFieldChange`
    // (`apps/b2b-web/src/app/(dashboard)/settings/calendar/actions.ts:19`, `→`) i implementacją
    // `importPriceListAction` (`.../settings/pricing/actions.ts:90-94`).
    expect(call.data.justification).toMatch(/sale_price_net\s+120\.00\s*→\s*125\.00/);
    expect(call.data.justification).toMatch(/crew_cost_net\s+77\.00\s*→\s*77\.00/);
  });

  // @REQ: PRICE-LIST-IMPORT
  it('AC-I6 — zmiana crew_cost_net z pustego (NULL) na liczbę zapisuje "(brak)" jako wartość przed, nie "0.00"', async () => {
    importPriceListMock.mockResolvedValue({
      createdItems: 0,
      createdVersions: 0,
      updatedVersions: 1,
      skipped: [],
      metadataWarnings: [],
      priceChanges: [
        {
          itemId: 'item-3',
          itemName: 'podłączenie ściennej',
          before: { salePriceNet: 1000, crewCostNet: null },
          after: { salePriceNet: 1000, crewCostNet: 15 },
        },
      ],
    });

    await importPriceListAction(CSV_CONTENT);

    expect(auditLogCreateMock).toHaveBeenCalledTimes(1);
    expect(transactionMock).toHaveBeenCalledTimes(1);
    const call = auditLogCreateMock.mock.calls[0]![0];
    expect(call.data.recordId).toBe('item-3');
    expect(call.data.justification).toMatch(/crew_cost_net\s+\(brak\)\s*→\s*15\.00/);
  });

  // @REQ: PRICE-LIST-IMPORT
  it('AC-I6 — dwie pozycje ze zmianą ceny w jednym imporcie zostawiają DWA osobne wpisy audit_log, KAŻDY w OSOBNEJ transakcji (nie jedna transakcja na całą pętlę)', async () => {
    importPriceListMock.mockResolvedValue({
      ...PRICE_CHANGE_REPORT,
      updatedVersions: 2,
      priceChanges: [
        ...PRICE_CHANGE_REPORT.priceChanges,
        {
          itemId: 'item-2',
          itemName: 'jedn zew stoi na stelażu z profili',
          before: { salePriceNet: 350, crewCostNet: 150 },
          after: { salePriceNet: 400, crewCostNet: 150 },
        },
      ],
    });

    await importPriceListAction(CSV_CONTENT);

    expect(auditLogCreateMock).toHaveBeenCalledTimes(2);
    // Dwa wpisy audytowe muszą odpowiadać DWÓM wywołaniom `$transaction`, nie jednemu
    // wywołaniu obejmującemu obie zmiany — mutant, który opakowałby całą pętlę
    // `for (const change of report.priceChanges)` w jedno `$transaction` na zewnątrz,
    // przeżyłby asercję samego `auditLogCreateMock`, ale nie tę.
    expect(transactionMock).toHaveBeenCalledTimes(2);
    const recordIds = auditLogCreateMock.mock.calls.map((c) => c[0].data.recordId);
    expect(recordIds.sort()).toEqual(['item-1', 'item-2']);
  });

  // Przypadek pusty — import bez utworzonych pozycji i bez zmian cen NIE zostawia wpisu
  // audytowego (brak zmiany = brak wpisu, wzorzec `updateVisitDurationBasketAction`).
  // @REQ: PRICE-LIST-IMPORT
  it('przypadek pusty — import bez nowych pozycji i bez zmian cen nie tworzy wpisu audit_log', async () => {
    importPriceListMock.mockResolvedValue({
      createdItems: 0,
      createdVersions: 0,
      updatedVersions: 0,
      skipped: [],
      metadataWarnings: [],
      priceChanges: [],
    });

    const result = await importPriceListAction(CSV_CONTENT);

    expect(result.success).toBe(true);
    expect(auditLogCreateMock).not.toHaveBeenCalled();
    expect(transactionMock).not.toHaveBeenCalled();
  });
});
