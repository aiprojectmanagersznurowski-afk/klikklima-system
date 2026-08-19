---
name: known-red-e2e-booking-validation
description: booking-validation.spec.ts jest świadomie czerwony i należy do WO B2C-BOOKING-VALIDATION, nie do zmian, w których diffie się pojawia
metadata:
  type: project
---

`apps/b2c-web/e2e/booking-validation.spec.ts` był czerwony **przed** WO `B2C-TRIAGE-DISQUALIFY` i pozostaje czerwony po nim. Etap 3 CI (`pnpm test:e2e` w `.github/workflows/kk-gate.yml`) jest z tego powodu czerwony niezależnie od recenzowanej zmiany.

Przyczyna resztkowa (stan na 2026-08-19): test wypełnia `input[name="zipCode"]` i `input[name="city"]`, których `Step8Booking.tsx` nie ma, oraz oczekuje komunikatów walidacyjnych w brzmieniu, którego formularz nie produkuje. Pola w `Step8Booking` mają `id=`, nie `name=` (poza `address`).

**Why:** naprawa należy do osobnego wymagania `B2C-BOOKING-VALIDATION`. W ramach `B2C-TRIAGE-DISQUALIFY` naprawiono wyłącznie martwe locatory sekcji „Fast path" (etykieta „Wykończony", nagłówek „Wybierz termin darmowej wyceny", selektor dnia) — reszta świadomie nietknięta, żeby nie rozlewać zakresu.

**How to apply:** jeżeli w recenzji zobaczysz czerwony `booking-validation.spec.ts` albo częściową zmianę w tym pliku, nie kwalifikuj tego jako regresji recenzowanego WO. Sprawdź tylko, czy zmiana nie pogłębia problemu. Werdykt o czerwieni E2E wydawaj dopiero po ustaleniu, czy padają testy z zakresu recenzowanego WO, czy wyłącznie ten plik.
