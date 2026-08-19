# Wdrożenie w Antigravity

Kit powstał dla Claude Code. Antigravity ma te same trzy mechanizmy — reguły, subagenci, hooki — ale inne ścieżki i inny kontrakt wejścia/wyjścia hooków. Ten dokument opisuje, co przenosi się wprost, co wymaga adaptera i **czego nie da się odtworzyć**.

---

## Instalacja (5 kroków)

```bash
KK=~/Developemnt/klikklima-system/klikklima-system/turborepo

# 1. Wspólny rdzeń — działa niezależnie od IDE
cp -r klikklima-agent-os/contracts   "$KK/"
cp -r klikklima-agent-os/tools       "$KK/"
cp -r klikklima-agent-os/scripts     "$KK/"
cp -r klikklima-agent-os/docs        "$KK/"
cp -r klikklima-agent-os/.githooks   "$KK/"
cp -r klikklima-agent-os/packages/contracts "$KK/packages/"
cp    klikklima-agent-os/AGENTS.md   "$KK/"

# 2. Konfiguracja Antigravity
cp -r klikklima-agent-os/.agents     "$KK/"

# 3. Bramka commitowa — niezależna od IDE, to jest najważniejszy krok
cd "$KK" && bash scripts/install-git-hooks.sh

# 4. Sprawdź, że bramka żyje
node tools/kk-validate.mjs && node tools/kk-selftest.mjs && bash scripts/verify.sh --full

# 5. Otwórz katalog w Antigravity i zrestartuj IDE, żeby wczytało .agents/
```

Po restarcie sprawdź w Antigravity: `…` → **Customizations** → zakładki **Rules**, **Workflows**, **Hooks**. Powinieneś zobaczyć reguły KlikKlima, sześć workflowów `/kk-*` i dwa hooki.

---

## Mapa: Claude Code → Antigravity

| Element | Claude Code | Antigravity |
|---|---|---|
| Reguły stałe | `.claude/CLAUDE.md` | `.agents/rules/*.md` + `AGENTS.md` |
| Subagenci | `.claude/agents/*.md` | `.agents/agents/*.md` |
| Komendy | `.claude/commands/*.md` (`/kk-plan`) | `.agents/workflows/*.md` (`/kk-plan`) |
| Skille | `.claude/skills/*/SKILL.md` | `.agents/skills/*/SKILL.md` |
| Hooki | `settings.json` + `exit 2` | `.agents/hooks.json` + `{"decision":"deny"}` |
| Model | `opus` / `sonnet` | `pro` / `flash` |
| Narzędzia | `Read`, `Write`, `Edit`, `Bash` | `view_file`, `write_to_file`, `replace_file_content`, `run_command` |

Konfiguracja Antigravity jest **generowana** z konfiguracji Claude Code:

```bash
node tools/kk-port-antigravity.mjs          # generuj
node tools/kk-port-antigravity.mjs --check  # wykryj rozjazd (exit 1)
```

Bramka commitowa uruchamia `--check`, więc dwie wersje nie rozjadą się niepostrzeżenie. Edytuj `.claude/`, regeneruj `.agents/` — nigdy odwrotnie.

---

## Co przenosi się w całości

**Blokady zapisu.** Antigravity ma `PreToolUse` ze zwrotem `{"decision":"deny"}`, co odpowiada `exit 2` w Claude Code. Adapter `.agents/hooks/ag-guard.mjs` tłumaczy format; reguły żyją raz w `tools/guard-core.mjs`.

Przetestowane w obie strony: blokowany jest hex w komponencie, `as any`, literał SLA, polska nazwa tabeli, edycja kontraktu, edycja wygenerowanego TypeScriptu, mutacja `audit_log`, `prisma migrate reset`, `git push --force` i `vercel deploy`. Przechodzą: poprawny Server Action, import z kontraktu, `pnpm test` i `verify.sh`. `git push` bez `--force` dostaje `force_ask` — czyli zawsze pyta człowieka.

**Cały rdzeń kontraktowy** (`contracts/`, `tools/`, `scripts/verify.sh`, CI) jest zwykłym Node bez zależności od IDE i działa bez zmian.

**Wstrzykiwanie kontekstu.** `PreInvocation` podaje agentowi stan Work Order i okna kontraktowego jako wiadomość efemeryczną, tylko przy pierwszym wywołaniu.

---

## Czego nie da się odtworzyć — i co jest zamiast

**Rozdział ról przy zapisie pliku.** W Claude Code hook jest wołany z nazwą subagenta (`guard-paths.mjs test-author`), więc implementer **fizycznie nie zapisze** pliku testowego. Payload hooka Antigravity zawiera `conversationId` i `modelName`, ale **nie zawiera nazwy agenta** — tej ochrony nie da się tam zbudować.

