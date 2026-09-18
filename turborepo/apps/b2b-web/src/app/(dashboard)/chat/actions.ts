"use server"

import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import { listDocs, readDocContent } from '../../../lib/docs/docs-catalog'

export type AskAiActionResult = {
  success: boolean
  content: string
  error?: string
}

function getKnowledgeBaseContext(userQuery: string): string {
  try {
    const allDocs = listDocs()
    // Pomijamy obszerne zlecenia programistyczne (workorders) i logi testów (testing),
    // aby nie przekraczać limitu tokenów na minutę (250k w darmowym planie Google AI Studio).
    const businessDocs = allDocs.filter(
      d => d.categoryId !== 'workorders' && d.categoryId !== 'testing'
    )

    const queryWords = userQuery
      .toLowerCase()
      .replace(/[^a-z0-9ąćęłńóśźż]/gi, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)

    // Punktowanie dokumentów po trafności zapytania
    const scored = businessDocs.map(doc => {
      let score = 0
      const titleLower = (doc.title + ' ' + doc.fileName).toLowerCase()
      for (const word of queryWords) {
        if (titleLower.includes(word)) {
          score += 5
        }
      }
      if (doc.categoryId === 'prezentacje' || doc.categoryId === 'architecture') {
        score += 1
      }
      return { doc, score }
    })

    scored.sort((a, b) => b.score - a.score)

    let context = 'Poniżej znajduje się baza wiedzy (dokumentacja z repozytorium KlikKlima):\n\n'
    let totalLength = 0
    // Limit długości kontekstu (~30k tokenów), gwarantujący bezpieczny zapas poniżej 250k tokenów/min
    const MAX_CONTEXT_LENGTH = 120000

    for (const item of scored) {
      try {
        const content = readDocContent(item.doc)
        if (content) {
          if (totalLength + content.length > MAX_CONTEXT_LENGTH) {
            const remaining = MAX_CONTEXT_LENGTH - totalLength
            if (remaining > 1000) {
              context += `--- DOKUMENT: ${item.doc.title} (${item.doc.fileName}) ---\n${content.slice(0, remaining)}...\n\n`
            }
            break
          }
          context += `--- DOKUMENT: ${item.doc.title} (${item.doc.fileName}) ---\n${content}\n\n`
          totalLength += content.length
        }
      } catch (err) {
        console.warn(`Nie udało się odczytać dokumentu: ${item.doc.fileName}`, err)
      }
    }

    return context
  } catch (error) {
    console.error('Błąd podczas ładowania bazy wiedzy:', error)
    return 'Baza wiedzy chwilowo niedostępna.'
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
      error: 'Brak klucza GOOGLE_GENERATIVE_AI_API_KEY w konfiguracji środowiska produkcyjnego (Vercel). Dodaj zmienną środowiskową w panelu Vercel i wykonaj Redeploy.'
    }
  }

  try {
    const latestUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || ''
    const knowledgeContext = getKnowledgeBaseContext(latestUserMessage)

    const systemPrompt = `Jesteś zaawansowanym asystentem AI dla administratorów i dyspozytorów systemu KlikKlima (panel B2B).
Twoim zadaniem jest pomaganie użytkownikom poprzez dostarczanie precyzyjnych informacji na podstawie dokumentacji wewnętrznej, procedur oraz kontraktów.
Używaj bogatego formatowania Markdown: tabel, list, pogrubień, a jeśli to uzasadnione, twórz wykresy Mermaid.

Odpowiadaj ZAWSZE na podstawie poniższej bazy wiedzy. Jeżeli nie znasz odpowiedzi na podstawie tych dokumentów, powiedz o tym.
Zawsze pisz w języku polskim, w profesjonalnym i pomocnym tonie.

BAZA WIEDZY:
${knowledgeContext}
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
      content: text
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
