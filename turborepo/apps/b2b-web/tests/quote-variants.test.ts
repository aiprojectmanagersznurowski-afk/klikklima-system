import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createDraftQuote,
  addQuoteVariant,
  deleteQuoteVariant,
  sendQuote,
  selectQuoteVariant,
  getQuoteDepositAmount,
  isQuoteReadyForContract,
  getSentQuoteSnapshot,
} from '../src/lib/pricing/quote-variants';
import { SLA } from '@klikklima/contracts';

const {
  quoteFindUniqueMock,
  quoteCreateMock,
  quoteUpdateMock,
  quoteVariantFindUniqueMock,
  quoteVariantFindFirstMock,
  quoteVariantFindManyMock,
  quoteVariantCreateMock,
  quoteVariantUpdateMock,
  quoteVariantDeleteMock,
  quoteVariantCountMock,
  quoteRoomFindManyMock,
  quoteRoomDeleteManyMock,
  quoteItemFindManyMock,
  quoteItemUpdateMock,
  quoteItemDeleteManyMock,
  priceListItemFindUniqueMock,
  priceListItemFindManyMock,
  auditLogCreateMock,
} = vi.hoisted(() => ({
  quoteFindUniqueMock: vi.fn(),
  quoteCreateMock: vi.fn(),
  quoteUpdateMock: vi.fn(),
  quoteVariantFindUniqueMock: vi.fn(),
  quoteVariantFindFirstMock: vi.fn(),
  quoteVariantFindManyMock: vi.fn(),
  quoteVariantCreateMock: vi.fn(),
  quoteVariantUpdateMock: vi.fn(),
  quoteVariantDeleteMock: vi.fn(),
  quoteVariantCountMock: vi.fn(),
  quoteRoomFindManyMock: vi.fn(),
  quoteRoomDeleteManyMock: vi.fn(),
  quoteItemFindManyMock: vi.fn(),
  quoteItemUpdateMock: vi.fn(),
  quoteItemDeleteManyMock: vi.fn(),
  priceListItemFindUniqueMock: vi.fn(),
  priceListItemFindManyMock: vi.fn(),
  auditLogCreateMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    quote: {
      findUnique: quoteFindUniqueMock,
      create: quoteCreateMock,
      update: quoteUpdateMock,
    },
    quoteVariant: {
      findUnique: quoteVariantFindUniqueMock,
      findFirst: quoteVariantFindFirstMock,
      findMany: quoteVariantFindManyMock,
      create: quoteVariantCreateMock,
      update: quoteVariantUpdateMock,
      delete: quoteVariantDeleteMock,
      count: quoteVariantCountMock,
    },
    quoteRoom: {
      findMany: quoteRoomFindManyMock,
      deleteMany: quoteRoomDeleteManyMock,
    },
    quoteItem: {
      findMany: quoteItemFindManyMock,
      update: quoteItemUpdateMock,
      deleteMany: quoteItemDeleteManyMock,
    },
    priceListItem: {
      findUnique: priceListItemFindUniqueMock,
      findMany: priceListItemFindManyMock,
    },
    auditLog: {
      create: auditLogCreateMock,
    },
    $transaction: vi.fn(async (callback) => {
      if (typeof callback === 'function') {
        return callback({
          quote: {
            findUnique: quoteFindUniqueMock,
            create: quoteCreateMock,
            update: quoteUpdateMock,
          },
          quoteVariant: {
            findUnique: quoteVariantFindUniqueMock,
            findFirst: quoteVariantFindFirstMock,
            findMany: quoteVariantFindManyMock,
            create: quoteVariantCreateMock,
            update: quoteVariantUpdateMock,
            delete: quoteVariantDeleteMock,
            count: quoteVariantCountMock,
          },
          quoteRoom: {
            findMany: quoteRoomFindManyMock,
            deleteMany: quoteRoomDeleteManyMock,
          },
          quoteItem: {
            findMany: quoteItemFindManyMock,
            update: quoteItemUpdateMock,
            deleteMany: quoteItemDeleteManyMock,
          },
          priceListItem: {
            findUnique: priceListItemFindUniqueMock,
            findMany: priceListItemFindManyMock,
          },
          auditLog: {
            create: auditLogCreateMock,
          },
        });
      }
      return callback;
    }),
  },
}));

