---
name: notification-template
description: Tworzenie i weryfikacja szablonów powiadomień SMS/Email/Push KlikKlima na podstawie katalogu w contracts/notifications.contract.mjs. Używaj przy dodawaniu nowego powiadomienia, zmianie treści szablonu albo sprawdzaniu parzystości katalogu z bazą message_templates.
---

# Szablony powiadomień KlikKlima

Ten skill jest wywoływany przez `notification-architect` i przez główną sesję. Odwołuje się do `docs/architecture/notification_definitions.md` (rejestr biznesowy) oraz `contracts/notifications.contract.mjs` (kontrakt techniczny).

## Zanim napiszesz cokolwiek

1. Sprawdź, czy powiadomienie **istnieje w katalogu**. Jeżeli nie — to nie jest zadanie na szablon, tylko na zmianę kontraktu. Zatrzymaj się.
2. Odczytaj z katalogu: `channels`, `recipient`, `vars`, `templateKey`, `attachments`.
3. Sprawdź `status`. Powiadomienia `PROPOSED` nie wchodzą do implementacji przed decyzją człowieka.

## Reguły treści

**SMS** — do 160 znaków w jednym segmencie. Polskie znaki diakrytyczne przełączają kodowanie na UCS-2 i skracają segment do **70 znaków**. Policz to, zanim wyślesz: „Twoja wycena jest gotowa" (24 znaki ASCII) kontra ta sama treść z ogonkami to różnica między jednym a dwoma segmentami i podwójnym kosztem.

**Email** — temat do 60 znaków, treść z jasnym wezwaniem do działania. Załączniki wyłącznie te wymienione w polu `attachments` katalogu.

**Push** — tytuł do 40 znaków, treść do 100. Zawsze z `deep_link` do konkretnego rekordu, nie do listy.

**Wspólne:**
- Zwracamy się per „Ty", zgodnie z tonem istniejących szablonów.
- Każdy link musi być spersonalizowanym tokenem z ograniczonym czasem życia, nie surowym ID rekordu w URL-u.
- Żadnych danych osobowych w treści SMS poza imieniem.
- Każdy szablon ma wariant awaryjny na wypadek braku zmiennej (`{{first_name}}` puste → „Dzień dobry", nie „Dzień dobry !").
- Nazwy zmiennych są po angielsku, `snake_case` (ADR-002) — **treść szablonu pozostaje po polsku**. `Cześć {{first_name}}, Twoja wycena {{order_number}} jest gotowa.` Walidator ma regułę `R17-var-naming`.

## Walidacja szablonu

- Wszystkie zmienne użyte w treści występują w `vars` katalogu — i odwrotnie, żadna zmienna z `vars` nie jest niewykorzystana.
- `templateKey` jest unikalny w całej bazie (walidator ma regułę `R10-template-unique`).
- Treść dla kanału SMS mieści się w segmencie po uwzględnieniu diakrytyków.
- Szablon istnieje dla **każdego** kanału wymienionego w `channels`.

## Pułapka historyczna tego projektu

`complaints_process.md` numeruje powiadomienia reklamacyjne jako N1–N4, podczas gdy w kanonicznym słowniku N1–N4 to powiadomienia lejka sprzedażowego (reklamacje to N15–N18). Jeżeli pracujesz na podstawie diagramu z `complaints_process.md` — **zignoruj tamtejszą numerację** i użyj katalogu. Patrz ADR-003.
