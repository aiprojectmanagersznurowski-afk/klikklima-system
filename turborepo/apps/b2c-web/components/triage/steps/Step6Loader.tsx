"use client";
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTriageStore } from '@/store/triageStore';
import { Loader2 } from 'lucide-react';

const loadingTexts = [
  "Analizuję parametry...",
  "Dobieram optymalną moc chłodniczą...",
  "Szacuję koszty materiałów i montażu...",
  "Przygotowuję wycenę..."
];

export const Step6Loader = () => {
  const { nextStep } = useTriageStore();
  const [textIndex, setTextIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTextIndex((prev) => {
        if (prev < loadingTexts.length - 1) {
          return prev + 1;
        }
        return prev;
      });
    }, 1200);

    const timeout = setTimeout(() => {
      nextStep();
    }, 4800); // 4 texts * 1.2s

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [nextStep]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="w-full flex flex-col items-center justify-center min-h-[400px] text-center"
    >
      <div className="relative w-32 h-32 mb-8">
        <motion.div 
          className="absolute inset-0 rounded-full border-4 border-primary/20"
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.2, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div 
          className="absolute inset-2 rounded-full border-4 border-primary/40"
          animate={{ scale: [1, 1.1, 1], opacity: [0.8, 0.4, 0.8] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <Loader2 className="w-12 h-12 text-primary animate-spin" />
        </div>
      </div>

      <div className="h-12 relative w-full overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.h2
            key={textIndex}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="text-2xl sm:text-3xl font-semibold text-foreground absolute w-full"
          >
            {loadingTexts[textIndex]}
          </motion.h2>
        </AnimatePresence>
      </div>
      
      <p className="mt-4 text-muted-foreground font-medium animate-pulse">
        To potrwa tylko chwilę
      </p>
    </motion.div>
  );
};
