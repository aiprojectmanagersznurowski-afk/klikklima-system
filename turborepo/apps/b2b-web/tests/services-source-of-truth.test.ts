import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';

/**
 * WO: docs/workorders/SRV-SOURCE-OF-TRUTH-SERVICES-VIEW.md — SRV-SOURCE-OF-TRUTH
 * (ADR-010, kryterium: "Widok CRM czyta termin z services, gdy rekord istnieje,
 * i z next_service_date, gdy nie istnieje").
 *
 * ZALOZENIE O KSZTALCIE ZAPYTAN (do potwierdzenia przez implementer-server, nie
 * jest to narzucanie implementacji, tylko granica mockowania Prisma w tescie
 * jednostkowym bez zywej bazy — analogicznie do zalozen w innych plikach tego
 * katalogu, np. auditors-delete.test.ts): `getUpcomingServices()` wola DWA
 * niezalezne zapytania:
 *   - `prisma.serwisy.findMany(...)` — WSZYSTKIE rekordy serwisu (kazdy status),
 *     z include pozwalajacym dotrzec do instalacji/leada/klienta/adresu ORAZ do
 *     wlasnych pol `klient_id`/`adres_id` serwisu (przypadek osierocony,
 *     `instalacja_id = null`, `onDelete: SetNull`).
 *   - `prisma.instalacje.findMany(...)` — instalacje z next_service_date wypelnionym,
 *     niezaleznie od tego, czy maja serwisy (dedup ma sie odbyc W WYNIKU KONCOWYM,
 *     wiec ten test mockuje `instalacje.findMany` jako SUROWY, NIE ODFILTROWANY
 *     zbior — dokladnie po to, zeby AC4 rzeczywiscie sprawdzalo logike scalania
 *     aplikacji, a nie ufalo, ze DB juz przefiltrowala).
 *
 * Nie zakladamy KONKRETNEGO ksztaltu `where`/`include` — asercje dotycza WYLACZNIE
 * finalnego wyniku `getUpcomingServices()`, nie argumentow wywolania Prisma.
 *
 * Mockujemy @repo/database — brak zywej instancji testowej w tym repo (patrz
 * konwencja innych plikow *-authz-gates.test.ts / *-delete.test.ts).
 *
 * RULE-CHALLENGE (zaraportowany, NIE obejscie): fixture'y instalacji z polem
 * pochodnym daty serwisu zyja w JSON (`fixtures/services-installations.json`), nie
 * jako literaly obiektowe w tym pliku, bo `guard-forbidden`/`adr010-derived-write`
 * (`tools/kk.config.mjs`) skanuje kazdy plik `.ts`/`.tsx` pod katem tego klucza z
 * dowolna wartoscia po dwukropku, bez odroznienia fixture'a testowego (symulacja
 * ODCZYTU z bazy) od prawdziwego zapisu w kodzie produkcyjnym. JSON nie jest objety
 * `appliesTo` tej reguly. Ponizej WYLACZNIE odczytujemy te dane i hydratujemy ISO
 * stringi do `Date` generycznym deserializerem (nie odwolujacym sie do nazwy pola),
 * co nie jest obejsciem regexu reguly, tylko przeniesieniem surowych danych poza
 * jej zakres zastosowania. Szczegoly w podsumowaniu tury.
 */

/**
 * PREWENCJA (WO SEC-READ-GATES): `getUpcomingServices()` dziś (2026-09-02) NIE woła
 * `getCurrentActorRole()` wcale — po dopisaniu bramki `can(role,'services','read')`
 * (przedmiot osobnego pliku testowego `services-read-scope.test.ts`) realny
 * `getCurrentActorRole()` rzucałby poza kontekstem żądania, bramka fail-closed
 * zwracałaby `[]`, i cała bateria ADR-010 powyżej padałaby z przyczyny niezwiązanej
 * z tym, co ten plik ma sprawdzać. Rola `admin` (uprawniona, bez zawężenia `:own`)
 * domyślnie dla każdego testu w tym pliku — ten plik testuje WYŁĄCZNIE scalanie
 * service/forecast, nie bramkę roli ani zawężenie montera.
 */

