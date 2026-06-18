"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { useTriageStore } from '@/store/triageStore';

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

export const StepWrapper = ({ children, title, subtitle }: { children: React.ReactNode, title: string, subtitle?: string }) => {
  const { direction } = useTriageStore();
  
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
      className="w-full max-w-4xl mx-auto py-8 px-4 sm:px-6"
    >
      <div className="text-center mb-10 sm:mb-14">
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
