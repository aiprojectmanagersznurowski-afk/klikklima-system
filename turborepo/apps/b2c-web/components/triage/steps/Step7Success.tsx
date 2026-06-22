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
  const [recommendedDevice, setRecommendedDevice] = React.useState<BestsellerProduct | null>(null);
  const [displayPrice, setDisplayPrice] = React.useState("");

  const rooms = state.roomCount || 1;

  React.useEffect(() => {
    async function fetchRecommendation() {
      setIsLoading(true);
      const res = await getRecommendation(state.roomCount || 1, state.roomSizes);
      
      if (res.success && res.internalUnits && res.internalUnits.length > 0) {
        
        updateData({
          selectedInternalUnits: res.internalUnits,
          selectedExternalUnit: res.externalUnit,
          priceDevices: res.totalDevicesPrice,
        });

        const mainUnit = res.internalUnits[0];
        const isMulti = res.type === 'multi';
        const finalPriceBrutto = res.totalBrutto; 
        const formattedPrice = new Intl.NumberFormat('pl-PL', { 
          style: 'currency', currency: 'PLN', maximumFractionDigits: 0 
        }).format(finalPriceBrutto);

        setDisplayPrice(formattedPrice);

        const newDeviceData: BestsellerProduct = {
          id: mainUnit.id,
          brand: mainUnit.producent,
          brandLogo: mainUnit.producent.substring(0, 2).toUpperCase(),
          model: mainUnit.linia,
          power: isMulti ? `Wielosplit (x${res.internalUnits.length})` : `${mainUnit.moc_chlodnicza_kw} kW`,
          deviceNettoPrice: res.totalDevicesPrice,
          installNettoPrice: 1500,
          marketingDesc: mainUnit.opis_marketingowy || "Elegancki design z matowym wykończeniem i technologią jonizacji powietrza. Idealny do nowoczesnych wnętrz. Gwarantuje niezwykle cichą pracę i wysoką oszczędność energii.",
          img: mainUnit.obrazek_url || "https://images.unsplash.com/photo-1718203862467-c33159fdc504?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&q=80&w=1080",
          features: mainUnit.cechy_json || [
            { iconName: "Wifi", label: "WIFI w standardzie" },
            { iconName: "Volume2", label: "Głośność od 20dB" },
            { iconName: "Zap", label: "Klasa A+++" },
            { iconName: "Wind", label: "Funkcja Jonizatora" }
          ]
        };

        setRecommendedDevice(newDeviceData);
      } else {
        // Fallback jeśli nie pobrano z bazy (lub brakło w niej odpowiednio dużego agregatu)
        const fallbackInstall = 1600 * rooms;
        const fallbackDevice = rooms > 1 ? 4000 + (rooms * 1500) : 3000;
        const fallbackTotalBrutto = Math.round((fallbackInstall + fallbackDevice) * 1.08);
        const fallbackPriceFormatted = new Intl.NumberFormat('pl-PL', { 
          style: 'currency', currency: 'PLN', maximumFractionDigits: 0 
        }).format(fallbackTotalBrutto);

        setDisplayPrice(`od ${fallbackPriceFormatted}`);

        setRecommendedDevice({
          id: 'fallback',
          brand: 'Fuji Electric',
          brandLogo: 'FE',
          model: rooms > 1 ? "Multi-Split" : "KETA",
          power: rooms > 1 ? `Wielosplit (Multi x${rooms})` : "2.5 kW / 3.5 kW",
          deviceNettoPrice: fallbackDevice,
          installNettoPrice: fallbackInstall,
          marketingDesc: "Niezawodne urządzenia i elastyczność montażu dla Twojego metrażu.",
          img: "https://images.unsplash.com/photo-1718203862467-c33159fdc504?q=80&w=1080",
          features: [
            { iconName: "Wifi", label: "WIFI w standardzie" }
          ]
        });
      }
      setIsLoading(false);
    }
    
    fetchRecommendation();
  }, [state.roomCount, state.roomSizes]);

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

  if (isLoading || !recommendedDevice) {
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
      title="Oto idealne rozwiązanie dla Ciebie" 
      subtitle="Na podstawie Twoich odpowiedzi przygotowaliśmy wstępną ofertę"
    >
      <div className="max-w-3xl mx-auto space-y-8 pb-20 sm:pb-0">
        
        {/* Product Card */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-border/50 overflow-hidden relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row gap-8 items-center relative z-10">
            <div className="w-full sm:w-2/5 aspect-[4/3] rounded-2xl bg-secondary flex items-center justify-center p-4">
              <img 
                src={recommendedDevice.img} 
                alt={`${recommendedDevice.brand} ${recommendedDevice.model}`}
                className="w-full h-full object-contain mix-blend-multiply"
              />
            </div>
            
            <div className="w-full sm:w-3/5 space-y-4">
              <div className="inline-flex px-3 py-1 bg-primary/10 text-primary text-sm font-semibold rounded-full mb-2">
                REKOMENDACJA
              </div>
              <h3 className="text-2xl sm:text-3xl font-bold text-foreground">
                {recommendedDevice.brand} {recommendedDevice.model}
              </h3>
              
              <div className="flex flex-wrap gap-4 text-sm font-medium text-muted-foreground mt-4">
                {rooms > 1 ? (
                  <>
                    <div className="flex items-center gap-2 bg-secondary px-3 py-1.5 rounded-lg text-secondary-foreground">
                      <Wind size={18} /> {rooms}x Jednostka Wewnętrzna
                    </div>
                    <div className="flex items-center gap-2 bg-secondary px-3 py-1.5 rounded-lg text-secondary-foreground">
                      <Box size={18} /> 1x Jednostka Zewnętrzna
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-2 bg-secondary px-3 py-1.5 rounded-lg text-secondary-foreground">
                      <Wind size={18} /> 1x Jednostka Wewnętrzna
                    </div>
                    <div className="flex items-center gap-2 bg-secondary px-3 py-1.5 rounded-lg text-secondary-foreground">
                      <Box size={18} /> 1x Jednostka Zewnętrzna
                    </div>
                  </>
                )}
                <div className="flex items-center gap-2 bg-secondary px-3 py-1.5 rounded-lg text-secondary-foreground">
                  <Settings2 size={18} /> Czynnik R32
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-border/40">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors flex items-center gap-1"
                >
                  <Info size={16} /> Zobacz pełną specyfikację urządzenia
                </button>
              </div>
            </div>
          </div>
        </div>

        <DeviceModal 
          isOpen={isModalOpen} 
          onClose={() => setIsModalOpen(false)} 
          device={recommendedDevice} 
          onReserveClick={handleReserveFromModal}
        />

        {/* Pricing Section */}
        <div className="bg-primary/5 rounded-3xl p-6 sm:p-10 border border-primary/10 text-center">
          <p className="text-muted-foreground font-medium mb-2">Szacunkowa wycena instalacji wraz z urządzeniem</p>
          <h2 className="text-4xl sm:text-6xl font-bold tracking-tight text-primary mb-4">
            {displayPrice} <span className="text-xl sm:text-2xl font-semibold text-primary/70">brutto</span>
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground max-w-lg mx-auto">
            Cena zawiera podatek VAT 8% oraz standardowy pakiet usług montażowych.
          </p>

          <div className="mt-8 text-left">
            <Accordion.Root type="single" collapsible className="w-full max-w-xl mx-auto bg-white rounded-xl shadow-sm border border-border/50">
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

        {/* Action button - sticky on mobile */}
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-lg border-t border-border sm:static sm:bg-transparent sm:border-0 sm:p-0 z-50">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={nextStep}
            className="w-full sm:max-w-md sm:mx-auto flex items-center justify-center gap-3 bg-primary text-primary-foreground py-4 px-8 rounded-xl font-bold text-lg shadow-lg shadow-primary/20 hover:shadow-xl transition-all"
          >
            <Calendar size={22} />
            Zarezerwuj darmową wizytę technika
          </motion.button>
        </div>
      </div>
    </StepWrapper>
  );
};
