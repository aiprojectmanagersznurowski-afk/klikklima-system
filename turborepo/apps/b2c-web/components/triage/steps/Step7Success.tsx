"use client";
import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTriageStore } from '@/store/triageStore';
import { StepWrapper } from '../StepWrapper';
import { Check, Info, Wind, Settings2, Box, Calendar, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import * as Accordion from '@radix-ui/react-accordion';
import * as Tooltip from '@radix-ui/react-tooltip';
import { DeviceModal } from '../../ui/DeviceModal';
import { getRecommendation } from '@/app/actions/getRecommendation';
import type { BestsellerProduct } from '@/app/actions/getBestsellers';

const DeviceCard = ({ product, onSelect, onDetails, isBestMatch = false }: { product: BestsellerProduct, onSelect: () => void, onDetails: () => void, isBestMatch?: boolean }) => {
  const brutto = Math.round((product.deviceNettoPrice + product.installNettoPrice) * 1.08);
  return (
    <div className={cn("group relative bg-card rounded-2xl border border-border overflow-hidden flex flex-col transition-all duration-300", isBestMatch ? "shadow-[0_20px_60px_-12px_rgba(23,80,200,0.15)] border-primary/20" : "hover:-translate-y-1 hover:shadow-lg")}>
      <div className="relative h-48 bg-[#f0f4fb] overflow-hidden flex items-center justify-center p-4">
        <img src={product.img} alt={product.model} className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105 mix-blend-multiply" />
      </div>
      <div className="flex flex-col flex-1 p-6 gap-4">
        <div className="flex items-center gap-2">
          <span className={cn("inline-flex items-center justify-center w-8 h-8 rounded-md text-xs font-bold text-white", product.brand === "Fuji Electric" ? "bg-[#0d1b2e]" : product.brand === "Haier" ? "bg-[#c8102e]" : "bg-primary")}>{product.brandLogo}</span>
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase">{product.brand}</p>
            <p className="text-sm font-semibold text-foreground">{product.model}</p>
          </div>
        </div>
        <div className="flex flex-col gap-2">
           <span className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground text-xs font-semibold px-3 py-1.5 rounded-full w-fit">
            <Wind className="w-3 h-3" /> {product.power}
          </span>
        </div>
        <div className="mt-auto pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-1">Cena z montażem (brutto)</p>
          <p className="text-3xl font-bold text-foreground tracking-tight">{brutto.toLocaleString("pl-PL")} zł</p>
        </div>
        <button onClick={onSelect} className="mt-2 w-full bg-primary text-primary-foreground font-semibold text-sm rounded-xl py-3 px-4 flex items-center justify-center gap-2 hover:bg-[#1244b0]">
          Wybieram ten zestaw <Check className="w-4 h-4" />
        </button>
        <button onClick={onDetails} className="w-full text-primary font-semibold text-sm rounded-xl py-2.5 px-4 border border-primary/20 bg-primary/5 hover:bg-primary/10 flex items-center justify-center gap-2">
          <Info className="w-4 h-4" /> Szczegóły urządzenia
        </button>
      </div>
    </div>
  );
};

export const Step7Success = () => {
  const { data: state, nextStep, updateData } = useTriageStore();
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isLoading, setIsLoading] = React.useState(true);
  const [recommendedDevices, setRecommendedDevices] = React.useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = React.useState<BestsellerProduct | null>(null);

  const rooms = state.roomCount || 1;

  React.useEffect(() => {
    async function fetchRecommendation() {
      setIsLoading(true);
      const res = await getRecommendation(state.roomCount || 1, state.roomSizes, state.selectedDeviceLine);
      if (res.success && res.recommendations && res.recommendations.length > 0) {
        const mappedRecs = res.recommendations.map((rec: any, idx: number) => {
          const mainUnit = rec.internalUnits[0];
          const isMulti = rec.type === 'multi';
          const brandLogo = mainUnit.brand === 'Fuji Electric' ? 'FE' : mainUnit.brand === 'Haier' ? 'HA' : (mainUnit.brand || "UN").substring(0, 2).toUpperCase();
          const newDeviceData: BestsellerProduct = {
            id: mainUnit.id + "-" + idx,
            brand: mainUnit.brand || "Nieznana",
            brandLogo: brandLogo,
            model: mainUnit.series_name || mainUnit.model_code || "Klimatyzator",
            power: isMulti ? `Dla ${rec.internalUnits.length} pomieszczeń` : `${mainUnit.cooling_capacity_kw || '2.5'} kW`,
            deviceNettoPrice: rec.totalDevicesPrice,
            installNettoPrice: 1500 * rooms,
            marketingDesc: mainUnit.marketing_description || "Elegancki design.",
            img: mainUnit.image_url || "https://images.unsplash.com/photo-1718203862467-c33159fdc504?q=80&w=1080",
            features: []
          };
          return { product: newDeviceData, rawRec: rec };
        });
        setRecommendedDevices(mappedRecs);
      }
      setIsLoading(false);
    }
    fetchRecommendation();
  }, [state.roomCount, state.roomSizes]);

  const handleSelectRecommendation = (recItem: any) => {
    updateData({
      selectedInternalUnits: recItem.rawRec.internalUnits,
      selectedExternalUnit: recItem.rawRec.externalUnit,
      priceDevices: recItem.rawRec.totalDevicesPrice,
    });
    nextStep();
  };

  const memoizedInitialRooms = useMemo(() => {
    return Array.from({ length: state.roomCount || 1 }).map((_, index) => {
      const rawSize = state.roomSizes[index + 1] || '26-35 m²';
      let mappedSize: 'S' | 'M' | 'L' | 'XL' = 'M';
      if (rawSize === 'Do 25 m²') mappedSize = 'S';
      else if (rawSize === '26-35 m²') mappedSize = 'M';
      else if (rawSize === '36-50 m²') mappedSize = 'L';
      else if (rawSize === 'Powyżej 50 m²') mappedSize = 'XL';
      return { id: `room-triage-${index}`, size: mappedSize };
    });
  }, [state.roomCount, state.roomSizes]);

  if (isLoading) {
    return (
      <StepWrapper title="Trwa dobieranie klimatyzatora..." subtitle="Nasz algorytm przelicza zapotrzebowanie...">
        <div className="flex flex-col items-center justify-center py-20"><Loader2 className="w-12 h-12 text-primary animate-spin" /></div>
      </StepWrapper>
    );
  }

  const getTitle = (count: number) => count === 1 ? "Znaleźliśmy idealny wariant" : `Znaleźliśmy ${count} świetnych wariantów`;

  return (
    <StepWrapper title={getTitle(recommendedDevices.length)} subtitle="Oto propozycje zestawów dobranych specjalnie do Twojego zapotrzebowania">
      <div className="max-w-6xl mx-auto space-y-12 pb-20">
        {recommendedDevices.length > 0 && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-zinc-900 px-2 flex items-center gap-2"><span className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-sm">1</span> Twój wybrany zestaw</h3>
            <DeviceCard product={recommendedDevices[0].product} isBestMatch onDetails={() => { setSelectedProduct(recommendedDevices[0].product); setIsModalOpen(true); }} onSelect={() => handleSelectRecommendation(recommendedDevices[0])} />
          </div>
        )}
        {recommendedDevices.length > 1 && (
          <div className="space-y-6">
            <h3 className="text-xl font-bold text-zinc-900 px-2 flex items-center gap-2"><span className="w-8 h-8 rounded-full bg-zinc-100 text-zinc-600 flex items-center justify-center text-sm">2</span> Alternatywne opcje</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {recommendedDevices.slice(1).map((rec, i) => (
                <DeviceCard key={i} product={rec.product} onDetails={() => { setSelectedProduct(rec.product); setIsModalOpen(true); }} onSelect={() => handleSelectRecommendation(rec)} />
              ))}
            </div>
          </div>
        )}
        {selectedProduct && (
            }}
          />
        )}

        {/* Pricing Info Section */}
        <div className="bg-primary/5 rounded-3xl p-6 border border-primary/10 text-center max-w-3xl mx-auto mt-12">
          <p className="text-sm sm:text-base text-muted-foreground mb-4">
            Podane wyżej ceny zawierają podatek VAT 8% oraz standardowy pakiet usług montażowych.
          </p>

          <Accordion.Root type="single" collapsible className="w-full bg-white rounded-xl shadow-sm border border-border/50 text-left">
            <Accordion.Item value="item-1" className="overflow-hidden rounded-xl">
              <Accordion.Header className="flex">
                <Accordion.Trigger className="flex flex-1 items-center justify-between p-4 font-medium transition-all hover:bg-secondary/50 group text-foreground">
                  <span className="flex items-center gap-2">
                    <Info className="w-5 h-5 text-primary" />
                    Co zawiera standardowy pakiet montażowy?
                  </span>
                  <ChevronDown className="h-5 w-5 shrink-0 transition-transform duration-300 group-data-[state=open]:rotate-180 text-muted-foreground" />
                </Accordion.Trigger>
              </Accordion.Header>
              <Accordion.Content className="overflow-hidden text-sm data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
                <div className="p-4 pt-0 border-t border-border/50 bg-secondary/20">
                  <ul className="space-y-3 mt-4">
                    {currentInstallationItems.map((item, i) => (
                      <li key={i} className="flex items-start gap-2 text-muted-foreground">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </Accordion.Content>
            </Accordion.Item>
          </Accordion.Root>
        </div>
      </div>
    </StepWrapper>
  );
};
