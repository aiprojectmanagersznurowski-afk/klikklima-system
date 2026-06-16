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
};

export const useTriageStore = create<TriageStore>((set) => ({
  currentStep: 1,
  data: initialState,
  
  setStep: (step) => set({ currentStep: step }),
  nextStep: () => set((state) => ({ currentStep: state.currentStep + 1 })),
  prevStep: () => set((state) => ({ currentStep: Math.max(1, state.currentStep - 1) })),
  
  updateData: (newData) => set((state) => ({ 
    data: { ...state.data, ...newData } 
  })),
  
  reset: () => set({ currentStep: 1, data: initialState }),
}));
