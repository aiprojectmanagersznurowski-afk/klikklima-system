# Metodyka: Pętla Agentowa Sterowana Kontraktem (CDAL)

*Contract-Driven Agentic Loop — metodyka pracy wirtualnego zespołu agentów dla systemu KlikKlima.*

---

## 1. Skąd się to bierze

To nie jest wymyślona metodyka. Składa się z czterech ustalonych praktyk, które pojedynczo są znane, a razem dają coś, czego żadna z nich nie daje osobno:

| Praktyka | Skąd | Co wnosi |
|---|---|---|
| **Spec-driven development** | GitHub Spec Kit, Amazon Kiro (wymagania → projekt → zadania) | Agent dostaje zadanie, nie życzenie |
| **Contract-first** | OpenAPI/Protobuf, Consumer-Driven Contracts (Pact) | Jedno źródło prawdy dla wielu aplikacji w monorepo |
| **TDD z wymuszoną fazą RED** | Beck, plus rekomendacja Anthropic dla pracy agentowej | Test, który nigdy nie był czerwony, niczego nie sprawdza |
| **Deterministyczne bramki** | CI/CD, hooki Claude Code | Kończymy na zielonym skrypcie, a nie na zdaniu „gotowe" |

Dołożone są dwie rzeczy specyficzne dla pracy z agentami: **rozdział ról poparty uprawnieniami systemu plików** oraz **test mutacyjny samej bramki**.

---

## 2. Dlaczego to musi tak wyglądać

Trzy obserwacje, które kształtują całą resztę.

**Agent zawsze mówi, że skończył.** To nie jest wada konkretnego modelu, tylko własność systemu, w którym jedynym sygnałem wyjściowym jest tekst. Jedyna odpowiedź to zewnętrzny, deterministyczny werdykt, którego agent nie generuje — a jedynie uruchamia. Stąd `scripts/verify.sh` jako warunek zakończenia pętli.

**Agent zoptymalizuje to, co mierzysz.** Jeżeli miarą sukcesu jest „testy przechodzą", a agent ma prawo zapisu do testów, to prędzej czy później test zostanie osłabiony zamiast kodu naprawiony. Zwykle w dobrej wierze i z sensownym uzasadnieniem w podsumowaniu. Dlatego `implementer` fizycznie nie może zapisać pliku testowego — nie dlatego, że mu zabroniono w promptcie, tylko dlatego, że hook zwraca `exit 2`.

**Sprzeczne dokumenty produkują sprzeczny kod, tylko szybciej.** Twoja dokumentacja mówi jednocześnie „tRPC" i „bez API routes, tylko Server Actions", oraz „Vite + React" i „Next.js App Router". Człowiek zauważa taką sprzeczność i pyta. Agent wybiera jedną wersję na moduł — i po tygodniu masz dwie architektury w jednym repo. Dlatego krok zerowy metodyki to rozstrzygnięcie sprzeczności, a nie uruchomienie agentów.

---

## 3. Architektura: co jest źródłem prawdy

```
docs/architecture/*.md          ← intencja biznesowa (czytana przez ludzi i agentów)
        │  destylacja jednorazowa + przy każdej zmianie biznesowej
        ▼
contracts/*.contract.mjs        ← ŹRÓDŁO PRAWDY (maszyna stanów, powiadomienia, SLA, RBAC, wymagania)
        │  node tools/kk-codegen.mjs
        ├──────────────────────────────┬────────────────────────────┐
        ▼                              ▼                            ▼
packages/contracts/src/generated/   docs/architecture/generated/  (schemat Prisma — ręcznie
   funnel.ts, notifications.ts,        CONTRACTS.md                 przez contract-steward,
   sla.ts, rbac.ts                     (diagram + tabele)           w oknie kontraktowym)
        │                              │
        ▼                              ▼
   kod aplikacji                   dokumentacja, która
   i testy importują               nie może się rozjechać
```

Trzy konsekwencje tego układu:

1. **Kod nigdy nie definiuje etapu lejka ani progu SLA.** Importuje. `canTransition(status, action)` jest jedynym miejscem, w którym mieszka odpowiedź na pytanie „czy wolno".
2. **Dokumentacja jest artefaktem, nie tekstem do utrzymywania.** Diagram Mermaid w `CONTRACTS.md` jest generowany. Nie może skłamać, bo nikt go nie pisze ręcznie.
3. **Dryf jest wykrywalny.** `kk-codegen --check` porównuje wygenerowany wynik z dyskiem. Jeżeli ktokolwiek — człowiek czy agent — ręcznie poprawił plik generowany, CI to zauważy.

---

## 4. Wirtualny zespół

Dziesięciu agentów, każdy z własnym oknem kontekstu, własnym zestawem narzędzi i **fizycznie ograniczonym zakresem zapisu**.

