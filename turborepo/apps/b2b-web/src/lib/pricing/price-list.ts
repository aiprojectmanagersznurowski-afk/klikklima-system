import { prisma } from "@repo/database"
import type { PriceListItemVersion } from "@repo/database"
import { extractSqlState } from "@repo/scheduling"
import { AUDIT_REQUIREMENTS } from "@klikklima/contracts"

/**
 * WO: docs/workorders/PRICE-LIST-IMPORT.md — PRICE-LIST-SCHEMA (AC-S5, przypadek brzegowy
 * "Współbieżność publikacji ceny") i PRICE-LIST-IMPORT (AC-I1…AC-I6 poza bramki roli).
 *
 * Ceny NIGDY nie nadpisują się w miejscu — `publishPriceVersion` jest jedynym punktem
 * zapisu nowej ceny, wspólnym dla importu (ten plik) i P2 (`PRICE-LIST-ADMIN`, poza
 * zakresem). Kolejność w transakcji wymuszona przez WO: najpierw zdjęcie `is_current`
 * ze starej wersji, potem wstawienie nowej — dwie równoległe publikacje tej samej
 * pozycji kończą się jednym sukcesem i jednym błędem DOMENOWYM (nigdy surowym
 * P2002/23505), wykrytym przez izolację `Serializable`.
 */

const ALLOWED_UNITS = new Set(["mb", "szt", "m"])
const ALLOWED_SCOPES = new Set(["ROOM", "INSTALLATION"])
const ALLOWED_CATEGORIES = new Set(["MATERIAL", "LABOR", "MATERIAL_LABOR"])

/** NUMERIC(12,2) w bazie — kwota musi mieć co najwyżej 2 miejsca po przecinku, separator: kropka. */
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/

/** legal_basis neutralny — import cennika nie jest operacją RODO, nie ma sensownej wartości w słowniku. */
const IMPORT_LEGAL_BASIS = AUDIT_REQUIREMENTS.legalBases.at(-1)!

/**
 * Kontekst audytowy przekazywany przez wołający kod (Server Action, który ZNA sesję
 * użytkownika). Wartość domyślna istnieje wyłącznie dla wywołań, którym kontekst nie ma
 * skąd przyjść (np. testy integracyjne wołające `importPriceList` bez sesji) — `actorEmail`
 * w `audit_log` jest NOT NULL, więc funkcja domenowa nie może zostawić go puste.
 */
export type ImportAuditContext = { actorEmail: string; actorRole: string }
const DEFAULT_AUDIT_CONTEXT: ImportAuditContext = { actorEmail: "system@klikklima.pl", actorRole: "system" }

export type PublishPriceVersionInput = {
  priceListItemId: string
  salePriceNet: number | string
  crewCostNet?: number | string | null
}

export type PublishPriceVersionResult =
  | { ok: true; version: PriceListItemVersion }
  | { ok: false; error: { code: string; message?: string } }

/**
 * AC-S5 / przypadek brzegowy "Współbieżność publikacji ceny": jedyny punkt zapisu nowej
 * ceny. Zdejmuje `is_current` ze starej wersji (jeśli istnieje) i wstawia nową w JEDNEJ
 * transakcji `Serializable` — indeks częściowy `price_list_item_versions_current_per_item_key`
 * w bazie pilnuje, że nigdy nie powstaną dwie wersje `is_current=true` naraz, nawet gdy
 * dwie publikacje tej samej pozycji nadchodzą równolegle. Przegrana transakcja dostaje
 * kod domenowy — surowy SQLSTATE/kod Prisma NIGDY nie przecieka do wołającego.
 */
