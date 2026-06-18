"use client";
import React from 'react';
import { PaintRoller, Sparkles, Hammer } from 'lucide-react';
import { useTriageStore, BuildingState } from '@/store/triageStore';
import { OptionCard } from '../OptionCard';
import { StepWrapper } from '../StepWrapper';

export const Step4State = () => {
  const { data: state, updateData, nextStep } = useTriageStore();

  const handleSelect = (buildingState: BuildingState) => {
    updateData({ buildingState });
    setTimeout(nextStep, 350);
  };

  return (
    <StepWrapper 
      title="Jaki jest stan budynku/lokalu?" 
      subtitle="Pomaga to w określeniu metody poprowadzenia instalacji."
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <OptionCard
          title="Wykończony"
          icon={<Sparkles size={40} strokeWidth={1.5} />}
          selected={state.buildingState === 'Wykończony / Zamieszkany'}
          onClick={() => handleSelect('Wykończony / Zamieszkany')}
        />
        <OptionCard
          title="W trakcie remontu"
          icon={<PaintRoller size={40} strokeWidth={1.5} />}
          selected={state.buildingState === 'W trakcie remontu'}
          onClick={() => handleSelect('W trakcie remontu')}
        />
        <OptionCard
          title="Stan deweloperski"
          icon={<Hammer size={40} strokeWidth={1.5} />}
          selected={state.buildingState === 'Stan deweloperski'}
          onClick={() => handleSelect('Stan deweloperski')}
        />
      </div>
    </StepWrapper>
  );
};
