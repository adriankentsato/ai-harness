import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NvidiaProvider } from '../nvidia';

describe('NvidiaProvider v2', () => {
  const mockApiKey = 'nvapi-test-key';
  let provider: NvidiaProvider;

  beforeEach(() => {
    vi.clearAllMocks();
    provider = new NvidiaProvider({ apiKey: mockApiKey });
  });

  describe('constructor', () => {
    it('should initialize with correct defaults', () => {
      expect(provider.name).toBe('nvidia');
      expect(provider.defaultModel).toBe('meta/llama-3.1-405b-instruct');
    });

    it('should accept custom configuration', () => {
      const customProvider = new NvidiaProvider({
        apiKey: mockApiKey,
        baseUrl: 'https://custom.nvidia.com/v1',
        timeout: 30000,
      });
      expect(customProvider.name).toBe('nvidia');
    });
  });

  describe('validateConfig', () => {
    it('should return true with valid API key', () => {
      expect(provider.validateConfig()).toBe(true);
    });

    it('should return false with empty API key', () => {
      const invalidProvider = new NvidiaProvider({ apiKey: '' });
      expect(invalidProvider.validateConfig()).toBe(false);
    });

    it('should return false with undefined API key', () => {
      const invalidProvider = new NvidiaProvider({ apiKey: undefined as unknown as string });
      expect(invalidProvider.validateConfig()).toBe(false);
    });
  });

  describe('fetchModels', () => {
    it('should return models from API when successful', async () => {
      const mockModels = {
        data: [
          {
            id: 'meta/llama-3.1-405b-instruct',
            object: 'model',
            created: 1700000000,
            owned_by: 'meta',
          },
          {
            id: 'nvidia/llama-3.1-nemotron-70b-instruct',
            object: 'model',
            created: 1700000000,
            owned_by: 'nvidia',
          },
        ],
      };
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockModels),
      });

      const models = await provider.fetchModels();

      expect(models.length).toBe(2);
      expect(models[0].id).toBe('meta/llama-3.1-405b-instruct');
      expect(models[0].description).toContain('meta');
    });

    it('should throw error when API fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        statusText: 'Unauthorized',
      });

      await expect(provider.fetchModels()).rejects.toThrow('Failed to fetch models');
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(provider.fetchModels()).rejects.toThrow();
    });
  });

  describe('complete', () => {
    it('should handle API errors gracefully', async () => {
      const messages = [{ role: 'user' as const, content: 'Hello' }];

      // Should throw when API fails
      await expect(
        provider.complete(messages, { model: 'meta/llama-3.1-8b-instruct' })
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
