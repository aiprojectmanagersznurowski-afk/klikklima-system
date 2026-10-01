"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Compass,
  Search,
  LayoutDashboard,
  Users,
  FolderKanban,
  Box,
  BarChart3,
  BotMessageSquare,
  Sparkles,
  Settings,
  CalendarDays,
  BookOpen,
  Wrench,
  AlertTriangle,
  FileText,
  SlidersHorizontal,
  DollarSign,
  Bell,
  X,
  CornerDownLeft,
  Command,
} from "lucide-react";

export interface NavigationItem {
  id: string;
  group: string;
  label: string;
  description?: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  keywords: string[];
}

export const ALL_NAVIGATION_ITEMS: NavigationItem[] = [
  // Główne
  {
    id: "dashboard",
    group: "Główne",
    label: "Pulpit",
    description: "Centrum dowodzenia i podsumowanie wskaźników",
    href: "/dashboard",
    icon: LayoutDashboard,
    keywords: ["home", "start", "statystyki", "glowna", "pulpit"],
  },
  {
    id: "chat",
    group: "Główne",
    label: "Asystent AI",
    description: "Czat ze sztuczną inteligencją KlikKlima",
    href: "/chat",
    icon: BotMessageSquare,
    keywords: ["ai", "bot", "pomoc", "czat", "asystent", "sztuczna inteligencja"],
  },
  {
    id: "my-schedule",
    group: "Główne",
    label: "Mój grafik",
    description: "Osobisty terminarz i zaplanowane wizyty",
    href: "/me/schedule",
    icon: CalendarDays,
    keywords: ["grafik", "kalendarz", "terminarz", "wizyty", "moj grafik"],
  },
  {
    id: "documentation",
    group: "Główne",
    label: "Dokumentacja",
    description: "Baza wiedzy, procedury i instrukcje systemowe",
    href: "/dokumentacja",
    icon: BookOpen,
    keywords: ["docs", "pomoc", "instrukcja", "procedury", "baza wiedzy", "dokumentacja"],
  },
  {
    id: "notifications-center",
    group: "Główne",
    label: "Centrum Powiadomień",
    description: "Historia i rejestr powiadomień SMS / E-mail",
    href: "/notifications",
    icon: Bell,
    keywords: ["powiadomienia", "sms", "email", "alerty", "komunikaty"],
  },

  // Lejek i Zlecenia
  {
    id: "leads-all",
    group: "Lejek sprzedaży",
    label: "Wszystkie zlecenia (Leady)",
    description: "Pełny widok tablicy kanban i listy zgłoszeń",
    href: "/leads?status=ALL",
    icon: Users,
    keywords: ["wszystkie", "lead", "kanban", "zlecenia", "tabela"],
  },
  {
    id: "leads-new",
    group: "Lejek sprzedaży",
    label: "1. Nowy lead",
    description: "Zgłoszenia oczekujące na pierwszy kontakt",
    href: "/leads?status=NEW_LEAD",
    icon: FileText,
    keywords: ["nowy lead", "etap 1", "kontakt", "nowy"],
  },
  {
    id: "leads-awaiting-audit",
    group: "Lejek sprzedaży",
    label: "2. Oczekiwanie na audyt",
    description: "Klienci oczekujący na wizytę audytora",
    href: "/leads?status=AWAITING_AUDIT",
    icon: FileText,
    keywords: ["audyt", "etap 2", "wizyta audytora", "oczekiwanie na audyt"],
  },
  {
    id: "leads-audit-completed",
    group: "Lejek sprzedaży",
    label: "3. Wykonany audyt",
    description: "Audyty zakończone, przygotowywanie oferty",
    href: "/leads?status=AUDIT_COMPLETED",
    icon: FileText,
    keywords: ["wykonany audyt", "etap 3", "oferta", "dobor"],
  },
  {
    id: "leads-crew-assignment",
    group: "Lejek sprzedaży",
    label: "4. Oczekuje na ekipę",
    description: "Zaakceptowane oferty oczekujące na przydział montażystów",
    href: "/leads?status=AWAITING_CREW_ASSIGNMENT",
    icon: Users,
    keywords: ["przydzial ekipy", "etap 4", "montazysci", "oczekuje na ekipe"],
  },
  {
    id: "leads-warehouse",
    group: "Lejek sprzedaży",
    label: "5. Wysyłka (Hurtownia)",
    description: "Przygotowanie towaru i jednostek w magazynie",
    href: "/leads?status=HARDWARE_IN_WAREHOUSE",
    icon: Box,
    keywords: ["magazyn", "hurtownia", "etap 5", "kompletacja sprzetu"],
  },
  {
    id: "leads-transit",
    group: "Lejek sprzedaży",
    label: "6. Wysyłka w drodze",
    description: "Klimatyzatory w trakcie transportu do klienta",
    href: "/leads?status=HARDWARE_IN_TRANSIT",
    icon: Box,
    keywords: ["kurier", "transport", "etap 6", "w drodze", "wysylka"],
  },
  {
    id: "leads-awaiting-installation",
    group: "Lejek sprzedaży",
    label: "7. Oczekuje instalacji",
    description: "Sprzęt dostarczony, termin montażu wyznaczony",
    href: "/leads?status=AWAITING_INSTALLATION",
    icon: Wrench,
    keywords: ["montaz", "instalacja", "etap 7", "oczekuje instalacji"],
  },
  {
    id: "leads-completed",
    group: "Lejek sprzedaży",
    label: "8. Instalacja zakończona",
    description: "Protokół podpisany, rozliczone zlecenie",
    href: "/leads?status=INSTALLATION_COMPLETED",
    icon: Wrench,
    keywords: ["sukces", "zakonczona", "protokol", "etap 8", "gotowe"],
  },
  {
    id: "leads-cold",
    group: "Lejek sprzedaży",
    label: "Zimne zlecenia (Cold)",
    description: "Klienci niezdecydowani lub odłożeni w czasie",
    href: "/leads?bucket=cold",
    icon: Users,
    keywords: ["zimne", "odlozone", "rezerwowe", "cold", "lead"],
  },

  // CRM & Operacje
  {
    id: "customers",
    group: "CRM & Operacje",
    label: "Klienci",
    description: "Baza danych inwestorów, dane kontaktowe i historia",
    href: "/customers",
    icon: Users,
    keywords: ["klient", "baza", "kontakt", "telefon", "inwestorzy", "kontakty"],
  },
  {
    id: "installations",
    group: "CRM & Operacje",
    label: "Montaże i Instalacje",
    description: "Rejestr i harmonogram montaży klimatyzacji",
    href: "/installations",
    icon: Wrench,
    keywords: ["montaze", "instalacja", "klimatyzatory", "prace", "harmonogram"],
  },
  {
    id: "services",
    group: "CRM & Operacje",
    label: "Serwisy i Przeglądy",
    description: "Planowane przeglądy gwarancyjne i konserwacja",
    href: "/services",
    icon: SlidersHorizontal,
    keywords: ["serwis", "przeglady", "gwarancja", "konserwacja", "czyszczenie"],
  },
  {
    id: "incidents",
    group: "CRM & Operacje",
    label: "Zgłoszenia i Usterki",
    description: "Rejestr awarii, reklamacji i zgłoszeń serwisowych",
    href: "/incidents",
    icon: AlertTriangle,
    keywords: ["usterki", "awarie", "reklamacje", "incydenty", "zgloszenia", "problemy"],
  },
  {
    id: "auditors",
    group: "CRM & Operacje",
    label: "Audytorzy",
    description: "Lista doradców technicznych i audytorów",
    href: "/auditors",
    icon: Users,
    keywords: ["audytor", "doradcy", "zespol audytu", "pomiary"],
  },
  {
    id: "crews",
    group: "CRM & Operacje",
    label: "Zespoły monterskie",
    description: "Ekipy montażowe, certyfikaty i dostępność",
    href: "/crews",
    icon: Users,
    keywords: ["ekipy", "monterzy", "instalatorzy", "zespoly"],
  },
  {
    id: "logistics",
    group: "CRM & Operacje",
    label: "Logistyka",
    description: "Stan magazynowy urządzeń i koordynacja wysyłek",
    href: "/logistics",
    icon: Box,
    keywords: ["logistyka", "magazyn", "dostawy", "przesylki", "stan"],
  },

  // Analityka
  {
    id: "analytics-funnel",
    group: "Analityka",
    label: "Lejek sprzedaży",
    description: "Konwersja na etapach, czas przejścia i rentowność",
    href: "/analytics/funnel",
    icon: BarChart3,
    keywords: ["analityka", "lejek", "konwersja", "sprzedaz", "wykresy"],
  },
  {
    id: "analytics-crews",
    group: "Analityka",
    label: "Montaże & Ekipy",
    description: "Wskaźniki efektywności i jakość prac monterskich",
    href: "/analytics/crews",
    icon: BarChart3,
    keywords: ["analityka ekip", "efektywnosc", "czas montazu", "jaskosc"],
  },
  {
    id: "analytics-auditors",
    group: "Analityka",
    label: "Audyty & Audytorzy",
    description: "Skuteczność audytów i statystyki sprzedaży",
    href: "/analytics/auditors",
    icon: BarChart3,
    keywords: ["analityka audytorow", "skutecznosc", "zamkniecia"],
  },

  // Ustawienia
  {
    id: "settings-standard-installation",
    group: "Ustawienia",
    label: "Montaż standardowy",
    description: "Definiowanie składników i kalkulator wzorca montażu",
    href: "/settings/standard-installation",
    icon: Wrench,
    keywords: ["standard", "wzorcowy montaz", "kalkulator", "standardowy", "montaz standardowy"],
  },
  {
    id: "settings-pricing",
    group: "Ustawienia",
    label: "Cennik wyceny",
    description: "Ceny robocizny, materiałów i koszty ekip",
    href: "/settings/pricing",
    icon: DollarSign,
    keywords: ["cennik", "ceny", "stawki", "robocizna", "materialy", "koszty ekipy", "wycena"],
  },
  {
    id: "settings-users",
    group: "Ustawienia",
    label: "Użytkownicy i Uprawnienia",
    description: "Konta pracowników, role i dostęp do systemu (RBAC)",
    href: "/settings",
    icon: Settings,
    keywords: ["ustawienia", "uzytkownicy", "uprawnienia", "rbac", "konta", "role", "admin"],
  },
  {
    id: "settings-calendar",
    group: "Ustawienia",
    label: "Kalendarz i wizyty",
    description: "Konfiguracja slotów, okien czasowych i Google Calendar",
    href: "/settings/calendar",
    icon: CalendarDays,
    keywords: ["kalendarz", "sloty", "godziny", "dostepnosc", "terminy wizyt"],
  },
  {
    id: "settings-exit-intent",
    group: "Ustawienia",
    label: "Exit Intent",
    description: "Konfiguracja rabatu i zachowania przy opuszczaniu",
    href: "/settings/exit-intent",
    icon: Settings,
    keywords: ["exit intent", "rabat", "popup", "formularz b2c"],
  },
  {
    id: "settings-notifications",
    group: "Ustawienia",
    label: "Parametry powiadomień",
    description: "Szablony SMS, e-mail i integracja SMSAPI",
    href: "/settings/notifications",
    icon: Bell,
    keywords: ["powiadomienia", "smsapi", "szablony sms", "konfiguracja email"],
  },
];

