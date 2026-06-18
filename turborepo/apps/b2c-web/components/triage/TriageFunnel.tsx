"use client";
import React from 'react';
import { AnimatePresence } from 'framer-motion';
import { useTriageStore } from '@/store/triageStore';
import { ProgressBar } from './ProgressBar';

import { Step1Location } from './steps/Step1Location';
import { Step2Rooms } from './steps/Step2Rooms';
import { Step3Sizes } from './steps/Step3Sizes';
import { Step4State } from './steps/Step4State';
import { Step5Conditions } from './steps/Step5Conditions';
import { Step6Loader } from './steps/Step6Loader';
import { Step7Success } from './steps/Step7Success';
import { Step8Booking } from './steps/Step8Booking';
import { StepExpert } from './steps/StepExpert';

const FunnelContent = () => {
  const { step, direction, isExpertScreen } = useTriageStore();

  const renderStep = () => {
    if (isExpertScreen) {
      return <StepExpert key="expert" />;
    }

    switch (step) {
      case 1: return <Step1Location key="step1" />;
      case 2: return <Step2Rooms key="step2" />;
      case 3: return <Step3Sizes key="step3" />;
      case 4: return <Step4State key="step4" />;
      case 5: return <Step5Conditions key="step5" />;
      case 6: return <Step6Loader key="step6" />;
      case 7: return <Step7Success key="step7" />;
      case 8: return <Step8Booking key="step8" />;
      default: return <Step1Location key="step1-default" />;
    }
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col font-sans">
      {/* Decorative blurred background shapes */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[30%] h-[40%] bg-secondary/30 rounded-full blur-3xl pointer-events-none" />
      
      <ProgressBar />
      
      <main className="flex-1 flex flex-col relative z-10 w-full overflow-hidden px-4">
        <AnimatePresence mode="wait" custom={direction}>
          {renderStep()}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default FunnelContent;
