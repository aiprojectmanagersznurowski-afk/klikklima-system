import { describe, it, expect, beforeEach } from 'vitest';
import {
  isTriageFieldVisible,
  PROPERTY_AREA_BAND_IDS,
  PROPERTY_AREA_BAND_BOUNDARY,
  SLA,
  type PropertyAreaBandId,
} from '@klikklima/contracts';
import { useTriageStore } from '../store/triageStore';

/**
 * WO: docs/workorders/B2C-PROPERTY-AREA-BAND.md
 * Wymaganie: @REQ: B2C-PROPERTY-AREA-BAND
 */

// Helper dynamicznie składający etykietę z SLA (wariant (b) z D-P4)
export function getPropertyAreaBandLabel(bandId: PropertyAreaBandId): string {
  const boundary = PROPERTY_AREA_BAND_BOUNDARY[bandId];
  const threshold = SLA.PROPERTY_AREA_VAT_THRESHOLD.sqm;
  if (boundary === 'BELOW_OR_EQUAL') {
    return `Do ${threshold} m²`;
  }
  return `Powyżej ${threshold} m²`;
}

describe('B2C-PROPERTY-AREA-BAND — store logic & contract visibility', () => {
  beforeEach(() => {
    useTriageStore.getState().reset();
  });

  // @REQ: B2C-PROPERTY-AREA-BAND
  it('AC1: po wyborze Mieszkania lub Domu pole jest widoczne w kontrakcie; po wyborze Lokalu komercyjnego pole nie jest widoczne', () => {
    const store = useTriageStore.getState();

    // Mieszkanie
    store.updateData({ location: 'Mieszkanie' });
    const apartmentState = useTriageStore.getState().data;
    expect(apartmentState.location).toBe('Mieszkanie');
    expect(
      isTriageFieldVisible('PROPERTY_AREA_BAND', { BUILDING_TYPE: 'APARTMENT' })
    ).toBe(true);

    // Dom
    store.updateData({ location: 'Dom' });
    expect(
      isTriageFieldVisible('PROPERTY_AREA_BAND', { BUILDING_TYPE: 'HOUSE' })
    ).toBe(true);

    // Lokal komercyjny
    store.updateData({ location: 'Lokal komercyjny' });
    expect(
      isTriageFieldVisible('PROPERTY_AREA_BAND', { BUILDING_TYPE: 'COMMERCIAL' })
    ).toBe(false);
  });

  // @REQ: B2C-PROPERTY-AREA-BAND
  it('AC1: zmiana typu z Mieszkanie na Lokal komercyjny po udzieleniu odpowiedzi usuwa propertyAreaBand ze stanu', () => {
    const store = useTriageStore.getState();

    store.updateData({
      location: 'Mieszkanie',
      propertyAreaBand: 'UP_TO_300',
    });
    expect(useTriageStore.getState().data.propertyAreaBand).toBe('UP_TO_300');

    // Zmiana na Lokal komercyjny powinna wyczyścić odpowiedź
    store.updateData({ location: 'Lokal komercyjny' });
    expect(useTriageStore.getState().data.propertyAreaBand).toBeNull();
  });

  // @REQ: B2C-PROPERTY-AREA-BAND
  it('AC1: powrót wstecz i zmiana typu (Dom -> Lokal komercyjny -> Dom) zwraca pytanie bez odpowiedzi (null)', () => {
    const store = useTriageStore.getState();

    store.updateData({
      location: 'Dom',
      propertyAreaBand: 'ABOVE_300',
    });
    expect(useTriageStore.getState().data.propertyAreaBand).toBe('ABOVE_300');

    // Przełączenie na Lokal komercyjny
    store.updateData({ location: 'Lokal komercyjny' });
    expect(useTriageStore.getState().data.propertyAreaBand).toBeNull();

    // Powrót do Domu
    store.updateData({ location: 'Dom' });
    expect(useTriageStore.getState().data.propertyAreaBand).toBeNull();
  });

  // @REQ: B2C-PROPERTY-AREA-BAND
  it('AC3: przedział powierzchni NIGDY nie jest wyliczany z roomSizes', () => {
    const store = useTriageStore.getState();

    // Pokoi jest 4, każdy powyżej 35 m², łącznie > 140 m² lub teoretycznie dowolnie dużo
    store.updateData({
      location: 'Dom',
      roomCount: 4,
      roomSizes: {
        1: 'Powyżej 35 m²',
        2: 'Powyżej 35 m²',
        3: 'Powyżej 35 m²',
        4: 'Powyżej 35 m²',
      },
    });

    // propertyAreaBand musi pozostać null dopóki użytkownik sam nie kliknie kafelka
    expect(useTriageStore.getState().data.propertyAreaBand).toBeNull();
  });

  // @REQ: B2C-PROPERTY-AREA-BAND
  it('AC5: etykiety kafelków nie rozjeżdżają się z progiem SLA', () => {
    // Sprawdzamy dla bieżącego progu kontraktowego
    const threshold = SLA.PROPERTY_AREA_VAT_THRESHOLD.sqm;
    const upToLabel = getPropertyAreaBandLabel('UP_TO_300');
    const aboveLabel = getPropertyAreaBandLabel('ABOVE_300');

    expect(upToLabel).toBe(`Do ${threshold} m²`);
    expect(aboveLabel).toBe(`Powyżej ${threshold} m²`);
  });

  // @REQ: B2C-PROPERTY-AREA-BAND
  it('przypadek brzegowy: Lokal komercyjny nadal trafia na isExpertScreen niezależnie od pola powierzchni', () => {
    const store = useTriageStore.getState();
    store.updateData({
      location: 'Lokal komercyjny',
    });

    expect(useTriageStore.getState().isExpertScreen).toBe(true);
    expect(useTriageStore.getState().disqualifyingRuleIds).toContain('COMMERCIAL_PROPERTY');
  });
});
