"use server"

import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import { prisma } from '@repo/database'

export type SourceItem = {
  file: string
  category: string
  header: string
  similarity: number
}

export type AskAiActionResult = {
  success: boolean
  content: string
  error?: string
  sources?: SourceItem[]
}

async function generateQueryEmbedding(text: string, apiKey: string, retries = 2): Promise<number[]> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:embedContent?key=${apiKey}`

  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'models/gemini-embedding-001',
        outputDimensionality: 768,
        content: { parts: [{ text }] }
      })
    })

    if (res.status === 429 && attempt <= retries) {
      await new Promise(r => setTimeout(r, 2000 * attempt))
      continue
    }

    if (!res.ok) {
      const errorText = await res.text()
      throw new Error(`Błąd generowania wektora zapytania (${res.status}): ${errorText}`)
    }

    const data = await res.json()
    if (!data.embedding?.values) {
      throw new Error(`Brak wektora w odpowiedzi modelu embeddingów.`)
    }

    return data.embedding.values
  }

  throw new Error('Przekroczono limit prób generowania wektora zapytania.')
}

async function searchKnowledgeBase(
  query: string,
  apiKey: string,
  allowedLevels: string[] = ['public', 'internal_dispatcher', 'internal_admin']
) {
  try {
    const embedding = await generateQueryEmbedding(query, apiKey)
    const vectorStr = `[${embedding.join(',')}]`

    const results = await prisma.$queryRawUnsafe<Array<{
      id: string
      content: string
      metadata: { file?: string; category?: string; header?: string } | null
      similarity: number
    }>>(
      `SELECT id, content, metadata, similarity 
       FROM public.match_knowledge_base($1::vector, 0.25, 7, $2::text[])`,
      vectorStr,
      allowedLevels
    )

    return results
  } catch (err) {
    console.error('Błąd podczas wyszukiwania wektorowego w pgvector:', err)
    return []
  }
}

export async function askAiAssistantAction(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<AskAiActionResult> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY

  if (!apiKey) {
    console.error('Błąd: Brak zmiennej GOOGLE_GENERATIVE_AI_API_KEY')
    return {
      success: false,
      content: '',
      error: 'Brak klucza GOOGLE_GENERATIVE_AI_API_KEY w konfiguracji środowiska. Upewnij się, że zmienna jest ustawiona w Vercel.'
    }
  }

  try {
    const latestUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || ''

    // Wyszukiwanie wektorowe pgvector w bazie wiedzy z filtrem uprawnień
    const matchedChunks = await searchKnowledgeBase(latestUserMessage, apiKey, [
      'public',
      'internal_dispatcher',
      'internal_admin'
    ])

    let context = ''
    const sources: SourceItem[] = []

    if (matchedChunks.length > 0) {
      context += 'Poniżej znajdują się najbardziej dopasowane fragmenty oficjalnej dokumentacji i procedur KlikKlima z bazy wektorowej:\n\n'
      for (const match of matchedChunks) {
        const file = match.metadata?.file || 'dokument'
        const header = match.metadata?.header || 'Główna'
        const category = match.metadata?.category || 'ogólne'
        const simPercent = Math.round((match.similarity || 0) * 100)

        context += `--- ŹRÓDŁO: ${file} | Sekcja: ${header} (Trafność: ${simPercent}%) ---\n`
        context += `${match.content}\n\n`

        if (!sources.some(s => s.file === file && s.header === header)) {
          sources.push({
            file,
            header,
            category,
            similarity: match.similarity
          })
        }
      }
    } else {
      context = 'Brak bezpośrednich dopasowań w bazie wiedzy dla tego zapytania.'
    }

    const systemPrompt = `Jesteś zaawansowanym, profesjonalnym asystentem AI dla administratorów i dyspozytorów systemu KlikKlima (panel B2B).
Twoim celem jest dostarczanie precyzyjnych, wyczerpujących i estetycznie sformatowanych informacji na podstawie wewnętrznej bazy wiedzy, procedur i kontraktów.

ZASADY FORMATOWANIA ODPOWIEDZI (BARDZO WAŻNE):
1. Struktura i czytelność: Zawsze formatuj odpowiedzi przejrzyście w Markdown. Dziel dłuższe odpowiedzi na sekcje z nagłówkami (### lub ##).
2. Wyróżnienia: Używaj pogrubień (**bold**) dla kluczowych terminów, liczb, kwot, statusów i progów czasowych (SLA).
3. Tabele: Jeśli prezentujesz porównania, parametry techniczne, koszyki usług, stawki lub składniki pakietów, ZAWSZE twórz estetyczną tabelę Markdown.
4. Listy: Używaj punktorów i numeracji dla list kroków, warunków lub wyliczeń. Unikaj monotonnych, zbitych bloków tekstu.
5. Diagramy procesowe: Jeśli pytanie dotyczy przepływu statusów, procedur montażu, obsługi reklamacji lub logistyki, ZAWSZE dołącz wykres Mermaid (np. \`\`\`mermaid\nflowchart TD ... \`\`\`).
6. Rzetelność: Odpowiadaj wyłącznie na podstawie poniższej bazy wiedzy KlikKlima. Jeśli czegoś w niej nie ma, zaznacz to otwarcie. Pisz zawsze w języku polskim.

FRAGMENTY BAZY WIEDZY (PGVECTOR):
${context}
`

    const { text } = await generateText({
      model: google('gemini-3.6-flash'),
      system: systemPrompt,
      messages: messages.map(m => ({
        role: m.role,
        content: m.content
      }))
    })

    return {
      success: true,
      content: text,
      sources
    }
  } catch (err: any) {
    console.error('Błąd wywołania Gemini API w askAiAssistantAction:', err)
    return {
      success: false,
      content: '',
      error: err?.message || 'Wystąpił błąd podczas komunikacji z modelem Google Gemini.'
    }
  }
}