| Agent | Model | Pisze | Kluczowe ograniczenie |
|---|---|---|---|
| `spec-analyst` | opus | Work Ordery | Nie pisze kodu ani testów |
| `contract-steward` | opus | kontrakty, schemat, migracje | Tylko przy otwartym oknie kontraktowym |
| `test-author` | sonnet | testy | Nie dotknie kodu produkcyjnego |
| `implementer-server` | sonnet | logika serwerowa | Nie dotknie testów |
| `implementer-ui` | sonnet | komponenty | Nie dotknie testów, blokada na hex/ikony/zieleń |
| `notification-architect` | sonnet | powiadomienia, kolejka | Nie zmienia katalogu powiadomień |
| `reviewer` | opus | — | Brak narzędzi zapisu |
| `rls-security-auditor` | opus | — | Brak narzędzi zapisu |
| `e2e-runner` | sonnet | — | Tylko uruchamia, zwraca streszczenie |
| `doc-scribe` | sonnet | dokumentacja opisowa | Nie dotyka `generated/` |

**Dlaczego akurat taki podział.** Granica przebiega tam, gdzie występuje konflikt interesów. Ten, kto ma przejść test, nie może go zmieniać. Ten, kto pisze test, nie może uczynić go trywialnym, dopisując implementację. Ten, kto recenzuje, nie widzi uzasadnień autora. Ten, kto zmienia kontrakt, robi to tylko wtedy, gdy człowiek świadomie otworzył okno.

**Dlaczego to nie jest przesada.** Każdy z tych podziałów odpowiada awarii, która występuje w praktyce: osłabiony test, test bez asercji, recenzja potwierdzająca cudzą narrację, zmiana kontraktu przemycona jako „drobna poprawka typów", która unieważnia trzydzieści testów naraz.

---

## 5. Pętla

```
      ┌─────────────────────────────────────────────────────────────┐
      │  0. FREEZE (jednorazowo)                                    │
      │     Rozstrzygnięcie sprzeczności w dokumentach → ADR         │
      └────────────────────────────┬────────────────────────────────┘
                                   ▼
   ┌───────────────────────────────────────────────────────────────────┐
   │ 1. PLAN        spec-analyst → Work Order                          │
   │                ◆ BRAMKA CZŁOWIEKA: akceptacja Work Order          │
   ├───────────────────────────────────────────────────────────────────┤
   │ 2. CONTRACT    tylko gdy potrzebna zmiana kontraktu               │
   │                ◆ BRAMKA CZŁOWIEKA: otwarcie okna kontraktowego    │
   ├───────────────────────────────────────────────────────────────────┤
   │ 3. RED         test-author → testy, które padają                  │
   │                ◆ BRAMKA MASZYNOWA: pada na asercji, ma @REQ       │
   ├───────────────────────────────────────────────────────────────────┤
   │ 4. GREEN       implementer → minimalna zmiana        max 3 iteracje│
   │                ◆ BRAMKA MASZYNOWA: testy zielone                  │
   ├───────────────────────────────────────────────────────────────────┤
   │ 5. VERIFY      scripts/verify.sh --full --clean                   │
   │                ◆ BRAMKA MASZYNOWA: pełny przebieg bez cache       │
   ├───────────────────────────────────────────────────────────────────┤
   │ 6. REVIEW      reviewer ∥ rls-security-auditor (równolegle)       │
   │                ◆ BRAMKA MASZYNOWA: zero BLOCKERów                 │
   ├───────────────────────────────────────────────────────────────────┤
   │ 7. INTEGRATE   ◆ BRAMKA CZŁOWIEKA: commit, PR, merge              │
   └───────────────────────────────────────────────────────────────────┘
```

Cztery bramki człowieka są nieusuwalne. Reszta jest automatyczna.

---

## 6. Podwójna weryfikacja — co to znaczy w praktyce

Prośba „testuj wszystko dwa razy" ma sens tylko wtedy, gdy dwa przebiegi sprawdzają **różne rzeczy**. Dwukrotne uruchomienie tego samego polecenia to nie weryfikacja, to rytuał. Tutaj dublowanie jest zbudowane na czterech poziomach:

**Poziom 1 — test przechodzi dwie fazy.** Najpierw musi udowodnić, że potrafi paść (RED, z właściwego powodu), potem że przechodzi (GREEN). Test, który nigdy nie był czerwony, nie jest dowodem — jest zbiegiem okoliczności.

**Poziom 2 — bramka jest uruchamiana dwa razy w różnych warunkach.** Raz szybko w pętli (`--fast`, z cache Turborepo), raz przed zamknięciem (`--full --clean`, od zera). Ta druga wykrywa wyniki, które istniały tylko dzięki cache albo kolejności testów.

