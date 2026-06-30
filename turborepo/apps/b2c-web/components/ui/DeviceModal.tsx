"use client";

import React, { useState, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Plus, Wifi, Volume2, Snowflake, Trash2, Cpu, Info, Check, ShieldCheck, Wrench, Ruler, Cable, Sparkles, Palette, Wind, ChevronLeft, ChevronRight
} from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./accordion";

import type { BestsellerProduct } from "@/app/actions/getBestsellers";
import { getSetForConfig } from "@/app/actions/getSetForConfig";
import { getAvailableSizes } from "@/app/actions/getAvailableSizes";
import { getValidConfigurations } from "@/app/actions/getValidConfigurations";
import { getLowestPriceForIndoorUnit } from "@/app/actions/getLowestPriceForIndoorUnit";

const INDOOR_IMG = "https://images.unsplash.com/photo-1711873315178-ee7de0b2ea5d?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";
const OUTDOOR_IMG = "https://images.unsplash.com/photo-1757219525975-03b5984bc6e8?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080";

export type RoomSize = "S" | "M" | "L" | "XL";

export interface Room {
  id: string;
  name: string;
  size: RoomSize | null;
}

const ROOM_SIZES: Record<RoomSize, { label: string; area: string; power: string; }> = {
  S: { label: "do 20 m²", area: "do 20 m²", power: "2.5 kW" },
  M: { label: "20–30 m²", area: "20–30 m²", power: "3.5 kW" },
  L: { label: "30–40 m²", area: "30–40 m²", power: "5.0 kW" },
  XL: { label: "40–60 m²", area: "40–60 m²", power: "7.1 kW" },
};

const SIZE_ORDER: RoomSize[] = ["S", "M", "L", "XL"];

function sizeToCode(size: RoomSize): string {
  switch (size) {
    case "S": return "07";
    case "M": return "09";
    case "L": return "12";
    case "XL": return "18";
    default: return "09";
  }
}

const fmt = (n: number) => n.toLocaleString("pl-PL").replace(/,/g, " ") + " zł";

const iconMap: Record<string, any> = {
  Wifi: Wifi,
  Eye: Check,
  Wind: Wind,
};