export async function publishPriceVersion(
  input: PublishPriceVersionInput
): Promise<PublishPriceVersionResult> {
  try {
    const version = await prisma.$transaction(
      async (tx) => {
        await tx.priceListItemVersion.updateMany({
          where: { priceListItemId: input.priceListItemId, isCurrent: true },
          data: { isCurrent: false },
        })

        return tx.priceListItemVersion.create({
          data: {
            priceListItemId: input.priceListItemId,
            salePriceNet: input.salePriceNet,
            crewCostNet: input.crewCostNet ?? null,
            isCurrent: true,
          },
        })
      },
      { isolationLevel: "Serializable" }
    )

    return { ok: true, version }
  } catch (error) {
    // Surowy SQLSTATE/kod Prisma NIGDY nie przecieka do wołającego (WO, AC-S5) — może
    // zawierać nazwy kolumn/tabel albo fragmenty zapytania. Rozróżniamy WYŁĄCZNIE kody
    // spójne z wyścigiem publikacji (40001 — porażka izolacji `Serializable`; 23505/P2002 —
    // naruszenie indeksu częściowego `..._current_per_item_key`, gdyby wyścig zdążył
    // wstawić drugi wiersz przed sprawdzeniem serializowalności) od pozostałych błędów bazy.
    const sqlState = extractSqlState(error)
    if (sqlState === "40001" || sqlState === "23505") {
      return {
        ok: false,
        error: { code: "PRICE_LIST_VERSION_CONFLICT", message: "Konflikt równoległej publikacji ceny." },
      }
    }
    return {
      ok: false,
      error: { code: "PRICE_LIST_VERSION_WRITE_FAILED", message: "Nie udało się zapisać nowej wersji ceny." },
    }
  }
}

export type PriceListSkipReport = { name: string; reason: string }
export type PriceListMetadataWarning = { name: string; field: string }
export type PriceListPriceChange = {
  itemId: string
  itemName: string
  before: { salePriceNet: number; crewCostNet: number | null }
  after: { salePriceNet: number; crewCostNet: number | null }
}

export type PriceListImportReport = {
  createdItems: number
  createdVersions: number
  updatedVersions: number
  skipped: PriceListSkipReport[]
  metadataWarnings: PriceListMetadataWarning[]
  priceChanges: PriceListPriceChange[]
}

type ParsedRow = {
  name: string
  description: string | null
  unit: string
  category: string | null
  scope: string
  crewCostNet: string | null
  salePriceNet: string
}

type ParseRowResult = { ok: true; value: ParsedRow } | { ok: false; name: string; reason: string }

/**
 * Parser MINIMALNY jednej linii CSV, ze wsparciem pól w cudzysłowie (przypadek brzegowy
 * "Pole z przecinkiem w cudzysłowie" — WO). Bez dodawania paczki (WO, "Nie dodawać paczki").
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ",") {
      result.push(current)
      current = ""
    } else {
      current += char
    }
  }
  result.push(current)
  return result
}

/** Kolumny w tej dokładnej kolejności — arkusz z zamienionymi `crew_cost_net`/`sale_price_net`
 * (albo jakąkolwiek inną permutacją) MUSI być odrzucony w całości, nie zaimportowany po cichu
 * z pomieszanymi wartościami. */
const EXPECTED_HEADER = "category,item_name,description,unit,crew_cost_net,sale_price_net,scope"

function assertHeader(csvContent: string): void {
  const firstLine = csvContent.split(/\r?\n/)[0]?.trim() ?? ""
  if (firstLine !== EXPECTED_HEADER) {
    throw new Error("PRICE_LIST_HEADER_MISMATCH")
  }
}

function parseCsvRows(csvContent: string): string[][] {
  const lines = csvContent.split(/\r?\n/).filter((line) => line.trim().length > 0)
  return lines.slice(1).map(parseCsvLine)
}

function mapCategory(raw: string): { ok: true; value: string | null } | { ok: false } {
  const normalized = raw.trim().toLowerCase()
  if (normalized === "") return { ok: true, value: null }
  if (normalized === "materiał") return { ok: true, value: "MATERIAL" }
  if (normalized === "robocizna") return { ok: true, value: "LABOR" }
  if (["robocizno-materiał", "mr", "rm"].includes(normalized)) {
    return { ok: true, value: "MATERIAL_LABOR" }
  }
  return { ok: false }
}

