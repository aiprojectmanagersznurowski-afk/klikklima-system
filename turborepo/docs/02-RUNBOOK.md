# Runbook — codzienna praca z wirtualnym zespołem

## Uruchomienie od zera (10 minut)

```bash
# 1. Skopiuj kit do repo
cp -r klikklima-agent-os/. /Users/michalsznurowski/Developemnt/klikklima-system/klikklima-system/turborepo/

# 2. Dostosuj ścieżki, jeżeli topologia repo się różni
$EDITOR tools/kk.config.mjs

# 3. Sprawdź, czy bramka żyje
node tools/kk-validate.mjs
node tools/kk-selftest.mjs        # musi pokazać 14/14
node tools/kk-codegen.mjs
bash scripts/verify.sh --fast

# 4. Podłącz pakiet kontraktów do workspace
#    packages/contracts/package.json:  { "name": "@klikklima/contracts", "main": "src/generated/index.ts" }

# 5. Dopisz skrypty do package.json w korzeniu
#    "contracts:check": "node tools/kk-validate.mjs && node tools/kk-codegen.mjs --check"
#    "contracts:build": "node tools/kk-codegen.mjs"
#    "verify": "bash scripts/verify.sh --full"

# 6. Uruchom Claude Code w katalogu repo i zaakceptuj zaufanie do folderu
#    (bez tego hooki z frontmatterów agentów nie wystartują)
claude
```

Weryfikacja, że agenci są widoczni: w sesji uruchom `/agents` albo wpisz `@` i sprawdź podpowiedzi.

## Typowy dzień

```
/kk-plan FNL-E5-BYPASS
    → czytasz Work Order, akceptujesz albo poprawiasz
/kk-loop FNL-E5-BYPASS
    → agenci pracują, Ty widzisz bramki
/kk-verify --full
/kk-review FNL-E5-BYPASS
    → commit i PR po Twojej zgodzie
```

## Kiedy przerwać agenta

Przerwij (Esc), gdy zobaczysz:

- próbę edycji testu przez implementera (hook powinien zablokować, ale jeżeli obchodzi to inną drogą — to jest sygnał),
- trzecią iterację GREEN bez postępu,
- „uproszczę ten test, żeby przeszedł",
- rozlewanie zmian na pliki spoza Work Order,
- propozycję zmiany kontraktu w środku implementacji.

## Praca równoległa

```bash
git worktree add ../kk-FNL-E5 feat/FNL-E5-BYPASS
git worktree add ../kk-CRM-UST feat/CRM-UST-AC1
# osobna sesja Claude Code w każdym katalogu
```

Zasada: **nigdy dwa zadania dotykające tego samego kontraktu naraz.** Kontrakt jest zasobem współdzielonym — równoległa zmiana kończy się konfliktem, którego nie widać w git diff, bo oba pliki generowane wyglądają poprawnie osobno.

Alternatywa wbudowana w Claude Code: `isolation: worktree` we frontmatterze agenta daje mu własną kopię repo.

## Diagnostyka

| Objaw | Przyczyna | Działanie |
|---|---|---|
| Agent nie widzi subagentów | katalog `.claude/agents/` powstał po starcie sesji | restart sesji |
| Hooki z frontmatteru nie działają | folder nie jest zaufany | zaakceptuj dialog zaufania workspace |
| `kk-codegen --check` czerwony bez zmian w kontrakcie | ktoś edytował plik generowany | `node tools/kk-codegen.mjs`, potem sprawdź `git diff` |
| Bramka zielona, ale funkcja nie działa | etapy `pominięte` w verify.sh | uzupełnij `pnpm test`, `lint`, `typecheck` |
| Agent zapętla się na tym samym błędzie | brak informacji zwrotnej z bazy | uruchom test ręcznie i wklej mu wynik |
| `guard-paths` blokuje uprawnioną zmianę | zła rola albo zła ścieżka w `kk.config.mjs` | popraw `agentWriteScopes` |

## Higiena, o której się zapomina

- `.claude/state/run-log.jsonl` rośnie — czyść co jakiś czas, ale przejrzyj przed czyszczeniem: widać w nim, który agent zużywa najwięcej przebiegów.
- Pamięć agentów (`memory: project`) mieszka w `.claude/agent-memory/` i **wchodzi do repozytorium**. Przejrzyj ją raz na tydzień; agent potrafi zapamiętać nieaktualny wzorzec i powielać go tygodniami.
- Okno kontraktowe zamykaj od razu po zmianie. Otwarte okno to wyłączona najważniejsza bramka.
- Po każdej zmianie w `docs/architecture/` sprawdź, czy kontrakt nadal odpowiada dokumentom. Kontrakt nie aktualizuje się sam.
