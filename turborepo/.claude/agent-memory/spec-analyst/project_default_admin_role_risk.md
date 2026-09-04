---
name: project_default_admin_role_risk
description: schema.prisma AuthorizedUser.role ma @default("admin") — konto utworzone bez jawnej roli dostaje pełne uprawnienia administratora, nie odmowę
metadata:
  type: project
---

Znalezione przez `contract-steward` przy okazji WO `SEC-AUDIT-LOG-ROLE-CHANGE` (2026-09-04): `packages/database/prisma/schema.prisma`, model `AuthorizedUser`, pole `role String @default("admin")`.

**Why:** to jest odwrócenie zasady fail-closed obowiązującej w całym reszcie tego repo (brak/nierozpoznana rola = odmowa, wszędzie indziej egzekwowane przez `getCurrentActorRole()` zwracające `null`). Tutaj brak jawnie podanej wartości przy tworzeniu rekordu w bazie daje NAJWYŻSZE uprawnienia, nie odmowę. Jeśli którykolwiek `INSERT` na tę tabelę (np. skrypt migracyjny, ręczny insert, przyszła integracja) pominie pole `role`, nowe konto jest adminem po cichu.

**How to apply:** to wymaga osobnego ID wymagania i najpewniej migracji (usunięcie `@default`, `role` staje się `NOT NULL` bez wartości domyślnej, albo domyślną wartością nierozpoznawalną przez `ROLES` tak, żeby `getCurrentActorRole()` zwróciło `null`). Nie naprawiać przy okazji innego WO — zgłosić jako propozycję nowego zadania, gdy temat bezpieczeństwa kont wróci. Powiązane: [[project_last_admin_guard_deferred]] (inny wektor tego samego obszaru — zarządzanie kontami uprzywilejowanymi).
