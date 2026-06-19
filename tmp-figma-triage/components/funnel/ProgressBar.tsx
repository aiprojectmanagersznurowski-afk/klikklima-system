import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useFunnel } from './FunnelContext';
import { motion } from 'motion/react';

const totalSteps = 8;

export const ProgressBar = () => {
  const { state, prevStep, isExpertScreen } = useFunnel();
  
  // If it's success or booking, we might still want to show progress or hide it.
  // Let's show it but filled.
  const currentStep = state.step;
  const progress = isExpertScreen ? 100 : (currentStep / totalSteps) * 100;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6 relative z-10">
      <div className="flex items-center justify-between">
        <button 
          onClick={prevStep}
          disabled={currentStep === 1 || isExpertScreen || currentStep >= 7}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium disabled:opacity-0"
        >
          <ChevronLeft size={20} />
          Wstecz
        </button>

        <div className="text-sm font-semibold text-muted-foreground tracking-widest uppercase">
          Krok {Math.min(currentStep, totalSteps)} / {totalSteps}
        </div>
      </div>

      <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
        <motion.div 
          className="h-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        />
      </div>
    </div>
  );
};
