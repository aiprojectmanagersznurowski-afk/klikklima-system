# Wytyczne UI/UX i Design System (KlikKlima Guidelines)

Ten dokument stanowi **jednoźródłową bazę prawdy (Source of Truth)** dla wszystkich programistów i subagentów AI pracujących nad interfejsami w ekosystemie KlikKlima (aplikacja B2C Triage, Panel Administracyjny B2B, Field App). Każdą nowo tworzona sekcja, strona lub komponent musi rygorystycznie przestrzegać poniższej specyfikacji graficznej i architektonicznej.

---

## 1. Stos Technologiczny i Konfiguracja UI
- **Framework:** Next.js (App Router, Server Actions / React Query dla Optimistic UI)
- **Styling:** Tailwind CSS v4 (zmienne CSS oraz `@theme inline` zdefiniowane w `globals.css`)
- **Biblioteka Komponentów:** Shadcn UI + Radix UI (dla Headless primitives)
- **Ikony:** WYŁĄCZNIE `lucide-react` (zabronione jest używanie FontAwesome, Heroicons czy SVG inline)
- **Zarządzanie stanem i formularzami:** `react-hook-form` + `@hookform/resolvers/zod` + `zod`, dla stanu globalnego (np. kroki Triage): `Zustand`

---

## 2. Paleta Kolorów i Tokeny Systemowe

System wykorzystuje wyrazistą, chłodną paletę kolorów nawiązującą do branży HVAC (czystość, powiew chłodnego powietrza, profesjonalizm technologiczny). **Zabronione jest hardcodowanie wartości Hex/RGB w komponentach** — należy korzystać z tokenów Tailwind CSS.

| Token Tailwind | Zmienna CSS / Hex | Nazwa / Kolor | Kiedy i jak stosować |
| :--- | :--- | :--- | :--- |
| `bg-primary`, `text-primary` | `#1750c8` | **KlikKlima Royal Blue** | **Kolor główny brandu**. Przeznaczony dla głównych przycisków (CTA), obramowań wybranych opcji w kalkulatorze, wskaźników aktywnego kroku i focusingu. |
| `bg-accent`, `text-accent` | `#38b6e8` | **HVAC Ice Cyan** | Kolor wspierający, akcentujący elementy chłodzenia, etykiety propozycji, subtelne podświetlenia tła. |
| `bg-background` | `#f7f8fc` | **Soft Icy White** | Domyślne tło całego portalu i aplikacji. Bardzo jasny, chłodny odcień złamanej bieli z niebieską nutą. |
| `bg-card`, `bg-popover` | `#ffffff` | **Pure White** | Tło kart produktów, modali, dialogów i paneli. Zapewnia czysty kontrast z tłem `background`. |
| `text-foreground` | `#0d1b2e` | **Deep Slate / Navy** | Domyślny kolor tekstu i nagłówków. Ciemny, głęboki odcień granatu — *nigdy nie używaj czystej czerni (`#000000`)*. |
| `text-muted-foreground` | `#5a6782` | **Cool Steel Gray** | Teksty drugorzędne, podtytuły, etykiety nad polami input, opisy w kartach opcji. |
| `bg-secondary` | `#eef2fb` | **Soft Blue Tint** | Tło drugorzędne dla kart, tło pól formularzy (inputów), etykiety badge i statusy nieaktywne. |
| `bg-destructive` | `#d4183d` | **Alert Red** | Komunikaty błędów z walidacji Zod, przyciski usunięcia, alerty SLA w logistyce (< 3 dni). |
| `border-border` | `rgba(13,27,46,0.09)`| **Ultra-light Navy Ring**| Subtelne obramowania kart, linii odgradzających, tabel i modali. Zapewnia lekkość interfejsu. |

---

## 3. Typografia i Fonty

Podstawowym krojem pisma dla całego ekosystemu jest **Plus Jakarta Sans** (importowany z Google Fonts za pomocą `@next/font/google` i przypisywany do klas Tailwind jako `font-sans`).