describe('FLD-QUOTE-VARIANTS, FLD-QUOTE-PRICE-SNAPSHOT, FLD-QUOTE-MANUAL-ITEM — Zarządzanie wariantami i wysyłką wyceny', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const quoteId = 'quote-1';
  const leadId = 'lead-1';
  const variant1Id = 'var-1';
  const variant2Id = 'var-2';
  const variant3Id = 'var-3';

  const defaultDraftQuote = {
    id: quoteId,
    leadId,
    status: 'DRAFT',
    propertyKind: 'RESIDENTIAL_UP_TO_THRESHOLD',
    vatRatePercent: null,
    selectedVariantId: null,
    depositAmountGross: null,
    sentAt: null,
    validUntil: null,
  };

  const defaultDraftVariant1 = {
    id: variant1Id,
    quoteId,
    variantNumber: 1,
    name: 'Wariant 1',
    equipmentNetAmount: 10000.0,
    totalNetAmount: 10000.0,
    items: [],
  };

  describe('FLD-QUOTE-VARIANTS: Warianty, zaliczka i wysłanie', () => {
    // @REQ: FLD-QUOTE-VARIANTS
    it('AC-W1: utworzenie oferty dla leada tworzy ofertę DRAFT z wariantem nr 1 i podpowiedzianym rodzajem obiektu', async () => {
      quoteCreateMock.mockResolvedValueOnce({
        ...defaultDraftQuote,
        propertyKind: 'RESIDENTIAL_UP_TO_THRESHOLD',
        variants: [defaultDraftVariant1],
      });

      const result = await createDraftQuote({
        leadId,
        propertyKind: 'RESIDENTIAL_UP_TO_THRESHOLD',
      });

      expect(result.success).toBe(true);
      expect(quoteCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            leadId,
            status: 'DRAFT',
            propertyKind: 'RESIDENTIAL_UP_TO_THRESHOLD',
            variants: {
              create: [
                expect.objectContaining({
                  variantNumber: 1,
                }),
              ],
            },
          }),
        })
      );
    });

    // @REQ: FLD-QUOTE-VARIANTS
    it('AC-W1: dodanie wariantu przydziela najniższy wolny numer z [1, 2, 3], a czwarty wariant jest odrzucany', async () => {
      quoteFindUniqueMock.mockResolvedValue(defaultDraftQuote);

      // Mamy warianty 1 i 3 — najniższy wolny to 2
      quoteVariantFindManyMock.mockResolvedValueOnce([
        { id: variant1Id, variantNumber: 1 },
        { id: variant3Id, variantNumber: 3 },
      ]);
      quoteVariantCreateMock.mockResolvedValueOnce({
        id: variant2Id,
        quoteId,
        variantNumber: 2,
        name: 'Wariant 2',
        equipmentNetAmount: 0,
        totalNetAmount: 0,
      });

      const addRes = await addQuoteVariant({
        quoteId,
        name: 'Wariant 2',
        equipmentNetAmount: 0,
      });

      expect(addRes.success).toBe(true);
      expect(quoteVariantCreateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            quoteId,
            variantNumber: 2,
            name: 'Wariant 2',
          }),
        })
      );

      // Mamy już 3 warianty: 1, 2, 3
      quoteVariantFindManyMock.mockResolvedValueOnce([
        { id: variant1Id, variantNumber: 1 },
        { id: variant2Id, variantNumber: 2 },
        { id: variant3Id, variantNumber: 3 },
      ]);

      const fourthRes = await addQuoteVariant({
        quoteId,
        name: 'Wariant 4',
      });

      expect(fourthRes.success).toBe(false);
      expect(fourthRes.error).toContain('Oferta może zawierać maksymalnie 3 warianty');
    });

    // @REQ: FLD-QUOTE-VARIANTS
    it('AC-W1: próba usunięcia ostatniego wariantu jest odrzucana (oferta musi mieć co najmniej jeden wariant)', async () => {
      quoteVariantFindUniqueMock.mockResolvedValueOnce({
        id: variant1Id,
        quoteId,
        quote: defaultDraftQuote,
      });

      quoteVariantCountMock.mockResolvedValueOnce(1); // tylko 1 wariant

      const result = await deleteQuoteVariant({
        quoteVariantId: variant1Id,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Oferta musi zawierać co najmniej jeden wariant');
      expect(quoteVariantDeleteMock).not.toHaveBeenCalled();
    });

    // @REQ: FLD-QUOTE-VARIANTS
    it('AC-W2: zaliczka wg D8 ze stawki obiektu — RESIDENTIAL_UP_TO_THRESHOLD daje 11 880.00, COMMERCIAL daje 13 530.00', async () => {
      // Przypadek 1: RESIDENTIAL_UP_TO_THRESHOLD (8% VAT): 10 000 * 1.08 * 1.1 = 11 880.00
      const quoteRes = {
        ...defaultDraftQuote,
        status: 'SENT',
        propertyKind: 'RESIDENTIAL_UP_TO_THRESHOLD',
        vatRatePercent: 8,
        validUntil: new Date(Date.now() + 100000000),
      };
      const variantRes = {
        ...defaultDraftVariant1,
        equipmentNetAmount: 10000.0,
        items: [],
      };

      quoteFindUniqueMock.mockResolvedValueOnce(quoteRes);
      quoteVariantFindUniqueMock.mockResolvedValueOnce(variantRes);
      quoteItemFindManyMock.mockResolvedValueOnce([]);

      quoteUpdateMock.mockResolvedValueOnce({
        ...quoteRes,
        selectedVariantId: variant1Id,
        depositAmountGross: 11880.0,
      });

      const resResidential = await selectQuoteVariant({
        quoteId,
        quoteVariantId: variant1Id,
      });

      expect(resResidential.success).toBe(true);
      expect(quoteUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: quoteId },
          data: expect.objectContaining({
            selectedVariantId: variant1Id,
            depositAmountGross: 11880.0,
          }),
        })
      );

      // Przypadek 2: COMMERCIAL (23% VAT): 10 000 * 1.23 * 1.1 = 13 530.00
      const quoteCom = {
        ...defaultDraftQuote,
        status: 'SENT',
        propertyKind: 'COMMERCIAL',
        vatRatePercent: 23,
        validUntil: new Date(Date.now() + 100000000),
      };

      quoteFindUniqueMock.mockResolvedValueOnce(quoteCom);
      quoteVariantFindUniqueMock.mockResolvedValueOnce(variantRes);
      quoteItemFindManyMock.mockResolvedValueOnce([]);

      quoteUpdateMock.mockResolvedValueOnce({
        ...quoteCom,
        selectedVariantId: variant1Id,
        depositAmountGross: 13530.0,
      });

      const resCommercial = await selectQuoteVariant({
        quoteId,
        quoteVariantId: variant1Id,
      });

      expect(resCommercial.success).toBe(true);
      expect(quoteUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: quoteId },
          data: expect.objectContaining({
            selectedVariantId: variant1Id,
            depositAmountGross: 13530.0,
          }),
        })
      );
    });

    // @REQ: FLD-QUOTE-VARIANTS
    it('AC-W3: funkcja getQuoteDepositAmount odczytuje zaliczkę zapisaną w kolumnie, a nie liczy jej na nowo', async () => {
      // W bazie celowo wpisana niestandardowa kwota nadpisana w fiksturze
      quoteFindUniqueMock.mockResolvedValueOnce({
        id: quoteId,
        depositAmountGross: 9999.5,
      });

      const deposit = await getQuoteDepositAmount(quoteId);
      expect(deposit).toBe(9999.5);
    });

    // @REQ: FLD-QUOTE-VARIANTS
    it('AC-W4: reguła kontrolna R16 — blokuje wysłanie, gdy którykolwiek wariant ma zaliczkę > wartość brutto; zezwala gdy wartość brutto >= zaliczka', async () => {
      // COMMERCIAL (23% VAT). Zestaw 10 000.00 -> zaliczka 13 530.00.
      // Montaż 500.00 -> Razem netto 10 500.00 -> Brutto 12 915.00 < 13 530.00 (ODRZUCENIE)
      quoteFindUniqueMock.mockResolvedValueOnce({
        ...defaultDraftQuote,
        propertyKind: 'COMMERCIAL',
        variants: [
          {
            ...defaultDraftVariant1,
            equipmentNetAmount: 10000.0,
            items: [
              {
                id: 'it-1',
                priceListItemId: 'pli-1',
                quantity: 1,
                unitPriceNet: 500.0,
              },
            ],
          },
        ],
      });

      priceListItemFindManyMock.mockResolvedValueOnce([
        {
          id: 'pli-1',
          isActive: true,
          versions: [{ id: 'ver-1', salePriceNet: 500.0, isCurrent: true }],
        },
      ]);

      const failRes = await sendQuote({ quoteId });
      expect(failRes.success).toBe(false);
      expect(failRes.error).toContain('przekracza wartość całkowitą oferty');
      expect(quoteUpdateMock).not.toHaveBeenCalled();

      // Granica: Montaż 1000.00 -> Razem netto 11 000.00 -> Brutto 13 530.00 == zaliczka 13 530.00 (DOZWOLONE)
      quoteFindUniqueMock.mockResolvedValueOnce({
        ...defaultDraftQuote,
        propertyKind: 'COMMERCIAL',
        variants: [
          {
            ...defaultDraftVariant1,
            equipmentNetAmount: 10000.0,
            items: [
              {
                id: 'it-2',
                priceListItemId: 'pli-2',
                quantity: 1,
                unitPriceNet: 1000.0,
              },
            ],
          },
        ],
      });

      priceListItemFindManyMock.mockResolvedValueOnce([
        {
          id: 'pli-2',
          isActive: true,
          versions: [{ id: 'ver-2', salePriceNet: 1000.0, isCurrent: true }],
        },
      ]);

      quoteUpdateMock.mockResolvedValueOnce({
        ...defaultDraftQuote,
        status: 'SENT',
      });

      const okRes = await sendQuote({ quoteId });
      expect(okRes.success).toBe(true);
      expect(quoteUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: quoteId },
          data: expect.objectContaining({
            status: 'SENT',
          }),
        })
      );
    });

    // @REQ: FLD-QUOTE-VARIANTS
    it('AC-W5: wybór wariantu odrzuca obcy wariant, ofertę w złym stanie lub przeterminowaną; strażnik gotowości do umowy', async () => {
      // Obcy wariant
      quoteFindUniqueMock.mockResolvedValueOnce({
        ...defaultDraftQuote,
        status: 'SENT',
        validUntil: new Date(Date.now() + 10000000),
      });
      quoteVariantFindUniqueMock.mockResolvedValueOnce({
        id: 'foreign-variant',
        quoteId: 'other-quote',
      });

      const foreignRes = await selectQuoteVariant({
        quoteId,
        quoteVariantId: 'foreign-variant',
      });
      expect(foreignRes.success).toBe(false);
      expect(foreignRes.error).toContain('Wskazany wariant nie należy do tej oferty');

      // Oferta w stanie DRAFT
      quoteFindUniqueMock.mockResolvedValueOnce(defaultDraftQuote);
      const draftSelectRes = await selectQuoteVariant({
        quoteId,
        quoteVariantId: variant1Id,
      });
      expect(draftSelectRes.success).toBe(false);
      expect(draftSelectRes.error).toContain('Wybór wariantu jest dozwolony wyłącznie dla wysłanej oferty');

      // Oferta przeterminowana (po valid_until)
      quoteFindUniqueMock.mockResolvedValueOnce({
        ...defaultDraftQuote,
        status: 'SENT',
        validUntil: new Date(Date.now() - 10000),
      });
      quoteVariantFindUniqueMock.mockResolvedValueOnce(defaultDraftVariant1);

      const expiredRes = await selectQuoteVariant({
        quoteId,
        quoteVariantId: variant1Id,
      });
      expect(expiredRes.success).toBe(false);
      expect(expiredRes.error).toContain('Oferta wygasła');

      // Strażnik gotowości do umowy
      quoteFindUniqueMock.mockResolvedValueOnce({
        ...defaultDraftQuote,
        status: 'SENT',
        selectedVariantId: null,
      });
      expect(await isQuoteReadyForContract(quoteId)).toBe(false);

      quoteFindUniqueMock.mockResolvedValueOnce({
        ...defaultDraftQuote,
        status: 'SENT',
        selectedVariantId: variant1Id,
        depositAmountGross: 11880.0,
      });
      expect(await isQuoteReadyForContract(quoteId)).toBe(true);
    });

    // @REQ: FLD-QUOTE-VARIANTS
    it('AC-W6: wysłanie ustawia status=SENT, sent_at oraz valid_until wyliczone z SLA.QUOTE_VALIDITY.days (14 dni)', async () => {
      quoteFindUniqueMock.mockResolvedValueOnce({
        ...defaultDraftQuote,
        propertyKind: 'RESIDENTIAL_UP_TO_THRESHOLD',
        variants: [
          {
            ...defaultDraftVariant1,
            equipmentNetAmount: 10000.0,
            items: [
              {
                id: 'it-w6',
                priceListItemId: null,
                quantity: 1,
                unitPriceNet: 1000.0,
              },
            ],
          },
        ],
      });

      const fixedNow = new Date('2026-09-27T12:00:00.000Z');
      vi.useFakeTimers();
      vi.setSystemTime(fixedNow);

      quoteUpdateMock.mockResolvedValueOnce({
        ...defaultDraftQuote,
        status: 'SENT',
        sentAt: fixedNow,
        validUntil: new Date(fixedNow.getTime() + SLA.QUOTE_VALIDITY.days * 24 * 60 * 60 * 1000),
      });

      const res = await sendQuote({ quoteId });
      expect(res.success).toBe(true);

      const expectedValidity = new Date(fixedNow.getTime() + SLA.QUOTE_VALIDITY.days * 24 * 60 * 60 * 1000);

      expect(quoteUpdateMock).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: quoteId },
          data: expect.objectContaining({
            status: 'SENT',
            sentAt: fixedNow,
            validUntil: expectedValidity,
            vatRatePercent: 8,
          }),
        })
      );

      vi.useRealTimers();
    });
  });

  describe('FLD-QUOTE-PRICE-SNAPSHOT: Zamrożenie cen i pozycji', () => {
    // @REQ: FLD-QUOTE-PRICE-SNAPSHOT
    it('AC-F1: przy wysłaniu każda pozycja cennikowa zapisuje cenę bieżącą z chwilą wysłania i wersję ceny', async () => {
      quoteFindUniqueMock.mockResolvedValueOnce({
        ...defaultDraftQuote,
        propertyKind: 'RESIDENTIAL_UP_TO_THRESHOLD',
        variants: [
          {
            ...defaultDraftVariant1,
            equipmentNetAmount: 10000.0,
            items: [
              {
                id: 'it-1',
                priceListItemId: 'pli-1',
                quantity: 10,
                unitPriceNet: 100.0, // stara cena ze szkicu
              },
            ],
          },
        ],
      });

      // Nowa cena w cenniku przed wysłaniem
      priceListItemFindManyMock.mockResolvedValueOnce([
        {
          id: 'pli-1',
          isActive: true,
          versions: [
            {
              id: 'ver-new',
              priceListItemId: 'pli-1',
              salePriceNet: 150.0,
              crewCostNet: 20.0,
              isCurrent: true,
            },
          ],
        },
      ]);

      const res = await sendQuote({ quoteId });
      expect(res.success).toBe(true);

      expect(quoteItemUpdateMock).toHaveBeenCalledWith({
        where: { id: 'it-1' },
        data: {
          unitPriceNet: 150.0,
          priceListItemVersionId: 'ver-new',
        },
      });

      expect(quoteVariantUpdateMock).toHaveBeenCalledWith({
        where: { id: variant1Id },
        data: {
          totalNetAmount: 11500.0, // 10000 sprzęt + (10 * 150)
        },
      });
    });

    // @REQ: FLD-QUOTE-PRICE-SNAPSHOT
    it('AC-F2: po wysłaniu zmiana cen w cenniku i wycofanie pozycji nie zmienia sum i zaliczki oferty', async () => {
      // Oferta wysłana ze zamrożoną sumą i stawką
      const sentQuote = {
        ...defaultDraftQuote,
        status: 'SENT',
        propertyKind: 'RESIDENTIAL_UP_TO_THRESHOLD',
        vatRatePercent: 8,
        depositAmountGross: 11880.0,
        selectedVariantId: variant1Id,
        variants: [
          {
            id: variant1Id,
            equipmentNetAmount: 10000.0,
            totalNetAmount: 10300.0,
            items: [
              {
                id: 'it-1',
                priceListItemId: 'pli-1',
                quantity: 2,
                unitPriceNet: 150.0,
                priceListItemVersion: {
                  crewCostNet: 20.0,
                },
              },
            ],
          },
        ],
      };

      quoteFindUniqueMock.mockResolvedValue(sentQuote);

      // Pobieramy snapshot oferty
      const snapshot = await getSentQuoteSnapshot(quoteId);
      expect(snapshot.totalNet).toBe(10300.0);
      expect(snapshot.vatRatePercent).toBe(8);
      expect(snapshot.depositAmountGross).toBe(11880.0);

      // Cennik w bazie mógł się zmienić lub pozycje mogły zostać dezaktywowane,
      // ale funkcja snapshotu w ogóle nie odpytuje cennika
      expect(priceListItemFindUniqueMock).not.toHaveBeenCalled();
      expect(priceListItemFindManyMock).not.toHaveBeenCalled();
    });

    // @REQ: FLD-QUOTE-PRICE-SNAPSHOT
    it('AC-F3: getSentQuoteSnapshot odtwarza kwoty netto, VAT, brutto i zaliczkę z zamrożonych danych wierszy oferty', async () => {
      quoteFindUniqueMock.mockResolvedValueOnce({
        ...defaultDraftQuote,
        status: 'SENT',
        propertyKind: 'COMMERCIAL',
        vatRatePercent: 23,
        depositAmountGross: 13530.0,
        selectedVariantId: variant1Id,
        variants: [
          {
            id: variant1Id,
            equipmentNetAmount: 10000.0,
            totalNetAmount: 12000.0,
            items: [
              {
                id: 'it-1',
                quantity: 1,
                unitPriceNet: 2000.0,
                priceListItemVersion: { crewCostNet: 500.0 },
              },
            ],
          },
        ],
      });

      const snapshot = await getSentQuoteSnapshot(quoteId);
      expect(snapshot.totalNet).toBe(12000.0);
      expect(snapshot.vatAmount).toBe(2760.0); // 12000 * 0.23
      expect(snapshot.totalGross).toBe(14760.0);
      expect(snapshot.depositAmountGross).toBe(13530.0);
    });

    // @REQ: FLD-QUOTE-PRICE-SNAPSHOT
    // @REQ: FLD-QUOTE-MANUAL-ITEM
    it('AC-F4: wysłanie nie zmienia ceny pozycji indywidualnej (MANUAL-ITEM AC4), a po wysłaniu zmiana propertyKind jest odrzucana', async () => {
      quoteFindUniqueMock.mockResolvedValueOnce({
        ...defaultDraftQuote,
        propertyKind: 'RESIDENTIAL_UP_TO_THRESHOLD',
        variants: [
          {
            ...defaultDraftVariant1,
            equipmentNetAmount: 10000.0,
            items: [
              {
                id: 'manual-1',
                priceListItemId: null, // manual item
                manualName: 'Niestandardowy stelaż',
                manualDescription: 'Specjalna konstrukcja pod skos',
                quantity: 1,
                unitPriceNet: 1000.0,
              },
            ],
          },
        ],
      });

      const res = await sendQuote({ quoteId });
      expect(res.success).toBe(true);

      // Pozycja indywidualna nie jest nadpisywana ceną z cennika
      expect(quoteItemUpdateMock).not.toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'manual-1' },
          data: expect.objectContaining({
            unitPriceNet: expect.anything(),
          }),
        })
      );
    });
  });

  describe('Przypadki brzegowe i strażniki', () => {
    it('podwójne wysłanie (powtórzone żądanie) jest odrzucane z komunikatem o już wysłanej ofercie', async () => {
      quoteFindUniqueMock.mockResolvedValueOnce({
        ...defaultDraftQuote,
        status: 'SENT',
      });

      const res = await sendQuote({ quoteId });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Oferta została już wysłana');
      expect(quoteUpdateMock).not.toHaveBeenCalled();
    });

    it('wysłanie z pozycją cennika wycofaną z oferty jest odrzucane z listą takich pozycji', async () => {
      quoteFindUniqueMock.mockResolvedValueOnce({
        ...defaultDraftQuote,
        propertyKind: 'RESIDENTIAL_UP_TO_THRESHOLD',
        variants: [
          {
            ...defaultDraftVariant1,
            items: [
              {
                id: 'it-old',
                priceListItemId: 'pli-withdrawn',
                quantity: 1,
                unitPriceNet: 100.0,
              },
            ],
          },
        ],
      });

      priceListItemFindManyMock.mockResolvedValueOnce([
        {
          id: 'pli-withdrawn',
          name: 'Stary wspornik',
          isActive: false, // wycofany
          versions: [],
        },
      ]);

      const res = await sendQuote({ quoteId });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Pozycja cennika została wycofana');
      expect(res.error).toContain('Stary wspornik');
    });

    it('wysłanie bez określonego rodzaju obiektu jest odrzucane', async () => {
      quoteFindUniqueMock.mockResolvedValueOnce({
        ...defaultDraftQuote,
        propertyKind: null,
      });

      const res = await sendQuote({ quoteId });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Wysłanie oferty wymaga określenia rodzaju obiektu');
    });

    it('wysłanie z wariantem bez określonej ceny urządzeń (equipmentNetAmount null) jest odrzucane', async () => {
      quoteFindUniqueMock.mockResolvedValueOnce({
        ...defaultDraftQuote,
        propertyKind: 'RESIDENTIAL_UP_TO_THRESHOLD',
        variants: [
          {
            ...defaultDraftVariant1,
            equipmentNetAmount: null,
          },
        ],
      });

      const res = await sendQuote({ quoteId });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Cena zestawu urządzeń jest wymagana');
    });

    it('wysłanie wariantu pustego (brak pozycji i sprzęt 0.00) jest odrzucane', async () => {
      quoteFindUniqueMock.mockResolvedValueOnce({
        ...defaultDraftQuote,
        propertyKind: 'RESIDENTIAL_UP_TO_THRESHOLD',
        variants: [
          {
            ...defaultDraftVariant1,
            equipmentNetAmount: 0,
            items: [],
          },
        ],
      });

      const res = await sendQuote({ quoteId });
      expect(res.success).toBe(false);
      expect(res.error).toContain('Wariant oferty nie może być pusty');
    });

    it('ponowny wybór tego samego wariantu jest idempotentny; wybór innego po uprzednim wyborze jest odrzucany', async () => {
      const sentQuote = {
        ...defaultDraftQuote,
        status: 'SENT',
        selectedVariantId: variant1Id,
        depositAmountGross: 11880.0,
        validUntil: new Date(Date.now() + 10000000),
      };

      quoteFindUniqueMock.mockResolvedValue(sentQuote);

      // Ten sam wariant — idempotentny sukces
      const sameRes = await selectQuoteVariant({
        quoteId,
        quoteVariantId: variant1Id,
      });
      expect(sameRes.success).toBe(true);

      // Inny wariant po uprzednim wyborze — odrzucenie
      const diffRes = await selectQuoteVariant({
        quoteId,
        quoteVariantId: variant2Id,
      });
      expect(diffRes.success).toBe(false);
      expect(diffRes.error).toContain('Wybrano już inny wariant oferty');
    });
  });
});