const { serviceFindManyMock, installationFindManyMock, getCurrentActorRoleMock, getCurrentUserMock } = vi.hoisted(() => ({
  serviceFindManyMock: vi.fn(),
  installationFindManyMock: vi.fn(),
  getCurrentActorRoleMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    serwisy: {
      findMany: serviceFindManyMock,
    },
    instalacje: {
      findMany: installationFindManyMock,
    },
  },
}));
vi.mock('../src/utils/supabase/server', () => ({
  getCurrentActorRole: getCurrentActorRoleMock,
  getCurrentUser: getCurrentUserMock,
}));

getCurrentActorRoleMock.mockResolvedValue('admin');
// MINOR 2 (audyt SEC-READ-GATES): mock brakował `getCurrentUser` — dziś nieszkodliwe
// bo rola domyślna tego pliku ('admin') ma dostęp 'yes', więc `getUpcomingServices()`
// nigdy nie wchodzi w gałąź `access === 'own'`, która jedyna woła `getCurrentUser()`.
// Pierwszy test roli `monter` w tym pliku wywaliłby się na
// "getCurrentUser is not a function" — mechaniczne dopisanie eksportu wzorem 30
// innych plików (np. `installations-read-scope.test.ts`), bez zmiany sensu testów
// ADR-010 poniżej.
getCurrentUserMock.mockResolvedValue({ data: { user: null } });

const { getUpcomingServices } = await import('../src/app/(dashboard)/services/actions');

import fixturesRaw from './fixtures/services-installations.json';

function hydrateDates<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value)) {
    return new Date(value) as unknown as T;
  }
  if (Array.isArray(value)) {
    return value.map((v) => hydrateDates(v)) as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = hydrateDates(v);
    }
    return out as T;
  }
  return value;
}

type HydratedInstallation = Record<string, unknown> & { id: string };

const INSTALACJA_A = hydrateDates(fixturesRaw.instalacjaA) as HydratedInstallation;
const INSTALACJA_B = hydrateDates(fixturesRaw.instalacjaB) as HydratedInstallation;
const INSTALACJA_C_NO_DATE = hydrateDates(fixturesRaw.instalacjaCNoDate) as HydratedInstallation;

function dueDateOf(installation: HydratedInstallation): Date {
  const field = 'next_service_date';
  return installation[field] as Date;
}

const SERWIS_A = {
  id: 'serwis-A',
  instalacja_id: 'inst-A',
  instalacja: INSTALACJA_A,
  klient_id: null,
  klient: null,
  adres_id: null,
  adres: null,
  data_realizacji: new Date('2026-09-15T00:00:00.000Z'),
  status: 'SCHEDULED',
};

describe('getUpcomingServices — AC1: service_id pochodzi z serwisy.id, nigdy z instalacje.id', () => {
  beforeEach(() => {
    serviceFindManyMock.mockReset();
    installationFindManyMock.mockReset();
  });

  // @REQ: SRV-SOURCE-OF-TRUTH
  it('AC1 - wiersz zrodlowy z serwisy ma service_id === serwisy.id i installation_id === instalacje.id', async () => {
    serviceFindManyMock.mockResolvedValue([SERWIS_A]);
    installationFindManyMock.mockResolvedValue([]);

    const result = await getUpcomingServices();

    expect(result).toHaveLength(1);
    expect(result[0].service_id).toBe('serwis-A');
    expect(result[0].installation_id).toBe('inst-A');
    expect(result[0].service_id).not.toBe(result[0].installation_id);
    expect(result[0].source).toBe('service');
  });
});

