import React from 'react';
import { Building2, Home, Store } from 'lucide-react';
import { useFunnel, LocationType } from '../FunnelContext';
import { OptionCard } from '../OptionCard';
import { StepWrapper } from '../StepWrapper';

export const Step1Location = () => {
  const { state, updateState, nextStep } = useFunnel();

  const handleSelect = (location: LocationType) => {
    updateState({ location });
    setTimeout(nextStep, 350); // Small delay to show the selected state animation
  };

  return (
    <StepWrapper 
      title="Gdzie chcesz zamontować klimatyzację?" 
      subtitle="Wybierz typ nieruchomości, abyśmy mogli dopasować idealne rozwiązanie."
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <OptionCard
          title="Mieszkanie"
          icon={<Building2 size={40} strokeWidth={1.5} />}
          selected={state.location === 'Mieszkanie'}
          onClick={() => handleSelect('Mieszkanie')}
        />
        <OptionCard
          title="Dom"
          icon={<Home size={40} strokeWidth={1.5} />}
          selected={state.location === 'Dom'}
          onClick={() => handleSelect('Dom')}
        />
        <OptionCard
          title="Lokal komercyjny"
          icon={<Store size={40} strokeWidth={1.5} />}
          selected={state.location === 'Lokal komercyjny'}
          onClick={() => handleSelect('Lokal komercyjny')}
        />
      </div>
    </StepWrapper>
  );
};
