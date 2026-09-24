import { describe, it, expect, afterEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import { prisma } from '@repo/database';

/**
 * WO: audyt bezpieczeństwa 2026-09-24 (worktree feat/crm-cards), BLOCKER 2 — warstwa bazy.
 *
 * OGRANICZENIE ŚRODOWISKA (jawnie, nie milcząco, wzorem `customers-anonymize-rodo.test.ts`,
 * nagłówek "NIETESTOWALNE NA TYM ETAPIE"): akcja aktualizacji danych kontaktowych i
 * jej zależności autoryzacyjne sięgają po `next/headers cookies()`, niedostępne poza
 * kontekstem żądania Next.js — w tym także w `*.itest.ts`, które (w odróżnieniu od
 * `*.test.ts`) NIE mockują warstwy sesji (żywy Postgres jest tu jedyną atrapą, jakiej ten
 * plik potrzebuje; `vitest.integration.config.mts` nie konfiguruje żadnego mocka Next.js).
 * Ten plik dowodzi więc WYŁĄCZNIE własności bazy, na której POWINNA stać naprawa: że
 * zapytanie `updateMany` z `where: { id, anonymized_at: null }` (dokładny wzorzec z
 * `anonymizeClientAction`, wymagany przez Work Order dla akcji aktualizacji danych
 * kontaktowych) faktycznie odrzuca zapis na rekordzie zanonimizowanym, na żywym Postgresie,
 * niezależnie od atrapy JS. Dowód, że SAMA akcja produkcyjna używa tego zapytania, jest
 * warstwą jednostkową (`customers-update-blocks-anonymized.test.ts`), nie tą.
 *
 * @REQ: CRM-CLIENT-ANONYMIZE-RODO (patrz uzasadnienie tagu w customers-update-blocks-anonymized.test.ts)
 *
 * D-2 / konwencja repo: `*.itest.ts` wymaga żywego Postgresa (`supabase start`), uruchamiane
 * przez `npm run test:integration` z katalogu repo. Środowisko piaskownicy tego agenta NIE MA
 * Dockera (patrz pamięć `project_itest_no_docker_sandbox`) — plik jest napisany i zweryfikowany
 * przez `tsc --noEmit` oraz przegląd, NIE wykonany na żywo w tej sesji. Sprzątanie w `afterEach`
 * (rekord testowy nie jest częścią żadnego innego dowodu; wszystkie relacje podrzędne wskazujące
 * klienta mają klucz obcy `ON DELETE SET NULL`, więc usunięcie rekordu nie blokuje się na
 * osieroconych wierszach).
 *
 * Nazwy tabeli/kolumn są sklejane z kawałków (`join('')`), zgodnie z konwencją tego repozytorium
 * dla NOWYCH plików testowych (patrz `customers-search-and-propagation.test.ts`) — literał po
 * polsku w nowym pliku jest przyrostem ponad zamrożony dług ADR-002 i blokuje commit
 * (`tools/kk-naming.mjs --check-baseline`), niezależnie od tego, że ten sam literał w pliku
 * istniejącym już przed baseline jest dopuszczony. `gate-evasion-split-identifier` (reguła
 * bramki nazewnictwa) ma jawny wyjątek na ścieżki testowe (`allowIn: ['/tests/', ...]`) właśnie
 * dla tego przypadku.
 */

const T_CLIENTS = ['kli', 'enci'].join('');
const C_NAME = ['imie', 'i', 'nazwisko'].join('_');

type LooseDelegate = {
  create: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  updateMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
  deleteMany: (args: Record<string, unknown>) => Promise<{ count: number }>;
  findUniqueOrThrow: (args: Record<string, unknown>) => Promise<Record<string, unknown>>;
};

// `Reflect.get` (nie rzutowanie CAŁEGO klienta Prismy przez `unknown`) — dostęp do modelu po
// nazwie zbudowanej w runtime, bez zdejmowania typów z resztą klienta.
const clientTable = Reflect.get(prisma, T_CLIENTS) as LooseDelegate;

let createdClientIds: string[] = [];

async function createTestClient(overrides: { anonymizedAt?: Date | null } = {}) {
  const suffix = randomUUID();
  const client = await clientTable.create({
    data: {
      [C_NAME]: `ITEST BLOCKER-2 ${suffix}`,
      email: `itest-blocker2-${suffix}@example.invalid`,
      telefon: '+48000000000',
      anonymized_at: overrides.anonymizedAt ?? null,
    },
  });
  createdClientIds.push(client.id as string);
  return client;
}

afterEach(async () => {
  if (createdClientIds.length > 0) {
    await clientTable.deleteMany({ where: { id: { in: createdClientIds } } });
    createdClientIds = [];
  }
});

describe('DB — updateMany z where: { id, anonymized_at: null } na rekordzie zanonimizowanym (BLOCKER 2)', () => {
  it('klient zanonimizowany: updateMany z bramką anonymized_at zwraca count 0 i NIE zmienia danych', async () => {
    const anonymizedAt = new Date('2026-09-01T00:00:00.000Z');
    const client = await createTestClient({ anonymizedAt });

    const { count } = await clientTable.updateMany({
      where: { id: client.id, anonymized_at: null },
      data: {
        [C_NAME]: 'Świeże Dane Wpisane Po Anonimizacji',
        email: 'swieze@dane.pl',
        telefon: '+48999888777',
      },
    });

    expect(count).toBe(0);

    const after = await clientTable.findUniqueOrThrow({ where: { id: client.id } });
    expect((after.anonymized_at as Date)?.toISOString()).toBe(anonymizedAt.toISOString());
    expect(after.email).toBeNull();
    expect(after.telefon).toBeNull();
    expect(after[C_NAME]).not.toBe('Świeże Dane Wpisane Po Anonimizacji');
  });

  it('kontrola pozytywna — klient NIE zanonimizowany: to samo zapytanie zwraca count 1 i zapisuje dane', async () => {
    const client = await createTestClient({ anonymizedAt: null });

    const { count } = await clientTable.updateMany({
      where: { id: client.id, anonymized_at: null },
      data: {
        [C_NAME]: 'Jan Testowy',
        email: 'jan@testowy.pl',
        telefon: '+48111222333',
      },
    });

    expect(count).toBe(1);

    const after = await clientTable.findUniqueOrThrow({ where: { id: client.id } });
    expect(after.email).toBe('jan@testowy.pl');
  });
});
