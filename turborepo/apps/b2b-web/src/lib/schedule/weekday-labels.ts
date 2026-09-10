/**
 * FLD-AVAIL-WEEKLY-RULES (WO, blok C): etykiety dni tygodnia po polsku, w kolejności
 * ISO-8601 (poniedziałek=1 … niedziela=7, zgodnie z `EXTRACT(ISODOW)` w bazie i
 * `isoWeekday()` w `effective-availability.ts`). Czysty moduł bez importów UI — jedno
 * źródło etykiet dla ekranu `/me/schedule`, żeby nie duplikować kolejności/nazw dni
 * w kilku komponentach.
 */
export const WEEKDAY_LABELS: ReadonlyArray<{ weekday: number; label: string }> = [
  { weekday: 1, label: "Poniedziałek" },
  { weekday: 2, label: "Wtorek" },
  { weekday: 3, label: "Środa" },
  { weekday: 4, label: "Czwartek" },
  { weekday: 5, label: "Piątek" },
  { weekday: 6, label: "Sobota" },
  { weekday: 7, label: "Niedziela" },
]
