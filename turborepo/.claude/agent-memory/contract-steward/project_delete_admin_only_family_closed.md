---
name: delete-admin-only-family-closed
description: 2026-09-08 CRM-DELETE-ADMIN-ONLY-INCIDENTS DONE domyka całą rodzinę CRM-DELETE-ADMIN-ONLY-* poza -SERVICES (martwa ścieżka kodu); domena security 26/30
metadata:
  type: project
---

`CRM-DELETE-ADMIN-ONLY-INCIDENTS` zamknięte 2026-09-08 (commit `db42a91`). Cała rodzina
`CRM-DELETE-ADMIN-ONLY-*` jest domknięta z JEDYNYM wyjątkiem `-SERVICES`, które zostaje TODO
świadomie — ścieżka `services/actions.ts` kasuje encję z innej tabeli niż pokazuje widok
(martwy kod), więc test warstwy Server Action przechodziłby trywialnie dla każdej roli.
Po tym zamknięciu domena `security` w `kk-trace` ma 26/30 pokrytych.

Podział rodziny wg tego, CO było zepsute (nie wg szablonu):
- realna luka UI (przycisk renderowany bezwarunkowo): `-INSTALLATIONS`, `-INCIDENTS`
- kod poprawny, brakowało wyłącznie testu: `-LEADS`, `-CREWS`, `-AUDITORS`
- `-CLIENTS` zastąpione przez `CRM-CLIENT-ANONYMIZE-RODO` (delete → anonimizacja)

**Why:** cztery wpisy tej rodziny zamknięto w kilka dni; przy piątym łatwo założyć, że „kod jest
poprawny, dopiszmy test" — a w dwóch przypadkach przycisk usuwania był realnie widoczny dla
dyspozytora, audytora i montera.

**How to apply:** przy `-SERVICES` (albo dowolnym nowym wpisie o kształcie „delete admin-only")
najpierw PRZECZYTAJ `*-client.tsx` i sprawdź, czy pozycja menu jest owinięta gate'em razem z
poprzedzającym `<DropdownMenuSeparator />` — osierocony separator jest widoczny dla każdej roli.
Warstwa RLS: wariant mocniejszy (4 asercje, w tym guard przed `DISABLE ROW LEVEL SECURITY`) jest
teraz standardem rodziny — patrz [[project_delete_admin_only_auditors_closed]] i
[[project_delete_admin_only_installations_closed]].
