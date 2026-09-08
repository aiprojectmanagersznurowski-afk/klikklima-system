---
name: project-delete-admin-only-installations-closed
description: CRM-DELETE-ADMIN-ONLY-INSTALLATIONS zamknięte 2026-09-08 — UI była realną luką, nie brakiem testu; wniosek dla pozostałych rodzeństwa -SERVICES/-INCIDENTS/-AUDITORS
metadata:
  type: project
---

CRM-DELETE-ADMIN-ONLY-INSTALLATIONS ma status DONE od 2026-09-08. W odróżnieniu od
[[project_leads_delete_admin_only_closed]] i -CREWS, gdzie kod był poprawny a brakowało wyłącznie
pokrycia testem, tutaj **warstwa UI była realną podatnością**: `installations-client.tsx` renderował
przycisk „Usuń (Tylko Admin)" bezwarunkowo dla każdej zalogowanej roli. Odrzucenie następowało
dopiero w Server Action.

**Why:** rodzina CRM-DELETE-ADMIN-ONLY-<RESOURCE> powstała z jednego rozbicia (WO
BATCH-MEDIUM-LOW-CLEANUP punkt 22) i wygląda na jednorodną, więc łatwo założyć, że wszędzie
brakuje tylko testu. To założenie było fałszywe już przy drugim zasobie z rzędu.

**How to apply:** przy pozostałych TODO w tej rodzinie (-SERVICES, -INCIDENTS, -AUDITORS) najpierw
przeczytaj `*-client.tsx` i sprawdź, czy przycisk usuwania jest owinięty gate'em `canDelete*`, ZANIM
zaplanujesz turę jako „dopisanie brakującego testu". Przy -SERVICES dodatkowo: ścieżka
`prisma.serwisy.delete` jest opisana w kontrakcie jako martwa (kasuje encję z innej tabeli niż widok),
więc kryterium Server Action może przechodzić trywialnie — ten sam typ pułapki co ERRATA przy
-CLIENTS po zastąpieniu delete anonimizacją.

Dwa mutanty warte powtórzenia przy każdym kolejnym zamknięciu (oba przeżyły pierwszą wersję testów
tutaj): separator menu wypchnięty PRZED gate (osierocony, widoczny dla każdej roli) oraz
`CREATE POLICY ... ON <tabela>` bez kwalifikatora `public.` dodana w INNYM pliku migracji niż bazowy.
Test RLS musi skanować wszystkie `.sql` w `supabase/migrations/`, nie tylko plik bazowy.
