import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getRoomCatalogItems,
  getGeneralCatalogItems,
  addQuoteRoom,
  deleteQuoteRoom,
  addQuoteCatalogItem,
  addQuoteManualItem,
  deleteQuoteItem,
  calculateVariantTotals,
} from '../src/lib/pricing/quote-rooms';

// @REQ: FLD-QUOTE-ROOMS
// @REQ: FLD-QUOTE-GENERAL-ITEMS
// @REQ: FLD-QUOTE-MANUAL-ITEM

const {
  quoteFindUniqueMock,
  quoteVariantFindUniqueMock,
  quoteVariantUpdateMock,
  quoteRoomFindUniqueMock,
  quoteRoomFindFirstMock,
  quoteRoomCreateMock,
  quoteRoomDeleteMock,
  quoteRoomDeleteManyMock,
  quoteItemFindUniqueMock,
  quoteItemFindManyMock,
  quoteItemCreateMock,
  quoteItemDeleteMock,
  quoteItemDeleteManyMock,
  priceListItemFindManyMock,
  priceListItemFindUniqueMock,
  priceListItemCreateMock,
  priceListItemVersionCreateMock,
} = vi.hoisted(() => ({
  quoteFindUniqueMock: vi.fn(),
  quoteVariantFindUniqueMock: vi.fn(),
  quoteVariantUpdateMock: vi.fn(),
  quoteRoomFindUniqueMock: vi.fn(),
  quoteRoomFindFirstMock: vi.fn(),
  quoteRoomCreateMock: vi.fn(),
  quoteRoomDeleteMock: vi.fn(),
  quoteRoomDeleteManyMock: vi.fn(),
  quoteItemFindUniqueMock: vi.fn(),
  quoteItemFindManyMock: vi.fn(),
  quoteItemCreateMock: vi.fn(),
  quoteItemDeleteMock: vi.fn(),
  quoteItemDeleteManyMock: vi.fn(),
  priceListItemFindManyMock: vi.fn(),
  priceListItemFindUniqueMock: vi.fn(),
  priceListItemCreateMock: vi.fn(),
  priceListItemVersionCreateMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    quote: {
      findUnique: quoteFindUniqueMock,
    },
    quoteVariant: {
      findUnique: quoteVariantFindUniqueMock,
      update: quoteVariantUpdateMock,
    },
    quoteRoom: {
      findUnique: quoteRoomFindUniqueMock,
      findFirst: quoteRoomFindFirstMock,
      create: quoteRoomCreateMock,
      delete: quoteRoomDeleteMock,
      deleteMany: quoteRoomDeleteManyMock,
    },
    quoteItem: {
      findUnique: quoteItemFindUniqueMock,
      findMany: quoteItemFindManyMock,
      create: quoteItemCreateMock,
      delete: quoteItemDeleteMock,
      deleteMany: quoteItemDeleteManyMock,
    },
    priceListItem: {
      findMany: priceListItemFindManyMock,
      findUnique: priceListItemFindUniqueMock,
      create: priceListItemCreateMock,
    },
    priceListItemVersion: {
      create: priceListItemVersionCreateMock,
    },
  },
}));

