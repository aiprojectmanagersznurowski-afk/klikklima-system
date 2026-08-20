# WO: SERVICE-ROLE-LEADS-PAGE — klucz serwisowy tworzony ad-hoc w komponencie strony leada

Typ: **znalezisko bezpieczeństwa / refaktoryzacja server-side**. Nie jest to nowa funkcjonalność —
zachowanie widoczne dla użytkownika ma pozostać identyczne.

## Wymagania

- `SEC-SERVICE-KEY-SERVER-ONLY` (risk: HIGH, źródło `system_architecture.md#3`) — „Klucz serwisowy
  Supabase nigdy nie trafia do bundla klienckiego."
- `B2C-RLS-PUBLIC` — cytowany wyłącznie jako **precedens kształtu**: „klucz serwisowy występuje
  wyłącznie w Server Actions". Dotyczy B2C, nie B2B, ale ustala intencję: klucz serwisowy żyje
  w wąskim module server-only, nie w komponencie renderującym stronę.

Znalezisko jest **przedistniejące** (commit `b4a04cc`), nie jest regresją żadnego bieżącego WO.
Ujawniło się dopiero teraz, bo skaner przerywał na wcześniejszym naruszeniu `as-any` w tym samym pliku.

## Kontekst kodu

Sprawdzone Grepem, stan na 2026-08-20.

**Istnieje:**
- `apps/b2b-web/src/app/(dashboard)/leads/[id]/page.tsx` — Server Component (brak `"use client"`,
  `export const dynamic = "force-dynamic"`). Linie ~97–125: dynamiczny `await import("@supabase/supabase-js")`,
  `createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)`, jedno zbiorcze
  `storage.from("audytorzy").createSignedUrls(auditorPaths, 60 * 60)`, złożenie mapy `path -> signedUrl`
  i domapowanie `avatarUrl` do listy audytorów.
- Pula audytorów pochodzi z `getAuditors()` importowanego z `../actions` (czyli
  `leads/actions.ts` — wariant filtrowany po `is_active: true`), **nie** z `auditors/actions.ts`
  (ten świadomie zwraca wszystkich, łącznie z zablokowanymi — patrz `auditors-delete.test.ts`
  i komentarz D1/BLOCKER 4 w tym pliku).
- `apps/b2b-web/src/utils/supabase/` — `client.ts`, `server.ts` (`createClient()` na cookies + anon,
  `getCurrentActorRole()`), `middleware.ts`. To jest istniejące, ustalone miejsce na klientów Supabase w B2B.
- `apps/b2b-web/src/lib/utils.ts` — jedyny plik w `lib/`.
- Reguła `service-key` w `tools/kk.config.mjs`: `re: 'SUPABASE_SERVICE_ROLE_KEY|service_role'`,
  `appliesTo: "(app|components|hooks)/.*\\.(tsx)$"`. Bez baseline, zerowa tolerancja.

**Brakuje:**
- Jakiegokolwiek współdzielonego modułu admin-clienta w `apps/b2b-web`. **Precedensu w B2B nie ma** —
  sprawdzone: jedyne wystąpienia `SUPABASE_SERVICE_ROLE_KEY` w B2B to dwa komponenty stron
  (`leads/[id]/page.tsx` i `crews/page.tsx`), oba tworzą klienta ad-hoc. Odpowiedź na pytanie 2
  z zadania brzmi: **nie ma z czego skorzystać, moduł trzeba utworzyć**.
  (W `apps/b2c-web/lib/supabaseClient.ts` istnieje moduł, ale to inna aplikacja i **zły wzorzec do
  skopiowania**: `SUPABASE_SERVICE_ROLE_KEY || NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_key'`
  cicho degraduje uprawnienia zamiast zawieść. Nie powielać.)
- Pakietu `server-only` w `apps/b2b-web/package.json` (sprawdzone) — patrz Ryzyka.
- Testu jednostkowego na generowanie podpisanych URL-i (`apps/b2b-web/tests/` nie zawiera żadnego).

