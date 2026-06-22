"use client";
import React from 'react';
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
          const finalPriceBrutto = rec.totalBrutto; 

          const brandLogo = mainUnit.brand === 'Fuji Electric' ? 'FE' 
            : mainUnit.brand === 'Haier' ? 'HA' 
            : (mainUnit.brand || "UN").substring(0, 2).toUpperCase();

          const features = [
            mainUnit.has_wifi ? { iconName: "Wifi", label: "WIFI w standardzie" } : null,
            mainUnit.has_presence_sensor ? { iconName: "Eye", label: "Czujnik obecności" } : null,
            mainUnit.is_silent_mode ? { iconName: "Wind", label: "Tryb cichy" } : null,
          ].filter(Boolean) as any;

          const fallbackFeatures = [
            { iconName: "Wifi", label: "WIFI w standardzie" },
            { iconName: "Volume2", label: "Głośność od 20dB" },
            { iconName: "Zap", label: "Klasa A+++" },
            { iconName: "Wind", label: "Funkcja Jonizatora" }
          ];

          const newDeviceData: BestsellerProduct = {
            id: mainUnit.id + "-" + idx,
            brand: mainUnit.brand || "Nieznana",
            brandLogo: brandLogo,
            model: mainUnit.series_name || mainUnit.model_code || "Klimatyzator",
            power: isMulti ? `Dla ${rec.internalUnits.length} pomieszczeń` : `${mainUnit.cooling_capacity_kw || '2.5'} kW`,
            deviceNettoPrice: rec.totalDevicesPrice,
            installNettoPrice: 1500 * rooms,
            marketingDesc: mainUnit.marketing_description || "Elegancki design z matowym wykończeniem i technologią jonizacji powietrza. Idealny do nowoczesnych wnętrz. Gwarantuje niezwykle cichą pracę i wysoką oszczędność energii.",
            img: mainUnit.image_url || "https://images.unsplash.com/photo-1718203862467-c33159fdc504?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
            features: features.length > 0 ? features : fallbackFeatures
          };

          return {
            product: newDeviceData,
            rawRec: rec
          };
        });

        setRecommendedDevices(mappedRecs);
      } else {
        // Fallback jeśli nie pobrano z bazy
        const fallbackInstall = 1600 * rooms;
        const fallbackDevice = rooms > 1 ? 4000 + (rooms * 1500) : 3000;
        
        setRecommendedDevices([
          {
            rawRec: {
              internalUnits: [],
              externalUnit: null,
              totalDevicesPrice: fallbackDevice,
              totalBrutto: Math.round((fallbackInstall + fallbackDevice) * 1.08)
            },
            product: {
              id: 'fallback',
              brand: 'Fuji Electric',
              brandLogo: 'FE',
              model: rooms > 1 ? "Multi-Split" : "KETA",
              power: rooms > 1 ? `Dla ${rooms} pomieszczeń` : "2.5 kW / 3.5 kW",
              deviceNettoPrice: fallbackDevice,
              installNettoPrice: fallbackInstall,
              marketingDesc: "Niezawodne urządzenia i elastyczność montażu dla Twojego metrażu.",
              img: "https://images.unsplash.com/photo-1718203862467-c33159fdc504?q=80&w=1080",
              features: [
                { iconName: "Wifi", label: "WIFI w standardzie" }
              ]
            }
          }
        ]);
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

  const handleReserveFromModal = () => {
    setIsModalOpen(false);
    nextStep();
  };

  const getInstallationItems = (count: number) => {
    if (count === 1) {
      return [
        "Montaż 1 jednostki wewnętrznej i 1 zewnętrznej (do 4 m wys.)",
        "Do 3 mb instalacji chłodniczej i przewodu sterującego",
        "Przewiert przez jedną ścianę (1 szt.)",
        "Odprowadzenie skroplin grawitacyjnie do 3 mb",
        "Test szczelności układu i przeszkolenie użytkownika z obsługi"
      ];
    } else {
      return [
        `Montaż ${count} jednostek wewnętrznych i 1 zewnętrznej (do 4 m wys.)`,
        `Do 3 mb instalacji chłodniczej dla każdego urządzenia (łącznie do ${count * 3} mb)`,
        `Przewiert przez ścianę (${count} szt.)`,
        `Odprowadzenie skroplin grawitacyjnie do 3 mb dla każdej jednostki`,
        "Test szczelności układu i przeszkolenie użytkownika z obsługi"
      ];
    }
  };

  const currentInstallationItems = getInstallationItems(rooms);

  if (isLoading || recommendedDevices.length === 0) {
    return (
      <StepWrapper title="Trwa dobieranie klimatyzatora..." subtitle="Nasz algorytm przelicza zapotrzebowanie na chłód dla Twojego metrażu.">
        <div className="flex flex-col items-center justify-center py-20 space-y-6">
           <Loader2 className="w-12 h-12 text-primary animate-spin" />
           <p className="text-muted-foreground font-medium animate-pulse text-lg">Szukamy najlepszego rozwiązania w katalogu...</p>
        </div>
      </StepWrapper>
    );
  }

  return (
    <StepWrapper 
      title="Znaleźliśmy 3 świetne warianty" 
      subtitle="Oto propozycje zestawów dobranych specjalnie do Twojego zapotrzebowania"
    >
      <div className="max-w-6xl mx-auto space-y-12 pb-20 sm:pb-0">
        
        {/* Grid of Recommendation Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {recommendedDevices.map((item, index) => {
            const product = item.product;
            const isFirst = index === 0;
            const brutto = Math.round((product.deviceNettoPrice + product.installNettoPrice) * 1.08);

            return (
              <div key={product.id} className="group relative bg-card rounded-2xl border border-border overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_-12px_rgba(23,80,200,0.15)]">
                {isFirst && state.selectedDeviceLine && (
                  <span className="absolute top-4 left-4 z-10 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
                    Twój wybór z katalogu
                  </span>
                )}
                {!isFirst && index === 1 && (
                  <span className="absolute top-4 left-4 z-10 bg-orange-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                    Alternatywa
                  </span>
                )}

                <div className="relative h-48 bg-[#f0f4fb] overflow-hidden flex items-center justify-center p-4">
                  <img
                    src={product.img}
                    alt={`Klimatyzator ${product.brand} ${product.model}`}
                    className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-105 mix-blend-multiply"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent" />
                </div>

                <div className="flex flex-col flex-1 p-6 gap-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn("inline-flex items-center justify-center w-8 h-8 rounded-md text-xs font-bold tracking-wide text-white", 
                        product.brand === "Fuji Electric" ? "bg-[#0d1b2e]" : product.brand === "Haier" ? "bg-[#c8102e]" : "bg-primary"
                      )}
                    >
                      {product.brandLogo}
                    </span>
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                        {product.brand}
                      </p>
                      <p className="text-sm font-semibold text-foreground font-mono tracking-tight">
                        {product.model}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground text-xs font-semibold px-3 py-1.5 rounded-full">
                        <Wind className="w-3 h-3" />
                        {product.power}
                      </span>
                    </div>
                  </div>

                  <div className="mt-auto pt-4 border-t border-border">
                    <p className="text-xs text-muted-foreground mb-1">
                      Cena z montażem (brutto)
                    </p>
                    <p className="text-3xl font-bold text-foreground tracking-tight">
                      {brutto.toLocaleString("pl-PL")} zł
                    </p>
                  </div>

                  <button 
                    onClick={() => handleSelectRecommendation(item)}
                    className="mt-2 w-full bg-primary text-primary-foreground font-semibold text-sm rounded-xl py-3 px-4 flex items-center justify-center gap-2 transition-all duration-200 hover:bg-[#1244b0] active:scale-[0.98]"
                  >
                    Wybieram ten zestaw
                    <Check className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => {
                      setSelectedProduct(product);
                      setIsModalOpen(true);
                    }}
                    className="w-full text-primary font-semibold text-sm rounded-xl py-2.5 px-4 border border-primary/20 bg-primary/5 flex items-center justify-center gap-2 transition-all duration-200 hover:bg-primary/10"
                  >
                    <Info className="w-4 h-4" /> Szczegóły urządzenia
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {selectedProduct && (
          <DeviceModal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)} 
            device={selectedProduct} 
            initialRooms={Array.from({ length: state.roomCount || 1 }).map((_, index) => ({
              id: `room-triage-${index}`,
              size: (state.roomSizes[index] || 'M') as 'S' | 'M' | 'L' | 'XL'
            }))}
            onReserveClick={() => {
              const recItem = recommendedDevices.find(r => r.product.id === selectedProduct.id);
              if (recItem) handleSelectRecommendation(recItem);
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
