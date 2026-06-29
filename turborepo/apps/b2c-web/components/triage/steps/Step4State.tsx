"use client";
import React from 'react';
import { PaintRoller, Sparkles, Hammer, ArrowRight } from 'lucide-react';
import { useTriageStore, BuildingState } from '@/store/triageStore';
import { OptionCard } from '../OptionCard';
import { StepWrapper } from '../StepWrapper';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';

export const Step4State = () => {
  const { data: state, updateData, nextStep } = useTriageStore();
  const [showNextBtn] = React.useState(state.buildingState !== null);
  const isComplete = state.buildingState !== null;

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
