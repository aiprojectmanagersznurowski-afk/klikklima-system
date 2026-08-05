# Reguły Bezpieczeństwa (Security)

## Sekrety i Dane Uwierzytelniające
- **NIGDY** nie hardcoduj kluczy API, tokenów, haseł ani connection stringów w kodzie źródłowym.
- Wszystkie sekrety czytaj z `process.env` (zmienne środowiskowe).
- **NIGDY** nie commituj plików `.env`, `.env.local`, `.env.production`. Sprawdź, czy `.gitignore` je wyklucza.

## Logowanie
- **NIGDY** nie loguj pełnych tokenów, haseł ani danych osobowych (PII) klientów do konsoli.
- W logach diagnostycznych maskuj wrażliwe wartości (np. `token: "***xyz"`).

## Ochrona Danych Osobowych (PII)
- Endpointy API zwracające dane osobowe (email, telefon, adres, PESEL) muszą być chronione middleware'em autoryzacyjnym.
- Nie zwracaj nadmiarowych danych — korzystaj z `select` w Prismie, aby ograniczyć pola do minimum.

## Tokeny OAuth
- Tokeny OAuth (`refresh_token`, np. Google Calendar) muszą być szyfrowane w bazie danych (nie plaintext).
- Tokeny dostępu (`access_token`) przechowuj WYŁĄCZNIE w pamięci serwera lub krótkotrwałych cookies `httpOnly`.

## Autoryzacja
- Każda Server Action musi weryfikować sesję użytkownika (np. Supabase Auth) przed wykonaniem operacji.
- Sprawdzaj rolę użytkownika (`Admin`, `Dyspozytor`, `Audytor`, `Monter`) przed udostępnieniem danych spoza jego uprawnienia.
