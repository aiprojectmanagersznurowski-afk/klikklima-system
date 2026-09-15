---
name: coverage-may-sit-under-sibling-req-tag
description: Brak testu przy danym @REQ nie znaczy braku pokrycia — przeczytaj asercje testów rodzeństwa, zanim zablokujesz domknięcie
metadata:
  type: feedback
---

Zanim uznasz kryterium za niepokryte, sprawdź, czy dowodzący je test nie jest otagowany `@REQ` identyfikatorem RODZEŃSTWA. Szukaj po TREŚCI zachowania (grep po pojęciu domenowym, np. „bufor"), nie po samym identyfikatorze.

**Why:** Przy domykaniu `CAL-TRAVEL-BUFFER` (2026-09-15) plik `scheduling-config-travel-buffer.test.ts` nie miał ani TC-T2, ani TC-T4 — wyglądało to na trzy niepokryte kryteria (AC2, AC3, AC4) i powód do zatrzymania. Faktycznie cała „grupa T" w `apps/b2b-web/tests/available-slots-engine-a-b-t-c-s-e.test.ts` (AC-T1..AC-T6 plus przypadek graniczny) celuje w te kryteria dosłownie — z buforem per osoba, odmową z wyniku silnika zamiast wyjątku bazy i przestawieniem konfiguracji 60 -> 30 jako dowodem, że granica pochodzi z konfiguracji, a nie z liczby w teście. Testy były otagowane `CAL-SLOT-ENGINE`, bo to silnik je wykonuje. To dług EWIDENCYJNY (brak drugiego tagu), nie dług pokrycia.

**How to apply:** Podział pracy w tym repo idzie po WŁAŚCICIELU KODU (panel ustawia wartość, silnik ją stosuje), a tagi `@REQ` idą za plikiem testowym — więc wpisy o dwóch właścicielach mają pokrycie rozsypane po dwóch plikach z różnymi tagami. Domknij, ale nazwij dług tagów w `note` wprost i przypomnij, że dopisanie drugiego `@REQ` należy do test-author, nie do stewarda ([[steward-cannot-write-tests]]). Uwaga na granicę z [[scope-mismatch-check-other-owner]]: to działa, gdy rodzeństwo jest ZAMKNIĘTE i samo wskazuje na ten wpis (AC1 `CAL-SLOT-ENGINE` wprost wylicza bufor „(CAL-TRAVEL-BUFFER)"). Kryterium wiszące przy innym OTWARTYM ID dalej blokuje.
