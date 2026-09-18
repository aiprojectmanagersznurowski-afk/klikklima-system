"use server"

import { google } from '@ai-sdk/google'
import { generateText } from 'ai'
import fs from 'fs'
import path from 'path'

function getKnowledgeBaseContext() {
  let context = 'Poniżej znajduje się baza wiedzy (pliki z repozytorium):\n\n'
  const workspaceRoot = path.join(process.cwd(), '../../')

  const targets = [
    'contracts',
    'docs/funkcjonalnosci_do_wdrozenia',
    'docs/architecture',
    'docs/performance'
  ]

  for (const target of targets) {
    const targetPath = path.join(workspaceRoot, target)
    if (!fs.existsSync(targetPath)) continue

    const files = fs.readdirSync(targetPath)
    for (const file of files) {
      if (file.endsWith('.md') || file.endsWith('.mjs')) {
        const filePath = path.join(targetPath, file)
        try {
          const content = fs.readFileSync(filePath, 'utf-8')
          context += `--- PLIK: ${target}/${file} ---\n${content}\n\n`
        } catch (e) {
          console.error(`Failed to read file ${filePath}:`, e)
        }
      }
    }
  }

  return context
}

export async function askAiAssistantAction(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>
) {
  const systemPrompt = `Jesteś zaawansowanym asystentem AI dla administratorów i dyspozytorów systemu KlikKlima (panel B2B).
Twoim zadaniem jest pomaganie użytkownikom poprzez dostarczanie precyzyjnych informacji na podstawie dokumentacji wewnętrznej, procedur oraz kontraktów.
Używaj bogatego formatowania Markdown: tabel, list, pogrubień, a jeśli to uzasadnione, twórz wykresy Mermaid.

Odpowiadaj ZAWSZE na podstawie poniższej bazy wiedzy. Jeżeli nie znasz odpowiedzi na podstawie tych dokumentów, powiedz o tym.
Zawsze pisz w języku polskim, w profesjonalnym i pomocnym tonie.

BAZA WIEDZY:
${getKnowledgeBaseContext()}
`

  const { text } = await generateText({
    model: google('gemini-1.5-pro'),
    system: systemPrompt,
    messages: messages.map(m => ({
      role: m.role,
      content: m.content
    }))
  })

  return { content: text }
}
