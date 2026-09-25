import { prisma } from "@repo/database"
import type { PriceListItemVersion } from "@repo/database"

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
    return {
      ok: false,
      error: {
        code: "PRICE_LIST_VERSION_CONFLICT",
        message: error instanceof Error ? error.message : String(error),
      },
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
export async function importPriceList(csvContent: string): Promise<PriceListImportReport> {
  const report: PriceListImportReport = {
    createdItems: 0,
    createdVersions: 0,
    updatedVersions: 0,
    skipped: [],
    metadataWarnings: [],
    priceChanges: [],
  }

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
      // Import atomowy: pozycja i jej pierwsza wersja powstają razem albo wcale.
      await prisma.$transaction(async (tx) => {
        const item = await tx.priceListItem.create({
          data: { name, description, unit, category, scope },
        })
        await tx.priceListItemVersion.create({
          data: { priceListItemId: item.id, salePriceNet, crewCostNet, isCurrent: true },
        })
      })
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
    }
  }

  return report
}
