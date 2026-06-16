import Link from "next/link";
import Navbar from "@/components/layout/Navbar";
import Footer from "@/components/layout/Footer";
import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles, Wind } from "lucide-react";

export default function Home() {
  return (
    <>
      <Navbar />
      
      <main className="flex-1 pt-20">
        {/* HERO SECTION */}
        <section className="relative overflow-hidden bg-white">
          <div className="absolute inset-0 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-50"></div>
          
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative pt-24 pb-32 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium mb-8">
              <Sparkles size={16} />
              <span>Najczystszy montaż w mieście</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-extrabold text-gray-900 tracking-tight mb-8 max-w-4xl mx-auto leading-tight">
              Klimatyzacja dobrana do Ciebie w <span className="text-emerald-600">2 minuty</span>.
            </h1>
            
            <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
              Przejdź krótki formularz, poznaj szacowaną cenę i zarezerwuj darmowy audyt. 
              Zero spamu, 100% transparentności.
            </p>
            
            <Link 
              href="/triage"
              className="inline-flex items-center gap-2 bg-gray-900 text-white px-8 py-4 rounded-full text-lg font-medium hover:bg-gray-800 transition-all hover:scale-105 shadow-xl hover:shadow-2xl"
            >
              Rozpocznij darmową wycenę
              <ArrowRight size={20} />
            </Link>
          </div>
        </section>

        {/* BRANDS / AUTHORITY SECTION */}
        <section className="border-y border-gray-100 bg-gray-50 py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <p className="text-center text-sm font-medium text-gray-500 uppercase tracking-wider mb-8">
              Pracujemy wyłącznie na sprawdzonych technologiach
            </p>
            <div className="flex justify-center items-center gap-12 md:gap-24 grayscale opacity-60">
              {/* Dummy logos for Fuji Electric and Haier */}
              <div className="text-2xl font-bold font-serif">Fuji Electric</div>
              <div className="text-2xl font-black tracking-tighter">Haier</div>
              <div className="text-2xl font-bold text-gray-800 hidden md:block">DAIKIN</div>
            </div>
          </div>
        </section>

        {/* PROCESS SECTION */}
        <section id="jak-to-dziala" className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">Jak działamy?</h2>
              <p className="text-gray-600 max-w-2xl mx-auto text-lg">Prosty i przejrzysty proces. Od wyceny do chłodu w zaledwie 3 krokach.</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-12">
              {[
                {
                  step: "01",
                  title: "Kalkulacja Online",
                  desc: "Odpowiadasz na kilka pytań w naszym formularzu Triage i od razu poznajesz orientacyjne koszty."
                },
                {
                  step: "02",
                  title: "Darmowy Audyt",
                  desc: "Nasz inżynier przyjeżdża do Ciebie, by potwierdzić dobór i omówić szczegóły instalacji."
                },
                {
                  step: "03",
                  title: "Czysty Montaż",
                  desc: "Zjawiamy się z uśmiechem, montujemy sprzęt i zostawiamy po sobie absolutny porządek."
                }
              ].map((item) => (
                <div key={item.step} className="relative p-8 rounded-3xl bg-gray-50 border border-gray-100">
                  <div className="text-5xl font-black text-gray-200 mb-6">{item.step}</div>
                  <h3 className="text-xl font-bold text-gray-900 mb-3">{item.title}</h3>
                  <p className="text-gray-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* GUARANTEES SECTION */}
        <section id="gwarancje" className="py-24 bg-gray-900 text-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid md:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-3xl md:text-4xl font-bold mb-6">Instalacja, której możesz zaufać.</h2>
                <p className="text-gray-400 text-lg mb-8">
                  Klimatyzacja to inwestycja na lata. Nie pozwól, aby montaż wykonała niesprawdzona ekipa. 
                  My dajemy Ci pewność na każdym kroku.
                </p>
                <div className="space-y-6">
                  {[
                    "5 lat pełnej gwarancji na urządzenia i nasz montaż.",
                    "Autoryzowany partner Fuji Electric i Haier.",
                    "Zostawiamy idealny porządek po pracy – sprzątamy z odkurzaczem przemysłowym."
                  ].map((benefit, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <div className="mt-1 bg-emerald-500/20 text-emerald-400 rounded-full p-1">
                        <CheckCircle2 size={20} />
                      </div>
                      <p className="text-gray-300">{benefit}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative">
                <div className="aspect-square rounded-3xl bg-gray-800 border border-gray-700 flex items-center justify-center p-12">
                  <ShieldCheck size={120} className="text-emerald-500 opacity-80" />
                  <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 to-transparent rounded-3xl"></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* KNOWLEDGE BASE SECTION */}
        <section id="baza-wiedzy" className="py-24 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-end mb-12">
              <div>
                <h2 className="text-3xl font-bold text-gray-900 mb-4">Baza Wiedzy</h2>
                <p className="text-gray-600">Porady ekspertów przed montażem.</p>
              </div>
              <Link href="#" className="hidden md:flex text-emerald-600 font-medium hover:text-emerald-700 items-center gap-2">
                Wszystkie artykuły <ArrowRight size={16} />
              </Link>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              {[
                "Zgoda spółdzielni na klimatyzator – jak ją uzyskać?",
                "Dlaczego warto wybrać pompę ciepła powietrze-powietrze?",
                "Klimatyzacja w bloku z wielkiej płyty – co musisz wiedzieć?"
              ].map((title, i) => (
                <Link key={i} href="#" className="group">
                  <div className="aspect-video bg-gray-100 rounded-2xl mb-4 overflow-hidden relative flex items-center justify-center">
                    <Wind size={48} className="text-gray-300" />
                    <div className="absolute inset-0 bg-gray-900/0 group-hover:bg-gray-900/5 transition-colors"></div>
                  </div>
                  <h3 className="font-bold text-gray-900 group-hover:text-emerald-600 transition-colors line-clamp-2">
                    {title}
                  </h3>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </>
  );
}
