import { create } from "zustand";

export interface Room {
  id: string;
  area: string; // e.g., "Do 25m²", "26-35m²", "36-50m²", "Powyżej 50m²"
}

export interface TriageStateData {
  buildingType: string | null; // "Lokal komercyjny", "Dom", "Mieszkanie"
  roomsCount: string | null; // "1", "2", "3", "4+"
  rooms: Room[];
  condition: string | null; // "Wykończone", "Deweloperski / Remont"
  hasBalcony: boolean | null;
  floor: string | null; // "Parter, 1, 2", "Powyżej 2"
  address: string | null;
  lat: number | null;
  lng: number | null;
  // --- Faza 4.5: Dobór klimatyzacji ---
  selectedDeviceLine: string | null; // np. "KETA", "Flexis"
  selectedInternalUnits: any[]; // tablica przypisanych jednostek z bazy
  selectedExternalUnit: any | null; // agregat (jeśli multi)
  priceDevices: number;
  priceInstallation: number;
}

interface TriageStore {
  // Current step in the UI
  currentStep: number;
  
  // The actual answers
  data: TriageStateData;

  // Actions
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  
  updateData: (data: Partial<TriageStateData>) => void;
  reset: () => void;
  
  // Faza 4.5 helpers
  calculateRequiredPower: () => number;
}

const initialState: TriageStateData = {
  buildingType: null,
  roomsCount: null,
  rooms: [],
  condition: null,
  hasBalcony: null,
  floor: null,
  address: null,
  lat: null,
  lng: null,
  selectedDeviceLine: null,
  selectedInternalUnits: [],
  selectedExternalUnit: null,
  priceDevices: 0,
  priceInstallation: 0,
};

export const useTriageStore = create<TriageStore>((set, get) => ({
  currentStep: 1,
  data: initialState,
  
  setStep: (step) => set({ currentStep: step }),
  nextStep: () => set((state) => ({ currentStep: state.currentStep + 1 })),
  prevStep: () => set((state) => ({ currentStep: Math.max(1, state.currentStep - 1) })),
  
  updateData: (newData) => set((state) => ({ 
    data: { ...state.data, ...newData } 
  })),
  
  calculateRequiredPower: () => {
    const { rooms } = get().data;
    let totalKw = 0;
    rooms.forEach(room => {
      if (room.area === "Do 25m²") totalKw += 2.5;
      else if (room.area === "26-35m²") totalKw += 3.5;
      else if (room.area === "36-50m²") totalKw += 5.0;
      else if (room.area === "Powyżej 50m²") totalKw += 7.0; // Ekspert
    });
    return totalKw;
  },

  reset: () => set({ currentStep: 1, data: initialState }),
}));
