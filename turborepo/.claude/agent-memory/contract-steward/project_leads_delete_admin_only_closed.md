---
name: leads-delete-admin-only-closed
description: CRM-DELETE-ADMIN-ONLY-LEADS zamknięte 2026-09-08 — kod był poprawny od dawna, brakowało tylko testów; whitelist zamiast blacklisty w teście RLS
metadata:
  type: project
---

`CRM-DELETE-ADMIN-ONLY-LEADS` → `DONE` (2026-09-08, commit b6fc5fd). Zamknięcie nie wymagało ANI JEDNEJ
zmiany w kodzie produkcyjnym: `deleteLeadAction` i `canDeleteLeads` były poprawne od dawna, brakowało
wyłącznie pokrycia — na dwóch z trzech warstw. Wpis stał `TODO` tylko z tego powodu.

Dwie rzeczy warte zapamiętania, bo obie były BLOCKER-em albo prawie:

1. **Test RLS musi być whitelistą, nie blacklistą.** Pierwsza wersja asertowała „zero `FOR DELETE` /
   `FOR ALL` na `public.leady`". Przeżyły dwa mutanty realnie dające DELETE: polityka bez klauzuli `FOR`
   (w Postgresie to DOMYŚLNIE `FOR ALL`, więc literał nie występuje w tekście) i polityka `ON leady`
   bez kwalifikatora `public.` (regex nie dopasowywał). Poprawna forma: zebrać WSZYSTKIE polityki
   wskazujące tabelę i wymagać dokładnie N o dokładnie oczekiwanej treści.
2. **Liczba wystąpień kontrolki w UI jest częścią asercji.** `leads-client.tsx` renderuje przycisk
   „Usuń (Tylko Admin)" w DWÓCH miejscach (kanban i lista). Sprawdzenie pierwszego przepuszcza regresję
   w drugim — ta sama pułapka co w `leads-detail-edit-ui-gate.test.ts`.

**Why:** to jeden z siedmiu wpisów potomnych rozbitego `CRM-DELETE-ADMIN-ONLY` (rodzic SUPERSEDED).
Zostają cztery otwarte: INSTALLATIONS, SERVICES, INCIDENTS, AUDITORS — każdy z tym samym kształtem AC
(UI / Server Action / RLS, trzy osobne testy).

**How to apply:** przy zamykaniu kolejnego z tej czwórki najpierw sprawdź, czy kod już nie jest poprawny —
przy LEADS i CREWS był. Test RLS pisz od razu jako whitelistę. Poziom dowodu warstwy RLS jest STATYCZNY
(brak żywego Postgresa w suite) i to jest przyjęte, precedens: CREWS, CRM-CLIENT-ANONYMIZE-RODO.
Każdy taki test kosztuje kilka trafień w baseline nazewnictwa, patrz [[naming-baseline-on-migrations]].
Powiązane: [[crews-admin-gates-closed]].
