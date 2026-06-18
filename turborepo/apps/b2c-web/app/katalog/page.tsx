"use client";

import { useEffect, useState } from "react";
import { getCatalog, type CatalogData } from "../actions/getCatalog";
import { ProductCard } from "@/components/ui/ProductCard";
import { DeviceModal, type DeviceData } from "@/components/ui/DeviceModal";
import { type BestsellerProduct as Product } from "../actions/getBestsellers";
import { ArrowLeft } from "lucide-react";
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
  const [catalog, setCatalog] = useState<CatalogData | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  useEffect(() => {
    getCatalog().then((data) => {
      setCatalog(data);
    });
  }, []);

  return (
    <div className="min-h-screen bg-[#fafbfc] pb-24 font-sans text-foreground">
      {/* Header */}
      <header className="fixed top-0 w-full z-50 transition-all duration-300 bg-white/80 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <a href="/#bestsellery" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </a>
            <a href="/" className="flex items-center gap-3 flex-shrink-0">
              <img
                src="/logo.png"
                alt="Klik Klima"
                className="h-9 sm:h-11 w-auto"
              />
            </a>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="pt-32 pb-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <h1 className="text-4xl sm:text-5xl font-extrabold text-foreground tracking-tight">
          Katalog Urządzeń
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl">
          Poznaj naszą ofertę klimatyzatorów ściennych oraz systemów Multi-Split. Transparentne ceny z montażem, bez niespodzianek.
        </p>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-20">
        
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
    </div>
  );
}
