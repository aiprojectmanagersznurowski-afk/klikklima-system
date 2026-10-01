import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { askAiAssistantAction } from '../src/app/(dashboard)/chat/actions';

const mockGenerateText = vi.fn();
const mockGroq = vi.fn((model: string) => `mocked-groq-${model}`);
const mockQueryRawUnsafe = vi.fn();

vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}));

vi.mock('@ai-sdk/groq', () => ({
  groq: (model: string) => mockGroq(model),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    $queryRawUnsafe: (...args: unknown[]) => mockQueryRawUnsafe(...args),
  },
}));

describe('AI Chat: askAiAssistantAction with Groq API', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('zwraca błąd, gdy brak zmiennej środowiskowej GROQ_API_KEY', async () => {
    delete process.env.GROQ_API_KEY;

    const result = await askAiAssistantAction([
      { role: 'user', content: 'Jakie są procedury montażowe?' },
    ]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Brak klucza GROQ_API_KEY');
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it('pomyślnie wywołuje model Groq Llama 3.3 i zwraca treść odpowiedzi', async () => {
    process.env.GROQ_API_KEY = 'gsk-test-key';
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY; // test bez klucza embeddingów
    delete process.env.GROQ_MODEL;

    mockGenerateText.mockResolvedValueOnce({
      text: 'Oto odpowiedź asystenta wygenerowana przez Groq Llama 3.3.',
    });

    const result = await askAiAssistantAction([
      { role: 'user', content: 'Jak dobrać klimatyzator do salonu 25m2?' },
    ]);

    expect(result.success).toBe(true);
    expect(result.content).toBe('Oto odpowiedź asystenta wygenerowana przez Groq Llama 3.3.');
    expect(mockGroq).toHaveBeenCalledWith('llama-3.3-70b-versatile');
    expect(mockGenerateText).toHaveBeenCalledTimes(1);
  });

  it('uwzględnia konfigurowalny model ze zmiennej GROQ_MODEL', async () => {
    process.env.GROQ_API_KEY = 'gsk-test-key';
    process.env.GROQ_MODEL = 'llama-3.1-8b-instant';
    delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    mockGenerateText.mockResolvedValueOnce({
      text: 'Szybka odpowiedź z Llama 3.1 8B.',
    });

    const result = await askAiAssistantAction([
      { role: 'user', content: 'Cześć' },
    ]);

    expect(result.success).toBe(true);
    expect(mockGroq).toHaveBeenCalledWith('llama-3.1-8b-instant');
  });

  it('bezpiecznie obsługuje błędy wykonania Groq API bez wywracania aplikacji', async () => {
    process.env.GROQ_API_KEY = 'gsk-test-key';
    mockGenerateText.mockRejectedValueOnce(new Error('Rate limit exceeded on Groq LPU'));

    const result = await askAiAssistantAction([
      { role: 'user', content: 'Test rate limitu' },
    ]);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Rate limit exceeded on Groq LPU');
  });
});
