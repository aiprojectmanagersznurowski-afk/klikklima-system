import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { askAiAssistantAction } from '../src/app/(dashboard)/chat/actions';

const mockGenerateText = vi.fn();
const mockGroq = vi.fn((model: string) => `mocked-groq-${model}`);
const mockGoogle = vi.fn((model: string) => `mocked-google-${model}`);
const mockQueryRawUnsafe = vi.fn();

vi.mock('ai', () => ({
  generateText: (...args: unknown[]) => mockGenerateText(...args),
}));

vi.mock('@ai-sdk/groq', () => ({
  groq: (model: string) => mockGroq(model),
}));

vi.mock('@ai-sdk/google', () => ({
  google: (model: string) => mockGoogle(model),
}));

vi.mock('@repo/database', () => ({
  prisma: {
    $queryRawUnsafe: (...args: unknown[]) => mockQueryRawUnsafe(...args),
  },
}));

describe('AI Chat: askAiAssistantAction with multi-provider (Groq default + Gemini)', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    mockQueryRawUnsafe.mockResolvedValue([]);
    // Mockowanie fetch dla embeddingów, by nie odpytywać Google w testach
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        embedding: {
          values: new Array(768).fill(0.01),
        },
      }),
    } as unknown as Response);
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
  });

  describe('Groq Provider (domyślny)', () => {
    it('domyślnie wybiera Groq i zwraca błąd, gdy brak zmiennej GROQ_API_KEY', async () => {
      delete process.env.GROQ_API_KEY;

      const result = await askAiAssistantAction([
        { role: 'user', content: 'Jakie są procedury montażowe?' },
      ]);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Brak klucza GROQ_API_KEY');
      expect(result.provider).toBe('groq');
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
      expect(result.provider).toBe('groq');
      expect(result.modelName).toBe('llama-3.3-70b-versatile');
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

      const result = await askAiAssistantAction(
        [{ role: 'user', content: 'Cześć' }],
        'groq'
      );

      expect(result.success).toBe(true);
      expect(result.provider).toBe('groq');
      expect(result.modelName).toBe('llama-3.1-8b-instant');
      expect(mockGroq).toHaveBeenCalledWith('llama-3.1-8b-instant');
    });

    it('bezpiecznie obsługuje błędy wykonania Groq API bez wywracania aplikacji', async () => {
      process.env.GROQ_API_KEY = 'gsk-test-key';
      mockGenerateText.mockRejectedValueOnce(new Error('Rate limit exceeded on Groq LPU'));

      const result = await askAiAssistantAction(
        [{ role: 'user', content: 'Test rate limitu' }],
        'groq'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Rate limit exceeded on Groq LPU');
      expect(result.provider).toBe('groq');
    });
  });

  describe('Gemini Provider', () => {
    it('zwraca błąd, gdy wybrano Gemini a brak zmiennej GOOGLE_GENERATIVE_AI_API_KEY', async () => {
      delete process.env.GOOGLE_GENERATIVE_AI_API_KEY;

      const result = await askAiAssistantAction(
        [{ role: 'user', content: 'Pytanie do Gemini' }],
        'gemini'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Brak klucza GOOGLE_GENERATIVE_AI_API_KEY');
      expect(result.provider).toBe('gemini');
      expect(mockGenerateText).not.toHaveBeenCalled();
    });

    it('pomyślnie wywołuje model Google Gemini i zwraca treść odpowiedzi', async () => {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'gemini-test-key';
      delete process.env.GEMINI_MODEL;

      mockGenerateText.mockResolvedValueOnce({
        text: 'Odpowiedź wygenerowana przez Google Gemini.',
      });

      mockQueryRawUnsafe.mockResolvedValueOnce([
        {
          id: 'chunk-1',
          content: 'Treść procedury montażowej',
          metadata: { file: 'procedury.md', header: 'Montaż', category: 'montaz' },
          similarity: 0.88,
        },
      ]);

      const result = await askAiAssistantAction(
        [{ role: 'user', content: 'Pytanie techniczne' }],
        'gemini'
      );

      expect(result.success).toBe(true);
      expect(result.content).toBe('Odpowiedź wygenerowana przez Google Gemini.');
      expect(result.provider).toBe('gemini');
      expect(result.modelName).toBe('gemini-2.5-flash');
      expect(mockGoogle).toHaveBeenCalledWith('gemini-2.5-flash');
      expect(mockGenerateText).toHaveBeenCalledTimes(1);
      expect(result.sources).toHaveLength(1);
      expect(result.sources?.[0].file).toBe('procedury.md');
    });

    it('bezpiecznie obsługuje błędy wykonania Gemini API', async () => {
      process.env.GOOGLE_GENERATIVE_AI_API_KEY = 'gemini-test-key';
      mockGenerateText.mockRejectedValueOnce(new Error('Google API quota exceeded'));

      const result = await askAiAssistantAction(
        [{ role: 'user', content: 'Test limitu' }],
        'gemini'
      );

      expect(result.success).toBe(false);
      expect(result.error).toContain('Google API quota exceeded');
      expect(result.provider).toBe('gemini');
    });
  });
});
