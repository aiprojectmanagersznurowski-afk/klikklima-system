"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Plus, Trash2, Wifi, Wind, Volume2, Info, CheckCircle2, Zap, Check, Palette } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

import { Button } from "./button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./accordion";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./dialog";

import type { BestsellerProduct } from "@/app/actions/getBestsellers";
import { getSetForConfig } from "@/app/actions/getSetForConfig";
import { getAvailableSizes } from "@/app/actions/getAvailableSizes";
import { getValidConfigurations } from "@/app/actions/getValidConfigurations";
import { getLowestPriceForIndoorUnit } from "@/app/actions/getLowestPriceForIndoorUnit";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type RoomSize = 'S' | 'M' | 'L' | 'XL';

interface Room {
  id: string;
  size: RoomSize | null;
}

const ROOM_SIZES: { value: RoomSize; label: string; desc: string }[] = [
  { value: 'S', label: 'Do 20 m²', desc: 'Mały pokój' },
  { value: 'M', label: '21-25 m²', desc: 'Średni salon' },
  { value: 'L', label: '26-35 m²', desc: 'Duży salon' },
  { value: 'XL', label: 'Powyżej 35 m²', desc: 'Otwarta przestrzeń' },
];

function sizeToCode(size: RoomSize): string {
  switch (size) {
    case "S": return "07";
    case "M": return "09";
    case "L": return "12";
    case "XL": return "18";
    default: return "09";
  }
}

export interface DeviceModalProps {
  device: BestsellerProduct | null;
  isOpen: boolean;
  onClose: () => void;
  onReserveClick?: () => void;
}

const INDOOR_IMAGE = "https://images.unsplash.com/photo-1711873315178-ee7de0b2ea5d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHx3YWxsJTIwbW91bnRlZCUyMGFpciUyMGNvbmRpdGlvbmVyJTIwaW5kb29yJTIwd2hpdGUlMjBtaW5pbWFsfGVufDF8fHx8MTc4MjEwNzU5N3ww&ixlib=rb-4.1.0&q=80&w=1080";
const OUTDOOR_IMAGE = "https://images.unsplash.com/photo-1757219525975-03b5984bc6e8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxhaXIlMjBjb25kaXRpb25lciUyMG91dGRvb3IlMjB1bml0JTIwY29tcHJlc3NvcnxlbnwxfHx8fDE3ODIxMDc2MDB8MA&ixlib=rb-4.1.0&q=80&w=1080";

function FeatureChip({ icon: Icon, children }: { icon: any, children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
      <span className="text-yellow-500"><Icon className="w-4 h-4" /></span>
      {children}
    </div>
  );
}

const iconMap: Record<string, any> = {
  Wifi: Wifi,
  Eye: Check,
  Wind: Wind,
};

