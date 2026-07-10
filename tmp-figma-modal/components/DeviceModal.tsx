import React, { useState, useEffect } from "react";
import { Plus, Trash2, Wifi, Wind, Volume2, Info, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "./ui/Button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "./ui/Tooltip";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./ui/Accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/Dialog";

// --- Mock Data ---
const BASE_PRICE = 4200;
const MAX_ROOMS = 4;

const INTERNAL_UNIT = {
  name: "Samsung Wind-Free Pure 2.0",
  image: "https://images.unsplash.com/photo-1771337744724-46b49a171ece?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=800",
  features: [
    { icon: <Wifi className="w-4 h-4" />, label: "Wi-Fi" },
    { icon: <Wind className="w-4 h-4" />, label: "Jonizator" },
    { icon: <Volume2 className="w-4 h-4" />, label: "Cicha praca" },
  ],
  maxRooms: 4,
};

const AGGREGATES = {
  1: { model: "Samsung AR09TXF", power: "2.5 kW", maxUnits: 1 },
  2: { model: "Samsung AJ040TX", power: "4.0 kW", maxUnits: 2 },
  3: { model: "Samsung AJ052TX", power: "5.2 kW", maxUnits: 3 },
  4: { model: "Samsung AJ068TX", power: "6.8 kW", maxUnits: 4 },
} as Record<number, { model: string; power: string; maxUnits: number }>;

type RoomSize = "< 20 m²" | "20-35 m²" | "> 35 m²";
const SIZES: RoomSize[] = ["< 20 m²", "20-35 m²", "> 35 m²"];

const SIZE_PRICES: Record<RoomSize, number> = {
  "< 20 m²": 0,
  "20-35 m²": 400,
  "> 35 m²": 900,
};

const MULTI_SPLIT_PREMIUM = 1200;

// --- Interfaces ---
interface Room {
  id: string;
  size: RoomSize | null;
}

interface DeviceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// --- Components ---

export function DeviceModal({ open, onOpenChange }: DeviceModalProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [displayedPrice, setDisplayedPrice] = useState(BASE_PRICE);

  const isFullyConfigured = rooms.length > 0 && rooms.every((r) => r.size !== null);

  const calculatePrice = () => {
    let base = BASE_PRICE;
    let extra = 0;
    
    rooms.forEach((r) => {
      if (r.size) extra += SIZE_PRICES[r.size];
    });
    
    if (rooms.length > 1) {
      extra += (rooms.length - 1) * MULTI_SPLIT_PREMIUM;
    }
    
    return base + extra;
  };

  useEffect(() => {
    if (isFullyConfigured || rooms.length > 0) {
      setDisplayedPrice(calculatePrice());
    } else {
      setDisplayedPrice(BASE_PRICE);
    }
  }, [rooms]);

  const handleAddRoom = () => {
    if (rooms.length < MAX_ROOMS) {
      setRooms([...rooms, { id: Math.random().toString(36).substring(7), size: null }]);
    }
  };

  const handleRemoveRoom = (id: string) => {
    setRooms(rooms.filter((r) => r.id !== id));
  };

  const handleUpdateRoomSize = (id: string, size: RoomSize) => {
    setRooms(rooms.map((r) => (r.id === id ? { ...r, size } : r)));
  };

  const currentAggregate = rooms.length > 0 ? AGGREGATES[rooms.length] : null;

  // Format price helper
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("pl-PL").format(price);
  };

  // When modal closes, reset state
  useEffect(() => {
    if (!open) {
      setTimeout(() => setRooms([]), 300);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] md:h-[80vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-4 border-b border-slate-100 flex-shrink-0">
          <DialogTitle className="text-2xl font-bold">Konfiguracja zestawu</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col md:flex-row flex-1 overflow-hidden relative">
          
          {/* LEFT: Configurator */}
          <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-slate-50/50 pb-32 md:pb-8">
            
            {/* Selected Internal Unit Preview */}
            <div className="flex items-center gap-6 bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-8">
              <div className="w-24 h-24 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                <img 
                  src={INTERNAL_UNIT.image} 
                  alt={INTERNAL_UNIT.name}
                  className="w-full h-full object-cover mix-blend-multiply opacity-90"
                />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-900">{INTERNAL_UNIT.name}</h3>
                <div className="flex gap-4 mt-2">
                  {INTERNAL_UNIT.features.map((f, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-xs font-medium text-slate-500">
                      <span className="text-yellow-500">{f.icon}</span>
                      {f.label}
                    </div>
                  ))}
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
                          disabled={rooms.length >= MAX_ROOMS}
                          variant="outline"
                          className="gap-2 border-slate-200 text-slate-700 hover:border-blue-600 hover:bg-blue-50 hover:text-blue-900"
                        >
                          <Plus className="w-4 h-4" />
                          Dodaj pokój
                        </Button>
                      </div>
                    </TooltipTrigger>
                    {rooms.length >= MAX_ROOMS && (
                      <TooltipContent>
                        Ten model obsługuje maksymalnie {MAX_ROOMS} pokoje.
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
                        <span className="font-semibold text-slate-700">Pokój #{index + 1}</span>
                        <button 
                          onClick={() => handleRemoveRoom(room.id)}
                          className="text-slate-400 hover:text-red-500 transition-colors p-1"
                          aria-label="Usuń pokój"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {SIZES.map((size) => {
                          const isSelected = room.size === size;
                          
                          // Example logic to block large rooms on 4-room setups to show the UI
                          const isBlocked = (rooms.length === 4 && size === "> 35 m²");
                          
                          return (
                            <TooltipProvider key={size}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => !isBlocked && handleUpdateRoomSize(room.id, size)}
                                    type="button"
                                    className={`
                                      relative flex flex-col items-center justify-center p-4 rounded-lg border-2 transition-all duration-200
                                      ${isSelected 
                                        ? "border-yellow-400 bg-yellow-50 text-yellow-950" 
                                        : isBlocked 
                                          ? "border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed" 
                                          : "border-slate-100 hover:border-slate-300 text-slate-600 bg-white"
                                      }
                                    `}
                                  >
                                    {isSelected && (
                                      <div className="absolute top-2 right-2 text-yellow-500">
                                        <CheckCircle2 className="w-4 h-4" />
                                      </div>
                                    )}
                                    <span className="font-medium">{size}</span>
                                  </button>
                                </TooltipTrigger>
                                {isBlocked && (
                                  <TooltipContent>
                                    Dla 4 pokoi ten wariant metrażu jest niedostępny z uwagi na moc agregatu.
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
                {currentAggregate && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    className="bg-slate-900 rounded-xl p-5 text-slate-50 relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl transform translate-x-1/2 -translate-y-1/2"></div>
                    <div className="flex items-start gap-4 relative z-10">
                      <div className="p-3 bg-white/10 rounded-lg shrink-0">
                        <Wind className="w-6 h-6 text-yellow-400" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-lg text-white">Dobrany Agregat</h4>
                          <span className="text-[10px] uppercase tracking-wider bg-white/20 px-2 py-0.5 rounded font-bold">Auto</span>
                        </div>
                        <p className="text-slate-300 text-sm mb-3">Na podstawie Twojego wyboru system automatycznie dobrał odpowiednią jednostkę zewnętrzną.</p>
                        <div className="flex gap-4">
                          <div>
                            <p className="text-xs text-slate-400">Model</p>
                            <p className="font-medium text-white">{currentAggregate.model}</p>
                          </div>
                          <div>
                            <p className="text-xs text-slate-400">Moc chłodnicza</p>
                            <p className="font-medium text-white">{currentAggregate.power}</p>
                          </div>
                        </div>
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
                <div className="flex items-baseline gap-2">
                  <motion.div 
                    key={displayedPrice}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-4xl md:text-5xl font-extrabold text-slate-900"
                  >
                    {formatPrice(displayedPrice)} <span className="text-2xl font-bold">zł</span>
                  </motion.div>
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
                      <span className="font-medium text-slate-900">{rooms.length}x {INTERNAL_UNIT.name}</span>
                    </li>
                    {rooms.map((r, i) => (
                      r.size && (
                        <li key={i} className="flex justify-between pl-4 text-slate-500">
                          <span>Pokój #{i + 1}:</span>
                          <span>{r.size}</span>
                        </li>
                      )
                    ))}
                    {currentAggregate && (
                      <li className="flex justify-between pt-2 mt-2 border-t border-slate-100">
                        <span>Jednostka zewnętrzna:</span>
                        <span className="font-medium text-slate-900">1x {currentAggregate.model}</span>
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
                      <span>Co obejmuje standardowy montaż w tej cenie?</span>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-600 space-y-2">
                    <ul className="list-disc pl-4 space-y-1 mt-2">
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
                className="w-full text-base font-bold shadow-lg shadow-blue-600/20"
                disabled={!isFullyConfigured && rooms.length > 0}
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
