---
name: delete-admin-only-services-closed
description: CRM-DELETE-ADMIN-ONLY-SERVICES DONE 2026-09-08 — gate ISTNIAŁ, ale sprawdzał pochodzenie wiersza, nie rolę; predykat celowo zostawiony w menu-visibility.ts
metadata:
  type: project
---

`CRM-DELETE-ADMIN-ONLY-SERVICES` zamknięte 2026-09-08 jako ostatnie z siedmiu
([[project_delete_admin_only_family_closed]]).

Luka miała inny kształt niż u rodzeństwa: pozycja „Usuń (Tylko Admin)" NIE była renderowana
bezwarunkowo — była owinięta warunkiem `isDeleteMenuItemVisible(service)`. Tyle że ten
predykat sprawdzał wyłącznie, czy wiersz jest realnym serwisem (`source === "service"`,
reguła `SRV-SOURCE-OF-TRUTH`), a NIE rolę. Obecność gate'a wyglądała przy pobieżnym
przeglądzie jak zamknięta sprawa. Naprawa: koniunkcja
`isDeleteMenuItemVisible(service) && canDeleteServices`, gdzie drugi człon liczony z `can()`.

Decyzja świadoma: `menu-visibility.ts` NIE zmieniono. Predykat zostaje czysty (pochodzenie
wiersza) i ma własny test pod `SRV-SOURCE-OF-TRUTH`; wciśnięcie do niego roli zepsułoby tamten
dowód i zlepiło dwie niezależne reguły w jednej funkcji. Bramka roli mieszka obok predykatu,
w komponencie.

**Why:** „jest jakiś warunek przy przycisku" to nie to samo co „jest warunek o roli". Ten wpis
był w rodzinie jedynym, w którym istniejący gate maskował lukę zamiast ją zamykać.

**How to apply:** przy audycie warstwy UI czytaj TREŚĆ warunku, nie sam fakt jego obecności —
i jeśli warunek pochodzi z osobnej reguły (innego `@REQ`), dokładaj drugi człon zamiast
rozszerzać cudzy predykat.