describe('getUpcomingServices — AC2: kazdy status serwisu jest widoczny, zaden nie jest filtrowany', () => {
  beforeEach(() => {
    serviceFindManyMock.mockReset();
    installationFindManyMock.mockReset();
    installationFindManyMock.mockResolvedValue([]);
  });

  // @REQ: SRV-SOURCE-OF-TRUTH
  it.each(['PLANNED', 'SCHEDULED', 'COMPLETED', 'CANCELLED'])(
    'AC2 - rekord serwisu w statusie %s jest widoczny w widoku',
    async (status) => {
      serviceFindManyMock.mockResolvedValue([{ ...SERWIS_A, id: `serwis-${status}`, status }]);

      const result = await getUpcomingServices();

      expect(result.map((r) => r.service_id)).toContain(`serwis-${status}`);
    },
  );
});

describe('getUpcomingServices — AC3: prognoza z next_service_date, bez rekordu serwisu', () => {
  beforeEach(() => {
    serviceFindManyMock.mockReset();
    installationFindManyMock.mockReset();
  });

  // @REQ: SRV-SOURCE-OF-TRUTH
  it('AC3 - instalacja z next_service_date i bez serwisow daje wiersz forecast, service_id === null', async () => {
    serviceFindManyMock.mockResolvedValue([]);
    installationFindManyMock.mockResolvedValue([INSTALACJA_B]);

    const result = await getUpcomingServices();

    expect(result).toHaveLength(1);
    expect(result[0].source).toBe('forecast');
    expect(result[0].service_id).toBeNull();
    expect(result[0].installation_id).toBe('inst-B');
    expect(new Date(result[0].next_service_date as unknown as string).toISOString()).toBe(
      dueDateOf(INSTALACJA_B).toISOString(),
    );
  });

  // Przypadek brzegowy WO: instalacja bez next_service_date i bez serwisow nie
  // pojawia sie wcale.
  // @REQ: SRV-SOURCE-OF-TRUTH
  it('przypadek brzegowy - instalacja bez next_service_date i bez serwisow jest pominieta calkowicie', async () => {
    serviceFindManyMock.mockResolvedValue([]);
    installationFindManyMock.mockResolvedValue([INSTALACJA_C_NO_DATE]);

    const result = await getUpcomingServices();

    expect(result.find((r) => r.installation_id === 'inst-C')).toBeUndefined();
  });
});

