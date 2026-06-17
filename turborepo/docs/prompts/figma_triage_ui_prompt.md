# Prompt do wygenerowania UI (Figma AI / v0 / Relume)

Poniżej znajduje się super szczegółowy prompt. Możesz go wkleić do narzędzi typu **v0.dev**, **Figma AI** lub przekazać UX/UI Designerowi. Został on przygotowany z myślą o Next.js, Tailwind CSS i Framer Motion, uwzględniając nasze najnowsze ustalenia architektoniczne i biznesowe.

---

**Prompt:**

Jesteś World-Class Senior UX/UI Designerem. Zaprojektuj interfejs wieloetapowego formularza B2C (tzw. Triage Funnel) dla firmy instalującej klimatyzacje. Interfejs ma być napisany w React (Tailwind CSS, Framer Motion, shadcn/ui) z naciskiem na najwyższą konwersję i design klasy Premium (Apple-like, subtelne cienie, glassmorphism, duże czytelne typografie - np. Inter lub Outfit, płynne przejścia). 

**Wymagania Wizualne:**
- Design musi budzić ogromne zaufanie. Wykorzystaj paletę bieli, jasnych szarości i akcentów w kolorze głębokiej butelkowej zieleni (lub innego nowoczesnego koloru konwertującego). 
- Karty odpowiedzi (kafelki) powinny być duże, klikalne (tzw. "tap targets" dopasowane pod mobile), mieć stany hover z płynną animacją (skalowanie + podbicie cienia), a aktywny kafelek powinien mieć obrys z primary color i ewentualnie delikatny badge z haczykiem.
- W lewym (lub górnym) panelu ma być dyskretny pasek postępu (Progress Bar) oraz przycisk "Wstecz".
- Formularz działa jak kreator krok po kroku. Tylko jedno kluczowe pytanie na ekran.

**Kroki Formularza (Ekrany):**

1. **Ekran Powitalny / Pytanie 1: Gdzie chcesz zamontować klimatyzację?**
   - Kafelki: [Mieszkanie], [Dom], [Lokal komercyjny].
   - (Jeśli Lokal komercyjny -> odrzucenie do ekranu Eksperta).

2. **Pytanie 2: W ilu pomieszczeniach?**
   - Karty z numerami: [1 pomieszczenie], [2], [3], [4 i więcej].
   - (4 i więcej -> odrzucenie do ekranu Eksperta).

3. **Pytanie 3: Jaki jest metraż pomieszczeń?**
   - Jeśli wybrano 1 pokój: Pytamy o "Metraż pokoju". Kafelki: [Do 25 m²], [26-35 m²], [36-50 m²], [Powyżej 50 m²].
   - Jeśli wybrano 2 lub 3 pokoje (Multisplit): Projekt zakłada dynamiczną listę (np. Suwaki lub dropdowny dla Pokoju 1, Pokoju 2). Zrób UI pozwalające przypisać metraż dla każdego pomieszczenia z osobna na jednym zgrabnym ekranie.

4. **Pytanie 4: Jaki jest stan budynku/lokalu?**
   - Kafelki: [Wykończony / Zamieszkany], [W trakcie remontu], [Stan deweloperski].

5. **Pytanie 5 (Zależne): Dodatkowe warunki**
   - Jeśli wybrano Mieszkanie: "Czy mieszkanie posiada balkon?" [Tak] / [Nie]. Jeśli Nie -> "Na którym piętrze?" [Parter, 1 lub 2], [Powyżej 2. piętra].

6. **Ekran Przejściowy: Sztuczna Inteligencja / Loader**
   - Ekran z "pulsującym" skeletonem lub dynamicznym tekstem: "Analizuję parametry...", "Dobieram moc chłodniczą...", "Szacuję koszty materiałów...".

7. **Ekran Sukcesu (Wybrana Konfiguracja)**
   - Prezentacja dobranego sprzętu. Design jak w sklepie e-commerce premium.
   - Pokaż kartę wybranego urządzenia (np. Zdjęcie klimatyzatora ściennego Fuji Electric, Model: KETA).
   - Jeśli to Multisplit, pokaż ikony 2x Jednostka Wewnętrzna + 1x Jednostka Zewnętrzna.
   - Ogromna, czytelna sekcja "Szacunkowa wycena instalacji wraz z urządzeniem": np. **17 406 PLN brutto**. Dodaj tekst: "Cena zawiera podatek VAT 8% (budownictwo mieszkaniowe) oraz standardowy pakiet usług montażowych".
   - Przycisk CTA: "Zarezerwuj termin wizyty technicznej" (sticky na dole ekranu mobile).

8. **Ekran Rezerwacji (Kalendarz i Dane)**
   - Widok kalendarza ze slotami czasowymi (od 08:00 do 15:00).
   - Po prawej stronie (lub pod spodem na mobile) minimalistyczny formularz kontaktowy z pływającymi etykietami (Floating labels): Imię i Nazwisko, Email, Telefon, Adres montażu.
   - Przycisk końcowy: "Potwierdź rezerwację". 

Każda zmiana ekranu musi dziać się przy użyciu `AnimatePresence` z Framer Motion (np. wyjeżdżanie nowego pytania z prawej, zanikanie poprzedniego na lewo). Zadbaj, żeby UI wywoływało efekt WOW u użytkownika.
