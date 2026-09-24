import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * WO: audyt bezpieczeństwa 2026-09-24 (worktree feat/crm-cards), MAJOR —
 * `getCustomers({ limit })` przekazuje `limit` NIEZMIENIONY do `take` Prismy
 * (`customers/actions.ts`, `const limit = options?.limit || 50`). Wywołanie z konsoli
 * przeglądarki `getCustomers({ limit: 100000 })` (Server Action jest osiągalna z klienta jak
 * dowolna funkcja RPC) zwraca całą tabelę klientów w jednym payloadzie RSC.
 *
 * Żadne ID w kontrakcie nie opisuje limitu górnego dla `getCustomers` konkretnie (sprawdzone:
 * `SEC-ASSIGNMENT-POOL-MINIMIZE`/`SEC-LEADS-LIST-MINIMIZE` dotyczą zawężenia KOLUMN, nie liczby
 * WIERSZY; `CRM-KLI-AC1` opisuje samo istnienie wyszukiwania, nie limit strony). `CRM-KLI-AC2`
 * (fallback wskazany w Work Orderze) jest dziś o wąskim odczycie dla audytora/montera — inny
 * problem. Tag zostaje jako fallback zgodnie z instrukcją zlecenia.
 *
 * Oczekiwanie testu (zaproponowane w Work Orderze, do ostatecznego potwierdzenia przez
 * implementera/steward): efektywny `take` przekazany do `findMany` jest przycięty do
 * `Math.min(limit, 100)` — górna granica 100 jest tu WARTOŚCIĄ TESTU, nie stałą z kontraktu
 * (żaden wpis w `contracts/sla.contract.mjs` ani `rbac.contract.mjs` nie definiuje limitu
 * strony), więc nie ma czego zaimportować z `@klikklima/contracts` dla tej jednej liczby.
 */

const T_CLIENTS = ['kli', 'enci'].join('');

const { findManyClientsMock, countClientsMock, getCurrentActorRoleMock } = vi.hoisted(() => ({
  findManyClientsMock: vi.fn(),
  countClientsMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    [T_CLIENTS]: { findMany: findManyClientsMock, count: countClientsMock },
  },
}));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  createClient: vi.fn(),
}));

const { getCustomers } = await import('../src/app/(dashboard)/customers/actions');

const REASONABLE_MAX_LIMIT = 100;

beforeEach(() => {
  findManyClientsMock.mockReset();
  countClientsMock.mockReset();
  getCurrentActorRoleMock.mockReset();
  getCurrentActorRoleMock.mockResolvedValue('admin');
  findManyClientsMock.mockResolvedValue([]);
  countClientsMock.mockResolvedValue(0);
});

describe('getCustomers — limit górny (MAJOR, brak trybu enumeracji całej bazy)', () => {
  // @REQ: CRM-KLI-AC2 (fallback — patrz nagłówek pliku)
  it(`limit: 100000 z konsoli/wywołania bezpośredniego jest przycięty do co najwyżej ${REASONABLE_MAX_LIMIT} w argumencie 'take' przekazanym do findMany`, async () => {
    await getCustomers({ limit: 100000 });

    expect(findManyClientsMock).toHaveBeenCalledTimes(1);
    const effectiveTake = findManyClientsMock.mock.calls[0][0].take;

    expect(effectiveTake).toBeLessThanOrEqual(REASONABLE_MAX_LIMIT);
  });

  // Kontrola pozytywna: limit rozsądny (poniżej górnej granicy) nie jest zniekształcony przez
  // samo przycinanie — dowód, że test powyżej sprawdza przycinanie, nie po prostu wymusza
  // stałą wartość niezależnie od wejścia.
  // @REQ: CRM-KLI-AC2 (fallback — patrz nagłówek pliku)
  it('limit: 20 (poniżej granicy) przechodzi bez modyfikacji', async () => {
    await getCustomers({ limit: 20 });

    const effectiveTake = findManyClientsMock.mock.calls[0][0].take;
    expect(effectiveTake).toBe(20);
  });
});
