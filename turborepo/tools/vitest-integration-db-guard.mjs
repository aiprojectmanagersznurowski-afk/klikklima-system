/**
 * D-2 follow-up (2026-09-10, po incydencie): pierwszy przebieg
 * `create-booking-concurrency.itest.ts` w tym środowisku połączył się z żywą bazą
 * produkcyjną Supabase (`aws-1-eu-central-1.pooler.supabase.com`), nie z lokalnym stackiem
 * `supabase start` — DATABASE_URL w `.env` wskazywał na produkcję, a nic tego nie
 * sprawdzało. Sprzątanie w tamtym przebiegu zadziałało (zero śladu), ale to przypadek,
 * nie gwarancja: awaria w środku testu współbieżności = osierocone wiersze powiązane
 * z realnymi audytorami/leadami na produkcji, a dwa równoległe żądania na współdzieloną
 * bazę to dokładnie ten rodzaj testu, który psuje stan, gdy coś pójdzie nie tak.
 *
 * Ten plik jest `globalSetup` dla `vitest.integration.config.mts` — uruchamia się RAZ,
 * przed jakimkolwiek testem, i przerywa CAŁY przebieg, jeśli `DATABASE_URL` nie wygląda
 * na lokalny stack Supabase CLI (`supabase start` nasłuchuje domyślnie na
 * `127.0.0.1:54322`). To allowlist, nie blocklist jednego znanego złego hosta — każdy
 * host inny niż lokalny jest odrzucany, nie tylko ten jeden, który już nas ugryzł.
 */
export default function setup() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    throw new Error(
      '[itest-db-guard] DATABASE_URL nie jest ustawione. Testy integracyjne wymagają lokalnego ' +
        'stacku Supabase CLI — uruchom `supabase start` w katalogu repo przed `npm run test:integration`.',
    );
  }

  let host;
  try {
    host = new URL(url.replace(/^postgres(ql)?:\/\//, 'http://')).hostname;
  } catch {
    throw new Error(`[itest-db-guard] DATABASE_URL nie jest poprawnym URL-em połączenia: ${url}`);
  }

  const ALLOWED_LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
  if (!ALLOWED_LOCAL_HOSTS.has(host)) {
    throw new Error(
      `[itest-db-guard] DATABASE_URL wskazuje na host "${host}", który NIE jest lokalnym stackiem ` +
        '(dozwolone: 127.0.0.1, localhost, ::1). Testy integracyjne otwierają realne równoległe ' +
        'połączenia i piszą/kasują wiersze — uruchomienie ich na czymkolwiek poza lokalnym `supabase ' +
        'start` ryzykuje dane na współdzielonej albo produkcyjnej bazie. Jeśli to naprawdę zamierzone ' +
        '(np. dedykowana baza CI), zmień tę allowlistę świadomie, nie omijaj jej.',
    );
  }
}
