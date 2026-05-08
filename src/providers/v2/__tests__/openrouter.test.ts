import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenRouterProvider } from '../openrouter';

describe('OpenRouterProvider v2', () => {
  const mockApiKey = 'sk-or-test-key';
  let provider: OpenRouterProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new OpenRouterProvider({ apiKey: mockApiKey });
  });

  describe('constructor', () => {
    it('should initialize with correct defaults', () => {
      expect(provider.name).toBe('openrouter');
      expect(provider.defaultModel).toBe('openai/gpt-4o-mini');
    });

    it('should accept custom configuration', () => {
      const customProvider = new OpenRouterProvider({
        apiKey: mockApiKey,
        baseUrl: 'https://custom.openrouter.com/api/v1',
        timeout: 30000,
      });
      expect(customProvider.name).toBe('openrouter');
    });
  });

  describe('validateConfig', () => {
    it('should return true with valid API key', () => {
      expect(provider.validateConfig()).toBe(true);
    });

    it('should return false with empty API key', () => {
      const invalidProvider = new OpenRouterProvider({ apiKey: '' });
      expect(invalidProvider.validateConfig()).toBe(false);
    });

    it('should return true with whitespace-only API key (trim not enforced)', () => {
      const providerWithWhitespace = new OpenRouterProvider({ apiKey: '   ' });
      // Note: validation checks for existence, not content validity
      expect(providerWithWhitespace.validateConfig()).toBe(true);
    });
  });

  describe('fetchModels', () => {
    it('should return models from API when successful', async () => {
      const mockModels = {
        data: [
          {
            id: 'openai/gpt-4o',
            name: 'GPT-4o',
            context_length: 128000,
            pricing: {
              prompt: 0.000005,
              completion: 0.000015,
            },
          },
          {
            id: 'anthropic/claude-3.5-sonnet',
            name: 'Claude 3.5 Sonnet',
            context_length: 200000,
            pricing: {
              prompt: 0.000003,
              completion: 0.000015,
            },
          },
        ],
      };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockModels),
      });

      const models = await provider.fetchModels();

      expect(models.length).toBe(2);
      expect(models[0].id).toBe('openai/gpt-4o');
      expect(models[0].contextLength).toBe(128000);
      expect(models[0].pricing?.prompt).toBe(0.000005);
    });

    it('should return empty array when API fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('API failure'));

      const models = await provider.fetchModels();

      expect(models).toEqual([]);
    });

    it('should handle API error response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      const models = await provider.fetchModels();

      expect(models).toEqual([]);
    });

    it('should handle malformed response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ invalid: 'data' }),
      });

      const models = await provider.fetchModels();

      expect(models).toEqual([]);
    });
  });

  describe('complete', () => {
    it('should handle API errors gracefully', async () => {
      const messages = [{ role: 'user' as const, content: 'Hello' }];

      // Should throw when API fails
      await expect(
        provider.complete(messages, { model: 'openai/gpt-4o-mini' })
      ).rejects.toThrow();
    });
  });

  describe('stream', () => {
    it('should return async iterable', async () => {
      const messages = [{ role: 'user' as const, content: 'Hello' }];
      const stream = provider.stream(messages);

      // Should be an async iterable
      expect(stream[Symbol.asyncIterator]).toBeDefined();
    });
  });
});
