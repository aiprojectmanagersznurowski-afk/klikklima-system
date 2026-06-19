import { useState } from "react";
import { X, Info, Check, Wifi, Volume2, Zap, Wind, ChevronDown, ChevronRight, Star, Calendar } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

const GALLERY_IMAGES = [
  {
    id: "main",
    src: "https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=800&h=600&fit=crop&auto=format",
    alt: "Fuji Electric KETA – jednostka wewnętrzna, widok frontalny",
  },
  {
    id: "angle",
    src: "https://images.unsplash.com/photo-1631049307264-da0ec9d70304?w=400&h=300&fit=crop&auto=format",
    alt: "Fuji Electric KETA – widok z boku",
  },
  {
    id: "detail",
    src: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=400&h=300&fit=crop&auto=format",
    alt: "Fuji Electric KETA – panel sterowania",
  },
  {
    id: "room",
    src: "https://images.unsplash.com/photo-1618219944342-824e40a13285?w=400&h=300&fit=crop&auto=format",
    alt: "Fuji Electric KETA – widok w nowoczesnym wnętrzu",
  },
  {
    id: "outdoor",
    src: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop&auto=format",
    alt: "Fuji Electric KETA – jednostka zewnętrzna",
  },
];

const CHIPS = [
  { icon: Wifi, label: "WiFi w standardzie" },
  { icon: Volume2, label: "Głośność: 20 dB" },
  { icon: Zap, label: "Klasa A+++" },
  { icon: Wind, label: "Jonizator" },
];

const INSTALLATION_ITEMS = [
  "Montaż jednostki wewnętrznej i zewnętrznej (do 4 m wys.)",
  "Do 3 mb instalacji chłodniczej i przewodu sterującego",
  "Przewiert przez jedną ścianę",
  "Odprowadzenie skroplin grawitacyjnie do 3 mb",
  "Test szczelności i przeszkolenie użytkownika",
];

function BackgroundPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="border-b border-border bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Wind className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              KlimaExpert
            </span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
            <span className="hover:text-foreground cursor-pointer transition-colors">Klimatyzatory</span>
            <span className="hover:text-foreground cursor-pointer transition-colors">Pompy ciepła</span>
            <span className="hover:text-foreground cursor-pointer transition-colors">Montaż</span>
            <span className="hover:text-foreground cursor-pointer transition-colors">Serwis</span>
          </div>
        </div>
      </nav>

      {/* Product grid preview */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="mb-8">
          <p className="text-xs font-medium text-accent uppercase tracking-widest mb-2">Klimatyzatory ścienne</p>
          <h1 className="text-3xl font-bold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            Wybierz swój model
          </h1>
          <p className="text-muted-foreground mt-2">Profesjonalny sprzęt premium z montażem w pakiecie.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {[
            { name: "Fuji Electric KETA", capacity: "3.5 kW", price: "4 500 PLN", badge: "Bestseller", highlight: true },
            { name: "Haier Expert", capacity: "5.0 kW", price: "5 200 PLN", badge: null, highlight: false },
            { name: "Daikin Perfera", capacity: "2.5 kW", price: "4 100 PLN", badge: "Nowość", highlight: false },
          ].map((product, i) => (
            <ProductCard key={i} product={product} isFirst={i === 0} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProductCard({ product, isFirst }: { product: any; isFirst: boolean }) {
  const [open, setOpen] = useState(isFirst);

  return (
    <>
      <div
        onClick={() => setOpen(true)}
        className={`group bg-white rounded-2xl border cursor-pointer transition-all duration-300 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 ${
          product.highlight ? "border-primary/30 ring-1 ring-primary/20" : "border-border"
        }`}
      >
        <div className="relative bg-muted h-52 overflow-hidden">
          <img
            src={GALLERY_IMAGES[0].src}
            alt={product.name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
          {product.badge && (
            <span className="absolute top-3 left-3 bg-accent text-white text-xs font-semibold px-2.5 py-1 rounded-full">
              {product.badge}
            </span>
          )}
        </div>
        <div className="p-5">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h3 className="font-semibold text-foreground" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {product.name}
            </h3>
            <div className="flex items-center gap-0.5 shrink-0">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />
              ))}
            </div>
          </div>
          <p className="text-sm text-muted-foreground mb-4">Moc: {product.capacity} · Klasa A+++</p>
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-primary" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              od {product.price}
            </span>
            <button className="flex items-center gap-1 text-sm font-medium text-accent hover:text-primary transition-colors">
              Szczegóły <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      {open && <ProductDrawer onClose={() => setOpen(false)} />}
    </>
  );
}

function ProductDrawer({ onClose }: { onClose: () => void }) {
  const [activeImage, setActiveImage] = useState(0);
  const [installOpen, setInstallOpen] = useState(false);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex">
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
            {/* Brand logo pill */}
            <div className="flex items-center gap-3">
              <div
                className="h-9 px-4 rounded-full flex items-center gap-2 text-xs font-semibold tracking-wide uppercase"
                style={{ background: "#f0f3f8", color: "#1a3a6b" }}
              >
                <div className="w-2 h-2 rounded-full bg-accent" />
                Fuji Electric
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
              {/* Main image */}
              <div className="relative rounded-2xl overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50/30 border border-border mb-3" style={{ aspectRatio: "16/9" }}>
                <motion.img
                  key={activeImage}
                  initial={{ opacity: 0, scale: 1.04 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.4 }}
                  src={GALLERY_IMAGES[activeImage].src}
                  alt={GALLERY_IMAGES[activeImage].alt}
                  className="w-full h-full object-cover"
                />
                {/* Subtle gradient overlay at bottom */}
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white/30 to-transparent pointer-events-none" />
              </div>

              {/* Thumbnails */}
              <div className="flex gap-2">
                {GALLERY_IMAGES.map((img, i) => (
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
              {/* Rating */}
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className={`w-3.5 h-3.5 ${i < 4 ? "fill-amber-400 text-amber-400" : "fill-muted text-muted-foreground"}`} />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">4.8 · 124 opinie</span>
              </div>

              {/* Model name */}
              <h2
                className="text-2xl font-bold text-foreground leading-tight mb-2"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Fuji Electric<br />
                <span className="text-accent">KETA 3.5 kW</span>
              </h2>

              {/* Marketing desc */}
              <p className="text-[15px] text-muted-foreground leading-relaxed mb-6">
                Elegancki design z matowym wykończeniem i technologią jonizacji powietrza.
                Niezwykle cichy praca na poziomie 20 dB sprawia, że jest idealnym wyborem
                do nowoczesnych sypialni i salonów.
              </p>

              {/* Feature chips */}
              <div className="flex flex-wrap gap-2 mb-7">
                {CHIPS.map(({ icon: Icon, label }) => (
                  <div
                    key={label}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border"
                    style={{
                      background: "#f0f3f8",
                      color: "#1a3a6b",
                      borderColor: "rgba(26,58,107,0.15)",
                    }}
                  >
                    <Icon className="w-3.5 h-3.5 text-accent" />
                    {label}
                  </div>
                ))}
              </div>

              {/* Divider */}
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
                          {INSTALLATION_ITEMS.map((item, i) => (
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

              {/* Bottom padding so sticky footer doesn't overlap */}
              <div className="h-6" />
            </div>
          </div>

          {/* Sticky footer */}
          <div
            className="shrink-0 px-7 py-5 border-t bg-white"
            style={{ borderColor: "rgba(26,58,107,0.1)" }}
          >
            {/* Price block */}
            <div className="flex items-end justify-between gap-4 mb-4">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
                  Szacunkowa cena z montażem
                </p>
                <p
                  className="text-3xl font-bold text-foreground leading-none"
                  style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
                >
                  4 500{" "}
                  <span className="text-xl font-semibold text-muted-foreground">PLN</span>
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">
                  *Cena z VAT 8% dla budownictwa mieszkaniowego
                </p>
              </div>
              <div
                className="hidden sm:block text-right shrink-0"
              >
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  Dostępny od ręki
                </div>
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                className="flex-1 flex items-center justify-center gap-2 py-3.5 px-5 rounded-xl text-sm font-semibold text-white transition-all duration-200 hover:opacity-90 active:scale-[0.98] shadow-lg"
                style={{
                  background: "linear-gradient(135deg, #1a3a6b 0%, #2563eb 100%)",
                  boxShadow: "0 6px 24px rgba(37, 99, 235, 0.35)",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                <Calendar className="w-4 h-4" />
                Zarezerwuj termin z tym urządzeniem
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
                Wróć do przeglądania
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-background">
      <BackgroundPage />
    </div>
  );
}
