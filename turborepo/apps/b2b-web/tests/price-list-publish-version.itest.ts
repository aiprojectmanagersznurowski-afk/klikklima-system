import { describe, it, expect, afterEach, beforeAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@repo/database';

/**
 * WO: docs/workorders/PRICE-LIST-IMPORT.md — PRICE-LIST-SCHEMA AC-S5 i przypadek brzegowy
 * "Współbieżność publikacji ceny".
 *
 * `publishPriceVersion` NIE ISTNIEJE jeszcze (WO, "Brakuje": "Katalogu
 * apps/b2b-web/src/lib/pricing/ (własność B2) — nie istnieje"). Nazwa funkcji jest wzięta
 * literalnie z WO ("funkcją domenową (`publishPriceVersion` albo równoważna nazwa, wspólna
 * dla importu i P2)") i z lokalizacji wskazanej w sekcji "Kolejność ról"
 * (`apps/b2b-web/src/lib/pricing/`). Plik wydzielony z `price-list-schema.itest.ts` CELOWO:
 * `await import(...)` poniżej crashuje CAŁY plik do czasu, aż `implementer-server` dowiezie
 * moduł — to jest właściwy powód RED (brak eksportu funkcji domenowej), nie błąd składni czy
 * literówka w ścieżce. Testy czysto DB-CHECK z drugiego pliku nie mogą dzielić z tym losu.
 *
 * Kolejność transakcji wymuszona przez WO (przypadek brzegowy): "najpierw zdjęcie is_current
 * ze starej, potem wstawienie nowej" — to jest kontrakt implementacyjny, nie tylko
 * obserwacja; test dowodzi WYNIKU (dokładnie jedna wersja is_current, przegrany dostaje błąd
 * domenowy), nie zagląda do wnętrza transakcji.
 *
 * Konwencja repo (`create-booking-concurrency.itest.ts`, D-2): `*.itest.ts` -> żywy Postgres,
 * `npm run test:integration`. Środowisko piaskownicy tego agenta NIE MA Dockera (pamięć
 * `project_itest_no_docker_sandbox`) — plik zweryfikowany przez `tsc --noEmit` i przegląd,
 * nie wykonany na żywo w tej sesji.
 */

let createdItemIds: string[] = [];

async function createTestItem(scope = 'ROOM'): Promise<{ id: string }> {
  const item = await prisma.priceListItem.create({
    data: { name: `ITEST PRICE-LIST-SCHEMA AC-S5 ${randomUUID()}`, unit: 'szt', scope },
  });
  createdItemIds.push(item.id);
  return item;
}

afterEach(async () => {
  if (createdItemIds.length > 0) {
    await prisma.priceListItemVersion.deleteMany({ where: { priceListItemId: { in: createdItemIds } } });
    await prisma.priceListItem.deleteMany({ where: { id: { in: createdItemIds } } });
  }
  createdItemIds = [];
});

// Import dynamiczny na poziomie modułu (wzorzec `create-booking-concurrency.itest.ts`) —
// jeśli modułu nie ma, CAŁY ten plik ma się nie skolekcjonować. To jest zamierzony RED.
const { publishPriceVersion } = await import('../src/lib/pricing/price-list');

describe('publishPriceVersion — AC-S5 (nowa wersja nie nadpisuje starej)', () => {
  // @REQ: PRICE-LIST-SCHEMA
  it('AC-S5 — publikacja nowej ceny zostawia starą wersję nietkniętą (is_current=false, kwoty niezmienione), nowa ma is_current=true i valid_from >= chwili wywołania', async () => {
    const item = await createTestItem();
    const before = await prisma.priceListItemVersion.create({
      data: { priceListItemId: item.id, salePriceNet: 100, crewCostNet: 10, isCurrent: true },
    });

    const callTime = new Date();
    const result = await publishPriceVersion({
      priceListItemId: item.id,
      salePriceNet: 150,
      crewCostNet: 20,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');

    const rereadOld = await prisma.priceListItemVersion.findUnique({ where: { id: before.id } });
    expect(rereadOld?.isCurrent).toBe(false);
    expect(Number(rereadOld?.salePriceNet)).toBe(100);
    expect(Number(rereadOld?.crewCostNet)).toBe(10);

    const rereadNew = await prisma.priceListItemVersion.findUnique({ where: { id: result.version.id } });
    expect(rereadNew?.isCurrent).toBe(true);
    expect(Number(rereadNew?.salePriceNet)).toBe(150);
    expect(rereadNew?.validFrom.getTime()).toBeGreaterThanOrEqual(callTime.getTime());

    const currentRows = await prisma.priceListItemVersion.count({
      where: { priceListItemId: item.id, isCurrent: true },
    });
    expect(currentRows).toBe(1);
  });

  // @REQ: PRICE-LIST-SCHEMA
  it('AC-S5 — pierwsza publikacja na pozycji BEZ wersji tworzy jedyną wersję is_current=true', async () => {
    const item = await createTestItem();

    const result = await publishPriceVersion({ priceListItemId: item.id, salePriceNet: 100 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('unreachable');
    expect(result.version.isCurrent).toBe(true);

    const rows = await prisma.priceListItemVersion.findMany({ where: { priceListItemId: item.id } });
    expect(rows).toHaveLength(1);
  });

  // Przypadek brzegowy z WO: "Współbieżność publikacji ceny" — dwie RÓWNOLEGŁE publikacje
  // nowej ceny tej samej pozycji.
  // @REQ: PRICE-LIST-SCHEMA
  it(
    'współbieżność — dwie RÓWNOLEGŁE publikacje tej samej pozycji: dokładnie jedna is_current w bazie po zakończeniu, przegrany dostaje błąd DOMENOWY (nie surowy P2002/23505), pozycja nigdy nie zostaje bez wersji bieżącej',
    async () => {
      const item = await createTestItem();
      await publishPriceVersion({ priceListItemId: item.id, salePriceNet: 100 });

      const [resultA, resultB] = await Promise.all([
        publishPriceVersion({ priceListItemId: item.id, salePriceNet: 200 }),
        publishPriceVersion({ priceListItemId: item.id, salePriceNet: 300 }),
      ]);

      const outcomes = [resultA, resultB];
      const successes = outcomes.filter((r) => r.ok);
      const failures = outcomes.filter((r) => !r.ok);

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
      if (failures[0]!.ok) throw new Error('unreachable');
      // Błąd domenowy: kod rozpoznawalny przez wołającego, NIE surowy SQLSTATE ('23505')
      // ani kod Prisma ('P2002') przeciekający przez warstwę domenową.
      expect(failures[0]!.error.code).not.toBe('23505');
      expect(failures[0]!.error.code).not.toBe('P2002');
      expect(typeof failures[0]!.error.code).toBe('string');
      expect(failures[0]!.error.code.length).toBeGreaterThan(0);

      const currentRows = await prisma.priceListItemVersion.count({
        where: { priceListItemId: item.id, isCurrent: true },
      });
      expect(currentRows).toBe(1);
    },
    30000,
  );
});
