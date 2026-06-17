# Prompt do wygenerowania UI Landing Page (Figma AI / v0 / Relume)

Poniżej znajduje się super szczegółowy prompt. Możesz go wkleić do narzędzi typu **v0.dev**, **Figma AI** lub przekazać UX/UI Designerowi w celu zaprojektowania nowoczesnego i wysoce konwertującego Landing Page'a dla Twojej firmy klimatyzacyjnej.

---

**Prompt:**

Jesteś World-Class Senior UX/UI Designerem. Zaprojektuj interfejs strony głównej (Landing Page) dla lokalnej, nowoczesnej firmy **Klik Klima**, specjalizującej się w sprzedaży i montażu klimatyzacji. Strona ma być docelowo napisana w React (Next.js, Tailwind CSS, shadcn/ui) z naciskiem na konwersję Leada i design klasy Premium.

**Styl i Estetyka (Apple-like / Premium Home Services):**
- Przestronne, czyste układy z dużą ilością "white space" (oddechu).
- Paleta bieli, bardzo jasnych szarości dla tła oraz **eleganckie odcienie niebieskiego** (np. klasyczny niebieski, błękit lub granat) do kluczowych przycisków akcji (CTA) i akcentów.
- Subtelne "Glassmorphism" (przezroczystości z rozmytym tłem) dla pływających elementów (np. karty korzyści, nagłówki formularzy).
- Zaokrąglone rogi (border-radius) i gładkie cienie dla kart.
- Duża, nowoczesna typografia (np. Inter, Outfit lub Plus Jakarta Sans).

**Struktura Strony (Układ "od góry do dołu"):**

1. **Header (Nawigacja)**
   - Lewa strona: Logo firmy **Klik Klima** (użyj pliku z logo dołączonego w załączniku, lub zrób nowoczesny placeholder).
   - Środek: Ukryte na mobile, na desktopie odnośniki (Oferta, Proces, Nasze Bestsellery, Kontakt).
   - Prawa strona: Przycisk "Wykonaj darmową wycenę" stylizowany jako główny przycisk.

2. **Hero Section (Sekcja Główna - "Above the fold")**
   - Piękne, wysokiej jakości zdjęcie w tle lub po prawej stronie (nowoczesny, przeszklony salon, w którym niewidocznie, ale elegancko zamontowana jest czarna lub biała klimatyzacja).
   - Nagłówek H1 (bardzo duży): "Idealna temperatura w Twoim domu. Przez cały rok."
   - Sub-nagłówek: "Dobierz klimatyzator w 2 minuty. Poznaj szacunkową wycenę z montażem online i umów naszego eksperta na darmowy audyt."
   - Główny Przycisk CTA: "Odbierz darmową wycenę online". (Ten przycisk uruchomi nasz inteligentny lejek / Triage form).
   - UWAGA: Na tym etapie NIE projektuj elementów typu "Social Proof" (np. opinie, gwiazdki z Google, loga z social media), ponieważ firma dopiero startuje.

3. **Sekcja "Dlaczego My?" (Karty korzyści)**
   - Nagłówek: "Instalacja bez ukrytych kosztów."
   - Układ siatki 3 lub 4 kolumn (na mobile przewijane).
   - Karta 1: "Przejrzysta wycena" (Wycena online bez zobowiązań w 2 minuty).
   - Karta 2: "Autoryzowany Serwis" (Montaż zgodnie ze sztuką przez wykwalifikowanych inżynierów).
   - Karta 3: "Gwarancja do 5 lat" (Jesteśmy autoryzowanym partnerem marek Premium: Fuji Electric, Haier, itp.).
   - Karta 4: "Montaż w 1 dzień" (Minimalizujemy dyskomfort w Twoim domu).

4. **Sekcja Jak działamy? (Proces krok po kroku)**
   - Nagłówek: "Twoja droga do komfortu."
   - Krok 1 (Wizualizacja z ikoną telefonu/komputera): "1. Wyceniasz online". (Wypełniasz formularz i od razu widzisz zarys cen).
   - Krok 2 (Wizualizacja kalendarza): "2. Darmowy Audyt". (Nasz inżynier potwierdza warunki techniczne na miejscu).
   - Krok 3 (Wizualizacja narzędzi): "3. Profesjonalny Montaż". (Sprawna instalacja, uruchomienie i posprzątanie).

5. **Sekcja "Nasze Bestsellery" (Dynamiczny Katalog Produktów z Wyceną Montażu)**
   - UWAGA: Ta sekcja będzie docelowo zasilana dynamicznie z bazy danych (Supabase), więc zaprojektuj uniwersalny komponent "Karty Produktu".
   - Karta produktu powinna zawierać: 
     - Zdjęcie klimatyzatora na jasnym tle.
     - Logo producenta (np. Fuji Electric, Haier) oraz Kod Modelu.
     - Moc chłodniczą (np. 2.5 kW / 3.5 kW).
     - Najważniejszą część: **Wyraźną cenę Brutto** (która z tyłu w kodzie będzie obliczana jako *Cena Urządzenia Netto + Wzorcowy Montaż Netto + 8% VAT*).
     - Przycisk na karcie: "Wybierz ten model" (który kieruje od razu do formularza Triage z zapamiętanym modelem) lub "Darmowa wycena".
   - Zadbaj o to, by sekcja prezentowała asortyment przejrzyście w formie nowoczesnego grida (np. 3 lub 4 karty w rzędzie na desktopie, karuzela na mobile). Klient musi mieć poczucie, że przegląda konkretne, transparentne oferty gotowe do montażu.

6. **Sekcja "Call to Action" przed stopką (Finalne uderzenie)**
   - Duży banner wyróżniający się kolorem tła.
   - Tekst: "Gotowy na przyjemny chłód w upalne lato i energooszczędne ogrzewanie w zimę?"
   - (UWAGA dla AI/Designera: Klimatyzacja to pompa ciepła, która pobiera prąd. Nie używaj sformułowań typu "darmowe ogrzewanie" czy "zwraca się w pierwszą zimę", aby nie wprowadzać klienta w błąd. Skup się na oszczędności względem pieców elektrycznych, komforcie i szybkości dogrzewania).
   - Duży przycisk CTA: "Kliknij i oblicz koszty w 2 minuty".

7. **Footer (Stopka)**
   - Minimalistyczny design. Dane firmy, NIP, Adres e-mail, Numer telefonu, Linki do social mediów, Polityka Prywatności i Regulamin.

Wymagania responsywności: 
Zaprojektuj główny widok jako Desktop (1440px), ale pamiętaj, by układ był gotowy na łatwe zrolowanie w kolumnę dla ekranu Mobile (390px). Przycisk główny (CTA) na mobile powinien w Hero Section zajmować pełną szerokość ekranu.
