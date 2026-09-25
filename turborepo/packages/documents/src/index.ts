import fs from "node:fs"
import path from "node:path"
import crypto from "node:crypto"
import zlib from "node:zlib"
import type { Prisma } from "@repo/database"

export interface RenderDocumentOptions {
  templateName: string
  data: Record<string, string | number>
}

export interface RenderDocumentResult {
  buffer: Buffer
  contentHash: string
  templateVersion: string
  isDraft: boolean
}

export interface SaveDocumentOptions {
  kind: "HANDOVER_PROTOCOL" | "INSTALLATION_CONTRACT" | "QUOTE" | "INVOICE"
  sourceType: string
  sourceId: string
  storagePath: string
  contentHash: string
  templateVersion: string
}

function resolveTemplatePath(templateName: string): string {
  const candidates = [
    path.resolve(process.cwd(), "docs/legal", templateName),
    path.resolve(process.cwd(), "../../docs/legal", templateName),
    path.resolve(process.cwd(), "../../../docs/legal", templateName),
    path.resolve(__dirname, "../../../docs/legal", templateName),
    path.resolve(__dirname, "../../../../docs/legal", templateName),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  throw new Error(`Szablon dokumentu ${templateName} nie został odnaleziony w katalogu docs/legal`)
}

export function extractTemplateVersion(templateName: string): string {
  const match = templateName.match(/(v\d+\.\d+(?:-[a-z0-9]+)?)/i)
  return match ? match[1]! : "v1.0"
}

export function getTemplateRequiredFields(templateName: string): string[] {
  const filePath = resolveTemplatePath(templateName)
  const buf = fs.readFileSync(filePath)
  const latin = buf.toString("latin1")
  const fields = new Set<string>()

  const streamRegex = /stream\r?\n([\s\S]*?)\r?\nendstream/g
  let match: RegExpExecArray | null

  while ((match = streamRegex.exec(latin)) !== null) {
    const rawStream = Buffer.from(match[1]!, "latin1")
    try {
      const text = zlib.inflateSync(rawStream).toString("utf-8")
      const placeholders = text.match(/\{\{([a-zA-Z0-9_]+)\}\}/g)
      if (placeholders) {
        for (const p of placeholders) {
          fields.add(p.slice(2, -2))
        }
      }
    } catch {
      // Ignorujemy strumienie, które nie są FlateDecode lub dekompresja się nie powiodła
    }
  }

  return Array.from(fields)
}

export function renderDocumentPdf(options: RenderDocumentOptions): RenderDocumentResult {
  const { templateName, data } = options
  const filePath = resolveTemplatePath(templateName)
  const templateVersion = extractTemplateVersion(templateName)
  const isDraft = templateVersion.includes("-lorem")

  // Weryfikacja brakujących pól z szablonu (Kryterium 3 DOC-PDF-RENDER)
  const requiredFields = getTemplateRequiredFields(templateName)
  const missingFields = requiredFields.filter((f) => data[f] === undefined || data[f] === null || data[f] === "")
  if (missingFields.length > 0) {
    throw new Error(
      `Brakujące pola w szablonie ${templateName}: ${missingFields.join(", ")}. Wszystkie pola {{...}} muszą zostać wypełnione.`
    )
  }

  const buf = fs.readFileSync(filePath)
  const latin = buf.toString("latin1")

  const objRegex = /(\d+)\s+(\d+)\s+obj([\s\S]*?)endobj/g
  const objects = new Map<number, { id: number; gen: number; body: string }>()
  let match: RegExpExecArray | null

  while ((match = objRegex.exec(latin)) !== null) {
    const id = parseInt(match[1]!, 10)
    const gen = parseInt(match[2]!, 10)
    const body = match[3]!
    objects.set(id, { id, gen, body })
  }

  const trailerIdx = latin.lastIndexOf("trailer")
  const trailerEnd = latin.lastIndexOf("startxref")
  const trailerDict = trailerIdx !== -1 && trailerEnd !== -1 ? latin.slice(trailerIdx + 7, trailerEnd).trim() : "<< >>"

  const maxId = Math.max(...Array.from(objects.keys()), 0)
  const processedObjects: { id: number; gen: number; content: string }[] = []

  for (let id = 1; id <= maxId; id++) {
    const obj = objects.get(id)
    if (!obj) continue

    const streamStart = obj.body.indexOf("stream")
    if (streamStart !== -1) {
      let contentStart = streamStart + 6
      if (obj.body[contentStart] === "\r") contentStart++
      if (obj.body[contentStart] === "\n") contentStart++

      const streamEnd = obj.body.indexOf("endstream", contentStart)
      if (streamEnd !== -1) {
        const header = obj.body.slice(0, streamStart)
        const rawStream = Buffer.from(obj.body.slice(contentStart, streamEnd), "latin1")

        if (header.includes("/FlateDecode")) {
          try {
            const uncompressed = zlib.inflateSync(rawStream).toString("utf-8")
            let replaced = uncompressed
            for (const [k, v] of Object.entries(data)) {
              replaced = replaced.split("{{" + k + "}}").join(String(v))
            }

            // Deterministyczna kompresja: stały level 9
            const recompressed = zlib.deflateSync(Buffer.from(replaced, "utf-8"), { level: 9 })
            const newHeader = header.replace(/\/Length\s+\d+/, `/Length ${recompressed.length}`)
            const newObjBody = `${newHeader}stream\r\n${recompressed.toString("latin1")}\r\nendstream\r\n`
            processedObjects.push({
              id: obj.id,
              gen: obj.gen,
              content: `${obj.id} ${obj.gen} obj\r\n${newObjBody}endobj\r\n`,
            })
            continue
          } catch {
            // fallback do surowego obiektu
          }
        }
      }
    }

    processedObjects.push({
      id: obj.id,
      gen: obj.gen,
      content: `${obj.id} ${obj.gen} obj${obj.body}endobj\r\n`,
    })
  }

  // Składanie wynikowego PDF-a z deterministyczną tabelą xref
  let out = "%PDF-1.3\r\n"
  const offsets = new Map<number, number>()
  offsets.set(0, 0)

  for (const obj of processedObjects) {
    offsets.set(obj.id, Buffer.byteLength(out, "latin1"))
    out += obj.content
  }

  const startxref = Buffer.byteLength(out, "latin1")
  out += "xref\r\n"
  out += `0 ${maxId + 1}\r\n`
  out += "0000000000 65535 f \r\n"
  for (let i = 1; i <= maxId; i++) {
    const off = offsets.get(i) || 0
    out += String(off).padStart(10, "0") + " 00000 n \r\n"
  }
  out += "trailer\r\n" + trailerDict + "\r\n"
  out += `startxref\r\n${startxref}\r\n%%EOF\r\n`

  const renderedBuffer = Buffer.from(out, "latin1")
  const contentHash = crypto.createHash("sha256").update(renderedBuffer).digest("hex")

  return {
    buffer: renderedBuffer,
    contentHash,
    templateVersion,
    isDraft,
  }
}

export async function saveDocumentRecord(
  tx: Prisma.TransactionClient,
  options: SaveDocumentOptions
): Promise<{ id: string }> {
  const { kind, sourceType, sourceId, storagePath, contentHash, templateVersion } = options

  if (!sourceType || !sourceId || !sourceType.trim() || !sourceId.trim()) {
    throw new Error("Wskazanie źródła (sourceType oraz sourceId) jest obowiązkowe do zapisu dokumentu.")
  }

  const doc = await tx.document.create({
    data: {
      kind,
      sourceType: sourceType.trim(),
      sourceId: sourceId.trim(),
      storagePath,
      contentHash,
      templateVersion,
    },
  })

  return { id: doc.id }
}
