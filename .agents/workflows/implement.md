# Workflow: /implement — Pełny Cykl Wdrożenia Funkcjonalności

## Wyzwalacz
Użytkownik wywołuje: `/implement [opis feature'a]`

## Architektura Zespołu Sub-Agentów
Podczas egzekucji tego przepływu, model AI działa jako samoczynny zespól, odwołując się do wyspecjalizowanych profilów w `.agents/agents/`:
- **Analityk (Domain Expert)** — `.agents/agents/domain-expert.md` — pilnuje spójności z domeną B2B, B2C, Field App oraz słownikami procesów w kroku 1 i 2.
- **Strażnik Jakości (Plan Reviewer)** — `.agents/agents/plan-reviewer.md` — audytuje plan i uruchamia pętlę zwrotną (korekty bez udziału człowieka) w kroku 3.
- **Inżynier QA (QA Engineer)** — `.agents/agents/qa-engineer.md` — egzekwuje scenariusze BDD w Playwright i testuje regresję w kroku 5.

---

## Kroki Egzekucji

### 1. Analiza kontekstu i domeny (Sub-Agent: domain-expert)
- Odpowiedz na wyzwanie z użyciem profilu `.agents/agents/domain-expert.md`.
- Przeczytaj odpowiedni plik wymagań z `turborepo/docs/architecture/` w zależności od domeny:
  - B2B → `b2b_app_requirements.md` + `b2b_funnel_process.md` + `notification_definitions.md`
  - B2C → `b2c_app_requirements.md` + `triage_workflow.md`
  - Field App → `field_app_requirements.md`
- Przeczytaj wszystkie reguły z `.agents/rules/`.
- Sprawdź `schema.prisma` pod kątem modelu danych.

### 2. Plan implementacji (Developer + domain-expert)
- Stwórz `implementation_plan.md` z:
  - Opisem zmian pogrupowanym wg komponentów.
  - Listą plików do modyfikacji/utworzenia/usunięcia.
  - Szacowanym wpływem na bazę danych (uwaga na zasady bezkarny addytywności).
  - Planem weryfikacji.

### 3. Pętla Zwrotna Audytora (Sub-Agent: plan-reviewer)
- Odwołaj się do instrukcji z `.agents/agents/plan-reviewer.md` i zweryfikuj plan pod kątem reguł z `.agents/rules/`:
  - `database-safety.md` — Czy zmiany w bazie są addytywne czy destrukcyjne?
  - `code-quality.md` — Czy proponowany kod używa Server Actions, Zod, typów Prisma?
  - `security.md` — Czy nie ma hardcoded secrets?
  - `ui-consistency.md` — Czy UI korzysta z Shadcn/Tailwind/lucide?
  - `naming-conventions.md` — Czy nazewnictwo jest spójne?
- **Pętla samoczynna**: Jeśli `plan-reviewer` wykaże błąd lub niezgodność z regułą (stan 🟡 *REVISION NEEDED*), model natychmiast poprawia `implementation_plan.md` bez pytania użytkownika.
- **Wyjątek nadzoru**: Jeśli operacja jest destrukcyjna na bazie → **JEDYNY moment**, w którym pytaj użytkownika o zgodę przed przejściem dalej.
- Bez uzyskania wewnętrznego ✅ *APPROVED* nie wolno pisać kodu roboczego.

### 4. Implementacja (Developer)
- Wdróż zmiany krok po kroku w oparciu o zatwierdzony plan.
- Aktualizuj `task.md` na bieżąco (oznaczaj `[x]` po ukończeniu każdego kroku).

### 5. Walidacja i Regresja (Sub-Agent: qa-engineer)
- Uruchom `npm run build` w odpowiedniej aplikacji.
- Odwołaj się do profilu `.agents/agents/qa-engineer.md` i wygeneruj lub uruchom testy `npx playwright test` w oparciu o centralny rejestr w `turborepo/docs/testing/test_scenarios.md`.
- **Pętla regresji**: Jeśli jakikolwiek test nie przechodzi, wyhamuj i napraw wykreowane błędy w kodzie roboczym!

### 6. Dokumentacja i Podsumowanie
- Zaktualizuj odpowiednie pliki `turborepo/docs/` i oznaczenia BDD w `test_scenarios.md`.
- Stwórz/zaktualizuj `walkthrough.md` z podsumowaniem wykonanych prac.

### 7. Odbiór przez Użytkownika
- Użytkownik przegląda TYLKO gotowy raport w `walkthrough.md` z ewentualnym wynikiem testów.