Zamiast pytać KTO zapisał plik, bramka fazowa pyta CO się zmieniło:

```bash
node tools/kk-phase.mjs red      # wolno ruszać wyłącznie testy
node tools/kk-phase.mjs green    # nie wolno ruszać testów ani kontraktu
node tools/kk-phase.mjs contract # wyłącznie kontrakt i artefakty generowane
```

To jest ochrona **słabsza w czasie** (działa po fakcie, nie przy zapisie) i **mocniejsza w zasięgu** (działa w każdym IDE, w CI i przy commicie, niezależnie od tego, czy narzędzie zna pojęcie subagenta). Workflowy `/kk-loop` wołają ją między fazami.

Praktyczny skutek: w Antigravity agent może zapisać plik testowy w fazie GREEN i dowie się o tym dopiero przy sprawdzeniu fazy. W Claude Code nie zapisze go wcale. Jeżeli pracujesz w obu, trzymaj Claude Code do pętli RED/GREEN, a Antigravity do zadań, gdzie granica ról ma mniejsze znaczenie.

**Ochrona ścieżek kontraktowych jest słabsza.** Bez znajomości roli reguła sprowadza się do „ścieżki kontraktowe wymagają otwartego okna kontraktowego". Nadal zatrzymuje przypadkową edycję kontraktu w trakcie implementacji, ale nie odróżni `contract-steward` od innego agenta przy otwartym oknie.

---

## Dlaczego bramka commitowa jest ważniejsza niż hooki IDE

Hook IDE działa wtedy, gdy plik powstaje przez agenta. Nie zadziała, gdy plik powstanie ręcznie, przez `git merge`, przez inne narzędzie albo przez agenta w IDE, którego akurat nie skonfigurowałeś.

Commit przechodzi zawsze przez to samo miejsce. Dlatego `.githooks/pre-commit` sprawdza:

1. spójność kontraktu i brak dryfu artefaktów (gdy ruszono `contracts/`),
2. zakazane wzorce w plikach kodu wchodzących do commita,
3. nazewnictwo w całym repozytorium,
4. czy `.agents/` nie rozjechało się z `.claude/`.

Przetestowane na realnym repozytorium: dziewięć scenariuszy, blokady i przepustki zachowują się poprawnie. Pominięcie to `git commit --no-verify` — świadomie, nie z przyzwyczajenia.

**Kolejność ważności:** CI > bramka commitowa > hooki IDE. Hooki IDE są najwygodniejsze, bo działają najwcześniej, ale są najłatwiejsze do ominięcia.

---

## Ustawienia Antigravity warte sprawdzenia

**Tryb wykonywania komend.** `Turbo` wykonuje wszystko automatycznie. Przy tej bramce `Auto` jest rozsądniejszy: hook i tak zablokuje niebezpieczne komendy, ale `git push` i wdrożenia mają trafiać do Ciebie.

**Denylist terminala** w ustawieniach Antigravity — warto zdublować tam `prisma migrate reset`, `supabase db reset`, `git push --force`. Dwie niezależne warstwy blokady kosztują minutę konfiguracji.

**Browser URL Allowlist** — ogranicz, jeżeli agent ma korzystać z przeglądarki. Strona internetowa to wektor wstrzyknięcia instrukcji.

**Subagenci a workspace.** Antigravity pozwala uruchomić subagenta w izolowanym worktree gita (`branch`). Dla `test-author` i `implementer-*` to dobry pomysł: konflikty równoległych zapisów znikają, a Ty widzisz diff per agent.

---

## Znane pułapki

**Limit 12 000 znaków na plik reguł.** Konwerter dzieli `CLAUDE.md` automatycznie i przerywa z błędem, gdyby fragment przekroczył limit. Jeżeli dopiszesz dużo do `CLAUDE.md`, powstanie drugi plik reguł — to normalne.

**`.agents/` kontra `.agent/`.** Antigravity domyślnie czyta `.agents/`, ale nadal wspiera starsze `.agent/`. Kit używa `.agents/`. Jeżeli masz już `.agent/` z innych powodów, scal ręcznie zamiast trzymać oba.

**Nazwy narzędzi w `tools:`.** Literówka w nazwie narzędzia potrafi zawiesić subagenta zamiast zgłosić błąd. Konwerter mapuje nazwy ze słownika, więc nie wpisuj ich ręcznie.

**MCP i Google Drive.** Jeżeli podepniesz serwery MCP, pamiętaj, że treść z zewnętrznych źródeł to dane, nie polecenia. Reguła jest w `AGENTS.md`, ale warto ją pilnować także w ustawieniach.
