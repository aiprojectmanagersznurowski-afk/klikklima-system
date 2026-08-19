# ADR-009 — wykaz zmian

Decyzja: **zespół reprezentuje jedna osoba, która posiada certyfikaty i odpowiada za montaż. Członkowie brygady nie są ewidencjonowani osobno.** Data: 2026-08-18.

---

## database_model.md — `crews`

| Było | Jest | Powód |
|---|---|---|
| `coordinator_full_name` (wolny tekst) | `representative_user_id` FK + `representative_full_name` | przedstawiciel ma konto w `authorized_users`, loguje się do Field App i jest identyfikowalny |
| `fgaz_certificate_no`, `fgaz_valid_until` | bez zmiany nazw, doprecyzowane opisy | to certyfikaty **przedstawiciela**, nie abstrakcyjnego zespołu |
| `sep_qualified`, `sep_valid_until` | j.w. | j.w. |
| `crew_count` | opis uzupełniony | liczebność brygady bez ewidencji osób |

Nowa relacja: `authorized_users ||--o| crews`.

## Czego świadomie nie budujemy

Tabel `employees` i `crew_members`, przypisań certyfikatów do poszczególnych osób ani osobnych przypomnień dla każdego montera. Alert `I6` dotyczy przedstawiciela, guard `crewCertsValid` sprawdza jego uprawnienia i to one decydują o ukryciu ekipy z puli na Etapie 4.

## contracts/requirements.contract.mjs

**`CRM-ZESP-AC1`** — treść zmieniona z „certyfikatu któregokolwiek członka zespołu" na „certyfikatu przedstawiciela zespołu". Kryteria akceptacji z jednego zdania odsyłającego do ADR na cztery wykonywalne, w tym: dwa certyfikaty wygasające w tym samym oknie generują dwa osobne alerty, a alert nie powtarza się przy każdym przebiegu crona.

**`CRM-AUDYT-AC3`** — doprecyzowane, że ten sam mechanizm obsługuje audytorów i przedstawicieli zespołów: jedna ścieżka, dwa źródła dat.

**`CRM-ZESP-REP`** (nowe) — zapisuje wprost, że brak ewidencji pozostałych członków brygady jest decyzją, a nie luką. Bez tego zapisu ktoś za pół roku zgłosi to jako brakującą funkcję.

Rejestr ma 59 wymagań.

---

## Dlaczego nie dobudowałem tabel

Wymaganie `CRM-ZESP-AC1` było niewykonalne w istniejącym modelu i naturalnym odruchem jest rozbudowa schematu, żeby wymaganie dało się spełnić. Tutaj właściwą odpowiedzią okazało się poprawienie wymagania: sformułowanie „któregokolwiek członka zespołu" pochodziło z dokumentu, a nie z rzeczywistej potrzeby biznesowej — odpowiedzialność za montaż i tak spoczywa na jednej osobie.

Koszt alternatywy byłby realny: dwie tabele, ewidencja kadrowa, przypisania czasowe monterów do brygad, powiadomienia dla każdej osoby osobno i pytanie, kto to wszystko utrzymuje w aktualności.

## Brak nowej reguły bramki — świadomie

Ta decyzja polega na tym, czego *nie* budujemy, a takich rzeczy nie da się sensownie pilnować regułą. Zakaz tworzenia tabeli `crew_members` blokowałby przyszłą rozbudowę, nie chroniąc dziś przed niczym. Ochroną są kryteria akceptacji i istniejący guard `crewCertsValid`.

Warto to odnotować, bo przy poprzednich dziesięciu ADR każda decyzja kończyła się nową regułą — i łatwo z tego zrobić odruch. Reguła, która nie wyłapuje realnego błędu, tylko zwiększa liczbę rzeczy do utrzymania.

## Kiedy wrócić do tej decyzji

Gdy trzeba będzie wykazać, który konkretny monter wykonał daną instalację — przy reklamacji gwarancyjnej albo kontroli F-Gaz. Wtedy potrzebna jest ewidencja osób powiązana z `installation_phases`, a `representative_user_id` staje się jednym z wielu przypisań zamiast jedynym.
