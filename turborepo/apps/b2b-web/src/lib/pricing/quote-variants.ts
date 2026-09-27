import { prisma } from '@repo/database';
import { SLA } from '@klikklima/contracts';
import {
  calculateQuoteVariant,
  resolveVatRate,
  type PropertyKind,
  type QuoteItemInput,
  type CalculatedQuoteVariant,
} from '@repo/pricing';

export interface CreateDraftQuoteParams {
  leadId: string;
  propertyKind?: PropertyKind;
}

export interface AddQuoteVariantParams {
  quoteId: string;
  name?: string;
  equipmentNetAmount?: number;
}

export interface DeleteQuoteVariantParams {
  quoteVariantId: string;
}

export interface SendQuoteParams {
  quoteId: string;
}

export interface SelectQuoteVariantParams {
  quoteId: string;
  quoteVariantId: string;
}

export interface SentQuoteSnapshot {
  quoteId: string;
  status: string;
  propertyKind: PropertyKind;
  vatRatePercent: number;
  totalNet: number;
  vatAmount: number;
  totalGross: number;
  depositAmountGross: number;
  selectedVariantId: string | null;
  variants: Array<{
    id: string;
    variantNumber: number;
    name: string | null;
    totalNet: number;
    vatAmount: number;
    totalGross: number;
    depositAmountGross: number;
  }>;
}

/**
 * AC-W1: Tworzy nową ofertę DRAFT z wariantem nr 1 i podpowiedzianym rodzajem obiektu.
 */
export async function createDraftQuote(params: CreateDraftQuoteParams) {
  const { leadId, propertyKind = 'RESIDENTIAL_UP_TO_THRESHOLD' } = params;

  const quote = await prisma.quote.create({
    data: {
      leadId,
      status: 'DRAFT',
      propertyKind,
      variants: {
        create: [
          {
            variantNumber: 1,
            name: 'Wariant 1',
            equipmentNetAmount: 0,
            totalNetAmount: 0,
          },
        ],
      },
    },
    include: {
      variants: true,
    },
  });

  return {
    success: true,
    quote,
  };
}

/**
 * AC-W1: Dodaje nowy wariant do oferty DRAFT, przydzielając najniższy wolny numer z [1, 2, 3].
 * Odrzuca próbę dodania 4. wariantu.
 */
export async function addQuoteVariant(params: AddQuoteVariantParams) {
  const { quoteId, name, equipmentNetAmount = 0 } = params;

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
  });

  if (!quote) {
    return {
      success: false,
      error: 'Oferta nie została odnaleziona',
    };
  }

  if (quote.status !== 'DRAFT') {
    return {
      success: false,
      error: 'Modyfikacja oferty jest dozwolona wyłącznie w stanie DRAFT',
    };
  }

  const existingVariants = await prisma.quoteVariant.findMany({
    where: { quoteId },
    select: { variantNumber: true },
  });

  if (existingVariants.length >= 3) {
    return {
      success: false,
      error: 'Oferta może zawierać maksymalnie 3 warianty',
    };
  }

  const existingNumbers = new Set(existingVariants.map((v) => v.variantNumber));
  const availableNumber = [1, 2, 3].find((n) => !existingNumbers.has(n));

  if (!availableNumber) {
    return {
      success: false,
      error: 'Oferta może zawierać maksymalnie 3 warianty',
    };
  }

  const variantName = name?.trim() || `Wariant ${availableNumber}`;

  const variant = await prisma.quoteVariant.create({
    data: {
      quoteId,
      variantNumber: availableNumber,
      name: variantName,
      equipmentNetAmount,
      totalNetAmount: equipmentNetAmount,
    },
  });

  return {
    success: true,
    variant,
  };
}

/**
 * AC-W1: Usuwa wariant oferty. Blokuje usunięcie ostatniego wariantu (min. 1 wariant).
 */
