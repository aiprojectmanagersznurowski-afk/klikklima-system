"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ArrowRight } from "lucide-react";

const navLinks = [
  { label: "Oferta", href: "/#oferta" },
  { label: "Proces", href: "/#proces" },
  { label: "Bestsellery", href: "/#bestsellery" },
  { label: "Baza wiedzy", href: "/baza-wiedzy" },
  { label: "O nas", href: "/o-nas" },
];

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  const isHomePage = pathname === "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    // Check initial scroll
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isSolid = !isHomePage || scrolled || menuOpen;

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isSolid
          ? "bg-white/95 backdrop-blur-xl border-b border-border shadow-sm"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 sm:px-8 h-16 sm:h-20 flex items-center justify-between gap-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 flex-shrink-0">
          <img
            src="/logo.png"
            alt="Klik Klima"
            className={`h-[66px] sm:h-[80px] w-auto transition-all duration-300 ${
              !isSolid ? "brightness-0 invert" : ""
            }`}
          />
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-8">
          {navLinks.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className={`text-sm font-medium transition-colors ${
                isSolid
                  ? "text-foreground/70 hover:text-foreground"
                  : "text-white/80 hover:text-white"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        {/* CTA + hamburger */}
        <div className="flex items-center gap-3">
          <Link
            href="/triage"
            className="hidden sm:inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold text-sm rounded-xl px-5 py-2.5 transition-all duration-200 hover:bg-[#1244b0] hover:shadow-[0_8px_24px_rgba(23,80,200,0.35)] active:scale-[0.97]"
          >
            Wykonaj darmową wycenę
            <ArrowRight className="w-4 h-4" />
          </Link>
          <button
            className={`md:hidden p-2 rounded-lg transition-colors ${
              isSolid ? "text-foreground" : "text-white"
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
        <div className="md:hidden bg-white/95 backdrop-blur-xl border-t border-border px-5 py-5 flex flex-col gap-4 shadow-xl">
          {navLinks.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="text-base font-medium text-foreground py-2 border-b border-border/50 last:border-0"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/triage"
            onClick={() => setMenuOpen(false)}
            className="mt-2 w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground font-semibold rounded-xl px-5 py-3.5 transition-all hover:bg-[#1244b0]"
          >
            Wykonaj darmową wycenę
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </header>
  );
}
