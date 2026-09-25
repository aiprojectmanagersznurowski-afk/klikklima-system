"use client";
import React from 'react';
import { Building2, Home, Store, Minimize2, Maximize2 } from 'lucide-react';
import {
  BUILDING_TYPE_PL,
  isTriageFieldVisible,
  PROPERTY_AREA_BAND_IDS,
  PROPERTY_AREA_BAND_BOUNDARY,
  SLA,
  type BuildingTypeId,
  type PropertyAreaBandId,
  type TriageAnswers,
} from '@klikklima/contracts';
import { useTriageStore, LocationType } from '@/store/triageStore';
import { OptionCard } from '../OptionCard';
import { StepWrapper } from '../StepWrapper';

const BUILDING_TYPE_ID_BY_PL: Record<string, BuildingTypeId> = Object.fromEntries(
  (Object.entries(BUILDING_TYPE_PL) as [BuildingTypeId, string][]).map(([id, pl]) => [pl, id])
);

export const Step1Location = () => {
  const { data: state, updateData, nextStep } = useTriageStore();

  const buildingType = state.location ? (BUILDING_TYPE_ID_BY_PL[state.location] ?? state.location) : undefined;
  const currentAnswers: TriageAnswers = buildingType ? { BUILDING_TYPE: buildingType } : {};
  const showAreaBand = isTriageFieldVisible('PROPERTY_AREA_BAND', currentAnswers);

  const handleSelectLocation = (location: LocationType) => {
    updateData({ location });
    const bType = location ? (BUILDING_TYPE_ID_BY_PL[location] ?? location) : undefined;
    const answers: TriageAnswers = bType ? { BUILDING_TYPE: bType } : {};
    if (!isTriageFieldVisible('PROPERTY_AREA_BAND', answers)) {
      setTimeout(nextStep, 350);
    }
  };

  const handleSelectAreaBand = (propertyAreaBand: PropertyAreaBandId) => {
    updateData({ propertyAreaBand });
    setTimeout(nextStep, 350);
  };

  return (
    <StepWrapper 
      title="Gdzie chcesz zamontować klimatyzację?" 
      subtitle="Wybierz typ nieruchomości, abyśmy mogli dopasować idealne rozwiązanie"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        <OptionCard
          title={BUILDING_TYPE_PL.APARTMENT}
          icon={<Building2 size={40} strokeWidth={1.5} />}
          selected={state.location === BUILDING_TYPE_PL.APARTMENT}
          onClick={() => handleSelectLocation(BUILDING_TYPE_PL.APARTMENT as LocationType)}
        />
        <OptionCard
          title="Dom"
          icon={<Home size={40} strokeWidth={1.5} />}
          selected={state.location === 'Dom'}
          onClick={() => handleSelectLocation('Dom')}
        />
        <OptionCard
          title="Lokal komercyjny"
          icon={<Store size={40} strokeWidth={1.5} />}
          selected={state.location === 'Lokal komercyjny'}
          onClick={() => handleSelectLocation('Lokal komercyjny')}
        />
      </div>

      {showAreaBand && (
        <div className="mt-8 pt-8 border-t border-border">
          <div className="text-center mb-6">
            <h3 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground mb-2">
              Jaka jest powierzchnia całkowita lokalu?
            </h3>
            <p className="text-sm sm:text-base text-muted-foreground font-medium">
              Wybierz przedział powierzchni, aby prawidłowo dobrać stawkę i parametry montażu
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 max-w-xl mx-auto">
            {PROPERTY_AREA_BAND_IDS.map((bandId) => {
              const isBelowOrEqual = PROPERTY_AREA_BAND_BOUNDARY[bandId] === 'BELOW_OR_EQUAL';
              const label = isBelowOrEqual
                ? `Do ${SLA.PROPERTY_AREA_VAT_THRESHOLD.sqm} m²`
                : `Powyżej ${SLA.PROPERTY_AREA_VAT_THRESHOLD.sqm} m²`;
              const Icon = isBelowOrEqual ? Minimize2 : Maximize2;

              return (
                <OptionCard
                  key={bandId}
                  title={label}
                  icon={<Icon size={36} strokeWidth={1.5} />}
                  selected={state.propertyAreaBand === bandId}
                  onClick={() => handleSelectAreaBand(bandId)}
                />
              );
            })}
          </div>
        </div>
      )}
    </StepWrapper>
  );
};
