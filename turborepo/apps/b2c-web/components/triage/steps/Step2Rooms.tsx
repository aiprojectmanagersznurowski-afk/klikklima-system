"use client";
import React from 'react';
import { LayoutGrid, Layers, LayoutPanelLeft, LayoutDashboard } from 'lucide-react';
import { useTriageStore, RoomCount, RoomSize } from '@/store/triageStore';
import { OptionCard } from '../OptionCard';
import { StepWrapper } from '../StepWrapper';

export const Step2Rooms = () => {
  const { data: state, updateData, nextStep } = useTriageStore();

  const handleSelect = (roomCount: RoomCount) => {
    // When changing room count, initialize default room sizes for each room
    const newRoomSizes = { ...state.roomSizes };
    if (roomCount) {
      for (let i = 1; i <= roomCount; i++) {
        if (!newRoomSizes[i]) {
          newRoomSizes[i] = 'Do 25 m²';
        }
      }
    }
    
    updateData({ roomCount, roomSizes: newRoomSizes });
    setTimeout(nextStep, 350);
  };

  return (
    <StepWrapper 
      title="W ilu pomieszczeniach?" 
      subtitle="Określ, ile pomieszczeń wymaga klimatyzacji."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        <OptionCard
          title="1 pomieszczenie"
          icon={<LayoutPanelLeft size={40} strokeWidth={1.5} />}
          selected={state.roomCount === 1}
          onClick={() => handleSelect(1)}
        />
        <OptionCard
          title="2 pomieszczenia"
          icon={<LayoutGrid size={40} strokeWidth={1.5} />}
          selected={state.roomCount === 2}
          onClick={() => handleSelect(2)}
        />
        <OptionCard
          title="3 pomieszczenia"
          icon={<Layers size={40} strokeWidth={1.5} />}
          selected={state.roomCount === 3}
          onClick={() => handleSelect(3)}
        />
        <OptionCard
          title="4 i więcej"
          icon={<LayoutDashboard size={40} strokeWidth={1.5} />}
          selected={state.roomCount === 4}
          onClick={() => handleSelect(4)}
        />
      </div>
    </StepWrapper>
  );
};
