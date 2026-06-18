"use client";
import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTriageStore } from '@/store/triageStore';
import { OptionCard } from '../OptionCard';
import { StepWrapper } from '../StepWrapper';
import { ArrowRight, Check, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Step5Conditions = () => {
  const { data: state, updateData, nextStep } = useTriageStore();

  useEffect(() => {
    // If not an apartment, skip this step automatically when mounted
    if (state.location !== 'Mieszkanie') {
      nextStep();
    }
  }, [state.location, nextStep]);

  if (state.location !== 'Mieszkanie') return null;

  const handleBalcony = (hasBalcony: boolean) => {
    updateData({ hasBalcony });
    if (hasBalcony) {
      updateData({ floor: null });
      setTimeout(nextStep, 350);
    }
  };

  const handleFloor = (floor: 'Parter, 1 lub 2' | 'Powyżej 2. piętra') => {
    updateData({ floor });
    setTimeout(nextStep, 350);
  };

  return (
    <StepWrapper 
      title="Dodatkowe warunki montażu" 
      subtitle="Krótkie pytania, które ułatwią pracę instalatorom."
    >
      <div className="max-w-2xl mx-auto space-y-12">
        <div>
          <h3 className="text-xl font-medium mb-6 text-center">Czy mieszkanie posiada balkon?</h3>
          <div className="grid grid-cols-2 gap-4">
            <OptionCard
              title="Tak"
              icon={<Check size={32} strokeWidth={2} className="text-emerald-500" />}
              selected={state.hasBalcony === true}
              onClick={() => handleBalcony(true)}
            />
            <OptionCard
              title="Nie"
              icon={<X size={32} strokeWidth={2} className="text-rose-500" />}
              selected={state.hasBalcony === false}
              onClick={() => handleBalcony(false)}
            />
          </div>
        </div>

        <AnimatePresence>
          {state.hasBalcony === false && (
            <motion.div
              initial={{ opacity: 0, height: 0, y: -20 }}
              animate={{ opacity: 1, height: 'auto', y: 0 }}
              exit={{ opacity: 0, height: 0, y: -20 }}
              className="pt-6 border-t border-border"
            >
              <h3 className="text-xl font-medium mb-6 text-center">Na którym piętrze znajduje się mieszkanie?</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <OptionCard
                  title="Parter, 1 lub 2"
                  selected={state.floor === 'Parter, 1 lub 2'}
                  onClick={() => handleFloor('Parter, 1 lub 2')}
                />
                <OptionCard
                  title="Powyżej 2. piętra"
                  selected={state.floor === 'Powyżej 2. piętra'}
                  onClick={() => handleFloor('Powyżej 2. piętra')}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </StepWrapper>
  );
};