export async function deleteQuoteVariant(params: DeleteQuoteVariantParams) {
  const { quoteVariantId } = params;

  const variant = await prisma.quoteVariant.findUnique({
    where: { id: quoteVariantId },
    include: { quote: true },
  });

  if (!variant) {
    return {
      success: false,
      error: 'Wariant oferty nie został odnaleziony',
    };
  }

  if (variant.quote.status !== 'DRAFT') {
    return {
      success: false,
      error: 'Modyfikacja oferty jest dozwolona wyłącznie w stanie DRAFT',
    };
  }

  const count = await prisma.quoteVariant.count({
    where: { quoteId: variant.quoteId },
  });

  if (count <= 1) {
    return {
      success: false,
      error: 'Oferta musi zawierać co najmniej jeden wariant',
    };
  }

  if (typeof prisma.$transaction === 'function') {
    await prisma.$transaction(async (tx) => {
      await tx.quoteItem.deleteMany({
        where: { quoteVariantId },
      });

      await tx.quoteRoom.deleteMany({
        where: { quoteVariantId },
      });

      await tx.quoteVariant.delete({
        where: { id: quoteVariantId },
      });

      await tx.auditLog.create({
        data: {
          actorEmail: 'system@klikklima.pl',
          actorRole: 'admin',
          operation: 'delete',
          resource: 'quotes',
          recordId: variant.quoteId,
          justification: `Usunięcie wariantu nr ${variant.variantNumber} z oferty`,
          legalBasis: 'OTHER',
        },
      });
    });
  } else {
    await prisma.quoteVariant.delete({
      where: { id: quoteVariantId },
    });
  }

  return {
    success: true,
  };
}

/**
 * AC-W4, AC-W6, AC-F1, AC-F4: Wysyła ofertę, zamrażając ceny pozycji z cennika,
 * sprawdzając regułę kontrolną zaliczki (R16) oraz ustawiając SLA ważności oferty.
 */
export async function sendQuote(params: SendQuoteParams) {
  const { quoteId } = params;

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      variants: {
        include: {
          items: true,
        },
      },
    },
  });

  if (!quote) {
    return {
      success: false,
      error: 'Oferta nie została odnaleziona',
    };
  }

  if (quote.status !== 'DRAFT') {
    return {
      success: false,
      error: 'Oferta została już wysłana',
    };
  }

  if (!quote.propertyKind) {
    return {
      success: false,
      error: 'Wysłanie oferty wymaga określenia rodzaju obiektu',
    };
  }

  const propertyKind = quote.propertyKind as PropertyKind;

  if (!quote.variants || quote.variants.length === 0) {
    return {
      success: false,
      error: 'Oferta musi zawierać co najmniej jeden wariant',
    };
  }

  // Weryfikacja poprawności wariantów (cena zestawu i zawartość)
  for (const v of quote.variants) {
    if (v.equipmentNetAmount === null || v.equipmentNetAmount === undefined) {
      return {
        success: false,
        error: 'Cena zestawu urządzeń jest wymagana',
      };
    }

    const itemsCount = v.items ? v.items.length : 0;
    if (itemsCount === 0 && Number(v.equipmentNetAmount) === 0) {
      return {
        success: false,
        error: 'Wariant oferty nie może być pusty',
      };
    }
  }

  // Zebranie wszystkich pozycji katalogowych użytych we wszystkich wariantach
  const catalogItemIds = new Set<string>();
  for (const v of quote.variants) {
    if (v.items) {
      for (const it of v.items) {
        if (it.priceListItemId) {
          catalogItemIds.add(it.priceListItemId);
        }
      }
    }
  }

  const catalogItems = catalogItemIds.size > 0
    ? await prisma.priceListItem.findMany({
        where: { id: { in: Array.from(catalogItemIds) } },
        include: {
          versions: {
            where: { isCurrent: true },
          },
        },
      })
    : [];

  const catalogMap = new Map(catalogItems.map((ci) => [ci.id, ci]));

  // Sprawdzenie czy którakolwiek pozycja nie została wycofana lub nie brakuje jej aktywnej wersji
  const withdrawnItems: string[] = [];
  for (const id of catalogItemIds) {
    const item = catalogMap.get(id);
    if (!item || !item.isActive || !item.versions || item.versions.length === 0) {
      withdrawnItems.push(item?.name || id);
    }
  }

  if (withdrawnItems.length > 0) {
    return {
      success: false,
      error: `Pozycja cennika została wycofana: ${withdrawnItems.join(', ')}`,
    };
  }

  // Weryfikacja R16 i zamrożenie per wariant
  const variantCalculations: Array<{
    variantId: string;
    variantNumber: number;
    calculated: CalculatedQuoteVariant;
    updatedItems: Array<{ id: string; unitPriceNet: number; priceListItemVersionId: string }>;
  }> = [];

  for (const v of quote.variants) {
    const rawItems = v.items || [];
    const updatedItems: Array<{ id: string; unitPriceNet: number; priceListItemVersionId: string }> = [];

    const quoteItemsInput: QuoteItemInput[] = rawItems.map((it) => {
      let unitPrice = Number(it.unitPriceNet);
      let crewCostNet: number | null = null;

      if (it.priceListItemId) {
        const cat = catalogMap.get(it.priceListItemId);
        const currentVer = cat?.versions?.find((ver) => ver.isCurrent) || cat?.versions?.[0];
        if (currentVer) {
          unitPrice = Number(currentVer.salePriceNet);
          crewCostNet = currentVer.crewCostNet ? Number(currentVer.crewCostNet) : null;
          updatedItems.push({
            id: it.id,
            unitPriceNet: unitPrice,
            priceListItemVersionId: currentVer.id,
          });
        }
      }

      return {
        quantity: Number(it.quantity),
        unitPriceNet: unitPrice,
        crewCostNet,
        description: it.manualDescription || null,
      };
    });

    const calculated = calculateQuoteVariant({
      propertyKind,
      equipmentNetAmount: Number(v.equipmentNetAmount),
      items: quoteItemsInput,
    });

    // AC-W4: Reguła kontrolna R16 — zaliczka nie może przekraczać wartości całkowitej oferty brutto
    if (calculated.depositAmountGross > calculated.totalGross) {
      return {
        success: false,
        error: `Zaliczka wariantu ${v.variantNumber} (${calculated.depositAmountGross.toFixed(2)} zł) przekracza wartość całkowitą oferty (${calculated.totalGross.toFixed(2)} zł)`,
      };
    }

    variantCalculations.push({
      variantId: v.id,
      variantNumber: v.variantNumber,
      calculated,
      updatedItems,
    });
  }

  const vatRatePercent = resolveVatRate(propertyKind);
  const sentAt = new Date();
  const validityDays = SLA.QUOTE_VALIDITY.days;
  const validUntil = new Date(sentAt.getTime() + validityDays * 24 * 60 * 60 * 1000);

  const executeSend = async (tx: typeof prisma) => {
    // 1. Zamrożenie pozycji cennikowych (unitPriceNet i priceListItemVersionId)
    for (const vc of variantCalculations) {
      for (const it of vc.updatedItems) {
        await tx.quoteItem.update({
          where: { id: it.id },
          data: {
            unitPriceNet: it.unitPriceNet,
            priceListItemVersionId: it.priceListItemVersionId,
          },
        });
      }

      // 2. Zamrożenie sumy wariantu
      await tx.quoteVariant.update({
        where: { id: vc.variantId },
        data: {
          totalNetAmount: vc.calculated.totalNet,
        },
      });
    }

    // 3. Aktualizacja oferty
    await tx.quote.update({
      where: { id: quoteId },
      data: {
        status: 'SENT',
        sentAt,
        validUntil,
        vatRatePercent,
      },
    });

    if (tx.auditLog?.create) {
      await tx.auditLog.create({
        data: {
          actorEmail: 'system@klikklima.pl',
          actorRole: 'admin',
          operation: 'field_update',
          resource: 'quotes',
          recordId: quoteId,
          justification: 'Wysłanie wyceny oferty z zamrożeniem cen i stawek',
          legalBasis: 'OTHER',
        },
      });
    }
  };

  if (typeof prisma.$transaction === 'function') {
    await prisma.$transaction(async (tx) => {
      await executeSend(tx as unknown as typeof prisma);
    });
  } else {
    await executeSend(prisma);
  }

  return {
    success: true,
    sentAt,
    validUntil,
    vatRatePercent,
  };
}

