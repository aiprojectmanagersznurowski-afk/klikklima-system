"use client";

import { useState, useEffect } from "react";
import { getFomoSlots, type FomoData } from "./actions/getFomoSlots";
import { getBestsellers, type BestsellerProduct as Product } from "./actions/getBestsellers";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import ExitIntentModal from "@/components/triage/ExitIntentModal";
import { ProductCard, calcBrutto } from "@/components/ui/ProductCard";
import { DeviceModal } from "@/components/ui/DeviceModal";
import { companyDetails } from "@/config/company";
import {
  ArrowRight,
  CheckCircle2,
  MonitorSmartphone,
  CalendarCheck,
  Wrench,
  ShieldCheck,
  Clock3,
  BadgeCheck,
  Zap,
  ChevronRight,
  Star,
} from "lucide-react";

/* ─── Data ───────────────────────────────────────────────────────────────── */

const navLinks = [
  { label: "Oferta", href: "/#oferta" },
  { label: "Proces", href: "/#proces" },
  { label: "Bestsellery", href: "/#bestsellery" },
  { label: "Baza wiedzy", href: "/baza-wiedzy" },
  { label: "O nas", href: "/o-nas" },
];

const benefits = [
  {
    icon: MonitorSmartphone,
    title: "Przejrzysta wycena",
    desc: "Wycena online bez zobowiązań w 2 minuty. Natychmiast widzisz szacowany koszt urządzenia i montażu.",
  },
  {
    icon: BadgeCheck,
    title: "Profesjonalny Montaż",
    desc: "Instalacja zgodnie ze sztuką przez wykwalifikowanych inżynierów z certyfikatami F-gazowymi.",
  },
  {
    icon: ShieldCheck,
    title: "Gwarancja 5 lat",
    desc: "Wysoka jakość sprzętu marek Premium i profesjonalny montaż dają Ci spokój na lata.",
  },
  {
    icon: Clock3,
    title: "Montaż w 1 dzień",
    desc: "Minimalizujemy dyskomfort. Ekipa przyjeżdża, montuje i sprząta — zazwyczaj w ciągu jednego dnia.",
  },
];

const steps = [
  {
    number: "01",
    icon: MonitorSmartphone,
    title: "Wycena online",
    desc: "Wypełnij formularz i zobacz zakres cen z montażem. Zero zobowiązań.",
  },
  {
    number: "02",
    icon: CalendarCheck,
    title: "Darmowy Audyt",
    desc: "Nasz inżynier odwiedza Twój dom, potwierdza warunki techniczne i finalizuje ofertę.",
  },
  {
    number: "03",
    icon: Wrench,
    title: "Profesjonalny Montaż",
    desc: "Sprawna instalacja, uruchomienie, konfiguracja pilota i posprzątanie po sobie.",
  },
];

/* ─── Sub-components ────────────────────────────────────────────────────── */

