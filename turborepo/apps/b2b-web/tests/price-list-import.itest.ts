import { describe, it, expect, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { prisma } from '@repo/database';

/**
 * WO: docs/workorders/PRICE-LIST-IMPORT.md — PRICE-LIST-IMPORT, AC-I1…AC-I5 + przypadki
 * brzegowe ("Import atomowy...", "Wiersz z nieznaną jednostką...", "Kwota nieparsowalna...",
 * "Pole z przecinkiem...", "Ponowny import nie nadpisuje metadanych...", "Kwoty nie
 * przechodzą przez number...").
 *
 * `importPriceList` NIE ISTNIEJE jeszcze (WO, "Brakuje": "Jakiejkolwiek funkcji czytającej
 * lub piszącej price_list_items — grep po priceListItem w apps/ zwraca zero wyników").
 * Sygnatura i nazwa są WYMYŚLONE przez test-authora (WO nie podaje ich wprost, w
 * odróżnieniu od `publishPriceVersion`) — `implementer-server` MUSI dopasować się do tego,
 * co ten plik importuje, albo zgłosić TEST-DEFECT, jeśli uzna nazwę/sygnaturę za błędną.
 * `await import(...)` na poziomie modułu crashuje CAŁY plik, dopóki modułu nie ma — to jest
 * zamierzony RED (brak eksportu funkcji domenowej), nie błąd składni.
 *
 * AC-I1 czyta plik NAPRAWDĘ z repozytorium (`docs/architecture/cennik-robocizny.csv`), nie
 * kopię w fiksturze (WO: "liczba 35 z planu jest nieaktualna"). Test NIE ZAKŁADA pustej
 * bazy: zawęża swoje liczniki do wierszy, których `name` jest w zbiorze nazw z tego pliku
 * (odczytanych niezależnym, minimalnym parserem TEGO testu — nie przez `importPriceList`,
 * żeby nie dowodzić kryterium samym sobą), i czyści je w `afterEach`.
 *
 * Konwencja repo (`create-booking-concurrency.itest.ts`, D-2): `*.itest.ts` -> żywy Postgres,
 * `npm run test:integration`. Środowisko piaskownicy tego agenta NIE MA Dockera (pamięć
 * `project_itest_no_docker_sandbox`) — plik zweryfikowany przez `tsc --noEmit` i przegląd,
 * nie wykonany na żywo w tej sesji.
 */

const { importPriceList } = await import('../src/lib/pricing/price-list');

let createdItemNames: string[] = [];

function trackNames(names: string[]) {
  createdItemNames.push(...names);
}

afterEach(async () => {
  if (createdItemNames.length > 0) {
    const items = await prisma.priceListItem.findMany({ where: { name: { in: createdItemNames } } });
    const ids = items.map((i) => i.id);
    if (ids.length > 0) {
      await prisma.priceListItemVersion.deleteMany({ where: { priceListItemId: { in: ids } } });
      await prisma.priceListItem.deleteMany({ where: { id: { in: ids } } });
    }
  }
  createdItemNames = [];
});

/**
 * Parser MINIMALNY, wyłącznie do wydobycia `item_name` (druga kolumna) z realnego CSV,
 * żeby test mógł zawęzić liczniki bez zakładania pustej bazy. Bezpieczny dla tego pliku,
 * bo `item_name` (kolumna 2) nigdy nie jest cytowana ani nie zawiera przecinka — cytowane
 * jest wyłącznie `description` (kolumna 3), a kolumny PRZED cytowanym polem parsują się
 * poprawnie nawet naiwnym podziałem po przecinku.
 */
function extractItemNames(csvContent: string): string[] {
  const lines = csvContent.split('\n').filter((l) => l.trim().length > 0);
  return lines.slice(1).map((line) => line.split(',')[1]!.trim());
}

function realCsv(): string {
  return readFileSync(new URL('../../../docs/architecture/cennik-robocizny.csv', import.meta.url), 'utf-8');
}

const CSV_HEADER = 'category,item_name,description,unit,crew_cost_net,sale_price_net,scope';

function buildCsv(rows: string[][]): string {
  return [CSV_HEADER, ...rows.map((r) => r.join(','))].join('\n');
}

describe('importPriceList — AC-I1 (39 pozycji z realnego arkusza)', () => {
  // @REQ: PRICE-LIST-IMPORT
  it('AC-I1 — import docs/architecture/cennik-robocizny.csv daje dokładnie 39 pozycji, każda z dokładnie jedną wersją is_current=true', async () => {
    const csv = realCsv();
    const names = extractItemNames(csv);
    expect(names).toHaveLength(39);
    trackNames(names);

    await importPriceList(csv);

    const items = await prisma.priceListItem.findMany({ where: { name: { in: names } } });
    expect(items).toHaveLength(39);

    const itemIds = items.map((i) => i.id);
    const currentVersions = await prisma.priceListItemVersion.count({
      where: { priceListItemId: { in: itemIds }, isCurrent: true },
    });
    expect(currentVersions).toBe(39);

    const totalVersions = await prisma.priceListItemVersion.count({
      where: { priceListItemId: { in: itemIds } },
    });
    expect(totalVersions).toBe(39);
  });
});

describe('importPriceList — AC-I2 (mapowanie kategorii PL -> EN)', () => {
  // @REQ: PRICE-LIST-IMPORT
  it.each([
    ['Materiał', 'MATERIAL'],
    ['Robocizna', 'LABOR'],
    ['Robocizno-materiał', 'MATERIAL_LABOR'],
    ['Robocizno-Materiał', 'MATERIAL_LABOR'],
    ['MR', 'MATERIAL_LABOR'],
    ['RM', 'MATERIAL_LABOR'],
    [' materiał ', 'MATERIAL'],
  ])('AC-I2 — kategoria arkusza %s mapuje się na %s', async (sourceCategory, expectedCategory) => {
    const name = `ITEST AC-I2 ${randomUUID()}`;
    trackNames([name]);
    const csv = buildCsv([[sourceCategory, name, 'opis testowy', 'szt', '10.00', '20.00', 'ROOM']]);

    await importPriceList(csv);

    const item = await prisma.priceListItem.findUnique({ where: { name } });
    expect(item?.category).toBe(expectedCategory);
  });
});

describe('importPriceList — AC-I3 (jawny brak wartości, nie zero)', () => {
  // @REQ: PRICE-LIST-IMPORT
  it("AC-I3 — 'podłączenie ściennej' importuje się z crew_cost_net = NULL, nie 0", async () => {
    const csv = realCsv();
    trackNames(extractItemNames(csv));

    await importPriceList(csv);

    const item = await prisma.priceListItem.findUnique({
      where: { name: 'podłączenie ściennej' },
      include: { versions: { where: { isCurrent: true } } },
    });
    expect(item).not.toBeNull();
    expect(item?.versions[0]?.crewCostNet).toBeNull();
  });

  // @REQ: PRICE-LIST-IMPORT
  it("AC-I3 — 'jedn zew stoi na stojaku' importuje się z category = NULL i description = NULL", async () => {
    const csv = realCsv();
    trackNames(extractItemNames(csv));

    await importPriceList(csv);

    const item = await prisma.priceListItem.findUnique({ where: { name: 'jedn zew stoi na stojaku' } });
    expect(item).not.toBeNull();
    expect(item?.category).toBeNull();
    expect(item?.description).toBeNull();
  });

  // @REQ: PRICE-LIST-IMPORT
  it('AC-I3 — po imporcie realnego arkusza dokładnie 13 pozycji ma crew_cost_net IS NULL, żadna nie ma 0', async () => {
    const csv = realCsv();
    const names = extractItemNames(csv);
    trackNames(names);

    await importPriceList(csv);

    const items = await prisma.priceListItem.findMany({
      where: { name: { in: names } },
      include: { versions: { where: { isCurrent: true } } },
    });
    const nullCrewCost = items.filter((i) => i.versions[0]?.crewCostNet === null);
    expect(nullCrewCost).toHaveLength(13);
    const zeroCrewCost = items.filter((i) => i.versions[0] && Number(i.versions[0].crewCostNet) === 0);
    expect(zeroCrewCost).toHaveLength(0);
  });

  // @REQ: PRICE-LIST-IMPORT
  it('AC-I3 — po imporcie realnego arkusza dokładnie 5 pozycji ma category IS NULL i description IS NULL', async () => {
    const csv = realCsv();
    const names = extractItemNames(csv);
    trackNames(names);

    await importPriceList(csv);

    const items = await prisma.priceListItem.findMany({ where: { name: { in: names } } });
    const noCategory = items.filter((i) => i.category === null);
    expect(noCategory).toHaveLength(5);
    expect(noCategory.every((i) => i.description === null)).toBe(true);
  });
});

describe('importPriceList — AC-I4 (zasięg ROOM/INSTALLATION, wiersz bez scope pominięty)', () => {
  // @REQ: PRICE-LIST-IMPORT
  it('AC-I4 — po imporcie realnego arkusza 23 pozycje ROOM i 16 INSTALLATION', async () => {
    const csv = realCsv();
    const names = extractItemNames(csv);
    trackNames(names);

    await importPriceList(csv);

    const items = await prisma.priceListItem.findMany({ where: { name: { in: names } } });
    expect(items.filter((i) => i.scope === 'ROOM')).toHaveLength(23);
    expect(items.filter((i) => i.scope === 'INSTALLATION')).toHaveLength(16);
  });

  // @REQ: PRICE-LIST-IMPORT
  it('AC-I4 — wiersz bez wartości scope NIE tworzy pozycji i jest zwrócony w raporcie jako pominięty z przyczyną; pozostałe wiersze tego samego pliku importują się', async () => {
    const skippedName = `ITEST AC-I4-NO-SCOPE ${randomUUID()}`;
    const okName = `ITEST AC-I4-OK ${randomUUID()}`;
    trackNames([skippedName, okName]);
    const csv = buildCsv([
      ['Materiał', skippedName, 'opis', 'szt', '10.00', '20.00', ''],
      ['Materiał', okName, 'opis', 'szt', '10.00', '20.00', 'ROOM'],
    ]);

    const report = await importPriceList(csv);

    const skippedItem = await prisma.priceListItem.findUnique({ where: { name: skippedName } });
    expect(skippedItem).toBeNull();
    const okItem = await prisma.priceListItem.findUnique({ where: { name: okName } });
    expect(okItem).not.toBeNull();

    const skippedEntry = report.skipped.find((s: { name: string; reason: string }) => s.name === skippedName);
    expect(skippedEntry).toBeDefined();
    expect(skippedEntry?.reason).toBeTruthy();
  });
});

describe('importPriceList — AC-I5 (idempotencja)', () => {
  // @REQ: PRICE-LIST-IMPORT
  it('AC-I5 — drugi import tego samego pliku nie tworzy żadnej pozycji ani wersji', async () => {
    const csv = realCsv();
    const names = extractItemNames(csv);
    trackNames(names);

    await importPriceList(csv);
    const itemsAfterFirst = await prisma.priceListItem.count({ where: { name: { in: names } } });
    const versionsAfterFirst = await prisma.priceListItemVersion.count({
      where: { priceListItem: { name: { in: names } } },
    });

    await importPriceList(csv);
    const itemsAfterSecond = await prisma.priceListItem.count({ where: { name: { in: names } } });
    const versionsAfterSecond = await prisma.priceListItemVersion.count({
      where: { priceListItem: { name: { in: names } } },
    });

    expect(itemsAfterSecond).toBe(itemsAfterFirst);
    expect(versionsAfterSecond).toBe(versionsAfterFirst);
  });

  // @REQ: PRICE-LIST-IMPORT
  it('AC-I5 — import pliku ze zmienioną sale_price_net JEDNEJ pozycji tworzy JEDNĄ nową wersję tej pozycji, poprzednia zostaje nietknięta, pozostałe 38 pozycji bez nowych wersji', async () => {
    const csv = realCsv();
    const names = extractItemNames(csv);
    trackNames(names);
    await importPriceList(csv);

    const targetName = 'jedn zew stoi na podstawach kauczukowych';
    const before = await prisma.priceListItem.findUnique({
      where: { name: targetName },
      include: { versions: { where: { isCurrent: true } } },
    });
    expect(before?.versions[0]).toBeDefined();
    const oldVersionId = before!.versions[0]!.id;

    const lines = csv.split('\n');
    const targetLineIndex = lines.findIndex((l) => l.includes(`,${targetName},`));
    expect(targetLineIndex).toBeGreaterThan(-1);
    // Zamiana WYŁĄCZNIE w tej jednej, już wyizolowanej linii: wartość `120.00` powtarza się
    // też w innych wierszach pliku, ale podmiana dotyczy linii znalezionej po unikalnej nazwie.
    lines[targetLineIndex] = lines[targetLineIndex]!.replace(',120.00,INSTALLATION', ',125.00,INSTALLATION');
    const modifiedCsv = lines.join('\n');

    await importPriceList(modifiedCsv);

    const afterItems = await prisma.priceListItem.findMany({ where: { name: { in: names } } });
    expect(afterItems).toHaveLength(39);
    const itemIds = afterItems.map((i) => i.id);
    const totalVersionsAfter = await prisma.priceListItemVersion.count({ where: { priceListItemId: { in: itemIds } } });
    expect(totalVersionsAfter).toBe(40); // 39 + jedna nowa wersja tej jednej pozycji

    const oldVersionReread = await prisma.priceListItemVersion.findUnique({ where: { id: oldVersionId } });
    expect(oldVersionReread?.isCurrent).toBe(false);
    expect(Number(oldVersionReread?.salePriceNet)).toBe(120);

    const afterTarget = await prisma.priceListItem.findUnique({
      where: { name: targetName },
      include: { versions: { where: { isCurrent: true } } },
    });
    expect(Number(afterTarget?.versions[0]?.salePriceNet)).toBe(125);

    const otherNames = names.filter((n) => n !== targetName);
    const otherItems = await prisma.priceListItem.findMany({
      where: { name: { in: otherNames } },
      include: { versions: true },
    });
    expect(otherItems.every((i) => i.versions.length === 1)).toBe(true);
  });

  // @REQ: PRICE-LIST-IMPORT
  it("AC-I5 — import pliku, w którym crew_cost_net JEDNEJ pozycji zmienia się z pustego na liczbę, tworzy JEDNĄ nową wersję tej pozycji (WO AC-I5: \"albo crew_cost_net zmienione z pustego na liczbę\")", async () => {
    const csv = realCsv();
    const names = extractItemNames(csv);
    trackNames(names);
    await importPriceList(csv);

    // 'podłączenie ściennej' ma crew_cost_net puste w arkuszu realnym (AC-I3).
    const targetName = 'podłączenie ściennej';
    const before = await prisma.priceListItem.findUnique({
      where: { name: targetName },
      include: { versions: { where: { isCurrent: true } } },
    });
    expect(before?.versions[0]).toBeDefined();
    expect(before?.versions[0]?.crewCostNet).toBeNull();
    const oldVersionId = before!.versions[0]!.id;

    const lines = csv.split('\n');
    const targetLineIndex = lines.findIndex((l) => l.includes(`,${targetName},`));
    expect(targetLineIndex).toBeGreaterThan(-1);
    // `description` tej pozycji jest CYTOWANY i ZAWIERA przecinki ("Montaż wspornika...") — split(',')
    // naiwny byłby błędny. Zamiast tego zamieniamy WYŁĄCZNIE ogon linii po zamykającym cudzysłowie
    // (`unit,crew_cost_net,sale_price_net,scope`, tu: `szt,,1000.00,ROOM`), który dla tej pozycji jest
    // unikalny — crew_cost_net (drugie pole ogona) jest puste między dwoma przecinkami.
    const originalTail = 'szt,,1000.00,ROOM';
    expect(lines[targetLineIndex]!.endsWith(originalTail)).toBe(true);
    lines[targetLineIndex] = lines[targetLineIndex]!.replace(originalTail, 'szt,15.00,1000.00,ROOM');
    const modifiedCsv = lines.join('\n');

    await importPriceList(modifiedCsv);

    const afterItems = await prisma.priceListItem.findMany({ where: { name: { in: names } } });
    expect(afterItems).toHaveLength(39);
    const itemIds = afterItems.map((i) => i.id);
    const totalVersionsAfter = await prisma.priceListItemVersion.count({ where: { priceListItemId: { in: itemIds } } });
    expect(totalVersionsAfter).toBe(40); // 39 + jedna nowa wersja tej jednej pozycji

    const oldVersionReread = await prisma.priceListItemVersion.findUnique({ where: { id: oldVersionId } });
    expect(oldVersionReread?.isCurrent).toBe(false);
    expect(oldVersionReread?.crewCostNet).toBeNull();

    const afterTarget = await prisma.priceListItem.findUnique({
      where: { name: targetName },
      include: { versions: { where: { isCurrent: true } } },
    });
    expect(afterTarget?.versions[0]?.crewCostNet?.toFixed(2)).toBe('15.00');

    const otherNames = names.filter((n) => n !== targetName);
    const otherItems = await prisma.priceListItem.findMany({
      where: { name: { in: otherNames } },
      include: { versions: true },
    });
    expect(otherItems.every((i) => i.versions.length === 1)).toBe(true);
  });
});

describe('importPriceList — przypadki brzegowe', () => {
  // @REQ: PRICE-LIST-IMPORT
  it('brzeg — jednostka nieznana (kg) pomija wiersz i zgłasza go w raporcie, bez wstawienia do bazy (CHECK wywróciłby cały import)', async () => {
    const name = `ITEST BRZEG-UNIT ${randomUUID()}`;
    trackNames([name]);
    const csv = buildCsv([['Materiał', name, 'opis', 'kg', '10.00', '20.00', 'ROOM']]);

    const report = await importPriceList(csv);

    const item = await prisma.priceListItem.findUnique({ where: { name } });
    expect(item).toBeNull();
    expect(report.skipped.some((s: { name: string; reason: string }) => s.name === name)).toBe(true);
  });

  // @REQ: PRICE-LIST-IMPORT
  it('brzeg — kategoria nieznana i niepusta (Usługa) pomija wiersz i zgłasza go w raporcie', async () => {
    const name = `ITEST BRZEG-CATEGORY ${randomUUID()}`;
    trackNames([name]);
    const csv = buildCsv([['Usługa', name, 'opis', 'szt', '10.00', '20.00', 'ROOM']]);

    const report = await importPriceList(csv);

    const item = await prisma.priceListItem.findUnique({ where: { name } });
    expect(item).toBeNull();
    expect(report.skipped.some((s: { name: string; reason: string }) => s.name === name)).toBe(true);
  });

  // @REQ: PRICE-LIST-IMPORT
  it.each(['12,50', '-5', 'abc', ''])(
    "brzeg — sale_price_net nieparsowalne albo ujemne albo puste ('%s') pomija wiersz",
    async (rawPrice) => {
      const name = `ITEST BRZEG-PRICE ${randomUUID()}`;
      trackNames([name]);
      const csv = buildCsv([['Materiał', name, 'opis', 'szt', '10.00', rawPrice, 'ROOM']]);

      const report = await importPriceList(csv);

      const item = await prisma.priceListItem.findUnique({ where: { name } });
      expect(item).toBeNull();
      expect(report.skipped.some((s: { name: string; reason: string }) => s.name === name)).toBe(true);
    },
  );

  // @REQ: PRICE-LIST-IMPORT
  it('brzeg — pole z przecinkiem w cudzysłowie wczytane w całości, bez obcięcia', async () => {
    const name = `ITEST BRZEG-QUOTE ${randomUUID()}`;
    trackNames([name]);
    const description = "Rura miedziana w otulinie 1/4', rura miedziana w otulinie 3/8', przewód sterujący 4x1m2";
    const csv = buildCsv([['Materiał', name, `"${description}"`, 'mb', '10.00', '20.00', 'ROOM']]);

    await importPriceList(csv);

    const item = await prisma.priceListItem.findUnique({ where: { name } });
    expect(item?.description).toBe(description);
  });

  // @REQ: PRICE-LIST-IMPORT
  it('brzeg — ponowny import nie nadpisuje description/category/unit/scope pozycji już istniejącej, różnica trafia do raportu jako ostrzeżenie', async () => {
    const name = `ITEST BRZEG-METADATA ${randomUUID()}`;
    trackNames([name]);
    await prisma.priceListItem.create({
      data: { name, unit: 'szt', category: 'MATERIAL', description: 'opis administratora', scope: 'ROOM' },
    });
    const csv = buildCsv([['Robocizna', name, 'opis z arkusza', 'mb', '10.00', '20.00', 'INSTALLATION']]);

    const report = await importPriceList(csv);

    const item = await prisma.priceListItem.findUnique({ where: { name } });
    expect(item?.unit).toBe('szt');
    expect(item?.category).toBe('MATERIAL');
    expect(item?.description).toBe('opis administratora');
    expect(item?.scope).toBe('ROOM');
    expect(report.metadataWarnings.some((w: { name: string; field: string }) => w.name === name)).toBe(true);
  });

  // @REQ: PRICE-LIST-IMPORT
  it('brzeg — pozycja nieaktywna nie jest reaktywowana importem', async () => {
    const name = `ITEST BRZEG-INACTIVE ${randomUUID()}`;
    trackNames([name]);
    await prisma.priceListItem.create({
      data: { name, unit: 'szt', scope: 'ROOM', isActive: false },
    });
    const csv = buildCsv([['Materiał', name, 'opis', 'szt', '10.00', '20.00', 'ROOM']]);

    await importPriceList(csv);

    const item = await prisma.priceListItem.findUnique({ where: { name } });
    expect(item?.isActive).toBe(false);
  });

  // @REQ: PRICE-LIST-IMPORT
  it('brzeg — kwota 130.00 zapisuje się jako 130.00, nie jako wynik zaokrąglenia zmiennoprzecinkowego', async () => {
    const name = `ITEST BRZEG-DECIMAL ${randomUUID()}`;
    trackNames([name]);
    const csv = buildCsv([['Materiał', name, 'opis', 'mb', '18.72', '130.00', 'ROOM']]);

    await importPriceList(csv);

    const item = await prisma.priceListItem.findUnique({
      where: { name },
      include: { versions: { where: { isCurrent: true } } },
    });
    // `decimal.js` (Prisma 6.19) obcina końcowe zera we `.toString()` (`Decimal('130.00').toString()
    // === '130'`), więc porównanie stringów z zerami końcowymi byłoby fałszywie czerwone. `.toFixed(2)`
    // wymusza dwa miejsca po przecinku niezależnie od reprezentacji wewnętrznej.
    expect(item?.versions[0]?.salePriceNet.toFixed(2)).toBe('130.00');
    expect(item?.versions[0]?.crewCostNet?.toFixed(2)).toBe('18.72');
  });

  // Przypadek pusty (WO, "Zawsze dopisujesz").
  // @REQ: PRICE-LIST-IMPORT
  it('przypadek pusty — plik z samym nagłówkiem, bez wierszy, nie tworzy żadnej pozycji i nie rzuca błędu', async () => {
    const csv = CSV_HEADER;

    const report = await importPriceList(csv);

    expect(report.skipped).toHaveLength(0);
    expect(report.createdItems).toBe(0);
  });

  // Import atomowy względem pozycji (WO): błąd zapisu W ŚRODKU importu jednej pozycji (nie błąd
  // walidacji — ten jest testowany osobno w "przypadkach brzegowych" wyżej i NIGDY nie dociera do
  // bazy) nie zostawia ani pozycji bez wersji, ani wersji bez is_current — pozycje poprawne z TEGO
  // SAMEGO pliku importują się kompletnie. Wiersz z jednostką `kg` (jak w poprzedniej wersji tego
  // testu) jest odrzucony NA WALIDACJI aplikacji, więc nigdy nie trafia do `$transaction` — nie
  // dowodzi atomowości transakcji, tylko filtrowania wejścia. Zamiast tego `sale_price_net` dostaje
  // wartość, która PRZECHODZI walidację aplikacji (parsowalna, nieujemna liczba), ale przekracza
  // precyzję kolumny `NUMERIC(12,2)` (`price_list_item_versions.sale_price_net`, migracja
  // `20260925090000_price_list_and_quotes.sql:108`, maks. 10 cyfr całkowitych + 2 po przecinku) —
  // Postgres odrzuca zapis realnym błędem `numeric field overflow` W TRAKCIE `$transaction`, po
  // stronie bazy, nie aplikacji.
  // @REQ: PRICE-LIST-IMPORT
  it('brzeg — import atomowy względem pozycji: błąd zapisu w bazie (przekroczenie precyzji NUMERIC) nie zostawia półzaimportowanej pozycji, poprawne wiersze tego samego pliku importują się w całości', async () => {
    const badName = `ITEST ATOMIC-BAD ${randomUUID()}`;
    const goodNameA = `ITEST ATOMIC-GOOD-A ${randomUUID()}`;
    const goodNameB = `ITEST ATOMIC-GOOD-B ${randomUUID()}`;
    trackNames([badName, goodNameA, goodNameB]);
    // '99999999999999.00' (14 cyfr całkowitych) parsuje się jako liczba dodatnia i przechodzi
    // każdą walidację aplikacyjną (skończona, nieujemna) — łamie WYŁĄCZNIE ograniczenie bazy.
    const csv = buildCsv([
      ['Materiał', goodNameA, 'opis', 'szt', '10.00', '20.00', 'ROOM'],
      ['Materiał', badName, 'opis', 'szt', '10.00', '99999999999999.00', 'ROOM'],
      ['Materiał', goodNameB, 'opis', 'szt', '10.00', '20.00', 'INSTALLATION'],
    ]);

    await importPriceList(csv);

    const badItem = await prisma.priceListItem.findUnique({
      where: { name: badName },
      include: { versions: true },
    });
    // Kryterium atomowości: albo pozycja wcale nie istnieje, albo istnieje BEZ żadnej wersji — nigdy
    // pozycja z wersją bez is_current, ani pozycja z wersją zapisaną błędną (przepełnioną) kwotą.
    expect(badItem === null || badItem.versions.length === 0).toBe(true);

    const goodItems = await prisma.priceListItem.findMany({
      where: { name: { in: [goodNameA, goodNameB] } },
      include: { versions: true },
    });
    expect(goodItems).toHaveLength(2);
    expect(goodItems.every((i) => i.versions.length === 1 && i.versions[0]!.isCurrent)).toBe(true);
  });
});
