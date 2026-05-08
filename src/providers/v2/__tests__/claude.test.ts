import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClaudeProvider } from '../claude';

describe('ClaudeProvider v2', () => {
  const mockApiKey = 'sk-ant-test-key';
  let provider: ClaudeProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new ClaudeProvider({ apiKey: mockApiKey });
  });

  describe('constructor', () => {
    it('should initialize with correct defaults', () => {
      expect(provider.name).toBe('claude');
      expect(provider.defaultModel).toBe('claude-3-7-sonnet-20250219');
    });

    it('should accept custom configuration', () => {
      const customProvider = new ClaudeProvider({
        apiKey: mockApiKey,
        baseUrl: 'https://custom.anthropic.com',
        timeout: 30000,
      });
      expect(customProvider.name).toBe('claude');
    });
  });

  describe('validateConfig', () => {
    it('should return true with valid API key', () => {
      expect(provider.validateConfig()).toBe(true);
    });

    it('should return false with empty API key', () => {
      const invalidProvider = new ClaudeProvider({ apiKey: '' });
      expect(invalidProvider.validateConfig()).toBe(false);
    });

    it('should return true with whitespace-only API key (trim not enforced)', () => {
      const providerWithWhitespace = new ClaudeProvider({ apiKey: '   ' });
      // Note: validation checks for existence, not content validity
      expect(providerWithWhitespace.validateConfig()).toBe(true);
    });
  });

  describe('fetchModels', () => {
    it('should return fallback models when API fails', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('API failure'));

      const models = await provider.fetchModels();

      expect(models.length).toBeGreaterThan(0);
      expect(models.some((m) => m.id === 'claude-3-7-sonnet-20250219')).toBe(true);
      expect(models.some((m) => m.id === 'claude-3-5-sonnet-latest')).toBe(true);
    });

    it('should return models from API when successful', async () => {
      const mockModels = {
        data: [
          {
            id: 'claude-3-7-sonnet-20250219',
            name: 'Claude 3.7 Sonnet',
          },
          {
            id: 'claude-3-opus-latest',
            name: 'Claude 3 Opus',
          },
        ],
      };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockModels),
      });

      const models = await provider.fetchModels();

      expect(models.length).toBe(2);
      expect(models[0].id).toBe('claude-3-7-sonnet-20250219');
      expect(models[0].contextLength).toBe(200000);
    });

    it('should handle API error response', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
      });

      const models = await provider.fetchModels();

      // Should return fallback models
      expect(models.length).toBeGreaterThan(0);
    });
  });

  describe('complete', () => {
    it('should handle errors gracefully', async () => {
      const messages = [{ role: 'user' as const, content: 'Hello' }];

      // Should throw when API fails (no valid mock setup)
      await expect(
        provider.complete(messages)
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
