import { Zap, ArrowRight } from "lucide-react";
import type { BestsellerProduct } from "@/app/actions/getBestsellers";

export function calcBrutto(deviceNetto: number, installNetto: number): number {
  return Math.round((deviceNetto + installNetto) * 1.08);
}

function BrandBadge({ code }: { code: string }) {
  const colors: Record<string, string> = {
    FE: "bg-[#0d1b2e] text-white",
    HA: "bg-[#c8102e] text-white",
  };
  return (
    <span
      className={`inline-flex items-center justify-center w-8 h-8 rounded-md text-xs font-bold tracking-wide ${colors[code] ?? "bg-muted text-foreground"}`}
    >
      {code}
    </span>
  );
}

export function ProductCard({ product, onOpenModal, showPricing = true, exactPriceBrutto }: { product: BestsellerProduct, onOpenModal: (p: BestsellerProduct) => void, showPricing?: boolean, exactPriceBrutto?: number }) {
  const defaultBrutto = product.startingPriceBrutto || calcBrutto(product.deviceNettoPrice, product.installNettoPrice);
  const displayPrice = exactPriceBrutto || defaultBrutto;

  return (
    <div className="group relative bg-card rounded-2xl border border-border overflow-hidden flex flex-col transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_-12px_rgba(23,80,200,0.15)]">
      {product.tag && (
        <span className="absolute top-4 left-4 z-10 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
          {product.tag}
        </span>
      )}

      <div className="relative h-52 bg-[#f0f4fb] overflow-hidden">
        <img
          src={product.img}
          alt={`Klimatyzator ${product.brand} ${product.model}`}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent" />
      </div>

      <div className="flex flex-col flex-1 p-6 gap-4">
        <div className="flex items-center gap-2">
          <BrandBadge code={product.brandLogo} />
          <div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
              {product.brand}
            </p>
            <p className="text-sm font-semibold text-foreground font-mono tracking-tight">
              {product.model}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 bg-secondary text-secondary-foreground text-xs font-semibold px-3 py-1.5 rounded-full">
            <Zap className="w-3 h-3" />
            {product.power}
          </span>
          <span className="text-xs text-muted-foreground">Moc chłodnicza</span>
        </div>

        {showPricing && (
          <div className="mt-auto pt-4 border-t border-border">
            <p className="text-xs text-muted-foreground mb-1">
              {exactPriceBrutto ? "Cena za proponowany zestaw (brutto)" : "Cena zaczyna się od (brutto)"}
            </p>
            <p className="text-3xl font-bold text-foreground tracking-tight">
              {displayPrice.toLocaleString("pl-PL")} zł
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Urządzenie + montaż podstawowy + VAT 8%
            </p>
          </div>
        )}

        {!showPricing && (
           <div className="mt-auto pt-4 border-t border-border">
             {/* Pusty blok zeby nie zepsuc paddingu */}
           </div>
        )}

        <button 
          onClick={() => onOpenModal(product)}
          className="w-full text-primary font-semibold text-sm rounded-xl py-3 px-4 border border-primary/20 bg-primary/5 flex items-center justify-center gap-2 transition-all duration-200 hover:bg-primary/10"
        >
          Szczegóły urządzenia
        </button>
      </div>
    </div>
  );
}
