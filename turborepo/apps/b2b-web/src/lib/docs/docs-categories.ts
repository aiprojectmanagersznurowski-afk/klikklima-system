/**
 * Metadane kategorii dokumentacji (etykiety, katalogi) — DANE, bez `node:fs`. Wydzielone z
 * `docs-catalog.ts`, żeby komponenty klienckie (np. `dokumentacja/docs-list-client.tsx`,
 * `"use client"`) mogły je zaimportować bezpośrednio, bez ściągania do bundla przeglądarki
 * modułu, który dotyka `node:fs` (Next.js odmawia zbudowania chunku klienckiego z
 * `node:fs` — "the chunking context does not support external modules"). `docs-catalog.ts`
 * re-eksportuje `DOC_CATEGORIES` z tego pliku — kontrakt testów importujący je z
 * `docs-catalog` pozostaje niezmieniony.
 */
export type DocCategory = { id: string; label: string; dir: string }

export const DOC_CATEGORIES: readonly DocCategory[] = [
  { id: "prezentacje", label: "Materiały biznesowe", dir: "prezentacje" },
  { id: "root", label: "Zasady i decyzje", dir: "" },
  { id: "architecture", label: "Architektura systemu", dir: "architecture" },
  { id: "workflows", label: "Procesy i przepływy", dir: "workflows" },
  { id: "workorders", label: "Zlecenia wdrożeniowe", dir: "workorders" },
  { id: "testing", label: "Scenariusze testowe", dir: "testing" },
]