### Skala nagłówków i tekstu (Typo Hierarchy)
- **Domyślna wielkość czcionki:** 16px (`--font-size: 16px`), line-height: `1.5`.
- **Waga czcionki:**
  - `font-normal` (`400`) — teksty długie, wpisywane wartości w inputach.
  - `font-medium` (`500`) — etykiety pól (labels), przyciski (buttons), nagłówki (`h1`–`h4`), krótkie opisy w kartach.
  - `font-semibold` (`600`) — tytuły wybranych kart, wyróżnione ceny.
  - `font-bold` (`700`) — wyłącznie główne nagłówki sekcji (Hero section, tytuły kroków w Triage: `text-3xl sm:text-4xl font-bold tracking-tight`).
- **Font techniczny / monospacja (`font-mono`):**
  - Stosować przy identyfikatorach urządzeń (modele), numerach seryjnych, Tracking ID kurierów oraz numerach zlecenia (np. `text-sm font-semibold text-foreground font-mono tracking-tight`).
- **Etykiety pre-title / nadtytuły:**
  - Style: `text-xs text-muted-foreground font-medium uppercase tracking-wider`.
  - Użycie: oznaczenia marki (np. "DAIKIN", "AUX"), kategoria zlecenia lub etykiety nad kartami.

---

## 4. Estetyka Komponentów, Zaokrąglenia (Radii) i Cienie

Wygląd aplikacji musi wywoływać wrażenie produktu **Premium High-Tech**. Unikamy przestarzałych kanciastych układów i nudnych jednolitych prostokątów.

### Zaokrąglenia narożników
- **Bazowe `--radius`: 1rem (`16px`)**.
- **Karty (Cards, OptionCards, Modale, Dialogi):** `rounded-2xl` (`16px`).
- **Przyciski i pola input (Buttons, Select, Inputs):** `rounded-md` (`14px` / `calc(var(--radius) - 2px)`).
- **Badge / Pigułki statyczne:** `rounded-full` z paddingiem `px-3 py-1` (np. tagi Bestseller, ikony statusów).

### Glassmorphism i wykończenie powierzchni (Surfaces)
- **Karty interaktywne (np. wyboru kroku Triage):**
  - Stan domyślny (nieaktywny): Tło półprzezroczyste `bg-white/70 backdrop-blur-sm border-2 border-border shadow-sm hover:border-primary/40 hover:shadow-md`.
  - Stan wybrany (aktywny): Pełna biel z obramowaniem `border-primary shadow-[0_8px_30px_rgb(10,77,140,0.12)] bg-white`.
- **Karty produktowe (Bestsellery / Katalog):**
  - Obramowanie: `bg-card rounded-2xl border border-border overflow-hidden`.
  - Elewacja przy hoverze: `transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_20px_60px_-12px_rgba(23,80,200,0.15)]`.
  - Tła pod zdjęciami urządzeń: Chłodna pastelowa biel-blekit `bg-[#f0f4fb]`. Zdjęcie przy hoverze powiększa się: `transition-transform duration-500 group-hover:scale-105`.

---

## 5. Animacje i Mikrointerakcje

 Dynamiczne reakcje interfejsu budują zaufanie i uczucie „żywości" aplikacji.

### Framer Motion (Dla komponentów interaktywnych)
- **Hover & Tap na kartach wyborów i przyciskach customowych:**
  ```tsx
  <motion.button
    whileHover={{ scale: 1.02, y: -2 }}
    whileTap={{ scale: 0.98 }}
    transition={{ duration: 0.2 }}
    className="..."
  >
  ```
- **Przejścia kroków w formularzach (Step Transitions):**
  - Używamy animacji sprężystości (Spring physics) przy poziomym przesuwaniu ekranu (slajdowanie zależne od kierunku w przód/tył):
  ```tsx
  transition={{ x: { type: "spring", stiffness: 300, damping: 30 }, opacity: { duration: 0.3 } }}
  ```
- **Wskaźniki wyboru (np. znacznik Check po kliknięciu karty):**
  - Pojawianie się „z punktu": `initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}` nad kartą (`-top-3 -right-3 w-8 h-8 bg-primary rounded-full`).

