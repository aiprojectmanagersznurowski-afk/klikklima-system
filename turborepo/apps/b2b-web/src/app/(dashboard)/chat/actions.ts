"use server"

import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import { listDocs, readDocContent } from '../../../lib/docs/docs-catalog'

export type AskAiActionResult = {
  success: boolean
  content: string
  error?: string
}

function getKnowledgeBaseContext(): string {
  try {
    let context = 'Poniżej znajduje się baza wiedzy (dokumentacja z repozytorium KlikKlima):\n\n'
    const docs = listDocs()

    for (const doc of docs) {
      try {
        const content = readDocContent(doc)
        if (content) {
          context += `--- DOKUMENT: ${doc.title} (${doc.fileName}) ---\n${content}\n\n`
        }
      } catch (err) {
        console.warn(`Nie udało się odczytać dokumentu: ${doc.fileName}`, err)
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
    const systemPrompt = `Jesteś zaawansowanym asystentem AI dla administratorów i dyspozytorów systemu KlikKlima (panel B2B).
Twoim zadaniem jest pomaganie użytkownikom poprzez dostarczanie precyzyjnych informacji na podstawie dokumentacji wewnętrznej, procedur oraz kontraktów.
Używaj bogatego formatowania Markdown: tabel, list, pogrubień, a jeśli to uzasadnione, twórz wykresy Mermaid.

Odpowiadaj ZAWSZE na podstawie poniższej bazy wiedzy. Jeżeli nie znasz odpowiedzi na podstawie tych dokumentów, powiedz o tym.
Zawsze pisz w języku polskim, w profesjonalnym i pomocnym tonie.

BAZA WIEDZY:
${getKnowledgeBaseContext()}
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
