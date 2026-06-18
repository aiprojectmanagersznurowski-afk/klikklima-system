"use client";
import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { useTriageStore } from '@/store/triageStore';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';

export const ProgressBar = () => {
  const { step, prevStep, goToStep, isExpertScreen } = useTriageStore();
  const router = useRouter();
  const totalSteps = 8;
  const progress = isExpertScreen ? 100 : (step / totalSteps) * 100;

  const handleBack = () => {
    if (step === 1) {
      router.back();
    } else if (step === 7) {
      // User requested to go back to step 6 from step 7
      goToStep(6);
    } else {
      prevStep();
    }
  };

  // Hide button entirely on loader (6) or expert screen
  const isHidden = isExpertScreen || step === 6;

  return (
    <div className="w-full max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8 flex flex-col gap-6 relative z-10">
      <div className="flex items-center justify-between">
        <button 
          onClick={handleBack}
          disabled={isHidden}
          className={`flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium ${isHidden ? 'opacity-0 pointer-events-none' : ''}`}
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
