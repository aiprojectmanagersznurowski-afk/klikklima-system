import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PROPERTY_CONDITION_IDS, PROPERTY_CONDITION_PL, ROOM_SIZE_BANDS } from '@klikklima/contracts';
import { useTriageStore } from '../../store/triageStore';

describe('B2C-TRIAGE-STEPS & B2C-TRIAGE-CONDITIONAL — mechanika kroków i stan store', () => {
  beforeEach(() => {
    useTriageStore.getState().reset();
  });

  // @REQ: B2C-TRIAGE-CONDITIONAL
  it('pominięty krok nie zostawia w odpowiedziach wartości domyślnej: pasmo metrażu jest puste po resecie', () => {
    const store = useTriageStore.getState();
    // Kryterium 3: Pominięty krok nie zostawia w odpowiedziach wartości domyślnej udającej deklarację klienta
    // test sprawdza, że pasmo metrażu jest puste, a nie ustawione na pierwszy element ROOM_SIZE_BANDS
    expect(store.data.roomSizes).toEqual({});
    expect(store.data.roomSizes[1]).toBeUndefined();
  });

  // @REQ: B2C-TRIAGE-STEPS
  it('wypełnienie kroków 1-4, cofnięcie przyciskiem „Wstecz" do kroku 1 zachowuje odpowiedzi kroków 2-4', () => {
    const store = useTriageStore.getState();

    // Krok 1: Wybór lokalizacji
    store.updateData({ location: 'Mieszkanie' });
    store.goToStep(2);

    // Krok 2: Liczba pokoi
    store.updateData({ roomCount: 2 });
    store.goToStep(3);

    // Krok 3: Metraże
    store.updateData({
      roomSizes: {
        1: 'Do 20 m²',
        2: '21-25 m²',
      },
    });
    store.goToStep(4);

    // Krok 4: Stan lokalu
    store.updateData({ buildingState: 'W trakcie remontu' });

    // Cofanie do kroku 1
    store.prevStep(); // krok 3
    store.prevStep(); // krok 2
    store.prevStep(); // krok 1

    expect(useTriageStore.getState().step).toBe(1);

    // Weryfikacja zachowania odpowiedzi
    const state = useTriageStore.getState().data;
    expect(state.location).toBe('Mieszkanie');
    expect(state.roomCount).toBe(2);
    expect(state.roomSizes[1]).toBe('Do 20 m²');
    expect(state.roomSizes[2]).toBe('21-25 m²');
    expect(state.buildingState).toBe('W trakcie remontu');
  });

  // @REQ: B2C-TRIAGE-STEPS
  it('ponowne przejście naprzód po cofnięciu nie czyści ani nie duplikuje odpowiedzi', () => {
    const store = useTriageStore.getState();
    store.updateData({
      location: 'Dom',
      roomCount: 3,
      roomSizes: { 1: 'Do 20 m²', 2: '21-25 m²', 3: '26-35 m²' },
      buildingState: 'Stan deweloperski',
    });

    store.goToStep(4);
    store.goToStep(1);

    // Przejście naprzód
    store.nextStep(); // 2
    store.nextStep(); // 3
    store.nextStep(); // 4

    const state = useTriageStore.getState().data;
    expect(state.location).toBe('Dom');
    expect(state.roomCount).toBe(3);
    expect(Object.keys(state.roomSizes).length).toBe(3);
    expect(state.buildingState).toBe('Stan deweloperski');
  });

  // @REQ: B2C-TRIAGE-CONDITIONAL
  it('pytania o balkon i piętro są pomijane dla Domu i Lokalu komercyjnego (przejście 4 -> 6, wstecz 6 -> 4)', () => {
    const store = useTriageStore.getState();

    // Dom
    store.updateData({ location: 'Dom', buildingState: 'Wykończony / Zamieszkany' });
    store.goToStep(4);
    store.nextStep();
    expect(useTriageStore.getState().step).toBe(6);

    store.prevStep();
    expect(useTriageStore.getState().step).toBe(4);

    // Lokal komercyjny
    store.updateData({ location: 'Lokal komercyjny', buildingState: 'Wykończony / Zamieszkany' });
    store.goToStep(4);
    store.nextStep();
    expect(useTriageStore.getState().step).toBe(6);

    store.prevStep();
    expect(useTriageStore.getState().step).toBe(4);
  });

  // @REQ: B2C-TRIAGE-CONDITIONAL
  it('wejście do Triage z karty produktu pomija kroki 2 i 3, a cofanie z kroku 4 wraca do kroku 1', () => {
    const store = useTriageStore.getState();

    // Symulacja wejścia z karty urządzenia
    store.updateData({
      selectedDeviceLine: 'KJCAL',
      location: 'Mieszkanie',
    });
    store.goToStep(1);

    // Przejście z kroku 1 pomija kroki 2 i 3 (idzie do 4)
    store.nextStep();
    expect(useTriageStore.getState().step).toBe(4);

    // Cofanie z kroku 4 wraca bezpośrednio do kroku 1
    store.prevStep();
    expect(useTriageStore.getState().step).toBe(1);
  });

  // @REQ: B2C-TRIAGE-STEPS
  it('krok 4 (stan lokalu) prezentuje dokładnie wartości ze słownika PROPERTY_CONDITIONS wraz z ich etykietami PL', () => {
    const step4Path = join(process.cwd(), 'apps/b2c-web/components/triage/steps/Step4State.tsx');
    const content = readFileSync(step4Path, 'utf8');

    // Sprawdzenie, czy komponent zawiera wszystkie etykiety ze słownika PROPERTY_CONDITIONS
    for (const id of PROPERTY_CONDITION_IDS) {
      expect(content).toContain(PROPERTY_CONDITION_PL[id]);
    }

    // Kafelek "Wykończony" bez "/ Zamieszkany" jest niezgodny z etykietą kontraktu
    expect(content).toContain(PROPERTY_CONDITION_PL.FINISHED); // 'Wykończony / Zamieszkany'
  });
});
