# ADR-013: warstwa zapisu aplikacji terenowej

> **Status: WYDANE 2026-09-24.** Aneks do ADR-001, patrz wpis w
> [01-ADR-spec-conflicts.md](../01-ADR-spec-conflicts.md).

## Kontekst

ADR-001 rozstrzyga, że mutacje w systemie idą przez **Server Actions z walidacją Zod**, a Route Handlery
są dopuszczone **wyłącznie dla publicznych webhooków**. Ta zasada powstała dla panelu B2B i landing page,
czyli dla aplikacji Next.js.

Decyzja D1 (2026-08-20, potwierdzona 2026-09-21) mówi, że aplikacja terenowa to **React Native + Expo**.
Server Actions są mechanizmem Next.js i **nie są wywoływalne z aplikacji natywnej**. Powstaje pytanie,
czego aplikacja ma używać do zapisu danych.

Sedno problemu nie jest techniczne, tylko dotyczy uprawnień: dziś **jedynym** miejscem, gdzie
sprawdzane są role, jest funkcja `can()` wołana w Server Action. Prisma łączy się jako rola omijająca
RLS, więc baza nie chroni panelu. Jeżeli aplikacja terenowa dostanie własną ścieżkę zapisu,
a z nią własne sprawdzanie uprawnień, powstaną **dwie niezależne implementacje tej samej macierzy** —
dokładnie ten rozjazd, któremu ma zapobiegać cała dyscyplina kontraktowa.

## Rozważane opcje

### (a) `supabase-js` bezpośrednio z urządzenia, ochrona przez RLS

Aplikacja łączy się z Supabase jak klient B2C i jest ograniczana politykami w bazie.

- **Za:** brak nowej warstwy serwerowej, działa offline-first z gotowymi bibliotekami.
- **Przeciw:** macierz uprawnień musiałaby istnieć **drugi raz**, zapisana w SQL. Każda zmiana roli
  wymagałaby zmiany w dwóch miejscach, a testy kontraktowe pilnują dziś tylko jednego. Logika domenowa
  (na przykład warunek „komplet zdjęć i podpis przed zamknięciem montażu") nie ma gdzie mieszkać.

### (b) Route Handlery współdzielące `can()` i Prismę — **wybrana**

Aplikacja woła endpointy HTTP wystawione przez panel B2B. Każdy endpoint: weryfikuje token, ustala rolę,
woła `can()`, a potem tę **samą funkcję domenową**, którą wywołuje Server Action panelu.

- **Za:** jedna implementacja uprawnień, jedna implementacja reguł biznesowych, testy kontraktowe bez zmian.
- **Przeciw:** formalny wyjątek od ADR-001, nowa powierzchnia ataku, ręczna obsługa uwierzytelnienia.

## Decyzja

**Wybieramy (b).** Zapis z aplikacji terenowej odbywa się przez Route Handlery w `apps/b2b-web`, które
są cienką warstwą nad funkcjami domenowymi, a nie miejscem na logikę.

Warunki, bez których ta decyzja nie obowiązuje:

1. **Route Handler nie zawiera logiki biznesowej.** Jego zadanie to: odczytać token, ustalić aktora,
   sprawdzić `can()`, zwalidować wejście przez Zod i wywołać funkcję domenową. Ta sama funkcja musi być
   wywoływalna z Server Action panelu.
2. **Uwierzytelnienie przez token Supabase Auth w nagłówku**, weryfikowany przy każdym żądaniu. Blokada
   konta (`is_active`) działa natychmiast, tak jak w `middleware.ts` panelu (`FLD-AUTH-BLOCKED`).
3. **Każdy zapis z urządzenia niesie klucz idempotencji.** Telefon traci zasięg w trakcie żądania
   i ponawia je; ponowienie nie może utworzyć drugiego zdjęcia, drugiego protokołu ani drugiego
   powiadomienia.
4. **Klucz `service_role` nigdy nie trafia do aplikacji.** Aplikacja nie ma dostępu do bazy inaczej
   niż przez te endpointy.
5. **Każdy endpoint ma test kontraktowy uprawnień** — dla roli spoza macierzy odpowiedź to odmowa,
   a nie pusty wynik.
6. **Wyjątek jest zamknięty.** ADR-013 dotyczy wyłącznie aplikacji terenowej i publicznej strony podpisu
   zdalnego. Panel B2B dalej używa Server Actions i to się nie zmienia.

## Konsekwencje

- Powstaje nowe wymaganie `FLD-API-LAYER` obejmujące punkty 1–5.
- Publiczna strona podpisu zdalnego (bez logowania) jest osobnym przypadkiem: działa poza macierzą ról
  i ma własne zabezpieczenia (`FLD-SIGN-ABUSE-GUARD`).
- ADR-001 zyskuje wyjątek, który trzeba opisać w tabeli decyzji, inaczej `guard-forbidden` i recenzje
  będą zgłaszać Route Handlery jako naruszenie.
- Jeżeli w przyszłości aplikacja terenowa wróciłaby do PWA, ta decyzja wygasa, bo Server Actions
  stają się znowu dostępne.