/**
 * AC-W3, AC-W5: Wybór wariantu przez klienta — zapisuje selectedVariantId i zaliczkę depositAmountGross.
 */
export async function selectQuoteVariant(params: SelectQuoteVariantParams) {
  const { quoteId, quoteVariantId } = params;

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
  });

  if (!quote) {
    return {
      success: false,
      error: 'Oferta nie została odnaleziona',
    };
  }

  if (quote.status !== 'SENT') {
    return {
      success: false,
      error: 'Wybór wariantu jest dozwolony wyłącznie dla wysłanej oferty',
    };
  }

  if (quote.validUntil && new Date() > new Date(quote.validUntil)) {
    return {
      success: false,
      error: 'Oferta wygasła',
    };
  }

  // Idempotentny ponowny wybór tego samego wariantu
  if (quote.selectedVariantId === quoteVariantId) {
    return {
      success: true,
      depositAmountGross: Number(quote.depositAmountGross || 0),
    };
  }

  // Odrzucenie próby wyboru innego wariantu, jeśli wariant został już wcześniej wybrany
  if (quote.selectedVariantId !== null && quote.selectedVariantId !== undefined) {
    return {
      success: false,
      error: 'Wybrano już inny wariant oferty',
    };
  }

  const variant = await prisma.quoteVariant.findUnique({
    where: { id: quoteVariantId },
  });

  if (!variant || variant.quoteId !== quoteId) {
    return {
      success: false,
      error: 'Wskazany wariant nie należy do tej oferty',
    };
  }

  const items = await prisma.quoteItem.findMany({
    where: { quoteVariantId },
    include: { priceListItemVersion: true },
  });

  const quoteItemsInput: QuoteItemInput[] = (items || []).map((it) => ({
    quantity: Number(it.quantity),
    unitPriceNet: Number(it.unitPriceNet),
    crewCostNet: it.priceListItemVersion?.crewCostNet ? Number(it.priceListItemVersion.crewCostNet) : null,
    description: it.manualDescription || null,
  }));

  const propertyKind = (quote.propertyKind || 'RESIDENTIAL_UP_TO_THRESHOLD') as PropertyKind;

  const calculated = calculateQuoteVariant({
    propertyKind,
    equipmentNetAmount: Number(variant.equipmentNetAmount || 0),
    items: quoteItemsInput,
  });

  const depositAmountGross = calculated.depositAmountGross;

  await prisma.quote.update({
    where: { id: quoteId },
    data: {
      selectedVariantId: quoteVariantId,
      depositAmountGross,
    },
  });

  return {
    success: true,
    depositAmountGross,
  };
}

