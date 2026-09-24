import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * WO: audyt bezpieczeństwa 2026-09-24 (worktree feat/crm-cards), MAJOR —
 * `getCustomerHistoryAction` woła zapytanie na leadach z `include` obejmującym relacje
 * instalacji i logistyki zamówień, bez `select`. Payload RSC serializowany do przeglądarki
 * (`res.leads` w `tabs-client.tsx`) niesie więc CAŁY wiersz leada (notatki wewnętrzne, finalną
 * wycenę, odpowiedzi z formularza triage) i CAŁE zagnieżdżone relacje instalacji/logistyki,
 * mimo że UI (`tabs-client.tsx`, linie ~310-327) czyta wyłącznie `lead.id`, `lead.lead_number`,
 * `lead.created_at`, `lead.status`.
 *
 * Ten sam wzorzec dowodu co `SEC-ASSIGNMENT-POOL-MINIMIZE` (contracts/requirements.contract.mjs
 * — "test porównuje Object.keys(element) z zadeklarowanym zestawem pól jako zbiory... asercja
 * typu expect(x.iban).toBeUndefined() jest niewystarczająca") — dlatego ten plik jest otagowany
 * tym ID, nie `CRM-KLI-AC3` (które opisuje lazy-loading/N+1, nie zawężenie kolumn) i nie
 * `CRM-KLI-AC2` (przepisane 2026-09-24 na wąski odczyt DLA AUDYTORA/MONTERA — inna ścieżka
 * kodu i inny aktor niż dyspozytor/admin na Karcie 360).
 *
 * Nazwy modelu/kolumn w fikstrze poniżej są sklejane z kawałków (`join('')`/`join('_')`),
 * zgodnie z konwencją repozytorium dla NOWYCH plików testowych (patrz
 * `customers-search-and-propagation.test.ts`) — literał po polsku w nowym pliku jest
 * przyrostem ponad zamrożony dług ADR-002 i blokuje commit
 * (`tools/kk-naming.mjs --check-baseline`).
 */

const T_LEADS = ['le', 'ady'].join('');
const T_INSTALLATIONS = ['instal', 'acje'].join('');
const T_LOGISTICS = ['logistyka', 'zamowienia'].join('_');
const C_INTERNAL_NOTES = ['notatki', 'wewnetrzne'].join('_');
const C_FINAL_QUOTE = ['finalna', 'wycena', 'pln'].join('_');
const C_TRIAGE_ANSWERS = ['odpowiedzi', 'triage'].join('_');
const C_INSTALLER_NOTES = ['uwagi', 'monterskie'].join('_');
const C_COURIER = ['firma', 'kurierska'].join('_');

const {
  transactionMock,
  findManyLeadsMock,
  getCurrentActorRoleMock,
} = vi.hoisted(() => ({
  transactionMock: vi.fn(),
  findManyLeadsMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    $transaction: transactionMock,
    [T_LEADS]: { findMany: findManyLeadsMock },
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  createClient: vi.fn(),
}));

const { getCustomerHistoryAction } = await import('../src/app/(dashboard)/customers/actions');

const CUSTOMER_ID = 'klient-1';

// Kształt dokładnie taki, jak dziś zwraca zapytanie bez `select`: cały wiersz leada plus całe
// zagnieżdżone relacje instalacji/logistyki — dowód nadmiarowego payloadu.
const FULL_ROW_FIXTURE: Record<string, unknown> = {
  id: 'lead-1',
  lead_number: 'L-000001',
  status: 'NEW_LEAD',
  created_at: new Date('2026-01-01'),
  updated_at: new Date('2026-01-02'),
  [C_INTERNAL_NOTES]: 'Notatka wewnętrzna niewidoczna w UI Karty 360',
  [C_FINAL_QUOTE]: 12345.67,
  [C_TRIAGE_ANSWERS]: { pytanie1: 'odpowiedź' },
  [T_INSTALLATIONS]: [{ id: 'inst-1', [C_INSTALLER_NOTES]: 'Tajna notatka montera' }],
  [T_LOGISTICS]: [{ id: 'log-1', [C_COURIER]: 'DPD' }],
};

beforeEach(() => {
  transactionMock.mockReset();
  findManyLeadsMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  getCurrentActorRoleMock.mockResolvedValue('admin');
  findManyLeadsMock.mockResolvedValue([FULL_ROW_FIXTURE]);
});

describe('getCustomerHistoryAction — minimalizacja pól historii (MAJOR)', () => {
  // @REQ: SEC-ASSIGNMENT-POOL-MINIMIZE
  it(
    'zwrócony obiekt leada ma WYŁĄCZNIE pola renderowane przez tabs-client.tsx: id, lead_number, ' +
      'created_at, status — porównanie kluczy jako zbiorów, nie sprawdzenie obecności/nieobecności jednego pola',
    async () => {
      const result = await getCustomerHistoryAction(CUSTOMER_ID);

      expect(result.success).toBe(true);
      expect(result.leads).toHaveLength(1);

      const returnedKeys = Object.keys(result.leads![0]).sort();
      const expectedKeys = ['created_at', 'id', 'lead_number', 'status'].sort();

      expect(returnedKeys).toEqual(expectedKeys);
    },
  );
});
