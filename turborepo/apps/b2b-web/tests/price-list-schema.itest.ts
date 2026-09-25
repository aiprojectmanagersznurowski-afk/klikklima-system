import { describe, it, expect, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@repo/database';
import { ROLES, can } from '@klikklima/contracts';

/**
 * WO: docs/workorders/PRICE-LIST-IMPORT.md — PRICE-LIST-SCHEMA, AC-S1/AC-S2/AC-S3/AC-S4/AC-S6.
 * AC-S5 (publishPriceVersion) żyje w dedykowanym pliku `price-list-publish-version.itest.ts`,
 * bo ta funkcja domenowa NIE ISTNIEJE jeszcze — top-level `await import(...)` tamtejszego
 * pliku musi crashować SAM plik, a nie ten (kryteria testowane tu wprost na Prismie muszą
 * pozostać kolekcjonowalne niezależnie od tego, czy warstwa domenowa już istnieje).
 *
 * WO (nagłówek sekcji PRICE-LIST-SCHEMA): "Te kryteria są już spełnione przez migrację
 * etapu 0. Testy mogą być zielone od pierwszego uruchomienia — to jest świadome: pinują
 * zachowanie bazy". Reviewer NIE traktuje braku fazy RED jako błędu dla TEGO pliku — dotyczy
 * to również AC-S6, bo `quote_items` żyje w TEJ SAMEJ migracji.
 *
 * Konwencja repo (`create-booking-concurrency.itest.ts`, D-2): `*.itest.ts` wymaga żywego
 * Postgresa (`supabase start`), uruchamiane `npm run test:integration` z katalogu repo.
 * Środowisko piaskownicy tego agenta NIE MA Dockera (pamięć `project_itest_no_docker_sandbox`)
 * — plik zweryfikowany przez `tsc --noEmit` i przegląd, NIE wykonany na żywo w tej sesji.
 *
 * Prisma omija RLS — te testy sprawdzają WYŁĄCZNIE ograniczenia CHECK/UNIQUE/FK bazy, nie RLS
 * (poza zakresem tego WO, patrz "Poza zakresem" w Work Orderze).
 */

let createdItemIds: string[] = [];
let createdLeadIds: string[] = [];
let createdQuoteVariantIds: string[] = [];

async function createTestItem(overrides: Partial<{
  name: string;
  description: string | null;
  unit: string;
  category: string | null;
  scope: string;
  isActive: boolean;
}> = {}): Promise<{ id: string; name: string }> {
  const suffix = randomUUID();
  const item = await prisma.priceListItem.create({
    data: {
      name: overrides.name ?? `ITEST PRICE-LIST-SCHEMA ${suffix}`,
      description: overrides.description ?? null,
      unit: overrides.unit ?? 'szt',
      category: overrides.category ?? null,
      scope: overrides.scope ?? 'ROOM',
      isActive: overrides.isActive ?? true,
    },
  });
  createdItemIds.push(item.id);
  return item;
}

async function createTestLead(): Promise<{ id: string }> {
  const lead = await prisma.leady.create({ data: {} });
  createdLeadIds.push(lead.id);
  return lead;
}

/** Buduje łańcuch quote -> quote_variant potrzebny do wpięcia quote_item (AC-S6). */
async function createTestQuoteVariant(): Promise<{ id: string; quoteId: string }> {
  const lead = await createTestLead();
  const quote = await prisma.quote.create({ data: { leadId: lead.id } });
  const variant = await prisma.quoteVariant.create({
    data: { quoteId: quote.id, variantNumber: 1 },
  });
  createdQuoteVariantIds.push(variant.id);
  return { id: variant.id, quoteId: quote.id };
}

afterEach(async () => {
  // Porządek FK: quote_items (RESTRICT na price_list_item*) -> quote_variants -> quotes
  // -> leady (CASCADE od leady na quotes) -> price_list_item_versions (CASCADE od
  // price_list_items) -> price_list_items.
  if (createdQuoteVariantIds.length > 0) {
    await prisma.quoteItem.deleteMany({ where: { quoteVariantId: { in: createdQuoteVariantIds } } });
    await prisma.quoteVariant.deleteMany({ where: { id: { in: createdQuoteVariantIds } } });
  }
  if (createdLeadIds.length > 0) {
    // CASCADE leady -> quotes -> quote_variants -> quote_items, więc to jest wystarczające
    // nawet dla wierszy, które ten plik utworzył poza `createTestQuoteVariant`.
    await prisma.leady.deleteMany({ where: { id: { in: createdLeadIds } } });
  }
  if (createdItemIds.length > 0) {
    await prisma.priceListItemVersion.deleteMany({ where: { priceListItemId: { in: createdItemIds } } });
    await prisma.priceListItem.deleteMany({ where: { id: { in: createdItemIds } } });
  }
  createdItemIds = [];
  createdLeadIds = [];
  createdQuoteVariantIds = [];
});

describe('price_list_item_versions — AC-S1 (crew_cost_net NULL != 0)', () => {
  // @REQ: PRICE-LIST-SCHEMA
  it('AC-S1 — crew_cost_net = NULL zapisuje się i odczyt zwraca NULL, nie 0', async () => {
    const item = await createTestItem();
    const version = await prisma.priceListItemVersion.create({
      data: {
        priceListItemId: item.id,
        crewCostNet: null,
        salePriceNet: 100,
        isCurrent: true,
      },
    });

    const reread = await prisma.priceListItemVersion.findUnique({ where: { id: version.id } });
    expect(reread?.crewCostNet).toBeNull();
    expect(Number(reread?.salePriceNet)).toBe(100);
  });

  // @REQ: PRICE-LIST-SCHEMA
  it('AC-S1 — crew_cost_net = 0 zapisuje się i odczyt zwraca 0, nie NULL', async () => {
    const item = await createTestItem();
    const version = await prisma.priceListItemVersion.create({
      data: {
        priceListItemId: item.id,
        crewCostNet: 0,
        salePriceNet: 100,
        isCurrent: true,
      },
    });

    const reread = await prisma.priceListItemVersion.findUnique({ where: { id: version.id } });
    expect(reread?.crewCostNet).not.toBeNull();
    expect(Number(reread?.crewCostNet)).toBe(0);
  });
});

describe('price_list_items.scope — AC-S2', () => {
  // @REQ: PRICE-LIST-SCHEMA
  it("AC-S2 — scope = 'ROOM_X' jest odrzucone przez price_list_items_scope_check", async () => {
    await expect(
      prisma.priceListItem.create({
        data: { name: `ITEST AC-S2 ${randomUUID()}`, unit: 'szt', scope: 'ROOM_X' },
      }),
    ).rejects.toThrow();
  });

  // @REQ: PRICE-LIST-SCHEMA
  it('AC-S2 — scope = NULL jest odrzucone (kolumna NOT NULL)', async () => {
    // `scope` jest polem wymaganym w typach klienta Prisma, więc dowód ograniczenia NOT NULL
    // na SAMEJ bazie idzie przez surowy SQL, nie przez `prisma.priceListItem.create()`.
    const name = `ITEST AC-S2-NULL ${randomUUID()}`;
    await expect(
      prisma.$executeRaw`INSERT INTO public.price_list_items (name, unit, scope) VALUES (${name}, 'szt', NULL)`,
    ).rejects.toThrow();
  });
});

describe('price_list_items.category — AC-S3', () => {
  // @REQ: PRICE-LIST-SCHEMA
  it("AC-S3 — category = 'Materiał' (wartość polska) jest odrzucona przez bazę", async () => {
    await expect(
      prisma.priceListItem.create({
        data: { name: `ITEST AC-S3-PL ${randomUUID()}`, unit: 'szt', scope: 'ROOM', category: 'Materiał' },
      }),
    ).rejects.toThrow();
  });

  // @REQ: PRICE-LIST-SCHEMA
  it('AC-S3 — category = NULL jest przyjęta', async () => {
    const item = await createTestItem({ category: null });
    expect(item.id).toBeTruthy();
  });

  // @REQ: PRICE-LIST-SCHEMA
  it.each(['MATERIAL', 'LABOR', 'MATERIAL_LABOR'])('AC-S3 — category = %s jest przyjęta', async (category) => {
    const item = await createTestItem({ category });
    const reread = await prisma.priceListItem.findUnique({ where: { id: item.id } });
    expect(reread?.category).toBe(category);
  });
});

describe('price_list_item_versions_current_per_item_key — AC-S4', () => {
  // @REQ: PRICE-LIST-SCHEMA
  it('AC-S4 — druga wersja is_current=true dla tej samej pozycji jest odrzucona (dwa kolejne INSERT-y)', async () => {
    const item = await createTestItem();
    await prisma.priceListItemVersion.create({
      data: { priceListItemId: item.id, salePriceNet: 100, isCurrent: true },
    });

    await expect(
      prisma.priceListItemVersion.create({
        data: { priceListItemId: item.id, salePriceNet: 120, isCurrent: true },
      }),
    ).rejects.toThrow();

    const currentRows = await prisma.priceListItemVersion.count({
      where: { priceListItemId: item.id, isCurrent: true },
    });
    expect(currentRows).toBe(1);
  });

  // @REQ: PRICE-LIST-SCHEMA
  it('AC-S4 — druga wersja is_current=true jest odrzucona także gdy powstaje przez UPDATE istniejącej wersji nieaktualnej (kolejność odwrotna)', async () => {
    const item = await createTestItem();
    const first = await prisma.priceListItemVersion.create({
      data: { priceListItemId: item.id, salePriceNet: 100, isCurrent: true },
    });
    const second = await prisma.priceListItemVersion.create({
      data: { priceListItemId: item.id, salePriceNet: 120, isCurrent: false },
    });

    await expect(
      prisma.priceListItemVersion.update({ where: { id: second.id }, data: { isCurrent: true } }),
    ).rejects.toThrow();

    const reread = await prisma.priceListItemVersion.findUnique({ where: { id: first.id } });
    expect(reread?.isCurrent).toBe(true);
  });
});

describe('price_list_items — AC-S6 (wycofanie, DELETE RESTRICT, RBAC)', () => {
  // @REQ: PRICE-LIST-SCHEMA
  it('AC-S6 — wycofanie pozycji ustawia is_active=false, wiersz i wersje zostają w bazie', async () => {
    const item = await createTestItem({ isActive: true });
    await prisma.priceListItemVersion.create({
      data: { priceListItemId: item.id, salePriceNet: 100, isCurrent: true },
    });

    await prisma.priceListItem.update({ where: { id: item.id }, data: { isActive: false } });

    const reread = await prisma.priceListItem.findUnique({ where: { id: item.id }, include: { versions: true } });
    expect(reread?.isActive).toBe(false);
    expect(reread?.versions).toHaveLength(1);
  });

  // @REQ: PRICE-LIST-SCHEMA
  it('AC-S6 — DELETE pozycji użytej w quote_items jest odrzucany (ON DELETE RESTRICT)', async () => {
    const item = await createTestItem({ scope: 'INSTALLATION' });
    const version = await prisma.priceListItemVersion.create({
      data: { priceListItemId: item.id, salePriceNet: 100, isCurrent: true },
    });
    const variant = await createTestQuoteVariant();
    await prisma.quoteItem.create({
      data: {
        quoteVariantId: variant.id,
        scope: 'INSTALLATION',
        priceListItemId: item.id,
        priceListItemVersionId: version.id,
        quantity: 1,
        unitPriceNet: 100,
      },
    });

    await expect(prisma.priceListItem.delete({ where: { id: item.id } })).rejects.toThrow();

    const stillThere = await prisma.priceListItem.findUnique({ where: { id: item.id } });
    expect(stillThere).not.toBeNull();
  });

  // Czysto kontraktowa część AC-S6 — nie wymaga bazy, ale żyje razem z resztą kryterium.
  // @REQ: PRICE-LIST-SCHEMA
  it.each(ROLES)("AC-S6 — can(%s, 'price_list_items', 'delete') zwraca 'no'", (role) => {
    expect(can(role, 'price_list_items', 'delete')).toBe('no');
  });
});
