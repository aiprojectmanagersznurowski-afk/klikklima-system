---
name: naming-gate-path-artifact
description: Bramka nazewnictwa liczy naruszenia per ŚCIEŻKA, więc cudze niezacommitowane przeniesienie pliku wygląda jak nowy dług — sprawdź baseline pod starą ścieżką, zanim cokolwiek zrobisz
metadata:
  type: feedback
---

Gdy pre-commit zgłasza „N NOWYCH naruszeń ponad baseline" w pliku, którego **nie ma w moim commicie**, najpierw sprawdź `git status` pod kątem przeniesień i poszukaj tej samej pary `plik::reguła` w `tools/kk-naming-baseline.json` pod **starą** ścieżką. Jeżeli licznik się zgadza — to artefakt ścieżki, nie nowy dług.

**Why:** klucz baseline to `ścieżka::reguła`, więc `git mv` przenosi zamrożony dług poza baseline i bramka widzi go jako świeży. 2026-09-14 przy zamykaniu `CAL-POOL-AGGREGATE` bramka pokazała `+2` w `packages/scheduling/src/available-slots.ts` (`audytorzy`, `zespoly_monterskie`) — dokładnie te same 2 naruszenia były w baseline pod `apps/b2b-web/src/lib/schedule/available-slots.ts`, a przeniesienie było cudzą, niezacommitowaną pracą w indeksie.

**How to apply:**
- **NIE odświeżaj baseline** w takiej sytuacji: zamroziłbyś dług pod ścieżką, której nikt jeszcze nie zacommitował. Baseline aktualizuje ten, kto ląduje przeniesienie.
- Commituj własne pliki z pathspec (`git commit -o <ścieżki>`), żeby cudza praca z indeksu nie weszła do commitu.
- `--no-verify` jest tu dopuszczalne, ale **tylko po** udowodnieniu identyczności licznika w baseline i z uzasadnieniem w treści commitu. To drugi znany powód obok [[project_precommit_absolute_debt]] — i w przeciwieństwie do tamtego jest jednorazowy, nie stały.
- Hook `guard-paths` blokuje `contract-steward` zapis do scratchpada, więc długiego komunikatu commitu nie da się przygotować w pliku tymczasowym — użyj wielu flag `-m`, nie heredoca (apostrofy w treści potrafią rozwalić `$(cat <<'EOF')`).