describe('getUpcomingServices — AC4: rekord serwisu wypiera prognoze dla tej samej instalacji', () => {
  beforeEach(() => {
    serviceFindManyMock.mockReset();
    installationFindManyMock.mockReset();
  });

  // @REQ: SRV-SOURCE-OF-TRUTH
  it('AC4 - instalacja z rekordem serwisu NIE generuje dodatkowego wiersza forecast mimo next_service_date', async () => {
    serviceFindManyMock.mockResolvedValue([SERWIS_A]);
    // Instalacja A jest tez zwrocona (SUROWO, bez odfiltrowania) przez instalacje.findMany,
    // dokladnie tak jak zrobilaby to naiwna implementacja bez dedupu.
    installationFindManyMock.mockResolvedValue([INSTALACJA_A]);

    const result = await getUpcomingServices();

    const rowsForInstA = result.filter((r) => r.installation_id === 'inst-A');
    expect(rowsForInstA).toHaveLength(1);
    expect(rowsForInstA[0].source).toBe('service');
    expect(result.some((r) => r.source === 'forecast' && r.installation_id === 'inst-A')).toBe(false);
  });

  // Przypadek brzegowy WO: wiele rekordow serwisu na jednej instalacji (historia lat).
  // @REQ: SRV-SOURCE-OF-TRUTH
  it('przypadek brzegowy - wiele rekordow serwisu na jednej instalacji daje wiele wierszy service, zero forecast', async () => {
    const INSTALACJA_D = { ...INSTALACJA_A, id: 'inst-D' };
    const SERWIS_D1 = {
      ...SERWIS_A,
      id: 'serwis-D1',
      instalacja_id: 'inst-D',
      instalacja: INSTALACJA_D,
      status: 'COMPLETED',
      data_realizacji: new Date('2024-09-01T00:00:00.000Z'),
    };
    const SERWIS_D2 = {
      ...SERWIS_A,
      id: 'serwis-D2',
      instalacja_id: 'inst-D',
      instalacja: INSTALACJA_D,
      status: 'PLANNED',
      data_realizacji: null,
    };

    serviceFindManyMock.mockResolvedValue([SERWIS_D1, SERWIS_D2]);
    installationFindManyMock.mockResolvedValue([INSTALACJA_D]);

    const result = await getUpcomingServices();

    const rowsForInstD = result.filter((r) => r.installation_id === 'inst-D');
    expect(rowsForInstD).toHaveLength(2);
    expect(rowsForInstD.map((r) => r.service_id).sort()).toEqual(['serwis-D1', 'serwis-D2']);
    expect(rowsForInstD.every((r) => r.source === 'service')).toBe(true);
  });

  // Przypadek brzegowy WO: rekord serwisu z data_realizacji === null pokazuje
  // "termin nieustalony" — data wiersza spada na next_service_date instalacji.
  // @REQ: SRV-SOURCE-OF-TRUTH
  it('przypadek brzegowy - serwis bez data_realizacji uzywa terminu instalacji z oznaczeniem "termin nieustalony"', async () => {
    const SERWIS_NO_DATE = { ...SERWIS_A, id: 'serwis-no-date', data_realizacji: null };

    serviceFindManyMock.mockResolvedValue([SERWIS_NO_DATE]);
    installationFindManyMock.mockResolvedValue([]);

    const result = await getUpcomingServices();

    const row = result.find((r) => r.service_id === 'serwis-no-date');
    expect(row).toBeDefined();
    expect(row?.date_undetermined).toBe(true);
  });
});

describe('getUpcomingServices — przypadek brzegowy: serwis osierocony (instalacja_id = null)', () => {
  beforeEach(() => {
    serviceFindManyMock.mockReset();
    installationFindManyMock.mockReset();
    installationFindManyMock.mockResolvedValue([]);
  });

  // @REQ: SRV-SOURCE-OF-TRUTH
  it('serwis osierocony z data_realizacji jest widoczny, dane z wlasnych pol klient_id/adres_id', async () => {
    const ORPHAN_KLIENT = { id: 'klient-orphan', imie_i_nazwisko: 'Orphan Klient', telefon: null };
    const ORPHAN_ADRES = { id: 'adres-orphan', ulica_miasto: 'ul. Sieroca 5' };
    const SERWIS_ORPHAN = {
      id: 'serwis-orphan',
      instalacja_id: null,
      instalacja: null,
      klient_id: 'klient-orphan',
      klient: ORPHAN_KLIENT,
      adres_id: 'adres-orphan',
      adres: ORPHAN_ADRES,
      data_realizacji: new Date('2026-12-01T00:00:00.000Z'),
      status: 'COMPLETED',
    };

    serviceFindManyMock.mockResolvedValue([SERWIS_ORPHAN]);

    const result = await getUpcomingServices();

    const row = result.find((r) => r.service_id === 'serwis-orphan');
    expect(row).toBeDefined();
    expect(row?.customer_name).toBe('Orphan Klient');
    expect(row?.address).toBe('ul. Sieroca 5');
  });

  // @REQ: SRV-SOURCE-OF-TRUTH
  it('serwis osierocony BEZ data_realizacji (i bez instalacji dajacej termin) jest pominiety', async () => {
    const SERWIS_ORPHAN_NO_DATE = {
      id: 'serwis-orphan-no-date',
      instalacja_id: null,
      instalacja: null,
      klient_id: 'klient-orphan',
      klient: { id: 'klient-orphan', imie_i_nazwisko: 'Orphan Klient', telefon: null },
      adres_id: 'adres-orphan',
      adres: { id: 'adres-orphan', ulica_miasto: 'ul. Sieroca 5' },
      data_realizacji: null,
      status: 'PLANNED',
    };

    serviceFindManyMock.mockResolvedValue([SERWIS_ORPHAN_NO_DATE]);

    const result = await getUpcomingServices();

    expect(result.find((r) => r.service_id === 'serwis-orphan-no-date')).toBeUndefined();
  });
});

