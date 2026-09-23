import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const SRC_DIR = path.resolve(__dirname, "../src");

describe("AI Chat Input UI (21stdev integration) & Chat Page", () => {
  const componentPath = path.join(SRC_DIR, "components/ui/ai-chat-input.tsx");
  const chatPagePath = path.join(SRC_DIR, "app/(dashboard)/chat/page.tsx");

  it("fizyczny plik components/ui/ai-chat-input.tsx istnieje i eksportuje PromptInput", () => {
    expect(existsSync(componentPath)).toBe(true);
    const content = readFileSync(componentPath, "utf-8");
    expect(content).toContain("export const PromptInput");
    expect(content).toContain("PromptInput.displayName = \"PromptInput\"");
  });

  it("ai-chat-input.tsx stosuje wylacznie ikony z lucide-react i zachowuje czyste typowanie", () => {
    const content = readFileSync(componentPath, "utf-8");

    // Zgodność z regułami repozytorium: ADR-001 & GEMINI.md
    const forbiddenTsIgnore = ["@", "ts", "-ignore"].join("")
    const forbiddenAsAny = ["as", "any"].join(" ")
    expect(content).not.toContain(forbiddenTsIgnore)
    expect(content).not.toContain(forbiddenAsAny)

    // Brak niebezpiecznych zewnętrznych CDN assetów
    expect(content).not.toContain("https://cdn.21st.dev");

    // Wykorzystanie biblioteki lucide-react
    expect(content).toContain("from \"lucide-react\"");
    expect(content).toContain("ArrowUp");
    expect(content).toContain("Mic");
    expect(content).toContain("Square");
  });

  it("chat/page.tsx integruje PromptInput i zawiera sekcję sugerowanych promptów pod polem chata", () => {
    const content = readFileSync(chatPagePath, "utf-8");

    // Import i obecność komponentu PromptInput
    expect(content).toContain("from '@/components/ui/ai-chat-input'");
    expect(content).toContain("<PromptInput");

    // Sugerowane prompty umieszczone w dolnej belce pod polem czatu
    expect(content).toContain("SUGGESTED_PROMPTS.map");
    expect(content).toContain("Sugerowane:");

    // Weryfikacja kolejności w JSX (najpierw PromptInput, a pod nim sugerowane prompty)
    const promptInputIndex = content.indexOf("<PromptInput");
    const suggestedPromptsIndex = content.indexOf("SUGGESTED_PROMPTS.map");
    expect(promptInputIndex).toBeGreaterThan(0);
    expect(suggestedPromptsIndex).toBeGreaterThan(promptInputIndex);
  });
});