describe('FLD-QUOTE-ROOMS, FLD-QUOTE-GENERAL-ITEMS, FLD-QUOTE-MANUAL-ITEM — Zarządzanie szkicem wyceny', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const variantId = 'var-1';
  const quoteId = 'quote-1';
  const roomId = 'room-1';
  const itemRoomCatalogId = 'pli-room-1';
  const itemGeneralCatalogId = 'pli-general-1';

  const draftQuote = {
    id: quoteId,
    status: 'DRAFT',
    propertyKind: 'RESIDENTIAL_UP_TO_THRESHOLD',
    leadId: 'lead-1',
  };

  const draftVariant = {
    id: variantId,
    quoteId,
    variantNumber: 1,
    equipmentNetAmount: 10000,
    quote: draftQuote,
  };

  const activeRoomCatalogItem = {
    id: itemRoomCatalogId,
    name: 'instalacja freonowa 1/4 i 3/8',
    scope: 'ROOM',
    unit: 'MB',
    isActive: true,
    versions: [
      {
        id: 'ver-room-1',
        priceListItemId: itemRoomCatalogId,
        salePriceNet: 130.0,
        crewCostNet: 18.72,
        isCurrent: true,
      },
    ],
  };

  const activeGeneralCatalogItem = {
    id: itemGeneralCatalogId,
    name: 'uruchomienie',
    scope: 'INSTALLATION',
    unit: 'SZT',
    isActive: true,
    versions: [
      {
        id: 'ver-gen-1',
        priceListItemId: itemGeneralCatalogId,
        salePriceNet: 400.0,
        crewCostNet: 50.0,
        isCurrent: true,
      },
    ],
  };

  describe('FLD-QUOTE-ROOMS: Pomieszczenia i pozycje w pomieszczeniach', () => {
    it('AC-R1: getRoomCatalogItems zwraca wyłącznie aktywne pozycje ze scope ROOM', async () => {
      priceListItemFindManyMock.mockResolvedValueOnce([activeRoomCatalogItem]);

      const items = await getRoomCatalogItems();
      expect(items).toHaveLength(1);
      expect(items[0].scope).toBe('ROOM');
      expect(items[0].isActive).toBe(true);
      expect(priceListItemFindManyMock).toHaveBeenCalledWith({
        where: {
          scope: 'ROOM',
          isActive: true,
        },
        include: {
          versions: {
            where: { isCurrent: true },
          },
        },
        orderBy: { name: 'asc' },
      });
    });

    it('AC-R1: próba dodania pozycji INSTALLATION do pomieszczenia jest odrzucana błędem domenowym', async () => {
      quoteVariantFindUniqueMock.mockResolvedValueOnce(draftVariant);
      quoteRoomFindFirstMock.mockResolvedValueOnce({
        id: roomId,
        quoteVariantId: variantId,
      });
      priceListItemFindUniqueMock.mockResolvedValueOnce(activeGeneralCatalogItem);

      const result = await addQuoteCatalogItem({
        quoteVariantId: variantId,
        quoteRoomId: roomId,
        priceListItemId: itemGeneralCatalogId,
        quantity: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('nie może być przypisana do pomieszczenia');
      expect(quoteItemCreateMock).not.toHaveBeenCalled();
    });

    it('AC-R2: próba dodania pozycji ROOM bez wskazanego pomieszczenia jest odrzucana błędem domenowym', async () => {
      quoteVariantFindUniqueMock.mockResolvedValueOnce(draftVariant);
      priceListItemFindUniqueMock.mockResolvedValueOnce(activeRoomCatalogItem);

      const result = await addQuoteCatalogItem({
        quoteVariantId: variantId,
        quoteRoomId: null,
        priceListItemId: itemRoomCatalogId,
        quantity: 2,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('wymaga wskazania pomieszczenia');
      expect(quoteItemCreateMock).not.toHaveBeenCalled();
    });

    it('AC-R3: dodanie pomieszczenia wymaga niepustej nazwy i opcjonalnej mocy > 0', async () => {
      quoteVariantFindUniqueMock.mockResolvedValue(draftVariant);

      // Pusta nazwa
      const emptyNameResult = await addQuoteRoom({
        quoteVariantId: variantId,
        name: '   ',
        powerKw: 3.5,
      });
      expect(emptyNameResult.success).toBe(false);
      expect(emptyNameResult.error).toContain('Nazwa pomieszczenia nie może być pusta');

      // Nieprawidłowa moc <= 0
      const negativePowerResult = await addQuoteRoom({
        quoteVariantId: variantId,
        name: 'Salon',
        powerKw: -2.5,
      });
      expect(negativePowerResult.success).toBe(false);
      expect(negativePowerResult.error).toContain('Moc jednostki musi być większa od zera');

      // Prawidłowe dodanie
      quoteRoomCreateMock.mockResolvedValueOnce({
        id: 'new-room-1',
        quoteVariantId: variantId,
        name: 'Salon',
        powerKw: 3.5,
      });

      const successResult = await addQuoteRoom({
        quoteVariantId: variantId,
        name: '  Salon  ',
        powerKw: 3.5,
      });

      expect(successResult.success).toBe(true);
      expect(quoteRoomCreateMock).toHaveBeenCalledWith({
        data: {
          quoteVariantId: variantId,
          name: 'Salon',
          powerKw: 3.5,
        },
      });
    });

    it('AC-R3: próba dodania pozycji do pomieszczenia innego wariantu jest odrzucana (luka 2)', async () => {
      quoteVariantFindUniqueMock.mockResolvedValueOnce(draftVariant);
      quoteRoomFindFirstMock.mockResolvedValueOnce(null);

      const result = await addQuoteCatalogItem({
        quoteVariantId: variantId,
        quoteRoomId: 'foreign-room',
        priceListItemId: itemRoomCatalogId,
        quantity: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Wskazane pomieszczenie nie należy do tego wariantu oferty');
      expect(quoteItemCreateMock).not.toHaveBeenCalled();
    });

    it('AC-R4: usunięcie pomieszczenia usuwa powiązane pozycje (kaskada) i przelicza sumę wariantu', async () => {
      quoteRoomFindUniqueMock.mockResolvedValueOnce({
        id: roomId,
        quoteVariantId: variantId,
        quoteVariant: draftVariant,
      });
      quoteItemDeleteManyMock.mockResolvedValueOnce({ count: 2 });
      quoteRoomDeleteMock.mockResolvedValueOnce({ id: roomId });
      quoteItemFindManyMock.mockResolvedValueOnce([]); // brak innych pozycji

      const result = await deleteQuoteRoom({
        quoteRoomId: roomId,
      });

      expect(result.success).toBe(true);
      expect(quoteItemDeleteManyMock).toHaveBeenCalledWith({
        where: { quoteRoomId: roomId },
      });
      expect(quoteRoomDeleteMock).toHaveBeenCalledWith({
        where: { id: roomId },
      });
      expect(quoteVariantUpdateMock).toHaveBeenCalled();
    });

    it('AC-R5: ta sama pozycja cennikowa dodana do dwóch pomieszczeń daje dwa odrębne wpisy i poprawną sumę', async () => {
      quoteVariantFindUniqueMock.mockResolvedValue(draftVariant);
      quoteRoomFindFirstMock.mockResolvedValue({ id: roomId, quoteVariantId: variantId });
      priceListItemFindUniqueMock.mockResolvedValue(activeRoomCatalogItem);

      quoteItemCreateMock.mockResolvedValueOnce({
        id: 'item-1',
        quoteVariantId: variantId,
        quoteRoomId: roomId,
        priceListItemId: itemRoomCatalogId,
        priceListItemVersionId: 'ver-room-1',
        scope: 'ROOM',
        quantity: 3,
        unitPriceNet: 130.0,
      });

      const res1 = await addQuoteCatalogItem({
        quoteVariantId: variantId,
        quoteRoomId: roomId,
        priceListItemId: itemRoomCatalogId,
        quantity: 3,
      });
      expect(res1.success).toBe(true);

      quoteItemCreateMock.mockResolvedValueOnce({
        id: 'item-2',
        quoteVariantId: variantId,
        quoteRoomId: roomId,
        priceListItemId: itemRoomCatalogId,
        priceListItemVersionId: 'ver-room-1',
        scope: 'ROOM',
        quantity: 5,
        unitPriceNet: 130.0,
      });

      const res2 = await addQuoteCatalogItem({
        quoteVariantId: variantId,
        quoteRoomId: roomId,
        priceListItemId: itemRoomCatalogId,
        quantity: 5,
      });
      expect(res2.success).toBe(true);
      expect(quoteItemCreateMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('FLD-QUOTE-GENERAL-ITEMS: Pozycje ogólne instalacji', () => {
    it('AC-G1: getGeneralCatalogItems zwraca wyłącznie aktywne pozycje ze scope INSTALLATION', async () => {
      priceListItemFindManyMock.mockResolvedValueOnce([activeGeneralCatalogItem]);

      const items = await getGeneralCatalogItems();
      expect(items).toHaveLength(1);
      expect(items[0].scope).toBe('INSTALLATION');
      expect(items[0].isActive).toBe(true);
      expect(priceListItemFindManyMock).toHaveBeenCalledWith({
        where: {
          scope: 'INSTALLATION',
          isActive: true,
        },
        include: {
          versions: {
            where: { isCurrent: true },
          },
        },
        orderBy: { name: 'asc' },
      });
    });

    it('AC-G2: pozycja INSTALLATION z podanym pomieszczeniem jest odrzucana', async () => {
      quoteVariantFindUniqueMock.mockResolvedValueOnce(draftVariant);
      quoteRoomFindFirstMock.mockResolvedValueOnce({ id: roomId, quoteVariantId: variantId });
      priceListItemFindUniqueMock.mockResolvedValueOnce(activeGeneralCatalogItem);

      const result = await addQuoteCatalogItem({
        quoteVariantId: variantId,
        quoteRoomId: roomId,
        priceListItemId: itemGeneralCatalogId,
        quantity: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Pozycja ogólna instalacji nie może być przypisana do pomieszczenia');
      expect(quoteItemCreateMock).not.toHaveBeenCalled();
    });

    it('AC-G4: wariant wyłącznie z pozycjami ogólnymi poprawnie liczy sumę netto i brutto', async () => {
      quoteVariantFindUniqueMock.mockResolvedValueOnce({
        ...draftVariant,
        equipmentNetAmount: 0,
      });

      quoteItemFindManyMock.mockResolvedValueOnce([
        {
          quantity: 1,
          unitPriceNet: 400.0,
          priceListItemVersion: { crewCostNet: 50.0 },
        },
        {
          quantity: 5,
          unitPriceNet: 15.0,
          priceListItemVersion: { crewCostNet: 2.0 },
        },
      ]);

      quoteVariantUpdateMock.mockResolvedValueOnce({
        ...draftVariant,
        totalNetAmount: 475.0,
      });

      const totals = await calculateVariantTotals({
        quoteVariantId: variantId,
      });

      expect(totals.success).toBe(true);
      expect(totals.totalNet).toBe(475.0);
      expect(totals.vatRatePercent).toBe(8);
      expect(totals.totalGross).toBe(513.0);
    });
  });

  describe('FLD-QUOTE-MANUAL-ITEM: Pozycje indywidualne audytora', () => {
    it('AC-M1: wymaga nazwy, niepustego opisu i unitPriceNet >= 0; puste lub spacje są odrzucane (luka 4)', async () => {
      quoteVariantFindUniqueMock.mockResolvedValue(draftVariant);

      // Pusty opis (same spacje)
      const emptyDescResult = await addQuoteManualItem({
        quoteVariantId: variantId,
        quoteRoomId: null,
        manualName: 'Zwyżka specjalna',
        manualDescription: '   ',
        unitPriceNet: 350.0,
        quantity: 1,
      });
      expect(emptyDescResult.success).toBe(false);
      expect(emptyDescResult.error).toContain('Opis pozycji indywidualnej nie może być pusty');

      // Ujemna cena
      const negativePriceResult = await addQuoteManualItem({
        quoteVariantId: variantId,
        quoteRoomId: null,
        manualName: 'Zwyżka specjalna',
        manualDescription: 'Dojazd zwyżki z koszem',
        unitPriceNet: -50.0,
        quantity: 1,
      });
      expect(negativePriceResult.success).toBe(false);
      expect(negativePriceResult.error).toContain('Cena jednostkowa netto nie może być ujemna');

      // Prawidłowa pozycja indywidualna
      quoteItemCreateMock.mockResolvedValueOnce({
        id: 'manual-1',
        quoteVariantId: variantId,
        quoteRoomId: null,
        scope: 'INSTALLATION',
        manualName: 'Zwyżka specjalna',
        manualDescription: 'Dojazd zwyżki z koszem',
        unitPriceNet: 350.0,
        quantity: 1,
        priceListItemId: null,
        priceListItemVersionId: null,
      });
      quoteItemFindManyMock.mockResolvedValueOnce([]);

      const successResult = await addQuoteManualItem({
        quoteVariantId: variantId,
        quoteRoomId: null,
        manualName: '  Zwyżka specjalna  ',
        manualDescription: '  Dojazd zwyżki z koszem  ',
        unitPriceNet: 350.0,
        quantity: 1,
      });

      expect(successResult.success).toBe(true);
      expect(quoteItemCreateMock).toHaveBeenCalledWith({
        data: expect.objectContaining({
          quoteVariantId: variantId,
          quoteRoomId: null,
          scope: 'INSTALLATION',
          manualName: 'Zwyżka specjalna',
          manualDescription: 'Dojazd zwyżki z koszem',
          unitPriceNet: 350.0,
          quantity: 1,
          priceListItemId: null,
          priceListItemVersionId: null,
        }),
      });
    });

    it('AC-M2: dodanie pozycji indywidualnej nie tworzy wpisów w price_list_items ani wersjach', async () => {
      quoteVariantFindUniqueMock.mockResolvedValueOnce(draftVariant);
      quoteItemCreateMock.mockResolvedValueOnce({
        id: 'manual-2',
        priceListItemId: null,
        priceListItemVersionId: null,
      });
      quoteItemFindManyMock.mockResolvedValueOnce([]);

      await addQuoteManualItem({
        quoteVariantId: variantId,
        quoteRoomId: null,
        manualName: 'Stelaż dachowy',
        manualDescription: 'Konstrukcja wsporcza aluminiowa',
        unitPriceNet: 350.0,
        quantity: 1,
      });

      expect(priceListItemCreateMock).not.toHaveBeenCalled();
      expect(priceListItemVersionCreateMock).not.toHaveBeenCalled();
    });

    it('AC-M3: pozycja indywidualna wchodzi do sumy netto i brutto na tych samych zasadach co cennikowa', async () => {
      quoteVariantFindUniqueMock.mockResolvedValueOnce({
        ...draftVariant,
        equipmentNetAmount: 0,
      });

      quoteItemFindManyMock.mockResolvedValueOnce([
        {
          quantity: 1,
          unitPriceNet: 400.0,
          priceListItemVersion: { crewCostNet: 50.0 },
        },
        {
          quantity: 5,
          unitPriceNet: 15.0,
          priceListItemVersion: { crewCostNet: 2.0 },
        },
        {
          quantity: 1,
          unitPriceNet: 350.0,
          priceListItemVersion: null,
        },
      ]);

      quoteVariantUpdateMock.mockResolvedValueOnce({
        ...draftVariant,
        totalNetAmount: 825.0,
      });

      const totals = await calculateVariantTotals({
        quoteVariantId: variantId,
      });

      expect(totals.success).toBe(true);
      expect(totals.totalNet).toBe(825.0);
      expect(totals.totalGross).toBe(891.0);
    });
  });

  describe('Przypadki brzegowe i strażniki', () => {
    it('blokuje modyfikacje, gdy oferta nie jest w stanie DRAFT (luka 5)', async () => {
      quoteVariantFindUniqueMock.mockResolvedValueOnce({
        ...draftVariant,
        quote: {
          id: quoteId,
          status: 'SENT',
        },
      });

      const result = await addQuoteRoom({
        quoteVariantId: variantId,
        name: 'Sypialnia',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Modyfikacja oferty jest dozwolona wyłącznie w stanie DRAFT');
      expect(quoteRoomCreateMock).not.toHaveBeenCalled();
    });

    it('odrzuca dodanie nieaktywnej pozycji cennikowej', async () => {
      quoteVariantFindUniqueMock.mockResolvedValueOnce(draftVariant);
      quoteRoomFindFirstMock.mockResolvedValueOnce({ id: roomId, quoteVariantId: variantId });
      priceListItemFindUniqueMock.mockResolvedValueOnce({
        ...activeRoomCatalogItem,
        isActive: false,
      });

      const result = await addQuoteCatalogItem({
        quoteVariantId: variantId,
        quoteRoomId: roomId,
        priceListItemId: itemRoomCatalogId,
        quantity: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Pozycja cennika jest nieaktywna');
      expect(quoteItemCreateMock).not.toHaveBeenCalled();
    });

    it('odrzuca dodanie pozycji cennikowej bez aktywnej wersji bieżącej', async () => {
      quoteVariantFindUniqueMock.mockResolvedValueOnce(draftVariant);
      quoteRoomFindFirstMock.mockResolvedValueOnce({ id: roomId, quoteVariantId: variantId });
      priceListItemFindUniqueMock.mockResolvedValueOnce({
        ...activeRoomCatalogItem,
        versions: [],
      });

      const result = await addQuoteCatalogItem({
        quoteVariantId: variantId,
        quoteRoomId: roomId,
        priceListItemId: itemRoomCatalogId,
        quantity: 1,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Pozycja cennika nie posiada aktywnej wersji ceny');
      expect(quoteItemCreateMock).not.toHaveBeenCalled();
    });

    it('odrzuca ilość <= 0 lub nieliczbową', async () => {
      quoteVariantFindUniqueMock.mockResolvedValue(draftVariant);

      const zeroQtyResult = await addQuoteCatalogItem({
        quoteVariantId: variantId,
        quoteRoomId: roomId,
        priceListItemId: itemRoomCatalogId,
        quantity: 0,
      });
      expect(zeroQtyResult.success).toBe(false);
      expect(zeroQtyResult.error).toContain('Ilość musi być większa od zera');

      const negativeQtyResult = await addQuoteCatalogItem({
        quoteVariantId: variantId,
        quoteRoomId: roomId,
        priceListItemId: itemRoomCatalogId,
        quantity: -3,
      });
      expect(negativeQtyResult.success).toBe(false);
      expect(negativeQtyResult.error).toContain('Ilość musi być większa od zera');
    });

    it('usunięcie pozycji usuwa rekord i przelicza sumę wariantu', async () => {
      quoteItemFindUniqueMock.mockResolvedValueOnce({
        id: 'item-to-delete',
        quoteVariantId: variantId,
        quoteVariant: draftVariant,
      });
      quoteItemDeleteMock.mockResolvedValueOnce({ id: 'item-to-delete' });
      quoteItemFindManyMock.mockResolvedValueOnce([]);

      const result = await deleteQuoteItem({
        quoteItemId: 'item-to-delete',
      });

      expect(result.success).toBe(true);
      expect(quoteItemDeleteMock).toHaveBeenCalledWith({
        where: { id: 'item-to-delete' },
      });
      expect(quoteVariantUpdateMock).toHaveBeenCalled();
    });
  });
});
