import { create } from "zustand";

export type LocationType = 'Mieszkanie' | 'Dom' | 'Lokal komercyjny' | null;
export type RoomCount = 1 | 2 | 3 | 4 | 5 | null;
export type RoomSize = 'Do 20 m²' | '21-25 m²' | '26-35 m²' | 'Powyżej 35 m²';
export type BuildingState = 'Wykończony / Zamieszkany' | 'W trakcie remontu' | 'Stan deweloperski' | null;

export interface TriageStateData {
  // --- Krok 1 do 5 ---
  location: LocationType;
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
  calculateRequiredPower: () => number;
}

const initialState: TriageStateData = {
  location: null,
  roomCount: null,
  roomSizes: { 1: 'Do 20 m²' },
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
  
  get isExpertScreen() {
    const { location, roomCount } = get().data;
    return location === 'Lokal komercyjny';
  },

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
    }
    // Zabezpieczenie: Cofając się z 7 kroku (lub jeśli z jakiegoś powodu jesteśmy na 6)
    // przeskakujemy ekran loadera bezpośrednio do kroku 5.
    if (prev === 6) {
      prev = 5;
    }
    return { 
      step: Math.max(1, prev), 
      direction: -1 
    };
  }),
  
  updateData: (newData) => set((state) => ({ 
    data: { ...state.data, ...newData } 
  })),
  
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

  reset: () => set({ step: 1, direction: 1, data: initialState }),
}));