function FeatureChip({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-[#F0F4FB] px-3 py-1.5 text-[13px] font-medium text-[#475569]">
      <Icon className="size-3.5 text-[#2563EB]" />
      {label}
    </span>
  );
}

function SizeSelector({
  value,
  onChange,
  groupId,
  supportedSizes,
  validHashes,
  rooms,
  roomId
}: {
  value: RoomSize | null;
  onChange: (s: RoomSize) => void;
  groupId: string;
  supportedSizes: string[];
  validHashes: string[] | null;
  rooms: Room[];
  roomId: string;
}) {
  return (
    <div className="relative flex w-full rounded-xl bg-[#F0F4FB] p-1">
      {SIZE_ORDER.map((s) => {
        const active = s === value;
        const isSizeSupported = supportedSizes.includes(s);
        let isBlocked = !isSizeSupported;
        
        if (isSizeSupported && validHashes !== null) {
           const hypotheticalRooms = rooms.map(r => r.id === roomId ? { ...r, size: s } : r);
           const isFullyHypothetical = hypotheticalRooms.every(r => r.size !== null);
           if (isFullyHypothetical) {
             const requiredCodes = hypotheticalRooms.map(r => sizeToCode(r.size as RoomSize)).sort();
             const hypotheticalHash = requiredCodes.join('-');
             isBlocked = !validHashes.includes(hypotheticalHash);
           }
        }

        return (
          <button
            key={s}
            type="button"
            disabled={isBlocked}
            onClick={() => onChange(s)}
            className={`relative z-10 flex-1 rounded-lg px-1 py-2 text-[12px] font-semibold whitespace-nowrap transition-colors ${
              active 
                ? "text-white" 
                : isBlocked 
                  ? "text-[#94A3B8] opacity-50 cursor-not-allowed" 
                  : "text-[#475569] hover:text-[#0F172A]"
            }`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${groupId}`}
                className="absolute inset-0 -z-10 rounded-lg bg-[#2563EB] shadow-[0_4px_12px_rgba(37,99,235,0.35)]"
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
              />
            )}
            {ROOM_SIZES[s].label}
          </button>
        );
      })}
    </div>
  );
}

function RoomRow({
  room,
  index,
  onChange,
  onRemove,
  supportedSizes,
  validHashes,
  rooms
}: {
  room: Room;
  index: number;
  onChange: (size: RoomSize) => void;
  onRemove: () => void;
  supportedSizes: string[];
  validHashes: string[] | null;
  rooms: Room[];
}) {
  const size = room.size ? ROOM_SIZES[room.size] : null;
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, height: 0, marginTop: 0, scale: 0.98 }}
      transition={{ duration: 0.22, ease: "easeOut" }}
      className="rounded-2xl border border-[#E8EDF5] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="flex size-8 items-center justify-center rounded-lg bg-[#EEF3FE] text-[13px] font-bold text-[#2563EB]">
            {index + 1}
          </span>
          <div>
            <p className="font-semibold text-[#0F172A]">{room.name}</p>
            {size ? (
               <p className="text-[13px] text-[#475569]">
                 {size.area} · {size.power}
               </p>
            ) : (
               <p className="text-[13px] text-[#94A3B8]">
                 Wybierz metraż
               </p>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="flex size-8 items-center justify-center rounded-full text-[#94A3B8] transition-colors hover:bg-[#FEF2F2] hover:text-[#EF4444]"
          aria-label="Usuń pokój"
        >
          <Trash2 className="size-4" />
        </button>
      </div>
      <div className="mt-3">
        <SizeSelector 
           value={room.size} 
           onChange={onChange} 
           groupId={room.id}
           roomId={room.id}
           supportedSizes={supportedSizes}
           validHashes={validHashes}
           rooms={rooms}
        />
      </div>
    </motion.div>
  );
}

export interface DeviceModalProps {
  device: BestsellerProduct | null;
  isOpen: boolean;
  onClose: () => void;
  onReserveClick?: () => void;
  initialRooms?: Room[];
}

export function DeviceModal({
  device,
  isOpen,
  onClose,
  onReserveClick,
  initialRooms
}: DeviceModalProps) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [matchedSet, setMatchedSet] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [supportedSizes, setSupportedSizes] = useState<string[]>(['S', 'M', 'L', 'XL']);
  const [validHashes, setValidHashes] = useState<string[] | null>(null);
  const [maxSupportedRooms, setMaxSupportedRooms] = useState<number>(5);
  const [basePrice, setBasePrice] = useState<number | null>(device?.startingPriceBrutto || null);

  const images = device ? [
    device.img && device.img.length > 5 ? device.img : INDOOR_IMG, 
    matchedSet?.outdoorImageUrl || OUTDOOR_IMG
  ] : [];

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (galleryIndex !== null) {
      setGalleryIndex((galleryIndex + 1) % images.length);
    }
  };

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (galleryIndex !== null) {
      setGalleryIndex((galleryIndex - 1 + images.length) % images.length);
    }
  };

  const roomLabels = ["Salon", "Sypialnia", "Gabinet", "Kuchnia", "Pokój dziecka"];

  const isFullyConfigured = rooms.length > 0 && rooms.every((r) => r.size !== null);
  const hasRooms = rooms.length > 0;

  useEffect(() => {
    if (isOpen && device) {
      if (initialRooms && initialRooms.length > 0) {
        setRooms(initialRooms);
      } else {
        setRooms([]);
      }
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
        const configuredRooms = rooms.map(r => ({ id: r.id, size: r.size as RoomSize }));
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

  const addRoom = () => {
    setRooms((prev) => {
      if (prev.length >= maxSupportedRooms || (!device?._raw?.is_multi_compatible && prev.length >= 1)) return prev;
      const name = roomLabels[prev.length] ?? `Pokój ${prev.length + 1}`;
      return [...prev, { id: crypto.randomUUID(), name, size: null }];
    });
  };

  const updateRoom = (id: string, size: RoomSize) =>
    setRooms((prev) => prev.map((r) => (r.id === id ? { ...r, size } : r)));

  const removeRoom = (id: string) =>
    setRooms((prev) => prev.filter((r) => r.id !== id));

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

  const total = isFullyConfigured && matchedSet ? Math.round(matchedSet.totalPrice * 1.08) : (basePrice || 0);

  if (!device) return null;

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AnimatePresence>
        {isOpen && (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Overlay asChild forceMount>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="fixed inset-0 z-50 bg-[#0F172A]/55 backdrop-blur-sm"
              />
            </DialogPrimitive.Overlay>

            <DialogPrimitive.Content 
              asChild 
              forceMount 
              aria-describedby={undefined}
              onInteractOutside={(e) => {
                if (galleryIndex !== null) {
                  e.preventDefault();
                }
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 16 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97, y: 12 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="fixed left-1/2 top-1/2 z-50 flex max-h-[92vh] w-[calc(100%-2rem)] max-w-5xl -translate-x-1/2 -translate-y-1/2 flex-col overflow-y-auto rounded-[24px] bg-white shadow-[0_30px_80px_-20px_rgba(15,23,42,0.45)] md:flex-row md:overflow-hidden"
              >
                {/* Close button */}
                <DialogPrimitive.Close className="absolute right-4 top-4 z-20 flex size-9 items-center justify-center rounded-full text-[#64748B] transition-colors hover:bg-[#F1F5F9] hover:text-[#0F172A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2563EB]/50">
                  <X className="size-5" />
                  <span className="sr-only">Zamknij</span>
                </DialogPrimitive.Close>

                {/* ---------- LEFT: Configuration ---------- */}
                <div className="flex-none bg-white px-6 py-7 md:flex-1 md:overflow-y-auto md:px-8">
                  <DialogPrimitive.Title className="text-[22px] font-bold tracking-tight text-[#0F172A]">
                    Skonfiguruj swój system klimatyzacji
                  </DialogPrimitive.Title>
                  <p className="mt-1 text-[14px] text-[#475569]">
                    Dobierz jednostki do pomieszczeń — agregat dobierzemy automatycznie
                  </p>

                  {/* Indoor unit preview */}
                  <div className="mt-6 flex items-center gap-4 rounded-2xl border border-[#E8EDF5] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                    <button 
                      onClick={(e) => { e.preventDefault(); setGalleryIndex(0); }}
                      type="button"
                      className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#F1F5F9] cursor-pointer transition-opacity hover:opacity-80 block"
                    >
                      <img
                        src={images[0]}
                        alt={device.model}
                        className="size-full object-cover mix-blend-multiply"
                      />
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-semibold uppercase tracking-wide text-[#2563EB]">
                        {device.brand}
                      </p>
                      <h3 className="font-bold text-[#0F172A]">
                        Seria {device.model}
                      </h3>
                      {device.marketingDesc && (
                        <p className="mt-1 text-[13px] leading-relaxed text-[#475569]">
                          {device.marketingDesc}
                        </p>
                      )}
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                         {device.features?.map((f, i) => {
                            const IconComp = iconMap[f.iconName] || Check;
                            return <FeatureChip key={i} icon={IconComp} label={f.label} />
                         })}
                         {device._raw?.color && (
                            <FeatureChip icon={Palette} label={device._raw.color} />
                         )}
                      </div>
                    </div>
                  </div>

                  {/* Rooms section */}
                  <div className="mt-7 flex items-center justify-between">
                    <h3 className="text-[17px] font-bold text-[#0F172A]">
                      Pokoje do klimatyzacji
                    </h3>
                    <button
                      type="button"
                      onClick={addRoom}
                      disabled={rooms.length >= maxSupportedRooms || (!device._raw?.is_multi_compatible && rooms.length >= 1)}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-[#CBD9F2] bg-white px-3.5 py-2 text-[14px] font-semibold text-[#2563EB] transition-colors hover:border-[#2563EB] hover:bg-[#EEF3FE] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Plus className="size-4" />
                      Dodaj pokój
                    </button>
                  </div>

                  <div className="mt-4 space-y-3">
                    <AnimatePresence initial={false}>
                      {rooms.map((room, i) => (
                        <RoomRow
                          key={room.id}
                          room={room}
                          index={i}
                          onChange={(s) => updateRoom(room.id, s)}
                          onRemove={() => removeRoom(room.id)}
                          supportedSizes={supportedSizes}
                          validHashes={validHashes}
                          rooms={rooms}
                        />
                      ))}
                    </AnimatePresence>

                    {!hasRooms && (
                      <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] py-10 text-center">
                        <p className="text-[14px] text-[#475569]">
                          Dodaj pierwsze pomieszczenie, aby rozpocząć konfigurację.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Outdoor unit (agregat) */}
                  <h3 className="mt-7 text-[17px] font-bold text-[#0F172A]">
                    Dobrany Agregat
                  </h3>
                  <div className="relative mt-4 overflow-hidden rounded-2xl bg-[#0F172A] p-5">
                    {/* glow */}
                    <div className="pointer-events-none absolute -right-10 -top-16 size-48 rounded-full bg-[#2563EB]/40 blur-3xl" />
                    <div className="pointer-events-none absolute -bottom-16 left-10 size-40 rounded-full bg-[#38BDF8]/20 blur-3xl" />

                    <AnimatePresence mode="wait">
                      <motion.div
                        key={(isFullyConfigured && matchedSet && !isLoading) ? matchedSet.outdoorModel : "empty"}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.25 }}
                        className="relative flex items-center gap-4"
                      >
                        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-white/5">
                          {isFullyConfigured && matchedSet && !isLoading ? (
                            <button 
                              onClick={(e) => { e.preventDefault(); setGalleryIndex(1); }}
                              type="button"
                              className="size-full block cursor-pointer transition-opacity hover:opacity-80"
                            >
                              <img
                                src={images[1]}
                                alt="Agregat zewnętrzny"
                                className="size-full object-cover opacity-90"
                              />
                            </button>
                          ) : (
                            <Cpu className={`size-8 ${isLoading ? 'animate-pulse text-yellow-400' : 'text-white/40'}`} />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#2563EB]/20 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#93C5FD]">
                            <Sparkles className="size-3" />
                            Inteligentny dobór
                          </span>
                          {isFullyConfigured && matchedSet && !isLoading ? (
                            <>
                              <h4 className="mt-2 font-bold text-white">
                                {matchedSet.outdoorModel}
                              </h4>
                              <p className="text-[13px] text-slate-300">
                                Moc całkowita do {matchedSet.capacity} kW
                              </p>
                            </>
                          ) : (
                            <p className="mt-2 text-[14px] text-slate-300">
                              {isLoading ? "Trwa dobieranie agregatu..." : "Dodaj i skonfiguruj pomieszczenia, aby dobrać agregat"}
                            </p>
                          )}
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>

                {/* ---------- RIGHT: Summary & Pricing ---------- */}
                <div className="flex w-full shrink-0 flex-col border-t border-[#E8EDF5] bg-white md:w-[360px] md:border-l md:border-t-0">
                  <div className="flex-none px-6 py-7 md:flex-1 md:overflow-y-auto">
                    {/* Price */}
                    <p className="text-[13px] font-medium text-[#475569]">
                      {isFullyConfigured ? "Cena całkowita zestawu" : "Cena zaczyna się od"}
                    </p>
                    <div className="mt-1 flex items-end gap-1">
                      <AnimatePresence mode="popLayout">
                        {(isLoading || (!isFullyConfigured && basePrice === null)) ? (
                           <div className="h-10 w-32 bg-slate-200 animate-pulse rounded-md" />
                        ) : (
                           <motion.span
                             key={isFullyConfigured ? total : "from"}
                             initial={{ opacity: 0, y: 8 }}
                             animate={{ opacity: 1, y: 0 }}
                             exit={{ opacity: 0, y: -8 }}
                             transition={{ duration: 0.2 }}
                             className="text-[40px] font-extrabold leading-none tracking-tight text-[#0F172A]"
                           >
                             {fmt(total)}
                           </motion.span>
                        )}
                      </AnimatePresence>
                    </div>
                    <p className="mt-2 text-[12px] text-[#64748B]">
                      Zawiera 8% VAT oraz montaż podstawowy
                    </p>

                    <div className="my-6 h-px bg-[#E8EDF5]" />

                    {/* Summary list */}
                    <p className="text-[13px] font-semibold uppercase tracking-wide text-[#94A3B8]">
                      Podsumowanie konfiguracji
                    </p>
                    <ul className="mt-3 space-y-2.5">
                      {rooms.map((r) => (
                        <li
                          key={r.id}
                          className="flex items-center justify-between text-[14px]"
                        >
                          <span className="text-[#475569]">
                            {r.name}
                          </span>
                          <span className="font-semibold text-[#0F172A]">
                            {r.size ? `${ROOM_SIZES[r.size].area} · ${ROOM_SIZES[r.size].power}` : '---'}
                          </span>
                        </li>
                      ))}
                      {isFullyConfigured && matchedSet && !isLoading && (
                        <li className="flex items-center justify-between border-t border-dashed border-[#E8EDF5] pt-2.5 text-[14px]">
                          <span className="text-[#475569]">Agregat zewnętrzny</span>
                          <span className="font-semibold text-[#0F172A]">
                            1× {matchedSet.outdoorModel}
                          </span>
                        </li>
                      )}
                      {!hasRooms && (
                        <li className="text-[14px] text-[#94A3B8]">
                          Brak skonfigurowanych jednostek.
                        </li>
                      )}
                    </ul>

                    {/* Installation scope accordion */}
                    <div className="mt-6 rounded-2xl bg-[#F8FAFC] px-4">
                      <Accordion type="single" collapsible>
                        <AccordionItem value="scope" className="border-b-0">
                          <AccordionTrigger className="hover:no-underline">
                            <span className="flex items-center gap-2 font-semibold text-[#0F172A]">
                              <Info className="size-4 text-[#2563EB]" />
                              Co zawiera standardowy pakiet montażowy?
                            </span>
                          </AccordionTrigger>
                          <AccordionContent>
                            <ul className="space-y-2.5">
                              {[
                                { icon: Wrench, t: rooms.length <= 1 ? "Montaż 1 jednostki wewnętrznej i 1 zewnętrznej (do 4 m wys.)" : `Montaż ${rooms.length} jednostek wewnętrznych i 1 zewnętrznej (do 4 m wys.)` },
                                { icon: Cable, t: rooms.length <= 1 ? "Do 3 mb instalacji chłodniczej i przewodu sterującego" : `Do 3 mb instalacji chłodniczej dla każdego urządzenia (łącznie do ${rooms.length * 3} mb)` },
                                { icon: Ruler, t: rooms.length <= 1 ? "Przewiert przez jedną ścianę (1 szt.)" : `Przewiert przez ścianę (${rooms.length} szt.)` },
                                { icon: Wind, t: rooms.length <= 1 ? "Odprowadzenie skroplin grawitacyjnie do 3 mb" : "Odprowadzenie skroplin grawitacyjnie do 3 mb dla każdej jednostki" },
                                { icon: ShieldCheck, t: "Test szczelności układu i przeszkolenie użytkownika z obsługi" },
                              ].map((it) => (
                                <li
                                  key={it.t}
                                  className="flex items-center gap-2.5 text-[13px] text-[#475569]"
                                >
                                  <span className="flex size-6 items-center justify-center rounded-md bg-white text-[#2563EB] shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
                                    <it.icon className="size-3.5" />
                                  </span>
                                  {it.t}
                                </li>
                              ))}
                            </ul>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  </div>

                  {/* Sticky CTA */}
                  <div className="sticky bottom-0 z-10 border-t border-[#E8EDF5] bg-white px-6 py-5 shadow-[0_-8px_15px_-3px_rgba(15,23,42,0.05)] md:static md:shadow-none">
                    <button
                      type="button"
                      onClick={handleAuditClick}
                      disabled={(!isFullyConfigured && hasRooms) || isLoading}
                      className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-[#2563EB] py-4 text-[16px] font-bold text-white shadow-[0_12px_28px_-8px_rgba(37,99,235,0.6)] transition-all hover:bg-[#1D4ED8] hover:shadow-[0_16px_34px_-8px_rgba(37,99,235,0.7)] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                    >
                      <Check className="size-5 transition-transform group-hover:scale-110" />
                      {!isFullyConfigured && hasRooms ? "Uzupełnij metraż pokoi" : "Wybieram ten zestaw"}
                    </button>
                    <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-[#64748B]">
                      <ShieldCheck className="size-3.5 text-[#22C55E]" />
                      Bezpłatna wycena · Płatność po montażu
                    </p>
                  </div>
                </div>
              </motion.div>
            </DialogPrimitive.Content>

            {/* Fullscreen Gallery Overlay */}
            <AnimatePresence>
              {galleryIndex !== null && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md pointer-events-auto"
                  onClick={() => setGalleryIndex(null)}
                >
                  <button
                    onClick={(e) => { e.stopPropagation(); setGalleryIndex(null); }}
                    className="absolute right-6 top-6 z-50 flex size-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                  >
                    <X className="size-6" />
                  </button>
                  
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePrevImage(e); }}
                    className="absolute left-6 z-50 flex size-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                  >
                    <ChevronLeft className="size-8" />
                  </button>

                  <img 
                    src={images[galleryIndex]} 
                    alt="Galeria zdjęć urządzenia" 
                    className="max-h-[85vh] max-w-[85vw] object-contain select-none" 
                    onClick={(e) => e.stopPropagation()}
                  />

                  <button
                    onClick={(e) => { e.stopPropagation(); handleNextImage(e); }}
                    className="absolute right-6 z-50 flex size-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
                  >
                    <ChevronRight className="size-8" />
                  </button>
                  
                  <div className="absolute bottom-8 left-1/2 z-50 -translate-x-1/2 flex items-center gap-3 bg-black/50 px-4 py-2 rounded-full backdrop-blur-sm text-white/80 font-medium text-sm">
                    {galleryIndex + 1} / {images.length}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}
