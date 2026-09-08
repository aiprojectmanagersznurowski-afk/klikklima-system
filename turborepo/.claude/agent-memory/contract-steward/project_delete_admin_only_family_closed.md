---
name: delete-admin-only-family-closed
description: 2026-09-08 cała rodzina CRM-DELETE-ADMIN-ONLY-* domknięta (7/7, ostatnie -SERVICES); domena security 27/30; podział wpisów wg tego, CO było zepsute
metadata:
  type: project
---

Rodzina `CRM-DELETE-ADMIN-ONLY-*` jest domknięta w całości od 2026-09-08 — siedem wpisów
potomnych, wszystkie w stanie końcowym. Ostatni był `-SERVICES`. Domena `security` w
`kk-trace`: 27/30 pokrytych.

Podział rodziny wg tego, CO było zepsute (nie wg szablonu):
- realna luka UI: `-INSTALLATIONS`, `-INCIDENTS` (przycisk renderowany bezwarunkowo),
  `-SERVICES` (innego kształtu — patrz [[project_delete_admin_only_services_closed]])
- kod poprawny, brakowało wyłącznie testu: `-LEADS`, `-CREWS`, `-AUDITORS`
- `-CLIENTS` zastąpione przez `CRM-CLIENT-ANONYMIZE-RODO` (delete → anonimizacja)

**Why:** wpisy zamykano w kilka dni jeden po drugim; przy każdym kolejnym łatwo założyć, że
„kod jest poprawny, dopiszmy test" — a w TRZECH z siedmiu przypadków przycisk usuwania był
realnie widoczny dla dyspozytora, audytora i montera.

**How to apply:** przy dowolnym nowym wpisie o kształcie „delete admin-only" najpierw
PRZECZYTAJ `*-client.tsx` i sprawdź dwie rzeczy: czy pozycja menu jest owinięta gate'em
liczonym z `can()`, oraz czy poprzedzający `<DropdownMenuSeparator />` leży wewnątrz tego
gate'a (osierocony separator jest widoczny dla każdej roli). Warstwa RLS: wariant mocniejszy
(4 asercje, w tym guard przed `DISABLE ROW LEVEL SECURITY`, dowód globalny nad WSZYSTKIMI
plikami `.sql`) jest standardem rodziny — patrz [[project_delete_admin_only_auditors_closed]]
i [[project_delete_admin_only_installations_closed]]. Dług: `-LEADS`, `-INSTALLATIONS`
i `-CREWS` zamknięto BEZ guardu przed `DISABLE RLS`.
