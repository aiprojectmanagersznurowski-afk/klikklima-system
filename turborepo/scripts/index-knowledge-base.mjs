#!/usr/bin/env node
/**
 * Skrypt indeksujący oficjalną dokumentację KlikKlima do bazy wektorowej pgvector (PostgreSQL).
 * Działa przyrostowo (incremental) w tempie 75 req/min, aby zawsze pozostawać poniżej limitu 100 req/min
 * na darmowym planie Google AI Studio.
 *
 * Uruchomienie:
 *   node scripts/index-knowledge-base.mjs
 */

import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// 1. Pobranie klucza API Gemini
function getApiKey() {
  let env = ''
  if (fs.existsSync('.env.local')) env += fs.readFileSync('.env.local', 'utf8') + '\n'
  if (fs.existsSync('.env')) env += fs.readFileSync('.env', 'utf8') + '\n'
  const match = env.match(/GOOGLE_GENERATIVE_AI_API_KEY=["']?([^"'\r\n]+)/)
  return match ? match[1] : process.env.GOOGLE_GENERATIVE_AI_API_KEY
}

const apiKey = getApiKey()
if (!apiKey) {
  console.error('❌ Błąd: Brak klucza GOOGLE_GENERATIVE_AI_API_KEY w .env / .env.local')
  process.exit(1)
}

// 2. Generowanie embeddingu dla pojedynczego chunka z odstępem czasowym
async function generateEmbedding(text, maxRetries = 5) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'models/gemini-embedding-001',
          outputDimensionality: 768,
          content: { parts: [{ text }] }
        })
      })

      const data = await res.json()

      if (res.ok && data.embedding?.values) {
        return data.embedding.values
      }

      if (res.status === 429 || data.error?.status === 'RESOURCE_EXHAUSTED') {
        const retryDetail = data.error?.details?.find(d => d['@type']?.includes('RetryInfo'))
        const serverDelay = retryDetail?.retryDelay ? parseInt(retryDetail.retryDelay, 10) : 35
        const waitSec = Math.max(serverDelay || 35, 30)
        console.warn(`\n⏳ Limit chwilowy (429). Czekam ${waitSec}s przed ponowieniem (${attempt}/${maxRetries})...`)
        await new Promise(r => setTimeout(r, (waitSec + 2) * 1000))
        continue
      }

      throw new Error(`Błąd API embeddingów: ${JSON.stringify(data)}`)
    } catch (err) {
      if (attempt === maxRetries) throw err
      console.warn(`⚠️ Błąd sieciowy: ${err.message}. Ponawiam za 5s...`)
      await new Promise(r => setTimeout(r, 5000))
    }
  }

  throw new Error('Nie udało się wygenerować embeddingu po ' + maxRetries + ' próbach.')
}