export function DeviceModal({ device, isOpen, onClose, onReserveClick }: DeviceModalProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [matchedSet, setMatchedSet] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [supportedSizes, setSupportedSizes] = useState<string[]>(['S', 'M', 'L', 'XL']);
  const [validHashes, setValidHashes] = useState<string[] | null>(null);
  const [maxSupportedRooms, setMaxSupportedRooms] = useState<number>(5);
  const [basePrice, setBasePrice] = useState<number | null>(device?.startingPriceBrutto || null);

  const isFullyConfigured = rooms.length > 0 && rooms.every((r) => r.size !== null);

  useEffect(() => {
    if (isOpen && device) {
      setRooms([]);
      if (device.startingPriceBrutto) {
        setBasePrice(device.startingPriceBrutto);
      } else {
        setBasePrice(null);
        getLowestPriceForIndoorUnit(device.model).then(price => {
          if (price) setBasePrice(Math.round(price * 1.08));
        });
      }
    }
  }, [isOpen, device]);

  useEffect(() => {
    if (isOpen && device) {
      getAvailableSizes(device.model).then(res => {
        setSupportedSizes(res.sizes);
        setMaxSupportedRooms(res.maxRooms);
      });
    }
  }, [isOpen, device]);

  useEffect(() => {
    if (isOpen && device) {
      setValidHashes(null);
      if (rooms.length > 0) {
        getValidConfigurations(device.model, rooms.length).then(res => {
          setValidHashes(res);
        });
      }
    }
  }, [isOpen, device, rooms.length]);

  useEffect(() => {
    if (isOpen && device) {
      if (!isFullyConfigured) {
        setMatchedSet(null);
        return;
      }
      
      let isActive = true;
      const fetchMatch = async () => {
        setIsLoading(true);
        const configuredRooms = rooms.map(r => ({ id: r.id, size: r.size as "S"|"M"|"L"|"XL" }));
        const setConfig = await getSetForConfig(device.model, configuredRooms);
        if (isActive) {
          setMatchedSet(setConfig);
          setIsLoading(false);
        }
      };
      
      const timeoutId = setTimeout(() => fetchMatch(), 300);
      return () => {
        isActive = false;
        clearTimeout(timeoutId);
      };
    }
  }, [isOpen, device, rooms, isFullyConfigured]);

  const handleAddRoom = () => {
    if (rooms.length < maxSupportedRooms) {
      setRooms([...rooms, { id: `room-${Date.now()}`, size: null }]);
    }
  };

  const handleRemoveRoom = (id: string) => {
    setRooms(rooms.filter((r) => r.id !== id));
  };

  const handleUpdateRoomSize = (id: string, size: RoomSize) => {
    setRooms(rooms.map((r) => (r.id === id ? { ...r, size } : r)));
  };

  const handleAuditClick = () => {
     if (onReserveClick) {
       onReserveClick();
       return;
     }

     if (!device) return;
     const queryParams = new URLSearchParams();
     queryParams.append("series", device.model);
     queryParams.append("roomsCount", rooms.length.toString());
     rooms.forEach((r, i) => {
        if (r.size) queryParams.append(`area_${i+1}`, r.size);
     });
     
     window.location.href = `/triage?${queryParams.toString()}`;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pl-PL").format(price);
  };

  if (!device) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl sm:max-w-5xl h-[90vh] md:h-[80vh] flex flex-col p-0 overflow-hidden rounded-3xl">
        <DialogHeader className="p-6 pb-4 border-b border-slate-100 flex-shrink-0 bg-white z-10">
          <DialogTitle className="text-2xl font-bold">Konfiguracja zestawu</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative">
          
          {/* LEFT: Configurator */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/50 pb-32 md:pb-8">
            
            {/* Selected Internal Unit Preview */}
            <div className="flex items-center gap-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-8">
              <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0 relative group">
                <img 
                  src={device.img && device.img.length > 5 ? device.img : INDOOR_IMAGE} 
                  alt={device.model}
                  className="w-full h-full object-cover mix-blend-multiply opacity-90 transition-transform duration-700 group-hover:scale-105"
                />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold uppercase tracking-wider mb-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    Jednostka Wewnętrzna
                </div>
                <h3 className="font-bold text-lg text-slate-900">{device.brand} Seria {device.model}</h3>
                <div className="flex flex-wrap gap-4 mt-2">
                  {device.features?.map((f, i) => {
                     const IconComp = iconMap[f.iconName] || Check;
                     return <FeatureChip key={i} icon={IconComp}>{f.label}</FeatureChip>
                  })}
                  {device._raw?.color && (
                    <FeatureChip icon={Palette}>{device._raw.color}</FeatureChip>
                  )}
                </div>
              </div>
            </div>

            {/* Room Configuration */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-lg font-bold text-slate-900">Pokoje do klimatyzacji</h4>
                  <p className="text-sm text-slate-500">Dodaj pomieszczenia i określ ich wielkość.</p>
                </div>
                
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div>
                        <Button 
                          onClick={handleAddRoom} 
                          disabled={rooms.length >= maxSupportedRooms || (!device._raw?.is_multi_compatible && rooms.length >= 1)}
                          variant="outline"
                          className="gap-2 border-slate-200 text-slate-700 hover:border-blue-600 hover:bg-blue-50 hover:text-blue-900"
                        >
                          <Plus className="w-4 h-4" />
                          Dodaj pokój
                        </Button>
                      </div>
                    </TooltipTrigger>
                    {rooms.length >= maxSupportedRooms && (
                      <TooltipContent>
                        Ten model obsługuje maksymalnie {maxSupportedRooms} pokoi.
                      </TooltipContent>
                    )}
                    {!device._raw?.is_multi_compatible && rooms.length >= 1 && (
                      <TooltipContent>
                        Ten model występuje tylko jako pojedynczy układ (Split).
                      </TooltipContent>
                    )}
                  </Tooltip>
                </TooltipProvider>
              </div>

              <div className="space-y-4 mb-8">
                <AnimatePresence>
                  {rooms.map((room, index) => (
                    <motion.div
                      key={room.id}
                      initial={{ opacity: 0, height: 0, scale: 0.95 }}
                      animate={{ opacity: 1, height: "auto", scale: 1 }}
                      exit={{ opacity: 0, height: 0, scale: 0.95, margin: 0 }}
                      transition={{ duration: 0.2 }}
                      className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="font-semibold text-slate-700 flex items-center gap-2">
                           <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold">
                              {index + 1}
                           </div>
                           Pokój #{index + 1}
                        </div>
                        <button 
                          onClick={() => handleRemoveRoom(room.id)}
                          className="text-slate-400 hover:text-red-500 transition-colors p-1"
                          aria-label="Usuń pokój"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                        {ROOM_SIZES.map((size) => {
                          const isSizeSupported = supportedSizes.includes(size.value);
                          const hypotheticalRooms = rooms.map(r => r.id === room.id ? { ...r, size: size.value } : r);
                          const isFullyHypothetical = hypotheticalRooms.every(r => r.size !== null);
                          
                          let isBlocked = !isSizeSupported;
                          
                          if (isSizeSupported && isFullyHypothetical && validHashes !== null) {
                             const requiredCodes = hypotheticalRooms.map(r => sizeToCode(r.size as RoomSize)).sort();
                             const hypotheticalHash = requiredCodes.join('-');
                             isBlocked = !validHashes.includes(hypotheticalHash);
                          }

                          const isSelected = room.size === size.value;
                          
                          return (
                            <TooltipProvider key={size.value}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => !isBlocked && handleUpdateRoomSize(room.id, size.value)}
                                    type="button"
                                    className={cn(
                                      "relative flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all duration-200",
                                      isSelected 
                                        ? "border-yellow-400 bg-yellow-50/50 text-yellow-950" 
                                        : isBlocked 
                                          ? "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed" 
                                          : "border-slate-100 hover:border-slate-300 text-slate-600 bg-white"
                                    )}
                                  >
                                    {isSelected && (
                                      <div className="absolute top-2 right-2 text-yellow-500">
                                        <CheckCircle2 className="w-4 h-4" />
                                      </div>
                                    )}
                                    <span className="font-semibold text-sm">{size.label}</span>
                                    <span className="text-xs opacity-70 mt-0.5">{size.desc}</span>
                                  </button>
                                </TooltipTrigger>
                                {isBlocked && (
                                  <TooltipContent>
                                    Ta seria nie obsługuje tego metrażu dla takiej konfiguracji.
                                  </TooltipContent>
                                )}
                              </Tooltip>
                            </TooltipProvider>
                          );
                        })}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                
                {rooms.length === 0 && (
                  <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-300">
                    <p className="text-slate-500">Brak dodanych pomieszczeń.</p>
                    <p className="text-sm text-slate-400 mt-1">Kliknij "Dodaj pokój", aby rozpocząć konfigurację.</p>
                  </div>
                )}
              </div>

              {/* Automatic Aggregate */}
              <AnimatePresence>
                {(matchedSet || isLoading) && isFullyConfigured && rooms.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-slate-900 rounded-xl p-5 text-slate-50 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
                    <div className="flex items-start gap-4 relative z-10">
                      <div className="p-3 bg-white/10 rounded-lg shrink-0">
                        {isLoading ? (
                           <div className="w-6 h-6 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                        ) : (
                           <Wind className="w-6 h-6 text-yellow-400" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-lg text-white">Dobrany Agregat</h4>
                          <span className="text-[10px] uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded font-bold">Auto</span>
                        </div>
                        <p className="text-slate-300 text-sm mb-3">Na podstawie Twojego wyboru system automatycznie dobrał odpowiednią jednostkę zewnętrzną.</p>
                        
                        {matchedSet && !isLoading && (
                           <div className="flex gap-4">
                             <div>
                               <p className="text-xs text-slate-400">Model</p>
                               <p className="font-medium text-white">{matchedSet.outdoorModel}</p>
                             </div>
                             <div>
                               <p className="text-xs text-slate-400">Moc całkowita</p>
                               <p className="font-medium text-white">{matchedSet.capacity} kW</p>
                             </div>
                           </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* RIGHT: Summary (Sticky on mobile) */}
          <div className="w-full md:w-[380px] lg:w-[420px] bg-white border-t md:border-t-0 md:border-l border-slate-200 flex flex-col z-20 shrink-0 mt-auto md:mt-0 max-h-[50vh] md:max-h-full">
            <div className="p-6 md:p-8 flex-1 overflow-y-auto">
              <h3 className="text-lg font-bold text-slate-900 mb-6 hidden md:block">Podsumowanie</h3>
              
              {/* Dynamic Price */}
              <div className="mb-8">
                <p className="text-sm text-slate-500 font-medium mb-1">
                  {!isFullyConfigured ? "Cena zaczyna się od" : "Cena całkowita zestawu"}
                </p>
                <div className="flex items-baseline gap-2 min-h-12">
                  {isLoading || (!isFullyConfigured && basePrice === null) ? (
                    <div className="h-10 w-32 bg-slate-200 animate-pulse rounded-md" />
                  ) : (
                    <motion.div 
                      key={isFullyConfigured ? matchedSet?.totalPrice : basePrice}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-4xl md:text-5xl font-extrabold text-slate-900"
                    >
                      {formatPrice(isFullyConfigured && matchedSet ? Math.round(matchedSet.totalPrice * 1.08) : (basePrice || 0))} <span className="text-2xl font-bold">zł</span>
                    </motion.div>
                  )}
                </div>
                <p className="text-sm text-slate-400 mt-2">Zawiera 8% VAT oraz montaż podstawowy</p>
              </div>

              {/* Selection Summary */}
              {rooms.length > 0 && (
                <div className="mb-8">
                  <h4 className="font-semibold text-slate-900 mb-3 text-sm">Wybrane parametry:</h4>
                  <ul className="space-y-2 text-sm text-slate-600">
                    <li className="flex justify-between">
                      <span>Jednostki wewnętrzne:</span>
                      <span className="font-medium text-slate-900">{rooms.length}x Seria {device.model}</span>
                    </li>
                    {rooms.map((r, i) => (
                      r.size && (
                        <li key={i} className="flex justify-between pl-4 text-slate-500">
                          <span>Pokój #{i + 1}:</span>
                          <span>{ROOM_SIZES.find(s => s.value === r.size)?.label}</span>
                        </li>
                      )
                    ))}
                    {matchedSet && isFullyConfigured && !isLoading && (
                      <li className="flex justify-between pt-2 mt-2 border-t border-slate-100">
                        <span>Jednostka zewnętrzna:</span>
                        <span className="font-medium text-slate-900">1x {matchedSet.outdoorModel}</span>
                      </li>
                    )}
                  </ul>
                </div>
              )}

              {/* Installation Scope */}
              <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="montaz">
                  <AccordionTrigger className="text-sm hover:no-underline">
                    <div className="flex items-center gap-2">
                      <Info className="w-4 h-4 text-yellow-500" />
                      <span>Co obejmuje standardowy montaż?</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-600 space-y-2">
                    <ul className="list-disc pl-4 space-y-1 mt-2 text-sm">
                      <li>Do {rooms.length === 0 ? 3 : Math.max(3, rooms.length * 4)} metrów bieżących instalacji chłodniczej</li>
                      <li>{rooms.length || 1} przebicie przez standardową ścianę (do grubości 40cm)</li>
                      <li>Podłączenie jednostki zewnętrznej i wewnętrznych</li>
                      <li>Odprowadzenie skroplin grawitacyjne do {rooms.length === 0 ? 3 : rooms.length * 3}m</li>
                      <li>Próżniowanie instalacji, test szczelności</li>
                      <li>Uruchomienie systemu i przeszkolenie użytkownika</li>
                    </ul>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
            
            <div className="p-6 md:p-8 border-t border-slate-100 bg-white">
              <Button 
                size="lg" 
                onClick={handleAuditClick}
                disabled={(!isFullyConfigured && rooms.length > 0) || isLoading}
                className="w-full h-12 text-base font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 rounded-xl transition-all"
              >
                {!isFullyConfigured && rooms.length > 0 ? "Uzupełnij metraż pokoi" : "Potwierdź zestaw"}
              </Button>
            </div>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