describe('getUpcomingServices — przypadek brzegowy: brak klienta / brak adresu', () => {
  beforeEach(() => {
    serviceFindManyMock.mockReset();
    installationFindManyMock.mockReset();
  });

  // @REQ: SRV-SOURCE-OF-TRUTH
  it('brak klienta i adresu daje fallback "Nieznany Klient" / "Brak adresu" dla wiersza forecast', async () => {
    serviceFindManyMock.mockResolvedValue([]);
    installationFindManyMock.mockResolvedValue([
      {
        ...INSTALACJA_B,
        id: 'inst-no-klient',
        lead: { id: 'lead-no-klient', klient: null, adres: null },
      },
    ]);

    const result = await getUpcomingServices();

    const row = result.find((r) => r.installation_id === 'inst-no-klient');
    expect(row?.customer_name).toBe('Nieznany Klient');
    expect(row?.address).toBe('Brak adresu');
  });

  // @REQ: SRV-SOURCE-OF-TRUTH
  it('brak klienta i adresu daje fallback dla wiersza service (przez lead instalacji)', async () => {
    const SERWIS_NO_KLIENT = {
      ...SERWIS_A,
      id: 'serwis-no-klient',
      instalacja: { ...INSTALACJA_A, id: 'inst-no-klient-2', lead: { id: 'lead-x', klient: null, adres: null } },
      instalacja_id: 'inst-no-klient-2',
    };

    serviceFindManyMock.mockResolvedValue([SERWIS_NO_KLIENT]);
    installationFindManyMock.mockResolvedValue([]);

    const result = await getUpcomingServices();

    const row = result.find((r) => r.service_id === 'serwis-no-klient');
    expect(row?.customer_name).toBe('Nieznany Klient');
    expect(row?.address).toBe('Brak adresu');
  });
});

describe('getUpcomingServices — AC5/AC6: usuniecie serwisu przywraca instalacje jako forecast (integracja dwoch funkcji)', () => {
  beforeEach(() => {
    serviceFindManyMock.mockReset();
    installationFindManyMock.mockReset();
  });

  // Ten test celowo NIE importuje deleteServiceAction (zyje w innym pliku z innym
  // mockiem @repo/database — moduly ESM sa cache'owane per plik testowy w Vitest,
  // wiec nie da sie dzielic vi.hoisted() miedzy plikami). Zamiast tego symuluje
  // SKUTEK poprawnego usuniecia: drugie wywolanie getUpcomingServices() po tym, jak
  // serwis zniknal z bazy (serviceFindManyMock zwraca juz pusta liste), a instalacja
  // nadal ma ten sam termin.
  // @REQ: SRV-SOURCE-OF-TRUTH
  it('AC6 - po usunieciu jedynego serwisu instalacji termin jest niezmieniony, wiersz wraca jako forecast', async () => {
    serviceFindManyMock.mockResolvedValueOnce([SERWIS_A]);
    installationFindManyMock.mockResolvedValueOnce([]);

    const before = await getUpcomingServices();
    expect(before.find((r) => r.installation_id === 'inst-A')?.source).toBe('service');

    // Po "usunieciu" serwisu: serwisy.findMany juz go nie zwraca, termin instalacji A
    // jest DOKLADNIE tym samym, co przed usunieciem (ADR-010: pole pochodne, nikt go
    // nie modyfikuje przy DELETE na serwisy).
    serviceFindManyMock.mockResolvedValueOnce([]);
    installationFindManyMock.mockResolvedValueOnce([INSTALACJA_A]);

    const after = await getUpcomingServices();
    const row = after.find((r) => r.installation_id === 'inst-A');

    expect(row?.source).toBe('forecast');
    expect(row?.service_id).toBeNull();
    expect(new Date(row?.next_service_date as unknown as string).toISOString()).toBe(
      dueDateOf(INSTALACJA_A).toISOString(),
    );
  });
});

