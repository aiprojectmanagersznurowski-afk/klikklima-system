import { prisma } from '@repo/database';
import {
  calculateQuoteVariant,
  type PropertyKind,
  type CalculatedQuoteVariant,
  type QuoteItemInput,
} from '@repo/pricing';

// @REQ: FLD-QUOTE-ROOMS
// @REQ: FLD-QUOTE-GENERAL-ITEMS
// @REQ: FLD-QUOTE-MANUAL-ITEM

export interface AddQuoteRoomParams {
  quoteVariantId: string;
  name: string;
  powerKw?: number | null;
}

export interface DeleteQuoteRoomParams {
  quoteRoomId: string;
}

export interface AddQuoteCatalogItemParams {
  quoteVariantId: string;
  quoteRoomId?: string | null;
  priceListItemId: string;
  quantity: number;
}

export interface AddQuoteManualItemParams {
  quoteVariantId: string;
  quoteRoomId?: string | null;
  manualName: string;
  manualDescription: string;
  unitPriceNet: number;
  quantity: number;
}

export interface DeleteQuoteItemParams {
  quoteItemId: string;
}

export interface CalculateVariantTotalsParams {
  quoteVariantId: string;
}

/**
 * AC-R1: Zwraca wyłącznie aktywne pozycje cennikowe dla pomieszczeń (scope = 'ROOM').
 */
