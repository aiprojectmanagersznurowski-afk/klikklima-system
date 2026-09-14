---
name: migration-both-run-orders
description: Migracja musi działać w OBU porządkach uruchomienia (świeży replay wg nazw plików i ręczne uruchomienie poza kolejnością na produkcji) — poprawka pod jeden porządek psuje drugi
metadata:
  type: feedback
---

Poprawiając odwołanie do obiektu, którego nazwa zmienia się w innej migracji, zawsze rozstrzygnij OBA porządki uruchomienia, nie ten, który akurat masz przed oczami:
- (A) świeży replay od zera — CI `supabase start`, nowa instalacja: migracje idą po NAZWACH PLIKÓW/timestampach;
- (B) produkcja — migracja mogła zostać uruchomiona RĘCZNIE, poza kolejnością (tak było z `20260910101000` rename promienia audytora, puszczonym przed wcześniejszym timestampowo `20260910100000`).

**Why:** 2026-09-15 CI (uruchomienie 34576559098) padło na `42703 column "promien_dzialania_km" does not exist`. Wcześniejsza poprawka (okno CAL-FOUNDATION-STALE-COLREF-FIX) przepisała sekcję 6 na NOWĄ nazwę kolumny, bo taki był stan PRODUKCJI — i tym samym rozwaliła świeży replay, gdzie w tej chwili kolumna nosi jeszcze starą nazwę. Jedna poprawka, dwa wzajemnie wykluczające się stany, statyczny SQL obsłuży tylko jeden.

**How to apply:** jeżeli nazwa obiektu nie jest znana statycznie w chwili pisania pliku, NIE pisz statycznego `COMMENT ON COLUMN` / `ALTER` na konkretną nazwę. Rozstrzygnij ją w czasie uruchomienia: `DO $$ ... SELECT column_name FROM information_schema.columns WHERE ... IN ('nowa','stara') ... EXECUTE format('... public.tabela.%I IS %L', kol, tresc) ... END $$;`, z gałęzią ELSE, która loguje `RAISE NOTICE` zamiast wywracać replay. Treść przejściowa ma uczciwie mówić „docelowo <nowa nazwa> po migracji X" — i tak zostanie nadpisana przez COMMENT z migracji renamującej. Sprawdź też plik-partnera w drugą stronę: `101000` jest odporny, bo sam robi RENAME w osłoniętym bloku PRZED komentowaniem, więc we własnym kontekście zawsze zna nazwę. Stan końcowy po obu migracjach musi być w obu porządkach identyczny. Kontekst modelu promieniowego: [[calendar-foundation-radius-model]], [[auditor-radius-rename]].
