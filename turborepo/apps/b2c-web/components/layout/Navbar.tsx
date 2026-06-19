import Link from "next/link";
import { Phone } from "lucide-react";
import { companyDetails } from "@/config/company";

export default function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <div className="flex-shrink-0 flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <img
                src="/logo.png"
                alt="Klik Klima"
                className="h-9 sm:h-10 w-auto"
              />
            </Link>
          </div>
          
          <div className="hidden md:flex space-x-8 items-center">
            <Link href="/#jak-to-dziala" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">
              Jak to działa?
            </Link>
            <Link href="/#gwarancje" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">
              Gwarancje
            </Link>
            <Link href="/baza-wiedzy" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">
              Baza wiedzy
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <a 
              href={`tel:${companyDetails.phone}`} 
              className="hidden md:flex items-center gap-2 text-sm font-semibold text-gray-700 hover:text-emerald-600 transition-colors"
            >
              <Phone className="w-4 h-4" />
              <span>{companyDetails.phoneDisplay}</span>
            </a>
            <Link 
              href="/triage"
              className="bg-gray-900 hover:bg-gray-800 text-white px-5 py-2.5 rounded-full text-sm font-medium transition-colors"
            >
              Darmowa wycena
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
