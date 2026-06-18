"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { useTriageStore } from '@/store/triageStore';
import { StepWrapper } from '../StepWrapper';
import { PhoneCall, Building } from 'lucide-react';

export const StepExpert = () => {
  const { prevStep } = useTriageStore();

  return (
    <StepWrapper 
      title="Potrzebujesz indywidualnego podejścia" 
      subtitle="Twój projekt wymaga zaawansowanej wiedzy inżynieryjnej. Skontaktuj się z naszym ekspertem B2B."
    >
      <div className="max-w-2xl mx-auto bg-white rounded-3xl p-8 sm:p-12 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-border/50 text-center">
        <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary mb-6">
          <Building size={40} strokeWidth={1.5} />
        </div>
        
        <h3 className="text-2xl font-bold mb-4">Dział Komercyjny i Rozbudowane Instalacje</h3>
        <p className="text-muted-foreground text-lg mb-8">
          Rozwiązania dla lokali komercyjnych oraz instalacji obejmujących 4 i więcej pomieszczeń projektujemy indywidualnie. 
          Zadzwoń do nas, aby umówić się na bezpłatną wizję lokalną z inżynierem.
        </p>

        <a 
          href="tel:+48123456789" 
          className="inline-flex items-center justify-center gap-3 bg-primary text-primary-foreground py-4 px-8 rounded-xl font-bold text-lg shadow-lg shadow-primary/20 hover:shadow-xl transition-all mb-6"
        >
          <PhoneCall size={22} />
          +48 123 456 789
        </a>

        <div className="mt-8 pt-8 border-t border-border">
          <button 
            onClick={prevStep}
            className="text-primary font-medium hover:underline"
          >
            Wróć i zmień odpowiedzi
          </button>
        </div>
      </div>
    </StepWrapper>
  );
};
