# ADR-011 — wykaz zmian

Decyzja: **każdy próg czasowy ma nazwaną politykę w kontrakcie; literały zakazane w kodzie aplikacji**. Data: 2026-08-18.

Problem wyjściowy: cztery różne mechanizmy nazywane „SLA" — dni do montażu, godziny od zgłoszenia, godzina dnia i okno przypomnień. Nazwa nie mówiła nic o tym, co jest mierzone, więc próg z jednego widoku dawał się bezrefleksyjnie skopiować do drugiego.

---

## contracts/sla.contract.mjs — osiem nazwanych polityk

| Polityka | Co mierzy | Wartość |
|---|---|---|
| `LOGISTICS_INSTALL` | dni do montażu, pasma kolorów | < 3 czerwony, 3–7 bursztynowy, zakaz zieleni |
| `INCIDENT_RESPONSE` | godziny od zgłoszenia bez akcji | 48 h |
| `QUOTE_VALIDITY` | ważność wyceny | 14 dni |
| `COLD_LEAD_REPRICE` | po ilu dniach w bucketcie wymagane odświeżenie ceny | 30 dni |
| `SERVICE_REMINDER_LEAD` | wyprzedzenie przypomnienia serwisowego | 30 dni |
| `CERT_EXPIRY_WARNING` | wyprzedzenie alertu o certyfikatach | 30 dni |
| `AUDITOR_DAILY_CAP` | limit audytów na dzień | 5 |
| `INSTALL_DAY_ALERT` | godzina podświetlenia niezakończonej instalacji | 16:00 |

Trzy z nich to „30 dni" i to jest właśnie powód, dla którego mają osobne nazwy: gdy kiedyś zmieni się wyprzedzenie przypomnienia serwisowego, nie ma ryzyka, że przy okazji przesunie się alert o certyfikatach.

## Ostrzeżenie zamienione na blokadę

Reguła `magic-sla` miała wcześniej `severity: 'warn'` — agent widział komunikat i pisał dalej. Skoro polityka jest rozstrzygnięta, próg wpisany z palca nie jest sugestią do rozważenia, tylko błędem. Reguła blokuje zapis i została rozbita na trzy, bo próg da się zaszyć na trzy różne sposoby:

| Reguła | Co łapie |
|---|---|
| `magic-sla` | `differenceInDays(...) < 3`, `hoursSince(...) >= 48` i pokrewne porównania z literałem |
| `magic-sla-hour` | `getHours() >= 16` — godzina alertu instalacyjnego |
| `magic-sla-days` | `48 * 60 * 60`, `14 * 24 * 60` — okres przeliczany z liczb |

Wyjątek: `packages/contracts/` — tam literały są definicją, nie kopią.

## Nowa reguła walidatora `R21-sla-shape`

Pilnuje, żeby „SLA" znaczyło coś konkretnego. Każda polityka musi:

- deklarować **dokładnie jeden** kształt pomiaru (`bands`, `days`, `count` albo `hourOfDay`) — polityka mierząca dwie rzeczy naraz to znowu ten sam problem, tylko schowany o poziom głębiej;
- mieć opisany `scope`, żeby dało się powiedzieć, czego dotyczy;
- wskazywać wymaganie w `req` — próg, którego nikt nie żądał, nie ma jak zostać przetestowany;
- używać priorytetów wyłącznie ze zbioru `INCIDENT_PRIORITIES`.

## Zaległość po ADR-002 wykryta przy okazji

`INCIDENT_RESPONSE` odwoływał się do priorytetów `KRYTYCZNY` i `SREDNI` — wartości przemianowanych w ADR-002 na `CRITICAL` i `MEDIUM`. Zegar 48 godzin nie zapaliłby się dla żadnej usterki, bo porównywałby się z napisami, których w bazie już nie ma. Cicha awaria: żadnego błędu, żadnego wyjątku, po prostu wiersze nigdy nie robiące się czerwone.

Poprawione. `R21` porównuje teraz priorytety ze zbiorem `INCIDENT_PRIORITIES`, więc powtórka nie przejdzie przez bramkę.

Mutacja w `kk-selftest` podmienia `CRITICAL` z powrotem na `KRYTYCZNY` i sprawdza, czy bramka się zapala. Zapala się.

---

## Co pozostaje otwarte

**Strefa czasowa progów godzinowych.** `INSTALL_DAY_ALERT.hourOfDay = 16` zakłada czas lokalny, a `QUEUE_POLICY` deklaruje `Europe/Warsaw`. Jeżeli baza pracuje w UTC, przeliczenie musi się dziać w jednym miejscu — to samo pytanie zostało otwarte w ADR-007 dla okna wysyłki SMS i najlepiej rozstrzygnąć oba razem.

**Dni robocze kontra kalendarzowe.** Wszystkie progi dniowe liczą dni kalendarzowe. Przy `LOGISTICS_INSTALL` oznacza to, że montaż w poniedziałek zgłoszony w piątek pokazuje trzy dni, choć roboczy jest jeden. Jeżeli logistyka pracuje w dniach roboczych, potrzebny jest kalendarz świąt — to zmiana w metryce, nie w progu.

**Brak terminu na rezerwację etapu II** montażu dwuetapowego (ADR-005). To kolejny termin, którego nikt nie pilnuje, i naturalnie należy do tego zestawu polityk — ale wymaga najpierw decyzji biznesowej, ile czasu klient ma na zamówienie drugiego etapu.