### Tailwind CSS Transitions (Dla elementów klasycznych / Shadcn)
- Domyślna animacja najechania na każdy element klikowalny: `transition-all duration-200` (lub `duration-300`).
- Nigdy nie zostawiaj interaktywnych elementów (np. wierszy tabeli, przycisków menu) bez widocznego stanu `:hover` i `:focus-visible`.

---

## 6. Układ Tabel i Panelu B2B (Data Presentation & CRM)

- **Tabele Zgłoszeń i Logistyki:**
  - Tabele muszą zajmować 100% dostępnej szerokości (`w-full overflow-x-auto`).
  - Nagłówki kolumn: `text-xs uppercase font-semibold text-muted-foreground tracking-wider bg-secondary/50 p-3`.
  - Wiersze tabeli przy hoverze: `hover:bg-secondary/30 transition-colors`.
- **Kolorowanie SLA w Logistyce:**
  - Wiersze krytyczne (< 3 dni do montażu): lewy border lub delikatne tło z tokenu alertu: `border-l-4 border-destructive bg-destructive/5`.
  - Wiersze pilne (3–7 dni do montażu): `border-l-4 border-amber-500 bg-amber-500/5`.
  - *Zabronione jest kolorowanie na zielono wierszy bez opóźnień.*
- **Sidebar (Pasek boczny B2B):**
  - Musi być zwijany (collapsible) w celu oszczędności miejsca na mniejszych ekranach laptopowych (`md:`, `lg:`). Tło: `bg-sidebar` (`#ffffff`), border oddzielający: `border-r border-border`.

---

## 7. Formularze i Pola Wprowadzania (Input & Validation)

- **Standard pól tekstowych:**
  - Tło inputu musi być wyraźne od tła formularza: `bg-secondary` / `bg-input-background` (`#eef2fb`) z delikatnym zaokrągleniem `rounded-md h-10 px-3 py-2 text-base font-normal`.
  - Focus Ring: Po kliknięciu w pole pojawia się obramowanie z koloru głównego: `focus-visible:ring-[3px] focus-visible:ring-ring/50 outline-none`.
- **Walidacja błędów:**
  - Przy błędzie walidacji Zod pole otrzymuje czerwoną ramkę `aria-invalid:border-destructive aria-invalid:ring-destructive/20`.
  - Tekst błędu pod polem: `text-sm text-destructive font-medium mt-1`.

---

## 8. 🚨 Krytyczna Lista Sprawdzeniowa dla Subagentów AI (AI Checklist)

Przed wdrożeniem jakiejkolwiek modyfikacji w UI przez subagenta, agent zobowiązany jest zweryfikować poniższy katalog zasad:

1. [ ] **Czy nie użyliśmy hardcodowanych kolorów w stylu `#000000`, `#333333`, `#1a73e8`?** -> Jeśli tak, natychmiast zamień na klasy `text-foreground`, `text-muted-foreground`, `bg-primary` lub `bg-secondary`.
2. [ ] **Czy użyto wyłącznie ikon z biblioteki `lucide-react`?** -> Sprawdź importy na początku pliku.
3. [ ] **Czy wszystkie przyciski i komponenty interaktywne bazują na primitives ze `Shadcn UI` lub mają wyraziste stany `:hover`, `:focus-visible`, `:disabled`?**
4. [ ] **Czy w formularzu zastosowano wyłącznie `react-hook-form` spięte z szematem walidacyjnym `Zod`?** -> Zakaz tworzenia ręcznych stanów `useState` do przetrzymywania wartości z pojedynczych inputów tekstowych.
5. [ ] **Czy układ jest w pełni responsywny?** -> Upewnij się, że fonty w nagłówkach używają skali mobilnej i desktopowej (np. `text-2xl sm:text-3xl`), a tabele nie rozrywają widoku (posiadają kontener ze skrollowaniem).
6. [ ] **Czy karty i modale posiadają nowoczesne zaokrąglenia i wykończenie?** -> Sprawdź czy zastosowano `rounded-2xl`, subtelny obwód `border border-border` i cienie (np. `shadow-sm` z podwyższeniem przy hoverze).
7. [ ] **Czy w logistyce SLA uwzględniono wyłącznie kolory czerwony (🔴) i pomarańczowy (🟠)?** -> Upewnij się, że brak w interfejsie zielonych alertów SLA.
