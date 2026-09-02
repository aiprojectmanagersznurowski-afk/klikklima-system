import { Prisma } from "@repo/database"
import { InstallationStatus } from "@repo/database"

/**
 * D1 (FNL-ROLLBACK): zwalnia slot ekipy dla wszystkich wierszy `instalacje` danego
 * leada, które są jeszcze `PLANNED`. Blokada `SELECT ... FOR UPDATE` MUSI poprzedzić
 * jakąkolwiek mutację, żeby dwie równoległe próby zwolnienia/przydziału tego samego
 * slotu nie wyścigały się w JS (pułapka 4 z CLAUDE.md).
 *
 * Filtr `status = 'PLANNED'` jest częścią samego zapytania blokującego — inaczej
 * zablokowalibyśmy (i nadpisali) także wiersze `COMPLETED`/`CANCELLED`, czyli
 * ukończone montaże (review LOGISTICS-SHIPPING-EFFECTS, Faza A, BLOCKER 1).
 *
 * NIE jest to Server Action — ten moduł (osobny plik od `actions.ts`) nie ma
 * `"use server"`, więc Turbopack nie generuje dla `releaseCrewSlot`/`suspendLogisticsSla`
 * żadnego wpisu w `server-reference-manifest.json`: bez publicznego ID nie da się
 * ich wywołać z przeglądarki.
 * Wywoływana WYŁĄCZNIE z wnętrza `rollbackLogisticsOrder` w `actions.ts`, już po
 * przejściu bramki `can()` tej funkcji.
 */
export async function releaseCrewSlot(tx: Prisma.TransactionClient, leadId: string): Promise<void> {
  const lockedRows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM instalacje WHERE lead_id = ${leadId}::uuid AND status = 'PLANNED' FOR UPDATE
  `;

  for (const row of lockedRows) {
    await tx.instalacje.update({
      where: { id: row.id },
      data: {
        zespol_id: null,
        data_planowana: null,
        status: InstallationStatus.CANCELLED,
      },
    });
  }
}

/**
 * D2 (FNL-ROLLBACK): wstrzymuje SLA logistyczne leada. `logistics_sla_paused_at`
 * ustawiany jest TYLKO gdy jeszcze `null` (idempotencja — AC-A5: drugi rollback nie
 * przesuwa stempla), `data_rezerwacji` jest zerowana zawsze, bo lead traci swój
 * termin niezależnie od tego, czy SLA było już wstrzymane wcześniej.
 */
export async function suspendLogisticsSla(tx: Prisma.TransactionClient, leadId: string): Promise<void> {
  const lead = await tx.leady.findUnique({ where: { id: leadId } });

  await tx.leady.update({
    where: { id: leadId },
    data: {
      logistics_sla_paused_at: lead?.logistics_sla_paused_at ?? new Date(),
      data_rezerwacji: null,
    },
  });
}
