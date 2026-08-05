# Spójność UI/UX (UI Consistency)

## Źródło prawdy
- **ZAWSZE** przed tworzeniem lub modyfikowaniem komponentu UI przeczytaj `turborepo/docs/architecture/ui_ux_guidelines.md`.

## Biblioteka Komponentów
- Używaj WYŁĄCZNIE komponentów z **Shadcn UI**. Nie twórz własnych odpowiedników (Button, Dialog, Table, Card, Input itp.) jeśli Shadcn ma gotowy wariant.
- Jeśli potrzebujesz komponentu, którego Shadcn nie oferuje — najpierw sprawdź, czy da się go złożyć z istniejących komponentów Shadcn.

## Ikony
- WYŁĄCZNIE z `lucide-react`.
- Nie importuj Font Awesome, Heroicons, Material Icons ani inline SVG.

## Kolory i Tokeny
- Używaj tokenów z design systemu Shadcn (np. `text-primary`, `bg-muted`, `border-destructive`).
- **Nie hardcoduj** wartości hex, rgb ani hsl bezpośrednio w komponentach.
- Kolory brandowe zdefiniowane w `tailwind.config.ts` — tylko stamtąd je rozszerzaj.

## Spacing i Layout
- Tailwind utility classes (`p-4`, `gap-6`, `grid-cols-3`, `flex`).
- Nie pisz custom CSS, chyba że nie da się tego osiągnąć Tailwindem.
- Tabele muszą zajmować pełną szerokość kontenera (`w-full`).
- Sidebar musi być zwijany (collapsible).

## Formularze
- **ZAWSZE** `react-hook-form` + `@hookform/resolvers/zod` + `zod`.
- Nie używaj `useState` do ręcznego śledzenia poszczególnych pól formularza.
- Walidacja po stronie klienta (Zod schema) + po stronie serwera (Server Action).

## Responsywność
- Każdy nowy widok musi poprawnie działać na breakpointach: `sm:`, `md:` i `lg:`.
- Mobile-first: domyślne style dla małych ekranów, rozszerzaj na większe przez breakpointy.

## Animacje i Mikrointerakcje
- Używaj `framer-motion` dla złożonych animacji.
- Proste efekty hover: Tailwind `transition-all duration-200`.
- Każdy klikalny element musi mieć widoczny stan `:hover` i `:focus-visible`.
