"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OptionCardProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  selected: boolean;
  onClick: () => void;
  className?: string;
}

export const OptionCard = ({ title, subtitle, icon, selected, onClick, className }: OptionCardProps) => {
  return (
    <motion.button
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={cn(
        "relative flex flex-col items-center justify-center p-6 sm:p-8 rounded-2xl border-2 transition-all duration-300 w-full text-center bg-card/80 backdrop-blur-sm",
        selected 
          ? "border-primary shadow-[0_8px_30px_rgba(23,80,200,0.12)] bg-card" 
          : "border-border shadow-sm hover:border-primary/40 hover:shadow-md",
        className
      )}
    >
      {selected && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="absolute -top-3 -right-3 size-8 bg-primary rounded-full flex items-center justify-center text-primary-foreground shadow-lg"
        >
          <Check size={16} strokeWidth={3} />
        </motion.div>
      )}
      
      {icon && (
        <div className={cn(
          "mb-4 transition-colors duration-300",
          selected ? "text-primary" : "text-muted-foreground"
        )}>
          {icon}
        </div>
      )}
      
      <h3 className={cn(
        "font-semibold text-lg sm:text-xl transition-colors duration-300",
        selected ? "text-primary" : "text-foreground"
      )}>
        {title}
      </h3>
      
      {subtitle && (
        <p className="mt-2 text-sm text-muted-foreground font-medium">
          {subtitle}
        </p>
      )}
    </motion.button>
  );
};
