"use client";

import { useEffect, useState, useMemo } from "react";
import { getCatalog, type CatalogData } from "../actions/getCatalog";
import { ProductCard } from "@/components/ui/ProductCard";
import { DeviceModal } from "@/components/ui/DeviceModal";
import { type BestsellerProduct as Product } from "../actions/getBestsellers";
import { ChevronLeft, SlidersHorizontal } from "lucide-react";
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { calcBrutto } from "@/components/ui/ProductCard";



export default function CatalogPage() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Stany filtrów
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);
  const [filterRoomType, setFilterRoomType] = useState<string>('all');
  const [filterBrands, setFilterBrands] = useState<string[]>([]);
  const [filterColors, setFilterColors] = useState<string[]>([]);
  const [filterArea, setFilterArea] = useState<string>('all');
  const [filterFeatures, setFilterFeatures] = useState({
    wifi: false,
    silent: false,
    presence: false,
  });

  useEffect(() => {
    const fetchCatalog = async () => {
      getCatalog().then((data) => {
        setCatalog(data);
      });
    };
    fetchCatalog();
  }, []);

  const allProducts = catalog?.products || [];

  // Wyciąganie unikalnych opcji filtrów z danych
  const availableBrands = useMemo(() => {
    const brands = new Set(allProducts.map(p => p.brand));
    return Array.from(brands).sort();
  }, [allProducts]);

  const availableColors = useMemo(() => {
    const colors = new Set(allProducts.map(p => p._raw?.color || 'Biały'));
    return Array.from(colors).sort();
  }, [allProducts]);

  // Logika filtrowania
  const filteredProducts = useMemo(() => {
    let result = [...allProducts];

    // Przeznaczenie (Jedno / Wiele)
    if (filterRoomType === 'single') {
      result = result.filter(p => p._raw?.is_single_compatible);
    } else if (filterRoomType === 'multi') {
      result = result.filter(p => p._raw?.is_multi_compatible);
    }

    // Marka
    if (filterBrands.length > 0) {
      result = result.filter(p => filterBrands.includes(p.brand));
    }

    // Kolor
    if (filterColors.length > 0) {
      result = result.filter(p => filterColors.includes(p._raw?.color || 'Biały'));
    }

    // Powierzchnia
    if (filterArea !== 'all') {
      result = result.filter(p => {
        const area = p._raw?.recommended_area_m2;
        if (!area) return false;
        
        if (filterArea === 'Do 25 m²') return area <= 25;
        if (filterArea === '26-35 m²') return area > 25 && area <= 35;
        if (filterArea === '36-50 m²') return area > 35 && area <= 50;
        if (filterArea === 'Powyżej 50 m²') return area > 50;
        return true;
      });
    }

    // Cechy
    if (filterFeatures.wifi) {
      result = result.filter(p => p._raw?.has_wifi);
    }
    if (filterFeatures.silent) {
      result = result.filter(p => p._raw?.is_silent_mode);
    }
    if (filterFeatures.presence) {
      result = result.filter(p => p._raw?.has_presence_sensor);
    }

    // Sortowanie po cenie rosnąco - odbywa się już na bazie, ale dla pewności przy filtrach upewniamy się.
    result.sort((a, b) => a.deviceNettoPrice - b.deviceNettoPrice);

    return result;
  }, [allProducts, filterRoomType, filterBrands, filterColors, filterArea, filterFeatures]);

  const toggleArrayFilter = (arr: string[], setArr: (val: string[]) => void, item: string) => {
    if (arr.includes(item)) {
      setArr(arr.filter(i => i !== item));
    } else {
      setArr([...arr, item]);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <main className="pt-32 pb-24 sm:pt-40 sm:pb-32">
        <div className="px-6 lg:px-12 max-w-7xl mx-auto mb-8 flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            <ChevronLeft size={20} />
            Wstecz
          </button>
          
          <button 
            className="lg:hidden flex items-center gap-2 text-primary font-semibold"
            onClick={() => setShowFiltersMobile(!showFiltersMobile)}
          >
            <SlidersHorizontal size={20} />
            Filtruj
          </button>
        </div>

        {/* Hero */}
        <section className="px-6 lg:px-12 max-w-7xl mx-auto mb-16 lg:mb-24">
          <div className="max-w-4xl">
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight text-foreground leading-[1.05] mb-6">
              Katalog <br className="hidden sm:block" />
              <span className="text-primary">Urządzeń</span>
            </h1>
            <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl font-medium">
              Poznaj naszą ofertę klimatyzatorów oraz systemów Multi-Split do wielu pomieszczeń. Transparentne ceny z montażem, bez niespodzianek.
            </p>
          </div>
        </section>

        {/* Content (2 columns on Desktop) */}
        <div className="max-w-7xl mx-auto px-6 lg:px-12 flex flex-col lg:flex-row gap-12 items-start">
          
          {/* Sidebar - Filtry */}
          <aside className={`w-full lg:w-72 shrink-0 space-y-10 border-b lg:border-b-0 border-border pb-10 lg:pb-0 ${showFiltersMobile ? 'block' : 'hidden lg:block'}`}>
            
            {/* Przeznaczenie */}
            <div>
              <h3 className="text-sm font-bold uppercase text-foreground mb-4 tracking-wider">Ilość pomieszczeń</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="roomType" className="w-4 h-4 accent-primary" 
                    checked={filterRoomType === 'all'} onChange={() => setFilterRoomType('all')} />
                  <span className="text-sm font-medium text-foreground">Wszystkie</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="roomType" className="w-4 h-4 accent-primary" 
                    checked={filterRoomType === 'single'} onChange={() => setFilterRoomType('single')} />
                  <span className="text-sm font-medium text-foreground">Jedno pomieszczenie</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="radio" name="roomType" className="w-4 h-4 accent-primary" 
                    checked={filterRoomType === 'multi'} onChange={() => setFilterRoomType('multi')} />
                  <span className="text-sm font-medium text-foreground">Wiele pomieszczeń</span>
                </label>
              </div>
            </div>

            {/* Powierzchnia */}
            <div>
              <h3 className="text-sm font-bold uppercase text-foreground mb-4 tracking-wider">Powierzchnia</h3>
              <div className="space-y-3">
                {['all', 'Do 25 m²', '26-35 m²', '36-50 m²', 'Powyżej 50 m²'].map(area => (
                  <label key={area} className="flex items-center gap-3 cursor-pointer">
                    <input type="radio" name="area" className="w-4 h-4 accent-primary" 
                      checked={filterArea === area} onChange={() => setFilterArea(area)} />
                    <span className="text-sm font-medium text-foreground">{area === 'all' ? 'Wszystkie' : area}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Marka */}
            {availableBrands.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase text-foreground mb-4 tracking-wider">Marka</h3>
                <div className="space-y-3">
                  {availableBrands.map(brand => (
                    <label key={brand} className="flex items-center gap-3 cursor-pointer">
                      <input type="checkbox" className="w-4 h-4 accent-primary rounded border-border" 
                        checked={filterBrands.includes(brand)} 
                        onChange={() => toggleArrayFilter(filterBrands, setFilterBrands, brand)} />
                      <span className="text-sm font-medium text-foreground">{brand}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Kolor */}
            {availableColors.length > 0 && (
              <div>
                <h3 className="text-sm font-bold uppercase text-foreground mb-4 tracking-wider">Kolor urządzenia</h3>
                <div className="flex flex-wrap gap-2">
                  {availableColors.map(color => (
                    <button 
                      key={color}
                      onClick={() => toggleArrayFilter(filterColors, setFilterColors, color)}
                      className={`px-4 py-2 text-sm font-semibold rounded-full border transition-all ${
                        filterColors.includes(color) 
                        ? 'bg-primary border-primary text-white' 
                        : 'bg-white border-border text-foreground hover:border-primary/50'
                      }`}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Cechy */}
            <div>
              <h3 className="text-sm font-bold uppercase text-foreground mb-4 tracking-wider">Dodatkowe funkcje</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-primary rounded border-border" 
                    checked={filterFeatures.wifi} 
                    onChange={(e) => setFilterFeatures({...filterFeatures, wifi: e.target.checked})} />
                  <span className="text-sm font-medium text-foreground">Moduł WiFi</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-primary rounded border-border" 
                    checked={filterFeatures.silent} 
                    onChange={(e) => setFilterFeatures({...filterFeatures, silent: e.target.checked})} />
                  <span className="text-sm font-medium text-foreground">Tryb cichy</span>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="w-4 h-4 accent-primary rounded border-border" 
                    checked={filterFeatures.presence} 
                    onChange={(e) => setFilterFeatures({...filterFeatures, presence: e.target.checked})} />
                  <span className="text-sm font-medium text-foreground">Czujnik obecności</span>
                </label>
              </div>
            </div>

          </aside>

          {/* Grid Produktów */}
          <div className="flex-1 min-w-0">
            <div className="mb-8 border-b border-border pb-4">
              <h2 className="text-3xl font-bold tracking-tight text-foreground">Klimatyzatory Ścienne</h2>
              <p className="text-muted-foreground mt-2">Kompletny zestaw: jednostka wewnętrzna i zewnętrzna.</p>
            </div>
            
            {!catalog ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="w-full h-80 bg-muted/50 rounded-2xl animate-pulse" />)}
              </div>
            ) : filteredProducts.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredProducts.map((p) => (
                  <ProductCard key={p.id} product={p} onOpenModal={setSelectedProduct} />
                ))}
              </div>
            ) : (
              <div className="py-24 text-center bg-muted/20 rounded-2xl border border-border/50">
                <p className="text-xl font-bold text-foreground mb-2">Brak wyników</p>
                <p className="text-muted-foreground">Nie znaleźliśmy urządzeń spełniających Twoje kryteria.</p>
                <button 
                  onClick={() => {
                    setFilterRoomType('all');
                    setFilterArea('all');
                    setFilterBrands([]);
                    setFilterColors([]);
                    setFilterFeatures({wifi: false, silent: false, presence: false});
                  }}
                  className="mt-6 px-6 py-2.5 bg-white border border-border rounded-xl text-sm font-semibold text-foreground hover:bg-muted/50 transition-colors"
                >
                  Wyczyść filtry
                </button>
              </div>
            )}
          </div>

        </div>

        {/* Modal Device */}
        <DeviceModal
          isOpen={selectedProduct !== null}
          onClose={() => setSelectedProduct(null)}
          device={selectedProduct}
        />
      </main>

      <Footer />
    </div>
  );
}
