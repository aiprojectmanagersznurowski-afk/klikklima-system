import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';

export type LocationType = 'Mieszkanie' | 'Dom' | 'Lokal komercyjny' | null;
export type RoomCount = 1 | 2 | 3 | 4 | null;
export type RoomSize = 'Do 25 m²' | '26-35 m²' | '36-50 m²' | 'Powyżej 50 m²';
export type BuildingState = 'Wykończony / Zamieszkany' | 'W trakcie remontu' | 'Stan deweloperski' | null;

export interface FunnelState {
  step: number;
  location: LocationType;
  roomCount: RoomCount;
  roomSizes: Record<number, RoomSize>;
  buildingState: BuildingState;
  hasBalcony: boolean | null;
  floor: 'Parter, 1 lub 2' | 'Powyżej 2. piętra' | null;
  direction: number; // for animation
}

interface FunnelContextType {
  state: FunnelState;
  nextStep: () => void;
  prevStep: () => void;
  goToStep: (step: number) => void;
  updateState: (updates: Partial<FunnelState>) => void;
  isExpertScreen: boolean;
}

const FunnelContext = createContext<FunnelContextType | undefined>(undefined);

export const FunnelProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<FunnelState>({
    step: 1,
    location: null,
    roomCount: null,
    roomSizes: { 1: 'Do 25 m²' },
    buildingState: null,
    hasBalcony: null,
    floor: null,
    direction: 1,
  });

  // Calculate if they need expert screen
  const isExpertScreen = 
    state.location === 'Lokal komercyjny' || 
    state.roomCount === 4;

  const updateState = useCallback((updates: Partial<FunnelState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const nextStep = useCallback(() => {
    setState((prev) => ({ ...prev, step: prev.step + 1, direction: 1 }));
  }, []);

  const prevStep = useCallback(() => {
    setState((prev) => ({ ...prev, step: Math.max(1, prev.step - 1), direction: -1 }));
  }, []);

  const goToStep = useCallback((step: number) => {
    setState((prev) => ({ ...prev, step, direction: step > prev.step ? 1 : -1 }));
  }, []);

  return (
    <FunnelContext.Provider value={{ state, nextStep, prevStep, goToStep, updateState, isExpertScreen }}>
      {children}
    </FunnelContext.Provider>
  );
};

export const useFunnel = () => {
  const context = useContext(FunnelContext);
  if (!context) throw new Error('useFunnel must be used within FunnelProvider');
  return context;
};
