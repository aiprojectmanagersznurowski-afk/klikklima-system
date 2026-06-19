"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowRight, Smartphone, Wrench, Megaphone, CheckCircle2, Server, ThermometerSnowflake, Workflow, Layers, ShieldCheck, ChevronLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import Footer from '@/components/layout/Footer';

export default function AboutPage() {
  const router = useRouter();

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

        {/* HERO SECTION */}
        <section className="px-6 lg:px-12 max-w-7xl mx-auto mb-32">
          <div className="max-w-4xl">
            <h1 className="text-5xl sm:text-6xl lg:text-8xl font-bold tracking-tight text-foreground leading-[1.05] mb-8">
              Zmieniamy standardy <br className="hidden sm:block" />
              <span className="text-primary">branży HVAC.</span>
            </h1>
            <p className="text-xl sm:text-2xl text-muted-foreground leading-relaxed max-w-2xl font-medium">
              Nie jesteśmy tylko firmą instalacyjną. Jesteśmy technologicznym ekosystemem, który upraszcza proces wyceny dla klientów i automatyzuje pracę instalatorów.
            </p>
          </div>
        </section>

        {/* DNA SECTION (TECH + MARKETING + HVAC) */}
        <section className="bg-[#0f172a] text-white py-32 rounded-[3rem] mx-4 sm:mx-8 mb-32">
          <div className="px-6 lg:px-12 max-w-7xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-start">
              <div className="sticky top-32">
                <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">Nasze DNA</h2>
                <p className="text-xl text-white/70 leading-relaxed max-w-lg mb-8">
                  KlikKlima to wynik połączenia wieloletniego doświadczenia w branży klimatyzacyjnej z nowoczesnymi technologiami i precyzyjnym marketingiem.
                </p>
              </div>
              
              <div className="space-y-8">
                {/* Tech */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 sm:p-10 backdrop-blur-sm">
                  <Server className="w-10 h-10 text-[#60a5fa] mb-6" strokeWidth={1.5} />
                  <h3 className="text-2xl font-bold mb-4">Technologia</h3>
                  <p className="text-white/70 leading-relaxed">
                    Budujemy własne, autorskie narzędzia. Od inteligentnego systemu wycen (Triage), aż po zaawansowane panele dla doradców B2B. Nasze oprogramowanie eliminuje wąskie gardła i automatyzuje powtarzalne procesy, dając przewagę nad konkurencją.
                  </p>
                </div>
                
                {/* Marketing */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 sm:p-10 backdrop-blur-sm">
                  <Megaphone className="w-10 h-10 text-[#a78bfa] mb-6" strokeWidth={1.5} />
                  <h3 className="text-2xl font-bold mb-4">Marketing</h3>
                  <p className="text-white/70 leading-relaxed">
                    Doskonale rozumiemy zachowania konsumentów w cyfrowym świecie. Generujemy wysokiej jakości ruch i precyzyjnie docieramy do osób, które faktycznie potrzebują nowoczesnych systemów chłodzenia i ogrzewania, zapewniając stały dopływ klientów.
                  </p>
                </div>

                {/* HVAC */}
                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 sm:p-10 backdrop-blur-sm">
                  <ThermometerSnowflake className="w-10 h-10 text-[#34d399] mb-6" strokeWidth={1.5} />
                  <h3 className="text-2xl font-bold mb-4">Ekspertyza HVAC</h3>
                  <p className="text-white/70 leading-relaxed">
                    Fundamentem naszego biznesu są setki udanych instalacji klimatyzacji i pomp ciepła w całej Europie. Wiemy z jakimi wyzwaniami borykają się instalatorzy w terenie, dlatego nasze rozwiązania oparte są na prawdziwym, rynkowym doświadczeniu.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ECOSYSTEM SECTION */}
        <section className="px-6 lg:px-12 max-w-7xl mx-auto mb-32">
          <div className="mb-20 text-center max-w-3xl mx-auto">
            <h2 className="text-4xl sm:text-5xl font-bold tracking-tight text-foreground mb-6">Jeden ekosystem, <br/>dwie perspektywy</h2>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Tworzymy rozwiązania dedykowane, które wnoszą unikalną wartość (UVP) zarówno dla klientów końcowych, jak i dla profesjonalnych instalatorów z nami współpracujących.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
            {/* For B2C */}
            <div className="bg-[#f8fafc] rounded-[2.5rem] p-10 sm:p-14 border border-border/50">
              <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-8">
                <Smartphone className="w-8 h-8" strokeWidth={1.5} />
              </div>
              <h3 className="text-3xl font-bold mb-6">Dla Klienta (B2C)</h3>
              <p className="text-lg text-muted-foreground mb-8">
                Aplikacja <strong>Triage</strong> to przełom w zakupie klimatyzacji. Koniec z czekaniem na infolinii czy kilkudniowym oczekiwaniem na wycenę e-mail.
              </p>
              <ul className="space-y-4">
                {[
                  'Wstępna wycena z montażem w 2 minuty',
                  'Transparentność i wybór urządzeń online',
                  'Natychmiastowa rezerwacja terminu audytu',
                  'Brak ukrytych kosztów i pełna przejrzystość'
                ].map(item => (
                  <li key={item} className="flex items-start gap-3 text-foreground font-medium">
                    <CheckCircle2 className="w-6 h-6 text-blue-600 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* For B2B */}
            <div className="bg-[#fffbeb] rounded-[2.5rem] p-10 sm:p-14 border border-border/50">
              <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center mb-8">
                <Wrench className="w-8 h-8" strokeWidth={1.5} />
              </div>
              <h3 className="text-3xl font-bold mb-6">Dla Instalatora (B2B)</h3>
              <p className="text-lg text-muted-foreground mb-8">
                Nasz <strong>Panel Doradcy</strong> to kompletny CRM (System zarządzania relacjami) stworzony specjalnie pod specyfikę branży chłodniczej.
              </p>
              <ul className="space-y-4">
                {[
                  'Dostęp do zakwalifikowanych, ciepłych leadów',
                  'Automatyzacja generowania umów i wycen',
                  'Optymalizacja tras i harmonogramów montaży',
                  'Zarządzanie dokumentacją w jednym miejscu'
                ].map(item => (
                  <li key={item} className="flex items-start gap-3 text-foreground font-medium">
                    <ShieldCheck className="w-6 h-6 text-amber-600 shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 lg:px-12 max-w-7xl mx-auto">
          <div className="bg-primary text-primary-foreground rounded-[2.5rem] p-12 sm:p-20 text-center relative overflow-hidden">
            {/* Subtle bg decorations */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-black/10 rounded-full blur-3xl translate-y-1/3 -translate-x-1/3"></div>
            
            <div className="relative z-10 max-w-3xl mx-auto">
              <h2 className="text-4xl sm:text-5xl font-bold tracking-tight mb-6">Gotowy na zmianę standardów?</h2>
              <p className="text-xl text-primary-foreground/80 mb-10">
                Sprawdź jak szybko możesz wycenić instalację lub dołącz do grona naszych certyfikowanych partnerów i zacznij korzystać z potęgi naszego systemu.
              </p>
              <div className="flex flex-col sm:flex-row justify-center gap-4">
                <Link 
                  href="/triage" 
                  className="inline-flex items-center justify-center gap-2 bg-white text-primary font-semibold text-lg rounded-xl px-8 py-4 transition-all duration-200 hover:bg-secondary"
                >
                  Darmowa wycena <ArrowRight size={20} />
                </Link>
                <Link 
                  href="/" 
                  className="inline-flex items-center justify-center gap-2 bg-primary-foreground/10 text-white font-semibold text-lg rounded-xl px-8 py-4 transition-all duration-200 hover:bg-primary-foreground/20 border border-primary-foreground/20"
                >
                  Strona główna
                </Link>
              </div>
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </div>
  );
}