## Zmiana kontraktu

**NIEWYMAGANA.** Brak zmian w `contracts/`, `schema.prisma`, `supabase/migrations/`.
Nie zmienia się maszyna stanów, katalog powiadomień, RBAC ani model danych.
`SEC-SERVICE-KEY-SERVER-ONLY` już istnieje w rejestrze i pokrywa to zachowanie — nie trzeba go dopisywać.

## Rozstrzygnięcie kształtu: moduł server-only, nie Server Action

Zadanie proponowało Server Action w `leads/actions.ts` lub `auditors/actions.ts`. **Rekomendacja
odbiega** i wymaga uzasadnienia, bo to nie jest kosmetyka:

1. Każdy eksport z pliku `"use server"` staje się **endpointem RPC osiągalnym po sieci**. Zamiana
   prywatnego helpera na Server Action publikuje generator podpisanych URL-i do bucketa `audytorzy`
   jako wywoływalny endpoint. Bez własnego sprawdzenia roli (Prisma omija RLS — pułapka #1 z CLAUDE.md)
   byłoby to **poszerzenie** promienia rażenia, a celem WO jest jego zwężenie.
2. ADR-001 przypisuje Server Actions do **mutacji**, a pobieranie danych do **Server Components**.
   To jest odczyt w trakcie renderu strony — helper wołany z RSC jest tu wzorcem zgodnym z ADR-001,
   Server Action byłaby od niego odstępstwem.

Dlatego: **zwykły moduł `.ts` oznaczony `import "server-only"`**, wołany bezpośrednio z Server Componentu.
Nie umieszczamy go w `leads/actions.ts` ani `auditors/actions.ts` — oba mają `"use server"` na górze pliku.

## Plan plików

| Plik | Rola | Agent |
|---|---|---|
| `apps/b2b-web/src/utils/supabase/admin.ts` | **nowy.** `import "server-only"`; `createAdminClient()` zwracający klienta na `SUPABASE_SERVICE_ROLE_KEY`. Rzuca jawnym błędem, gdy zmienna nieustawiona — **bez fallbacku na klucz anonimowy**. Sąsiaduje z istniejącymi `client.ts` / `server.ts`. | `implementer-server` |
| `apps/b2b-web/src/lib/storage/signed-urls.ts` | **nowy.** `import "server-only"`; `signStoragePaths(bucket: string, paths: string[], expiresInSeconds: number): Promise<Record<string, string>>`. Dokładnie jedno `createSignedUrls` na wywołanie; `paths: []` → `{}` bez żadnego zapytania sieciowego; wpisy z `error` pomijane. Parametryzowany bucketem, żeby `crews/page.tsx` mógł go użyć w osobnym WO bez przepisywania. | `implementer-server` |
| `apps/b2b-web/src/app/(dashboard)/leads/[id]/page.tsx` | **modyfikacja.** Usunąć `await import("@supabase/supabase-js")` i `createClient(...)`. Wołać `signStoragePaths("audytorzy", auditorPaths, 60 * 60)`. Pozostała logika (`auditorsWithAvatars`, JSX) bez zmian. | `implementer-server` |
| `apps/b2b-web/tests/storage-signed-urls.test.ts` | **nowy.** Test jednostkowy na `signStoragePaths` z mockiem `@supabase/supabase-js` (styl `vi.hoisted` + `vi.mock`, jak w `leads-auditor-pool.test.ts`). | `test-author` |

`implementer-ui` nie jest potrzebny — JSX ani żaden komponent kliencki nie są dotykane.

## Kryteria akceptacji (wykonalne)

- [ ] **AC1:** `node tools/kk-precommit-scan.mjs "apps/b2b-web/src/app/(dashboard)/leads/[id]/page.tsx"`
      kończy się kodem 0, **bez dopisywania jakiegokolwiek wyjątku, `allowIn` ani zmiany reguły
      `service-key` w `tools/kk.config.mjs`**. Zmiana bramki zamiast kodu jest odrzuceniem tego WO.
- [ ] **AC2:** `grep -rn "SUPABASE_SERVICE_ROLE_KEY\|service_role" apps/b2b-web/src` zwraca wyłącznie
      trafienie w `src/utils/supabase/admin.ts` (oraz — do czasu osobnego WO — w `crews/page.tsx`,
      patrz „Poza zakresem"). Żadnego trafienia w plikach `.tsx` pod `app/`, `components/`, `hooks/`
      poza `crews/page.tsx`.
- [ ] **AC3:** Strona `/leads/[id]` renderuje awatary audytorów tak samo jak dziś: audytor z ustawionym
      `zdjecie_url` dostaje `avatarUrl` będący podpisanym URL-em, audytor bez zdjęcia dostaje `null`.
      Żaden audytor nie znika z listy wyboru z powodu tej zmiany.
- [ ] **AC4:** Renderowanie strony wykonuje **dokładnie jedno** wywołanie `storage.createSignedUrls`
      niezależnie od liczby audytorów (brak N+1). Weryfikowalne testem: mock storage z listą N ścieżek →
      `createSignedUrls` wywołany raz, z tablicą długości N.
- [ ] **AC5:** Gdy żaden audytor nie ma zdjęcia (pusta tablica ścieżek), `createSignedUrls` **nie jest
      wywoływany ani razu**, a strona renderuje się bez błędu (zachowanie dzisiejszego `if (paths.length > 0)`).
- [ ] **AC6:** Częściowa awaria storage nie wywraca strony: gdy `createSignedUrls` zwraca mieszankę
      wpisów udanych i wpisów z `error`, audytorzy z udanym podpisem mają `avatarUrl`, pozostali mają
      `null`, a strona nadal się renderuje.
- [ ] **AC7:** Próba zaimportowania nowych modułów z komponentu klienckiego kończy się **błędem builda**,
      a nie cichym wejściem klucza do bundla (efekt `import "server-only"`).
- [ ] **AC8:** `bash scripts/verify.sh --full` przechodzi; brak nowych naruszeń `kk-naming --check-baseline`
      (nowy kod nie wprowadza nowych polskich identyfikatorów — `zdjecie_url` jest tylko odczytywane
      z istniejącego modelu, nie deklarowane na nowo).

## Przypadki brzegowe, które MUSZĄ mieć test

- **Pusta lista ścieżek** — zero zapytań do storage (AC5). Regresja typu „wywołujemy z `[]`" jest cicha
  i kosztuje round-trip na każdy render.
- **Częściowa awaria** — część `data[i].error` ustawiona (AC6).
- **`data === null`** (całkowita awaria storage / brak uprawnień do bucketa) — funkcja zwraca `{}`,
  strona renderuje się z `avatarUrl: null`, nie rzuca.
- **Duplikaty ścieżek** — dwóch audytorów z tym samym `zdjecie_url`: obaj dostają URL, mapa nie gubi wpisu.
- **Brak `SUPABASE_SERVICE_ROLE_KEY` w środowisku** — `createAdminClient()` rzuca jawnym błędem.
  Test ma potwierdzić, że **nie** następuje cichy fallback na klucz anonimowy (błąd `apps/b2c-web/lib/supabaseClient.ts`).
- **Brak N+1** przy N > 1 audytorach (AC4).

Bez testu (nietestowalne jednostkowo, weryfikacja przez przegląd i AC7): faktyczna nieobecność klucza w bundlu.

## Poza zakresem

- **`apps/b2b-web/src/app/(dashboard)/crews/page.tsx`** — zawiera **identyczne** naruszenie (ten sam
  wzorzec, bucket `zespoly`). Dziś skaner raportuje tam `as-any`, który maskuje `service-key` dokładnie
  tak, jak maskował go w pliku leada. **Świadomie nie wciągam go do tego WO** (zadanie zawężone do strony
  leada), ale `signStoragePaths` jest parametryzowany bucketem właśnie po to, żeby osobne WO było
  wymianą pięciu linii. **Rekomendacja: otworzyć WO `SERVICE-ROLE-CREWS-PAGE` natychmiast po tym** —
  do jego zamknięcia AC2 dopuszcza tam trafienie.
- Zmiana nazw bucketów storage (`audytorzy`, `zespoly`) na angielskie. ADR-002 mówi o tabelach, kolumnach
  i enumach; buckety nie są nim objęte, a przemianowanie wymaga migracji obiektów w storage.
- Rotacja klucza serwisowego. Klucz nie wyciekł do bundla (plik był server-only), więc rotacja nie jest
  wymuszona tym znaleziskiem.
- Uszczelnianie RLS na bucketach storage / rezygnacja z klucza serwisowego na rzecz podpisywania rolą
  użytkownika. To realne pytanie, ale osobne — patrz Ryzyka.
- Refaktoryzacja `apps/b2c-web/lib/supabaseClient.ts`, mimo że ma gorszy wzorzec (fallback na anon).
- Poprawianie `as-any` w `crews/page.tsx`.
- Skan zbudowanego bundla w CI (drugie kryterium z `SEC-SERVICE-KEY-SERVER-ONLY`) — brakuje go w repo,
  ale to zadanie na poziomie pipeline'u, nie tego pliku.

## Ryzyka i nieznane

1. **Reguła `service-key` dotyczy tylko `.tsx`.** Przeniesienie kodu do `.ts` samo w sobie ucisza skaner,
   niezależnie od tego, czy cokolwiek stało się bezpieczniejsze. **AC1 nie jest więc dowodem
   bezpieczeństwa, tylko warunkiem koniecznym** — dowodem jest izolacja (`server-only`, AC7) i to,
   że powstaje jedno miejsce z kluczem zamiast N. Reviewer nie powinien przyjąć „skaner zielony"
   jako jedynego argumentu.
2. **`server-only` nie jest zależnością `apps/b2b-web`** (sprawdzone w `package.json`). Trzeba ją dodać.
   Jeżeli dodanie zależności wymaga osobnej zgody, wariant zapasowy to zachowanie umowne (moduł pod
   `utils/supabase/` wołany wyłącznie z RSC) — ale wtedy **AC7 jest niespełnialne** i ochroną zostaje
   sam skaner, czyli słabsza gwarancja. Preferowane: dodać zależność.
3. **Czy klucz serwisowy jest tu w ogóle potrzebny?** Podpisywanie URL-i dałoby się zrobić klientem
   na sesji użytkownika (`utils/supabase/server.ts`), gdyby polityki RLS na bucketach `audytorzy`
   i `zespoly` pozwalały rolom panelu czytać te obiekty. Nie sprawdzałem polityk storage — nie ma ich
   w repo w formie, którą mógłbym odczytać. To nie blokuje tego WO (nie zmieniamy uprawnień, tylko
   izolujemy kod), ale jest **właściwym docelowym rozwiązaniem** i zasługuje na osobne rozpoznanie.
4. **Czas życia podpisu 3600 s** jest literałem w kodzie od początku. Nie jest progiem SLA
   (nie ma go w `contracts/sla.contract.mjs`), więc pułapka #5 z CLAUDE.md nie ma tu zastosowania.
   Zostawiam jako parametr funkcji z dzisiejszą wartością u wywołującego. Nie jest to zmiana zachowania.
5. **Nie ma sprzeczności między dokumentami źródłowymi w tym zakresie.** ADR-001, reguła `service-key`
   i `SEC-SERVICE-KEY-SERVER-ONLY` mówią to samo. Brak pozycji `WYMAGA DECYZJI`.
