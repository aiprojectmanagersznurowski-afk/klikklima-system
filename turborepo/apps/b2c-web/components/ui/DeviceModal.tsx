"use client";

import React, { useState } from "react";
import { X, Info, Check, Wifi, Volume2, Zap, Wind, ChevronDown, Calendar, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { STANDARD_INSTALLATION_ITEMS } from "@/lib/constants";

export interface DeviceData {
  name: string;
  capacity: string;
  price: string;
  marketingDescription?: string;
  images: { id: string; src: string; alt: string }[];
  chips: { iconName: string; label: string }[];
}

interface DeviceModalProps {
  device: DeviceData | null;
  isOpen: boolean;
  onClose: () => void;
  onReserveClick?: (device: DeviceData) => void;
}

// Helper to map string icon names from DB to Lucide icons
const getIcon = (name: string) => {
  switch (name) {
    case 'Wifi': return Wifi;
    case 'Volume2': return Volume2;
    case 'Zap': return Zap;
    case 'Wind': return Wind;
    default: return Check;
  }
};

export function DeviceModal({ device, isOpen, onClose, onReserveClick }: DeviceModalProps) {
  const [activeImage, setActiveImage] = useState(0);
  const [installOpen, setInstallOpen] = useState(false);

  // Reset image when modal opens for a new device
  React.useEffect(() => {
    if (isOpen) {
      setActiveImage(0);
      setInstallOpen(false);
    }
  }, [isOpen, device]);

  if (!device) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Glassmorphism backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={onClose}
            className="absolute inset-0"
            style={{
              backdropFilter: "blur(12px) saturate(150%)",
              background: "rgba(15, 27, 53, 0.45)",
            }}
          />

          {/* Drawer panel */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 280 }}
            className="relative ml-auto w-full max-w-2xl h-full bg-white flex flex-col shadow-2xl"
            style={{ fontFamily: "'Inter', sans-serif" }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-7 py-5 border-b border-border shrink-0">
              <div className="flex items-center gap-3">
                <div
                  className="h-9 px-4 rounded-full flex items-center gap-2 text-xs font-semibold tracking-wide uppercase"
                  style={{ background: "#f0f3f8", color: "#1a3a6b" }}
                >
                  <div className="w-2 h-2 rounded-full bg-accent" />
                  {device.name.split(' ')[0]} {/* Simple extraction of Brand for now */}
                </div>
                <span className="text-xs text-muted-foreground hidden sm:block">Autoryzowany partner</span>
              </div>

              <button
                onClick={onClose}
                className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable body */}
            <div
              className="flex-1 overflow-y-auto"
              style={{ scrollbarWidth: "none" }}
            >
              {/* Hero / Gallery */}
              <div className="px-7 pt-7 pb-5">
                <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50/30 border border-border mb-3" style={{ aspectRatio: "16/9" }}>
                  <motion.img
                    key={activeImage}
                    initial={{ opacity: 0, scale: 1.04 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.4 }}
                    src={device.images[activeImage]?.src}
                    alt={device.images[activeImage]?.alt || device.name}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/30 to-transparent pointer-events-none" />
                </div>

                <div className="flex gap-2 overflow-x-auto pb-2">
                  {device.images.map((img, i) => (
                    <button
                      key={img.id}
                      onClick={() => setActiveImage(i)}
                      className={`relative rounded-lg overflow-hidden border-2 transition-all duration-200 shrink-0 ${
                        activeImage === i
                          ? "border-accent shadow-md shadow-accent/20 scale-105"
                          : "border-transparent hover:border-border"
                      }`}
                      style={{ width: 60, height: 46 }}
                    >
                      <img src={img.src} alt={img.alt} className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Info section */}
              <div className="px-7 pb-5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="flex items-center gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-3.5 h-3.5 ${i < 4 ? "fill-amber-400 text-amber-400" : "fill-muted text-muted-foreground"}`} />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">Oceny ekspertów</span>
                </div>

                <h2
                  className="text-2xl font-bold text-foreground leading-tight mb-2"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  {device.name} <br />
                  <span className="text-accent">{device.capacity}</span>
                </h2>

                <p className="text-[15px] text-muted-foreground leading-relaxed mb-6">
                  {device.marketingDescription || "Wydajne i energooszczędne urządzenie klasy premium z kompleksowym montażem."}
                </p>

                {/* Feature chips */}
                <div className="flex flex-wrap gap-2 mb-7">
                  {device.chips.map((chip, i) => {
                    const IconComponent = getIcon(chip.iconName);
                    return (
                      <div
                        key={i}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border"
                        style={{
                          background: "#f0f3f8",
                          color: "#1a3a6b",
                          borderColor: "rgba(26,58,107,0.15)",
                        }}
                      >
                        <IconComponent className="w-3.5 h-3.5 text-accent" />
                        {chip.label}
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-border mb-6" />

                {/* Installation accordion */}
                <div
                  className="rounded-xl border overflow-hidden"
                  style={{ borderColor: "rgba(26,58,107,0.15)" }}
                >
                  <button
                    onClick={() => setInstallOpen((v) => !v)}
                    className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: "#e8edf5" }}
                      >
                        <Info className="w-3.5 h-3.5 text-accent" />
                      </div>
                      <span
                        className="text-sm font-semibold text-foreground"
                        style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                      >
                        Standardowy zakres montażu
                      </span>
                    </div>
                    <motion.div animate={{ rotate: installOpen ? 180 : 0 }} transition={{ duration: 0.25 }}>
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </motion.div>
                  </button>

                  <AnimatePresence initial={false}>
                    {installOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.28, ease: "easeInOut" }}
                        style={{ overflow: "hidden" }}
                      >
                        <div className="px-5 pb-5 pt-1 border-t border-border bg-muted/30">
                          <ul className="space-y-3 mt-3">
                            {STANDARD_INSTALLATION_ITEMS.map((item, i) => (
                              <li key={i} className="flex items-start gap-3">
                                <div
                                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                                  style={{ background: "#e8edf5" }}
                                >
                                  <Check className="w-3 h-3 text-accent" strokeWidth={2.5} />
                                </div>
                                <span className="text-sm text-foreground leading-relaxed">{item}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                <div className="h-6" />
              </div>
            </div>

            {/* Sticky footer */}
            <div
              className="shrink-0 px-7 py-5 border-t bg-white"
              style={{ borderColor: "rgba(26,58,107,0.1)" }}
            >
              <div className="flex items-end justify-between gap-4 mb-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                    Szacunkowa cena z montażem
                  </p>
                  <p
                    className="text-3xl font-bold text-foreground leading-none"
                    style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                  >
                    {device.price}{" "}
                    <span className="text-xl font-semibold text-muted-foreground">PLN</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    *Cena z VAT 8% dla budownictwa mieszkaniowego
                  </p>
                </div>
                <div className="hidden sm:block text-right shrink-0">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                    Dostępny od ręki
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={() => onReserveClick?.(device)}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98] shadow-lg"
                  style={{
                    background: "linear-gradient(135deg, #1a3a6b 0%, #2563eb 100%)",
                    boxShadow: "0 6px 24px rgba(37, 99, 235, 0.35)",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  <Calendar className="w-4 h-4" />
                  Wybierz to urządzenie
                </button>
                <button
                  onClick={onClose}
                  className="sm:w-auto flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl text-sm font-semibold transition-all duration-200 border hover:bg-muted/60 active:scale-[0.98]"
                  style={{
                    color: "#1a3a6b",
                    borderColor: "rgba(26,58,107,0.25)",
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  Wróć
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
