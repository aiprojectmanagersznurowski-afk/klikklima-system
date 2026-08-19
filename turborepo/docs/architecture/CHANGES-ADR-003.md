# ADR-003 — wykaz zmian w dokumentach

Decyzja: **kanonem katalogu powiadomień jest `notification_definitions.md`**. Data: 2026-08-18.
Zmienione pliki: dwa (jeden z powodu ADR-003, drugi z powodu ADR-002).

---

## complaints_process.md — przenumerowanie

Odwzorowanie jeden do jednego. Treści powiadomień w obu dokumentach pokrywały się dokładnie, więc nie było wątpliwości, które jest którym:

| Było | Jest | Treść | Zgodność ze słownikiem |
|---|---|---|---|
| `N1` | `N15` | link do rezerwacji terminu wizyty serwisowej | „Twoje zgłoszenie zostało przyjęte. Zarezerwuj termin…" |
| `N2` | `N16` | przydzielono serwisanta do zgłoszenia | identyczna |
| `N3` | `N17` | serwisant w drodze (geolokalizacja, SMS) | identyczna |
| `N4` | `N18` | protokół zdawczo-odbiorczy + faktura pogwarancyjna | identyczna |

Pięć wystąpień w diagramie Mermaid, wszystkie przeniesione. Dodana nota u góry dokumentu wskazująca kanon, żeby ktoś czytający sam ten plik za pół roku nie odtworzył kolizji od nowa.

### Dlaczego to było groźne

`N1`–`N4` w kanonicznym słowniku należą do lejka sprzedażowego. Agent implementujący reklamacje według `complaints_process.md` podpiąłby pod zamknięcie naprawy szablon „Przydzielono audytora — będzie kontakt w celu umówienia terminu". Kod przeszedłby testy jednostkowe: identyfikator istnieje, szablon istnieje, wysyłka działa. Błąd zobaczyłby dopiero klient, po naprawie, w SMS-ie.

## notification_definitions.md — zmienne szablonów (ADR-002)

58 wystąpień zmiennych przetłumaczonych: `{{imie}}`→`{{first_name}}`, `{{numer_zlecenia}}`→`{{order_number}}`, `{{adres}}`→`{{address}}`, `{{godzina}}`→`{{time}}`, `{{data}}`→`{{date}}`. Treści szablonów pozostają po polsku — zmienia się nazwa zmiennej, nie komunikat.

Ten plik nie był objęty poprzednią turą ADR-002, bo skan szukał identyfikatorów bazy danych, a zmienne szablonów mają inną składnię. Wyszło przy okazji przenumerowania.

---

## Egzekwowanie

| Warstwa | Co robi |
|---|---|
| `R10-template-unique` w walidatorze | dwa powiadomienia nie mogą wskazywać na ten sam `templateKey` |
| `adr003-notif-literal` w `guard-forbidden` | blokuje `"N15"` jako goły string w `apps/**/*.ts(x)` — kod importuje z kontraktu |
| `adr002-template-var` w `guard-forbidden` | blokuje `{{imie}}` i pozostałe porzucone nazwy w `.ts/.tsx/.md/.html` |

Wyjątek: testy w `packages/contracts/**` mogą używać literałów, bo właśnie one sprawdzają zawartość katalogu.

Drugi wyjątek doszedł po tym, jak reguła `adr002-template-var` zablokowała ten dokument. Plik opisujący migrację musi zacytować starą nazwę — inaczej nie da się napisać zdania „było `{{imie}}`, jest `{{first_name}}`". Reguła nie umiała odróżnić użycia nazwy od jej udokumentowania, więc `NAMING.md`, `CHANGES-ADR-*` i sam rejestr ADR są z niej wyłączone. Warto o tym pamiętać przy dopisywaniu kolejnych reguł zakazujących: jeżeli zakaz obejmuje `.md`, prędzej czy później trafi we własną dokumentację.

Przetestowane w obie strony: trzy blokady zapalają się, import z kontraktu, `{{first_name}}` i literał w teście kontraktowym przechodzą.

## Co pozostaje otwarte

Katalog w kontrakcie ma trzy powiadomienia w statusie `PROPOSED` (`I5` push do audytora, `I6` alert o wygasających certyfikatach, `I7` push o usterce krytycznej) — to ADR-006, wciąż nierozstrzygnięty. Bez `I7` usterka krytyczna nie generuje żadnego powiadomienia, mimo że proces reklamacyjny opisany w tym dokumencie zakłada reakcję w 48 godzin.
