"use client";

import React, { useState, useEffect, useMemo } from "react";
import { X, Info, Check, Wifi, Wind, Shield, Zap, ChevronDown, Palette } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { BestsellerProduct } from "@/app/actions/getBestsellers";
import { getSetForConfig } from "@/app/actions/getSetForConfig";
import { getAvailableSizes } from "@/app/actions/getAvailableSizes";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type RoomSize = 'S' | 'M' | 'L' | 'XL';

interface Room {
  id: string;
  size: RoomSize;
}

const ROOM_SIZES: { value: RoomSize; label: string; desc: string }[] = [
  { value: 'S', label: 'Do 25 m²', desc: 'Mały pokój' },
  { value: 'M', label: '26-35 m²', desc: 'Średni salon' },
  { value: 'L', label: '36-50 m²', desc: 'Duży salon' },
  { value: 'XL', label: 'Powyżej 50 m²', desc: 'Otwarta przestrzeń' },
];

export interface DeviceModalProps {
  device: BestsellerProduct | null;
  isOpen: boolean;
  onClose: () => void;
  onReserveClick?: () => void;
  initialRooms?: Room[];
}

const INDOOR_IMAGE = "https://images.unsplash.com/photo-1711873315178-ee7de0b2ea5d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3YWxsJTIwbW91bnRlZCUyMGFpciUyMGNvbmRpdGlvbmVyJTIwaW5kb29yJTIwd2hpdGUlMjBtaW5pbWFsfGVufDF8fHx8MTc4MjEwNzU5N3ww&ixlib=rb-4.1.0&q=80&w=1080";
const OUTDOOR_IMAGE = "https://images.unsplash.com/photo-1757219525975-03b5984bc6e8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhaXIlMjBjb25kaXRpb25lciUyMG91dGRvb3IlMjB1bml0JTIwY29tcHJlc3NvcnxlbnwxfHx8fDE3ODIxMDc2MDB8MA&ixlib=rb-4.1.0&q=80&w=1080";

function FeatureChip({ icon: Icon, children }: { icon: any, children: React.ReactNode }) {
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-50/50 text-blue-700 text-sm font-medium ring-1 ring-inset ring-blue-600/10">
      <Icon className="w-4 h-4 text-blue-600" />
      {children}
    </div>
  );
}

const iconMap: Record<string, any> = {
  Wifi: Wifi,
  Eye: Check, // Czujnik obecności
  Wind: Wind,
};

