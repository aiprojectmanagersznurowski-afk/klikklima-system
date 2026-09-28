# WO: SEC-WEBHOOK-SECRET-REQUIRED — Fail-closed ochrona sekretów webhooków i zadań cron

Status: W toku. Data: 2026-09-28.
Domena: `security` (ryzyko: HIGH).

## Wymagania
- `SEC-WEBHOOK-SECRET-REQUIRED` (`contracts/requirements.contract.mjs:1046`, stan: zarejestrowany, brak okna kontraktowego)
- Powiązane: `NTF-DISPATCH-CRON` (wymóg kolejności: ochrona webhooków/crona przed uruchomieniem dispatchera SMS/Email), `FNL-E6-E7` (webhook kurierski T08).

## Kontekst i wada bezpieczeństwa (Fail-Open)
W dotychczasowym kodzie produkcyjnym znaleziono wadę bezpieczeństwa:
1. `apps/b2b-web/src/app/api/webhooks/services-cron/route.ts:14-16`:
   ```ts
   if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
     return NextResponse.json({ error: "Brak autoryzacji" }, { status: 401 })
   }
   ```
2. `apps/b2b-web/src/app/api/webhooks/shipping/route.ts:27-29`:
   ```ts
   if (expectedSecret && secretHeader !== expectedSecret) {
     return NextResponse.json({ error: "Brak autoryzacji webhooka" }, { status: 401 })
   }
   ```
Gdy zmienne środowiskowe `CRON_SECRET` lub `SHIPPING_WEBHOOK_SECRET` nie są ustawione w `.env` (lub są puste), warunek logiczny `secret && ...` jest fałszywy, przez co cała weryfikacja autoryzacji jest omijana! Każdy nieautoryzowany użytkownik internetu może wywołać cron serwisowy lub zmienić status przesyłki logistycznej.

Dodatkowo:
- Porównanie za pomocą `!==` jest podatne na ataki czasowe (timing attacks).
- Brak statycznego detektora sprawdzającego, czy nowe Route Handlery nie powielają tego antywzorca.

## Kryteria akceptacji
1. **Usunięcie fail-open**: wzorzec `if (secret && ...)` zostaje całkowicie wyeliminowany z obu tras.
2. **Fail-closed**: Brak skonfigurowanego sekretu w środowisku (`undefined`, `""`) oznacza bezwzględną odmowę 401.
3. **Zero skutków ubocznych**: Brak lub błędny nagłówek autoryzacji kończy się statusem 401 przed wykonaniem jakichkolwiek zapytań do bazy danych lub logiki biznesowej.
4. **Stałoczasowe porównanie**: Użycie `crypto.timingSafeEqual` przy porównywaniu tokenów i sekretów.
5. **Pełny zakres**: Naprawa obejmuje zarówno `services-cron`, jak i `shipping`.
6. **Skaner statyczny**: Test statyczny wykrywa w `src/app` obecność antywzorca fail-open lub brak walidacji sekretu w endpointach webhooks.
