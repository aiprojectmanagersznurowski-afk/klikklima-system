"use client";
import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useTriageStore } from '@/store/triageStore';
import { motion } from 'framer-motion';

export const ProgressBar = () => {
  const { step, prevStep, isExpertScreen } = useTriageStore();
  const totalSteps = 8;
  const progress = isExpertScreen ? 100 : (step / totalSteps) * 100;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6 relative z-10">
      <div className="flex items-center justify-between">
        <button 
          onClick={prevStep}
          disabled={step === 1 || isExpertScreen || step >= 7}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium disabled:opacity-0"
        >
          <ChevronLeft size={20} />
          Wstecz
        </button>

        <div className="text-sm font-semibold text-muted-foreground tracking-widest uppercase">
          Krok {Math.min(step, totalSteps)} / {totalSteps}
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
