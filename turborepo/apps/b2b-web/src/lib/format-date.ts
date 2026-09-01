import { formatInTimeZone } from "date-fns-tz";
import { pl } from "date-fns/locale";

// format() z date-fns czyta lokalną strefę czasową środowiska uruchomieniowego JS,
// żeby wyrenderować składowe dnia/godziny. Next.js renderuje komponenty kliencie
// po stronie serwera na Vercelu (UTC), a hydratuje je w przeglądarce odwiedzającego
// (Europe/Warsaw) - dwie różne strefy lokalne dla tego samego momentu produkują
// różny tekst, co jest dokładnie błędem React #418 (niezgodność tekstu przy hydracji).
// Jawne przypięcie strefy czasowej sprawia, że wynik jest identyczny wszędzie,
// gdzie ten plik jest uruchamiany.
export const APP_TIMEZONE = "Europe/Warsaw";

export function formatDate(
  date: Date | string | null | undefined,
  pattern: string,
): string {
  if (date === null || date === undefined || date === "") {
    return "—";
  }

  if (Number.isNaN(new Date(date).getTime())) {
    return "—";
  }

  return formatInTimeZone(date, APP_TIMEZONE, pattern, { locale: pl });
}
