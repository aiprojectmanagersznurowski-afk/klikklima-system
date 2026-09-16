import { describe, it, expect } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@repo/database';
import { AUDIT_REQUIREMENTS } from '@klikklima/contracts';

/**
 * WO: docs/workorders/CAL-SCHEDULING-CONFIG-UI.md — TC-T11 (zależność migracyjna, R-6).
 * Wymagania: `CAL-VISIT-DURATION-BASKETS` i `CAL-TRAVEL-BUFFER` (obie TODO).
 *
 * Zweryfikowane na ŻYWEJ bazie 2026-09-15 (WO, "Zmiana kontraktu"): `audit_log_resource_check`
 * ma 13 wartości i NIE zawiera 'visit_duration_baskets' ani 'system_config', mimo że oba są
 * już zasobami w `contracts/rbac.contract.mjs`. Migracja rozszerzająca istnieje jako PLIK
 * (`supabase/migrations/20260915120000_cal_scheduling_config_audit_check.sql`) ale wg WO NIE
 * JEST zaaplikowana w chwili pisania tych testów. TEN test ma być CZERWONY, dopóki migracja
 * nie zostanie uruchomiona — to jest jego cel (WO: "ma spaść wcześniej niż pierwszy prawdziwy
 * zapis użytkownika"), nie usterka testu.
 *
 * BRAK CLEANUP jest ŚWIADOMY, nie przeoczeniem: `audit_log` jest append-only (ADR-008).
 * Usuwanie wierszy tej tabeli z kodu jest zablokowane przez hook repozytorium nawet w
 * testach, więc ten plik go nie próbuje. Baza integracyjna jest lokalnym, jednorazowym
 * stackiem `supabase start` (patrz `vitest.integration.config.mts`), więc pozostałość dwóch
 * wierszy testowych na przebieg nie zanieczyszcza żadnego trwałego środowiska.
 *
 * D-2 / konwencja repo (`create-booking-concurrency.itest.ts`): `*.itest.ts` wymaga żywego
 * Postgresa (`supabase start`), uruchamiane przez `npm run test:integration` z katalogu repo,
 * NIE przez `npx vitest run` w tym katalogu (inna konfiguracja: `vitest.integration.config.mts`).
 * Ten zapis omija RLS (Prisma, rola właściciela bazy); test sprawdza WYŁĄCZNIE ograniczenie
 * CHECK, nie RLS.
 *
 * Brak FK na `resource`/`record_id` (schema.prisma, komentarz nad AuditLog.recordId) — nie
 * trzeba tworzyć żadnego koszyka ani wiersza system_config, żeby ten test był poprawny:
 * `record_id` jest wolnym TEXT-em, unikalnym per przebieg (randomUUID) tylko po to, żeby
 * kolejne przebiegi nie były nieodróżnialne w rejestrze, nie z powodu ograniczenia unikalności.
 *
 * Środowisko piaskownicy tego agenta NIE MA Dockera — plik jest napisany i zweryfikowany
 * przez `tsc --noEmit` oraz przegląd, ale NIE wykonany na żywo w tej sesji (patrz pamięć
 * project_itest_no_docker_sandbox). Prawdziwe wykonanie należy do CI / maszyny developerskiej
 * po `supabase start`.
 */

const VALID_LEGAL_BASIS = AUDIT_REQUIREMENTS.legalBases[0];
const VALID_JUSTIFICATION = 'Test TC-T11: rozszerzenie audit_log_resource_check.';

describe('audit_log_resource_check — TC-T11 (CHECK bazy przyjmuje visit_duration_baskets i system_config)', () => {
  // @REQ: CAL-VISIT-DURATION-BASKETS
  it("TC-T11 — INSERT do audit_log z resource = 'visit_duration_baskets' PRZECHODZI", async () => {
    const row = await prisma.auditLog.create({
      data: {
        operation: 'field_update',
        resource: 'visit_duration_baskets',
        recordId: randomUUID(),
        actorEmail: 'itest-tc-t11@klikklima.pl',
        actorRole: 'admin',
        justification: VALID_JUSTIFICATION,
        legalBasis: VALID_LEGAL_BASIS,
      },
    });

    expect(row.resource).toBe('visit_duration_baskets');
  });

  // @REQ: CAL-TRAVEL-BUFFER
  it("TC-T11 — INSERT do audit_log z resource = 'system_config' PRZECHODZI", async () => {
    const row = await prisma.auditLog.create({
      data: {
        operation: 'field_update',
        resource: 'system_config',
        recordId: randomUUID(),
        actorEmail: 'itest-tc-t11@klikklima.pl',
        actorRole: 'admin',
        justification: VALID_JUSTIFICATION,
        legalBasis: VALID_LEGAL_BASIS,
      },
    });

    expect(row.resource).toBe('system_config');
  });
});
