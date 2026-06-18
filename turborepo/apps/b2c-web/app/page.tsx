"use client";

import { useState, useEffect } from "react";
import { getFomoSlots, type FomoData } from "./actions/getFomoSlots";
import { getBestsellers, type BestsellerProduct as Product } from "./actions/getBestsellers";
import ExitIntentModal from "@/components/triage/ExitIntentModal";
import { DeviceModal, type DeviceData } from "@/components/ui/DeviceModal";
import { ProductCard, calcBrutto } from "@/components/ui/ProductCard";
import { companyDetails } from "@/config/company";
import {
  Menu,
  X,
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
  Phone,
  Mail,
  MapPin,
  Camera,
  Globe,
  Star,
} from "lucide-react";

/* ─── Data ───────────────────────────────────────────────────────────────── */

const navLinks = [
  { label: "Oferta", href: "#oferta" },
  { label: "Proces", href: "#proces" },
  { label: "Bestsellery", href: "#bestsellery" },
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
    title: "Gwarancja do 5 lat",
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

export default function Page() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [fomoData, setFomoData] = useState<FomoData | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [dbProducts, setDbProducts] = useState<Product[]>([]);

  useEffect(() => {
    // Fetch available slots from Supabase via Server Action
    getFomoSlots().then((data) => {
      setFomoData(data);
    });

    // Fetch catalogue from DB
    getBestsellers().then(devices => {
      setDbProducts(devices);
    });

    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled || menuOpen
          ? "bg-white/95 backdrop-blur-xl border-b border-border shadow-sm"
          : "bg-transparent"
          }`}
      >
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 sm:h-20 flex items-center justify-between gap-6">
          {/* Logo */}
          <a href="#" className="flex items-center gap-3 flex-shrink-0">
            <img
              src="/logo.png"
              alt="Klik Klima"
              className={`h-9 sm:h-11 w-auto transition-all duration-300 ${!scrolled && !menuOpen ? "brightness-0 invert" : ""
                }`}
            />
          </a>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                className={`text-sm font-medium transition-colors ${scrolled || menuOpen
                  ? "text-foreground/70 hover:text-foreground"
                  : "text-white/80 hover:text-white"
                  }`}
              >
                {l.label}
              </a>
            ))}
          </nav>

          {/* CTA + hamburger */}
          <div className="flex items-center gap-3">
            <a
              href="/triage"
              className="hidden sm:inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold text-sm rounded-xl px-5 py-2.5 transition-all duration-200 hover:bg-[#1244b0] hover:shadow-[0_8px_24px_rgba(23,80,200,0.35)] active:scale-[0.97]"
            >
              Wykonaj darmową wycenę
              <ArrowRight className="w-4 h-4" />
            </a>
            <button
              className={`md:hidden p-2 rounded-lg transition-colors ${scrolled || menuOpen ? "text-foreground" : "text-white"
                }`}
              onClick={() => setMenuOpen((o) => !o)}
              aria-label="Menu"
            >
              {menuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div className="md:hidden bg-white/95 backdrop-blur-xl border-t border-border px-5 py-5 flex flex-col gap-4">
            {navLinks.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="text-base font-medium text-foreground py-1 border-b border-border/50 last:border-0"
              >
                {l.label}
              </a>
            ))}
            <a
              href="/triage"
              className="mt-2 w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold rounded-xl px-5 py-3.5 transition-all hover:bg-[#1244b0]"
            >
              Wykonaj darmową wycenę
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        )}
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex items-center pt-16 overflow-hidden bg-[#0d1b2e]">
        {/* Full-bleed background photo */}
        <img
          src="https://images.unsplash.com/photo-1761330440311-16e160cad236?w=1800&h=1100&fit=crop&auto=format"
          alt="Nowoczesny salon z elegancko zamontowaną klimatyzacją"
          className="absolute inset-0 w-full h-full object-cover object-center opacity-55"
        />
        {/* Gradient vignette — stronger on left for text legibility */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#0d1b2e]/90 via-[#0d1b2e]/55 to-[#0d1b2e]/10 pointer-events-none" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1b2e]/60 via-transparent to-transparent pointer-events-none" />

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
              {fomoData !== null && fomoData.slots < 5 && (
                <div className="inline-flex items-center gap-2.5 bg-white/15 backdrop-blur-sm border border-orange-300/40 rounded-full px-4 py-2.5 mb-7 shadow-sm">
                  <span className="text-base leading-none">🔥</span>
                  <span className="text-sm font-semibold text-orange-200">
                    {fomoData.slots === 1 ? (
                      <>
                        Został <span className="text-orange-300 font-extrabold">1</span> wolny termin {fomoData.period || "w tym tygodniu"} na darmowy audyt
                      </>
                    ) : (
                      <>
                        Zostały <span className="text-orange-300 font-extrabold">{fomoData.slots}</span> wolne terminy {fomoData.period || "w tym tygodniu"} na darmowy audyt
                      </>
                    )}
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
                <span className="text-[#60a5fa]">przez cały rok</span>
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
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-bold text-base rounded-xl px-8 py-4 transition-all duration-200 hover:bg-[#1244b0] hover:shadow-[0_12px_32px_rgba(23,80,200,0.55)] active:scale-[0.97]"
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
                  "Gwarancja do 5 lat",
                  "Montaż w 1 dzień",
                ].map((b) => (
                  <div key={b} className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#60a5fa] flex-shrink-0" />
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
        <div className="absolute inset-0 bg-gradient-to-b from-background via-[#e8effa] to-background pointer-events-none" />
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
              <ProductCard key={p.id} product={p} onOpenModal={setSelectedProduct} />
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
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d1b2e] via-[#1750c8] to-[#0a3fa8]" />
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
            i energooszczędne ciepło zimą
          </h2>
          <p className="text-lg sm:text-xl text-white/70 mb-12 max-w-2xl mx-auto leading-relaxed">
            Ciesz się idealnym klimatem w swoim domu bez ukrytych kosztów
            Przekonaj się, jak łatwo i szybko wycenisz instalację online
          </p>

          <a
            href="/triage"
            className="inline-flex items-center justify-center gap-3 bg-white text-primary font-bold text-base sm:text-lg rounded-2xl px-10 py-5 transition-all duration-200 hover:bg-[#f0f6ff] hover:shadow-[0_16px_48px_rgba(0,0,0,0.25)] active:scale-[0.97]"
          >
            Oblicz koszty w 2 minuty
            <ArrowRight className="w-5 h-5" />
          </a>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer id="kontakt" className="bg-foreground text-white/80">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">
            {/* Brand */}
            <div className="flex flex-col gap-5">
              <img
                src="/logo.png"
                alt="Klik Klima"
                className="h-10 w-auto brightness-0 invert opacity-90 self-start"
              />
              <p className="text-sm leading-relaxed text-white/60 max-w-xs">
                Lokalna firma klimatyzacyjna<br />
                Sprzedaż, profesjonalny montaż i serwis urządzeń marek premium
              </p>
              <div className="flex gap-3 mt-1">
                <a
                  href="https://www.instagram.com/klikklima"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <Camera className="w-4 h-4" />
                </a>
                <a
                  href="#"
                  aria-label="Facebook"
                  className="w-9 h-9 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
                >
                  <Globe className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Links */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-5">
                Nawigacja
              </p>
              <ul className="flex flex-col gap-3">
                {navLinks.map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-sm text-white/70 hover:text-white transition-colors"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-5">
                Kontakt
              </p>
              <ul className="flex flex-col gap-4">
                <li className="flex items-start gap-3 text-sm text-white/70">
                  <Phone className="w-4 h-4 mt-0.5 flex-shrink-0 text-accent" />
                  <span>{companyDetails.phoneDisplay}</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-white/70">
                  <Mail className="w-4 h-4 mt-0.5 flex-shrink-0 text-accent" />
                  <span>{companyDetails.email}</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-white/70">
                  <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0 text-accent" />
                  <span>{companyDetails.address}, {companyDetails.city}</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/40">
            <p>
              © {new Date().getFullYear()} {companyDetails.name} {companyDetails.owner} · NIP: {companyDetails.nip}
            </p>
            <div className="flex gap-5">
              <a href="/polityka-prywatnosci" className="hover:text-white/70 transition-colors">
                Polityka Prywatności
              </a>
              <a href="/regulamin" className="hover:text-white/70 transition-colors">
                Regulamin
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Wyłapywanie wychodzących użytkowników (Soft Leads) */}
      <ExitIntentModal />

      {/* Global Device Modal */}
      {selectedProduct && (
        <DeviceModal
          isOpen={!!selectedProduct}
          onClose={() => setSelectedProduct(null)}
          device={buildMockDevice(selectedProduct)}
          onReserveClick={() => window.location.href = '/triage'}
        />
      )}
    </div>
  );
}
