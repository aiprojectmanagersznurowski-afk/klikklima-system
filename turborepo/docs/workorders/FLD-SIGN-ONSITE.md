# Work Order: FLD-SIGN-ONSITE (Etap 3 Field App)

## 1. Kontekst i cel
Wdrożenie mechanizmu podpisu elektronicznego klienta na miejscu (On-site) w aplikacji mobilnej montera i audytora (`apps/field-app`) wraz z pełnym backendem weryfikacyjnym (`apps/b2b-web`) i biblioteką domenową (`packages/signature`).

Zgodnie z wymaganiami:
- `FLD-SIGN-DOC-FREEZE`
- `FLD-SIGN-CAPTURE`
- `FLD-SIGN-AUDIT-TRAIL`
- `FLD-SIGN-TSA`

## 2. Kryteria akceptacji

### FLD-SIGN-DOC-FREEZE
1. Skrót kryptograficzny (SHA-256) dokumentu liczony jest PRZED pokazaniem go klientowi i zwracany w API.
2. Złożenie podpisu wymaga podania skrótu dokumentu; serwer weryfikuje, że skrót podany przez klienta jest identyczny ze skrótem zamrożonej treści dokumentu. Próba podpisania ze zmienioną treścią kończy się natychmiastową odmową (fail-closed).
3. Podpisany dokument jest niezmienny: modyfikacja treści dokumentu lub rekordu podpisu po podpisaniu jest zablokowana (wyzwalacze bazy danych `signatures_append_only_trg` i `installation_contracts_freeze_signed_trg`).
4. Wersja szablonu użyta do wygenerowania dokumentu jest zapisywana jako jawny łańcuch znaków (`template_version`, np. `v0.1-lorem` lub `v1.0`).

### FLD-SIGN-CAPTURE
1. Przechwycenie podpisu palcem na ekranie telefonu pracownika zapisuje obraz/dane wektorowe podpisu oraz dane techniczne zdarzenia (`captureMetadata`: moment zdarzenia, identyfikator urządzenia, tryb `ON_SITE`, agent).
2. Czyszczenie i ponawianie podpisu na urządzeniu nie tworzy wielu wpisów w bazie — rekord powstaje wyłącznie po zatwierdzeniu.
3. Tryb podpisu zapisywany jest jawnie jako `ON_SITE` lub `REMOTE`.
4. Podpis w trybie `ON_SITE` NIE wymaga kodu SMS OTP (w przeciwieństwie do trybu `REMOTE`).
5. Pusty podpis (brak śladu na ekranie, puste dane) jest odrzucany po stronie serwera kodem 400/błędem walidacji.

### FLD-SIGN-AUDIT-TRAIL
1. Rejestr podpisów `signatures` jest strictly append-only: próby `UPDATE` i `DELETE` są odrzucane przez wyzwalacz bazy `signatures_append_only_trg`.
2. W macierzy RBAC zasób `signatures` posiada `update: []` i `delete: []` dla wszystkich ról, włącznie z administratorem.
3. Każda operacja utworzenia podpisu rejestruje zdarzenie w `audit_log` z zasobem `signatures` i akcją `CREATE`.
4. Karta podpisu (kto podpisał, kiedy, jakim trybem, jaki skrót dokumentu i identyfikator zdarzenia) jest generowana i wiązana z dokumentem.

### FLD-SIGN-TSA
1. Podpis otrzymuje kwalifikowany znacznik czasu RFC 3161 (EuroCert), wiążący moment złożenia ze skrótem dokumentu `documentHash`.
2. Pola znacznika czasu (`tsa_timestamp_at`, `tsa_token`) w tabeli `signatures` są nullowalne z założenia, aby umożliwić składanie podpisów w trybie offline.
3. Baza danych wymusza parę znacznika czasu: `tsa_timestamp_at` i `tsa_token` muszą być oba wypełnione albo oba puste (`signatures_tsa_pair_check`).
4. Podpis złożony bez sieci może zostać uzupełniony o znacznik czasu TSA po powrocie zasięgu (jeden świadomy wyjątek w wyzwalaczu `signatures_append_only_trg`).
5. Awaria zewnętrznego dostawcy TSA nie blokuje zapisu podpisu ani nie wywraca procedury odbioru; brakujący znacznik jest kolejkowany do dostemplowania.
