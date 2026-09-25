import { create } from "zustand";
import {
  BUILDING_TYPE_PL,
  disqualifyingRules,
  isExpertScreen as isExpertScreenContract,
  isTriageFieldVisible,
  type BuildingTypeId,
  type DisqualificationRuleId,
  type PropertyAreaBandId,
  type TriageAnswers,
} from "@klikklima/contracts";

// Store trzyma etykietę PL (`location`), kontrakt operuje na identyfikatorze
// (`BUILDING_TYPE`). `BUILDING_TYPE_PL` daje id -> pl; tu odwracamy mapowanie
// lokalnie — dokładnie ten sam wzorzec, jakiego `Step7Success.tsx` używa dla
// wywołania Server Action (WO B2C-TRIAGE-DISQUALIFY).
const BUILDING_TYPE_ID_BY_PL: Record<string, BuildingTypeId> = Object.fromEntries(
  (Object.entries(BUILDING_TYPE_PL) as [BuildingTypeId, string][]).map(([id, pl]) => [pl, id])
);

export type LocationType = 'Mieszkanie' | 'Dom' | 'Lokal komercyjny' | null;
export type RoomCount = 1 | 2 | 3 | 4 | 5 | null;
export type RoomSize = 'Do 20 m²' | '21-25 m²' | '26-35 m²' | 'Powyżej 35 m²';
export type BuildingState = 'Wykończony / Zamieszkany' | 'W trakcie remontu' | 'Stan deweloperski' | null;

export interface TriageStateData {
  // --- Krok 1 do 5 ---
  location: LocationType;
  propertyAreaBand: PropertyAreaBandId | null;
  roomCount: RoomCount;
  roomSizes: Record<number, RoomSize>;
  buildingState: BuildingState;
  hasBalcony: boolean | null;
  floor: 'Parter, 1 lub 2' | 'Powyżej 2. piętra' | null;
  
  // --- Krok 8: Rezerwacja (formularz i data) ---
  selectedDate: Date | null;
  selectedSlot: string | null;
  name: string;
  phone: string;
  email: string;
  address: string;

  // --- Faza 4.5: Dobór klimatyzacji ---
  selectedDeviceLine: string | null; // np. "KETA", "Flexis"
  selectedInternalUnits: any[]; // tablica przypisanych jednostek z bazy
  selectedExternalUnit: any | null; // agregat (jeśli multi)
  priceDevices: number;
  priceInstallation: number;
}

interface TriageStore {
  // Current step in the UI
  step: number;
  direction: number; // For Framer Motion animations (1 = forward, -1 = backward)
  
  // The actual answers
  data: TriageStateData;

  // Actions
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  
  updateData: (data: Partial<TriageStateData>) => void;
  reset: () => void;
  
  // Helpers
  isExpertScreen: boolean;
  disqualifyingRuleIds: DisqualificationRuleId[];
  calculateRequiredPower: () => number;
}

/** Odpowiedzi kreatora w kształcie oczekiwanym przez predykaty kontraktu (null-safe). */
function toTriageAnswers(
  location: LocationType,
  roomCount: RoomCount,
  propertyAreaBand?: PropertyAreaBandId | null
): TriageAnswers {
  const answers: TriageAnswers = {};
  if (location) {
    const buildingType = BUILDING_TYPE_ID_BY_PL[location];
    if (buildingType) answers.BUILDING_TYPE = buildingType;
  }
  if (typeof roomCount === 'number') {
    answers.ROOM_COUNT = roomCount;
  }
  if (propertyAreaBand) {
    answers.PROPERTY_AREA_BAND = propertyAreaBand;
  }
  return answers;
}

const initialState: TriageStateData = {
  location: null,
  propertyAreaBand: null,
  roomCount: null,
  roomSizes: {},
  buildingState: null,
  hasBalcony: null,
  floor: null,
  
  selectedDate: null,
  selectedSlot: null,
  name: '',
  phone: '',
  email: '',
  address: '',

  selectedDeviceLine: null,
  selectedInternalUnits: [],
  selectedExternalUnit: null,
  priceDevices: 0,
  priceInstallation: 0,
};

