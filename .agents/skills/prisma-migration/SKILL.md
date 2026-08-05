---
name: prisma-migration
description: >-
  Standaryzuje procedurę bezpiecznej zmiany schematu bazy danych PostgreSQL 
  przez Prisma ORM. Obejmuje analizę wpływu, migrację, generowanie klienta 
  i aktualizację dokumentacji ERD.
---

# Prisma Migration (Bezpieczna Migracja Bazy)

## Kiedy używać
Aktywuj ten skill za każdym razem, gdy zadanie wymaga modyfikacji modelu danych (dodanie tabeli, kolumny, relacji, zmiana typu itp.).

## Procedura

### 1. Analiza obecnego stanu
- Przeczytaj aktualny plik `turborepo/packages/database/prisma/schema.prisma`.
- Przeczytaj `turborepo/docs/architecture/database_model.md` (diagram ERD i opis tabel).
- Zidentyfikuj, które modele/kolumny będą dotknięte zmianą.

### 2. Klasyfikacja zmiany
- **Addytywna** (dodawanie kolumn, tabel, indeksów): Można wykonać autonomicznie.
- **Destrukcyjna** (usuwanie, zmiana nazwy, zmiana typu): Wymaga wyraźnej zgody użytkownika. Opisz wpływ na istniejące dane.

### 3. Modyfikacja schematu
- Edytuj `schema.prisma` z zachowaniem konwencji nazewnictwa z `.agents/rules/naming-conventions.md`.
- Dla nowych kolumn: zawsze dodawaj wartość domyślną lub oznacz jako opcjonalne (`?`), aby uniknąć błędów na istniejących danych.

### 4. Synchronizacja z bazą
- Środowisko deweloperskie: `npx dotenv-cli -e ../../.env -- npx prisma db push`
- Produkcja: `npx dotenv-cli -e ../../.env -- npx prisma migrate dev --name <opis_zmiany>`
- Katalog roboczy: `turborepo/packages/database/`

### 5. Regeneracja klienta Prisma
- Uruchom: `npx prisma generate` w katalogu `turborepo/packages/database/`.

### 6. Aktualizacja dokumentacji
- Zaktualizuj diagram Mermaid w `turborepo/docs/architecture/database_model.md`.
- Dodaj nowe tabele do sekcji opisu tabel.
- Upewnij się, że relacje w diagramie ERD odzwierciedlają nowe FK.
