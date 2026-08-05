# Workflow: /review — Audyt Jakości Kodu

## Wyzwalacz
Użytkownik wywołuje: `/review [ścieżka do pliku/katalogu lub opis]`

## Kroki

### 1. Skanowanie kodu
- Przeczytaj wskazane pliki lub przeskanuj cały katalog.
- Załaduj wszystkie reguły z `.agents/rules/`.

### 2. Checklist weryfikacyjny
Sprawdź każdy plik pod kątem:

| # | Reguła | Plik źródłowy |
|---|---|---|
| 1 | Walidacja Zod na inputach Server Actions | `code-quality.md` |
| 2 | Server Actions w osobnym `actions.ts` | `code-quality.md` |
| 3 | Typy Prisma zamiast ręcznych `as` | `code-quality.md` |
| 4 | Brak hardcoded secrets / tokenów | `security.md` |
| 5 | Komponenty Shadcn UI (nie custom) | `ui-consistency.md` |
| 6 | Ikony z `lucide-react` | `ui-consistency.md` |
| 7 | Tailwind tokeny kolorów (nie hex/rgb) | `ui-consistency.md` |
| 8 | Nazewnictwo plików PascalCase/kebab-case | `naming-conventions.md` |
| 9 | Aliasy importów (`@/...`) | `code-quality.md` |
| 10 | `"use client"` tylko gdy wymagany | `code-quality.md` |

### 3. Raport
Wygeneruj raport Markdown z listą znalezionych problemów, posortowanych wg priorytetu:
- 🔴 **Krytyczny** — Naruszenie bezpieczeństwa, wyciek danych, destrukcyjna zmiana w DB.
- 🟡 **Ostrzeżenie** — Niespójność z konwencjami, brak walidacji Zod, ręczne rzutowanie typów.
- 🟢 **Sugestia** — Drobne ulepszenia, brak JSDoc, optymalizacja.

### 4. Propozycje poprawek
Dla każdego problemu zaproponuj konkretną poprawkę kodu (diff).

### 5. Opcjonalna naprawa
Jeśli użytkownik potwierdzi, zastosuj poprawki automatycznie.
