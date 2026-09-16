---
name: fld-quote-basket-select-refused-dead-helpers
description: 2026-09-16 odmowa domknięcia FLD-QUOTE-BASKET-SELECT — dwa z trzech eksportów basket-select.ts nie mają konsumenta, testy dowodzą martwego kodu
metadata:
  type: project
---

`FLD-QUOTE-BASKET-SELECT` zostaje na `TODO` po weryfikacji 2026-09-16 (okno `FLD-QUOTE-BASKET-CLOSE`). Commity `dab0363` (RED) i `033c8cd` (GREEN) na `feat/crm-suite-complete` zostają bez zmiany kontraktu. Przebieg testów zweryfikowany samodzielnie: 3 pliki, **39** przypadków zielonych (zlecający mówił o 40).

Dwie luki, obie tej samej klasy — **test celuje w funkcję, której ekran nie woła**:

1. **AC2 (identyfikator, nie nazwa).** `buildCreateBookingPayload` ma ZERO konsumentów w `apps/*/src` — dialog konstruuje payload w `onSubmit` wprost. Żadna asercja nie dotyka `<option value={basket.id}>`, czyli dosłownej treści AC2. Podmiana na `value={basket.code}` przechodzi cały dzisiejszy zestaw.
2. **AC1 część druga (wycena historyczna pokazuje etykietę koszyka wycofanego).** `findBasketById` ma ZERO konsumentów, a w repozytorium NIE ISTNIEJE żaden widok szczegółu rezerwacji — `find apps/b2b-web/src/app -path "*booking*"` zwraca wyłącznie `bookings/actions.ts` i sam dialog. WO ma to kryterium jawnie w zakresie (AC3 WO), nie w „Poza zakresem".

Poboczne, nieblokujące: dialog nie renderuje `durationMinutes` w ogóle, więc WO AC5 („ekran pokazuje NOWĄ wartość") jest spełnione tylko negatywnie (brak literału), nie pozytywnie.

**Why:** to powtórka dokładnie tego powodu, dla którego ten wpis w ogóle wyniesiono z `CAL-VISIT-DURATION-BASKETS` — tam nośnik był gotowy, a ekranu nie było. Domknięcie na martwych helperach przywróciłoby ten sam fałsz jedno piętro wyżej. Patrz [[feedback_mock_cannot_prove_db_constraint]] w wariancie UI: podmiotem kryterium jest EKRAN.

**How to apply:** przy następnym podejściu wystarczy (a) asercja statyczna `value={basket.id}` albo wpięcie `buildCreateBookingPayload` w `onSubmit`, oraz (b) rozstrzygnięcie, czy widok szczegółu rezerwacji powstaje teraz, czy AC1 część druga idzie do osobnego ID wzorcem z [[feedback_closing_requirement_with_residual_debt]]. Nie kasować kryterium.
