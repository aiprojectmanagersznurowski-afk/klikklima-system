# Work Order: FLD-INSTALL-PATH (FLD-CHECKLIST-PREINSTALL, FLD-PHOTO-SET, FLD-HANDOVER-PROTOCOL)

**Status: ZAPLANOWANY (Etap 2 Field App: Ścieżka wykonawcza montera w terenie)**  
**Właściciel:** B8 `feat/field-app-install-path`  
**Wymagania:** `FLD-CHECKLIST-PREINSTALL`, `FLD-PHOTO-SET`, `FLD-HANDOVER-PROTOCOL`  
**Data:** 2026-09-26  

---

## 1. Cel biznesowy i architektoniczny

Dostarczenie pełnej ścieżki wykonawczej dla roli `monter` w aplikacji terenowej (`apps/field-app`) oraz w warstwie API (`apps/b2b-web/src/app/api/field/`):

1. **Checklista przedmontażowa (`FLD-CHECKLIST-PREINSTALL`)**:
   - Pozycje checklisty pochodzą ze słownika kontraktowego (`PREINSTALL_CHECKLIST_ITEMS`).
   - Każde odhaczenie rejestruje znacznik czasu (`checked_at`) i identyfikator pracownika (`worker_id`).
   - Checklista stanowi wskaźnik jakości (KPI), nie blokuje rozpoczęcia montażu, ale jej wynik jest trwale powiązany z instalacją i widoczny przy odbiorze.

2. **Zestaw zdjęć montażowych (`FLD-PHOTO-SET`)**:
   - Skład dynamiczny wg reguły **4 + 2n**:
     - **Część stała (4 zdjęcia):** jednostka zewnętrzna, tabliczka znamionowa jednostki zewnętrznej, odpływ skroplin, manometr próby próżni.
     - **Część zmienna (2 zdjęcia per jednostka wewnętrzna):** montaż jednostki wewnętrznej, tabliczka znamionowa jednostki wewnętrznej.
   - Wymagana liczba zdjęć jest wyliczana serwerowo na podstawie liczby jednostek w projekcie.
   - Zdjęcia są skategoryzowane wg słownika rodzajów zdjęć i powiązane z konkretną jednostką.

3. **Protokół zdawczo-odbiorczy (`FLD-HANDOVER-PROTOCOL`)**:
   - Wprowadzanie parametrów prób liczbowo (ciśnienie próby azotowej [bar], poziom próżni [mikrony / mbar], czas próby [min]).
   - Rejestracja numerów seryjnych i modeli per jednostka (z walidacją formatu numerów seryjnych).
   - Oznaczenie potwierdzenia przeprowadzenia instruktażu klienta.
   - Zapis z rejestracją klucza idempotencji pod `POST /api/field/jobs/own/[id]/handover`.
   - Zapewnienie struktury danych gotowej do zamrożenia i podpisu klienta (`FLD-SIGN-*`).

---

## 2. Kryteria akceptacji

### 2.1 FLD-CHECKLIST-PREINSTALL
- [ ] Pozycje checklisty pochodzą ze słownika, nie ze sztywnej listy wpisanej w UI.
- [ ] Zapis zawiera `checked_at` oraz `worker_id`.
- [ ] API `GET /api/field/jobs/own/[id]/checklist` zwraca stan checklisty dla zlecenia własnego.
- [ ] API `POST /api/field/jobs/own/[id]/checklist` aktualizuje pozycje z autoryzacją `can('installations:update')`.

### 2.2 FLD-PHOTO-SET
- [ ] Serwer wylicza wymagany komplet zdjęć: 4 stałe + 2 × liczba jednostek wewnętrznych.
- [ ] Walidacja uniemożliwia zatwierdzenie protokołu przy braku wymaganych kategorii zdjęć.
- [ ] Każde zdjęcie ma przypisany rodzaj (`kind`) oraz opcjonalny identyfikator jednostki (`unit_id`).

### 2.3 FLD-HANDOVER-PROTOCOL
- [ ] Parametry prób próżni i ciśnienia zapisywane są jako liczby (`vacuum_test_mbar`, `nitrogen_test_bar`, `test_duration_min`).
- [ ] Numery seryjne i modele przypisane są do poszczególnych jednostek.
- [ ] Walidacja odrzuca niekompletny protokół po stronie serwera.
- [ ] Zapis jest idempotentny (`Idempotency-Key`).

---

## 3. Pętla wykonawcza: RED -> GREEN -> VERIFY

1. **RED:**
   - Testy Route Handlerów: `apps/b2b-web/tests/field-api-install-path.test.ts`
   - Testy reguły 4+2n: `apps/b2b-web/tests/field-photo-set-rules.test.ts`
2. **GREEN:**
   - Implementacja domenowa w `apps/b2b-web/src/lib/domain/install-path.ts`
   - Route Handlery:
     - `GET /api/field/jobs/own/[id]/checklist`
     - `POST /api/field/jobs/own/[id]/checklist`
     - `POST /api/field/jobs/own/[id]/handover`
   - Ekrany w `apps/field-app`:
     - `ChecklistScreen.tsx`
     - `HandoverProtocolScreen.tsx`
3. **VERIFY:**
   - `npm run check-types`
   - `npm test`
   - `node tools/kk-authz-gate.mjs`
   - `node tools/kk-trace.mjs`