export function DeviceModal({ device, isOpen, onClose, onReserveClick, initialRooms }: DeviceModalProps) {
  const [rooms, setRooms] = useState<Room[]>([{ id: 'room-1', size: 'M' }]);
  const [matchedSet, setMatchedSet] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [supportedSizes, setSupportedSizes] = useState<string[]>(['S', 'M', 'L', 'XL']);

  useEffect(() => {
    if (isOpen && device) {
      getAvailableSizes(device.model).then(sizes => {
        setSupportedSizes(sizes);
      });
    }
  }, [isOpen, device]);

  useEffect(() => {
    if (isOpen) {
      if (initialRooms && initialRooms.length > 0) {
        setRooms(initialRooms);
      } else {
        setRooms([{ id: 'room-1', size: 'M' }]);
      }
    }
  }, [isOpen, initialRooms]);

  useEffect(() => {
    if (isOpen && device) {
      // Re-fetch match whenever rooms config changes
      let isActive = true;
      const fetchMatch = async () => {
        setIsLoading(true);
        const setConfig = await getSetForConfig(device.model, rooms.map(r => ({ id: r.id, size: r.size })));
        if (isActive) {
          setMatchedSet(setConfig);
          setIsLoading(false);
        }
      };
      
      const timeoutId = setTimeout(() => {
         fetchMatch();
      }, 300); // debounce

      return () => {
        isActive = false;
        clearTimeout(timeoutId);
      };
    }
  }, [isOpen, device, rooms]);

  const updateRoomCount = (count: number) => {
    if (count > rooms.length) {
      const newRooms = [...rooms];
      for (let i = rooms.length; i < count; i++) {
        newRooms.push({ id: `room-${Date.now()}-${i}`, size: 'M' });
      }
      setRooms(newRooms);
    } else if (count < rooms.length) {
      setRooms(rooms.slice(0, count));
    }
  };

  const updateRoomSize = (id: string, size: RoomSize) => {
    setRooms(rooms.map(room => room.id === id ? { ...room, size } : room));
  };

  const handleAuditClick = () => {
     if (onReserveClick) {
       onReserveClick();
       return;
     }

     if (!device) return;
     // Encode config to URL
     const queryParams = new URLSearchParams();
     queryParams.append("series", device.model);
     queryParams.append("roomsCount", rooms.length.toString());
     rooms.forEach((r, i) => {
        queryParams.append(`area_${i+1}`, r.size);
     });
     
     // Przekierowanie do triage
     window.location.href = `/triage?${queryParams.toString()}`;
  };

  if (!device) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 font-sans">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm"
          />
          
          {/* Modal Container */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col z-50 max-h-[90vh]"
          >
            {/* Close Button */}
            <button 
              onClick={onClose}
              className="absolute top-4 right-4 p-2 rounded-full bg-zinc-100 text-zinc-500 hover:bg-zinc-200 hover:text-zinc-900 transition-colors z-10"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="overflow-y-auto flex-1">
              <div className="flex flex-col h-full">
                {/* --- HEADER (Indoor Unit) --- */}
                <section className="p-6 md:p-10 flex flex-col md:flex-row gap-8 items-start relative bg-white">
                  {/* Image */}
                  <div className="w-full md:w-5/12 shrink-0 aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-50 relative group">
                    <img 
                      src={device.img && device.img.length > 5 ? device.img : INDOOR_IMAGE} 
                      alt={`${device.brand} ${device.model}`} 
                      className="w-full h-full object-cover object-center transition-transform duration-700 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 ring-1 ring-inset ring-zinc-900/10 rounded-2xl pointer-events-none" />
                  </div>

                  {/* Details */}
                  <div className="flex-1 flex flex-col justify-center">
                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-zinc-100 text-zinc-600 text-xs font-semibold uppercase tracking-wider mb-3 w-fit">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                      Jednostka Wewnętrzna
                    </div>
                    
                    <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-zinc-900 mb-1">
                      {device.brand} Seria {device.model}
                    </h1>
                    {device._raw?.model_code && (
                      <p className="text-xs text-zinc-400 mb-4 font-mono">
                        Model JW: {device._raw.model_code}
                      </p>
                    )}
                    
                    <p className="text-zinc-500 text-base md:text-lg leading-relaxed mb-6">
                      {device.marketingDesc || "Elegancki, matowy panel frontowy idealnie wpisujący się w nowoczesne wnętrza. Cicha praca i najwyższa wydajność energetyczna dla Twojego komfortu."}
                    </p>

                    {/* Feature Chips */}
                    <div className="flex flex-wrap gap-2.5">
                      {device.features?.map((feat, i) => {
                         const IconComp = iconMap[feat.iconName] || Check;
                         return (
                            <FeatureChip key={i} icon={IconComp}>{feat.label}</FeatureChip>
                         )
                      })}
                      {device._raw?.color && (
                        <FeatureChip icon={Palette}>Kolor: {device._raw.color}</FeatureChip>
                      )}
                    </div>
                  </div>
                </section>

                <div className="h-px bg-zinc-100 w-full" />

                {/* --- CONFIGURATOR --- */}
                <section className="p-6 md:p-10 bg-zinc-50/50">
                  <div className="max-w-3xl">
                    <div className="mb-8">
                      <h2 className="text-lg font-semibold text-zinc-900 mb-1">Skonfiguruj system</h2>
                      <p className="text-sm text-zinc-500">Dopasuj klimatyzację do swoich potrzeb, a my dobierzemy odpowiedni agregat.</p>
                    </div>

                    {/* Row 1: Number of Rooms */}
                    <div className="mb-8">
                      <label className="block text-sm font-medium text-zinc-700 mb-3 flex items-center gap-2">
                        Liczba pomieszczeń do schłodzenia
                      </label>
                      <div className="flex flex-wrap sm:flex-nowrap gap-2 p-1 bg-zinc-100/80 rounded-xl w-fit ring-1 ring-zinc-200/50">
                        {[1, 2, 3, 4, 5].map(num => {
                          const isMulti = device._raw?.is_multi_compatible ?? true; // fallback to true if no raw data
                          const isDisabled = !isMulti && num > 1;
                          return (
                          <button
                            key={num}
                            onClick={() => !isDisabled && updateRoomCount(num)}
                            disabled={isDisabled}
                            title={isDisabled ? "Ten model występuje tylko jako pojedynczy układ (Split)" : undefined}
                            className={cn(
                              "relative px-5 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2",
                              rooms.length === num 
                                ? "text-blue-700 shadow-sm" 
                                : isDisabled
                                  ? "text-zinc-400 opacity-50 cursor-not-allowed bg-transparent"
                                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50"
                            )}
                          >
                            {rooms.length === num && (
                              <motion.div
                                layoutId="activeRoomCount"
                                className="absolute inset-0 bg-white rounded-lg shadow-[0_1px_3px_rgba(0,0,0,0.05),0_1px_2px_rgba(0,0,0,0.02)] border border-zinc-200/60"
                                initial={false}
                                transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                              />
                            )}
                            <span className="relative z-10">{num}</span>
                          </button>
                        )})}
                      </div>
                    </div>

                    {/* Row 2: Room Sizes */}
                    <div className="space-y-4">
                      <AnimatePresence mode="popLayout">
                        {rooms.map((room, index) => (
                          <motion.div
                            key={room.id}
                            initial={{ opacity: 0, height: 0, y: 10 }}
                            animate={{ opacity: 1, height: 'auto', y: 0 }}
                            exit={{ opacity: 0, height: 0, y: -10 }}
                            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
                            className="overflow-hidden"
                          >
                            <div className="bg-white border border-zinc-200/60 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center gap-4">
                              <div className="md:w-32 font-medium text-zinc-900 flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold">
                                  {index + 1}
                                </div>
                                Pokój {index + 1}
                              </div>
                              
                                         <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-2 relative group">
                                  {ROOM_SIZES.map(size => {
                                    const isSupported = supportedSizes.includes(size.value);
                                    return (
                                    <button
                                      key={size.value}
                                      disabled={!isSupported}
                                      onClick={() => updateRoomSize(room.id, size.value)}
                                      className={cn(
                                        "flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all duration-200 relative",
                                        room.size === size.value
                                          ? "bg-blue-50/50 border-blue-600 ring-1 ring-blue-600/20"
                                          : isSupported 
                                            ? "bg-white border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50" 
                                            : "bg-zinc-50 border-zinc-100 opacity-50 cursor-not-allowed",
                                        !isSupported && "group-hover:opacity-60"
                                      )}
                                      title={!isSupported ? "Ta seria nie obsługuje tego metrażu" : undefined}
                                    >
                                      <span className={cn(
                                        "text-sm font-semibold mb-0.5",
                                        room.size === size.value ? "text-blue-700" : isSupported ? "text-zinc-700" : "text-zinc-400"
                                      )}>
                                        {size.label}
                                      </span>
                                      <span className={cn(
                                        "text-xs",
                                        room.size === size.value ? "text-blue-600/80" : isSupported ? "text-zinc-500" : "text-zinc-400"
                                      )}>
                                        {size.desc}
                                      </span>
                                    </button>
                                  )})}
                                </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </div>
                </section>

                {/* --- RESULT SECTION --- */}
                <section className="p-6 md:p-10 bg-white border-t border-zinc-100 flex flex-col md:flex-row gap-6 items-center">
                  <div className="w-24 h-24 md:w-32 md:h-32 shrink-0 bg-zinc-50 rounded-2xl p-2 border border-zinc-100 relative group overflow-hidden flex items-center justify-center">
                    {isLoading ? (
                        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                        <img 
                        src={OUTDOOR_IMAGE} 
                        alt="Outdoor Unit" 
                        className="w-full h-full object-contain object-center transition-transform duration-700 group-hover:scale-110 mix-blend-multiply"
                        />
                    )}
                  </div>
                  
                  <div className="flex-1 space-y-3 w-full">
                    <div className="flex items-center gap-2">
                      <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1 ring-inset", matchedSet ? "bg-emerald-50 text-emerald-700 ring-emerald-600/20" : "bg-orange-50 text-orange-700 ring-orange-600/20")}>
                        {matchedSet ? <><Check className="w-3.5 h-3.5" /> Dopasowano agregat</> : <><Info className="w-3.5 h-3.5" /> Brak dopasowanego zestawu dla tej serii i wydajności</>}
                      </span>
                      <div className="h-px flex-1 bg-zinc-100" />
                    </div>
                    
                    <h3 className="text-xl font-bold text-zinc-900 mb-0.5">
                      {matchedSet ? (matchedSet.type === 'SINGLE' ? 'Agregat Split ' : 'Agregat Multi-Split ') : "Szukam..."}
                    </h3>
                    {matchedSet?.outdoorModel && (
                      <p className="text-xs text-zinc-400 mb-2 font-mono">
                        Model JZ: {matchedSet.outdoorModel}
                      </p>
                    )}
                    
                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-600">
                      <div className="flex items-center gap-2">
                        <Zap className="w-4 h-4 text-zinc-400" />
                        <span>Moc całkowita: <strong className="text-zinc-900 font-semibold">{matchedSet?.capacity || "-"} kW</strong></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Wind className="w-4 h-4 text-zinc-400" />
                        <span>Obsługuje: <strong className="text-zinc-900 font-semibold">{rooms.length} {rooms.length === 1 ? 'jednostkę' : rooms.length > 4 ? 'jednostek' : 'jednostki'}</strong></span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* --- STICKY FOOTER --- */}
                <div className="sticky bottom-0 mt-auto bg-white border-t border-zinc-200/60 p-6 md:px-10 md:py-6 flex flex-col md:flex-row items-center justify-between gap-6 shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.05)] rounded-b-3xl">
                  <div className="flex flex-col text-center md:text-left">
                    <span className="text-sm font-medium text-zinc-500 mb-0.5">Szacowany koszt zestawu (z montażem)</span>
                    <div className="text-3xl font-bold text-zinc-900 tracking-tight flex items-center gap-2 justify-center md:justify-start h-9">
                      <span className="text-xl font-medium text-zinc-500 mr-1">od</span>
                      {isLoading ? (
                        <div className="h-8 w-28 bg-zinc-200 animate-pulse rounded-md" />
                      ) : (
                        <>
                          {matchedSet ? (matchedSet.totalPrice * 1.08).toLocaleString('pl-PL', { maximumFractionDigits: 0 }) : "---"} zł
                          <span className="text-xs font-normal text-zinc-400 self-end mb-1">brutto</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <button 
                    onClick={handleAuditClick}
                    disabled={!matchedSet || isLoading}
                    className="w-full md:w-auto px-8 py-4 bg-blue-600 text-white rounded-xl font-semibold text-lg transition-all duration-300 shadow-[0_8px_20px_-8px_rgba(37,99,235,0.5)] hover:shadow-[0_12px_24px_-8px_rgba(37,99,235,0.6)] hover:-translate-y-0.5 active:translate-y-0 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Umów termin audytu
                  </button>
                </div>

              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
