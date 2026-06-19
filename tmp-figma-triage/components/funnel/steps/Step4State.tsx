import React from 'react';
import { PaintRoller, Sparkles, Hammer } from 'lucide-react';
import { useFunnel, BuildingState } from '../FunnelContext';
import { OptionCard } from '../OptionCard';
import { StepWrapper } from '../StepWrapper';

export const Step4State = () => {
  const { state, updateState, nextStep } = useFunnel();

  const handleSelect = (buildingState: BuildingState) => {
    updateState({ buildingState });
    setTimeout(nextStep, 350);
  };

  return (
    <StepWrapper 
      title="Jaki jest stan budynku/lokalu?" 
      subtitle="Pomaga to w określeniu metody poprowadzenia instalacji."
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <OptionCard
          title="Wykończony / Zamieszkany"
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