export async function getRoomCatalogItems() {
  return await prisma.priceListItem.findMany({
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
}

/**
 * AC-G1: Zwraca wyłącznie aktywne pozycje cennikowe instalacji ogólnej (scope = 'INSTALLATION').
 */
export async function getGeneralCatalogItems() {
  return await prisma.priceListItem.findMany({
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
}

/**
 * AC-R3: Dodaje nowe pomieszczenie do wariantu oferty w stanie DRAFT.
 */
export async function addQuoteRoom(params: AddQuoteRoomParams) {
  const { quoteVariantId, name, powerKw } = params;

  const trimmedName = name?.trim();
  if (!trimmedName || trimmedName.length === 0) {
    return {
      success: false,
      error: 'Nazwa pomieszczenia nie może być pusta',
    };
  }

  if (powerKw !== undefined && powerKw !== null) {
    if (typeof powerKw !== 'number' || isNaN(powerKw) || powerKw <= 0) {
      return {
        success: false,
        error: 'Moc jednostki musi być większa od zera',
      };
    }
  }

  const variant = await prisma.quoteVariant.findUnique({
    where: { id: quoteVariantId },
    include: { quote: true },
  });

  if (!variant) {
    return {
      success: false,
      error: 'Wariant oferty nie został znaleziony',
    };
  }

  if (variant.quote.status !== 'DRAFT') {
    return {
      success: false,
      error: 'Modyfikacja oferty jest dozwolona wyłącznie w stanie DRAFT',
    };
  }

  const room = await prisma.quoteRoom.create({
    data: {
      quoteVariantId,
      name: trimmedName,
      powerKw: powerKw ? Math.round(powerKw * 100) / 100 : null,
    },
  });

  return {
    success: true,
    room,
  };
}

/**
 * AC-R4: Usuwa pomieszczenie wraz z kaskadowym usunięciem powiązanych pozycji i przeliczeniem sumy.
 */
export async function deleteQuoteRoom(params: DeleteQuoteRoomParams) {
  const { quoteRoomId } = params;

  const room = await prisma.quoteRoom.findUnique({
    where: { id: quoteRoomId },
    include: {
      quoteVariant: {
        include: { quote: true },
      },
    },
  });

  if (!room) {
    return {
      success: false,
      error: 'Pomieszczenie nie zostało odnalezione',
    };
  }

  if (room.quoteVariant.quote.status !== 'DRAFT') {
    return {
      success: false,
      error: 'Modyfikacja oferty jest dozwolona wyłącznie w stanie DRAFT',
    };
  }

  // Usunięcie kaskadowe pozycji i pomieszczenia w transakcji z wpisem audytowym
  if (typeof prisma.$transaction === 'function') {
    await prisma.$transaction(async (tx) => {
      await tx.quoteItem.deleteMany({
        where: { quoteRoomId },
      });

      await tx.quoteRoom.delete({
        where: { id: quoteRoomId },
      });

      await tx.auditLog.create({
        data: {
          actorEmail: 'system@klikklima.pl',
          actorRole: 'admin',
          operation: 'delete',
          resource: 'quotes',
          recordId: room.quoteVariant.quote.id,
          justification: `Usunięcie pomieszczenia ${room.name} z wyceny oferty`,
          legalBasis: 'OTHER',
        },
      });
    });
  } else {
    await prisma.quoteItem.deleteMany({
      where: { quoteRoomId },
    });

    await prisma.quoteRoom.delete({
      where: { id: quoteRoomId },
    });
  }

  // Przeliczenie sumy wariantu
  await calculateVariantTotals({ quoteVariantId: room.quoteVariantId });

  return {
    success: true,
  };
}

/**
 * AC-R1, AC-R2, AC-G2: Dodaje pozycję cennikową do wariantu oferty (do pomieszczenia lub ogólną).
 */
export async function addQuoteCatalogItem(params: AddQuoteCatalogItemParams) {
  const { quoteVariantId, quoteRoomId, priceListItemId, quantity } = params;

  if (typeof quantity !== 'number' || isNaN(quantity) || quantity <= 0) {
    return {
      success: false,
      error: 'Ilość musi być większa od zera',
    };
  }

  const variant = await prisma.quoteVariant.findUnique({
    where: { id: quoteVariantId },
    include: { quote: true },
  });

  if (!variant) {
    return {
      success: false,
      error: 'Wariant oferty nie został znaleziony',
    };
  }

  if (variant.quote.status !== 'DRAFT') {
    return {
      success: false,
      error: 'Modyfikacja oferty jest dozwolona wyłącznie w stanie DRAFT',
    };
  }

  if (quoteRoomId) {
    const room = await prisma.quoteRoom.findFirst({
      where: {
        id: quoteRoomId,
        quoteVariantId,
      },
    });

    if (!room) {
      return {
        success: false,
        error: 'Wskazane pomieszczenie nie należy do tego wariantu oferty',
      };
    }
  }

  const catalogItem = await prisma.priceListItem.findUnique({
    where: { id: priceListItemId },
    include: {
      versions: {
        where: { isCurrent: true },
      },
    },
  });

  if (!catalogItem) {
    return {
      success: false,
      error: 'Pozycja cennika nie została odnaleziona',
    };
  }

  if (!catalogItem.isActive) {
    return {
      success: false,
      error: 'Pozycja cennika jest nieaktywna',
    };
  }

  const currentVersion = catalogItem.versions?.find((v) => v.isCurrent) || catalogItem.versions?.[0];

  if (!currentVersion) {
    return {
      success: false,
      error: 'Pozycja cennika nie posiada aktywnej wersji ceny',
    };
  }

  // Weryfikacja zgodności scope z pomieszczeniem
  if (catalogItem.scope === 'ROOM' && !quoteRoomId) {
    return {
      success: false,
      error: 'Pozycja pomieszczenia wymaga wskazania pomieszczenia',
    };
  } else if (catalogItem.scope === 'INSTALLATION' && quoteRoomId) {
    return {
      success: false,
      error: 'Pozycja ogólna instalacji nie może być przypisana do pomieszczenia',
    };
  }

  const unitPriceNet = Number(currentVersion.salePriceNet);

  const item = await prisma.quoteItem.create({
    data: {
      quoteVariantId,
      quoteRoomId: catalogItem.scope === 'ROOM' ? quoteRoomId : null,
      scope: catalogItem.scope,
      priceListItemId,
      priceListItemVersionId: currentVersion.id,
      quantity,
      unitPriceNet,
    },
  });

  await calculateVariantTotals({ quoteVariantId });

  return {
    success: true,
    item,
  };
}

/**
 * AC-M1, AC-M2, AC-M3: Dodaje pozycję indywidualną (spoza cennika) z ręczną nazwą i opisem.
 */
export async function addQuoteManualItem(params: AddQuoteManualItemParams) {
  const { quoteVariantId, quoteRoomId, manualName, manualDescription, unitPriceNet, quantity } = params;

  if (typeof quantity !== 'number' || isNaN(quantity) || quantity <= 0) {
    return {
      success: false,
      error: 'Ilość musi być większa od zera',
    };
  }

  if (typeof unitPriceNet !== 'number' || isNaN(unitPriceNet) || unitPriceNet < 0) {
    return {
      success: false,
      error: 'Cena jednostkowa netto nie może być ujemna',
    };
  }

  const trimmedName = manualName?.trim();
  if (!trimmedName || trimmedName.length === 0) {
    return {
      success: false,
      error: 'Nazwa pozycji indywidualnej nie może być pusta',
    };
  }

  const trimmedDesc = manualDescription?.trim();
  if (!trimmedDesc || trimmedDesc.length === 0) {
    return {
      success: false,
      error: 'Opis pozycji indywidualnej nie może być pusty',
    };
  }

  const variant = await prisma.quoteVariant.findUnique({
    where: { id: quoteVariantId },
    include: { quote: true },
  });

  if (!variant) {
    return {
      success: false,
      error: 'Wariant oferty nie został znaleziony',
    };
  }

  if (variant.quote.status !== 'DRAFT') {
    return {
      success: false,
      error: 'Modyfikacja oferty jest dozwolona wyłącznie w stanie DRAFT',
    };
  }

  if (quoteRoomId) {
    const room = await prisma.quoteRoom.findFirst({
      where: {
        id: quoteRoomId,
        quoteVariantId,
      },
    });

    if (!room) {
      return {
        success: false,
        error: 'Wskazane pomieszczenie nie należy do tego wariantu oferty',
      };
    }
  }

  const scope = quoteRoomId ? 'ROOM' : 'INSTALLATION';

  const item = await prisma.quoteItem.create({
    data: {
      quoteVariantId,
      quoteRoomId: quoteRoomId || null,
      scope,
      priceListItemId: null,
      priceListItemVersionId: null,
      manualName: trimmedName,
      manualDescription: trimmedDesc,
      quantity,
      unitPriceNet,
    },
  });

  await calculateVariantTotals({ quoteVariantId });

  return {
    success: true,
    item,
  };
}

/**
 * Usuwa pozycję z oferty i przelicza sumę wariantu.
 */
export async function deleteQuoteItem(params: DeleteQuoteItemParams) {
  const { quoteItemId } = params;

  const item = await prisma.quoteItem.findUnique({
    where: { id: quoteItemId },
    include: {
      quoteVariant: {
        include: { quote: true },
      },
    },
  });

  if (!item) {
    return {
      success: false,
      error: 'Pozycja nie została odnaleziona',
    };
  }

  if (item.quoteVariant.quote.status !== 'DRAFT') {
    return {
      success: false,
      error: 'Modyfikacja oferty jest dozwolona wyłącznie w stanie DRAFT',
    };
  }

  // Usunięcie pozycji w transakcji z wpisem audytowym
  if (typeof prisma.$transaction === 'function') {
    await prisma.$transaction(async (tx) => {
      await tx.quoteItem.delete({
        where: { id: quoteItemId },
      });

      await tx.auditLog.create({
        data: {
          actorEmail: 'system@klikklima.pl',
          actorRole: 'admin',
          operation: 'delete',
          resource: 'quotes',
          recordId: item.quoteVariant.quote.id,
          justification: 'Usunięcie pozycji kosztorysowej ze szkicu wyceny oferty',
          legalBasis: 'OTHER',
        },
      });
    });
  } else {
    await prisma.quoteItem.delete({
      where: { id: quoteItemId },
    });
  }

  await calculateVariantTotals({ quoteVariantId: item.quoteVariantId });

  return {
    success: true,
  };
}

/**
 * AC-G4, AC-M3: Przelicza sumy netto, VAT, brutto i marżę wariantu z użyciem @repo/pricing.
 */
export async function calculateVariantTotals(
  params: CalculateVariantTotalsParams
): Promise<{ success: boolean; error?: string } & Partial<CalculatedQuoteVariant>> {
  const { quoteVariantId } = params;

  const variant = await prisma.quoteVariant.findUnique({
    where: { id: quoteVariantId },
    include: {
      quote: true,
    },
  });

  if (!variant) {
    return {
      success: false,
      error: 'Wariant oferty nie został znaleziony',
    };
  }

  const rawItems = await prisma.quoteItem.findMany({
    where: { quoteVariantId },
    include: {
      priceListItemVersion: true,
    },
  });
  const items = Array.isArray(rawItems) ? rawItems : [];

  const propertyKind = ((variant.quote && variant.quote.propertyKind) || 'RESIDENTIAL_UP_TO_THRESHOLD') as PropertyKind;

  const quoteItemsInput: QuoteItemInput[] = items.map((it) => ({
    quantity: Number(it.quantity),
    unitPriceNet: Number(it.unitPriceNet),
    crewCostNet: it.priceListItemVersion?.crewCostNet
      ? Number(it.priceListItemVersion.crewCostNet)
      : null,
    description: it.manualDescription || null,
  }));

  const calculated = calculateQuoteVariant({
    propertyKind,
    equipmentNetAmount: Number(variant.equipmentNetAmount || 0),
    items: quoteItemsInput,
  });

  await prisma.quoteVariant.update({
    where: { id: quoteVariantId },
    data: {
      totalNetAmount: calculated.totalNet,
    },
  });

  return {
    success: true,
    ...calculated,
  };
}
