# WO: FLD-FOUNDATION — faza 0 Field App (indeks, nie zadanie)

**Ten plik nie jest Work Orderem do wykonania.** Zakres fazy 0 (osiem pozycji, cztery role, trzy różne
artefakty: kontrakt, schemat bazy, narzędzia bramki, kod aplikacji) nie mieści się w jednej pętli.
Precedens: `CRM-SAFE-RECORD-ACTIONS` — 4 wymagania, 28 kryteriów akceptacji — zużył wszystkie trzy
iteracje GREEN i trzy rundy REVIEW. Faza 0 jest większa i dodatkowo zawiera dwie nierozstrzygnięte
decyzje projektowe, więc jeden WO skończyłby się zatrzymaniem na limicie iteracji w połowie zakresu.

Poniżej podział na cztery Work Ordery, w wymuszonej kolejności.

## Kolejność i zależności

```
WO-A  FLD-CONTRACT-BASE      ← START. Nic innego nie ruszy przed nim.
        │
        ├── WO-B  FLD-AVAILABILITY-SPLIT   (WYMAGA DECYZJI D-A — nie startować)
        ├── WO-C  FLD-CONSENT-DOCS         (WYMAGA DECYZJI D-C, D-D — nie startować)
        └── WO-D  B2C-LEAD-GEO-PERSIST     (gotowy do startu razem z WO-A lub po nim)
```

| WO | Plik | Rola wiodąca | Okno kontraktowe | Blokada |
|---|---|---|---|---|
| A | `docs/workorders/FLD-CONTRACT-BASE.md` | `contract-steward` | **TAK** (`contracts/`, `tools/`) | — |
| B | `docs/workorders/FLD-AVAILABILITY-SPLIT.md` | `contract-steward` | **TAK** (`contracts/`, `schema.prisma`, `supabase/migrations/`) | decyzja **D-A** |
| C | `docs/workorders/FLD-CONSENT-DOCS.md` | `contract-steward` | **TAK** (`contracts/`, `schema.prisma`, `supabase/migrations/`) | decyzje **D-C**, **D-D** |
| D | `docs/workorders/B2C-LEAD-GEO-PERSIST.md` | `test-author` → `implementer-server` | NIE | wymaganie `FLD-GEO-COORDS` z WO-A |

## Dlaczego taki podział

1. **WO-A jest niepodzielny od wewnątrz.** Wymuszona kolejność (`R12-req-refs`, `R21-sla-shape`) sprawia,
   że rejestr wymagań, próg SLA i rozszerzenie `MEASURES` nie mają legalnego stanu pośredniego — muszą
   wejść jako jedna zmiana kontraktu. Zwężenie `CRM-AUDYT-AC1` dotyka tego samego pliku i tego samego
   okna, więc dołączenie go nie kosztuje nic; rozdzielenie kosztowałoby drugie okno kontraktowe.
2. **WO-B i WO-C to zmiany schematu**, nie kontraktu tekstowego: migracje, ograniczenia w bazie, wiersze
   w macierzy RBAC. Inny profil ryzyka (nieodwracalność), inny zestaw testów, obie czekają na decyzję.
3. **WO-D to jedyny kod aplikacyjny w tej fazie.** Wymaga `test-author` i `implementer-server`, ma własną
   pułapkę wdrożeniową (migracja nieuruchomiona na bazie) i nie ma nic wspólnego z resztą poza jednym ID
   wymagania. Trzymanie go razem z pracą kontraktową oznaczałoby, że awaria testu w B2C blokuje merge
   progów geofencingu.

## Decyzje wymagające człowieka (zebrane)

| ID | Czego dotyczy | Blokuje | Opisane w |
|---|---|---|---|
| **D-A** | Kto jest właścicielem statusu dostępności i gdzie ten status mieszka. `b2b_crm_specifications.md:136` daje administratorowi „Aktywny / Urlop / Zwolnienie", D3 daje pracownikowi „jestem niedostępny". Jedno pole = pracownik zdejmuje sobie urlop wpisany przez administratora. Dodatkowo `contracts/rbac.contract.mjs` ma `auditors.update: ['admin']` — nadanie `audytor:own` na tej encji otwiera pracownikowi edycję `is_active`. | WO-B | `FLD-AVAILABILITY-SPLIT.md` §Decyzje |
| **D-B** | Jednostka odległości w `MEASURES`: jedna (`meters`, 20 i 3000) czy dwie (`meters` + `kilometers`). Rekomendacja: jedna. | nic — rekomendacja do potwierdzenia w oknie WO-A | `FLD-CONTRACT-BASE.md` §Decyzje |
| **D-C** | Gdzie żyją wersjonowane dokumenty prawne: nowe zasoby RBAC czy rozszerzenie istniejącego `documents`. | WO-C | `FLD-CONSENT-DOCS.md` §Decyzje |
| **D-D** | Punkt egzekwowania braku zgód: guard przy `T01`/`T05` (zmiana `funnel.contract.mjs`) czy filtr puli przypisania (bez zmiany maszyny stanów). | WO-C | `FLD-CONSENT-DOCS.md` §Decyzje |

## Pozycja 7 z zakresu fazy 0 — `contracts/fieldapp.contract.mjs`: **NIE w tej fazie**

Odpowiedź na pytanie „czy potrzebny": nie, i to nie jest odkładanie na później dla wygody.

- **Zestaw czterech zdjęć** — kandydat najbliższy dojrzałości, ale ma nierozstrzygnięte pytanie 7
  (`field_app_requirements.md#12`): czy komplet obowiązuje przy `T17` (etap I montażu dwuetapowego), czy
  tylko przy `T09`. Słownik zapisany przed tą odpowiedzią i tak zostanie przepisany. Sam wymóg czterech
  zdjęć jest już zakotwiczony jako wymaganie w rejestrze (patrz WO-A), więc nic się nie gubi.
- **Statusy zlecenia terenowego** — to byłaby **druga maszyna stanów** obok `funnel.contract.mjs`.
  Repozytorium ma już jedną taką równoległą maszynę (`ALLOWED_TRANSITIONS` w `apps/b2b-web/.../leads/actions.ts`)
  i to jest źródło stałego dryfu. Druga, zapisana zanim istnieje aplikacja, która miałaby jej używać,
  to gwarantowany rozjazd — bez ani jednego konsumenta, który by go ujawnił.
- **Słownik typów certyfikatów** — zależy od pytania 5 (gdzie w ogóle przechowujemy plik certyfikatu;
  dziś nie ma na to miejsca: ani kolumny, ani wartości `CERTIFICATE` w `documents.kind`).

Progi geofencingu idą do `contracts/sla.contract.mjs` (rozstrzygnięcie pytania 9 z rozdziału 12 —
decyzja człowieka z 2026-08-20 przekazana w zleceniu fazy 0). Pierwszy realny kandydat na osobny plik
kontraktu Field App pojawi się w fazie 3, razem z `apps/field-app`.