function GlassCard({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ElementType;
  title: string;
  desc: string;
}) {
  return (
    <div className="relative bg-white/70 backdrop-blur-md border border-white/80 rounded-2xl p-7 flex flex-col gap-4 shadow-[0_4px_24px_rgba(23,80,200,0.07)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_40px_rgba(23,80,200,0.13)]">
      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
        <Icon className="w-6 h-6 text-primary" strokeWidth={1.75} />
      </div>
      <div>
        <h3 className="font-bold text-foreground text-lg mb-1">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

/* ─── Main Component ─────────────────────────────────────────────────────── */

export default function HomePageClient({ 
  initialFomoData, 
  initialDbProducts 
}: { 
  initialFomoData: FomoData | null;
  initialDbProducts: Product[];
}) {
  const [fomoData, setFomoData] = useState<FomoData | null>(initialFomoData);
  const [dbProducts, setDbProducts] = useState<Product[]>(initialDbProducts);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const handleOpenProduct = (product: Product) => {
    setSelectedProduct(product);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.set('device', product.model);
      window.history.pushState({ device: product.model }, '', url.toString());
    }
  };

  const handleCloseProduct = () => {
    setSelectedProduct(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('device');
      window.history.replaceState({}, '', url.pathname + (url.search ? url.search : '') + url.hash);
    }
  };

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const deviceModel = params.get('device');
      if (deviceModel) {
        const found = dbProducts.find((p) => p.model === deviceModel);
        if (found) setSelectedProduct(found);
      } else {
        setSelectedProduct(null);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [dbProducts]);
  

  useEffect(() => {
    // If we wanted to refresh bestsellers on the client side periodically, we could do it here
  }, []);

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <Navbar />

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden bg-slate-950">
        {/* Full-bleed background photo */}
        <img
          src="https://images.unsplash.com/photo-1761330440311-16e160cad236?w=1800&h=1100&fit=crop&auto=format"
          alt="Nowoczesny salon z elegancko zamontowaną klimatyzacją"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-55"
        />
        {/* Gradient vignette — stronger on left for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-950/90 via-slate-950/55 to-slate-950/10 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto px-5 sm:px-8 py-24 sm:py-32 w-full">
          {/* Glassmorphism text panel */}
          <div className="max-w-xl lg:max-w-2xl">
            <div
              className="rounded-3xl p-8 sm:p-10 lg:p-12"
              style={{
                background: "rgba(255,255,255,0.07)",
                backdropFilter: "blur(18px)",
                WebkitBackdropFilter: "blur(18px)",
                border: "1px solid rgba(255,255,255,0.13)",
                boxShadow: "0 8px 48px rgba(0,0,0,0.25)",
              }}
            >
              {/* FOMO / Scarcity badge */}
              {fomoData !== null && (
                <div className="inline-flex items-center gap-2.5 bg-white/15 backdrop-blur-sm border border-orange-300/40 rounded-full px-4 py-2.5 mb-7 shadow-sm">
                  <span className="text-base leading-none">🔥</span>
                  <span className="text-sm font-semibold text-orange-200">
                    {(() => {
                      const count = fomoData.slots;
                      const lastDigit = count % 10;
                      const lastTwoDigits = count % 100;

                      let verb = "Zostało";
                      let noun = "wolnych terminów";

                      if (count === 1) {
                        verb = "Został";
                        noun = "wolny termin";
                      } else if (lastDigit >= 2 && lastDigit <= 4 && (lastTwoDigits < 12 || lastTwoDigits > 14)) {
                        verb = "Zostały";
                        noun = "wolne terminy";
                      }

                      return (
                        <>
                          {verb} <span className="text-orange-300 font-extrabold">{count}</span> {noun} {fomoData.period || "w tym tygodniu"} na darmowy audyt
                        </>
                      );
                    })()}
                  </span>
                </div>
              )}

              <h1
                className="text-5xl sm:text-6xl lg:text-[4.5rem] font-extrabold text-white leading-[1.05] tracking-tight mb-5"
                style={{ textShadow: "0 2px 24px rgba(0,0,0,0.35)" }}
              >
                Idealna
                <br />
                temperatura
                <br />
                <span className="text-blue-400">przez cały rok</span>
              </h1>

              <p
                className="text-lg sm:text-xl text-white/80 leading-relaxed mb-9 max-w-lg"
                style={{ textShadow: "0 1px 8px rgba(0,0,0,0.4)" }}
              >
                Dobierz klimatyzator w 2 minuty i poznaj szacunkową wycenę
                z montażem online i umów naszego eksperta na darmowy audyt
              </p>

              <div className="flex flex-col sm:flex-row gap-3">
                <a
                  href="/triage"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold text-base rounded-xl px-8 py-4 transition-all duration-200 hover:bg-blue-700 hover:shadow-[0_12px_32px_rgba(23,80,200,0.55)] active:scale-[0.97]"
                >
                  Wstępna wycena i termin
                  <ArrowRight className="w-5 h-5" />
                </a>
                <a
                  href="#bestsellery"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/15 backdrop-blur-sm text-white font-semibold text-base rounded-xl px-8 py-4 border border-white/25 transition-all duration-200 hover:bg-white/25"
                >
                  Urządzenia
                </a>
              </div>

              {/* Mini trust badges */}
              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                {[
                  "Profesjonalny serwis",
                  "Gwarancja 5 lat",
                  "Montaż w 1 dzień",
                ].map((b) => (
                  <div key={b} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                    <span className="text-sm font-medium text-white/70">{b}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Dlaczego My ────────────────────────────────────────────────── */}
      <section id="oferta" className="py-24 sm:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-background via-blue-50/50 to-background pointer-events-none" />
        <div className="relative max-w-7xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">
              Nasze standardy
            </p>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-foreground tracking-tight">
              Instalacja bez ukrytych kosztów
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
              Wiemy, że remonty bywają stresujące, dlatego stawiamy na
              transparentność i profesjonalizm na każdym etapie
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {benefits.map((b) => (
              <GlassCard key={b.title} icon={b.icon} title={b.title} desc={b.desc} />
            ))}
          </div>
        </div>
      </section>

      {/* ── Proces ─────────────────────────────────────────────────────── */}
      <section id="proces" className="py-24 sm:py-32">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="text-center mb-16">
            <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">
              Jak działamy?
            </p>
            <h2 className="text-4xl sm:text-5xl font-extrabold text-foreground tracking-tight">
              Twoja droga do komfortu
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
            {/* Connector line (desktop) */}
            <div className="hidden md:block absolute top-14 left-[calc(33.33%-1px)] right-[calc(33.33%-1px)] h-px bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20" />

            {steps.map((step, i) => (
              <div
                key={step.number}
                className="relative flex flex-col items-center text-center gap-5 group"
              >
                <div className="relative">
                  <div className="w-28 h-28 rounded-full bg-white border-2 border-primary/15 flex items-center justify-center shadow-[0_8px_32px_rgba(23,80,200,0.10)] transition-all duration-300 group-hover:border-primary/40 group-hover:shadow-[0_12px_40px_rgba(23,80,200,0.18)]">
                    <step.icon className="w-10 h-10 text-primary" strokeWidth={1.5} />
                  </div>
                  <span className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-primary text-primary-foreground text-xs font-black flex items-center justify-center shadow-md">
                    {i + 1}
                  </span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-foreground mb-2">
                    {step.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed text-sm max-w-xs mx-auto">
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bestsellery ────────────────────────────────────────────────── */}
      <section id="bestsellery" className="py-24 sm:py-32 bg-secondary/40">
        <div className="max-w-7xl mx-auto px-5 sm:px-8">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 mb-14">
            <div>
              <p className="text-sm font-semibold text-primary uppercase tracking-widest mb-3">
                Katalog urządzeń
              </p>
              <h2 className="text-4xl sm:text-5xl font-extrabold text-foreground tracking-tight">
                Nasze Bestsellery
              </h2>
              <p className="text-muted-foreground mt-8 text-sm">
                Masz na oku inne urządzenie? Jesteśmy niezależnym instalatorem i mamy w ofercie większość producentów.{" "}
                <a
                  href="/katalog"
                  className="text-primary font-medium hover:underline underline-offset-4"
                >
                  Przejdź do pełnego katalogu urządzeń
                </a>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {dbProducts.map((p) => (
              <ProductCard key={p.id} product={p} onOpenModal={handleOpenProduct} />
            ))}
            {dbProducts.length === 0 && (
              <p className="col-span-full text-center text-muted-foreground py-10">
                Ładowanie urządzeń...
              </p>
            )}
          </div>

          <p className="mt-8 text-center text-xs text-muted-foreground">
            * Cena obejmuje urządzenie + wzorcowy montaż (do 3 metrów instalacji) + VAT 8%.
            Ostateczna cena zostaje potwierdzona podczas bezpłatnego audytu technicznego.
          </p>
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────────────────── */}
      <section id="wycena" className="py-24 sm:py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-700 to-blue-900" />
        {/* Subtle mesh circles */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-white/5 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-[500px] h-[500px] rounded-full bg-accent/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-4xl mx-auto px-5 sm:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 mb-8">
            <Star className="w-3.5 h-3.5 text-accent" />
            <span className="text-xs font-semibold text-white/90 tracking-wide uppercase">
              Darmowa wycena · Bez zobowiązań
            </span>
          </div>

          <h2 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight tracking-tight mb-6">
            Gotowy na przyjemny chłód latem
            <br />
            i energooszczędne ciepło zimą?
          </h2>
          <p className="text-lg sm:text-xl text-white/70 mb-12 max-w-2xl mx-auto leading-relaxed">
            Ciesz się idealnym klimatem w swoim domu bez ukrytych kosztów
            Przekonaj się, jak łatwo i szybko wycenisz instalację online
          </p>

          <a
            href="/triage"
            className="inline-flex items-center justify-center gap-3 bg-white text-primary font-bold text-base sm:text-lg rounded-2xl px-10 py-5 transition-all duration-200 hover:bg-blue-50 hover:shadow-[0_16px_48px_rgba(0,0,0,0.25)] active:scale-[0.97]"
          >
            Oblicz koszty w 2 minuty
            <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <Footer />

      {/* Wyłapywanie wychodzących użytkowników (Soft Leads) - ukryte gdy otwarty Modal */}
      {!selectedProduct && <ExitIntentModal />}

      {/* Global Device Modal */}
      {selectedProduct && (
        <DeviceModal
          isOpen={!!selectedProduct}
          onClose={handleCloseProduct}
          device={selectedProduct}
        />
      )}
    </div>
  );
}
