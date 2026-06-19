import Link from "next/link";
import { Camera, Globe, Phone, Mail, MapPin } from "lucide-react";
import { companyDetails } from "@/config/company";

const navLinks = [
  { label: "Oferta", href: "/#oferta" },
  { label: "Proces", href: "/#proces" },
  { label: "Bestsellery", href: "/#bestsellery" },
  { label: "Baza wiedzy", href: "/baza-wiedzy" },
  { label: "O nas", href: "/o-nas" },
];

export default function Footer() {
  return (
    <footer id="kontakt" className="bg-foreground text-white/80">
      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 mb-12">
          {/* Brand */}
          <div className="flex flex-col gap-5">
            <img
              src="/logo.png"
              alt="Klik Klima"
              className="h-[66px] sm:h-[80px] w-auto brightness-0 invert opacity-90 self-start"
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
                  <Link
                    href={l.href}
                    className="text-sm text-white/70 hover:text-white transition-colors"
                  >
                    {l.label}
                  </Link>
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
            <Link href="/polityka-prywatnosci" className="hover:text-white/70 transition-colors">
              Polityka Prywatności
            </Link>
            <Link href="/regulamin" className="hover:text-white/70 transition-colors">
              Regulamin
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