/**
 * AC-W3: Zwraca kwotę zaliczki zapisaną w kolumnie deposit_amount_gross (dla faktur i umów).
 */
export async function getQuoteDepositAmount(quoteId: string): Promise<number | null> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: { depositAmountGross: true },
  });

  if (!quote || quote.depositAmountGross === null || quote.depositAmountGross === undefined) {
    return null;
  }

  return Number(quote.depositAmountGross);
}

/**
 * AC-W5: Sprawdza gotowość oferty do przejścia do umowy lub faktury zaliczkowej.
 */
export async function isQuoteReadyForContract(quoteId: string): Promise<boolean> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: {
      status: true,
      selectedVariantId: true,
      depositAmountGross: true,
    },
  });

  if (!quote) return false;

  const isStatusValid = quote.status === 'SENT' || quote.status === 'ACCEPTED';
  const hasSelectedVariant = Boolean(quote.selectedVariantId);
  const hasDeposit = quote.depositAmountGross !== null && quote.depositAmountGross !== undefined;

  return isStatusValid && hasSelectedVariant && hasDeposit;
}

/**
 * AC-F2, AC-F3: Odtwarza ofertę wysłaną wyłącznie ze zamrożonych danych wierszy oferty (bez sięgania do cennika).
 */
export async function getSentQuoteSnapshot(quoteId: string): Promise<SentQuoteSnapshot> {
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: {
      variants: {
        include: {
          items: {
            include: {
              priceListItemVersion: true,
            },
          },
        },
      },
    },
  });

  if (!quote) {
    throw new Error('Oferta nie została odnaleziona');
  }

  const propertyKind = (quote.propertyKind || 'RESIDENTIAL_UP_TO_THRESHOLD') as PropertyKind;
  const vatRatePercent = quote.vatRatePercent ?? resolveVatRate(propertyKind);

  const calculatedVariants = (quote.variants || []).map((v) => {
    const quoteItemsInput: QuoteItemInput[] = (v.items || []).map((it) => ({
      quantity: Number(it.quantity),
      unitPriceNet: Number(it.unitPriceNet),
      crewCostNet: it.priceListItemVersion?.crewCostNet ? Number(it.priceListItemVersion.crewCostNet) : null,
      description: it.manualDescription || null,
    }));

    const calc = calculateQuoteVariant({
      propertyKind,
      equipmentNetAmount: Number(v.equipmentNetAmount || 0),
      items: quoteItemsInput,
    });

    return {
      id: v.id,
      variantNumber: v.variantNumber,
      name: v.name,
      totalNet: Number(v.totalNetAmount ?? calc.totalNet),
      vatAmount: calc.vatAmount,
      totalGross: calc.totalGross,
      depositAmountGross: calc.depositAmountGross,
    };
  });

  const selectedCalc =
    calculatedVariants.find((cv) => cv.id === quote.selectedVariantId) ||
    calculatedVariants[0] || {
      totalNet: 0,
      vatAmount: 0,
      totalGross: 0,
    };

  return {
    quoteId: quote.id,
    status: quote.status,
    propertyKind,
    vatRatePercent,
    totalNet: selectedCalc.totalNet,
    vatAmount: selectedCalc.vatAmount,
    totalGross: selectedCalc.totalGross,
    depositAmountGross: Number(quote.depositAmountGross || 0),
    selectedVariantId: quote.selectedVariantId,
    variants: calculatedVariants,
  };
}
