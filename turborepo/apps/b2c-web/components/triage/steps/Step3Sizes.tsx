"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, Maximize } from 'lucide-react';
import { useTriageStore, RoomSize } from '@/store/triageStore';
import { OptionCard } from '../OptionCard';
import { StepWrapper } from '../StepWrapper';
import { cn } from '@/lib/utils';

const sizeOptions: RoomSize[] = ['Do 20 m²', '21-25 m²', '26-35 m²', 'Powyżej 35 m²'];

export const Step3Sizes = () => {
  const { data: state, updateData, nextStep } = useTriageStore();

  const handleSingleSelect = (size: RoomSize) => {
    updateData({ roomSizes: { 1: size } });
    setTimeout(nextStep, 350);
  };

  const handleMultiSelect = (roomIndex: number, size: RoomSize) => {
    updateData({
      roomSizes: {
        ...state.roomSizes,
        [roomIndex]: size
      }
    });
  };

  const isMultiReady = 
    state.roomCount && 
    Array.from({ length: state.roomCount }).every((_, i) => state.roomSizes[i + 1]);

  if (state.roomCount === 1) {
    return (
      <StepWrapper 
        title="Jaki jest metraż pomieszczenia?" 
        subtitle="To pomoże nam dobrać odpowiednią moc chłodniczą (kW)"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {sizeOptions.map((size) => (
            <OptionCard
              key={size}
              title={size}
              icon={<Maximize size={32} strokeWidth={1.5} />}
              selected={state.roomSizes[1] === size}
              onClick={() => handleSingleSelect(size)}
            />
          ))}
        </div>
      </StepWrapper>
    );
  }

  return (
    <StepWrapper 
      title="Jaki jest metraż poszczególnych pomieszczeń?" 
      subtitle="Określ przybliżoną powierzchnię dla każdego z nich"
    >
      <div className="space-y-6 max-w-2xl mx-auto">
        {Array.from({ length: state.roomCount || 0 }).map((_, idx) => {
          const roomNum = idx + 1;
          const currentSize = state.roomSizes[roomNum];
          
          return (
            <div key={roomNum} className="bg-white/50 backdrop-blur-sm p-6 rounded-2xl border border-border/60 shadow-sm">
              <h3 className="font-semibold text-lg mb-4 text-foreground flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm">
                  {roomNum}
                </span>
                Pokój {roomNum}
              </h3>
              <div className="flex flex-wrap gap-3">
                {sizeOptions.map((size) => (
                  <button
                    key={size}
                    onClick={() => handleMultiSelect(roomNum, size)}
                    className={cn(
                      "px-5 py-3 rounded-xl font-medium transition-all duration-200 border-2",
                      currentSize === size
                        ? "bg-primary text-primary-foreground border-primary shadow-md"
                        : "bg-white text-foreground border-border hover:border-primary/30"
                    )}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
          );
        })}

        <div className="mt-10 flex justify-end">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={nextStep}
            disabled={!isMultiReady}
            className={cn(
              "px-8 py-4 rounded-xl font-semibold flex items-center gap-3 transition-all",
              isMultiReady
                ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:shadow-xl"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
          >
            Dalej
            <ArrowRight size={20} />
          </motion.button>
        </div>
      </div>
    </StepWrapper>
  );
};