**Poziom 3 — dwie niezależne recenzje.** `reviewer` ocenia zgodność i uczciwość testów, `rls-security-auditor` ocenia bezpieczeństwo. Żaden nie widzi uzasadnień implementera. To celowe: recenzent, któremu wyjaśniono, dlaczego coś jest dobre, przestaje być drugim spojrzeniem.

**Poziom 4 — bramka testuje samą siebie.** `kk-selftest.mjs` podstawia czternaście zepsutych wersji kontraktu i sprawdza, czy walidator je wyłapuje. To jest test mutacyjny: odpowiada na pytanie „czy ta reguła w ogóle potrafi zapalić się na czerwono". Reguła, której nie da się złamać, nie jest zabezpieczeniem, tylko dekoracją. Na dziś: **14/14 reguł udowodniło swoją żywotność**.

---

## 7. Kontrola pętli i koszty

**Limit iteracji: 3.** Po trzeciej nieudanej próbie GREEN agent zatrzymuje się i pisze diagnozę zamiast próbować czwarty raz. Czwarta próba na oślep bywa droższa niż jedno pytanie do człowieka i częściej kończy się rozlaniem zmian po całym repo.

**Koszt tokenów.** Praca wielo-agentowa zużywa ich wielokrotnie więcej niż pojedyncza sesja. Stąd świadomy dobór modeli: `opus` tam, gdzie potrzebny jest osąd (analiza, kontrakt, recenzja), `sonnet` tam, gdzie potrzebna jest solidna realizacja. Delegowanie hałaśliwych przebiegów do `e2e-runner` służy temu samemu — do głównego kontekstu wraca streszczenie, nie dwa tysiące linii logu.

**Równoległość.** Recenzje uruchamiaj równolegle. Zadania dotykające rozłącznych wymagań możesz prowadzić w osobnych sesjach na `git worktree` — ale nigdy dwa zadania dotykające tego samego kontraktu naraz.

**Stan poza modelem.** Kontekst się kończy, sesje się resetują. Dlatego stan pętli mieszka w plikach: `.claude/state/current-workorder.json`, `docs/workorders/*.md`, `.claude/state/run-log.jsonl`. Agent zawsze może odtworzyć sytuację z dysku.

---

## 8. Antywzorce, które ta konstrukcja blokuje

| Antywzorzec | Jak wygląda | Co go blokuje |
|---|---|---|
| Osłabianie testu | Zmiana asercji, żeby przeszła | `guard-paths` — implementer nie zapisze pliku testowego |
| Test-teatr | `expect(true).toBe(true)`, mock tego, co miało być sprawdzone | Bramka RED + punkt „uczciwość testów" u recenzenta |
| Wyciszanie typów | `@ts-ignore`, `as any` | `guard-forbidden` — `exit 2` przy zapisie |
| Wyłączanie testu | `it.skip`, `test.only` | `guard-forbidden` |
| Dryf kontraktu | Ręczna edycja pliku generowanego | `kk-codegen --check` |
| Rozjazd modułów | 14 dni w jednym miejscu, 15 w innym | Progi wyłącznie z kontraktu SLA + recenzja |
| Zmiana kontraktu bocznymi drzwiami | „Przy okazji poprawiłem enum" | Okno kontraktowe z potwierdzeniem w terminalu |
| Wymyślone wymaganie | `@REQ: FNL-COS-TAM` | `kk-trace --enforce` odrzuca nieznane ID |
| Fikcyjne pokrycie | „Zaimplementowane", zero testów | `kk-trace --enforce` blokuje status bez testu |
| Rozlany zakres | Zadanie o SLA kończy się refaktorem połowy repo | Sekcja „Poza zakresem" w Work Order + recenzja diffu |

---

## 9. Czego ta metodyka nie załatwi

Uczciwie, bo to też jest częścią projektu:

- **Nie zastąpi decyzji produktowych.** Cztery bramki człowieka są tam nieprzypadkowo. Sprzeczności w dokumentach rozstrzygasz Ty.
- **Nie wyłapie błędu w samym kontrakcie.** Jeżeli kontrakt mówi, że wycena jest ważna 14 dni, a biznes ustalił 21, wszystko będzie zielone i całkowicie błędne. Kontrakt to miejsce, w którym Twoja uwaga jest najbardziej wartościowa.
- **Nie da gwarancji przy braku testów integracyjnych z prawdziwą bazą.** Testy jednostkowe z zamockowaną Prismą nie sprawdzą RLS ani współbieżności rezerwacji. Etapy pominięte w bramce (`− pominięte`) nie są etapami zaliczonymi.
- **Nie chroni przed złym modelem danych.** Jeżeli `zespoly_monterskie` przechowuje jeden certyfikat na całą brygadę, a wymaganie mówi o certyfikatach poszczególnych osób, żaden test tego nie naprawi. To zostało zgłoszone jako ADR-009.