export const useTriageStore = create<TriageStore>((set, get) => ({
  step: 1,
  direction: 1,
  data: initialState,

  // `isExpertScreen`/`disqualifyingRuleIds` NIE są gettery na obiekcie store'a.
  // Zustand scala kolejne stany przez `Object.assign({}, state, nextState)`,
  // co odczytuje (i zamraża jako zwykłą wartość) każdy getter przy PIERWSZYM
  // `set()` — kolejne aktualizacje `data` nigdy by go już nie przeliczyły.
  // Dlatego te pola są zwykłymi wartościami, przeliczanymi jawnie w `updateData`
  // i `reset` — jedynych akcjach zmieniających `data`.
  isExpertScreen: isExpertScreenContract(toTriageAnswers(initialState.location, initialState.roomCount, initialState.propertyAreaBand)),
  disqualifyingRuleIds: disqualifyingRules(toTriageAnswers(initialState.location, initialState.roomCount, initialState.propertyAreaBand)),

  goToStep: (stepNumber) => set((state) => ({
    step: stepNumber, 
    direction: stepNumber > state.step ? 1 : -1 
  })),
  
  nextStep: () => set((state) => {
    // Jeżeli użytkownik przyszedł z modala, to `selectedDeviceLine` nie jest nullem
    // oraz z Kroku 1 przechodzi od razu do Kroku 4 (Stan budynku), omijając Pokoje (2) i Metraż (3).
    let next = state.step + 1;
    if (state.step === 1 && state.data.selectedDeviceLine) {
      next = 4;
    } else if (state.step === 4 && state.data.location !== BUILDING_TYPE_PL.APARTMENT) {
      next = 6;
    }
    
    return { 
      step: next, 
      direction: 1 
    };
  }),
  
  prevStep: () => set((state) => {
    let prev = state.step - 1;
    if (state.step === 4 && state.data.selectedDeviceLine) {
      prev = 1;
    } else if (state.step === 6 && state.data.location !== BUILDING_TYPE_PL.APARTMENT) {
      prev = 4;
    }
    // Zabezpieczenie: Cofając się z 7 kroku (lub jeśli z jakiegoś powodu jesteśmy na 6)
    // przeskakujemy ekran loadera bezpośrednio do kroku 5.
    if (prev === 6) {
      if (state.data.location === BUILDING_TYPE_PL.APARTMENT) {
        prev = 5;
      } else {
        prev = 4;
      }
    }
    return { 
      step: Math.max(1, prev), 
      direction: -1 
    };
  }),
  
  updateData: (newData) => set((state) => {
    const data = { ...state.data, ...newData };
    // AC1: Zmiana typu (np. na Lokal komercyjny), gdy pole PROPERTY_AREA_BAND
    // przestaje być widoczne wg kontraktu, usuwa odpowiedź ze stanu.
    const answersBeforeGuard = toTriageAnswers(data.location, data.roomCount, data.propertyAreaBand);
    if (!isTriageFieldVisible('PROPERTY_AREA_BAND', answersBeforeGuard)) {
      data.propertyAreaBand = null;
    }
    const answers = toTriageAnswers(data.location, data.roomCount, data.propertyAreaBand);
    return {
      data,
      isExpertScreen: isExpertScreenContract(answers),
      disqualifyingRuleIds: disqualifyingRules(answers),
    };
  }),
  
  calculateRequiredPower: () => {
    const { roomSizes, roomCount } = get().data;
    let totalKw = 0;
    if (roomCount) {
      for (let i = 1; i <= roomCount; i++) {
        const size = roomSizes[i];
        if (size === 'Do 20 m²') totalKw += 2.5;
        else if (size === '21-25 m²') totalKw += 3.5;
        else if (size === '26-35 m²') totalKw += 5.0;
        else if (size === 'Powyżej 35 m²') totalKw += 7.0;
      }
    }
    return totalKw;
  },

  reset: () => set({
    step: 1,
    direction: 1,
    data: initialState,
    isExpertScreen: isExpertScreenContract(toTriageAnswers(initialState.location, initialState.roomCount, initialState.propertyAreaBand)),
    disqualifyingRuleIds: disqualifyingRules(toTriageAnswers(initialState.location, initialState.roomCount, initialState.propertyAreaBand)),
  }),
}));
