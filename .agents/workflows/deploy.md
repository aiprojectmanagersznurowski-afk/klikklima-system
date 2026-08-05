# Workflow: /deploy — Wdrożenie na Vercel (przez GitHub)

## Wyzwalacz
Użytkownik wywołuje: `/deploy`

## Kontekst
CI/CD jest już skonfigurowane: push do GitHub automatycznie wyzwala deploy na Vercel.
Ten workflow koordynuje proces po stronie dewelopera — nie zastępuje pipeline'a.

## Kroki

### 1. Weryfikacja builda
- Uruchom `npm run build` w odpowiedniej aplikacji (np. `turborepo/apps/b2b-web/`).
- Jeśli build nie przechodzi → napraw błędy przed kontynuowaniem.

### 2. Weryfikacja Prisma
- Uruchom `npx prisma generate` w `turborepo/packages/database/`.
- Upewnij się, że klient Prisma jest aktualny względem schematu.

### 3. Sprawdzenie Git
- Uruchom `git status` i `git diff --stat`.
- Jeśli są niescommitowane zmiany:
  - Zaproponuj commit message opisujący zmiany.
  - Wykonaj `git add .` i `git commit -m "<opis>"`.

### 4. Push do GitHub
- Wykonaj `git push origin <branch>`.
- Vercel automatycznie uruchomi build i deploy.

### 5. Podsumowanie
- Zaktualizuj `walkthrough.md` z informacją o deployu:
  - Branch, commit hash, opis zmian.
  - Link do Vercel deployment (jeśli dostępny).

### 6. Testy regresji (opcjonalnie)
- Jeśli istnieją scenariusze testowe w `turborepo/docs/testing/test_scenarios.md`:
  - Uruchom `npx playwright test` na URL produkcyjny/preview.
