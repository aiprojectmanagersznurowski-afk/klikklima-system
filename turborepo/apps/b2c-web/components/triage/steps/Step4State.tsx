"use client";
import React from 'react';
import { PaintRoller, Sparkles, Hammer, ArrowRight, type LucideIcon } from 'lucide-react';
import { useTriageStore, type BuildingState } from '@/store/triageStore';
import { OptionCard } from '../OptionCard';
import { StepWrapper } from '../StepWrapper';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PROPERTY_CONDITION_IDS,
  PROPERTY_CONDITION_PL,
  type PropertyConditionId,
} from '@klikklima/contracts';

// Ikony przypisane po id z kontraktu, nie po etykiecie PL — etykieta może się
// zmienić w kontrakcie bez wpływu na to mapowanie. Renderowane etykiety (dziś,
// z @klikklima/contracts PROPERTY_CONDITION_PL): "Wykończony / Zamieszkany",
// "W trakcie remontu", "Stan deweloperski".
const PROPERTY_CONDITION_ICON: Record<PropertyConditionId, LucideIcon> = {
  FINISHED: Sparkles,
  RENOVATION: PaintRoller,
  DEVELOPER_SHELL: Hammer,
};

export const Step4State = () => {
  const { data: state, updateData, nextStep } = useTriageStore();
  const [showNextBtn] = React.useState(state.buildingState !== null);
  const isComplete = state.buildingState !== null;

  const handleSelect = (id: PropertyConditionId) => {
    // Etykieta pochodzi z kontraktu (PROPERTY_CONDITION_PL), a `BuildingState` w
    // triageStore.ts jest zamkniętą unią dokładnie tych trzech wartości — rzutowanie
    // wyraża "wiem, że to jest jedna z tych trzech etykiet", nie `any`.
    updateData({ buildingState: PROPERTY_CONDITION_PL[id] as BuildingState });
    setTimeout(nextStep, 350);
  };

  return (
    <StepWrapper
      title="Jaki jest stan lokalu?"
      subtitle="Pomaga to w określeniu metody poprowadzenia instalacji"
    >
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        {PROPERTY_CONDITION_IDS.map((id) => {
          const Icon = PROPERTY_CONDITION_ICON[id];
          const label = PROPERTY_CONDITION_PL[id];
          return (
            <OptionCard
              key={id}
              title={label}
              icon={<Icon size={40} strokeWidth={1.5} />}
              selected={state.buildingState === label}
              onClick={() => handleSelect(id)}
            />
          );
        })}
      </div>

      <AnimatePresence>
        {isComplete && showNextBtn && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex justify-center pt-8"
          >
            <Button
              onClick={nextStep}
              size="lg"
              className="w-full sm:w-auto px-12 h-14 text-lg gap-3 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all rounded-2xl"
            >
              Dalej
              <ArrowRight className="w-5 h-5" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </StepWrapper>
  );
};