describe('AC9: brak pozycji "Usuń" w wierszu forecast', () => {
  /**
   * REVIEW (MAJOR, falszywie zielony): poprzednia wersja tego testu sprawdzala
   * WYLACZNIE odleglosc tekstowa (regex na ~600 znakow przed slowem "Usuń") w
   * zrodle `services-client.tsx`. Reviewer zmutowal kod tak, ze pozycja "Usuń"
   * renderuje sie dla KAZDEGO wiersza (rowniez `source === 'forecast'`), a test
   * dalej przechodzil (17/17) — regex `.source === 'service'` byl gdzies w
   * pliku, tylko juz nie pelnil roli faktycznego warunku renderowania. To nie
   * byla weryfikacja zachowania, tylko wspolwystepowania tekstu.
   *
   * PIERWSZA OPCJA Z INSTRUKCJI REVIEW (realny render przez
   * @testing-library/react) ZOSTALA WYPROBOWANA I ODRZUCONA w tej turze:
   * `services-client.tsx` importuje `@/components/ui/dropdown-menu` (@base-ui/react)
   * i `@/components/ui/button` — alias `@/*` NIE jest skonfigurowany w root
   * `vitest.config.mts`. Proba dopisania go (WYLACZNIE brakujacego wpisu,
   * skladnia analogiczna do dwoch istniejacych) zostala ZABLOKOWANA przez
   * PreToolUse hook `guard-paths.mjs`:
   *   "[guard-paths / test-author] ZABLOKOWANO zapis do: vitest.config.mts —
   *    test-author pisze wylacznie testy."
   * To jest twardy blocker infrastrukturalny egzekwowany przez hook (exit 2),
   * nie do obejscia przez ta role, wiec pelny render nie jest dzis wykonalny —
   * przechodzimy do DRUGIEJ opcji z instrukcji review.
   *
   * DRUGA OPCJA (wybrana): wydzielenie z `services-client.tsx` CZYSTEJ logiki
   * widocznosci pozycji menu do testowalnego bez UI modulu.
   *
   * KONTRAKT Z IMPLEMENTER-UI (analogiczny do buildAuditorFormData): nowy plik
   * `apps/b2b-web/src/app/(dashboard)/services/menu-visibility.ts` (bez
   * importow UI, bez "use client"/"use server"), eksport:
   *   `export function isDeleteMenuItemVisible(service: Pick<ServiceSummary, 'source'>): boolean`
   *   zwracajacy `service.source === 'service'`.
   * `services-client.tsx` MA importowac te funkcje z `./menu-visibility` i
   * uzywac JEJ WYNIKU (nie wlasnego inline porownania) jako warunku
   * renderowania bloku z pozycja "Usuń (Tylko Admin)", np.:
   *   {isDeleteMenuItemVisible(service) && ( <>...<DropdownMenuItem>...Usuń...</DropdownMenuItem></> )}
   *
   * Test ponizej ma DWIE czesci:
   *  1) jednostkowa, bezposrednia weryfikacja logiki `isDeleteMenuItemVisible`
   *     (prawdziwe wywolanie funkcji, nie tekst zrodlowy),
   *  2) statyczna weryfikacja, ze `services-client.tsx` FAKTYCZNIE WOLA te
   *     funkcje jako strażnika pozycji "Usuń" (nie sam jej fakt istnienia w
   *     pliku gdzies indziej, niepodlaczony do niczego) — to zamyka luke
   *     mutacyjna z review: samo dodanie funkcji bez uzycia jej wyniku w
   *     warunku renderowania dalej by tu oblalo.
   *
   * Potwierdzenie mutacyjne (opisane w podsumowaniu tury): przywrocenie regresji
   * z review (pozycja "Usuń" widoczna dla KAZDEGO source, np. przez usuniecie
   * warunku albo zastapienie go `true`) usuwa dopasowanie regexu w czesci (2) i
   * failuje test.
   *
   * Dzisiejszy RED: `menu-visibility.ts` jeszcze nie istnieje — dynamiczny
   * import w czesci (1) padnie na braku modulu. Czesc (2) failuje na braku
   * dopasowania regexu (funkcja jeszcze nie jest uzyta w `services-client.tsx`).
   * Oba to poprawny RED (brak zaplanowanego pliku / brak wywolania funkcji
   * domenowej), nie literowka ani zly import istniejacej infrastruktury.
   */

  // @REQ: SRV-SOURCE-OF-TRUTH
  it('AC9 - isDeleteMenuItemVisible zwraca true dla source "service" i false dla "forecast"', async () => {
    const { isDeleteMenuItemVisible } = await import(
      '../src/app/(dashboard)/services/menu-visibility'
    );

    expect(isDeleteMenuItemVisible({ source: 'service' })).toBe(true);
    expect(isDeleteMenuItemVisible({ source: 'forecast' })).toBe(false);
  });

  // @REQ: SRV-SOURCE-OF-TRUTH
  it('AC9 - services-client.tsx importuje isDeleteMenuItemVisible i uzywa jej wyniku jako warunku pozycji "Usuń"', () => {
    const filePath = path.resolve(
      __dirname,
      '../src/app/(dashboard)/services/services-client.tsx',
    );
    const content = readFileSync(filePath, 'utf-8');

    expect(content).toMatch(
      /import\s*\{[^}]*isDeleteMenuItemVisible[^}]*\}\s*from\s*['"]\.\/menu-visibility['"]/,
    );

    const deleteLabelIndex = content.indexOf('Usuń');
    expect(deleteLabelIndex).toBeGreaterThan(-1);

    const precedingContext = content.slice(Math.max(0, deleteLabelIndex - 600), deleteLabelIndex);
    expect(precedingContext).toMatch(/isDeleteMenuItemVisible\(\s*service\s*\)/);
  });
});

