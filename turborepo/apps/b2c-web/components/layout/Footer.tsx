import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-gray-50 border-t border-gray-100 py-12 mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center mb-6">
              <img
                src="/logo.png"
                alt="Klik Klima"
                className="h-10 w-auto brightness-0 invert opacity-90"
              />
            </div>
            <p className="text-gray-500 text-sm max-w-sm mb-6">
              Nowoczesne podejście do klimatyzacji. Szybka wycena online, czysty montaż, 
              5 lat gwarancji i sprawdzony sprzęt (Fuji, Haier).
            </p>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Firma</h4>
            <ul className="space-y-3">
              <li><Link href="/o-nas" className="text-sm text-gray-500 hover:text-emerald-600">O nas</Link></li>
              <li><Link href="/#gwarancje" className="text-sm text-gray-500 hover:text-emerald-600">Gwarancja</Link></li>
              <li><Link href="/baza-wiedzy" className="text-sm text-gray-500 hover:text-emerald-600">Baza wiedzy</Link></li>
              <li><Link href="/triage" className="text-sm text-gray-500 hover:text-emerald-600">Wycena online</Link></li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold text-gray-900 mb-4">Pomoc prawna</h4>
            <ul className="space-y-3">
              <li><Link href="/polityka-prywatnosci" className="text-sm text-gray-500 hover:text-emerald-600">Polityka prywatności</Link></li>
              <li><Link href="/polityka-prywatnosci" className="text-sm text-gray-500 hover:text-emerald-600">Regulamin</Link></li>
              <li><Link href="/polityka-prywatnosci" className="text-sm text-gray-500 hover:text-emerald-600">RODO</Link></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-gray-200 mt-12 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-gray-400">
            &copy; {new Date().getFullYear()} KlikKlima. Wszelkie prawa zastrzeżone.
          </p>
        </div>
      </div>
    </footer>
  );
}
