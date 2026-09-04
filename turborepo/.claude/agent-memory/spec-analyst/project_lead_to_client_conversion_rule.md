---
name: lead-to-client-conversion-rule
description: ROZSTRZYGNIĘTE 2026-09-04 — Michał opisał zasadę "lead staje się klientem przy zakończonej instalacji", ale zdecydował nic nie zmieniać; obecny kontrakt B2C-LEAD-ATOMIC (klient przy wejściu leada) zostaje
metadata:
  type: project
---

Michał (2026-09-03): "gdy instalacja dla leada zostanie zrealizowana to lead automatycznie staje się klientem (na etapie zakończona instalacja wystawiana jest faktura i to jest zdarzenie gospodarcze kiedy lead zapisywany jest jako klient w systemie wraz z jego całym 360 otoczeniem (instalacje, historia, anulowane, zaplanowane, usterki, lead, adresy etc)".

**Rozjazd ze stanem faktycznym kodu (sprawdzone tego samego dnia):**
- `B2C-LEAD-ATOMIC` (kontrakt, `contracts/requirements.contract.mjs:367`) mówi wprost: "Lead, klient, adres i rezerwacja terminu audytu powstają w jednej transakcji" — czyli rekord `klienci` powstaje JUŻ przy wejściu leada z B2C Triage, nie przy zakończonej instalacji.
- `getCustomers()` (`apps/b2b-web/src/app/(dashboard)/customers/actions.ts`) listuje WSZYSTKIE rekordy `klienci` bez filtra po statusie instalacji — `/customers` pokazuje dziś każdego leada, nie tylko tych z zakończoną, opłaconą instalacją.
- W `schema.prisma` nie ma żadnego modelu faktury/invoice — "wystawienie faktury" jako zdarzenie gospodarcze nie jest dziś nigdzie reprezentowane.

**Why:** to nie jest drobna literówka do poprawienia w locie — to zmiana definicji "klienta" w całym systemie (kto trafia na listę `/customers`, kiedy Karta 360 w ogóle powinna istnieć, co się dzieje z rekordem `klienci` dla leadów, które NIE dojdą do zakończonej instalacji — SUPERSEDED z kontraktu `B2C-LEAD-ATOMIC` czy współistnienie dwóch znaczeń "klienta"?). Dotyka `contracts/requirements.contract.mjs` i prawdopodobnie `schema.prisma` (potrzebny może być np. `is_confirmed_customer`/`converted_at` zamiast obecnego założenia "klient = każdy lead").

**ROZSTRZYGNIĘTE (Michał, 2026-09-04): nic nie zmieniamy.** Dzisiejsze wymagania i kontrakty (`B2C-LEAD-ATOMIC` — klient powstaje przy wejściu leada) są uznane za poprawne. Opis "lead staje się klientem przy zakończonej instalacji" pozostaje kontekstem biznesowym/narracyjnym, nie specyfikacją do wdrożenia — nie planuj tej zmiany, chyba że Michał wprost otworzy temat ponownie.
