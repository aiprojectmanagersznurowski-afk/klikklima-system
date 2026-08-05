# Bezpieczeństwo Bazy Danych (Database Safety)

## Poziom surowości: Tylko operacje destrukcyjne wymagają zgody użytkownika.

### Operacje DOZWOLONE (autonomicznie, bez pytania)
- Dodawanie nowych kolumn (z wartościami domyślnymi).
- Dodawanie nowych tabel/modeli.
- Dodawanie indeksów.
- Dodawanie relacji (nowe FK).

### Operacje WYMAGAJĄCE ZGODY użytkownika
- Usuwanie kolumn lub tabel (`DROP`).
- Zmiana nazwy kolumny/tabeli.
- `prisma migrate reset` lub `prisma db push --force-reset`.
- Zmiana typu danych istniejącej kolumny (np. `String` → `Int`).
- Usuwanie relacji (FK).

### Obowiązkowe kroki przy każdej zmianie schematu
1. **ZAWSZE** przeczytaj aktualny `turborepo/packages/database/prisma/schema.prisma` przed zaproponowaniem zmian.
2. Porównaj obecny schemat z proponowanymi zmianami i opisz wpływ na istniejące dane.
3. Preferuj `ALTER TABLE ... RENAME COLUMN` nad `DROP + CREATE`.
4. Po każdej zmianie zaktualizuj `turborepo/docs/architecture/database_model.md` (diagram Mermaid + opis tabel).
5. Po modyfikacji schematu uruchom `npx prisma generate` aby odświeżyć klienta.
