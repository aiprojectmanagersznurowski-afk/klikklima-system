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
  //
  // TEST-DEFECT naprawiony (recenzja PR #9, CI job `integracja`): goły `Promise.all` na
  // dwóch wywołaniach `publishPriceVersion` NIE dowodzi tu niczego, w odróżnieniu od
  // `create-booking-concurrency.itest.ts` AC4/AC5 — tam PRZEGRANY ma naturalny mechanizm
  // odmowy nawet przy czysto SEKWENCYJNYM wykonaniu (jego własny pre-check
  // `findAvailableSlots` widzi już zajęty slot i odmawia, zanim dotrze do bazy).
  // `publishPriceVersion` nie ma takiego pre-checku: bezwarunkowo zdejmuje `is_current` ze
  // starej wersji i wstawia nową. Jeśli dwa wywołania wykonają się w PRAWDZIE sekwencyjnie
  // (drugie zaczyna się po pełnym COMMIT pierwszego), OBIE po prostu się udają — to jest
  // poprawne zachowanie „ostatni zapis wygrywa", nie wyścig, i `Promise.all` sam z siebie
  // NIE GWARANTUJE, że dwie transakcje SQL faktycznie nałożą się w czasie na Postgresie
  // (potwierdzone w CI: 2 sukcesy, 0 błędów). Dowód właściwości izolacji `Serializable`
  // wymaga WYMUSZENIA prawdziwego nakładania się dwóch transakcji — stąd blokada
  // `SELECT ... FOR UPDATE` na TYM SAMYM wierszu, który `updateMany` wewnątrz
  // `publishPriceVersion` też będzie chciał zmodyfikować, utrzymywana z ZEWNĄTRZ w osobnej
  // transakcji testu i zwalniana TYLKO PO tym, jak obie publikacje realnie zawisły na niej.
  // Nie dotyka `publishPriceVersion` — woła go dokładnie tak samo jak wcześniej, tylko
  // otacza jego wywołanie kontrolowaną blokadą.
  // @REQ: PRICE-LIST-SCHEMA
  it(
    'współbieżność — dwie RÓWNOLEGŁE publikacje tej samej pozycji, wymuszone do PRAWDZIWEGO nakładania się w czasie blokadą wiersza: dokładnie jedna is_current w bazie po zakończeniu, przegrany dostaje błąd DOMENOWY (nie surowy P2002/23505/40001), pozycja nigdy nie zostaje bez wersji bieżącej',
    async () => {
      const item = await createTestItem();
      await publishPriceVersion({ priceListItemId: item.id, salePriceNet: 100 });

      function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
        let resolveFn!: (value: T) => void;
        const promise = new Promise<T>((resolve) => {
          resolveFn = resolve;
        });
        return { promise, resolve: resolveFn };
      }

      const lockAcquired = deferred<void>();
      const releaseLock = deferred<void>();

      // Transakcja BLOKUJĄCA, kontrolowana przez test — trzyma zablokowany (`FOR UPDATE`)
      // dokładnie ten wiersz, który `updateMany` wewnątrz `publishPriceVersion` też próbuje
      // zmodyfikować (`WHERE price_list_item_id = ... AND is_current = true`). Obie
      // publikacje poniżej MUSZĄ na niej zawisnąć, zanim ją zwolnimy.
      const lockTxPromise = prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(
          'SELECT id FROM price_list_item_versions WHERE price_list_item_id = $1::uuid AND is_current = true FOR UPDATE',
          item.id,
        );
        lockAcquired.resolve();
        await releaseLock.promise;
      });

      await lockAcquired.promise;

      const publishA = publishPriceVersion({ priceListItemId: item.id, salePriceNet: 200 });
      const publishB = publishPriceVersion({ priceListItemId: item.id, salePriceNet: 300 });

      // Obie publikacje muszą realnie WYSŁAĆ swój UPDATE i zawisnąć na blokadzie wiersza
      // (żywy Postgres, nie atrapa) — 300ms to wielokrotność czasu potrzebnego na dwa
      // krótkie round-tripy do lokalnej bazy, zanim zwolnimy blokadę.
      await new Promise((resolve) => setTimeout(resolve, 300));

      releaseLock.resolve();
      await lockTxPromise;

      const [resultA, resultB] = await Promise.all([publishA, publishB]);

      const outcomes = [resultA, resultB];
      const successes = outcomes.filter((r) => r.ok);
      const failures = outcomes.filter((r) => !r.ok);

      expect(successes).toHaveLength(1);
      expect(failures).toHaveLength(1);
      if (failures[0]!.ok) throw new Error('unreachable');
      // Błąd domenowy: kod rozpoznawalny przez wołającego, NIE surowy SQLSTATE ('23505',
      // '40001' — porażka serializowalności, którą ta blokada teraz REALNIE wywołuje) ani
      // kod Prisma ('P2002') przeciekający przez warstwę domenową.
      expect(failures[0]!.error.code).not.toBe('23505');
      expect(failures[0]!.error.code).not.toBe('40001');
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