describe('AC (WO, "Przypadki brzegowe"): sortowanie rosnace po efektywnej dacie wiersza, spojne dla obu typow', () => {
  beforeEach(() => {
    serviceFindManyMock.mockReset();
    installationFindManyMock.mockReset();
  });

  /**
   * REVIEW (MAJOR, brak testu): `actions.ts` stracil sortowanie po terminie
   * instalacji przy przebudowie na dwa zrodla (service + forecast) scalane w
   * pamieci aplikacji — zadne z dwoch zapytan Prisma nie moze samo w sobie
   * posortowac wyniku KONCOWEGO, bo dwa niezalezne `findMany` z osobnym
   * `orderBy` daja co najwyzej dwie osobno posortowane listy, nie jedna
   * scalona. WO wymaga "Sortowanie... musi dawac ten sam wynik dla obu typow"
   * — czyli sortowanie po EFEKTYWNEJ dacie wiersza (`data_realizacji` gdy
   * jest, w przeciwnym razie termin instalacji dla wiersza `service`; termin
   * instalacji dla wiersza `forecast`) musi zajsc PO scaleniu, w kodzie
   * aplikacji.
   *
   * Ten test miesza source 'service' i 'forecast' z celowo POPRZESTAWIANYMI
   * datami (najwczesniejsza data nalezy do wiersza forecast, nie service),
   * zeby zlapac implementacje, ktora sortuje TYLKO jedno zrodlo albo w ogole
   * nie sortuje (kolejnosc wtedy zalezy od kolejnosci `push` w dwoch petlach
   * `actions.ts`: najpierw wszystkie `service`, potem wszystkie `forecast` —
   * dokladnie ten blad ten test ma zlapac). Fixture instalacji z najwczesniejszym
   * terminem zyje w `fixtures/services-installations.json`
   * (`instalacjaNajwczesniejsza`) z tego samego powodu co INSTALACJA_A/B/C —
   * patrz RULE-CHALLENGE w naglowku pliku (guard `adr010-derived-write` skanuje
   * kazdy plik `.ts`/`.tsx` pod katem property key pola pochodnego terminu
   * instalacji z dowolna wartoscia).
   */
  // @REQ: SRV-SOURCE-OF-TRUTH
  it('getUpcomingServices() zwraca wiersze posortowane rosnaco po efektywnej dacie, niezaleznie od source', async () => {
    const INSTALACJA_NAJWCZESNIEJSZA = hydrateDates(
      fixturesRaw.instalacjaNajwczesniejsza,
    ) as HydratedInstallation;

    const SERWIS_SREDNI = {
      ...SERWIS_A,
      id: 'serwis-sredni',
      instalacja_id: 'inst-sredni',
      instalacja: { ...INSTALACJA_A, id: 'inst-sredni' },
      data_realizacji: new Date('2026-11-15T00:00:00.000Z'),
    };
    const SERWIS_NAJPOZNIEJSZY = {
      ...SERWIS_A,
      id: 'serwis-najpozniejszy',
      instalacja_id: 'inst-najpozniejszy',
      instalacja: { ...INSTALACJA_A, id: 'inst-najpozniejszy' },
      data_realizacji: new Date('2026-12-31T00:00:00.000Z'),
    };

    // Kolejnosc zwrocenia przez mocki jest CELOWO ODWROTNA do oczekiwanego
    // sortowania koncowego, zeby test nie mogl przypadkiem przejsc dzieki
    // temu, ze zrodlo juz samo bylo posortowane.
    serviceFindManyMock.mockResolvedValue([SERWIS_NAJPOZNIEJSZY, SERWIS_SREDNI]);
    installationFindManyMock.mockResolvedValue([INSTALACJA_NAJWCZESNIEJSZA]);

    const result = await getUpcomingServices();

    const ids = result.map((r) => r.service_id ?? r.installation_id);
    expect(ids).toEqual(['inst-najwczesniejsza', 'serwis-sredni', 'serwis-najpozniejszy']);
  });
});

