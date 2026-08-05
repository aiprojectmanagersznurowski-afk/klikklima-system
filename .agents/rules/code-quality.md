# Standardy Jakości Kodu (Code Quality)

## Importy
- Używaj aliasów ścieżek (`@/components/...`, `@/lib/...`). Nigdy ścieżek względnych z `../../..`.

## Server vs Client Components
- Komponent jest **Server Component domyślnie**. 
- `"use client"` dodawaj TYLKO gdy potrzebujesz hooków React (`useState`, `useEffect`, `onClick`, `onChange`).
- Nigdy nie dodawaj `"use client"` do pliku `page.tsx` — użyj osobnego komponentu klienta.

## Server Actions (Mutacje)
- Każda mutacja danych (tworzenie, aktualizowanie, usuwanie) musi przechodzić przez **Server Action** w pliku `actions.ts` w katalogu danej strony.
- Nigdy nie pisz logiki mutacji bezpośrednio w komponentach.
- Server Actions zwracają `{ success: boolean, error?: string, data?: T }` zamiast rzucać wyjątki.

## Walidacja
- Każdy input do Server Action musi być walidowany schematem **Zod** PRZED dotykiem Prismy.
- Schematy Zod definiuj w osobnym pliku `schemas.ts` lub bezpośrednio w `actions.ts`.

## Typy
- Używaj typów generowanych przez Prismę (`Prisma.XxxGetPayload<...>`).
- Nie rzutuj ręcznie przez `as`.
- Nie twórz duplikatów interfejsów, które Prisma już generuje.

## Komentarze i Dokumentacja
- Zachowuj wszystkie istniejące komentarze i docstringi, które nie dotyczą Twoich zmian.
- Dodawaj JSDoc do wszystkich eksportowanych funkcji, typów i komponentów.

## Error Handling
- Server Actions: `try/catch` z logowaniem do `console.error` i zwróceniem obiektu `{ success: false, error: message }`.
- Komponenty klienckie: użyj `toast` (Shadcn) do wyświetlania błędów użytkownikowi.
