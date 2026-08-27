---
name: project-auditor-scope-status
description: SEC-RLS-AUDITOR-SCOPE — stan na 2026-08-26 po rundzie 2: lista, karta /leads/[id], is_active i /logistics zamknięte i zweryfikowane wykonaniem; otwarte zostaje wyłącznie AC10 (eskalacja bokiem przez supabase-js anon)
metadata:
  type: project
---

`SEC-RLS-AUDITOR-SCOPE` (risk HIGH, status w kontrakcie nadal `TODO`) po dwóch rundach
recenzji `rls-security-auditor` z 2026-08-26 ma zamknięte:
- `getLeads()` — filtr `audytor_id` w `findMany`/`count`/`groupBy`, tożsamość z sesji,
  odmowa dla montera, fail-closed, odrzucenie `is_active === false`;
- `getLogisticsLeads()` — pełna odmowa dla audytora i montera (AC5 kontraktu);
- `getLeadDetail(id)` w `leads/[id]/actions.ts` + `notFound()` w `[id]/page.tsx`
  (AC4/AC5 z WO) — jeden wspólny kształt odmowy dla leada cudzego i nieistniejącego.

Zweryfikowane wykonaniem (mutacje w pamięci, baseline 0 padnięć): zabici mutanci
„usuń filtr własności", „rozróżnij komunikat cudzy vs nieistniejący", „usuń `is_active`",
„osłab bramkę do `!actorRole`", „zapytanie przed bramką", „usuń `if (!own)`".
Przeżywa wyłącznie mutant „tożsamość z ARGUMENTU akcji" — nieeksploatowalny, bo
`getLeadDetail(id: string)` ma jeden parametr (fakt statyczny, nie zasługa testów).

**Co ZOSTAŁO otwarte:**
- **AC10 „ESKALACJA BOKIEM"** — kontrakt żąda testu zamrażającego stan z migracji
  `20260824185845_security_enable_rls_baseline.sql` (`leady`: RLS ON, jedyna polityka to
  INSERT dla `anon`, brak SELECT). Taki test nie istnieje w `apps/b2b-web/tests`; w tym
  środowisku nie ma `docker`/`psql`/`supabase`, więc jedyne wykonalne zamrożenie to
  asercja statyczna nad plikiem migracji.
- Kolejność bramki w `assignCrewToLead` (`leads/actions.ts`) — `can()` po zapytaniach
  o leada i ekipę; poza zakresem tego ID, patrz [[feedback-mutation-testing-in-memory]].

**Why:** trzy wymagania MINIMIZE (`SEC-ASSIGNMENT-POOL-MINIMIZE`, `SEC-LEADS-LIST-MINIMIZE`,
`SEC-LEADS-LIST-SCALARS`) w polu `source` powołują się na to ID jako dowód, że „dostęp jest
już ograniczony rolą i zakresem audytora" — po rundzie 2 zdanie to jest prawdziwe dla listy,
karty szczegółów i logistyki.

**How to apply:** przy kolejnym audycie w `leads/` nie powtarzaj znalezisk o karcie
szczegółów ani o `is_active` — są naprawione. Jedyne, czego trzeba pilnować przed
przejściem wymagania na DONE, to AC10 (AC13 kontraktu wymienia tylko `where` + fail-closed,
ale AC10 nadal jest kryterium akceptacji).
