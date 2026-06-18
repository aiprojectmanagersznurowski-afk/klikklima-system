"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { useTriageStore } from '@/store/triageStore';
import { useRouter } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';

const variants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 50 : -50,
    opacity: 0,
    scale: 0.98,
  }),
  center: {
    zIndex: 1,
    x: 0,
    opacity: 1,
    scale: 1,
  },
  exit: (direction: number) => ({
    zIndex: 0,
    x: direction < 0 ? 50 : -50,
    opacity: 0,
    scale: 0.98,
  })
};

export const StepWrapper = ({ children, title, subtitle, showBackButton = true }: { children: React.ReactNode, title: string, subtitle?: string, showBackButton?: boolean }) => {
  const { direction, step, prevStep } = useTriageStore();
  const router = useRouter();

  const handleBack = () => {
    if (step === 1) {
      router.back();
    } else {
      prevStep();
    }
  };
  
  return (
    <motion.div
      custom={direction}
      variants={variants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{
        x: { type: "spring", stiffness: 300, damping: 30 },
        opacity: { duration: 0.3 },
        scale: { duration: 0.3 }
      }}
      className="w-full max-w-4xl mx-auto py-8 px-4 sm:px-6 relative"
    >
      {showBackButton && (
        <button
          onClick={handleBack}
          className="absolute -top-4 left-4 sm:-top-8 sm:left-6 flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-primary transition-colors bg-white/50 backdrop-blur-sm px-3 py-1.5 rounded-full shadow-sm border border-border/50 z-10"
        >
          <ChevronLeft size={16} />
          Wstecz
        </button>
      )}

      <div className="text-center mb-10 sm:mb-14 mt-4 sm:mt-8">
        <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground mb-4">
          {title}
        </h2>
        {subtitle && (
          <p className="text-lg text-muted-foreground font-medium max-w-2xl mx-auto">
            {subtitle}
          </p>
        )}
      </div>
      
      <div className="w-full">
        {children}
      </div>
    </motion.div>
  );
};
