"use client";

import { useEffect, useState } from "react";
import { getCatalog, type CatalogData } from "../actions/getCatalog";
import { ProductCard } from "@/components/ui/ProductCard";
import { DeviceModal, type DeviceData } from "@/components/ui/DeviceModal";
import { type BestsellerProduct as Product } from "../actions/getBestsellers";
import { ChevronLeft } from "lucide-react";
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';
import { calcBrutto } from "@/components/ui/ProductCard";

function buildMockDevice(product: Product): DeviceData {
  const brutto = calcBrutto(product.deviceNettoPrice, product.installNettoPrice);
  
  const fallbackDesc = "Wysokiej klasy klimatyzator zapewniający optymalny komfort cieplny. Charakteryzuje się cichą pracą i wysoką energooszczędnością.";
  const fallbackImages = [{ id: "1", src: product.img, alt: product.model }];
  const fallbackChips = [
    { iconName: "Wifi", label: "WIFI w standardzie" },
    { iconName: "Zap", label: "Wysoka klasa energetyczna" }
  ];

  return {
    name: `${product.brand} ${product.model}`,
    capacity: product.power,
    price: `od ${brutto.toLocaleString("pl-PL")} zł brutto`,
    marketingDescription: product.marketingDesc || fallbackDesc,
    images: Array.isArray(product.gallery) && product.gallery.length > 0 ? product.gallery : fallbackImages,
    chips: Array.isArray(product.features) && product.features.length > 0 ? product.features : fallbackChips
  };
}

export default function CatalogPage() {
  const router = useRouter();
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    getCatalog().then((data) => {
      setCatalog(data);
    });
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <main className="pt-32 pb-24 sm:pt-40 sm:pb-32">
        <div className="px-6 lg:px-12 max-w-7xl mx-auto mb-8">
          <button 
            onClick={() => router.back()}
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors font-medium"
          >
            <ChevronLeft size={20} />
            Wstecz
          </button>
        </div>

        {/* Hero */}
        <section className="px-6 lg:px-12 max-w-7xl mx-auto mb-32">
          <div className="max-w-4xl">
            <h1 className="text-5xl sm:text-6xl lg:text-8xl font-bold tracking-tight text-foreground leading-[1.05] mb-8">
              Katalog <br className="hidden sm:block" />
              <span className="text-primary">Urządzeń.</span>
            </h1>
            <p className="text-xl sm:text-2xl text-muted-foreground leading-relaxed max-w-2xl font-medium">
              Poznaj naszą ofertę klimatyzatorów ściennych oraz systemów Multi-Split. Transparentne ceny z montażem, bez niespodzianek.
            </p>
          </div>
        </section>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-6 lg:px-12 space-y-24">
        
        {/* Single Split */}
        <section>
          <div className="mb-8 border-b border-border pb-4">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Klimatyzatory Ścienne (Single Split)</h2>
            <p className="text-muted-foreground mt-2">Kompletny zestaw: jednostka wewnętrzna i zewnętrzna do jednego pomieszczenia.</p>
          </div>
          {catalog?.singleSplit ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {catalog.singleSplit.map((p) => (
                <ProductCard key={p.id} product={p} onOpenModal={setSelectedProduct} />
              ))}
              {catalog.singleSplit.length === 0 && (
                <p className="text-muted-foreground py-10">Brak urządzeń w tej kategorii.</p>
              )}
            </div>
          ) : (
            <div className="flex gap-4">
              {[1,2,3,4].map(i => <div key={i} className="w-full h-80 bg-muted/50 rounded-2xl animate-pulse" />)}
            </div>
          )}
        </section>

        {/* Multi Split Internal */}
        <section>
          <div className="mb-8 border-b border-border pb-4">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Jednostki Wewnętrzne (Multi Split)</h2>
            <p className="text-muted-foreground mt-2">Klimatyzatory do systemu Multi, pozwalające na podłączenie wielu jednostek do jednego agregatu.</p>
          </div>
          {catalog?.multiInternal ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {catalog.multiInternal.map((p) => (
                <ProductCard key={p.id} product={p} onOpenModal={setSelectedProduct} showPricing={false} />
              ))}
              {catalog.multiInternal.length === 0 && (
                <p className="text-muted-foreground py-10">Brak urządzeń w tej kategorii.</p>
              )}
            </div>
          ) : (
            <div className="flex gap-4">
              {[1,2,3,4].map(i => <div key={i} className="w-full h-80 bg-muted/50 rounded-2xl animate-pulse" />)}
            </div>
          )}
        </section>

        {/* Multi Split External */}
        <section>
          <div className="mb-8 border-b border-border pb-4">
            <h2 className="text-3xl font-bold tracking-tight text-foreground">Agregaty Zewnętrzne (Multi Split)</h2>
            <p className="text-muted-foreground mt-2">Zasilanie dla wielu jednostek wewnętrznych. Dobierane na podstawie łącznej mocy.</p>
          </div>
          {catalog?.multiExternal ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {catalog.multiExternal.map((p) => (
                <ProductCard key={p.id} product={p} onOpenModal={setSelectedProduct} showPricing={false} />
              ))}
              {catalog.multiExternal.length === 0 && (
                <p className="text-muted-foreground py-10">Brak urządzeń w tej kategorii.</p>
              )}
            </div>
          ) : (
            <div className="flex gap-4">
              {[1,2,3,4].map(i => <div key={i} className="w-full h-80 bg-muted/50 rounded-2xl animate-pulse" />)}
            </div>
          )}
        </section>

      </div>

        {/* Modal Device */}
        <DeviceModal
          isOpen={selectedProduct !== null}
          onClose={() => setSelectedProduct(null)}
          device={selectedProduct ? buildMockDevice(selectedProduct) : null}
        />
      </main>

      <Footer />
    </div>
  );
}
