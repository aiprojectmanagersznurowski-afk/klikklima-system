#!/usr/bin/env bash
# verify.sh — deterministyczna bramka jakości KlikKlima.
#
# Pętla agentowa kończy się na ZIELONYM WYNIKU TEGO SKRYPTU, nie na zdaniu
# „zaimplementowałem i wygląda dobrze". To jedyna różnica między systemem
# agentowym, któremu można ufać, a takim, któremu nie można.
#
#   bash scripts/verify.sh --fast          # szybka pętla dewelopera (bez E2E)
#   bash scripts/verify.sh --full          # pełna bramka
#   bash scripts/verify.sh --full --clean  # druga weryfikacja: bez cache, od zera
#
# Kody wyjścia: 0 = zielono, 1 = czerwono. Nic pomiędzy.

set -uo pipefail

MODE="fast"; CLEAN=0
for a in "$@"; do
  case "$a" in
    --fast) MODE="fast" ;;
    --full) MODE="full" ;;
    --clean) CLEAN=1 ;;
  esac
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT" || exit 1

FAILED=(); PASSED=(); SKIPPED=()
step() {
  local name="$1"; shift
  printf '\n\033[1m▸ %s\033[0m\n' "$name"
  if "$@"; then
    PASSED+=("$name"); printf '  \033[32m✓ %s\033[0m\n' "$name"
  else
    FAILED+=("$name"); printf '  \033[31m✗ %s\033[0m\n' "$name"
  fi
}
optional() {
  local name="$1"; local probe="$2"; shift 2
  if eval "$probe" >/dev/null 2>&1; then step "$name" "$@"; else SKIPPED+=("$name"); printf '\n  \033[33m− %s (pominięte: brak narzędzia/skryptu)\033[0m\n' "$name"; fi
}

printf '\n\033[1m════ BRAMKA KLIKKLIMA (tryb: %s%s) ════\033[0m\n' "$MODE" "$([ $CLEAN = 1 ] && echo ', clean')"

if [ "$CLEAN" = 1 ]; then
  printf '\n▸ Czyszczenie cache (druga weryfikacja musi być niezależna od pierwszej)\n'
  rm -rf .turbo node_modules/.cache 2>/dev/null || true
fi

# ── Warstwa 1: kontrakt ──────────────────────────────────────────────
# Kolejność jest istotna. Nie ma sensu uruchamiać testów aplikacji,
# jeżeli źródło prawdy jest wewnętrznie sprzeczne.
step "Kontrakt: spójność"            node tools/kk-validate.mjs
step "Kontrakt: żywotność bramki"    node tools/kk-selftest.mjs
step "Kontrakt: brak dryfu codegenu" node tools/kk-codegen.mjs --check
step "Kontrakt: wygenerowany TS jest ładowalny" node tools/kk-smoke.mjs
step "Kontrakt: nazewnictwo ADR-002" node tools/kk-naming.mjs

# ── Warstwa 2: statyczna analiza ─────────────────────────────────────
# ADAPTER: repozytorium jedzie na npm (workspaces + package-lock.json), nie na pnpm.
# Sonda sprawdza dodatkowo, czy skrypt ISTNIEJE w package.json — dzięki temu brak
# skryptu daje uczciwe POMINIĘTE, a nie czerwień z „missing script".
has() { command -v npm >/dev/null 2>&1 && node -e "process.exit(require('./package.json').scripts['$1']?0:1)"; }

optional "Lint"      "has lint"         npm -s run lint
optional "Typy"      "has typecheck"    npm -s run typecheck
# Format celowo za dodatkowym warunkiem `.prettierrc` (jak w oryginale kitu):
# w repo jest 249 plików z zaległym formatowaniem. To osobne sprzątanie, nie
# element instalacji. Utwórz .prettierrc, gdy zdecydujesz się je wyrównać.
optional "Format"    "has format:check && test -f .prettierrc" npm -s run format:check

# ── Warstwa 3: testy ─────────────────────────────────────────────────
optional "Testy jednostkowe i kontraktowe" "has test" npm -s run test
if [ "$MODE" = "full" ]; then
  optional "Testy integracyjne (baza)" "has test:integration" npm -s run test:integration
  optional "Testy E2E (Playwright)"    "has test:e2e"         npm -s run test:e2e
fi

# ── Warstwa 4: identyfikowalność ─────────────────────────────────────
step "Identyfikowalność wymagań" node tools/kk-trace.mjs --enforce

# ── Podsumowanie ─────────────────────────────────────────────────────
printf '\n\033[1m════ WYNIK ════\033[0m\n'
printf '  zielone: %d | czerwone: %d | pominięte: %d\n' "${#PASSED[@]}" "${#FAILED[@]}" "${#SKIPPED[@]}"
if [ "${#SKIPPED[@]}" -gt 0 ]; then
  printf '\n  \033[33mPominięto:\033[0m %s\n' "$(IFS=', '; echo "${SKIPPED[*]}")"
  printf '  Pominięty etap NIE jest etapem zaliczonym. Uzupełnij skrypty w package.json.\n'
fi
if [ "${#FAILED[@]}" -gt 0 ]; then
  printf '\n  \033[31mCZERWONO:\033[0m\n'
  for f in "${FAILED[@]}"; do printf '    - %s\n' "$f"; done
  printf '\n  Pętla agentowa NIE MOŻE zostać zamknięta. Napraw przyczynę, nie objaw.\n\n'
  exit 1
fi
printf '\n  \033[32m✓ Bramka zielona.\033[0m\n'
[ "$MODE" = "full" ] && [ "$CLEAN" = 1 ] && printf '  To była druga, niezależna weryfikacja (bez cache). Wynik można traktować jako wiążący.\n'
printf '\n'
exit 0
