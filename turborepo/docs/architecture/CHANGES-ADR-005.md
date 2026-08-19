# ADR-005 — wykaz zmian

Decyzja: **montaż dwuetapowy jest w zakresie**, wyłącznie dla mieszkań w stanie deweloperskim. Data: 2026-08-18.

---

## Przebieg procesu

| Krok | Co się dzieje | Ślad w systemie |
|---|---|---|
| 1 | Klient w Triage zaznacza stan deweloperski | `leads.declared_property_condition = DEVELOPER_SHELL` |
| 2 | Audytor na miejscu potwierdza tryb dwuetapowy | `quotes.installation_type = TWO_PHASE` |
| 3 | Klient akceptuje wycenę i rezerwuje etap I | `installation_phases` (phase_no 1) + `bookings` |
| 4 | Ekipa przygotowuje instalację w mieszkaniu surowym | `T17 completePhaseOne` |
| 5 | Klient dostaje fakturę za etap I i link do rezerwacji etapu II | `N8a` z załącznikiem `invoice_phase_1` |
| 6 | Po wykończeniu — montaż jednostek, zamknięcie | `T09 completeInstallation`, guard `allPhasesCompleted` |

## contracts/funnel.contract.mjs

- **`T17 completePhaseOne`**: `AWAITING_INSTALLATION → AWAITING_INSTALLATION`, guardy `installationIsTwoPhase` + `phaseOneNotCompleted`, efekty `N8a`, `do:issuePhaseOneInvoice`, `do:openPhaseTwoBooking`.
- **`T09`** dostało guard `allPhasesCompleted` — montaż nie może się zamknąć, dopóki któryś etap jest otwarty.
- Trzy nowe guardy: `installationIsTwoPhase`, `phaseOneNotCompleted`, `allPhasesCompleted`.

Maszyna stanów ma 17 przejść.

## contracts/notifications.contract.mjs

`N8a` z `PROPOSED` na `STABLE`, powiązanie zmienione z luźnego zdarzenia domenowego na przejście `T17`, dodany załącznik `invoice_phase_1` i zmienna `order_number`.

## database_model.md

**Nowa tabela `installation_phases`** — a nie pole `phase` w `installations`. Etapy dzieli często kilka miesięcy, mogą je realizować różne ekipy, każdy ma własną rezerwację, protokół i (etap I) fakturę. Pole tego nie udźwignie.

| Tabela | Zmiana |
|---|---|
| `leads` | + `declared_property_condition` (`FINISHED` / `DEVELOPER_SHELL`) |
| `quotes` | + `installation_type` (`SINGLE_PHASE` / `TWO_PHASE`) |
| `installations` | + `installation_type`, zmieniony opis `next_service_date` |

## contracts/requirements.contract.mjs

Nowe: `FNL-2PHASE`, `FNL-2PHASE-BOOKING`, `FNL-2PHASE-INVOICE`. Uzupełnione: `SRV-NEXT-DATE`. Rejestr ma 54 wymagania.

---

## Dwie decyzje projektowe warte uzasadnienia

**Deklaracja klienta nie decyduje o trybie montażu.** Rozdzieliłem to na dwa pola, bo klient może zaznaczyć stan deweloperski w mieszkaniu gotowym albo pominąć zaznaczenie w mieszkaniu surowym. Wiążące jest ustalenie audytora po oględzinach. Gdyby był to jeden checkbox, ekipa jechałaby na etap I do mieszkania, w którym nie ma czego przygotowywać — albo na jednoetapowy montaż do surowych ścian.

**Pętla własna zamiast dziewiątego etapu.** Po zamknięciu etapu I lead nadal jest w `AWAITING_INSTALLATION`, bo nadal oczekuje instalacji — zmienia się faza, nie etap lejka. Dodanie dziewiątego etapu wymagałoby przerobienia filtrów w panelu B2B, enuma `LeadStatus` i wszystkich dokumentów mówiących o ośmiu etapach, dla trybu dotyczącego mniejszości zleceń.

Koszt tego wyboru: dyspozytor nie odróżni w tabeli „czeka na etap I" od „czeka na etap II" po samym statusie leada — musi spojrzeć na kartę instalacji. Jeżeli okaże się to uciążliwe w codziennej pracy, tańszym rozwiązaniem niż nowy etap jest kolumna wyliczana w widoku listy, pokazująca numer otwartego etapu.

## Nowa reguła bramki

**`R19-self-loop-guard`**: przejście z `from === to` musi mieć co najmniej jeden guard. Pętla własna bez warunku, który kiedyś przestaje być prawdziwy, pozwala zamykać etap I w nieskończoność — za każdym razem wystawiając fakturę i wysyłając klientowi e-mail. Mutacja w `kk-selftest` usuwa guardy z `T17` i sprawdza, czy bramka się zapala. Zapala się. Reguł jest 18.

## Co pozostaje otwarte

**Kto płaci za etap I, jeżeli klient nie zamówi etapu II.** Faktura za etap I wychodzi po jego zakończeniu, ale system nie ma dziś limitu czasu na rezerwację etapu II ani ścieżki dla porzuconego montażu dwuetapowego. Instalacja zostanie w `AWAITING_INSTALLATION` bezterminowo. Warto rozstrzygnąć razem z ADR-011, gdzie porządkujesz mechanizmy SLA — to jest kolejny termin, którego nikt nie pilnuje.

**Gwarancja i protokół.** `N8` (zamknięcie montażu) ma w załącznikach kartę gwarancyjną i protokół zdawczo-odbiorczy. Dla montażu dwuetapowego protokół etapu I jest osobnym dokumentem (`installation_phases.protocol_document_id`), ale nie rozstrzygnięto, czy gwarancja biegnie od etapu I, czy II. Prawdopodobnie od II — tak jak `next_service_date` — ale to pytanie do warunków gwarancji, nie do schematu.
