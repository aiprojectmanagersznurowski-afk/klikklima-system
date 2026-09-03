---
name: kk-trace-coverage-gaps-are-often-tagging
description: W KlikKlima brak pokrycia w kk-trace bywa artefaktem tagowania @REQ, nie brakiem testu — ale komentarze w testach potrafią kłamać o pokryciu; weryfikuj gremem, nie czytaniem nagłówka
metadata:
  type: project
---

`node tools/kk-trace.mjs` liczy pokrycie wyłącznie po komentarzach `// @REQ: <ID>` w plikach testowych. Wymaganie może być w pełni zaimplementowane i przetestowane, a mimo to raportowane jako niepokryte, bo testy niosą tag nowszego, węższego wymagania (np. `CRM-CLIENT-ANONYMIZE-RODO` zamiast starszych `CRM-DELETE-ADMIN-ONLY-CLIENTS` / `SEC-RODO-DELETE`).

**Why:** Rejestr wymagań w `contracts/requirements.contract.mjs` rósł warstwami — starsze wpisy z `database_model.md` opisują to samo zjawisko co nowsze wpisy z Work Orderów, tylko innym słownictwem i czasem z nieaktualnymi kryteriami. Istnieje już wzorzec rozwiązania: `CRM-DELETE-ADMIN-ONLY` ma `status: 'SUPERSEDED'` i przekierowuje pokrycie na wpisy potomne.

**How to apply:** Zanim zaplanujesz implementację dla wymagania zgłoszonego jako niepokryte, sprawdź, czy nie istnieje nowsze wymaganie o tym samym zakresie z gęsto otagowanymi testami. Ale nie ufaj komentarzom w nagłówkach testów mówiącym „to jest pokryte gdzie indziej" — w `customers-anonymize-rodo.test.ts` (linie 13-14, 76) takie zdanie o wyzwalaczu `audit_log_append_only_trg` okazało się nieprawdziwe; żaden test w repo nie odwoływał się do migracji `20260901220000`. Weryfikuj gremem na literale (nazwa triggera, numer migracji), nie na temacie. Dwa werdykty warte rozróżnienia: DUPLIKAT-PEŁNY (dopisz tag) kontra DUPLIKAT-CZĘŚCIOWY (dopisz tag tylko przy dowiedzionych AC i nazwij lukę) — patrz [[sprzecznosc-before-snapshot-rodo]] dla przykładu, gdzie nawet DUPLIKAT-CZĘŚCIOWY blokował się o nierozstrzygniętą sprzeczność kontraktową.

**Pułapka locum:** to zadanie samo dwa razy zapisało pamięć w złym miejscu (`apps/b2b-web/.claude/agent-memory/` zamiast katalogu głównego repo) — sprawdzaj `pwd` przed zapisem pamięci, cwd dryfuje między turami subagentów.