function parseAmount(raw: string): string | null {
  const trimmed = raw.trim()
  if (!AMOUNT_PATTERN.test(trimmed)) return null
  return trimmed
}

function parseRow(fields: string[]): ParseRowResult {
  const [categoryRaw = "", nameRaw = "", descriptionRaw = "", unitRaw = "", crewCostRaw = "", salePriceRaw = "", scopeRaw = ""] =
    fields
  const name = nameRaw.trim()

  if (name === "") {
    return { ok: false, name, reason: "Nazwa pozycji jest pusta — wiersz pominięty" }
  }

  const category = mapCategory(categoryRaw)
  if (!category.ok) {
    return { ok: false, name, reason: `Kategoria nieznana: "${categoryRaw.trim()}"` }
  }

  const unit = unitRaw.trim()
  if (!ALLOWED_UNITS.has(unit)) {
    return { ok: false, name, reason: `Jednostka nieznana: "${unit}"` }
  }

  const scope = scopeRaw.trim()
  if (scope === "") {
    return { ok: false, name, reason: "Brak wartości scope — wiersz pominięty" }
  }
  if (!ALLOWED_SCOPES.has(scope)) {
    return { ok: false, name, reason: `Zasięg nieznany: "${scope}"` }
  }

  const salePriceNet = parseAmount(salePriceRaw)
  if (salePriceNet === null) {
    return { ok: false, name, reason: `sale_price_net nieprawidłowe: "${salePriceRaw.trim()}"` }
  }

  const crewCostTrimmed = crewCostRaw.trim()
  let crewCostNet: string | null = null
  if (crewCostTrimmed !== "") {
    const parsedCrewCost = parseAmount(crewCostTrimmed)
    if (parsedCrewCost === null) {
      return { ok: false, name, reason: `crew_cost_net nieprawidłowe: "${crewCostTrimmed}"` }
    }
    crewCostNet = parsedCrewCost
  }

  const description = descriptionRaw.trim() === "" ? null : descriptionRaw

  return {
    ok: true,
    value: { name, description, unit, category: category.value, scope, crewCostNet, salePriceNet },
  }
}

/**
 * AC-I1…AC-I5 + przypadki brzegowe (WO). Idempotentny po `name` (klucz naturalny — UNIQUE
 * w bazie): wiersz pozycji już istniejącej NIGDY nie nadpisuje metadanych
 * (`description`/`category`/`unit`/`scope` — różnica trafia do `metadataWarnings`) i nie
 * reaktywuje pozycji nieaktywnej. Zmiana ceny publikuje nową wersję przez
 * `publishPriceVersion` (AC-S5) — poprzednia wersja zostaje nietknięta.
 *
 * Import atomowy WZGLĘDEM POZYCJI: wiersz odrzucony walidacją (jednostka/kategoria/scope/
 * kwota nieznana) jest pominięty PRZED jakimkolwiek zapisem — nie zostawia pozycji bez
 * wersji ani wersji bez `is_current`. Utworzenie nowej pozycji i jej pierwszej wersji
 * idzie w JEDNEJ transakcji z tego samego powodu.
 */