// 3. Dzielenie tekstu Markdown na logiczne sekcje
function chunkMarkdown(content, fileName) {
  const lines = content.split('\n')
  const chunks = []
  let currentHeader = fileName
  let currentParagraph = []

  for (const line of lines) {
    if (line.startsWith('#')) {
      if (currentParagraph.length > 0) {
        const text = currentParagraph.join('\n').trim()
        if (text.length > 40) {
          chunks.push({
            header: currentHeader,
            text: `${currentHeader}\n\n${text}`
          })
        }
        currentParagraph = []
      }
      currentHeader = line.replace(/^#+\s*/, '').trim()
    } else if (line.trim() === '') {
      if (currentParagraph.length > 0) {
        const text = currentParagraph.join('\n').trim()
        if (text.length > 100) {
          chunks.push({
            header: currentHeader,
            text: `${currentHeader}\n\n${text}`
          })
          currentParagraph = []
        }
      }
    } else {
      currentParagraph.push(line)
    }
  }

  if (currentParagraph.length > 0) {
    const text = currentParagraph.join('\n').trim()
    if (text.length > 40) {
      chunks.push({
        header: currentHeader,
        text: `${currentHeader}\n\n${text}`
      })
    }
  }

  return chunks
}

// 4. Poziomy uprawnień
function determineAccessLevel(category, fileName) {
  if (category === 'prezentacje' && fileName.includes('DEFINICJA-MONTAZU')) {
    return 'public'
  }
  if (category === 'prezentacje') {
    return 'internal_dispatcher'
  }
  if (category === 'funkcjonalnosci_do_wdrozenia' && fileName.includes('field-app')) {
    return 'field_tech'
  }
  if (category === 'architecture' || category === 'contracts') {
    return 'internal_admin'
  }
  return 'internal_dispatcher'
}

async function main() {
  console.log('🚀 Rozpoczynam indeksowanie merytorycznej bazy wiedzy KlikKlima do pgvector...')

  const docSources = [
    { dir: 'docs/prezentacje', category: 'prezentacje' },
    { dir: 'contracts', category: 'contracts' },
    { dir: 'docs/workflows', category: 'workflows' },
    { dir: 'docs/funkcjonalnosci_do_wdrozenia', category: 'funkcjonalnosci_do_wdrozenia' },
    { dir: 'docs/architecture', category: 'architecture' }
  ]

  const allItems = []

  for (const source of docSources) {
    const fullDir = path.resolve(process.cwd(), source.dir)
    if (!fs.existsSync(fullDir)) continue

    const files = fs.readdirSync(fullDir)
    for (const file of files) {
      if (!file.endsWith('.md') && !file.endsWith('.mjs')) continue
      // Pomijamy surowe diffy z archiwum migracji ADR
      if (file.startsWith('CHANGES-ADR-')) continue

      const filePath = path.join(fullDir, file)
      const content = fs.readFileSync(filePath, 'utf8')
      const chunks = chunkMarkdown(content, file)
      const accessLevel = determineAccessLevel(source.category, file)

      for (const chunk of chunks) {
        allItems.push({
          content: chunk.text,
          metadata: {
            file,
            category: source.category,
            header: chunk.header
          },
          accessLevel
        })
      }
    }
  }

  const isClean = process.argv.includes('--clean') || process.argv.includes('--force')
  if (isClean) {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE public.knowledge_base;')
    console.log('🧹 Wyczyszczono poprzednie rekordy w public.knowledge_base (--clean)')
  }

  // Sprawdzamy już zaindeksowane pliki, aby nie marnować limitów API
  const existingRows = await prisma.$queryRaw`SELECT DISTINCT metadata->>'file' as file FROM public.knowledge_base`
  const existingFiles = new Set(existingRows.map(r => r.file))

  const pendingItems = allItems.filter(item => !existingFiles.has(item.metadata.file))
  console.log(`📦 Łącznie: ${allItems.length} chunków (${existingFiles.size} plików już w bazie, ${pendingItems.length} nowych chunków do zaindeksowania).`)

  if (pendingItems.length === 0) {
    console.log('✅ Wszystkie pliki są już zaindeksowane w bazie wektorowej! Nic do roboty.')
    await prisma.$disconnect()
    return
  }

  let insertedCount = 0
  let currentFile = ''

  for (let i = 0; i < pendingItems.length; i++) {
    const item = pendingItems[i]

    if (item.metadata.file !== currentFile) {
      currentFile = item.metadata.file
      console.log(`\n📄 Indeksuję: [${item.metadata.category}] ${currentFile}`)
    }

    try {
      const embedding = await generateEmbedding(item.content)
      const vectorStr = `[${embedding.join(',')}]`
      const metadata = JSON.stringify(item.metadata)

      await prisma.$executeRawUnsafe(
        'INSERT INTO public.knowledge_base (content, metadata, access_level, embedding) VALUES ($1, $2::jsonb, $3, $4::vector)',
        item.content, metadata, item.accessLevel, vectorStr
      )
      insertedCount++
      process.stdout.write('.')
    } catch (err) {
      console.error(`\n⚠️ Błąd chunkingu w ${item.metadata.file}:`, err.message)
    }

    // Bezpieczny odstęp 800ms między zapytaniami = 75 req/min (zapas poniżej limitu 100 req/min)
    await new Promise(r => setTimeout(r, 800))
  }

  console.log(`\n\n🎉 SUKCES! Zindeksowano ${insertedCount}/${pendingItems.length} nowych chunków w pgvector (public.knowledge_base).`)
  await prisma.$disconnect()
}

main().catch(err => {
  console.error('Fatal error:', err)
  prisma.$disconnect()
  process.exit(1)
})
