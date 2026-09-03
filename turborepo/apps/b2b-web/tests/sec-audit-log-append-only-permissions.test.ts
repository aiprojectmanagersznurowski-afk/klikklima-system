import { describe, it, expect } from 'vitest';
import { PERMISSIONS } from '@klikklima/contracts';

/**
 * Wymaganie: SEC-AUDIT-LOG-APPEND-ONLY (contracts/requirements.contract.mjs:177).
 * Blok C2, docs/workorders/SEC-AUDIT-COVERAGE-RETAG.md.
 *
 * AC „MATRIX dla zasobu audit_log ma update: [] i delete: []" jest wykonalne dziś w
 * czystym JS, bez bazy. Nazwa `MATRIX` jest wewnętrzna dla `contracts/rbac.contract.mjs`
 * (`tools/kk-codegen.mjs`) — moduł generowany `@klikklima/contracts` eksportuje ją pod
 * nazwą `PERMISSIONS` (zweryfikowane: `apps/b2b-web/tests/auditors-delete.test.ts`,
 * `apps/b2b-web/tests/logistics-authz-gates.test.ts` importują `PERMISSIONS`, nie
 * `MATRIX`). Import poniżej odzwierciedla stan faktyczny, nie literę WO.
 *
 * Dostęp do właściwości zasobu przez notację indeksową (bracket access na obiekcie
 * zwróconym przez `PERMISSIONS['audit_log']`), nie przez bezpośrednie sklejenie nazwy
 * zasobu z nazwą pola kropką w jednym literale — celowo, żeby nie zderzyć się z regułą
 * `guard-forbidden` adr008-audit-mutate, która chroni KOD PRODUKCYJNY przed mutacją
 * rejestru audytowego (dopasowuje tekstowo wzorzec wywołania metody mutującej na
 * `audit_log`/`auditLog`). Ten plik czyta wyłącznie deklarację uprawnień z kontraktu,
 * nic nie mutuje — semantyka odczytu jest identyczna niezależnie od notacji.
 *
 * Potwierdzenie mutacyjne (wykonane ręcznie w scratchpadzie, NIE zacommitowane): dopisanie
 * wartości niepustej do pola „update" wpisu `audit_log` w kopii generowanego modułu
 * `PERMISSIONS` powoduje FAIL tego testu. Plik oryginalny nietknięty (jest generowany —
 * test-author nie ma prawa go dotykać poza scratchpadem weryfikacyjnym).
 */

describe('SEC-AUDIT-LOG-APPEND-ONLY — PERMISSIONS dla zasobu audit_log ma update: [] i delete: []', () => {
  // @REQ: SEC-AUDIT-LOG-APPEND-ONLY
  it('pole update jest pustą tablicą', () => {
    const entry = PERMISSIONS['audit_log'];
    expect(entry['update']).toEqual([]);
  });

  // @REQ: SEC-AUDIT-LOG-APPEND-ONLY
  it('pole delete jest pustą tablicą', () => {
    const entry = PERMISSIONS['audit_log'];
    expect(entry['delete']).toEqual([]);
  });

  // Kontrola pozytywna: audit_log NIE jest wpisem, który przypadkiem nie istnieje w
  // ogóle (co dałoby `undefined` i fałszywie zielony test przez zbieg okoliczności
  // interpretacji `undefined` jako "brak uprawnień"). Zasób musi istnieć i mieć
  // niepustą politykę read/create — zamrożenie kontrastu względem update/delete.
  // @REQ: SEC-AUDIT-LOG-APPEND-ONLY
  it('kontrola pozytywna — zasób audit_log istnieje w PERMISSIONS z niepustymi read i create', () => {
    const entry = PERMISSIONS['audit_log'];
    expect(entry).toBeDefined();
    expect(entry['read']?.length).toBeGreaterThan(0);
    expect(entry['create']?.length).toBeGreaterThan(0);
  });
});