export async function importPriceList(
  csvContent: string,
  auditContext: ImportAuditContext = DEFAULT_AUDIT_CONTEXT
): Promise<PriceListImportReport> {
  const report: PriceListImportReport = {
    createdItems: 0,
    createdVersions: 0,
    updatedVersions: 0,
    skipped: [],
    metadataWarnings: [],
    priceChanges: [],
  }

  assertHeader(csvContent)

  const rows = parseCsvRows(csvContent)

  for (const fields of rows) {
    const parsed = parseRow(fields)
    if (!parsed.ok) {
      report.skipped.push({ name: parsed.name, reason: parsed.reason })
      continue
    }

    const { name, description, unit, category, scope, crewCostNet, salePriceNet } = parsed.value

    const existing = await prisma.priceListItem.findUnique({
      where: { name },
      include: { versions: { where: { isCurrent: true } } },
    })

    if (!existing) {
      // Import atomowy: pozycja i jej pierwsza wersja powstają razem albo wcale. Błąd bazy
      // (np. `sale_price_net` przekraczające precyzję NUMERIC(12,2)) NIE MOŻE przerwać
      // przetwarzania pozostałych wierszy tego samego pliku — transakcja tej jednej pozycji
      // wycofuje się sama, a wiersz trafia do `skipped` z sanitized przyczyną (surowy
      // SQLSTATE/komunikat Postgresa nigdy nie przecieka do raportu).
      try {
        await prisma.$transaction(async (tx) => {
          const item = await tx.priceListItem.create({
            data: { name, description, unit, category, scope },
          })
          await tx.priceListItemVersion.create({
            data: { priceListItemId: item.id, salePriceNet, crewCostNet, isCurrent: true },
          })
          // DECYZJA CZŁOWIEKA (nieodwołalna): wpis audytowy powstaje TERAZ, w TEJ SAMEJ
          // transakcji co zapis pozycji/wersji — błąd zapisu (np. przekroczenie precyzji
          // NUMERIC(12,2)) wycofuje OBIE części razem, zamiast zostawić audyt bez pozycji
          // albo pozycję bez audytu.
          await tx.auditLog.create({
            data: {
              operation: "field_update",
              resource: "price_list_items",
              recordId: item.id,
              actorEmail: auditContext.actorEmail,
              actorRole: auditContext.actorRole,
              justification: `Import cennika utworzył nową pozycję "${name}".`,
              legalBasis: IMPORT_LEGAL_BASIS,
            },
          })
        })
      } catch {
        report.skipped.push({ name, reason: "Błąd zapisu w bazie danych — wiersz pominięty" })
        continue
      }
      report.createdItems += 1
      report.createdVersions += 1
      continue
    }

    // Pozycja nieaktywna nie jest reaktywowana importem (WO) — ani metadane, ani cena
    // nie są dotykane.
    if (!existing.isActive) {
      continue
    }

    if (existing.description !== description) {
      report.metadataWarnings.push({ name, field: "description" })
    }
    if (existing.category !== category) {
      report.metadataWarnings.push({ name, field: "category" })
    }
    if (existing.unit !== unit) {
      report.metadataWarnings.push({ name, field: "unit" })
    }
    if (existing.scope !== scope) {
      report.metadataWarnings.push({ name, field: "scope" })
    }

    const currentVersion = existing.versions[0]
    const currentSale = currentVersion ? Number(currentVersion.salePriceNet) : undefined
    const currentCrew = currentVersion
      ? currentVersion.crewCostNet === null
        ? null
        : Number(currentVersion.crewCostNet)
      : undefined
    const nextCrew = crewCostNet === null ? null : Number(crewCostNet)

    const priceChanged =
      currentVersion === undefined || currentSale !== Number(salePriceNet) || currentCrew !== nextCrew

    if (!priceChanged) {
      continue
    }

    const published = await publishPriceVersion({ priceListItemId: existing.id, salePriceNet, crewCostNet })
    if (published.ok) {
      report.updatedVersions += 1
      report.priceChanges.push({
        itemId: existing.id,
        itemName: name,
        before: { salePriceNet: currentSale ?? 0, crewCostNet: currentCrew ?? null },
        after: { salePriceNet: Number(salePriceNet), crewCostNet: nextCrew },
      })
    } else {
      // MAJOR (audyt): publikacja nieudana (konflikt równoległej publikacji albo błąd
      // zapisu) nie może po cichu zniknąć — admin widzi w raporcie, że TA pozycja NIE
      // zmieniła ceny, mimo że wiersz z nową ceną był w pliku.
      report.skipped.push({
        name,
        reason: `Publikacja nowej ceny nie powiodła się — konflikt publikacji (${published.error.code})`,
      })
    }
  }

  return report
}