export function SearchDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  // Skrót klawiszowy Cmd+P / Ctrl+P lub Cmd+J / Ctrl+J
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isModifier = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      if (isModifier && (key === "p" || key === "j")) {
        // Tylko jeśli nie piszemy w input/textarea
        const target = e.target as HTMLElement;
        if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
          return;
        }
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Auto-focus po otwarciu
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    } else {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  // Filtrowanie elementów na żywo
  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) {
      return ALL_NAVIGATION_ITEMS;
    }
    return ALL_NAVIGATION_ITEMS.filter((item) => {
      if (item.label.toLowerCase().includes(q)) return true;
      if (item.group.toLowerCase().includes(q)) return true;
      if (item.description && item.description.toLowerCase().includes(q)) return true;
      if (item.href.toLowerCase().includes(q)) return true;
      if (item.keywords.some((kw) => kw.toLowerCase().includes(q))) return true;
      return false;
    });
  }, [query]);

  // Reset indeksu zaznaczenia po zmianie zapytania
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const handleSelect = (href: string) => {
    setIsOpen(false);
    router.push(href);
  };

  const handleKeyDownList = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filteredItems.length > 0
          ? (prev - 1 + filteredItems.length) % filteredItems.length
          : 0
      );
    } else if (e.key === "Enter" && filteredItems[selectedIndex]) {
      e.preventDefault();
      handleSelect(filteredItems[selectedIndex].href);
    }
  };

  // Grupowanie wyników z zachowaniem płaskiej kolejności indeksowania
  const groupedItems = useMemo(() => {
    const groupsMap = new Map<string, NavigationItem[]>();
    for (const item of filteredItems) {
      if (!groupsMap.has(item.group)) {
        groupsMap.set(item.group, []);
      }
      groupsMap.get(item.group)!.push(item);
    }
    return Array.from(groupsMap.entries());
  }, [filteredItems]);

  return (
    <>
      {/* Przycisk otwierający - identyczny styl jak okienko "Szukaj" */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-between w-full px-3.5 py-1.5 text-xs text-muted-foreground bg-secondary/60 hover:bg-secondary border border-border/80 rounded-xl transition-all shadow-2xs group cursor-pointer"
        title="Nawiguj do strony (⌘P / ⌘J)"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Compass className="size-3.5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
          <span className="truncate">Nawiguj do strony...</span>
        </div>
        <kbd className="hidden sm:inline-flex items-center gap-0.5 px-1.5 py-0.5 text-2xs font-mono font-semibold bg-background border border-border rounded-md text-muted-foreground shadow-2xs shrink-0">
          <Command className="size-2.5" /> P
        </kbd>
      </button>

      {/* Okno modalne nawigacji - spójne z GlobalSearch */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-background/80 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="w-full max-w-2xl bg-card rounded-2xl border border-border shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
            onKeyDown={handleKeyDownList}
          >
            {/* Input Bar */}
            <div className="flex items-center px-4 py-3.5 border-b border-border gap-3 bg-card">
              <Compass className="size-5 text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                type="text"
                placeholder="Wpisz nazwę strony, etapu, modułu lub ustawień (np. cennik, montaż standardowy)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>

            {/* Lista stron / modułów */}
            <div className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-border/40">
              {filteredItems.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  Nie znaleziono żadnej strony pasującej do:{" "}
                  <span className="font-semibold text-foreground font-mono">
                    {query}
                  </span>
                </div>
              ) : (
                groupedItems.map(([groupName, items]) => (
                  <div key={groupName} className="py-2">
                    <div className="px-3 py-1.5 text-2xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      {groupName}
                    </div>
                    <div className="space-y-1 mt-1">
                      {items.map((item) => {
                        const itemIndex = filteredItems.findIndex(
                          (i) => i.id === item.id
                        );
                        const isSelected = selectedIndex === itemIndex;
                        const Icon = item.icon;
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleSelect(item.href)}
                            onMouseEnter={() => setSelectedIndex(itemIndex)}
                            className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                              isSelected
                                ? "bg-primary/10 text-primary"
                                : "hover:bg-secondary/60 text-foreground"
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div
                                className={`size-8 rounded-lg flex items-center justify-center shrink-0 border ${
                                  isSelected
                                    ? "bg-primary/15 border-primary/30 text-primary"
                                    : "bg-secondary/50 border-border text-muted-foreground"
                                }`}
                              >
                                <Icon className="size-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold truncate">
                                  {item.label}
                                </p>
                                {item.description && (
                                  <p className="text-xs text-muted-foreground truncate mt-0.5">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                            </div>
                            <span className="px-2 py-0.5 text-2xs font-mono font-medium rounded-md bg-secondary/80 border border-border text-muted-foreground shrink-0 ml-2">
                              {item.href.split("?")[0]}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Stopka ze skrótami klawiaturowymi */}
            <div className="p-3 border-t border-border bg-secondary/20 flex items-center justify-between text-2xs text-muted-foreground">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-background border border-border">
                    ↑
                  </kbd>
                  <kbd className="px-1.5 py-0.5 rounded bg-background border border-border">
                    ↓
                  </kbd>
                  Nawigacja
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-background border border-border flex items-center gap-0.5">
                    <CornerDownLeft className="size-2.5" />
                  </kbd>
                  Wybierz stronę
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded bg-background border border-border">
                    Esc
                  </kbd>
                  Zamknij
                </span>
              </div>
              <span>
                {filteredItems.length === ALL_NAVIGATION_ITEMS.length
                  ? `Stron: ${ALL_NAVIGATION_ITEMS.length}`
                  : `Wyników: ${filteredItems.length}`}
              </span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