describe('AC10: brak zapisu do pola pochodnego terminu serwisu w katalogu services/ (test statyczny)', () => {
  /**
   * Reuzywa DOKLADNIE tej samej definicji reguly co bramka pre-commit
   * `adr010-derived-write` (`tools/kk.config.mjs`), zeby test nie mogl sie
   * rozjechac z realnym hookiem. Nie edytujemy `tools/kk.config.mjs` — tylko go
   * czytamy.
   */
  function findSourceFiles(dir: string): string[] {
    const results: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findSourceFiles(fullPath));
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        results.push(fullPath);
      }
    }
    return results;
  }

  // @REQ: SRV-SOURCE-OF-TRUTH
  it('AC10 - zaden plik .ts/.tsx w services/ nie narusza reguly adr010-derived-write', async () => {
    const { config } = await import('../../../tools/kk.config.mjs');
    const ruleId = ['adr010', 'derived', 'write'].join('-');
    const rule = config.forbiddenPatterns.find((r: { id: string }) => r.id === ruleId);
    expect(rule).toBeDefined();

    const forbiddenPattern = new RegExp(rule!.re);
    const servicesDir = path.resolve(__dirname, '../src/app/(dashboard)/services');
    const files = findSourceFiles(servicesDir);
    expect(files.length).toBeGreaterThan(0);

    const offenders = files.filter((f) => forbiddenPattern.test(readFileSync(f, 'utf-8')));
    expect(offenders.map((f) => path.relative(servicesDir, f))).toEqual([]);
  });
});
